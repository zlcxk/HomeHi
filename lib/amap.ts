const AMAP_ENDPOINT = process.env.AMAP_API_BASE?.replace(/\/+$/, "") || "https://restapi.amap.com";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_LIMIT = 120;

export type LocationSuggestion = {
  id: string;
  name: string;
  address: string;
  district: string;
  /** 带省市的完整地址，用于辅助判断重名地点 */
  fullAddress: string;
  province: string;
  city: string;
  /** 高德返回的经纬度（GCJ-02），部分 POI 可能没有 */
  latitude: number | null;
  longitude: number | null;
};

type CacheEntry = { expiresAt: number; results: LocationSuggestion[] };
const cache = new Map<string, CacheEntry>();

export function amapConfigured(): boolean {
  return Boolean(process.env.AMAP_API_KEY?.trim());
}

function clean(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  // 高德在没有值的字段上会返回字符串 "[]"
  return text === "[]" ? "" : text;
}

/** 高德的 location 是 "lng,lat" 字符串。 */
function parseLocation(value: unknown): { latitude: number; longitude: number } | null {
  const [lng, lat] = clean(value).split(",");
  const longitude = Number(lng);
  const latitude = Number(lat);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function uniqueRegion(parts: string[]): string[] {
  const seen = new Set<string>();
  return parts.filter((part) => {
    if (!part || seen.has(part)) return false;
    seen.add(part);
    return true;
  });
}

type AmapPoi = {
  id?: unknown;
  name?: unknown;
  address?: unknown;
  pname?: unknown;
  cityname?: unknown;
  adname?: unknown;
  location?: unknown;
};

function toSuggestion(poi: AmapPoi): LocationSuggestion | null {
  const name = clean(poi.name);
  if (!name) return null;

  const province = clean(poi.pname);
  const city = clean(poi.cityname);
  const region = uniqueRegion([province, city, clean(poi.adname)]).join("");
  const detail = clean(poi.address);
  const fullAddress =
    region && detail && !detail.startsWith(region) ? `${region}${detail}` : detail || region;
  const coordinates = parseLocation(poi.location);

  return {
    id: clean(poi.id) || `${name}-${fullAddress}`,
    name,
    address: detail,
    district: region,
    fullAddress: fullAddress || name,
    province,
    city,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
  };
}

export async function searchAmapLocations(
  keyword: string,
  options: { limit?: number; city?: string } = {},
): Promise<LocationSuggestion[]> {
  const key = process.env.AMAP_API_KEY?.trim();
  const query = keyword.trim();
  if (!key || !query) return [];

  const city = options.city?.trim() || process.env.AMAP_CITY?.trim() || "";
  const limit = Math.min(Math.max(options.limit || 10, 1), 20);
  const cacheKey = `${city}|${limit}|${query}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const params = new URLSearchParams({
    key,
    keywords: query,
    offset: String(limit),
    page: "1",
    extensions: "base",
    citylimit: city ? "true" : "false",
    output: "JSON",
  });
  if (city) params.set("city", city);

  try {
    const response = await fetch(`${AMAP_ENDPOINT}/v3/place/text?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as {
      status?: string;
      pois?: unknown;
      info?: string;
    };
    if (payload.status !== "1" || !Array.isArray(payload.pois)) return [];

    const seen = new Set<string>();
    const results: LocationSuggestion[] = [];
    for (const item of payload.pois as AmapPoi[]) {
      const suggestion = toSuggestion(item);
      if (!suggestion) continue;
      const dedupeKey = `${suggestion.name}|${suggestion.fullAddress}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      results.push(suggestion);
      if (results.length >= limit) break;
    }

    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, results });
    return results;
  } catch {
    return [];
  }
}
