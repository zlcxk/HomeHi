import sharp from "sharp";
import { prisma } from "@/lib/db";
import {
  getStorageDriver,
  makeDisplayKey,
  makeThumbKey,
  type StorageDriver,
} from "@/lib/storage";

const THUMB_MAX = 900;
const DISPLAY_MAX = 1920;
const THUMB_QUALITY = 76;
const DISPLAY_QUALITY = 82;

export type ImageVariant = {
  key: string;
  size: number;
};

/** 缩略图只用于网格和头像，尺寸小、质量适中。 */
export async function storeThumbnail(
  buffer: Buffer,
  driver: StorageDriver,
): Promise<ImageVariant | null> {
  try {
    const output = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY, effort: 4 })
      .toBuffer();
    const key = makeThumbKey();
    await driver.put(key, output, "image/webp");
    return { key, size: output.byteLength };
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
    const output = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: DISPLAY_MAX, height: DISPLAY_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: DISPLAY_QUALITY, effort: 4 })
      .toBuffer();
    const key = makeDisplayKey();
    await driver.put(key, output, "image/webp");
    return { key, size: output.byteLength };
  } catch {
    return null;
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string | Uint8Array));
  }
  return Buffer.concat(chunks);
}

const inflight = new Map<string, Promise<string | null>>();
const verified = new Set<string>();

type DisplaySource = {
  id: string;
  mediaType: string;
  mimeType: string;
  storageKey: string;
  storageDriver: string;
  displayKey: string | null;
};

/**
 * 详情页第一次读取旧照片时，按需生成中等尺寸版本。
 * 旧数据不需要一次性重跑脚本，也不会在列表页产生额外计算。
 */
export async function ensureDisplayImage(media: DisplaySource): Promise<string | null> {
  if (media.mediaType !== "IMAGE") return null;
  if (media.mimeType === "image/gif") return null;

  const driver = await getStorageDriver(media.storageDriver);

  if (media.displayKey) {
    if (verified.has(media.displayKey)) return media.displayKey;
    const stat = await driver.stat(media.displayKey);
    if (stat) {
      verified.add(media.displayKey);
      return media.displayKey;
    }
    // 数据库有记录但对象丢了：清掉，下面重新生成。
    await prisma.media.update({ where: { id: media.id }, data: { displayKey: null, displaySize: null } });
  }

  const existing = inflight.get(media.id);
  if (existing) return existing;

  const job = (async () => {
    const object = await driver.get(media.storageKey);
    if (!object) return null;
    const buffer = await streamToBuffer(object.stream);

    // 动图转成静态 WebP 会丢帧，保留原文件。
    const meta = await sharp(buffer, { failOn: "none" }).metadata().catch(() => null);
    if (meta?.pages && meta.pages > 1) return null;

    const variant = await storeDisplayImage(buffer, driver);
    if (!variant) return null;
    await prisma.media.update({
      where: { id: media.id },
      data: { displayKey: variant.key, displaySize: variant.size },
    });
    verified.add(variant.key);
    return variant.key;
  })().finally(() => {
    inflight.delete(media.id);
  });

  inflight.set(media.id, job);
  return job;
}
