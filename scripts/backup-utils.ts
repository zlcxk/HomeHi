import { chmod, open, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export function databasePath(): string {
  const raw = (process.env.DATABASE_URL || "file:../data/homehi.db").replace(/^file:/, "");
  return path.isAbsolute(raw) ? raw : path.resolve("prisma", raw);
}

export function storagePath(): string {
  return path.resolve(process.env.STORAGE_DIR || "./storage");
}

export function backupRoot(): string {
  return path.resolve(process.env.BACKUP_DIR || "backups");
}

export async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/** SQLite 文件头是 16 字节的 "SQLite format 3\0"，用来快速识别损坏或未完成的快照。 */
export async function isSqliteFile(file: string): Promise<boolean> {
  const handle = await open(file, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return bytesRead === 16 && header.toString("latin1") === "SQLite format 3\u0000";
  } finally {
    await handle.close();
  }
}

/** SQLite 的 VACUUM INTO 需要路径字符串；Windows 反斜杠在这里容易出问题。 */
export function toSqlitePath(file: string): string {
  return path.resolve(file).replaceAll("\\", "/").replaceAll("'", "''");
}

export function parseKeep(value: string | undefined): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(365, Math.max(1, parsed));
}

/**
 * 备份包含家庭照片和数据库，默认只允许当前用户读写。
 * Windows 上 chmod 基本无效，直接跳过，由 NTFS 权限管理。
 */
export async function applyPrivatePermissions(target: string): Promise<void> {
  if (process.platform === "win32") return;
  const info = await stat(target);
  await chmod(target, info.isDirectory() ? 0o700 : 0o600);
  if (!info.isDirectory()) return;
  const entries = await readdir(target, { withFileTypes: true });
  for (const entry of entries) {
    await applyPrivatePermissions(path.join(target, entry.name));
  }
}

/** 只清理形如 homehi-YYYYMMDD-HHMMSS 的目录，避免误删其他文件。 */
export async function pruneOldBackups(
  root: string,
  keep: number,
  current: string,
): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const backups = entries
    .filter((entry) => entry.isDirectory() && /^homehi-\d{8}-\d{6}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const excess = backups.slice(0, Math.max(0, backups.length - keep)).filter((name) => name !== current);
  for (const name of excess) {
    await rm(path.join(root, name), { recursive: true, force: true });
  }
  return excess;
}
