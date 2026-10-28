import { DateTime } from "luxon";
import { asDateTime, nextBirthday as nextSolarBirthday, zoneOf } from "@/lib/dates";
import {
  isLeapMonthInYear,
  lunarDateLabel,
  lunarOccurrenceInYear,
  solarToLunar,
} from "@/lib/lunar";

export type BirthdayProfile = {
  birthday: Date | string | null;
  birthdayCalendar?: string | null;
  lunarMonth?: number | null;
  lunarDay?: number | null;
  lunarLeap?: boolean | null;
};

function lunarParts(profile: BirthdayProfile): { month: number; day: number; leap: boolean } | null {
  if (profile.birthdayCalendar !== "LUNAR" || !profile.lunarMonth || !profile.lunarDay) return null;
  return { month: profile.lunarMonth, day: profile.lunarDay, leap: Boolean(profile.lunarLeap) };
}

/** 这一天是不是 TA 的生日（农历生日按农历月日比较）。 */
export function birthdayOccursOn(
  profile: BirthdayProfile,
  day: DateTime,
  timezone: string,
): boolean {
  if (!profile.birthday) return false;
  const lunar = lunarParts(profile);
  if (!lunar) {
    const birth = asDateTime(profile.birthday, timezone);
    return birth.month === day.month && birth.day === day.day;
  }

  const current = solarToLunar(day.year, day.month, day.day);
  if (current.month !== lunar.month || current.day !== lunar.day) return false;
  if (lunar.leap) {
    // 闰月出生：当年有同号闰月就按闰月过，没有则按普通月。
    return current.leap || !isLeapMonthInYear(current.year, lunar.month);
  }
  return !current.leap;
}

/**
 * 下一次生日。农历生日每年换算成对应的公历日期；
 * 当年没有这一天时保留原生日逻辑（按该月最后一天）。
 */
export function nextBirthdayOf(
  profile: BirthdayProfile,
  timezone: string,
  now: Date = new Date(),
): Date | null {
  if (!profile.birthday) return null;
  const lunar = lunarParts(profile);
  if (!lunar) return nextSolarBirthday(profile.birthday, timezone);

  const zone = zoneOf(timezone);
  const today = DateTime.fromJSDate(now).setZone(zone).startOf("day");
  const todayLunar = solarToLunar(today.year, today.month, today.day);

  for (let offset = 0; offset <= 2; offset += 1) {
    const ymd = lunarOccurrenceInYear(
      todayLunar.year + offset,
      lunar.month,
      lunar.day,
      lunar.leap,
    );
    if (!ymd) continue;
    const occurrence = DateTime.fromObject(
      { year: ymd.year, month: ymd.month, day: ymd.day, hour: 9 },
      { zone },
    );
    if (occurrence.isValid && occurrence >= today) return occurrence.toUTC().toJSDate();
  }
  return null;
}

/** 档案上的农历生日文案，如「农历八月十五」。 */
export function birthdayLunarLabel(profile: BirthdayProfile): string | null {
  const lunar = lunarParts(profile);
  return lunar ? lunarDateLabel(lunar.month, lunar.day, lunar.leap) : null;
}

/** 编辑档案时，把生日还原成农历选择器的初始值。 */
export function birthdayLunarInitial(
  profile: BirthdayProfile,
  timezone: string,
): { year: number; month: number; day: number; leap: boolean } | null {
  const lunar = lunarParts(profile);
  if (!lunar || !profile.birthday) return null;
  const birth = asDateTime(profile.birthday, timezone);
  const converted = solarToLunar(birth.year, birth.month, birth.day);
  return {
    year: converted.year,
    month: lunar.month,
    day: lunar.day,
    leap: lunar.leap,
  };
}
