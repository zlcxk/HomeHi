import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { canViewMedia } from "@/lib/access";
import { prisma } from "@/lib/db";
import { ensureDisplayImage } from "@/lib/media-variants";
import { storedFileResponse } from "@/lib/media-response";
import { getStorageDriver } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 详情页默认加载的中等尺寸 WebP。GIF、动图或生成失败时退回原始文件，
 * 但只要是静态照片，都会先压缩到最长边 1920，原图仍可通过 /file 查看。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getApiContext();
  if (!context) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await params;

  const media = await prisma.media.findUnique({ where: { id } });
  if (
    !media ||
    media.mediaType !== "IMAGE" ||
    !canViewMedia(media, { userId: context.user.id, householdId: context.household.id })
  ) {
    return NextResponse.json({ error: "照片不存在" }, { status: 404 });
  }

  const displayKey = await ensureDisplayImage(media).catch(() => null);
  if (displayKey) {
    const driver = await getStorageDriver(media.storageDriver);
    const stat = await driver.stat(displayKey);
    if (stat) {
      const response = await storedFileResponse(request, {
        key: displayKey,
        kind: media.storageDriver,
        contentType: "image/webp",
        cacheControl: "private, max-age=31536000, immutable",
        size: stat.size,
      });
      if (response) return response;
    }
  }

  const response = await storedFileResponse(request, {
    key: media.storageKey,
    kind: media.storageDriver,
    contentType: media.mimeType,
    cacheControl: "private, max-age=3600",
    filename: media.originalFilename,
  });
  return response ?? NextResponse.json({ error: "照片不存在" }, { status: 404 });
}
