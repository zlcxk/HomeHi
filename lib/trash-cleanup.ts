// 回收站自动清理。由现有 worker 周期调用，也可在维护脚本里单独执行。
// 不加 `server-only`，方便测试和运维脚本复用。
import { prisma } from "@/lib/db";
import { purgeEntry } from "@/lib/entry-lifecycle";
import { purgeMedia } from "@/lib/media-lifecycle";
import {
  PURGE_CLAIM_STALE_MS,
  PURGE_RETRY_DELAY_MS,
  TRASH_RETENTION_MS,
} from "@/lib/trash";

const BATCH_SIZE = 100;
const MAX_BATCHES = 4;
const PURGING_RECOVERY_MESSAGE = "上次彻底删除中断，已重新排队";

export type CleanupCounts = {
  examined: number;
  purged: number;
  failed: number;
};

export type TrashCleanupResult = {
  recoveredPurging: number;
  entries: CleanupCounts;
  media: CleanupCounts;
};

function emptyCounts(): CleanupCounts {
  return { examined: 0, purged: 0, failed: 0 };
}

function addCounts(target: CleanupCounts, source: CleanupCounts): void {
  target.examined += source.examined;
  target.purged += source.purged;
  target.failed += source.failed;
}

/**
 * 回收僵死的 PURGING 认领。worker 在清理途中崩溃时，记录会停在 PURGING；
 * 超过 15 分钟仍未完成就放回 DELETED，让下一轮重新清理。
 * 文件删除是幂等的，重复清理不会误删其他媒体的对象。
 */
export async function recoverStalePurgingMedia(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PURGE_CLAIM_STALE_MS);
  const result = await prisma.media.updateMany({
    where: {
      status: "PURGING",
      OR: [{ purgeStartedAt: null }, { purgeStartedAt: { lt: cutoff } }],
    },
    data: {
      status: "DELETED",
      purgeStartedAt: null,
      // 清空重试时间，让本轮清理立即重新认领；否则会被 1 小时重试间隔挡住。
      purgeAttemptedAt: null,
      purgeError: PURGING_RECOVERY_MESSAGE,
    },
  });
  if (result.count > 0) {
    console.warn(`[trash cleanup] 回收 ${result.count} 条中断的彻底删除任务`);
  }
  return result.count;
}

/**
 * 永久删除超过 30 天的记录。逐条条件删除，一条失败不影响整批。
 * 记录的 EntryMedia 等关联会级联删除，照片本身保留。
 */
export async function purgeExpiredEntries(
  now = new Date(),
  take = BATCH_SIZE,
): Promise<CleanupCounts> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_MS);
  const rows = await prisma.entry.findMany({
    where: { status: "DELETED", deletedAt: { lte: cutoff } },
    orderBy: { deletedAt: "asc" },
    take,
    select: { id: true },
  });

  const counts = emptyCounts();
  counts.examined = rows.length;
  for (const row of rows) {
    try {
      if (await purgeEntry(row.id)) {
        counts.purged += 1;
      }
    } catch (error) {
      counts.failed += 1;
      console.error(
        "[trash cleanup] 记录清理失败",
        row.id,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return counts;
}

/**
 * 永久删除超过 30 天的照片和视频。
 * 仍被记录/旅行/头像/物品/封面引用的媒体会被拒绝，错误写在
 * Media.purgeError 上；同一错误一小时内不重复重试，避免刷屏。
 */
export async function purgeExpiredMedia(
  now = new Date(),
  take = BATCH_SIZE,
): Promise<CleanupCounts> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_MS);
  const retryBefore = new Date(now.getTime() - PURGE_RETRY_DELAY_MS);
  const rows = await prisma.media.findMany({
    where: {
      status: "DELETED",
      deletedAt: { lte: cutoff },
      OR: [{ purgeAttemptedAt: null }, { purgeAttemptedAt: { lt: retryBefore } }],
    },
    orderBy: { deletedAt: "asc" },
    take,
    select: { id: true },
  });

  const counts = emptyCounts();
  counts.examined = rows.length;
  for (const row of rows) {
    try {
      const result = await purgeMedia(row.id, now);
      if (result.ok) {
        counts.purged += 1;
      } else {
        counts.failed += 1;
        console.warn("[trash cleanup] 媒体暂时无法清理", row.id, result.error);
      }
    } catch (error) {
      counts.failed += 1;
      console.error(
        "[trash cleanup] 媒体清理失败",
        row.id,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return counts;
}

/**
 * 一轮完整清理：先恢复中断的认领，再清记录（会释放记录里的照片引用），
 * 最后清照片。每类最多 4 批，避免一次占用 worker 太久。
 */
export async function runTrashCleanup(now = new Date()): Promise<TrashCleanupResult> {
  const recoveredPurging = await recoverStalePurgingMedia(now);
  const entries = emptyCounts();
  const media = emptyCounts();

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const current = await purgeExpiredEntries(now, BATCH_SIZE);
    addCounts(entries, current);
    if (current.examined < BATCH_SIZE) break;
  }

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const current = await purgeExpiredMedia(now, BATCH_SIZE);
    addCounts(media, current);
    if (current.examined < BATCH_SIZE) break;
  }

  if (entries.purged > 0 || entries.failed > 0 || media.purged > 0 || media.failed > 0) {
    console.log(
      "[trash cleanup]",
      `记录 ${entries.purged}/${entries.examined} 已清理（失败 ${entries.failed}）`,
      `媒体 ${media.purged}/${media.examined} 已清理（失败 ${media.failed}）`,
    );
  }

  return { recoveredPurging, entries, media };
}
