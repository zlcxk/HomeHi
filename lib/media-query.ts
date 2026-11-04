import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { mediaWhere } from "@/lib/access";
import {
  MEDIA_PAGE_SIZE,
  type MediaGridItem,
  type MediaListView,
  mediaGroupLabel,
  normalizeMediaCursor,
} from "@/lib/media-list";

export type MediaViewer = { userId: string; householdId: string };

export const MEDIA_GRID_SELECT = {
  id: true,
  mediaType: true,
  thumbnailKey: true,
  caption: true,
  width: true,
  height: true,
  durationSeconds: true,
  favorite: true,
  takenAt: true,
  createdAt: true,
} satisfies Prisma.MediaSelect;

type MediaGridRow = Prisma.MediaGetPayload<{ select: typeof MEDIA_GRID_SELECT }>;

export function toGridItem(row: MediaGridRow, timezone: string): MediaGridItem {
  return {
    id: row.id,
    mediaType: row.mediaType,
    thumbUrl:
      row.thumbnailKey || row.mediaType === "IMAGE"
        ? `/api/media/${row.id}/thumb?v=${encodeURIComponent(row.thumbnailKey || "0")}`
        : null,
    caption: row.caption,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds,
    favorite: row.favorite,
    groupLabel: mediaGroupLabel(row.takenAt, row.createdAt, timezone),
  };
}

function mediaOrderBy(): Prisma.MediaOrderByWithRelationInput[] {
  return [{ takenAt: "desc" }, { createdAt: "desc" }, { id: "desc" }];
}

export type MediaPage = {
  items: MediaGridItem[];
  nextCursor: string | null;
};

export async function getPhotoMediaPage(
  viewer: MediaViewer,
  timezone: string,
  options: { view?: MediaListView; cursor?: string | null } = {},
): Promise<MediaPage> {
  const cursor = normalizeMediaCursor(options.cursor);
  const where: Prisma.MediaWhereInput = {
    ...mediaWhere(viewer),
    ...(options.view === "videos" ? { mediaType: "VIDEO" } : {}),
    ...(options.view === "favorites" ? { favorite: true } : {}),
  };

  const rows = await prisma.media.findMany({
    where,
    orderBy: mediaOrderBy(),
    take: MEDIA_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: MEDIA_GRID_SELECT,
  });

  const hasMore = rows.length > MEDIA_PAGE_SIZE;
  const page = rows.slice(0, MEDIA_PAGE_SIZE);
  return {
    items: page.map((row) => toGridItem(row, timezone)),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}

/**
 * 相册内保持用户自定义 sortOrder；用 [albumId, mediaId] 复合游标分页，
 * 不对整个相册做 offset 查询。
 */
export async function getAlbumMediaPage(
  viewer: MediaViewer,
  albumId: string,
  timezone: string,
  cursorParam?: string | null,
): Promise<MediaPage> {
  const cursor = normalizeMediaCursor(cursorParam);
  const rows = await prisma.albumMedia.findMany({
    where: {
      albumId,
      media: {
        householdId: viewer.householdId,
        status: "ACTIVE",
        OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: viewer.userId }],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { mediaId: "asc" }],
    take: MEDIA_PAGE_SIZE + 1,
    ...(cursor
      ? { cursor: { albumId_mediaId: { albumId, mediaId: cursor } }, skip: 1 }
      : {}),
    select: { media: { select: MEDIA_GRID_SELECT } },
  });

  const hasMore = rows.length > MEDIA_PAGE_SIZE;
  const page = rows.slice(0, MEDIA_PAGE_SIZE);
  return {
    items: page.map((row) => toGridItem(row.media, timezone)),
    nextCursor: hasMore ? page[page.length - 1]?.media.id ?? null : null,
  };
}

/** 相册添加页：只查尚未加入该相册、且当前用户可见的媒体。 */
export async function getAlbumPickerPage(
  viewer: MediaViewer,
  albumId: string,
  timezone: string,
  cursorParam?: string | null,
): Promise<MediaPage> {
  const cursor = normalizeMediaCursor(cursorParam);
  const rows = await prisma.media.findMany({
    where: {
      ...mediaWhere(viewer),
      albumLinks: { none: { albumId } },
    },
    orderBy: mediaOrderBy(),
    take: MEDIA_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: MEDIA_GRID_SELECT,
  });

  const hasMore = rows.length > MEDIA_PAGE_SIZE;
  const page = rows.slice(0, MEDIA_PAGE_SIZE);
  return {
    items: page.map((row) => toGridItem(row, timezone)),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}

export async function countAlbumMedia(viewer: MediaViewer, albumId: string): Promise<number> {
  return prisma.albumMedia.count({
    where: {
      albumId,
      media: {
        householdId: viewer.householdId,
        status: "ACTIVE",
        OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: viewer.userId }],
      },
    },
  });
}
