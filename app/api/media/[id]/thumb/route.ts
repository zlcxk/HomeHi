import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { canViewMedia } from "@/lib/access";
import { prisma } from "@/lib/db";
import { ensureThumbnail } from "@/lib/media-variants";
import { storedFileResponse } from "@/lib/media-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 列表缩略图，长边约 240px。旧照片第一次被访问时按需升级；
 * 生成失败也有兜底：照片回退到 960px 展示图，视频只返回占位。
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
    !canViewMedia(media, { userId: context.user.id, householdId: context.household.id })
  ) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  const key = (await ensureThumbnail(media).catch(() => null)) ?? media.thumbnailKey;
  if (key) {
    const response = await storedFileResponse(request, {
      key,
      kind: media.storageDriver,
      contentType: "image/webp",
      cacheControl: "private, max-age=86400, stale-while-revalidate=604800",
    });
    if (response) return response;
  }

  if (media.mediaType === "IMAGE") {
    // 缩略图失败时不让列表变成空白；展示图仍然经过鉴权。
    return NextResponse.redirect(new URL(`/api/media/${media.id}/display`, request.url), 307);
  }

  return NextResponse.json({ error: "没有封面" }, { status: 404 });
}
