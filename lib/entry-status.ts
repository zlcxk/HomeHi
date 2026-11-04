/** 记录恢复后的状态。纯函数，便于在不连接数据库的情况下测试。 */
const RESTORABLE_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export function restoredEntryStatus(deletedFromStatus: string | null): string {
  return deletedFromStatus && RESTORABLE_STATUSES.has(deletedFromStatus)
    ? deletedFromStatus
    : "PUBLISHED";
}
