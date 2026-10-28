import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { canViewMedia } from "@/lib/access";
import { prisma } from "@/lib/db";
import { storedFileResponse } from "@/lib/media-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 后台压缩后的 H.264 播放版；原视频仍在 /file。 */
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
    media.mediaType !== "VIDEO" ||
    media.playbackStatus !== "READY" ||
    !media.playbackKey ||
    !canViewMedia(media, { userId: context.user.id, householdId: context.household.id })
  ) {
    return NextResponse.json({ error: "还没有可播放的压缩版本" }, { status: 404 });
  }

  const filename = media.originalFilename.replace(/\.[^.]+$/, "") + ".mp4";
  const response = await storedFileResponse(request, {
    key: media.playbackKey,
    kind: media.storageDriver,
    contentType: "video/mp4",
    // 播放版可能重新生成；ETag 负责失效，组件仍会带 ?v= 帮助浏览器更新。
    cacheControl: "private, max-age=604800",
    filename,
  });
  return response ?? NextResponse.json({ error: "视频不存在" }, { status: 404 });
}
