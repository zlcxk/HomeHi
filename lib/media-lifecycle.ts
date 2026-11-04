// 媒体生命周期：软删除、恢复与彻底删除。
// 不加 `server-only`，`scripts/media-audit.ts` 等维护脚本会复用这里的规则。
import { prisma } from "@/lib/db";
import { getStorageDriver, statStoredFile } from "@/lib/storage";

/**
 * 一条媒体在业务表里可能被多种方式引用。软删除只隐藏媒体、清理相册关联，
 * 但保留文件；彻底删除前必须确认下面这些引用都已解除。
 */
export type MediaReferenceCounts = {
  /** EntryMedia：记录正文里的照片 */
  entryPhotos: number;
  /** AlbumMedia：相册关联 */
  albumPhotos: number;
  /** TripVisitPhoto：旅行到访照片 */
  tripPhotos: number;
  /** User / FamilyProfile 头像 */
  avatars: number;
  /** Asset.photoMediaId：物品照片 */
  assetPhotos: number;
  /** Entry / Album / Trip 的封面字段 */
  covers: number;
  /** MediaTag：媒体自己的标签，随媒体一起删除，不阻止彻底删除 */
  tags: number;
};

export type MediaFileKeys = {
  storageKey: string;
  thumbnailKey: string | null;
  displayKey: string | null;
  playbackKey: string | null;
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

/** 会阻止彻底删除的引用总数；标签属于媒体自身，不计入。 */
export function blockingReferenceCount(counts: MediaReferenceCounts): number {
  return (
    counts.entryPhotos +
    counts.albumPhotos +
    counts.tripPhotos +
    counts.avatars +
    counts.assetPhotos +
    counts.covers
  );
}

export function describeMediaReferences(counts: MediaReferenceCounts): string[] {
  const parts: string[] = [];
  if (counts.entryPhotos > 0) parts.push(`${counts.entryPhotos} 条记录`);
  if (counts.albumPhotos > 0) parts.push(`${counts.albumPhotos} 个相册`);
  if (counts.tripPhotos > 0) parts.push(`${counts.tripPhotos} 条旅行到访`);
  if (counts.avatars > 0) parts.push(`${counts.avatars} 个头像`);
  if (counts.assetPhotos > 0) parts.push(`${counts.assetPhotos} 件物品`);
  if (counts.covers > 0) parts.push(`${counts.covers} 个封面`);
  return parts;
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
 * 软删除：保留原图和所有变体，只让媒体从照片墙、相册和资料中消失。
 * 记录/旅行里的关联保留，恢复后还能回到原来的位置；相册关联和封面
 * 在删除时解除，避免相册出现打不开的封面。
 */
export async function softDeleteMedia(mediaId: string): Promise<void> {
  const deletedAt = new Date();
  await prisma.$transaction([
    prisma.albumMedia.deleteMany({ where: { mediaId } }),
    prisma.album.updateMany({
      where: { coverMediaId: mediaId },
      data: { coverMediaId: null },
    }),
    prisma.entry.updateMany({
      where: { coverMediaId: mediaId },
      data: { coverMediaId: null },
    }),
    prisma.trip.updateMany({
      where: { coverMediaId: mediaId },
      data: { coverMediaId: null },
    }),
    prisma.user.updateMany({
      where: { avatarMediaId: mediaId },
      data: { avatarMediaId: null },
    }),
    prisma.familyProfile.updateMany({
      where: { avatarMediaId: mediaId },
      data: { avatarMediaId: null },
    }),
    prisma.asset.updateMany({
      where: { photoMediaId: mediaId },
      data: { photoMediaId: null },
    }),
    prisma.media.update({
      where: { id: mediaId },
      data: {
        status: "DELETED",
        deletedAt,
        // 释放去重唯一键；恢复时不重新占用，避免与后来上传的同内容媒体冲突。
        dedupeScope: null,
        purgeError: null,
        purgeAttemptedAt: null,
      },
    }),
  ]);
}

export type RestoreMediaResult = { ok: true } | { ok: false; error: string };

/**
 * 恢复前确认原图仍在。若彻底删除中途失败导致文件已缺失，不能把一条
 * 打不开的记录放回照片墙。
 */
export async function restoreMedia(mediaId: string): Promise<RestoreMediaResult> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true, status: true, storageKey: true, storageDriver: true },
  });
  if (!media) return { ok: false, error: "照片不存在" };
  if (media.status !== "DELETED") return { ok: false, error: "这张照片不在回收站" };

  const original = await statStoredFile(media.storageKey, media.storageDriver).catch(() => null);
  if (!original) {
    return { ok: false, error: "原文件已不存在，无法恢复" };
  }

  await prisma.media.update({
    where: { id: mediaId },
    data: {
      status: "ACTIVE",
      deletedAt: null,
      purgeError: null,
      purgeAttemptedAt: null,
    },
  });
  return { ok: true };
}

export type PurgeMediaResult =
  | { ok: true; removedKeys: number }
  | { ok: false; error: string };

async function recordPurgeFailure(mediaId: string, error: string): Promise<void> {
  const message = error.slice(0, 500);
  console.error("[media purge] 彻底删除失败", mediaId, message);
  await prisma.media
    .update({
      where: { id: mediaId },
      data: { purgeError: message, purgeAttemptedAt: new Date() },
    })
    .catch((writeError) => {
      console.error("[media purge] 无法记录失败原因", mediaId, writeError);
    });
}

function referenceBlockMessage(counts: MediaReferenceCounts): string {
  const parts = describeMediaReferences(counts);
  return parts.length
    ? `仍被 ${parts.join("、")} 引用，请先解除引用后再彻底删除`
    : "仍被其他数据引用，无法彻底删除";
}

/**
 * 彻底删除：只有已软删除、且没有任何业务引用的媒体才能走到这里。
 * 先清理原图/缩略图/展示图/播放版，再删数据库行；任一文件清理失败都
 * 保留记录和错误信息，用户可以重试。
 */
export async function purgeMedia(mediaId: string): Promise<PurgeMediaResult> {
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
  if (!media) return { ok: false, error: "照片不存在" };
  if (media.status !== "DELETED") {
    return { ok: false, error: "请先把照片移到回收站，再彻底删除" };
  }

  const references = await getMediaReferenceCount(mediaId);
  if (blockingReferenceCount(references) > 0) {
    const error = referenceBlockMessage(references);
    await recordPurgeFailure(mediaId, error);
    return { ok: false, error };
  }

  const keys = mediaFileKeys(media);
  let driver: Awaited<ReturnType<typeof getStorageDriver>>;
  try {
    driver = await getStorageDriver(media.storageDriver);
  } catch (error) {
    const message = `存储后端不可用：${error instanceof Error ? error.message : String(error)}`;
    await recordPurgeFailure(mediaId, message);
    return { ok: false, error: message };
  }

  const failures: string[] = [];
  for (const key of keys) {
    try {
      await driver.remove(key);
    } catch (error) {
      failures.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length > 0) {
    const error = `有 ${failures.length}/${keys.length} 个文件清理失败，可重试：${failures[0]}`;
    await recordPurgeFailure(mediaId, error);
    return { ok: false, error };
  }

  // 文件清理期间如果又出现了新的业务引用，不能删除数据库行。
  const latest = await getMediaReferenceCount(mediaId);
  if (blockingReferenceCount(latest) > 0) {
    const error = referenceBlockMessage(latest);
    await recordPurgeFailure(mediaId, error);
    return { ok: false, error };
  }

  try {
    await prisma.media.delete({ where: { id: mediaId } });
  } catch (error) {
    // 另一次彻底删除已经移除了这一行：文件同样已清理，视为成功。
    if ((error as { code?: string }).code === "P2025") {
      return { ok: true, removedKeys: keys.length };
    }
    throw error;
  }
  return { ok: true, removedKeys: keys.length };
}
