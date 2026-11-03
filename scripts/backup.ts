import "dotenv/config";

import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DateTime } from "luxon";
import { prisma } from "../lib/db";
import { getStorageConfig } from "../lib/storage";
import {
  applyPrivatePermissions,
  backupRoot,
  databasePath,
  exists,
  isSqliteFile,
  parseKeep,
  pruneOldBackups,
  storagePath,
  toSqlitePath,
} from "./backup-utils";

async function main() {
  const stamp = DateTime.now().toFormat("yyyyLLdd-HHmmss");
  const root = backupRoot();
  const destination = path.join(root, `homehi-${stamp}`);
  const dbFile = databasePath();
  const storage = storagePath();
  const keep = parseKeep(process.env.BACKUP_KEEP);

  // 先确认数据库文件存在再连接，避免 Prisma 顺手创建一个空库。
  if (!(await exists(dbFile))) {
    throw new Error(`找不到数据库：${dbFile}。先启动应用完成初始化，再运行备份。`);
  }
  const migrations = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'",
  );
  if (migrations.length === 0) {
    throw new Error(`数据库尚未初始化或已损坏（缺少 _prisma_migrations 表）：${dbFile}`);
  }

  const storageConfig = await getStorageConfig().catch(() => null);
  const usingOss = storageConfig?.driver === "OSS";

  if (await exists(destination)) {
    throw new Error(`目标目录已存在：${destination}。请稍后重试，避免覆盖已有备份。`);
  }

  await mkdir(destination, { recursive: true, mode: 0o700 });

  try {
    // VACUUM INTO 会生成一致性快照，即使 web / worker 正在写库也不会撕裂。
    // 失败时必须中止：直接复制正在使用的 WAL 数据库可能得到损坏的备份。
    const snapshot = path.join(destination, "homehi.db");
    try {
      await prisma.$executeRawUnsafe(`VACUUM INTO '${toSqlitePath(snapshot)}'`);
    } catch (error) {
      throw new Error(
        `VACUUM INTO 创建快照失败，已中止备份：${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!(await isSqliteFile(snapshot))) {
      throw new Error("快照文件不是有效的 SQLite 数据库，已中止备份。");
    }
    const snapshotInfo = await stat(snapshot);
    if (snapshotInfo.size === 0) throw new Error("快照文件为空，已中止备份。");

    const hasLocalStorage = await exists(storage);
    if (hasLocalStorage) {
      await cp(storage, path.join(destination, "storage"), { recursive: true });
    }

    await writeFile(
      path.join(destination, "README.txt"),
      [
        "HomeHi 备份",
        `时间：${DateTime.now().toFormat("yyyy年M月d日 HH:mm:ss ZZZZ")}`,
        "",
        "恢复步骤：",
        "1. 停止 web 和 worker 进程（Docker：docker compose stop）",
        `2. 运行 npm run restore -- ${path.relative(process.cwd(), destination).replaceAll("\\", "/")} --force`,
        "   脚本会先保留当前数据为 *.before-restore-*，再写入本备份。",
        "3. 重新启动 web 和 worker，确认数据无误后再删除 .before-restore-* 目录",
        "",
        usingOss
          ? "注意：当前媒体存储在阿里云 OSS，本备份只包含数据库。OSS 对象请依赖版本控制或跨区域复制；若 storage/ 中有历史本地文件，已一并备份。"
          : "照片和视频在 storage/ 目录中，已一并备份。",
        "",
        `保留策略：保留最近 ${keep} 份备份（BACKUP_KEEP），更早的会在下次备份后清理。`,
        "请把这个文件夹放在与服务器不同的磁盘或另一台设备上。",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );

    await applyPrivatePermissions(destination);
  } catch (error) {
    // 不留下半成品备份，避免误以为备份完整。
    await rm(destination, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  const removed = await pruneOldBackups(root, keep, path.basename(destination));

  console.log(`备份完成：${destination}`);
  if (!(await exists(storage))) {
    console.warn(`存储目录 ${storage} 不存在，本次仅备份数据库。`);
  }
  if (removed.length > 0) {
    console.log(`按保留策略清理了 ${removed.length} 份旧备份：${removed.join(", ")}`);
  }
}

main()
  .catch((error) => {
    console.error("备份失败：", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
