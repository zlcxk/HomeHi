import { Lunar, LunarYear, Solar } from "lunar-typescript";

export type LunarDayInfo = {
  /** 例：初一、廿三、冬月 */
  dayText: string;
  /** 农历节日、公历节日或节气，优先显示 */
  label: string | null;
  /** 清明、冬至这类节气 */
  solarTerm: string | null;
};

export type LunarYmd = {
  year: number;
  month: number;
  day: number;
  leap: boolean;
};

const MONTH_NAMES = [
  "正月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "冬月",
  "腊月",
];

const DAY_NAMES = [
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十",
];

/**
 * 手机日历的常见做法：农历节日和节气优先显示，否则显示农历日；
 * 初一显示月份，方便看出一个月从哪里开始。
 */
export function lunarDayInfo(year: number, month: number, day: number): LunarDayInfo {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const dayText =
    lunar.getDayInChinese() === "初一"
      ? `${lunar.getMonthInChinese()}月`
      : lunar.getDayInChinese();

  const festivals = [...solar.getFestivals(), ...lunar.getFestivals()].filter(Boolean);
  const solarTerm = lunar.getJieQi() || null;
  const label = festivals[0] || solarTerm;

  return { dayText, label, solarTerm };
}

export function lunarMonthLabel(month: number): string {
  return MONTH_NAMES[Math.abs(month) - 1] || `${Math.abs(month)} 月`;
}

export function lunarDayLabel(day: number): string {
  return DAY_NAMES[day - 1] || `${day} 日`;
}

/** 例：农历八月十五 / 农历闰四月廿三 */
export function lunarDateLabel(month: number, day: number, leap = false): string {
  return `农历${leap ? "闰" : ""}${lunarMonthLabel(month)}${lunarDayLabel(day)}`;
}

/** 公历日期对应的农历日期；month 为负数表示闰月。 */
export function solarToLunar(year: number, month: number, day: number): LunarYmd {
  const lunar = Solar.fromYmd(year, month, day).getLunar();
  const lunarMonth = lunar.getMonth();
  return {
    year: lunar.getYear(),
    month: Math.abs(lunarMonth),
    day: lunar.getDay(),
    leap: lunarMonth < 0,
  };
}

/**
 * 农历 → 公历。日期不存在（例如当年该月只有 29 天却选了三十）时返回 null，
 * 表单据此提示用户重新选择。
 */
export function lunarToSolar(
  lunarYear: number,
  month: number,
  day: number,
  leap = false,
): { year: number; month: number; day: number } | null {
  try {
    const yearInfo = LunarYear.fromYear(lunarYear);
    const monthInfo = yearInfo.getMonth(leap ? -Math.abs(month) : Math.abs(month));
    if (!monthInfo || day < 1 || day > monthInfo.getDayCount()) return null;
    const solar = Lunar.fromYmd(lunarYear, monthInfo.getMonth(), day).getSolar();
    return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() };
  } catch {
    return null;
  }
}

/**
 * 用于「每年重复」：某农历年的同一天。
 * - 闰月出生但当年没有同号闰月时，按普通月计算（常见做法）。
 * - 当月没有三十时，落在当月最后一天。
 */
export function lunarOccurrenceInYear(
  lunarYear: number,
  month: number,
  day: number,
  leap = false,
): { year: number; month: number; day: number } | null {
  try {
    const yearInfo = LunarYear.fromYear(lunarYear);
    const monthInfo =
      (leap ? yearInfo.getMonth(-Math.abs(month)) : null) ?? yearInfo.getMonth(Math.abs(month));
    if (!monthInfo) return null;
    const lunarDay = Math.min(Math.max(1, day), monthInfo.getDayCount());
    const solar = Lunar.fromYmd(lunarYear, monthInfo.getMonth(), lunarDay).getSolar();
    return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() };
  } catch {
    return null;
  }
}

export function isLeapMonthInYear(lunarYear: number, month: number): boolean {
  try {
    return LunarYear.fromYear(lunarYear).getLeapMonth() === Math.abs(month);
  } catch {
    return false;
  }
}
