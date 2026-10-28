import { DateTime } from "luxon";
import { lunarOccurrenceInYear, solarToLunar } from "@/lib/lunar";

export type RecurrenceKind = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type LunarRecurrence = {
  month: number;
  day: number;
  leap?: boolean;
};

export type RecurrenceRule = {
  type: string;
  interval: number;
  until?: Date | string | null;
  /** 仅 YEARLY 生效：按农历月日重复，而不是公历同月同日。 */
  lunar?: LunarRecurrence | null;
};

export type EventRecurrenceSource = {
  recurrenceType: string;
  recurrenceInterval: number;
  recurrenceUntil?: Date | string | null;
  isLunar?: boolean | null;
  lunarMonth?: number | null;
  lunarDay?: number | null;
  lunarLeap?: boolean | null;
};

/** 把一条日程记录转换成重复规则。 */
export function eventRule(event: EventRecurrenceSource): RecurrenceRule {
  return {
    type: event.recurrenceType,
    interval: event.recurrenceInterval,
    until: event.recurrenceUntil ?? null,
    lunar:
      event.isLunar && event.lunarMonth && event.lunarDay
        ? { month: event.lunarMonth, day: event.lunarDay, leap: Boolean(event.lunarLeap) }
        : null,
  };
}

const MAX_INDEX = 20_000;

function normalizedInterval(rule: RecurrenceRule): number {
  return Number.isFinite(rule.interval) && rule.interval > 0 ? Math.floor(rule.interval) : 1;
}

function anchorDateTime(anchor: Date | string, timezone: string): DateTime {
  return (typeof anchor === "string" ? DateTime.fromISO(anchor, { zone: "utc" }) : DateTime.fromJSDate(anchor)).setZone(
    timezone,
  );
}

/** Nth occurrence measured from the anchor. Monthly/yearly clamping is computed from the anchor each time. */
export function occurrenceAt(
  anchor: Date | string,
  rule: RecurrenceRule,
  index: number,
  timezone: string,
): Date | null {
  if (index < 0) return null;
  if (rule.type === "NONE") return index === 0 ? anchorDateTime(anchor, timezone).toUTC().toJSDate() : null;
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(rule.type)) return null;

  const interval = normalizedInterval(rule);
  const base = anchorDateTime(anchor, timezone);
  let dt = base;
  if (rule.type === "DAILY") dt = base.plus({ days: index * interval });
  if (rule.type === "WEEKLY") dt = base.plus({ days: index * interval * 7 });
  if (rule.type === "MONTHLY") dt = base.plus({ months: index * interval });
  if (rule.type === "YEARLY") {
    if (rule.lunar) {
      if (index > 0) {
        // 农历日期对应的公历日期每年都不同，先换算再加回原来的时刻。
        const baseLunar = solarToLunar(base.year, base.month, base.day);
        const ymd = lunarOccurrenceInYear(
          baseLunar.year + index * interval,
          rule.lunar.month,
          rule.lunar.day,
          Boolean(rule.lunar.leap),
        );
        if (!ymd) return null;
        dt = DateTime.fromObject(
          {
            year: ymd.year,
            month: ymd.month,
            day: ymd.day,
            hour: base.hour,
            minute: base.minute,
            second: base.second,
            millisecond: base.millisecond,
          },
          { zone: timezone },
        );
        if (!dt.isValid) return null;
      }
    } else {
      dt = base.plus({ years: index * interval });
    }
  }

  if (rule.until) {
    const until = anchorDateTime(rule.until, timezone).endOf("day");
    if (dt > until) return null;
  }
  return dt.toUTC().toJSDate();
}

/** Approximate index just beyond `after`, then correct it exactly. */
export function occurrenceIndexAfter(
  anchor: Date | string,
  rule: RecurrenceRule,
  after: Date | string,
  timezone: string,
): number {
  if (rule.type === "NONE") return 1;
  const base = anchorDateTime(anchor, timezone);
  const target = anchorDateTime(after, timezone);
  const interval = normalizedInterval(rule);
  const diff = target.diff(base, ["days", "months", "years"]);
  let approx = 0;
  if (rule.type === "DAILY") approx = Math.floor(diff.days / interval);
  if (rule.type === "WEEKLY") approx = Math.floor(diff.days / 7 / interval);
  if (rule.type === "MONTHLY") approx = Math.floor(diff.months / interval);
  if (rule.type === "YEARLY") approx = Math.floor(diff.years / interval);
  let index = Math.max(0, approx);

  let guard = 0;
  while (guard++ < MAX_INDEX) {
    const current = occurrenceAt(anchor, rule, index, timezone);
    const previous = index > 0 ? occurrenceAt(anchor, rule, index - 1, timezone) : null;
    if (current && current.getTime() <= target.toJSDate().getTime()) {
      index += 1;
      continue;
    }
    if (previous && previous.getTime() > target.toJSDate().getTime()) {
      index -= 1;
      continue;
    }
    break;
  }
  return index;
}

/** First occurrence strictly after `after`. */
export function nextOccurrence(
  anchor: Date | string,
  rule: RecurrenceRule,
  after: Date | string,
  timezone: string,
): Date | null {
  if (rule.type === "NONE") {
    const only = anchorDateTime(anchor, timezone).toUTC().toJSDate();
    return only.getTime() > new Date(after).getTime() ? only : null;
  }
  return occurrenceAt(anchor, rule, occurrenceIndexAfter(anchor, rule, after, timezone), timezone);
}

/** Occurrences in [from, to], bounded for safety. */
export function occurrencesBetween(
  anchor: Date | string,
  rule: RecurrenceRule,
  from: Date | string,
  to: Date | string,
  timezone: string,
  limit = 60,
): Date[] {
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  if (toTime < fromTime || limit <= 0) return [];

  const results: Date[] = [];
  if (rule.type === "NONE") {
    const only = occurrenceAt(anchor, rule, 0, timezone);
    if (only && only.getTime() >= fromTime && only.getTime() <= toTime) results.push(only);
    return results;
  }

  let index = occurrenceIndexAfter(anchor, rule, new Date(fromTime - 1), timezone);
  for (let i = 0; i < limit; i += 1) {
    const occurrence = occurrenceAt(anchor, rule, index + i, timezone);
    if (!occurrence) break;
    if (occurrence.getTime() > toTime) break;
    if (occurrence.getTime() >= fromTime) results.push(occurrence);
  }
  return results;
}

export function recurrenceSummary(type: string, interval: number): string {
  if (type === "NONE") return "不重复";
  const base = { DAILY: "天", WEEKLY: "周", MONTHLY: "个月", YEARLY: "年" }[type] ?? "";
  return interval > 1 ? `每 ${interval} ${base}` : { DAILY: "每天", WEEKLY: "每周", MONTHLY: "每月", YEARLY: "每年" }[type] ?? "";
}
