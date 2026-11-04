import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  blockingReferenceCount,
  getMediaReferenceCount,
  purgeMedia,
  softDeleteMedia,
} from "@/lib/media-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 删除上传的媒体。从未被任何业务引用的孤儿直接清理；其余只做软删除，
 * 保留原图和变体，等用户在回收站彻底删除。
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

  // 软删除会解除相册关联和封面/头像等字段；先记录删除前是否存在引用，
  // 避免把“相册里唯一一张图”误判成可立即物理清理的孤儿。
  const before = await getMediaReferenceCount(id);
  if (media.status === "ACTIVE") await softDeleteMedia(id);

  if (blockingReferenceCount(before) > 0) {
    return NextResponse.json({ ok: true, purged: false });
  }

  const purged = await purgeMedia(id);
  if (!purged.ok) {
    return NextResponse.json({ ok: true, purged: false, error: purged.error });
  }
  return NextResponse.json({ ok: true, purged: true });
}
