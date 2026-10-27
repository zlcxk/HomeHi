import { prisma } from "@/lib/db";

export const TOPIC_STANCES = [
  { value: "AGREE", label: "赞成", tone: "bg-sage-soft text-sage" },
  { value: "NEUTRAL", label: "再看看", tone: "bg-raised text-muted" },
  { value: "CONCERN", label: "有顾虑", tone: "bg-accent-soft text-accent" },
] as const;

export function stanceLabel(value: string): string {
  return TOPIC_STANCES.find((item) => item.value === value)?.label || "再看看";
}

export function stanceTone(value: string): string {
  return TOPIC_STANCES.find((item) => item.value === value)?.tone || "bg-raised text-muted";
}

export type TrendItem = {
  title: string;
  url: string;
  platform: string | null;
  author: string | null;
  heat: string | null;
  summary: string | null;
  coverUrl: string | null;
  publishedAt: Date | null;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function readFromNested(record: UnknownRecord, keys: string[], nestedKeys: string[]): string {
  const direct = readString(record, keys);
  if (direct) return direct;
  for (const nestedKey of nestedKeys) {
    const nested = record[nestedKey];
    if (isRecord(nested)) {
      const value = readString(nested, keys);
      if (value) return value;
    }
  }
  return "";
}

function normalizePlatform(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const map: Record<string, string> = {
    xhs: "小红书",
    xiaohongshu: "小红书",
    dy: "抖音",
    douyin: "抖音",
    bili: "B站",
    bilibili: "B站",
    wb: "微博",
    weibo: "微博",
    zhihu: "知乎",
    ks: "快手",
    kuaishou: "快手",
    tieba: "贴吧",
  };
  return map[raw.toLowerCase()] || raw;
}

function formatHeat(value: string): string | null {
  if (!value) return null;
  const numeric = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return value.slice(0, 24);
  if (numeric >= 100_000_000) return `${Math.round(numeric / 10_000_000) / 10}亿`;
  if (numeric >= 10_000) return `${Math.round(numeric / 1_000) / 10}万`;
  return String(Math.round(numeric));
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  if (/^\d{10}$/.test(value)) return new Date(Number(value) * 1000);
  if (/^\d{13}$/.test(value)) return new Date(Number(value));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readCover(value: unknown): string {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = readCover(item);
      if (nested) return nested;
    }
  }
  if (isRecord(value)) return readCover(value.url || value.url_default || value.cover);
  return "";
}

function normalizeItem(raw: unknown): TrendItem | null {
  if (!isRecord(raw)) return null;

  // 不同爬虫平台会把内容包在 note_card / aweme_info 等字段里。
  const record: UnknownRecord = {
    ...raw,
    ...(isRecord(raw.note_card) ? raw.note_card : {}),
    ...(isRecord(raw.aweme_info) ? raw.aweme_info : {}),
  };

  const url = readFromNested(
    record,
    ["url", "note_url", "share_url", "web_url", "link", "aweme_url"],
    ["note_card"],
  );
  if (!/^https?:\/\//i.test(url)) return null;

  const title =
    readFromNested(record, ["title", "note_title", "name"], ["note_card"]) ||
    readFromNested(record, ["desc", "content", "text"], ["note_card"]).slice(0, 80);
  if (!title) return null;

  const summaryRaw = readFromNested(
    record,
    ["summary", "description", "desc", "content", "text"],
    ["note_card"],
  );
  const summary = summaryRaw && summaryRaw !== title ? summaryRaw.slice(0, 240) : null;

  const heatRaw = readString(record, [
    "heat",
    "hot",
    "score",
    "liked_count",
    "like_count",
    "likes",
    "digg_count",
    "view_count",
    "play_count",
  ]);

  return {
    title: title.slice(0, 160),
    url,
    platform: normalizePlatform(readString(record, ["platform", "source", "channel"])),
    author: readFromNested(record, ["author", "nickname", "user_name", "screen_name"], ["user"]) || null,
    heat: formatHeat(heatRaw),
    summary,
    coverUrl:
      readCover(record.cover_url || record.coverUrl || record.cover || record.image_list || record.images) ||
      null,
    publishedAt: parseDate(
      readString(record, ["published_at", "publish_time", "create_time", "created_at", "time"]),
    ),
  };
}

export type TrendFetchResult = {
  configured: boolean;
  items: TrendItem[];
  error: boolean;
};

export async function fetchTopicTrends(keyword: string, limit = 10): Promise<TrendFetchResult> {
  const endpoint = process.env.MEDIA_CRAWLER_URL?.trim();
  if (!endpoint) return { configured: false, items: [], error: false };

  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad protocol");
  } catch {
    return { configured: true, items: [], error: true };
  }

  url.searchParams.set("keyword", keyword.slice(0, 60));
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 20)));

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = process.env.MEDIA_CRAWLER_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { configured: true, items: [], error: true };

    const text = await response.text();
    if (text.length > 1_500_000) return { configured: true, items: [], error: true };

    const payload = JSON.parse(text) as unknown;
    let rows: unknown[] = [];
    if (Array.isArray(payload)) rows = payload;
    else if (isRecord(payload)) {
      if (Array.isArray(payload.items)) rows = payload.items;
      else if (Array.isArray(payload.results)) rows = payload.results;
      else if (Array.isArray(payload.data)) rows = payload.data;
      else if (isRecord(payload.data)) {
        if (Array.isArray(payload.data.items)) rows = payload.data.items;
        else if (Array.isArray(payload.data.results)) rows = payload.data.results;
      }
    }

    const seen = new Set<string>();
    const items: TrendItem[] = [];
    for (const row of rows) {
      const item = normalizeItem(row);
      if (!item || seen.has(item.url)) continue;
      seen.add(item.url);
      items.push(item);
      if (items.length >= limit) break;
    }
    return { configured: true, items, error: false };
  } catch {
    return { configured: true, items: [], error: true };
  }
}

export async function replaceTopicTrends(topicId: string, items: TrendItem[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.topicContent.deleteMany({ where: { topicId } });
    for (const [index, item] of items.entries()) {
      await tx.topicContent.create({
        data: {
          topicId,
          title: item.title,
          url: item.url,
          platform: item.platform,
          author: item.author,
          heat: item.heat,
          summary: item.summary,
          coverUrl: item.coverUrl,
          publishedAt: item.publishedAt,
          sortOrder: index,
        },
      });
    }
    await tx.topic.update({
      where: { id: topicId },
      data: { trendsFetchedAt: new Date() },
    });
  });
}
