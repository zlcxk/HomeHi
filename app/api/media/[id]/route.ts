import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorageDriver, removeStoredFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Removes an uploaded media. Orphans are purged; referenced media is soft-deleted. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getApiContext();
  if (!context) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await params;

  const media = await prisma.media.findUnique({
    where: { id },
    include: { entryLinks: true, albumLinks: true },
  });
  if (!media || media.householdId !== context.household.id) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }
  if (media.uploadedBy !== context.user.id && context.role !== "OWNER") {
    return NextResponse.json({ error: "没有权限删除这个文件" }, { status: 403 });
  }

  const referenced = media.entryLinks.length > 0 || media.albumLinks.length > 0;
  if (!referenced) {
    await prisma.media.delete({ where: { id } });
    const driver = await getStorageDriver(media.storageDriver);
    await removeStoredFile(media.storageKey, driver.kind);
    await removeStoredFile(media.thumbnailKey, driver.kind);
    return NextResponse.json({ ok: true, purged: true });
  }

  await prisma.$transaction([
    prisma.media.update({
      where: { id },
      data: { status: "DELETED", deletedAt: new Date() },
    }),
    prisma.albumMedia.deleteMany({ where: { mediaId: id } }),
  ]);
  return NextResponse.json({ ok: true, purged: false });
}
