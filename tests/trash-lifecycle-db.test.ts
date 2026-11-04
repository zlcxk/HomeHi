import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * 真实 SQLite 上的删除/恢复/彻底删除链路。
 *
 * 每个测试文件使用独立的临时数据库和存储目录，先跑 `prisma migrate deploy`，
 * 再动态导入 Prisma 客户端（客户端在模块加载时读取 DATABASE_URL）。
 * 这里不碰开发库或用户数据。
 */

const DAY = 24 * 60 * 60 * 1000;
const cwd = process.cwd();

let tempDir: string;
let db: typeof import("@/lib/db").prisma;
let lifecycle: typeof import("@/lib/media-lifecycle");
let entryLifecycle: typeof import("@/lib/entry-lifecycle");
let cleanup: typeof import("@/lib/trash-cleanup");
let householdId: string;
let userId: string;

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "homehi-trash-"));
  const dbPath = path.join(tempDir, "test.db").replaceAll("\\", "/");
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.STORAGE_DIR = path.join(tempDir, "storage");
  await mkdir(process.env.STORAGE_DIR, { recursive: true });

  execFileSync(
    process.execPath,
    [path.join(cwd, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
    { cwd, env: { ...process.env }, stdio: "pipe" },
  );

  db = (await import("@/lib/db")).prisma;
  lifecycle = await import("@/lib/media-lifecycle");
  entryLifecycle = await import("@/lib/entry-lifecycle");
  cleanup = await import("@/lib/trash-cleanup");

  const household = await db.household.create({ data: { name: "测试家庭" } });
  householdId = household.id;
  const user = await db.user.create({
    data: {
      email: `trash-${randomUUID()}@test.local`,
      passwordHash: "x",
      displayName: "测试成员",
    },
  });
  userId = user.id;
  await db.householdMember.create({
    data: { householdId, userId, role: "OWNER" },
  });
}, 60_000);

afterAll(async () => {
  await db?.$disconnect();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

async function createMedia(overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  const storageKey = `media/${id}.jpg`;
  await mkdir(path.dirname(path.join(process.env.STORAGE_DIR!, storageKey)), { recursive: true });
  await writeFile(path.join(process.env.STORAGE_DIR!, storageKey), Buffer.from("original"));
  return db.media.create({
    data: {
      householdId,
      uploadedBy: userId,
      mediaType: "IMAGE",
      originalFilename: `${id}.jpg`,
      mimeType: "image/jpeg",
      fileSize: 8,
      storageKey,
      storageDriver: "LOCAL",
      ...overrides,
    },
  });
}

async function createEntry(status = "PUBLISHED") {
  return db.entry.create({
    data: {
      householdId,
      createdBy: userId,
      entryType: "GENERAL",
      body: "测试记录",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      status,
    },
  });
}

async function fileExists(key: string): Promise<boolean> {
  try {
    await readFile(path.join(process.env.STORAGE_DIR!, key));
    return true;
  } catch {
    return false;
  }
}

describe("媒体删除与恢复（真实数据库）", () => {
  it("恢复后回到原相册、记录附件、封面和头像", async () => {
    const media = await createMedia();
    const album = await db.album.create({
      data: {
        householdId,
        name: "测试相册",
        createdBy: userId,
        coverMediaId: media.id,
      },
    });
    await db.albumMedia.create({ data: { albumId: album.id, mediaId: media.id } });
    const entry = await createEntry();
    await db.entry.update({ where: { id: entry.id }, data: { coverMediaId: media.id } });
    await db.entryMedia.create({ data: { entryId: entry.id, mediaId: media.id } });
    await db.user.update({ where: { id: userId }, data: { avatarMediaId: media.id } });

    const deletedAt = new Date();
    await lifecycle.softDeleteMedia(media.id, deletedAt);

    const deleted = await db.media.findUniqueOrThrow({ where: { id: media.id } });
    expect(deleted.status).toBe("DELETED");
    expect(deleted.deletedRefs).toContain(album.id);
    expect(await db.albumMedia.count({ where: { albumId: album.id, mediaId: media.id } })).toBe(1);
    expect(await db.entryMedia.count({ where: { entryId: entry.id, mediaId: media.id } })).toBe(1);
    expect((await db.album.findUniqueOrThrow({ where: { id: album.id } })).coverMediaId).toBeNull();
    expect((await db.entry.findUniqueOrThrow({ where: { id: entry.id } })).coverMediaId).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).avatarMediaId).toBeNull();

    const result = await lifecycle.restoreMedia(media.id, new Date(deletedAt.getTime() + 60_000));
    expect(result.ok).toBe(true);
    expect((await db.media.findUniqueOrThrow({ where: { id: media.id } })).status).toBe("ACTIVE");
    expect((await db.album.findUniqueOrThrow({ where: { id: album.id } })).coverMediaId).toBe(media.id);
    expect((await db.entry.findUniqueOrThrow({ where: { id: entry.id } })).coverMediaId).toBe(media.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).avatarMediaId).toBe(media.id);
  }, 20_000);

  it("从相册移除和删除相册都不会删除媒体记录或文件", async () => {
    const media = await createMedia();
    const album = await db.album.create({
      data: { householdId, name: "只是整理", createdBy: userId },
    });
    await db.albumMedia.create({ data: { albumId: album.id, mediaId: media.id } });

    // 界面动作 removeMediaFromAlbumAction 的核心就是删除这一条关联。
    await db.albumMedia.deleteMany({ where: { albumId: album.id, mediaId: media.id } });
    expect((await db.media.findUniqueOrThrow({ where: { id: media.id } })).status).toBe("ACTIVE");
    expect(await fileExists(media.storageKey)).toBe(true);

    await db.albumMedia.create({ data: { albumId: album.id, mediaId: media.id } });
    await db.album.delete({ where: { id: album.id } });
    expect(await db.media.findUnique({ where: { id: media.id } })).not.toBeNull();
    expect(await fileExists(media.storageKey)).toBe(true);
  }, 20_000);

  it("照片仍被记录引用时拒绝彻底删除，解除引用后才清理文件", async () => {
    const media = await createMedia();
    const entry = await createEntry();
    await db.entryMedia.create({ data: { entryId: entry.id, mediaId: media.id } });
    await lifecycle.softDeleteMedia(media.id);

    const blocked = await lifecycle.purgeMedia(media.id);
    expect(blocked.ok).toBe(false);
    const blockedRow = await db.media.findUniqueOrThrow({ where: { id: media.id } });
    expect(blockedRow.status).toBe("DELETED");
    expect(blockedRow.purgeError).toContain("记录");
    expect(await fileExists(media.storageKey)).toBe(true);

    await db.entryMedia.deleteMany({ where: { entryId: entry.id, mediaId: media.id } });
    const purged = await lifecycle.purgeMedia(media.id);
    expect(purged.ok).toBe(true);
    expect(await db.media.findUnique({ where: { id: media.id } })).toBeNull();
    expect(await fileExists(media.storageKey)).toBe(false);
  }, 20_000);

  it("只有相册关联的照片可以彻底删除，并级联移除相册关联", async () => {
    const media = await createMedia();
    const album = await db.album.create({
      data: { householdId, name: "待清理", createdBy: userId, coverMediaId: media.id },
    });
    await db.albumMedia.create({ data: { albumId: album.id, mediaId: media.id } });
    await lifecycle.softDeleteMedia(media.id);

    const purged = await lifecycle.purgeMedia(media.id);
    expect(purged.ok).toBe(true);
    expect(await db.albumMedia.count({ where: { mediaId: media.id } })).toBe(0);
    expect((await db.album.findUniqueOrThrow({ where: { id: album.id } })).coverMediaId).toBeNull();
    expect(await fileExists(media.storageKey)).toBe(false);
  }, 20_000);

  it("超过 30 天的照片不能恢复，但仍可被清理", async () => {
    const media = await createMedia();
    const now = new Date();
    await lifecycle.softDeleteMedia(media.id, new Date(now.getTime() - 31 * DAY));

    const restore = await lifecycle.restoreMedia(media.id, now);
    expect(restore.ok).toBe(false);
    if (!restore.ok) expect(restore.error).toContain("30 天");

    const purged = await lifecycle.purgeMedia(media.id, now);
    expect(purged.ok).toBe(true);
    expect(await db.media.findUnique({ where: { id: media.id } })).toBeNull();
  }, 20_000);

  it("恢复与彻底删除同时发生时不会出现「已恢复但文件已删除」", async () => {
    const media = await createMedia();
    await lifecycle.softDeleteMedia(media.id);

    // SQLite 并发写可能让其中一个请求等待或报 busy；无论哪个先完成，
    // 最终状态都不能是「ACTIVE 但原图不存在」。
    const [restoreSettled, purgeSettled] = await Promise.allSettled([
      lifecycle.restoreMedia(media.id),
      lifecycle.purgeMedia(media.id),
    ]);
    const restoreResult =
      restoreSettled.status === "fulfilled" ? restoreSettled.value : { ok: false as const };
    const purgeResult =
      purgeSettled.status === "fulfilled" ? purgeSettled.value : { ok: false as const };
    const row = await db.media.findUnique({ where: { id: media.id } });
    const exists = await fileExists(media.storageKey);

    if (restoreResult.ok) {
      expect(row?.status).toBe("ACTIVE");
      expect(exists).toBe(true);
      expect(purgeResult.ok).toBe(false);
    } else {
      expect(row === null || row.status === "DELETED" || row.status === "PURGING").toBe(true);
      if (row?.status === "ACTIVE") expect(exists).toBe(true);
    }
  }, 20_000);

  it("重复清理同一张照片是幂等的", async () => {
    const media = await createMedia();
    await lifecycle.softDeleteMedia(media.id);
    const results = await Promise.allSettled([
      lifecycle.purgeMedia(media.id),
      lifecycle.purgeMedia(media.id),
    ]);
    const fulfilled = results
      .filter((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof lifecycle.purgeMedia>>> =>
        item.status === "fulfilled",
      )
      .map((item) => item.value);
    // 至少一个认领成功；另一个要么看到 PURGING/已删除，要么因 SQLite 忙而失败。
    expect(fulfilled.some((item) => item.ok)).toBe(true);
    expect(await db.media.findUnique({ where: { id: media.id } })).toBeNull();
    expect(await fileExists(media.storageKey)).toBe(false);
  }, 20_000);
});

describe("记录删除与恢复（真实数据库）", () => {
  it("草稿删除后恢复仍是草稿，附件关系不丢失", async () => {
    const media = await createMedia();
    const entry = await createEntry("DRAFT");
    await db.entryMedia.create({ data: { entryId: entry.id, mediaId: media.id } });

    expect(await entryLifecycle.softDeleteEntry(entry.id)).toBe(true);
    const deleted = await db.entry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(deleted.status).toBe("DELETED");
    expect(deleted.deletedFromStatus).toBe("DRAFT");
    expect(await db.entryMedia.count({ where: { entryId: entry.id } })).toBe(1);

    const restored = await entryLifecycle.restoreEntry(entry.id);
    expect(restored).toEqual({ ok: true, status: "DRAFT" });
    const row = await db.entry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(row.status).toBe("DRAFT");
    expect(row.deletedAt).toBeNull();
    expect(await db.entryMedia.count({ where: { entryId: entry.id } })).toBe(1);
  }, 20_000);

  it("超过 30 天的记录不能恢复，清理只删记录不删照片", async () => {
    const media = await createMedia();
    const entry = await createEntry("PUBLISHED");
    await db.entryMedia.create({ data: { entryId: entry.id, mediaId: media.id } });
    const now = new Date();
    await entryLifecycle.softDeleteEntry(entry.id, new Date(now.getTime() - 31 * DAY));

    const restore = await entryLifecycle.restoreEntry(entry.id, now);
    expect(restore.ok).toBe(false);

    const counts = await cleanup.purgeExpiredEntries(now);
    expect(counts.purged).toBeGreaterThanOrEqual(1);
    expect(await db.entry.findUnique({ where: { id: entry.id } })).toBeNull();
    // 记录删除后照片仍在照片墙，EntryMedia 级联移除。
    expect((await db.media.findUniqueOrThrow({ where: { id: media.id } })).status).toBe("ACTIVE");
    expect(await fileExists(media.storageKey)).toBe(true);
  }, 20_000);

  it("恢复和彻底删除同时发生时只有一个成功", async () => {
    const entry = await createEntry("PUBLISHED");
    await entryLifecycle.softDeleteEntry(entry.id);
    const [restoreSettled, purgeSettled] = await Promise.allSettled([
      entryLifecycle.restoreEntry(entry.id),
      entryLifecycle.purgeEntry(entry.id),
    ]);
    const restoreResult =
      restoreSettled.status === "fulfilled" ? restoreSettled.value : { ok: false as const };
    const purged = purgeSettled.status === "fulfilled" ? purgeSettled.value : false;
    const row = await db.entry.findUnique({ where: { id: entry.id } });
    if (restoreResult.ok) {
      expect(purged).toBe(false);
      expect(row?.status).toBe("PUBLISHED");
    } else if (purged) {
      expect(row).toBeNull();
    } else {
      // 两个请求都可能因 SQLite 写入冲突而失败；此时记录仍然是 DELETED。
      expect(row?.status).toBe("DELETED");
    }
  }, 20_000);
});

describe("自动清理与中断恢复（真实数据库）", () => {
  it("30 天到期后清理记录和无引用照片，被引用的照片保留", async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 31 * DAY);

    const orphan = await createMedia();
    await lifecycle.softDeleteMedia(orphan.id, old);

    const referenced = await createMedia();
    const liveEntry = await createEntry("PUBLISHED");
    await db.entryMedia.create({ data: { entryId: liveEntry.id, mediaId: referenced.id } });
    await lifecycle.softDeleteMedia(referenced.id, old);

    const oldEntry = await createEntry("PUBLISHED");
    await entryLifecycle.softDeleteEntry(oldEntry.id, old);

    const result = await cleanup.runTrashCleanup(now);
    expect(result.entries.purged).toBeGreaterThanOrEqual(1);
    expect(result.media.purged).toBeGreaterThanOrEqual(1);

    expect(await db.entry.findUnique({ where: { id: oldEntry.id } })).toBeNull();
    expect(await db.media.findUnique({ where: { id: orphan.id } })).toBeNull();
    expect(await fileExists(orphan.storageKey)).toBe(false);

    const blocked = await db.media.findUniqueOrThrow({ where: { id: referenced.id } });
    expect(blocked.status).toBe("DELETED");
    expect(blocked.purgeError).toContain("记录");
    expect(await fileExists(referenced.storageKey)).toBe(true);
  }, 30_000);

  it("中断的 PURGING 认领会回到 DELETED 并重新清理", async () => {
    const media = await createMedia();
    const now = new Date();
    await db.media.update({
      where: { id: media.id },
      data: {
        status: "PURGING",
        deletedAt: new Date(now.getTime() - 31 * DAY),
        purgeStartedAt: new Date(now.getTime() - 20 * 60_000),
      },
    });

    const recovered = await cleanup.recoverStalePurgingMedia(now);
    expect(recovered).toBe(1);
    expect((await db.media.findUniqueOrThrow({ where: { id: media.id } })).status).toBe("DELETED");

    const result = await cleanup.runTrashCleanup(now);
    expect(result.media.purged).toBeGreaterThanOrEqual(1);
    expect(await db.media.findUnique({ where: { id: media.id } })).toBeNull();
  }, 30_000);

  it("清理失败的项目会在下一次运行继续重试", async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 31 * DAY);
    const media = await createMedia();
    const entry = await createEntry("PUBLISHED");
    await db.entryMedia.create({ data: { entryId: entry.id, mediaId: media.id } });
    await lifecycle.softDeleteMedia(media.id, old);

    const first = await cleanup.purgeExpiredMedia(now);
    expect(first.failed).toBeGreaterThanOrEqual(1);
    const afterFirst = await db.media.findUniqueOrThrow({ where: { id: media.id } });
    expect(afterFirst.purgeError).toBeTruthy();

    // 解除引用后，超过重试间隔即可再次处理。
    await db.entryMedia.deleteMany({ where: { mediaId: media.id } });
    const later = new Date(now.getTime() + 2 * 60 * 60_000);
    const second = await cleanup.purgeExpiredMedia(later);
    expect(second.purged).toBeGreaterThanOrEqual(1);
    expect(await db.media.findUnique({ where: { id: media.id } })).toBeNull();
  }, 30_000);
});
