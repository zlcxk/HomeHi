import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { canViewMedia } from "@/lib/access";
import { prisma } from "@/lib/db";
import { storedFileResponse } from "@/lib/media-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const url = new URL(request.url);
  const response = await storedFileResponse(request, {
    key: media.storageKey,
    kind: media.storageDriver,
    contentType: media.mimeType,
    cacheControl: "private, max-age=3600",
    filename: media.originalFilename,
    download: url.searchParams.get("download") === "1",
  });
  return response ?? NextResponse.json({ error: "文件不存在" }, { status: 404 });
}
