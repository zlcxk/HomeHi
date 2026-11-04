import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getMediaReferenceCounts,
  hasAnyMediaReference,
  purgeMedia,
  softDeleteMedia,
} from "@/lib/media-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 取消一张尚未保存到记录/相册的上传。
 *
 * 和界面上的「删除照片」一样先走软删除，再尝试彻底删除：如果这张图已经
 * 被记录、旅行、头像等业务引用，彻底删除会被拒绝，记录留在回收站，
 * 由用户确认后处理。这样不会出现绕过引用检查的直接清理。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getApiContext();
  if (!context) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await params;

  const media = await prisma.media.findUnique({ where: { id } });
  if (!media || media.householdId !== context.household.id) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }
  if (media.uploadedBy !== context.user.id && context.role !== "OWNER") {
    return NextResponse.json({ error: "没有权限删除这个文件" }, { status: 403 });
  }

  if (media.status !== "ACTIVE") {
    return NextResponse.json({ ok: true, purged: false });
  }

  // 同一账号重复上传会复用已有记录，列表里这一项可能正是记录/相册里
  // 已经使用的照片。用户只是把它从当前表单移除，不能因此软删除。
  const counts = (await getMediaReferenceCounts([id])).get(id);
  if (counts && hasAnyMediaReference(counts)) {
    return NextResponse.json({ ok: true, purged: false });
  }

  await softDeleteMedia(id);
  const purged = await purgeMedia(id);
  if (!purged.ok) {
    return NextResponse.json({ ok: true, purged: false, error: purged.error });
  }
  return NextResponse.json({ ok: true, purged: true });
}
