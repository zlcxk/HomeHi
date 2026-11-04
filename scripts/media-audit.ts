/**
 * 媒体存储只读审计：比对数据库引用和实际存储对象。
 *
 *   npm run audit:media
 *
 * 检查两类问题：
 *   1. 数据库有记录，但原图/缩略图/展示图/播放版文件缺失；
 *   2. 存储里有文件，但没有任何媒体或议题附件引用（孤儿）。
 *
 * 默认同时检查 LOCAL 和数据库中出现过的 OSS 后端。不会删除或修改任何文件。
 * 上传/删除进行中时结果可能短暂不一致，建议在低峰期运行。
 */
import "dotenv/config";

import { prisma } from "../lib/db";
import {
  getStorageConfig,
  getStorageDriver,
  normalizeStorageKind,
  type StorageKind,
} from "../lib/storage";

type KeyRef = {
  key: string;
  owner: string;
  variant: string;
};

const SAMPLE_LIMIT = 20;

function isIgnoredKey(key: string): boolean {
  const base = key.split("/").pop() ?? key;
  return (
    base.startsWith(".homehi-check-") ||
    base === ".gitkeep" ||
    base === ".gitignore" ||
    base === ".DS_Store" ||
    base === "Thumbs.db" ||
    base === "desktop.ini"
  );
}

function printSamples(title: string, items: string[]): void {
  if (items.length === 0) return;
  console.log(`\n${title}（${items.length}）`);
  for (const item of items.slice(0, SAMPLE_LIMIT)) console.log(`  ${item}`);
  if (items.length > SAMPLE_LIMIT) {
    console.log(`  …还有 ${items.length - SAMPLE_LIMIT} 条，省略`);
  }
}

async function main(): Promise<void> {
  const media = await prisma.media.findMany({
    select: {
      id: true,
      status: true,
      mediaType: true,
      storageDriver: true,
      storageKey: true,
      thumbnailKey: true,
      displayKey: true,
      playbackKey: true,
    },
  });
  const attachments = await prisma.topicAttachment.findMany({
    select: { id: true, storageDriver: true, storageKey: true },
  });

  const byDriver = new Map<StorageKind, Map<string, KeyRef>>();
  const refsFor = (kind: StorageKind) => {
    let refs = byDriver.get(kind);
    if (!refs) {
      refs = new Map<string, KeyRef>();
      byDriver.set(kind, refs);
    }
    return refs;
  };

  for (const item of media) {
    const kind = normalizeStorageKind(item.storageDriver);
    const refs = refsFor(kind);
    const variants = [
      { key: item.storageKey, variant: "原图" },
      { key: item.thumbnailKey, variant: "缩略图" },
      { key: item.displayKey, variant: "展示图" },
      { key: item.playbackKey, variant: "播放版" },
    ];
    for (const { key, variant } of variants) {
      if (!key) continue;
      refs.set(key, {
        key,
        variant,
        owner: `媒体 ${item.id}（${item.status}，${item.mediaType}）`,
      });
    }
  }

  for (const item of attachments) {
    const kind = normalizeStorageKind(item.storageDriver);
    refsFor(kind).set(item.storageKey, {
      key: item.storageKey,
      variant: "议题附件",
      owner: `议题附件 ${item.id}`,
    });
  }

  const kinds = new Set<StorageKind>([...byDriver.keys(), "LOCAL"]);
  try {
    const config = await getStorageConfig();
    kinds.add(config.driver);
  } catch {
    // 数据库不可用时只审计已经出现的后端。
  }

  console.log(
    `媒体审计：${media.length} 条媒体（${media.filter((m) => m.status === "DELETED").length} 条已删除），` +
      `${attachments.length} 个议题附件，${[...kinds].join(" / ")} 后端。`,
  );

  let problems = 0;
  for (const kind of kinds) {
    const refs = byDriver.get(kind) ?? new Map<string, KeyRef>();
    let driver;
    try {
      driver = await getStorageDriver(kind);
    } catch (error) {
      if (refs.size > 0) {
        console.error(
          `\n[${kind}] 存储后端不可用，无法审计：${error instanceof Error ? error.message : String(error)}`,
        );
        problems += 1;
      }
      continue;
    }

    const seen = new Set<string>();
    let listed = 0;
    try {
      for await (const object of driver.list()) {
        if (isIgnoredKey(object.key)) continue;
        seen.add(object.key);
        listed += 1;
      }
    } catch (error) {
      console.error(
        `\n[${kind}] 枚举存储对象失败：${error instanceof Error ? error.message : String(error)}`,
      );
      problems += 1;
      continue;
    }

    const missing = [...refs.values()]
      .filter((ref) => !seen.has(ref.key))
      .map((ref) => `${ref.variant} 缺失：${ref.key} ← ${ref.owner}`);
    const orphans = [...seen]
      .filter((key) => !refs.has(key))
      .map((key) => `孤儿文件：${key}`);

    console.log(
      `\n[${kind}] 数据库引用 ${refs.size} 个文件，存储中 ${listed} 个对象；` +
        `缺失 ${missing.length}，孤儿 ${orphans.length}。`,
    );
    printSamples("缺失文件", missing);
    printSamples("孤儿文件", orphans);
    problems += missing.length + orphans.length;
  }

  if (problems > 0) {
    console.log(`\n审计发现 ${problems} 个问题。本脚本不会自动删除任何文件。`);
    process.exitCode = 1;
  } else {
    console.log("\n审计通过：数据库引用与存储对象一致。");
  }
}

main()
  .catch((error) => {
    console.error("审计失败：", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
