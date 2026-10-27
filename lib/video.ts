import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { prisma } from "@/lib/db";
import { getStorageDriver, makePlaybackKey } from "@/lib/storage";
import { storeThumbnail } from "@/lib/media-variants";

const MAX_EDGE = 1280;
const MAX_TRANSCODE_MS = 30 * 60_000;
const SKIP_IF_SMALLER_THAN = 10 * 1024 * 1024;
const SAME_QUALITY_RATIO = 0.98;

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
    where: { mediaType: "VIDEO", status: "ACTIVE", playbackStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const claimed = await prisma.media.updateMany({
    where: { id: candidate.id, playbackStatus: "PENDING" },
    data: { playbackStatus: "PROCESSING", playbackError: null },
  });
  return claimed.count === 1 ? candidate : null;
}

async function markSkipped(id: string, reason: string): Promise<void> {
  await prisma.media
    .update({ where: { id }, data: { playbackStatus: "SKIPPED", playbackError: reason } })
    .catch(() => undefined);
}

async function processVideo(media: NonNullable<Awaited<ReturnType<typeof claimNextVideo>>>): Promise<void> {
  const ffmpeg = await resolveFfmpeg();
  if (!ffmpeg) {
    await markSkipped(media.id, "服务器未安装 ffmpeg，视频保留原片。安装 ffmpeg 后重新压缩即可生成播放版。");
    return;
  }

  const maxEdge = Math.max(media.width || 0, media.height || 0);
  if (media.fileSize <= SKIP_IF_SMALLER_THAN && maxEdge > 0 && maxEdge <= MAX_EDGE) {
    await markSkipped(media.id, "原视频已经足够小，保留原片。");
    return;
  }

  const driver = await getStorageDriver(media.storageDriver);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "homehi-video-"));
  const inputPath = path.join(tempDir, `input.${outputExtension(media.mimeType)}`);
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    const object = await driver.get(media.storageKey);
    if (!object) {
      await markSkipped(media.id, "找不到原视频，保留原片。");
      return;
    }
    await streamToFile(object.stream, inputPath);

    // 浏览器没能生成封面时（部分 iOS 版本会失败），由服务器补一张。
    if (!media.thumbnailKey) {
      const posterPath = path.join(tempDir, "poster.jpg");
      // 和前端截帧一致：跳过开头和结尾，在中间 15%–85% 随机取一帧作为封面。
      const at = media.durationSeconds
        ? Math.max(
            0.5,
            Math.min(
              media.durationSeconds * (0.15 + Math.random() * 0.7),
              media.durationSeconds - 0.1,
            ),
          )
        : 1;
      try {
        await runFfmpeg(
          ffmpeg,
          [
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            String(at),
            "-i",
            inputPath,
            "-frames:v",
            "1",
            "-vf",
            `scale='min(${MAX_EDGE},iw)':-2`,
            "-q:v",
            "3",
            posterPath,
          ],
          60_000,
        );
        const thumb = await storeThumbnail(await readFile(posterPath), driver);
        if (thumb) {
          await prisma.media.update({
            where: { id: media.id },
            data: { thumbnailKey: thumb.key },
          });
        }
      } catch {
        // 封面是增强项，失败不影响视频播放。
      }
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
    const message = error instanceof Error ? error.message : String(error);
    await prisma.media
      .update({
        where: { id: media.id },
        data: {
          playbackStatus: "FAILED",
          playbackError: message.slice(0, 500),
        },
      })
      .catch(() => undefined);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * 后台处理一个视频。返回是否尝试过任务，worker 可以循环调用直到队列为空。
 * 视频压缩不阻塞提醒发送：worker 把它作为独立 Promise 启动。
 */
export async function processNextVideoJob(): Promise<boolean> {
  const media = await claimNextVideo();
  if (!media) return false;
  try {
    await processVideo(media);
  } catch (error) {
    // 兜底：不能让一个视频把整个队列留在 PROCESSING。
    const message = error instanceof Error ? error.message : String(error);
    await prisma.media
      .update({
        where: { id: media.id },
        data: { playbackStatus: "FAILED", playbackError: message.slice(0, 500) },
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
  await prisma.media.updateMany({
    where: {
      mediaType: "VIDEO",
      playbackStatus: "PROCESSING",
      updatedAt: { lt: new Date(Date.now() - MAX_TRANSCODE_MS) },
    },
    data: { playbackStatus: "PENDING" },
  });
}

/**
 * 之前因为没有安装 ffmpeg 而跳过的视频，在 worker 重启并检测到 ffmpeg 后
 * 自动重新排队。因为原片已经足够小而跳过的视频不会被重复处理。
 */
export async function requeueVideosWithoutFfmpeg(): Promise<number> {
  if (!(await resolveFfmpeg())) return 0;
  const result = await prisma.media.updateMany({
    where: {
      mediaType: "VIDEO",
      status: "ACTIVE",
      playbackStatus: "SKIPPED",
      playbackError: { contains: "ffmpeg" },
    },
    data: { playbackStatus: "PENDING", playbackError: null },
  });
  return result.count;
}
