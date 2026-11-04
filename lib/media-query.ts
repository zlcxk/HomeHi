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

/**
 * 用游标行的排序值做 keyset 查询。Prisma 自带的 cursor 会生成多重 OR 子查询，
 * 十万级数据下无法稳定命中索引；这里手工拆成“非空拍摄时间”和“空拍摄时间”
 * 两段，前者耗尽后再接上后者，顺序仍是 [takenAt desc, createdAt desc, id desc]。
 */
async function queryMediaPage(
  viewer: MediaViewer,
  base: Prisma.MediaWhereInput,
  cursorParam: string | null | undefined,
  timezone: string,
): Promise<MediaPage> {
  const cursor = normalizeMediaCursor(cursorParam);
  const anchor = cursor
    ? await prisma.media.findFirst({
        // 锚点也必须在当前用户可见范围内，不能用别人的私有照片定位。
        where: { AND: [mediaWhere(viewer), { id: cursor }] },
        select: { id: true, takenAt: true, createdAt: true },
      })
    : null;
  // 游标对应的媒体已被删除或不可见时没有可续接的位置，避免从头重复返回。
  if (cursor && !anchor) return { items: [], nextCursor: null };

  let rows: MediaGridRow[] = [];
  if (!anchor) {
    rows = await prisma.media.findMany({
      where: base,
      orderBy: mediaOrderBy(),
      take: MEDIA_PAGE_SIZE + 1,
      select: MEDIA_GRID_SELECT,
    });
  } else if (anchor.takenAt) {
    const takenAt = anchor.takenAt;
    rows = await prisma.media.findMany({
      where: {
        AND: [
          base,
          {
            OR: [
              { takenAt: { lt: takenAt } },
              { takenAt, createdAt: { lt: anchor.createdAt } },
              { takenAt, createdAt: anchor.createdAt, id: { lt: anchor.id } },
            ],
          },
        ],
      },
      orderBy: mediaOrderBy(),
      take: MEDIA_PAGE_SIZE + 1,
      select: MEDIA_GRID_SELECT,
    });
    // 非空拍摄时间已到末尾时，NULL 组按 createdAt 继续。
    if (rows.length <= MEDIA_PAGE_SIZE) {
      const rest = await prisma.media.findMany({
        where: { AND: [base, { takenAt: null }] },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: MEDIA_PAGE_SIZE + 1 - rows.length,
        select: MEDIA_GRID_SELECT,
      });
      rows = [...rows, ...rest];
    }
  } else {
    rows = await prisma.media.findMany({
      where: {
        AND: [
          base,
          {
            takenAt: null,
            OR: [
              { createdAt: { lt: anchor.createdAt } },
              { createdAt: anchor.createdAt, id: { lt: anchor.id } },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MEDIA_PAGE_SIZE + 1,
      select: MEDIA_GRID_SELECT,
    });
  }

  const hasMore = rows.length > MEDIA_PAGE_SIZE;
  const page = rows.slice(0, MEDIA_PAGE_SIZE);
  return {
    items: page.map((row) => toGridItem(row, timezone)),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}

export async function getPhotoMediaPage(
  viewer: MediaViewer,
  timezone: string,
  options: { view?: MediaListView; cursor?: string | null } = {},
): Promise<MediaPage> {
  const base: Prisma.MediaWhereInput = {
    ...mediaWhere(viewer),
    ...(options.view === "videos" ? { mediaType: "VIDEO" } : {}),
    ...(options.view === "favorites" ? { favorite: true } : {}),
  };
  return queryMediaPage(viewer, base, options.cursor, timezone);
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
  const anchor = cursor
    ? await prisma.albumMedia.findFirst({
        where: {
          albumId,
          mediaId: cursor,
          media: {
            householdId: viewer.householdId,
            status: "ACTIVE",
            OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: viewer.userId }],
          },
        },
        select: { sortOrder: true, mediaId: true },
      })
    : null;
  if (cursor && !anchor) return { items: [], nextCursor: null };

  const rows = await prisma.albumMedia.findMany({
    where: {
      albumId,
      media: {
        householdId: viewer.householdId,
        status: "ACTIVE",
        OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: viewer.userId }],
      },
      ...(anchor
        ? {
            OR: [
              { sortOrder: { gt: anchor.sortOrder } },
              { sortOrder: anchor.sortOrder, mediaId: { gt: anchor.mediaId } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { mediaId: "asc" }],
    take: MEDIA_PAGE_SIZE + 1,
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
  return queryMediaPage(
    viewer,
    { ...mediaWhere(viewer), albumLinks: { none: { albumId } } },
    cursorParam,
    timezone,
  );
}

/** 相册数量上限：超过 1000 后只显示“1000+”，避免十万级相册每次全量计数。 */
export const ALBUM_MEDIA_COUNT_CAP = 1000;

export async function countAlbumMedia(
  viewer: MediaViewer,
  albumId: string,
): Promise<{ count: number; capped: boolean }> {
  const rows = await prisma.albumMedia.findMany({
    where: {
      albumId,
      media: {
        householdId: viewer.householdId,
        status: "ACTIVE",
        OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: viewer.userId }],
      },
    },
    take: ALBUM_MEDIA_COUNT_CAP + 1,
    select: { mediaId: true },
  });
  return {
    count: Math.min(rows.length, ALBUM_MEDIA_COUNT_CAP),
    capped: rows.length > ALBUM_MEDIA_COUNT_CAP,
  };
}
