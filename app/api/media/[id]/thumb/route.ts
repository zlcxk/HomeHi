import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { canViewMedia } from "@/lib/access";
import { prisma } from "@/lib/db";
import { getStorageDriver } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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
  if (!media.thumbnailKey) {
    return NextResponse.json({ error: "没有缩略图" }, { status: 404 });
  }
  const driver = await getStorageDriver(media.storageDriver);
  const stat = await driver.stat(media.thumbnailKey);
  if (!stat) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  const object = await driver.get(media.thumbnailKey);
  if (!object) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  return new Response(Readable.toWeb(object.stream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
