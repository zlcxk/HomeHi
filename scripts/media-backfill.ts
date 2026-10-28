import "dotenv/config";

import { prisma } from "../lib/db";
import {
  DISPLAY_MAX,
  THUMB_MAX,
  generateMissingImageVariants,
} from "../lib/media-variants";

/**
 * 可重复执行的历史媒体补处理：
 *   npm run media:backfill
 *   npm run media:backfill -- --type=image --retry-failed
 *   npm run media:backfill -- --type=video
 *
 * 图片会直接补 240px 缩略图和 960px 预览图；视频只重新排队，
 * 由常驻 worker 生成封面和播放版，避免命令行长时间占用 CPU。
 */

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const rawType = argument("type") || "all";
if (rawType !== "all" && rawType !== "image" && rawType !== "video") {
  throw new Error("--type 只能是 image、video 或 all");
}
const type: "all" | "image" | "video" = rawType;
const limit = Math.max(0, Number(argument("limit") || 0));
const retryFailed = process.argv.includes("--retry-failed");
const BATCH = 20;

function log(...values: unknown[]) {
  console.log(`[media:backfill ${new Date().toISOString()}]`, ...values);
}

async function backfillImages() {
  if (retryFailed) {
    const reset = await prisma.media.updateMany({
      where: {
        mediaType: "IMAGE",
        status: "ACTIVE",
        OR: [{ thumbnailStatus: "FAILED" }, { displayStatus: "FAILED" }],
      },
      data: { thumbnailStatus: "PENDING", displayStatus: "PENDING" },
    });
    if (reset.count > 0) log(`reset ${reset.count} failed image(s)`);
  }

  let processed = 0;
  for (;;) {
    const take = limit > 0 ? Math.min(BATCH, limit - processed) : BATCH;
    if (take <= 0) break;

    const rows = await prisma.media.findMany({
      where: {
        mediaType: "IMAGE",
        status: "ACTIVE",
        OR: [
          { thumbnailStatus: "PENDING" },
          { displayStatus: "PENDING" },
          { thumbnailStatus: "READY", thumbnailKey: { not: null }, thumbnailWidth: null },
          { displayStatus: "READY", displayKey: { not: null }, displayWidth: null },
        ],
      },
      orderBy: { createdAt: "asc" },
      take,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      await generateMissingImageVariants(row);
      processed += 1;
      if (processed % 10 === 0) log(`images ${processed}`);
    }
  }
  log(`images done: ${processed} (${THUMB_MAX}px / ${DISPLAY_MAX}px)`);
}

async function requeueVideos() {
  const covers = await prisma.media.updateMany({
    where: {
      mediaType: "VIDEO",
      status: "ACTIVE",
      thumbnailKey: null,
      thumbnailStatus: { in: ["FAILED", "SKIPPED"] },
    },
    data: { thumbnailStatus: "PENDING", thumbnailError: null },
  });
  const playback = await prisma.media.updateMany({
    where: {
      mediaType: "VIDEO",
      status: "ACTIVE",
      playbackStatus: "FAILED",
    },
    data: { playbackStatus: "PENDING", playbackError: null },
  });
  log(`videos requeued: ${covers.count} cover(s), ${playback.count} playback(s)`);
}

async function main() {
  await prisma.$connect();
  if (type === "all" || type === "image") await backfillImages();
  if (type === "all" || type === "video") await requeueVideos();
  log("done");
}

void main()
  .catch((error) => {
    console.error("[media:backfill] failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
