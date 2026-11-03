import "dotenv/config";

import { chmod, copyFile, cp, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { DateTime } from "luxon";
import {
  applyPrivatePermissions,
  databasePath,
  exists,
  isSqliteFile,
  storagePath,
} from "./backup-utils";

function usage(): never {
  console.error(
    [
      "用法：npm run restore -- <备份目录> --force",
      "",
      "例如：npm run restore -- backups/homehi-20261103-120000 --force",
      "",
      "恢复会覆盖当前数据库和本地媒体；--force 表示你已确认。",
      "恢复前请先停止 web 和 worker。",
    ].join("\n"),
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const directory = args.find((arg) => !arg.startsWith("--"));
  const force = args.includes("--force");
  if (!directory) usage();

  const backupDir = path.resolve(directory);
  const backupDb = path.join(backupDir, "homehi.db");
  const backupStorage = path.join(backupDir, "storage");
  const dbTarget = databasePath();
  const storageTarget = storagePath();

  if (!(await exists(backupDb))) {
    throw new Error(`备份目录里没有 homehi.db：${backupDb}`);
  }
  if (!(await isSqliteFile(backupDb))) {
    throw new Error(`备份里的 homehi.db 不是有效的 SQLite 文件：${backupDb}`);
  }
  if (!force) {
    console.error("恢复会覆盖当前数据。确认备份无误后，重新执行并加上 --force。");
    process.exit(1);
  }

  const stamp = DateTime.now().toFormat("yyyyLLdd-HHmmss");
  const parked: Array<{ target: string; parked: string }> = [];

  async function park(target: string): Promise<string | null> {
    if (!(await exists(target))) return null;
    const saved = `${target}.before-restore-${stamp}`;
    await rename(target, saved);
    parked.push({ target, parked: saved });
    return saved;
  }

  try {
    // 先移走当前数据库及其 WAL/SHM，避免旧日志文件污染恢复后的数据库。
    await park(dbTarget);
    await park(`${dbTarget}-wal`);
    await park(`${dbTarget}-shm`);

    await copyFile(backupDb, dbTarget);
    if (process.platform !== "win32") await chmod(dbTarget, 0o600);

    if (await exists(backupStorage)) {
      await park(storageTarget);
      await cp(backupStorage, storageTarget, { recursive: true });
      await applyPrivatePermissions(storageTarget);
    }
  } catch (error) {
    // 尽力回滚，避免恢复失败后既没有新数据也找不到旧数据。
    for (const item of parked.reverse()) {
      await rm(item.target, { recursive: true, force: true }).catch(() => {});
      await rename(item.parked, item.target).catch(() => {});
    }
    throw new Error(`恢复失败，已尝试还原原有数据：${error instanceof Error ? error.message : String(error)}`);
  }

  const dbInfo = await stat(dbTarget);
  console.log(`恢复完成：${dbTarget}（${dbInfo.size} 字节）`);
  if (await exists(backupStorage)) {
    console.log(`本地媒体已恢复到：${storageTarget}`);
  } else {
    console.log("备份中没有 storage/；保留了当前本地媒体目录。使用 OSS 时媒体不在备份内。");
  }

  if (parked.length > 0) {
    console.log("\n原数据已保留，确认恢复无误后可手动删除：");
    for (const item of parked) console.log(`  ${item.parked}`);
    console.log("\n如需回滚：停止服务，删除当前文件，再把上面的 .before-restore-* 改回原名。");
  } else {
    console.log("\n之前没有可保留的数据库文件。");
  }
  console.log("\n下一步：启动 web 和 worker，登录后核对记录数量与媒体是否正常。");
}

main().catch((error) => {
  console.error("恢复失败：", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
