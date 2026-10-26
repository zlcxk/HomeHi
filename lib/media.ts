import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import exifr from "exifr";
import { prisma } from "@/lib/db";
import {
  MEDIA_IMAGE_TYPES,
  MEDIA_VIDEO_TYPES,
  MIME_EXTENSION,
} from "@/lib/constants";
import { getStorageDriver, makeStorageKey, makeThumbKey, type StorageDriver } from "@/lib/storage";
import type { AppContext } from "@/lib/auth";

const IMAGE_TYPES = new Set<string>(MEDIA_IMAGE_TYPES);
const VIDEO_TYPES = new Set<string>(MEDIA_VIDEO_TYPES);

export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB || 100);
  return Math.max(1, Number.isFinite(mb) ? mb : 100) * 1024 * 1024;
}

export function isAllowedMime(mime: string): boolean {
  return IMAGE_TYPES.has(mime) || VIDEO_TYPES.has(mime);
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || "file";
  return base.replace(/[\u0000-\u001f<>:"|?*]/g, "_").slice(0, 180) || "file";
}

async function makeThumbnail(
  buffer: Buffer,
  key: string,
  driver: StorageDriver,
): Promise<string | null> {
  try {
    const thumb = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    await driver.put(key, thumb, "image/webp");
    return key;
  } catch {
    return null;
  }
}

async function imageMetadata(buffer: Buffer): Promise<{
  width: number | null;
  height: number | null;
  takenAt: Date | null;
}> {
  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
    if (meta.orientation && meta.orientation >= 5) {
      [width, height] = [height, width];
    }
  } catch {
    // dimensions are optional
  }
  let takenAt: Date | null = null;
  try {
    const exif = (await exifr.parse(buffer, ["DateTimeOriginal", "CreateDate"])) as
      | { DateTimeOriginal?: Date; CreateDate?: Date }
      | undefined;
    const date = exif?.DateTimeOriginal || exif?.CreateDate;
    if (date instanceof Date && !Number.isNaN(date.getTime())) takenAt = date;
  } catch {
    // unreadable exif is not fatal
  }
  return { width, height, takenAt };
}

export type UploadFields = {
  visibility?: string;
  clientWidth?: string | null;
  clientHeight?: string | null;
  durationSeconds?: string | null;
  clientTakenAt?: string | null;
};

export type UploadedMedia = {
  id: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  thumbnailKey: string | null;
  mimeType: string;
  originalFilename: string;
};

export async function processMediaUpload(
  file: File,
  poster: File | null,
  fields: UploadFields,
  context: AppContext,
): Promise<UploadedMedia> {
  if (file.size <= 0) throw new Error("文件为空");
  if (file.size > maxUploadBytes()) {
    throw new Error(`文件超过 ${Math.round(maxUploadBytes() / 1024 / 1024)} MB 上限`);
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime)) {
    throw new Error("暂不支持这种文件类型，请上传 JPG / PNG / WebP / GIF / MP4 / MOV / WebM");
  }
  if (poster && !IMAGE_TYPES.has(poster.type)) {
    throw new Error("视频封面格式不正确");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extension = MIME_EXTENSION[mime] || "bin";
  const storageKey = makeStorageKey(extension);
  // 新文件写入当前配置的活动存储后端；历史文件仍按各自记录的后端读取。
  const driver = await getStorageDriver();
  await driver.put(storageKey, buffer, mime);

  const isImage = IMAGE_TYPES.has(mime);
  let thumbnailKey: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let takenAt: Date | null = null;
  let mediaType: string = isImage ? "IMAGE" : "VIDEO";

  if (isImage) {
    const meta = await imageMetadata(buffer);
    width = meta.width;
    height = meta.height;
    takenAt = meta.takenAt;
    thumbnailKey = await makeThumbnail(buffer, makeThumbKey(), driver);
  } else {
    const clientWidth = Number(fields.clientWidth);
    const clientHeight = Number(fields.clientHeight);
    width = Number.isFinite(clientWidth) && clientWidth > 0 ? Math.round(clientWidth) : null;
    height = Number.isFinite(clientHeight) && clientHeight > 0 ? Math.round(clientHeight) : null;
    const duration = Number(fields.durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) {
      // duration stays null; UI falls back to an unknown label
    }
    if (poster) {
      const posterBuffer = Buffer.from(await poster.arrayBuffer());
      if (posterBuffer.length <= 8 * 1024 * 1024) {
        thumbnailKey = await makeThumbnail(posterBuffer, makeThumbKey(), driver);
        if (!width || !height) {
          try {
            const meta = await sharp(posterBuffer, { failOn: "none" }).metadata();
            width = width ?? meta.width ?? null;
            height = height ?? meta.height ?? null;
          } catch {
            // ignore
          }
        }
      }
    }
    const clientTaken = fields.clientTakenAt ? new Date(fields.clientTakenAt) : null;
    if (clientTaken && !Number.isNaN(clientTaken.getTime())) takenAt = clientTaken;
  }

  if (!takenAt) takenAt = new Date();

  const media = await prisma.media.create({
    data: {
      householdId: context.household.id,
      uploadedBy: context.user.id,
      mediaType,
      originalFilename: sanitizeFilename(file.name),
      mimeType: mime,
      fileSize: file.size,
      storageKey,
      storageDriver: driver.kind,
      thumbnailKey,
      width,
      height,
      durationSeconds: fields.durationSeconds ? Number(fields.durationSeconds) || null : null,
      takenAt,
      visibility: fields.visibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD",
      checksum,
    },
  });

  return {
    id: media.id,
    mediaType,
    width: media.width,
    height: media.height,
    durationSeconds: media.durationSeconds,
    thumbnailKey: media.thumbnailKey,
    mimeType: media.mimeType,
    originalFilename: media.originalFilename,
  };
}

export function mediaTypeLabel(mediaType: string): string {
  if (mediaType === "IMAGE") return "照片";
  if (mediaType === "VIDEO") return "视频";
  return "文件";
}
