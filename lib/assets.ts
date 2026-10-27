/** 物品/资产分类与状态。值会写进数据库，修改时保留旧值兜底。 */
export const ASSET_CATEGORIES = [
  { value: "APPLIANCE", label: "家电" },
  { value: "ELECTRONICS", label: "数码" },
  { value: "FURNITURE", label: "家具" },
  { value: "VEHICLE", label: "车辆" },
  { value: "TOOL", label: "工具" },
  { value: "DOCUMENT", label: "证件与保单" },
  { value: "OTHER", label: "其他" },
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number]["value"];

export const ASSET_STATUSES = [
  { value: "ACTIVE", label: "使用中" },
  { value: "REPAIRED", label: "维修过" },
  { value: "RETIRED", label: "已停用" },
  { value: "SOLD", label: "已转出" },
] as const;

const CATEGORY_LABELS = new Map<string, string>(
  ASSET_CATEGORIES.map((item) => [item.value, item.label]),
);
const STATUS_LABELS = new Map<string, string>(
  ASSET_STATUSES.map((item) => [item.value, item.label]),
);

export function assetCategoryLabel(value: string | null | undefined): string {
  return CATEGORY_LABELS.get(value ?? "") ?? "其他";
}

export function assetStatusLabel(value: string | null | undefined): string {
  return STATUS_LABELS.get(value ?? "") ?? "使用中";
}

/** 把日期换算成「还有 N 天 / 已过 N 天」，用于质保、维保和保险提示。 */
export function daysFromToday(
  date: Date | null | undefined,
  timezone: string,
  now = new Date(),
): number | null {
  if (!date) return null;
  const millis = startOfDay(date, timezone) - startOfDay(now, timezone);
  return Math.round(millis / 86_400_000);
}

function startOfDay(date: Date, timezone: string): number {
  // 只需要按家庭时区比较日期，避免用 UTC 导致跨日偏差。
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "1970";
  return Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")));
}

export function expiryHint(
  date: Date | null | undefined,
  timezone: string,
  prefix: string,
): string | null {
  const days = daysFromToday(date, timezone);
  if (days === null) return null;
  if (days < 0) return `${prefix}已过 ${Math.abs(days)} 天`;
  if (days === 0) return `${prefix}今天到期`;
  if (days <= 30) return `${prefix}还有 ${days} 天`;
  return null;
}
