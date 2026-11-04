// 媒体生命周期：软删除、恢复与彻底删除。
// 不加 `server-only`，`scripts/media-audit.ts` 和维护脚本会复用这里的规则。
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getStorageDriver, statStoredFile } from "@/lib/storage";
import { isTrashExpired, TRASH_RETENTION_MS } from "@/lib/trash";

/**
 * 一条媒体在业务表里可能被多种方式引用。
 *
 * 软删除会保留 EntryMedia / AlbumMedia / TripVisitPhoto / MediaTag，
 * 这样恢复后照片仍能回到原来的记录、相册和旅行。封面、头像、物品照片
 * 这类「字段只能指向一张图」的引用会先写入 deletedRefs 快照再清空，
 * 恢复时按快照写回，避免页面出现 404 图片。
 */
export type MediaReferenceCounts = {
  /** EntryMedia：记录正文里的照片，会阻止彻底删除 */
  entryPhotos: number;
  /** AlbumMedia：相册关联，彻底删除时级联移除，不阻止 */
  albumPhotos: number;
  /** TripVisitPhoto：旅行到访照片，会阻止彻底删除 */
  tripPhotos: number;
  /** User / FamilyProfile 头像，会阻止彻底删除 */
  avatars: number;
  /** Asset.photoMediaId：物品照片，会阻止彻底删除 */
  assetPhotos: number;
  /** Entry / Album / Trip 的封面字段，会阻止彻底删除 */
  covers: number;
  /** MediaTag：媒体自己的标签，随媒体一起删除，不阻止 */
  tags: number;
};

export type MediaFileKeys = {
  storageKey: string;
  thumbnailKey: string | null;
  displayKey: string | null;
  playbackKey: string | null;
};

/** 软删除时需要快照并清空的独占引用。 */
export type MediaDeletedRefs = {
  albumCovers: string[];
  entryCovers: string[];
  tripCovers: string[];
  userAvatars: string[];
  profileAvatars: string[];
  assetPhotos: string[];
};

const EMPTY_COUNTS: MediaReferenceCounts = {
  entryPhotos: 0,
  albumPhotos: 0,
  tripPhotos: 0,
  avatars: 0,
  assetPhotos: 0,
  covers: 0,
  tags: 0,
};

const EMPTY_DELETED_REFS: MediaDeletedRefs = {
  albumCovers: [],
  entryCovers: [],
  tripCovers: [],
  userAvatars: [],
  profileAvatars: [],
  assetPhotos: [],
};

/**
 * 会阻止彻底删除的引用总数。
 * 相册关联和标签属于媒体自身的整理关系，彻底删除时一并清理；
 * 记录、旅行、头像、物品和封面代表其他业务仍在使用这张照片。
 */
export function blockingReferenceCount(counts: MediaReferenceCounts): number {
  return (
    counts.entryPhotos +
    counts.tripPhotos +
    counts.avatars +
    counts.assetPhotos +
    counts.covers
  );
}

/**
 * 是否已经被任何业务或整理关系引用。
 * 上传页的“移除”用它判断这是本次新上传的文件，还是复用到的已有照片：
 * 已有照片即使出现在上传列表里，也不能因为用户点了移除就进入回收站。
 */
export function hasAnyMediaReference(counts: MediaReferenceCounts): boolean {
  return (
    counts.entryPhotos +
      counts.albumPhotos +
      counts.tripPhotos +
      counts.avatars +
      counts.assetPhotos +
      counts.covers +
      counts.tags >
    0
  );
}

/** 只描述真正阻止彻底删除的引用。 */
export function describeMediaReferences(counts: MediaReferenceCounts): string[] {
  const parts: string[] = [];
  if (counts.entryPhotos > 0) parts.push(`${counts.entryPhotos} 条记录`);
  if (counts.tripPhotos > 0) parts.push(`${counts.tripPhotos} 条旅行到访`);
  if (counts.avatars > 0) parts.push(`${counts.avatars} 个头像`);
  if (counts.assetPhotos > 0) parts.push(`${counts.assetPhotos} 件物品`);
  if (counts.covers > 0) parts.push(`${counts.covers} 个封面`);
  return parts;
}

/** 彻底删除会顺带清理、但不会阻止删除的关系。 */
export function describeMediaCascades(counts: MediaReferenceCounts): string[] {
  const parts: string[] = [];
  if (counts.albumPhotos > 0) parts.push(`${counts.albumPhotos} 个相册`);
  return parts;
}

export function parseDeletedRefs(raw: string | null | undefined): MediaDeletedRefs | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof MediaDeletedRefs, unknown>>;
    const read = (key: keyof MediaDeletedRefs): string[] => {
      const list = value?.[key];
      return Array.isArray(list)
        ? Array.from(new Set(list.filter((id): id is string => typeof id === "string" && id.length > 0)))
        : [];
    };
    return {
      albumCovers: read("albumCovers"),
      entryCovers: read("entryCovers"),
      tripCovers: read("tripCovers"),
      userAvatars: read("userAvatars"),
      profileAvatars: read("profileAvatars"),
      assetPhotos: read("assetPhotos"),
    };
  } catch {
    return null;
  }
}

export function serializeDeletedRefs(refs: MediaDeletedRefs): string {
  return JSON.stringify({
    albumCovers: Array.from(new Set(refs.albumCovers)),
    entryCovers: Array.from(new Set(refs.entryCovers)),
    tripCovers: Array.from(new Set(refs.tripCovers)),
    userAvatars: Array.from(new Set(refs.userAvatars)),
    profileAvatars: Array.from(new Set(refs.profileAvatars)),
    assetPhotos: Array.from(new Set(refs.assetPhotos)),
  });
}

function addCount(map: Map<string, number>, id: string | null, amount = 1): void {
  if (!id) return;
  map.set(id, (map.get(id) ?? 0) + amount);
}

function countRows(
  rows: Array<{ mediaId: string; _count: { _all: number } }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.mediaId, row._count._all);
  return counts;
}

/**
 * 批量统计引用，回收站列表不会为每张照片各查十次。
 * 记录/相册即使已删除也算引用，因为它们仍可恢复。
 */
export async function getMediaReferenceCounts(
  mediaIds: string[],
): Promise<Map<string, MediaReferenceCounts>> {
  const ids = Array.from(new Set(mediaIds.filter(Boolean)));
  const result = new Map<string, MediaReferenceCounts>();
  for (const id of ids) result.set(id, { ...EMPTY_COUNTS });
  if (ids.length === 0) return result;

  const [
    entryPhotos,
    albumPhotos,
    tripPhotos,
    tags,
    entryCovers,
    albumCovers,
    tripCovers,
    userAvatars,
    profileAvatars,
    assetPhotos,
  ] = await Promise.all([
    prisma.entryMedia.groupBy({
      by: ["mediaId"],
      where: { mediaId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.albumMedia.groupBy({
      by: ["mediaId"],
      where: { mediaId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.tripVisitPhoto.groupBy({
      by: ["mediaId"],
      where: { mediaId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.mediaTag.groupBy({
      by: ["mediaId"],
      where: { mediaId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.entry.findMany({
      where: { coverMediaId: { in: ids } },
      select: { coverMediaId: true },
    }),
    prisma.album.findMany({
      where: { coverMediaId: { in: ids } },
      select: { coverMediaId: true },
    }),
    prisma.trip.findMany({
      where: { coverMediaId: { in: ids } },
      select: { coverMediaId: true },
    }),
    prisma.user.findMany({
      where: { avatarMediaId: { in: ids } },
      select: { avatarMediaId: true },
    }),
    prisma.familyProfile.findMany({
      where: { avatarMediaId: { in: ids } },
      select: { avatarMediaId: true },
    }),
    prisma.asset.findMany({
      where: { photoMediaId: { in: ids } },
      select: { photoMediaId: true },
    }),
  ]);

  const entryPhotoCounts = countRows(entryPhotos);
  const albumPhotoCounts = countRows(albumPhotos);
  const tripPhotoCounts = countRows(tripPhotos);
  const tagCounts = countRows(tags);

  const coverCounts = new Map<string, number>();
  for (const row of [...entryCovers, ...albumCovers, ...tripCovers]) {
    addCount(coverCounts, row.coverMediaId);
  }

  const avatarCounts = new Map<string, number>();
  for (const row of [...userAvatars, ...profileAvatars]) {
    addCount(avatarCounts, row.avatarMediaId);
  }

  const assetCounts = new Map<string, number>();
  for (const row of assetPhotos) addCount(assetCounts, row.photoMediaId);

  for (const id of ids) {
    result.set(id, {
      entryPhotos: entryPhotoCounts.get(id) ?? 0,
      albumPhotos: albumPhotoCounts.get(id) ?? 0,
      tripPhotos: tripPhotoCounts.get(id) ?? 0,
      avatars: avatarCounts.get(id) ?? 0,
      assetPhotos: assetCounts.get(id) ?? 0,
      covers: coverCounts.get(id) ?? 0,
      tags: tagCounts.get(id) ?? 0,
    });
  }
  return result;
}

export async function getMediaReferenceCount(
  mediaId: string,
): Promise<MediaReferenceCounts> {
  return (await getMediaReferenceCounts([mediaId])).get(mediaId) ?? { ...EMPTY_COUNTS };
}

/** 原图 + 已生成的变体；去重后按记录里的存储后端统一清理。 */
export function mediaFileKeys(media: MediaFileKeys): string[] {
  const keys = [media.storageKey, media.thumbnailKey, media.displayKey, media.playbackKey];
  return Array.from(new Set(keys.filter((key): key is string => Boolean(key))));
}

/**
 * 彻底删除的文件顺序：先删可再生的变体，最后删原图。
 * 这样即使清理中途失败，原图通常还在，用户仍有机会恢复。
 */
export function mediaFilePurgeKeys(media: MediaFileKeys): string[] {
  const variants = [media.thumbnailKey, media.displayKey, media.playbackKey].filter(
    (key): key is string => Boolean(key) && key !== media.storageKey,
  );
  return Array.from(new Set([...variants, media.storageKey]));
}

/**
 * 读取并清空封面/头像/物品照片这些独占引用，返回快照。
 * 只清空指向这张媒体的字段，其他内容不动。
 */
async function snapshotExclusiveRefs(
  tx: Prisma.TransactionClient,
  mediaId: string,
): Promise<MediaDeletedRefs> {
  const [albums, entries, trips, users, profiles, assets] = await Promise.all([
    tx.album.findMany({ where: { coverMediaId: mediaId }, select: { id: true } }),
    tx.entry.findMany({ where: { coverMediaId: mediaId }, select: { id: true } }),
    tx.trip.findMany({ where: { coverMediaId: mediaId }, select: { id: true } }),
    tx.user.findMany({ where: { avatarMediaId: mediaId }, select: { id: true } }),
    tx.familyProfile.findMany({ where: { avatarMediaId: mediaId }, select: { id: true } }),
    tx.asset.findMany({ where: { photoMediaId: mediaId }, select: { id: true } }),
  ]);

  await Promise.all([
    tx.album.updateMany({ where: { coverMediaId: mediaId }, data: { coverMediaId: null } }),
    tx.entry.updateMany({ where: { coverMediaId: mediaId }, data: { coverMediaId: null } }),
    tx.trip.updateMany({ where: { coverMediaId: mediaId }, data: { coverMediaId: null } }),
    tx.user.updateMany({ where: { avatarMediaId: mediaId }, data: { avatarMediaId: null } }),
    tx.familyProfile.updateMany({
      where: { avatarMediaId: mediaId },
      data: { avatarMediaId: null },
    }),
    tx.asset.updateMany({ where: { photoMediaId: mediaId }, data: { photoMediaId: null } }),
  ]);

  return {
    albumCovers: albums.map((row) => row.id),
    entryCovers: entries.map((row) => row.id),
    tripCovers: trips.map((row) => row.id),
    userAvatars: users.map((row) => row.id),
    profileAvatars: profiles.map((row) => row.id),
    assetPhotos: assets.map((row) => row.id),
  };
}

/**
 * 恢复独占引用。只在字段仍为空时写回，删除期间用户新选的封面/头像
 * 不会被覆盖。相册和记录还必须保留关联，否则说明用户已经主动移除。
 */
async function restoreExclusiveRefs(
  tx: Prisma.TransactionClient,
  mediaId: string,
  refs: MediaDeletedRefs,
): Promise<void> {
  for (const albumId of refs.albumCovers) {
    const link = await tx.albumMedia.findUnique({
      where: { albumId_mediaId: { albumId, mediaId } },
      select: { albumId: true },
    });
    if (!link) continue;
    await tx.album.updateMany({
      where: { id: albumId, coverMediaId: null },
      data: { coverMediaId: mediaId },
    });
  }
  for (const entryId of refs.entryCovers) {
    const link = await tx.entryMedia.findUnique({
      where: { entryId_mediaId: { entryId, mediaId } },
      select: { entryId: true },
    });
    if (!link) continue;
    await tx.entry.updateMany({
      where: { id: entryId, coverMediaId: null },
      data: { coverMediaId: mediaId },
    });
  }
  for (const tripId of refs.tripCovers) {
    await tx.trip.updateMany({
      where: { id: tripId, coverMediaId: null },
      data: { coverMediaId: mediaId },
    });
  }
  if (refs.userAvatars.length > 0) {
    await tx.user.updateMany({
      where: { id: { in: refs.userAvatars }, avatarMediaId: null },
      data: { avatarMediaId: mediaId },
    });
  }
  if (refs.profileAvatars.length > 0) {
    await tx.familyProfile.updateMany({
      where: { id: { in: refs.profileAvatars }, avatarMediaId: null },
      data: { avatarMediaId: mediaId },
    });
  }
  if (refs.assetPhotos.length > 0) {
    await tx.asset.updateMany({
      where: { id: { in: refs.assetPhotos }, photoMediaId: null },
      data: { photoMediaId: mediaId },
    });
  }
}

/**
 * 软删除：保留原图和所有变体，保留记录、相册、旅行和标签关联，
 * 只清空封面/头像/物品照片字段并写入快照。恢复时照片能回到原来的
 * 位置，而不是只回到照片墙。
 */
export async function softDeleteMedia(mediaId: string, now = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.media.updateMany({
      where: { id: mediaId, status: "ACTIVE" },
      data: {
        status: "DELETED",
        deletedAt: now,
        deletedRefs: null,
        // 释放去重唯一键；恢复时不重新占用，避免与后来上传的同内容媒体冲突。
        dedupeScope: null,
        purgeError: null,
        purgeAttemptedAt: null,
        purgeStartedAt: null,
      },
    });
    if (claimed.count === 0) return;

    const refs = await snapshotExclusiveRefs(tx, mediaId);
    await tx.media.update({
      where: { id: mediaId },
      data: { deletedRefs: serializeDeletedRefs(refs) },
    });
  });
}

export type RestoreMediaResult = { ok: true } | { ok: false; error: string };

/**
 * 恢复前确认原图仍在，并检查 30 天保留期。彻底删除中途失败导致原图
 * 缺失时，不能把一条打不开的记录放回照片墙。
 */
export async function restoreMedia(
  mediaId: string,
  now = new Date(),
): Promise<RestoreMediaResult> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      status: true,
      deletedAt: true,
      deletedRefs: true,
      storageKey: true,
      storageDriver: true,
    },
  });
  if (!media) return { ok: false, error: "照片不存在" };
  if (media.status === "PURGING") {
    return { ok: false, error: "这张照片正在彻底删除，无法恢复" };
  }
  if (media.status !== "DELETED") return { ok: false, error: "这张照片不在回收站" };
  if (isTrashExpired(media.deletedAt, now)) {
    return { ok: false, error: "已超过 30 天保留期，无法恢复" };
  }

  const original = await statStoredFile(media.storageKey, media.storageDriver).catch(() => null);
  if (!original) {
    return { ok: false, error: "原文件已不存在，无法恢复" };
  }

  const refs = parseDeletedRefs(media.deletedRefs);
  // 上面的检查与这次更新之间可能已经过了保留期。把 30 天条件写进
  // updateMany，让“检查是否过期”和“恢复”成为同一个原子操作。
  const retentionCutoff = new Date(now.getTime() - TRASH_RETENTION_MS);
  const restored = await prisma.$transaction(async (tx) => {
    const claimed = await tx.media.updateMany({
      where: {
        id: mediaId,
        status: "DELETED",
        OR: [{ deletedAt: null }, { deletedAt: { gt: retentionCutoff } }],
      },
      data: {
        status: "ACTIVE",
        deletedAt: null,
        deletedRefs: null,
        purgeError: null,
        purgeAttemptedAt: null,
        purgeStartedAt: null,
      },
    });
    if (claimed.count === 0) return false;
    if (refs) await restoreExclusiveRefs(tx, mediaId, refs);
    return true;
  });

  if (!restored) {
    const current = await prisma.media.findUnique({
      where: { id: mediaId },
      select: { status: true, deletedAt: true },
    });
    if (current?.status === "DELETED" && isTrashExpired(current.deletedAt, now)) {
      return { ok: false, error: "已超过 30 天保留期，无法恢复" };
    }
    return { ok: false, error: "照片状态已变化，请刷新后重试" };
  }
  return { ok: true };
}

export type PurgeMediaResult =
  | { ok: true; removedKeys: number; skippedShared: number }
  | { ok: false; error: string };

/** 最终事务发现认领令牌已不属于自己时抛出，用于回滚整个事务。 */
class PurgeClaimLostError extends Error {
  constructor() {
    super("purge claim lost");
    this.name = "PurgeClaimLostError";
  }
}

function referenceBlockMessage(counts: MediaReferenceCounts): string {
  const parts = describeMediaReferences(counts);
  return parts.length
    ? `仍被 ${parts.join("、")} 引用，请先解除引用后再彻底删除`
    : "仍被其他数据引用，无法彻底删除";
}

/**
 * 同一组键可能被另一条 Media 记录共用（历史数据、手工修库）。
 * 文件级引用检查是最后一道保险：仍被别的记录使用的对象不能删。
 */
async function sharedFileKeys(mediaId: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await prisma.media.findMany({
    where: {
      id: { not: mediaId },
      OR: [
        { storageKey: { in: keys } },
        { thumbnailKey: { in: keys } },
        { displayKey: { in: keys } },
        { playbackKey: { in: keys } },
      ],
    },
    select: { storageKey: true, thumbnailKey: true, displayKey: true, playbackKey: true },
  });
  const shared = new Set<string>();
  for (const row of rows) {
    for (const key of [row.storageKey, row.thumbnailKey, row.displayKey, row.playbackKey]) {
      if (key && keys.includes(key)) shared.add(key);
    }
  }
  return shared;
}

/**
 * 彻底删除。只有已软删除的媒体能认领 PURGING；认领成功后其他恢复/
 * 清理请求都会被拒绝，避免「文件删了但记录又被恢复」。
 *
 * 失败时回到 DELETED 并记录 purgeError，文件和数据库行保持可重试；
 * 成功时先清理文件，再在一个事务里移除相册关联并删除数据库行。
 */
export async function purgeMedia(mediaId: string, now = new Date()): Promise<PurgeMediaResult> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      status: true,
      storageKey: true,
      storageDriver: true,
      thumbnailKey: true,
      displayKey: true,
      playbackKey: true,
    },
  });
  // 已经被另一次清理删掉：按幂等成功处理。
  if (!media) return { ok: true, removedKeys: 0, skippedShared: 0 };
  if (media.status === "ACTIVE") {
    return { ok: false, error: "请先把照片移到回收站，再彻底删除" };
  }
  if (media.status === "PURGING") {
    return { ok: false, error: "这张照片正在彻底删除，请稍后刷新" };
  }
  if (media.status !== "DELETED") {
    return { ok: false, error: "照片状态不允许彻底删除" };
  }

  // 认领时间使用真实当前时间，而不是批处理的起始时间：worker 一批
  // 可能处理很久，用旧时间认领会一创建就被超时恢复当成僵死任务。
  const claimStartedAt = new Date();
  const claimed = await prisma.media.updateMany({
    where: { id: mediaId, status: "DELETED" },
    data: {
      status: "PURGING",
      purgeStartedAt: claimStartedAt,
      purgeAttemptedAt: now,
      purgeError: null,
    },
  });
  if (claimed.count === 0) {
    return { ok: false, error: "照片状态已变化，请刷新后重试" };
  }

  // purgeStartedAt 同时是这次清理的认领令牌。每处理一个文件前续期；
  // 超时恢复任务只能重置仍停在旧时间戳的行，所以不会出现「任务还在删
  // 文件，行却已被放回 DELETED 并被用户恢复」的竞争。释放和最终删除
  // 都必须带上当前令牌，令牌不再是自己的就不能再改这一行。
  let claimToken = claimStartedAt;
  const stillOwnsClaim = async (): Promise<boolean> => {
    const renewedAt = new Date();
    const renewed = await prisma.media.updateMany({
      where: { id: mediaId, status: "PURGING", purgeStartedAt: claimToken },
      data: { purgeStartedAt: renewedAt },
    });
    if (renewed.count !== 1) return false;
    claimToken = renewedAt;
    return true;
  };
  const claimLost = (): PurgeMediaResult => ({
    ok: false,
    error: "清理任务已被其他任务接管，请刷新后重试",
  });

  const release = async (rawError: string): Promise<PurgeMediaResult> => {
    const error = rawError.slice(0, 500);
    console.error("[media purge] 彻底删除失败", mediaId, error);
    try {
      const released = await prisma.media.updateMany({
        where: { id: mediaId, status: "PURGING", purgeStartedAt: claimToken },
        data: {
          status: "DELETED",
          purgeStartedAt: null,
          purgeError: error,
          purgeAttemptedAt: now,
        },
      });
      // 令牌已经不属于自己（被超时恢复或另一次清理接管），不能回写状态。
      if (released.count === 0) return claimLost();
    } catch (writeError) {
      console.error("[media purge] 无法记录失败原因", mediaId, writeError);
    }
    return { ok: false, error };
  };

  const references = await getMediaReferenceCount(mediaId);
  if (blockingReferenceCount(references) > 0) {
    return release(referenceBlockMessage(references));
  }

  let driver: Awaited<ReturnType<typeof getStorageDriver>>;
  try {
    driver = await getStorageDriver(media.storageDriver);
  } catch (error) {
    return release(
      `存储后端不可用：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const keys = mediaFilePurgeKeys(media);
  const shared = await sharedFileKeys(mediaId, keys);
  const removable = keys.filter((key) => !shared.has(key));
  const failures: string[] = [];
  for (const key of removable) {
    // 每个文件删除前续期。若恢复任务已把这一行放回 DELETED，立刻停手，
    // 不再继续删除原图。
    if (!(await stillOwnsClaim())) return claimLost();
    try {
      await driver.remove(key);
    } catch (error) {
      failures.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length > 0) {
    return release(
      `有 ${failures.length}/${removable.length} 个文件清理失败，可重试：${failures[0]}`,
    );
  }

  // 文件清理期间如果又出现了新的业务引用，不能删除数据库行。
  if (!(await stillOwnsClaim())) return claimLost();
  const latest = await getMediaReferenceCount(mediaId);
  if (blockingReferenceCount(latest) > 0) {
    return release(referenceBlockMessage(latest));
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 先按令牌删除并检查影响行数：只有真正删掉自己认领的那一行，
      // 才能报告彻底删除成功。行数不是 1 说明恢复或超时回收已经接管，
      // 抛出后事务回滚，下面的关联也不会被清理。
      const deleted = await tx.media.deleteMany({
        where: { id: mediaId, status: "PURGING", purgeStartedAt: claimToken },
      });
      if (deleted.count !== 1) throw new PurgeClaimLostError();

      // 相册关联属于媒体自身的整理关系，彻底删除时级联移除。
      await tx.albumMedia.deleteMany({ where: { mediaId } });
      await tx.album.updateMany({ where: { coverMediaId: mediaId }, data: { coverMediaId: null } });
      // 下面这些字段在软删除时已清空；这里再兜底一次，避免历史数据残留。
      await tx.entry.updateMany({ where: { coverMediaId: mediaId }, data: { coverMediaId: null } });
      await tx.trip.updateMany({ where: { coverMediaId: mediaId }, data: { coverMediaId: null } });
      await tx.user.updateMany({ where: { avatarMediaId: mediaId }, data: { avatarMediaId: null } });
      await tx.familyProfile.updateMany({
        where: { avatarMediaId: mediaId },
        data: { avatarMediaId: null },
      });
      await tx.asset.updateMany({ where: { photoMediaId: mediaId }, data: { photoMediaId: null } });
    });
  } catch (error) {
    if (error instanceof PurgeClaimLostError) return claimLost();
    return release(
      `数据库清理失败，可重试：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return { ok: true, removedKeys: removable.length, skippedShared: shared.size };
}

/** 供回收站页面展示：旧版本删除的媒体没有快照，关系无法重建。 */
export function hasLegacyDeletedRefs(deletedRefs: string | null): boolean {
  return deletedRefs === null;
}

export { EMPTY_DELETED_REFS };
