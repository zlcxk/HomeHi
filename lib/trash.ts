/**
 * 回收站保留期规则。纯函数，服务端和测试共用；客户端只用来显示，
 * 是否过期始终由服务端按当前时间重新判断。
 */
export const TRASH_RETENTION_DAYS = 30;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** 彻底删除的认领超过这个时间仍未完成，视为 worker 中断，允许重新排队。 */
export const PURGE_CLAIM_STALE_MS = 15 * 60 * 1000;

/** 自动清理失败后的重试间隔，避免每轮 worker 都重复扫描同一条错误。 */
export const PURGE_RETRY_DELAY_MS = 60 * 60 * 1000;

export function trashExpiresAt(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + TRASH_RETENTION_MS);
}

/** deletedAt 为空的历史数据不做自动过期判断，迁移会补齐删除时间。 */
export function isTrashExpired(deletedAt: Date | null | undefined, now: Date): boolean {
  if (!deletedAt) return false;
  return trashExpiresAt(deletedAt).getTime() <= now.getTime();
}

export function trashRemainingMs(deletedAt: Date, now: Date): number {
  return Math.max(0, trashExpiresAt(deletedAt).getTime() - now.getTime());
}

/** 例：「剩余 29 天 3 小时」「剩余 42 分钟」「不到 1 分钟」「已超过保留期」。 */
export function formatTrashRemaining(deletedAt: Date | null | undefined, now: Date): string {
  if (!deletedAt) return "保留期未知";
  const remaining = trashRemainingMs(deletedAt, now);
  if (remaining <= 0) return "已超过保留期";
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes <= 1) return "不到 1 分钟";
  if (minutes < 60) return `剩余 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `剩余 ${hours} 小时`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `剩余 ${days} 天 ${restHours} 小时` : `剩余 ${days} 天`;
}
