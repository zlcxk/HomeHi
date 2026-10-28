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
import { getStorageDriver, makeStorageKey } from "@/lib/storage";
import {
  THUMB_VERSION,
  VIDEO_COVER_MAX,
  ensureThumbnail,
  storeThumbnail,
} from "@/lib/media-variants";
import type { AppContext } from "@/lib/auth";

const IMAGE_TYPES = new Set<string>(MEDIA_IMAGE_TYPES);
const VIDEO_TYPES = new Set<string>(MEDIA_VIDEO_TYPES);
const HEIC_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
};

/**
 * 手机浏览器有时拿不到 file.type，或者给出 image/jpg 这类别名。
 * 这里统一成服务端认识的标准 MIME，避免“明明选了照片却提示不支持”。
 */
export function resolveUploadMime(type: string | null | undefined, filename: string): string {
  const raw = (type || "").toLowerCase();
  if (raw === "image/jpg") return "image/jpeg";
  if (raw && raw !== "application/octet-stream") return raw;
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXT_MIME[ext] || raw || "application/octet-stream";
}

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

async function imageMetadata(buffer: Buffer): Promise<{
  width: number | null;
  height: number | null;
  takenAt: Date | null;
  animated: boolean;
}> {
  let width: number | null = null;
  let height: number | null = null;
  let animated = false;
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
    animated = Boolean(meta.pages && meta.pages > 1);
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
  return { width, height, takenAt, animated };
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
  displayKey: string | null;
  displaySize: number | null;
  fileSize: number;
  playbackStatus: string;
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
  const mime = resolveUploadMime(file.type, file.name);
  if (HEIC_TYPES.has(mime) && !sharp.format.heif?.input?.buffer) {
    throw new Error("当前安装的图片引擎不能读取 HEIC。请在相册导出为 JPG，或改用「拍照」按钮");
  }
  if (!isAllowedMime(mime)) {
    throw new Error("暂不支持这种文件类型，请上传 JPG / PNG / WebP / HEIC / GIF / MP4 / MOV / M4V / WebM");
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
  let thumbnailWidth: number | null = null;
  let thumbnailHeight: number | null = null;
  let thumbnailStatus = "PENDING";
  let displayStatus = isImage ? "PENDING" : "SKIPPED";
  let displayError: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let durationSeconds: number | null = null;
  let takenAt: Date | null = null;
  const mediaType: string = isImage ? "IMAGE" : "VIDEO";
  let playbackStatus = "PENDING";

  if (isImage) {
    const meta = await imageMetadata(buffer);
    width = meta.width;
    height = meta.height;
    takenAt = meta.takenAt;
    playbackStatus = "READY";
    // 动图转静态 WebP 会丢帧，详情页保留原文件；列表仍用第一帧缩略图。
    if (meta.animated || mime === "image/gif") {
      displayStatus = "SKIPPED";
      displayError = "动图保留原文件";
    }
  } else {
    const clientWidth = Number(fields.clientWidth);
    const clientHeight = Number(fields.clientHeight);
    width = Number.isFinite(clientWidth) && clientWidth > 0 ? Math.round(clientWidth) : null;
    height = Number.isFinite(clientHeight) && clientHeight > 0 ? Math.round(clientHeight) : null;
    const duration = Number(fields.durationSeconds);
    if (Number.isFinite(duration) && duration > 0) durationSeconds = duration;

    if (poster) {
      const posterBuffer = Buffer.from(await poster.arrayBuffer());
      if (posterBuffer.length <= 8 * 1024 * 1024) {
        const thumb = await storeThumbnail(posterBuffer, driver, VIDEO_COVER_MAX);
        thumbnailKey = thumb?.key ?? null;
        thumbnailWidth = thumb?.width ?? null;
        thumbnailHeight = thumb?.height ?? null;
        thumbnailStatus = thumb ? "READY" : "FAILED";
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
      thumbnailWidth,
      thumbnailHeight,
      thumbnailStatus,
      thumbnailVersion: thumbnailKey ? THUMB_VERSION : 0,
      displayStatus,
      displayError,
      playbackStatus,
      width,
      height,
      durationSeconds,
      takenAt,
      visibility: fields.visibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD",
      checksum,
    },
  });

  // 上传响应先返回；缩略图在后台补。没有 worker 时，列表第一次请求也会兜底生成。
  if (isImage) {
    void ensureThumbnail(media).catch(() => undefined);
  }

  return {
    id: media.id,
    mediaType,
    width: media.width,
    height: media.height,
    durationSeconds: media.durationSeconds,
    thumbnailKey: media.thumbnailKey,
    displayKey: media.displayKey,
    displaySize: media.displaySize,
    fileSize: media.fileSize,
    playbackStatus: media.playbackStatus,
    mimeType: media.mimeType,
    originalFilename: media.originalFilename,
  };
}

export function mediaTypeLabel(mediaType: string): string {
  if (mediaType === "IMAGE") return "照片";
  if (mediaType === "VIDEO") return "视频";
  return "文件";
}
