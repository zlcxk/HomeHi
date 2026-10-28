import sharp from "sharp";
import { prisma } from "@/lib/db";
import {
  getStorageDriver,
  makeDisplayKey,
  makeThumbKey,
  type StorageDriver,
} from "@/lib/storage";

/** 列表缩略图长边；已有 900px 旧图会在首次读取时自动降级重做。 */
export const THUMB_MAX = 240;
/** 详情页预览图长边；原图仍保留在 storageKey。 */
export const DISPLAY_MAX = 960;
/** 视频封面比列表缩略图稍大，详情页海报不会太糊。 */
export const VIDEO_COVER_MAX = 480;

const THUMB_QUALITY = 72;
const DISPLAY_QUALITY = 80;
const RETRY_AFTER_MS = 10 * 60_000;
const MAX_VARIANT_SOURCE_BYTES = 200 * 1024 * 1024;

export type ImageVariant = {
  key: string;
  size: number;
  width: number;
  height: number;
};

export type VariantMedia = {
  id: string;
  mediaType: string;
  mimeType: string;
  storageKey: string;
  storageDriver: string;
  thumbnailKey: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
  thumbnailStatus: string;
  displayKey: string | null;
  displayWidth: number | null;
  displayHeight: number | null;
  displayStatus: string;
  updatedAt: Date;
};

/** 生成一个 WebP 缩略图；调用方负责写入数据库。 */
export async function storeThumbnail(
  buffer: Buffer,
  driver: StorageDriver,
  maxEdge = THUMB_MAX,
): Promise<ImageVariant | null> {
  try {
    const { data, info } = await sharp(buffer, { failOn: "none", limitInputPixels: 100_000_000 })
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    const key = makeThumbKey();
    await driver.put(key, data, "image/webp");
    return { key, size: data.byteLength, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

/** 详情页使用的中等尺寸 WebP；原图继续保留，供「查看原图」和下载。 */
export async function storeDisplayImage(
  buffer: Buffer,
  driver: StorageDriver,
): Promise<ImageVariant | null> {
  try {
    const { data, info } = await sharp(buffer, { failOn: "none", limitInputPixels: 100_000_000 })
      .rotate()
      .resize({ width: DISPLAY_MAX, height: DISPLAY_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: DISPLAY_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    const key = makeDisplayKey();
    await driver.put(key, data, "image/webp");
    return { key, size: data.byteLength, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string | Uint8Array);
    total += buffer.byteLength;
    if (total > MAX_VARIANT_SOURCE_BYTES) throw new Error("原文件过大，无法生成预览");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function maxEdgeOf(width: number | null, height: number | null): number | null {
  if (!width && !height) return null;
  return Math.max(width || 0, height || 0);
}

/** 旧尺寸或缺失维度都返回 true，让第一次读取顺手升级到当前规格。 */
function needsThumbnail(media: VariantMedia): boolean {
  if (media.mediaType !== "IMAGE") return false;
  if (!media.thumbnailKey) return media.thumbnailStatus !== "SKIPPED";
  const edge = maxEdgeOf(media.thumbnailWidth, media.thumbnailHeight);
  if (edge === null) return true;
  return edge > Math.round(THUMB_MAX * 1.2);
}

function needsDisplay(media: VariantMedia): boolean {
  if (media.mediaType !== "IMAGE") return false;
  if (media.displayStatus === "SKIPPED" || media.mimeType === "image/gif") return false;
  if (!media.displayKey) return true;
  const edge = maxEdgeOf(media.displayWidth, media.displayHeight);
  if (edge === null) return true;
  return edge > Math.round(DISPLAY_MAX * 1.2);
}

function shouldWait(status: string, updatedAt: Date): boolean {
  if (status !== "FAILED" && status !== "PROCESSING") return false;
  return Date.now() - updatedAt.getTime() < RETRY_AFTER_MS;
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

async function markFailed(media: VariantMedia, kind: "thumbnail" | "display", message: string) {
  await prisma.media
    .update({
      where: { id: media.id },
      data:
        kind === "thumbnail"
          ? { thumbnailStatus: "FAILED", thumbnailError: message }
          : { displayStatus: "FAILED", displayError: message },
    })
    .catch(() => undefined);
}

async function writeThumbnail(
  media: VariantMedia,
  buffer: Buffer,
  driver: StorageDriver,
): Promise<string | null> {
  const variant = await storeThumbnail(buffer, driver);
  if (!variant) {
    await markFailed(media, "thumbnail", "无法生成缩略图，已保留原文件");
    return null;
  }
  await prisma.media.update({
    where: { id: media.id },
    data: {
      thumbnailKey: variant.key,
      thumbnailWidth: variant.width,
      thumbnailHeight: variant.height,
      thumbnailStatus: "READY",
      thumbnailError: null,
    },
  });
  if (media.thumbnailKey && media.thumbnailKey !== variant.key) {
    await driver.remove(media.thumbnailKey).catch(() => undefined);
  }
  return variant.key;
}

async function writeDisplay(
  media: VariantMedia,
  buffer: Buffer,
  driver: StorageDriver,
): Promise<string | null> {
  const meta = await sharp(buffer, { failOn: "none", limitInputPixels: 100_000_000 })
    .metadata()
    .catch(() => null);
  if ((meta?.pages && meta.pages > 1) || media.mimeType === "image/gif") {
    await prisma.media
      .update({
        where: { id: media.id },
        data: { displayStatus: "SKIPPED", displayError: "动图保留原文件" },
      })
      .catch(() => undefined);
    return null;
  }

  const variant = await storeDisplayImage(buffer, driver);
  if (!variant) {
    await markFailed(media, "display", "无法生成预览图，已保留原文件");
    return null;
  }
  await prisma.media.update({
    where: { id: media.id },
    data: {
      displayKey: variant.key,
      displaySize: variant.size,
      displayWidth: variant.width,
      displayHeight: variant.height,
      displayStatus: "READY",
      displayError: null,
    },
  });
  if (media.displayKey && media.displayKey !== variant.key) {
    await driver.remove(media.displayKey).catch(() => undefined);
  }
  return variant.key;
}

const inflight = new Map<string, Promise<string | null>>();
const verified = new Set<string>();

async function loadSource(media: VariantMedia): Promise<{ driver: StorageDriver; buffer: Buffer } | null> {
  const driver = await getStorageDriver(media.storageDriver);
  const object = await driver.get(media.storageKey);
  if (!object) return null;
  const buffer = await streamToBuffer(object.stream);
  return { driver, buffer };
}

async function ensureVariant(
  media: VariantMedia,
  kind: "thumbnail" | "display",
): Promise<string | null> {
  if (media.mediaType !== "IMAGE") return null;

  const already = kind === "thumbnail" ? media.thumbnailKey : media.displayKey;
  const needed = kind === "thumbnail" ? needsThumbnail(media) : needsDisplay(media);
  if (!needed) {
    if (already && kind === "thumbnail" && !verified.has(already)) {
      const driver = await getStorageDriver(media.storageDriver);
      if (!(await driver.stat(already))) {
        await prisma.media
          .update({
            where: { id: media.id },
            data: { thumbnailKey: null, thumbnailWidth: null, thumbnailHeight: null },
          })
          .catch(() => undefined);
        return ensureVariant({ ...media, thumbnailKey: null }, kind);
      }
      verified.add(already);
    }
    return already;
  }

  const status = kind === "thumbnail" ? media.thumbnailStatus : media.displayStatus;
  if (shouldWait(status, media.updatedAt) && !inflight.has(`${kind}:${media.id}`)) {
    return already;
  }

  const key = `${kind}:${media.id}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const job = (async () => {
    await prisma.media
      .update({
        where: { id: media.id },
        data:
          kind === "thumbnail"
            ? { thumbnailStatus: "PROCESSING", thumbnailError: null }
            : { displayStatus: "PROCESSING", displayError: null },
      })
      .catch(() => undefined);

    try {
      const source = await loadSource(media);
      if (!source) {
        await markFailed(media, kind, "找不到原文件");
        return null;
      }
      const result =
        kind === "thumbnail"
          ? await writeThumbnail(media, source.buffer, source.driver)
          : await writeDisplay(media, source.buffer, source.driver);
      if (result) verified.add(result);
      return result;
    } catch (error) {
      await markFailed(media, kind, errorText(error));
      return null;
    }
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, job);
  return job;
}

/** 列表缩略图：缺失、旧尺寸或首次访问时按需生成。 */
export async function ensureThumbnail(media: VariantMedia): Promise<string | null> {
  return ensureVariant(media, "thumbnail");
}

/** 详情页预览图：同上，按需生成 960px WebP。 */
export async function ensureDisplayImage(media: VariantMedia): Promise<string | null> {
  return ensureVariant(media, "display");
}

/**
 * worker / 补处理命令使用：只读一次原文件，把缺的两个变体都补齐。
 * 返回 false 表示没有需要处理的变体。
 */
export async function generateMissingImageVariants(media: VariantMedia): Promise<boolean> {
  if (media.mediaType !== "IMAGE") return false;
  const needThumb = needsThumbnail(media);
  const needDisplay = needsDisplay(media);
  if (!needThumb && !needDisplay) return false;

  const key = `both:${media.id}`;
  const existing = inflight.get(key);
  if (existing) {
    await existing.catch(() => undefined);
    return true;
  }

  const job = (async (): Promise<string | null> => {
    try {
      const source = await loadSource(media);
      if (!source) {
        if (needThumb) await markFailed(media, "thumbnail", "找不到原文件");
        if (needDisplay) await markFailed(media, "display", "找不到原文件");
        return null;
      }
      if (needThumb) {
        const result = await writeThumbnail(media, source.buffer, source.driver);
        if (result) verified.add(result);
      }
      if (needDisplay) {
        const result = await writeDisplay(media, source.buffer, source.driver);
        if (result) verified.add(result);
      }
    } catch (error) {
      if (needThumb) await markFailed(media, "thumbnail", errorText(error));
      if (needDisplay) await markFailed(media, "display", errorText(error));
    }
    return null;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, job);
  await job;
  return true;
}
