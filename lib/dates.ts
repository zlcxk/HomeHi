import { DateTime } from "luxon";

export const FALLBACK_TIMEZONE = process.env.DEFAULT_TIMEZONE || "Asia/Shanghai";

export function zoneOf(timezone?: string | null): string {
  return timezone || FALLBACK_TIMEZONE;
}

export function asDateTime(value: Date | string, timezone?: string | null): DateTime {
  const dt = typeof value === "string" ? DateTime.fromISO(value, { zone: "utc" }) : DateTime.fromJSDate(value);
  return dt.setZone(zoneOf(timezone));
}

export function localInputToUtc(value: string, timezone: string): Date | null {
  if (!value) return null;
  const dt = DateTime.fromISO(value, { zone: timezone });
  return dt.isValid ? dt.toUTC().toJSDate() : null;
}

export function dateInputToUtc(value: string, timezone: string): Date | null {
  if (!value) return null;
  const dt = DateTime.fromISO(value, { zone: timezone }).startOf("day");
  return dt.isValid ? dt.toUTC().toJSDate() : null;
}

export function toLocalInput(value: Date | string | null | undefined, timezone: string): string {
  if (!value) return "";
  return asDateTime(value, timezone).toFormat("yyyy-MM-dd'T'HH:mm");
}

export function toDateInput(value: Date | string | null | undefined, timezone: string): string {
  if (!value) return "";
  return asDateTime(value, timezone).toFormat("yyyy-MM-dd");
}

export function toUTCISO(value: Date | string): string {
  return (typeof value === "string" ? new Date(value) : value).toISOString();
}

export function dayKey(value: Date | string, timezone: string): string {
  return asDateTime(value, timezone).toFormat("yyyy-MM-dd");
}

export function startOfDay(value: Date | string, timezone: string): Date {
  return asDateTime(value, timezone).startOf("day").toUTC().toJSDate();
}

export function formatTime(value: Date | string, timezone: string): string {
  return asDateTime(value, timezone).setLocale("zh-CN").toFormat("HH:mm");
}

export function formatDate(value: Date | string, timezone: string): string {
  return asDateTime(value, timezone).setLocale("zh-CN").toFormat("M月d日");
}

export function formatDateFull(value: Date | string, timezone: string): string {
  return asDateTime(value, timezone).setLocale("zh-CN").toFormat("yyyy年M月d日");
}

export function formatMonth(value: Date | string, timezone: string): string {
  return asDateTime(value, timezone).setLocale("zh-CN").toFormat("yyyy年M月");
}

export function formatDateTime(value: Date | string, timezone: string): string {
  return asDateTime(value, timezone).setLocale("zh-CN").toFormat("M月d日 HH:mm");
}

export function formatWeekday(value: Date | string, timezone: string): string {
  return asDateTime(value, timezone).setLocale("zh-CN").toFormat("ccc");
}

export function formatDayLabel(value: Date | string, timezone: string, now = new Date()): string {
  const target = asDateTime(value, timezone).startOf("day");
  const today = asDateTime(now, timezone).startOf("day");
  const diff = target.diff(today, "days").days;
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === 2) return "后天";
  if (diff === -1) return "昨天";
  if (diff > 2 && diff < 7) return target.setLocale("zh-CN").toFormat("cccc");
  if (target.year === today.year) return target.setLocale("zh-CN").toFormat("M月d日");
  return target.setLocale("zh-CN").toFormat("yyyy年M月d日");
}

export function formatRange(
  start: Date | string,
  end: Date | string | null | undefined,
  timezone: string,
  isAllDay = false,
): string {
  const s = asDateTime(start, timezone).setLocale("zh-CN");
  if (isAllDay) return s.toFormat("M月d日");
  if (!end) return s.toFormat("M月d日 HH:mm");
  const e = asDateTime(end, timezone).setLocale("zh-CN");
  if (s.hasSame(e, "day")) return `${s.toFormat("M月d日 HH:mm")} – ${e.toFormat("HH:mm")}`;
  return `${s.toFormat("M月d日 HH:mm")} – ${e.toFormat("M月d日 HH:mm")}`;
}

/** 只显示日期的区间，用于旅行这类以天为单位的内容。 */
export function formatDayRange(
  start: Date | string,
  end: Date | string | null | undefined,
  timezone: string,
): string {
  const s = asDateTime(start, timezone).setLocale("zh-CN");
  if (!end) return s.toFormat("yyyy年M月d日");
  const e = asDateTime(end, timezone).setLocale("zh-CN");
  if (s.hasSame(e, "day")) return s.toFormat("yyyy年M月d日");
  if (s.year === e.year) return `${s.toFormat("yyyy年M月d日")} – ${e.toFormat("M月d日")}`;
  return `${s.toFormat("yyyy年M月d日")} – ${e.toFormat("yyyy年M月d日")}`;
}

export function monthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function monthGrid(year: number, month: number, timezone: string): DateTime[] {
  const first = DateTime.fromObject({ year, month, day: 1 }, { zone: timezone });
  const gridStart = first.minus({ days: (first.weekday + 6) % 7 }).startOf("day");
  return Array.from({ length: 42 }, (_, i) => gridStart.plus({ days: i }));
}

export function ageLabel(birthday: Date | string | null | undefined, timezone: string): string | null {
  if (!birthday) return null;
  const b = asDateTime(birthday, timezone);
  const now = DateTime.now().setZone(zoneOf(timezone));
  const years = Math.floor(now.diff(b, "years").years);
  return years >= 0 && years < 120 ? `${years} 岁` : null;
}

export function nextBirthday(birthday: Date | string | null | undefined, timezone: string): Date | null {
  if (!birthday) return null;
  const b = asDateTime(birthday, timezone);
  const now = DateTime.now().setZone(zoneOf(timezone)).startOf("day");
  let next = DateTime.fromObject(
    { month: b.month, day: b.day, hour: 9 },
    { zone: zoneOf(timezone) },
  );
  if (!next.isValid) next = DateTime.fromObject({ month: b.month, day: b.day === 29 ? 28 : b.day, hour: 9 }, { zone: zoneOf(timezone) });
  if (next < now) {
    next = DateTime.fromObject(
      { year: now.year + 1, month: b.month, day: b.day, hour: 9 },
      { zone: zoneOf(timezone) },
    );
    if (!next.isValid) {
      next = DateTime.fromObject({ year: now.year + 1, month: b.month, day: 28, hour: 9 }, { zone: zoneOf(timezone) });
    }
  }
  return next.toUTC().toJSDate();
}

export function daysUntil(value: Date | string, timezone: string): number {
  const target = asDateTime(value, timezone).startOf("day");
  const today = DateTime.now().setZone(zoneOf(timezone)).startOf("day");
  return Math.round(target.diff(today, "days").days);
}

export function isSameDay(a: Date | string, b: Date | string, timezone: string): boolean {
  return asDateTime(a, timezone).hasSame(asDateTime(b, timezone), "day");
}

export function greeting(localHour: number): string {
  if (localHour < 5) return "夜深了";
  if (localHour < 11) return "早上好";
  if (localHour < 14) return "中午好";
  if (localHour < 18) return "下午好";
  return "晚上好";
}

export function localHourNow(timezone: string): number {
  return DateTime.now().setZone(zoneOf(timezone)).hour;
}
