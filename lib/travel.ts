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

/** 这些协议会在浏览器里执行代码或跳出应用，不保存。 */
const BLOCKED_LINK_PROTOCOLS = new Set(["javascript:", "data:", "vbscript:", "file:", "blob:"]);

/**
 * 旅行链接可以是网页、微信小程序分享链接，或其他 App 的深链接。
 * 小程序的分享文案形如「博物馆预约 #小程序://博物馆预约/abc123」，所以先从整段文案里取出链接。
 * 网页链接会补全并规范化；深链接（如 weixin://）原样保存，页面上只提供复制。
 */
export function normalizeTripLink(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const miniprogram = raw.match(/#小程序:\/\/\S+/);
  if (miniprogram) return miniprogram[0];

  const scheme = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (scheme) {
    const protocol = `${scheme[1].toLowerCase()}:`;
    if (BLOCKED_LINK_PROTOCOLS.has(protocol)) return null;
    if (protocol !== "http:" && protocol !== "https:") return raw;
  }

  const candidate = scheme ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export type TripLinkKind = "WEB" | "MINIPROGRAM" | "APP";

/** 网页可以安全地新窗口打开；小程序和 App 深链接只能复制后在对应 App 里打开。 */
export function tripLinkKind(url: string): TripLinkKind {
  if (url.includes("小程序://")) return "MINIPROGRAM";
  if (/^https?:/i.test(url)) return "WEB";
  return "APP";
}

export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** 链接下方的说明文字：网页显示域名，小程序和深链接显示来源。 */
export function linkLabel(url: string): string {
  const kind = tripLinkKind(url);
  if (kind === "MINIPROGRAM") return "微信小程序 · 复制后在微信中打开";
  if (kind === "WEB") return linkHost(url);
  const scheme = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return scheme ? `${scheme[1].toLowerCase()} 链接` : url;
}

/** 高德选点带回的坐标，缺一个或超出范围就当作没有。 */
export function parseCoordinates(
  latitude: string,
  longitude: string,
): { latitude: number; longitude: number } | null {
  if (!latitude.trim() || !longitude.trim()) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng };
}

/** 在高德地图里查看这个点（手机上会唤起高德 App）。 */
export function amapMarkerUrl(latitude: number, longitude: number, name: string): string {
  const params = new URLSearchParams({
    position: `${longitude},${latitude}`,
    name,
    coordinate: "gaode",
    callnative: "1",
  });
  return `https://uri.amap.com/marker?${params.toString()}`;
}
