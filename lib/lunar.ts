import { Solar } from "lunar-typescript";

export type LunarDayInfo = {
  /** 例：初一、廿三、冬月 */
  dayText: string;
  /** 农历节日、公历节日或节气，优先显示 */
  label: string | null;
  /** 清明、冬至这类节气 */
  solarTerm: string | null;
};

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
