import { prisma } from "@/lib/db";
import { generateMissingImageVariants, THUMB_VERSION } from "@/lib/media-variants";

const STALE_PROCESSING_MS = 15 * 60_000;

let draining = false;

/**
 * 取一条需要缩略图或预览图的照片。旧数据（有 key 但没有尺寸）和旧规格
 * 缩略图也会被重新生成，这样历史照片不用重新上传就能升级到当前规格。
 */
async function claimNextImage() {
  const candidate = await prisma.media.findFirst({
    where: {
      mediaType: "IMAGE",
      status: "ACTIVE",
      OR: [
        { thumbnailStatus: "PENDING" },
        { displayStatus: "PENDING" },
        { thumbnailStatus: "READY", thumbnailKey: { not: null }, thumbnailWidth: null },
        { displayStatus: "READY", displayKey: { not: null }, displayWidth: null },
        {
          thumbnailStatus: "READY",
          thumbnailKey: { not: null },
          thumbnailVersion: { lt: THUMB_VERSION },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  // 只把真正需要的变体置为 PROCESSING。SKIPPED（例如动图）和 FAILED
  // 不能在这里重新激活，否则 worker 会反复领到同一条任务。
  const needsThumb =
    candidate.thumbnailStatus === "PENDING" ||
    (candidate.thumbnailStatus === "READY" &&
      candidate.thumbnailKey !== null &&
      (candidate.thumbnailWidth === null || candidate.thumbnailVersion < THUMB_VERSION));
  const needsDisplay =
    candidate.displayStatus === "PENDING" ||
    (candidate.displayStatus === "READY" &&
      candidate.displayKey !== null &&
      candidate.displayWidth === null);

  const data: {
    thumbnailStatus?: string;
    displayStatus?: string;
    thumbnailError?: null;
    displayError?: null;
  } = {};
  if (needsThumb) {
    data.thumbnailStatus = "PROCESSING";
    data.thumbnailError = null;
  }
  if (needsDisplay) {
    data.displayStatus = "PROCESSING";
    data.displayError = null;
  }
  if (!needsThumb && !needsDisplay) return null;

  const claimed = await prisma.media.updateMany({
    where: { id: candidate.id, updatedAt: candidate.updatedAt },
    data,
  });
  return claimed.count === 1 ? { ...candidate, ...data } : null;
}

export async function processNextImageVariantJob(): Promise<boolean> {
  const media = await claimNextImage();
  if (!media) return false;

  try {
    await generateMissingImageVariants(media);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await prisma.media
      .updateMany({
        where: { id: media.id, thumbnailStatus: "PROCESSING" },
        data: { thumbnailStatus: "FAILED", thumbnailError: message },
      })
      .catch(() => undefined);
    await prisma.media
      .updateMany({
        where: { id: media.id, displayStatus: "PROCESSING" },
        data: { displayStatus: "FAILED", displayError: message },
      })
      .catch(() => undefined);
    console.error("[media] image variants failed", media.id, error);
  }
  return true;
}

/** 每次只处理一张，避免上传高峰时同时开太多 sharp 任务。 */
export async function drainImageQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (await processNextImageVariantJob()) {
      // 继续处理下一张
    }
  } catch (error) {
    console.error("[media] image queue failed", error);
  } finally {
    draining = false;
  }
}

/** worker 崩溃后，把长时间停在 PROCESSING 的图片任务放回队列。 */
export async function recoverStaleImageJobs(): Promise<void> {
  const before = new Date(Date.now() - STALE_PROCESSING_MS);
  const stale = await prisma.media.findMany({
    where: {
      mediaType: "IMAGE",
      updatedAt: { lt: before },
      OR: [{ thumbnailStatus: "PROCESSING" }, { displayStatus: "PROCESSING" }],
    },
    select: { id: true, thumbnailStatus: true, displayStatus: true },
  });

  for (const row of stale) {
    if (row.thumbnailStatus === "PROCESSING") {
      await prisma.media
        .updateMany({
          where: { id: row.id, thumbnailStatus: "PROCESSING" },
          data: { thumbnailStatus: "PENDING" },
        })
        .catch(() => undefined);
    }
    if (row.displayStatus === "PROCESSING") {
      await prisma.media
        .updateMany({
          where: { id: row.id, displayStatus: "PROCESSING" },
          data: { displayStatus: "PENDING" },
        })
        .catch(() => undefined);
    }
  }
}
