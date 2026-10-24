import "dotenv/config";

import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DateTime } from "luxon";
import { prisma } from "../lib/db";

function databasePath(): string {
  const raw = (process.env.DATABASE_URL || "file:../data/homehi.db").replace(/^file:/, "");
  return path.isAbsolute(raw) ? raw : path.resolve("prisma", raw);
}

async function main() {
  const stamp = DateTime.now().toFormat("yyyyLLdd-HHmmss");
  const destination = path.resolve("backups", `homehi-${stamp}`);
  const dbFile = databasePath();
  const storage = path.resolve(process.env.STORAGE_DIR || "./storage");

  try {
    await stat(dbFile);
  } catch {
    console.error(`找不到数据库：${dbFile}`);
    console.error("先启动应用完成初始化，再运行备份。");
    process.exit(1);
  }

  await mkdir(destination, { recursive: true });

  // VACUUM INTO writes a consistent snapshot even while the web process is
  // using the database. Copying a live WAL database file-by-file can tear.
  const snapshot = path.join(destination, "homehi.db");
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${snapshot.replaceAll("'", "''")}'`);
  } catch (error) {
    console.warn("无法创建一致性快照，改为直接复制数据库文件：", error);
    await cp(dbFile, snapshot);
    for (const suffix of ["-wal", "-shm"]) {
      try {
        await cp(`${dbFile}${suffix}`, path.join(destination, `homehi.db${suffix}`));
      } catch {
        // WAL files may not exist
      }
    }
  }

  try {
    await cp(storage, path.join(destination, "storage"), { recursive: true });
  } catch {
    console.warn(`存储目录 ${storage} 不存在，仅备份了数据库。`);
  }

  await writeFile(
    path.join(destination, "README.txt"),
    [
      "HomeHi 备份",
      `时间：${DateTime.now().toFormat("yyyy年M月d日 HH:mm:ss ZZZZ")}`,
      "",
      "恢复步骤：",
      "1. 停止 web 和 worker 进程",
      "2. 把 homehi.db（以及 homehi.db-wal / homehi.db-shm，如有）放回 data/",
      "3. 把 storage/ 放回项目根目录",
      "4. 重新启动 npm run start 与 npm run worker:prod",
      "",
      "请把这个文件夹放在与服务器不同的磁盘上。",
      "",
    ].join("\n"),
  );

  console.log(`备份完成：${destination}`);
}

void main();
