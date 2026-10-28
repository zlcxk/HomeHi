import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { prisma } from "@/lib/db";
import { getStorageDriver, makePlaybackKey } from "@/lib/storage";
import { storeThumbnail, VIDEO_COVER_MAX } from "@/lib/media-variants";

const MAX_EDGE = 1280;
const MAX_TRANSCODE_MS = 30 * 60_000;
const SKIP_IF_SMALLER_THAN = 10 * 1024 * 1024;
const SAME_QUALITY_RATIO = 0.98;
const SAFE_CODECS = new Set(["h264", "vp8", "vp9", "av1"]);

let resolved: string | null | undefined;
let draining = false;

/** 优先用随项目安装的静态 ffmpeg；Docker/服务器也可以用系统包或 FFMPEG_PATH。 */
export async function resolveFfmpeg(): Promise<string | null> {
  if (resolved !== undefined) return resolved;

  const configured = process.env.FFMPEG_PATH?.trim();
  if (configured && existsSync(configured)) {
    resolved = configured;
    return resolved;
  }

  try {
    const mod = (await import("ffmpeg-static")) as { default?: string | null };
    if (mod.default && existsSync(mod.default)) {
      resolved = mod.default;
      return resolved;
    }
  } catch {
    // optional dependency not installed (for example npm ci --ignore-scripts)
  }

  resolved = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0 ? "ffmpeg" : null;
  return resolved;
}

function runFfmpeg(command: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8000);
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("视频压缩超时，已保留原视频"));
    }, timeoutMs);
    timer.unref();

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().split("\n").slice(-2).join(" ") || `ffmpeg 退出码 ${code}`));
    });
  });
}

/** ffmpeg 没有 ffprobe 时也能从 -i 的 stderr 里读到编码。 */
function probeVideoCodec(command: string, file: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(command, ["-hide_banner", "-i", file], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(null);
    }, 15_000);
    timer.unref();
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", () => {
      clearTimeout(timer);
      const match = /Video:\s*([a-zA-Z0-9_]+)/.exec(stderr);
      resolve(match ? match[1].toLowerCase() : null);
    });
  });
}

async function streamToFile(stream: NodeJS.ReadableStream, target: string): Promise<void> {
  await pipeline(stream, createWriteStream(target));
}

function outputExtension(mimeType: string): string {
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/quicktime") return "mov";
  return "mp4";
}

async function claimNextVideo() {
  const candidate = await prisma.media.findFirst({
    where: {
      mediaType: "VIDEO",
      status: "ACTIVE",
      OR: [{ playbackStatus: "PENDING" }, { thumbnailStatus: "PENDING" }],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const data: {
    playbackStatus?: string;
    playbackError?: null;
    thumbnailStatus?: string;
    thumbnailError?: null;
  } = {};
  if (candidate.playbackStatus === "PENDING") {
    data.playbackStatus = "PROCESSING";
    data.playbackError = null;
  }
  if (candidate.thumbnailStatus === "PENDING") {
    data.thumbnailStatus = "PROCESSING";
    data.thumbnailError = null;
  }
  if (Object.keys(data).length === 0) return null;

  const claimed = await prisma.media.updateMany({
    where: {
      id: candidate.id,
      playbackStatus: candidate.playbackStatus,
      thumbnailStatus: candidate.thumbnailStatus,
    },
    data,
  });
  if (claimed.count !== 1) return null;
  return prisma.media.findUnique({ where: { id: candidate.id } });
}

async function markSkipped(id: string, reason: string): Promise<void> {
  await prisma.media
    .updateMany({
      where: { id, playbackStatus: "PROCESSING" },
      data: { playbackStatus: "SKIPPED", playbackError: reason },
    })
    .catch(() => undefined);
}

function coverTimestamp(durationSeconds: number | null): number {
  if (!durationSeconds) return 1;
  return Math.max(
    0.5,
    Math.min(durationSeconds * (0.15 + Math.random() * 0.7), durationSeconds - 0.1),
  );
}

async function generateCover(
  ffmpeg: string,
  inputPath: string,
  tempDir: string,
  media: NonNullable<Awaited<ReturnType<typeof claimNextVideo>>>,
) {
  const driver = await getStorageDriver(media.storageDriver);
  const posterPath = path.join(tempDir, "poster.jpg");
  try {
    await runFfmpeg(
      ffmpeg,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        String(coverTimestamp(media.durationSeconds)),
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        `scale='min(${VIDEO_COVER_MAX},iw)':-2`,
        "-q:v",
        "3",
        posterPath,
      ],
      60_000,
    );
    const thumb = await storeThumbnail(await readFile(posterPath), driver, VIDEO_COVER_MAX);
    if (!thumb) throw new Error("无法写入视频封面");
    await prisma.media.update({
      where: { id: media.id },
      data: {
        thumbnailKey: thumb.key,
        thumbnailWidth: thumb.width,
        thumbnailHeight: thumb.height,
        thumbnailStatus: "READY",
        thumbnailError: null,
      },
    });
    if (media.thumbnailKey && media.thumbnailKey !== thumb.key) {
      await driver.remove(media.thumbnailKey).catch(() => undefined);
    }
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await prisma.media
      .updateMany({
        where: { id: media.id, thumbnailStatus: "PROCESSING" },
        data: { thumbnailStatus: "FAILED", thumbnailError: message },
      })
      .catch(() => undefined);
  }
}

async function processVideo(media: NonNullable<Awaited<ReturnType<typeof claimNextVideo>>>): Promise<void> {
  const ffmpeg = await resolveFfmpeg();
  const shouldTranscode = media.playbackStatus === "PROCESSING";
  const shouldCover = media.thumbnailStatus === "PROCESSING" || !media.thumbnailKey;

  if (!ffmpeg) {
    const reason = "服务器未安装 ffmpeg，视频保留原片。安装 ffmpeg 后重新压缩即可生成播放版。";
    if (shouldCover) {
      await prisma.media
        .updateMany({
          where: { id: media.id, thumbnailStatus: "PROCESSING" },
          data: { thumbnailStatus: "FAILED", thumbnailError: reason },
        })
        .catch(() => undefined);
    }
    if (shouldTranscode) await markSkipped(media.id, reason);
    return;
  }

  if (!shouldTranscode && !shouldCover) return;

  const driver = await getStorageDriver(media.storageDriver);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "homehi-video-"));
  const inputPath = path.join(tempDir, `input.${outputExtension(media.mimeType)}`);
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    const object = await driver.get(media.storageKey);
    if (!object) {
      const reason = "找不到原视频，保留原片。";
      if (shouldCover) {
        await prisma.media
          .updateMany({
            where: { id: media.id, thumbnailStatus: "PROCESSING" },
            data: { thumbnailStatus: "FAILED", thumbnailError: reason },
          })
          .catch(() => undefined);
      }
      if (shouldTranscode) await markSkipped(media.id, reason);
      return;
    }
    await streamToFile(object.stream, inputPath);

    // 封面和压缩互不影响：封面失败，原视频仍能正常打开。
    if (shouldCover) await generateCover(ffmpeg, inputPath, tempDir, media);

    if (!shouldTranscode) return;

    const maxEdge = Math.max(media.width || 0, media.height || 0);
    const codec = await probeVideoCodec(ffmpeg, inputPath);
    const safeContainer = media.mimeType === "video/mp4" || media.mimeType === "video/webm";
    const safeCodec = codec !== null && SAFE_CODECS.has(codec);
    if (
      media.fileSize <= SKIP_IF_SMALLER_THAN &&
      maxEdge > 0 &&
      maxEdge <= MAX_EDGE &&
      safeContainer &&
      safeCodec
    ) {
      await markSkipped(media.id, "原视频已经足够小，保留原片。");
      return;
    }

    await runFfmpeg(
      ffmpeg,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        inputPath,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        `scale='min(${MAX_EDGE},iw)':'min(${MAX_EDGE},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-profile:v",
        "main",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      MAX_TRANSCODE_MS,
    );

    const outputStat = await stat(outputPath);
    if (outputStat.size <= 0) {
      await markSkipped(media.id, "压缩没有生成有效视频，保留原片。");
      return;
    }
    if (outputStat.size >= media.fileSize * SAME_QUALITY_RATIO) {
      await markSkipped(media.id, "原视频已经足够小，压缩后体积没有明显减少。");
      return;
    }

    const playbackKey = makePlaybackKey();
    await driver.put(playbackKey, await readFile(outputPath), "video/mp4");
    await prisma.media.update({
      where: { id: media.id },
      data: {
        playbackKey,
        playbackSize: outputStat.size,
        playbackStatus: "READY",
        playbackError: null,
      },
    });
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    if (shouldCover) {
      await prisma.media
        .updateMany({
          where: { id: media.id, thumbnailStatus: "PROCESSING" },
          data: { thumbnailStatus: "FAILED", thumbnailError: message },
        })
        .catch(() => undefined);
    }
    if (shouldTranscode) {
      await prisma.media
        .updateMany({
          where: { id: media.id, playbackStatus: "PROCESSING" },
          data: { playbackStatus: "FAILED", playbackError: message },
        })
        .catch(() => undefined);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * 后台处理一个视频。返回是否尝试过任务，worker 可以循环调用直到队列为空。
 * 只缺封面的视频也会进队列；压缩和封面互不阻塞。
 */
export async function processNextVideoJob(): Promise<boolean> {
  const media = await claimNextVideo();
  if (!media) return false;
  try {
    await processVideo(media);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await prisma.media
      .updateMany({
        where: { id: media.id, playbackStatus: "PROCESSING" },
        data: { playbackStatus: "FAILED", playbackError: message },
      })
      .catch(() => undefined);
    await prisma.media
      .updateMany({
        where: { id: media.id, thumbnailStatus: "PROCESSING" },
        data: { thumbnailStatus: "FAILED", thumbnailError: message },
      })
      .catch(() => undefined);
    console.error("[video] job failed", media.id, error);
  }
  return true;
}

export async function drainVideoQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (await processNextVideoJob()) {
      // 队列里可能一次积压了多个视频；逐个处理，避免同时占满 CPU。
    }
  } catch (error) {
    console.error("[video] queue failed", error);
  } finally {
    draining = false;
  }
}

/** worker 崩溃后，把长时间停留在 PROCESSING 的任务放回队列。 */
export async function recoverStaleVideoJobs(): Promise<void> {
  const before = new Date(Date.now() - MAX_TRANSCODE_MS);
  const stale = await prisma.media.findMany({
    where: {
      mediaType: "VIDEO",
      updatedAt: { lt: before },
      OR: [{ playbackStatus: "PROCESSING" }, { thumbnailStatus: "PROCESSING" }],
    },
    select: { id: true, playbackStatus: true, thumbnailStatus: true },
  });
  for (const row of stale) {
    if (row.playbackStatus === "PROCESSING") {
      await prisma.media
        .updateMany({
          where: { id: row.id, playbackStatus: "PROCESSING" },
          data: { playbackStatus: "PENDING" },
        })
        .catch(() => undefined);
    }
    if (row.thumbnailStatus === "PROCESSING") {
      await prisma.media
        .updateMany({
          where: { id: row.id, thumbnailStatus: "PROCESSING" },
          data: { thumbnailStatus: "PENDING" },
        })
        .catch(() => undefined);
    }
  }
}

/**
 * 之前因为没有安装 ffmpeg 而跳过的视频，在 worker 重启并检测到 ffmpeg 后
 * 自动重新排队。因为原片已经足够小而跳过的视频不会被重复处理。
 */
export async function requeueVideosWithoutFfmpeg(): Promise<number> {
  if (!(await resolveFfmpeg())) return 0;
  const playback = await prisma.media.updateMany({
    where: {
      mediaType: "VIDEO",
      status: "ACTIVE",
      playbackStatus: "SKIPPED",
      playbackError: { contains: "ffmpeg" },
    },
    data: { playbackStatus: "PENDING", playbackError: null },
  });
  await prisma.media.updateMany({
    where: {
      mediaType: "VIDEO",
      status: "ACTIVE",
      thumbnailStatus: "FAILED",
      thumbnailError: { contains: "ffmpeg" },
    },
    data: { thumbnailStatus: "PENDING", thumbnailError: null },
  });
  return playback.count;
}
