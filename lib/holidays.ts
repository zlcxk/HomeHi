/**
 * 中国法定节假日与调休，数据来自 NateScarlet/holiday-cn。
 * 按年份按需拉取，落在 Next 的 fetch 缓存里；网络不通时安静返回空结果，
 * 日历仍然正常工作，只是不显示节假日。
 */
export type HolidayDay = {
  name: string;
  date: string;
  isOffDay: boolean;
};

type HolidayFile = {
  year?: number;
  days?: HolidayDay[];
};

const SOURCES = [
  "https://fastly.jsdelivr.net/gh/NateScarlet/holiday-cn@master",
  "https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master",
  "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master",
];

const MEMORY_TTL_MS = 6 * 60 * 60 * 1000;
const memory = new Map<number, { at: number; days: HolidayDay[] }>();

function validDay(value: unknown): value is HolidayDay {
  if (!value || typeof value !== "object") return false;
  const day = value as Record<string, unknown>;
  return (
    typeof day.name === "string" &&
    typeof day.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
    typeof day.isOffDay === "boolean"
  );
}

async function fetchYear(year: number): Promise<HolidayDay[]> {
  const cached = memory.get(year);
  if (cached && Date.now() - cached.at < MEMORY_TTL_MS) return cached.days;

  const attempts = SOURCES.map(async (base) => {
    const response = await fetch(`${base}/${year}.json`, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(4000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`holiday-cn ${response.status}`);
    const data = (await response.json()) as HolidayFile;
    if (data.year && data.year !== year) throw new Error("holiday-cn year mismatch");
    const days = Array.isArray(data.days) ? data.days.filter(validDay) : [];
    if (days.length === 0) throw new Error("holiday-cn empty");
    return days;
  });

  try {
    // 多个镜像并行，谁先成功用谁；全部失败时安静降级。
    const days = await Promise.any(attempts);
    memory.set(year, { at: Date.now(), days });
    return days;
  } catch {
    memory.set(year, { at: Date.now(), days: [] });
    return [];
  }
}

/** 返回 date（yyyy-MM-dd）到节假日信息的映射，通常只需要 1–2 个年份。 */
export async function holidayMap(years: number[]): Promise<Map<string, HolidayDay>> {
  const unique = Array.from(new Set(years.filter((year) => year >= 2000 && year <= 2100)));
  const lists = await Promise.all(unique.map((year) => fetchYear(year)));
  const map = new Map<string, HolidayDay>();
  for (const list of lists) {
    for (const day of list) map.set(day.date, day);
  }
  return map;
}
