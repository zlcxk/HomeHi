/** 媒体列表在服务端和客户端之间传输的最小字段。 */

import { DateTime } from "luxon";

export const MEDIA_PAGE_SIZE = 30;

export type MediaGridItem = {
  id: string;
  mediaType: string;
  thumbUrl: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  favorite: boolean;
  /** 服务端按家庭时区算好的“2026年11月”，客户端直接分组。 */
  groupLabel: string;
};

export type MediaListResponse = {
  items: MediaGridItem[];
  nextCursor: string | null;
};

export type MediaListView = "all" | "favorites" | "videos";

export function normalizeMediaListView(value: string | null | undefined): MediaListView {
  if (value === "favorites" || value === "videos") return value;
  return "all";
}

/** 只接受 cuid 形态的游标，避免把任意字符串带进数据库。 */
export function normalizeMediaCursor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(trimmed) ? trimmed : null;
}

/** 拍摄时间缺失时回退到上传时间；两者都按家庭时区分组。 */
export function mediaGroupLabel(
  takenAt: Date | null,
  createdAt: Date,
  timezone: string,
): string {
  return DateTime.fromJSDate(takenAt ?? createdAt)
    .setZone(timezone)
    .setLocale("zh-CN")
    .toFormat("yyyy年M月");
}

/** 按 id 去重追加，避免分页边界或并发上传产生重复卡片。 */
export function appendUniqueMedia(
  existing: MediaGridItem[],
  incoming: MediaGridItem[],
): MediaGridItem[] {
  const seen = new Set(existing.map((item) => item.id));
  const appended = incoming.filter((item) => !seen.has(item.id));
  return appended.length ? [...existing, ...appended] : existing;
}
