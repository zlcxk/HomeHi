/**
 * 旅行的展示文案和小工具。这里不引入服务端依赖，客户端表单也能复用。
 */

export const TRIP_KINDS = [
  { value: "SINGLE", label: "单次旅行", hint: "一次具体的出行，带起止日期" },
  { value: "THEME", label: "主题旅行", hint: "长期打卡同一个主题，比如全国博物馆" },
] as const;

export const TRIP_STATUSES = [
  { value: "PLANNING", label: "计划中" },
  { value: "ONGOING", label: "在路上" },
  { value: "DONE", label: "已完成" },
] as const;

export type TripKind = (typeof TRIP_KINDS)[number]["value"];
export type TripStatus = (typeof TRIP_STATUSES)[number]["value"];

export function tripKindLabel(kind: string): string {
  return TRIP_KINDS.find((item) => item.value === kind)?.label ?? "旅行";
}

export function tripStatusLabel(status: string): string {
  return TRIP_STATUSES.find((item) => item.value === status)?.label ?? "计划中";
}

export type TripProgress = {
  total: number;
  visited: number;
  percent: number;
};

/** 主题进度：有到访记录的地点算已打卡。 */
export function tripProgress(places: { visits: { id: string }[] }[]): TripProgress {
  const total = places.length;
  const visited = places.filter((place) => place.visits.length > 0).length;
  return {
    total,
    visited,
    percent: total === 0 ? 0 : Math.round((visited / total) * 100),
  };
}

/** 城市/地区去重，用来概述"走过 8 个城市"。 */
export function tripRegions(places: { region: string | null; visits: { id: string }[] }[]): string[] {
  const seen = new Set<string>();
  for (const place of places) {
    const region = place.region?.trim();
    if (region) seen.add(region);
  }
  return [...seen];
}

/** 只接受 http/https，避免把 javascript: 之类的地址写进数据库。 */
export function normalizeExternalUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
