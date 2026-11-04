// 记录的软删除、恢复与彻底删除。
// 这里只做数据状态转换，权限和目标是否存在由调用方先校验。
import { prisma } from "@/lib/db";
import { restoredEntryStatus } from "@/lib/entry-status";
import { isTrashExpired, TRASH_RETENTION_MS } from "@/lib/trash";

export { restoredEntryStatus };

/**
 * 软删除：纪录删除前状态，保留 EntryMedia / EntryProfile / EntryTag。
 * 照片和附件不会被删除；恢复后记录正文、附件关系和发布时间都还在。
 */
export async function softDeleteEntry(entryId: string, now = new Date()): Promise<boolean> {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: { status: true },
  });
  if (!entry || entry.status === "DELETED") return false;

  const claimed = await prisma.entry.updateMany({
    where: { id: entryId, status: entry.status },
    data: {
      deletedFromStatus: entry.status,
      status: "DELETED",
      deletedAt: now,
    },
  });
  return claimed.count === 1;
}

export type RestoreEntryResult = { ok: true; status: string } | { ok: false; error: string };

/**
 * 恢复记录：仍在 30 天保留期内，且必须还是 DELETED 状态。
 * 目标状态取删除前的业务状态，草稿不会因为恢复而被发布。
 */
export async function restoreEntry(
  entryId: string,
  now = new Date(),
): Promise<RestoreEntryResult> {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: { status: true, deletedAt: true, deletedFromStatus: true },
  });
  if (!entry) return { ok: false, error: "这条记录不存在" };
  if (entry.status !== "DELETED") return { ok: false, error: "这条记录不在回收站" };
  if (isTrashExpired(entry.deletedAt, now)) {
    return { ok: false, error: "已超过 30 天保留期，无法恢复" };
  }

  const status = restoredEntryStatus(entry.deletedFromStatus);
  const retentionCutoff = new Date(now.getTime() - TRASH_RETENTION_MS);
  const claimed = await prisma.entry.updateMany({
    where: {
      id: entryId,
      status: "DELETED",
      OR: [{ deletedAt: null }, { deletedAt: { gt: retentionCutoff } }],
    },
    data: {
      status,
      deletedFromStatus: null,
      deletedAt: null,
    },
  });
  if (claimed.count === 0) {
    return { ok: false, error: "记录状态已变化，请刷新后重试" };
  }
  return { ok: true, status };
}

/**
 * 彻底删除记录：原子地只删除仍处于 DELETED 的行。
 * 恢复和清理同时发生时只有一个能成功；记录的附件关联随记录级联删除，
 * 照片文件本身不受影响。
 */
export async function purgeEntry(entryId: string): Promise<boolean> {
  const result = await prisma.entry.deleteMany({
    where: { id: entryId, status: "DELETED" },
  });
  return result.count === 1;
}
