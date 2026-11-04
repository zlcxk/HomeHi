/**
 * 媒体查询基准：复制一个已迁移的本地数据库，写入指定规模的合成数据，
 * 测量照片列表、相册、收藏/视频筛选和相册选择器的游标查询耗时。
 *
 * 用法：npm run bench:media            # 1k / 10k / 50k / 100k
 *       npm run bench:media -- 1000 100000
 *
 * 只写入 data/.media-bench-*.db 临时副本，结束后删除，不接触真实数据。
 */
import { copyFileSync, existsSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";

const PAGE_SIZE = 30;
const RUNS = 15;
const COUNT_CAP = 1000;

const root = process.cwd();
const source = path.join(root, "data", "homehi.db");
if (!existsSync(source)) {
  throw new Error("找不到 data/homehi.db，请先启动应用完成迁移");
}

function cleanup(temp: string) {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = temp + suffix;
    if (existsSync(file)) rmSync(file);
  }
}

async function percentile(label: string, fn: () => Promise<unknown>) {
  await fn();
  await fn();
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i += 1) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
  console.log(
    `${label}: median=${median.toFixed(2)}ms p95=${p95.toFixed(2)}ms max=${samples[samples.length - 1].toFixed(2)}ms`,
  );
}

async function runSize(size: number) {
  const temp = path.join(root, "data", `.media-bench-${size}.db`);
  cleanup(temp);
  copyFileSync(source, temp);

  const prisma = new PrismaClient({ datasourceUrl: `file:${temp}` });
  try {
    const user = await prisma.user.create({
      data: { email: `bench-${size}@example.invalid`, passwordHash: "x", displayName: "Bench" },
    });
    const other = await prisma.user.create({
      data: { email: `bench-other-${size}@example.invalid`, passwordHash: "x", displayName: "Other" },
    });
    const household = await prisma.household.create({ data: { name: `Bench ${size}` } });
    await prisma.householdMember.create({
      data: { householdId: household.id, userId: user.id, role: "OWNER" },
    });

    const h = household.id;
    const u = user.id;
    const o = other.id;
    // Prisma 在 SQLite 中以整数毫秒存储 DateTime，合成数据保持相同格式。
    const createdAtBase = Date.UTC(2021, 0, 1);
    const takenAtBase = Date.UTC(2010, 0, 1);

    const started = performance.now();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Media" (
        "id","householdId","uploadedBy","mediaType","originalFilename","mimeType","fileSize",
        "storageKey","thumbnailKey","takenAt","caption","favorite","visibility","status","createdAt","updatedAt"
      )
      WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ${size})
      SELECT
        'media' || printf('%09d', n),
        '${h}',
        CASE WHEN n % 7 = 0 THEN '${o}' ELSE '${u}' END,
        CASE WHEN n % 20 = 0 THEN 'VIDEO' ELSE 'IMAGE' END,
        'bench-' || n || '.jpg',
        'image/jpeg',
        1024 + n,
        'bench/' || n || '.jpg',
        'bench/' || n || '.webp',
        CASE WHEN n % 5 = 0 THEN NULL ELSE ${takenAtBase} + (n % 3650) * 86400000 END,
        CASE WHEN n % 11 = 0 THEN 'bench caption ' || n ELSE NULL END,
        CASE WHEN n % 10 = 0 THEN 1 ELSE 0 END,
        CASE WHEN n % 13 = 0 THEN 'PRIVATE' ELSE 'HOUSEHOLD' END,
        'ACTIVE',
        ${createdAtBase} + n * 1000,
        ${createdAtBase} + n * 1000
      FROM seq`,
    );

    const album = await prisma.album.create({
      data: { householdId: h, name: "Bench album", createdBy: u },
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AlbumMedia" ("albumId","mediaId","sortOrder","createdAt")
       WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ${size})
       SELECT '${album.id}', 'media' || printf('%09d', n), n % 50, ${createdAtBase} + n * 1000
       FROM seq`,
    );

    const smallAlbum = await prisma.album.create({
      data: { householdId: h, name: "Small album", createdBy: u },
    });
    const smallCount = Math.max(1, Math.floor(size / 10));
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AlbumMedia" ("albumId","mediaId","sortOrder","createdAt")
       WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ${smallCount})
       SELECT '${smallAlbum.id}', 'media' || printf('%09d', n * 10), n, ${createdAtBase} + n * 1000
       FROM seq`,
    );

    const seedMs = performance.now() - started;
    const dbBytes = statSync(temp).size;

    const mediaWhere = {
      householdId: h,
      status: "ACTIVE",
      OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: u }],
    };
    const orderBy = [{ takenAt: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];
    const albumMediaWhere = {
      albumId: album.id,
      media: {
        householdId: h,
        status: "ACTIVE",
        OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: u }],
      },
    };

    const firstPhoto = await prisma.media.findMany({
      where: mediaWhere,
      orderBy,
      take: PAGE_SIZE + 1,
      select: { id: true },
    });
    const photoCursor = firstPhoto[PAGE_SIZE - 1]?.id ?? null;
    const photoAnchor = photoCursor
      ? await prisma.media.findUnique({
          where: { id: photoCursor },
          select: { id: true, takenAt: true, createdAt: true },
        })
      : null;

    const firstAlbum = await prisma.albumMedia.findMany({
      where: albumMediaWhere,
      orderBy: [{ sortOrder: "asc" }, { mediaId: "asc" }],
      take: PAGE_SIZE + 1,
      select: { mediaId: true },
    });
    const albumCursor = firstAlbum[PAGE_SIZE - 1]?.mediaId ?? null;
    const albumAnchor = albumCursor
      ? await prisma.albumMedia.findUnique({
          where: { albumId_mediaId: { albumId: album.id, mediaId: albumCursor } },
          select: { sortOrder: true, mediaId: true },
        })
      : null;

    const photoKeysetWhere = photoAnchor
      ? photoAnchor.takenAt
        ? {
            AND: [
              mediaWhere,
              {
                OR: [
                  { takenAt: { lt: photoAnchor.takenAt } },
                  { takenAt: photoAnchor.takenAt, createdAt: { lt: photoAnchor.createdAt } },
                  {
                    takenAt: photoAnchor.takenAt,
                    createdAt: photoAnchor.createdAt,
                    id: { lt: photoAnchor.id },
                  },
                ],
              },
            ],
          }
        : {
            AND: [
              mediaWhere,
              {
                takenAt: null,
                OR: [
                  { createdAt: { lt: photoAnchor.createdAt } },
                  { createdAt: photoAnchor.createdAt, id: { lt: photoAnchor.id } },
                ],
              },
            ],
          }
      : mediaWhere;

    const pickerBase = { ...mediaWhere, albumLinks: { none: { albumId: smallAlbum.id } } };
    const pickerFirst = await prisma.media.findMany({
      where: pickerBase,
      orderBy,
      take: PAGE_SIZE + 1,
      select: { id: true, takenAt: true, createdAt: true },
    });
    const pickerAnchor = pickerFirst[PAGE_SIZE - 1] ?? null;
    const pickerKeysetWhere = pickerAnchor
      ? pickerAnchor.takenAt
        ? {
            AND: [
              pickerBase,
              {
                OR: [
                  { takenAt: { lt: pickerAnchor.takenAt } },
                  { takenAt: pickerAnchor.takenAt, createdAt: { lt: pickerAnchor.createdAt } },
                  {
                    takenAt: pickerAnchor.takenAt,
                    createdAt: pickerAnchor.createdAt,
                    id: { lt: pickerAnchor.id },
                  },
                ],
              },
            ],
          }
        : {
            AND: [
              pickerBase,
              {
                takenAt: null,
                OR: [
                  { createdAt: { lt: pickerAnchor.createdAt } },
                  { createdAt: pickerAnchor.createdAt, id: { lt: pickerAnchor.id } },
                ],
              },
            ],
          }
      : pickerBase;

    console.log(
      `\n=== size=${size} node=${process.version} ${os.platform()} ${os.arch()} cpu=${os.cpus()[0]?.model} db=${(dbBytes / 1024 / 1024).toFixed(1)}MB seed=${seedMs.toFixed(0)}ms ===`,
    );

    await percentile("photos page1", () =>
      prisma.media.findMany({ where: mediaWhere, orderBy, take: PAGE_SIZE + 1, select: { id: true } }),
    );
    await percentile("photos page2 keyset", () =>
      prisma.media.findMany({ where: photoKeysetWhere, orderBy, take: PAGE_SIZE + 1, select: { id: true } }),
    );
    await percentile("photos favorites", () =>
      prisma.media.findMany({
        where: { ...mediaWhere, favorite: true },
        orderBy,
        take: PAGE_SIZE + 1,
        select: { id: true },
      }),
    );
    await percentile("photos videos", () =>
      prisma.media.findMany({
        where: { ...mediaWhere, mediaType: "VIDEO" },
        orderBy,
        take: PAGE_SIZE + 1,
        select: { id: true },
      }),
    );
    await percentile("album page1", () =>
      prisma.albumMedia.findMany({
        where: albumMediaWhere,
        orderBy: [{ sortOrder: "asc" }, { mediaId: "asc" }],
        take: PAGE_SIZE + 1,
        select: { mediaId: true },
      }),
    );
    await percentile("album page2 keyset", () =>
      prisma.albumMedia.findMany({
        where: {
          ...albumMediaWhere,
          ...(albumAnchor
            ? {
                OR: [
                  { sortOrder: { gt: albumAnchor.sortOrder } },
                  { sortOrder: albumAnchor.sortOrder, mediaId: { gt: albumAnchor.mediaId } },
                ],
              }
            : {}),
        },
        orderBy: [{ sortOrder: "asc" }, { mediaId: "asc" }],
        take: PAGE_SIZE + 1,
        select: { mediaId: true },
      }),
    );
    await percentile("album count capped", () =>
      prisma.albumMedia.findMany({ where: albumMediaWhere, take: COUNT_CAP + 1, select: { mediaId: true } }),
    );
    await percentile("picker (album has all)", () =>
      prisma.media.findMany({
        where: { ...mediaWhere, albumLinks: { none: { albumId: album.id } } },
        orderBy,
        take: PAGE_SIZE + 1,
        select: { id: true },
      }),
    );
    await percentile("picker (album has 10%)", () =>
      prisma.media.findMany({
        where: pickerBase,
        orderBy,
        take: PAGE_SIZE + 1,
        select: { id: true },
      }),
    );
    await percentile("picker page2 keyset (album has 10%)", () =>
      prisma.media.findMany({
        where: pickerKeysetWhere,
        orderBy,
        take: PAGE_SIZE + 1,
        select: { id: true },
      }),
    );

    const explain = async (label: string, sql: string) => {
      const rows = await prisma.$queryRawUnsafe<Array<{ detail: string }>>(
        `EXPLAIN QUERY PLAN ${sql}`,
      );
      console.log(`EXPLAIN ${label}:`);
      for (const row of rows) console.log(`  ${row.detail}`);
    };
    await explain(
      "photos page1",
      `SELECT "id" FROM "Media"
       WHERE "householdId" = '${h}' AND "status" = 'ACTIVE'
         AND ("visibility" = 'HOUSEHOLD' OR "uploadedBy" = '${u}')
       ORDER BY "takenAt" DESC, "createdAt" DESC, "id" DESC LIMIT ${PAGE_SIZE + 1}`,
    );
    await explain(
      "photos favorites",
      `SELECT "id" FROM "Media"
       WHERE "householdId" = '${h}' AND "status" = 'ACTIVE' AND "favorite" = 1
         AND ("visibility" = 'HOUSEHOLD' OR "uploadedBy" = '${u}')
       ORDER BY "takenAt" DESC, "createdAt" DESC, "id" DESC LIMIT ${PAGE_SIZE + 1}`,
    );
    await explain(
      "photos videos",
      `SELECT "id" FROM "Media"
       WHERE "householdId" = '${h}' AND "status" = 'ACTIVE' AND "mediaType" = 'VIDEO'
         AND ("visibility" = 'HOUSEHOLD' OR "uploadedBy" = '${u}')
       ORDER BY "takenAt" DESC, "createdAt" DESC, "id" DESC LIMIT ${PAGE_SIZE + 1}`,
    );
    await explain(
      "album page1",
      `SELECT "mediaId" FROM "AlbumMedia"
       WHERE "albumId" = '${album.id}'
         AND "mediaId" IN (
           SELECT "id" FROM "Media" WHERE "householdId" = '${h}' AND "status" = 'ACTIVE'
             AND ("visibility" = 'HOUSEHOLD' OR "uploadedBy" = '${u}')
         )
       ORDER BY "sortOrder" ASC, "mediaId" ASC LIMIT ${PAGE_SIZE + 1}`,
    );
    await explain(
      "picker page1",
      `SELECT "id" FROM "Media"
       WHERE "householdId" = '${h}' AND "status" = 'ACTIVE'
         AND ("visibility" = 'HOUSEHOLD' OR "uploadedBy" = '${u}')
         AND NOT EXISTS (
           SELECT 1 FROM "AlbumMedia"
           WHERE "AlbumMedia"."albumId" = '${album.id}' AND "AlbumMedia"."mediaId" = "Media"."id"
         )
       ORDER BY "takenAt" DESC, "createdAt" DESC, "id" DESC LIMIT ${PAGE_SIZE + 1}`,
    );
  } finally {
    await prisma.$disconnect();
    cleanup(temp);
  }
}

async function main() {
  const sizes = process.argv
    .slice(2)
    .map(Number)
    .filter((size) => Number.isFinite(size) && size > 0);
  for (const size of sizes.length ? sizes : [1000, 10_000, 50_000, 100_000]) {
    await runSize(size);
  }
}

void main();
