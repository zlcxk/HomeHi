"use client";

import { useEffect, useState } from "react";

export type LunarInitial = {
  year: number;
  month: number;
  day: number;
  leap?: boolean;
};

type MonthOption = {
  value: number;
  label: string;
  days: number;
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

const FALLBACK_MONTHS: MonthOption[] = MONTH_NAMES.map((label, index) => ({
  value: index + 1,
  label,
  days: 30,
}));

function monthText(month: number): string {
  return `${month < 0 ? "闰" : ""}${MONTH_NAMES[Math.abs(month) - 1]}`;
}

/**
 * 农历年/月/日选择器。
 * 农历库按需加载，避免把整个历法数据打进首屏；选中后直接给出对应的公历日期。
 * 隐藏字段供服务端换算，客户端不直接决定存库日期。
 */
export function LunarDatePicker({
  namePrefix,
  initial,
  seedDate,
  yearRange,
  className = "",
}: {
  namePrefix: string;
  initial?: LunarInitial | null;
  /** 没有初始农历值时，用这个公历日期（yyyy-MM-dd）作为起点。 */
  seedDate?: string;
  yearRange?: [number, number];
  className?: string;
}) {
  const currentYear = new Date().getFullYear();
  const [from, to] = yearRange ?? [currentYear - 1, currentYear + 10];
  const [year, setYear] = useState(initial?.year ?? currentYear);
  const [month, setMonth] = useState(
    initial ? (initial.leap ? -Math.abs(initial.month) : initial.month) : 1,
  );
  const [day, setDay] = useState(initial?.day ?? 1);
  const [months, setMonths] = useState<MonthOption[]>(FALLBACK_MONTHS);
  const [preview, setPreview] = useState<{ year: number; month: number; day: number } | null>(
    null,
  );
  const [invalid, setInvalid] = useState(false);

  // 切换到农历时，尽量沿用原来的公历日期，而不是跳到一个无关的默认日期。
  useEffect(() => {
    if (initial || !seedDate) return;
    let cancelled = false;
    import("lunar-typescript")
      .then(({ Solar }) => {
        if (cancelled) return;
        const [y, m, d] = seedDate.split("-").map(Number);
        if (!y || !m || !d) return;
        const lunar = Solar.fromYmd(y, m, d).getLunar();
        setYear(lunar.getYear());
        setMonth(lunar.getMonth());
        setDay(lunar.getDay());
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initial, seedDate]);

  useEffect(() => {
    let cancelled = false;
    import("lunar-typescript")
      .then(({ LunarYear }) => {
        if (cancelled) return;
        const info = LunarYear.fromYear(year);
        const list: MonthOption[] = info.getMonthsInYear().map((item) => ({
          value: item.getMonth(),
          label: `${item.isLeap() ? "闰" : ""}${MONTH_NAMES[Math.abs(item.getMonth()) - 1]}`,
          days: item.getDayCount(),
        }));
        if (list.length === 0) return;
        setMonths(list);
        const next =
          list.find((item) => item.value === month) ??
          list.find((item) => item.value === Math.abs(month)) ??
          list[0];
        if (next.value !== month) setMonth(next.value);
        if (day > next.days) setDay(next.days);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [year, month, day]);

  useEffect(() => {
    let cancelled = false;
    import("lunar-typescript")
      .then(({ Lunar }) => {
        try {
          const solar = Lunar.fromYmd(year, month, day).getSolar();
          if (cancelled) return;
          setPreview({ year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() });
          setInvalid(false);
        } catch {
          if (cancelled) return;
          setPreview(null);
          setInvalid(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [year, month, day]);

  const dayCount = months.find((item) => item.value === month)?.days ?? 30;
  const firstYear = Math.min(from, year);
  const lastYear = Math.max(to, year);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => lastYear - index);

  function chooseMonth(next: number) {
    setMonth(next);
    const option = months.find((item) => item.value === next);
    if (option && day > option.days) setDay(option.days);
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label="农历年"
          className="field"
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        >
          {years.map((value) => (
            <option key={value} value={value}>
              {value} 年
            </option>
          ))}
        </select>
        <select
          aria-label="农历月"
          className="field"
          value={month}
          onChange={(event) => chooseMonth(Number(event.target.value))}
        >
          {months.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="农历日"
          className="field"
          value={day}
          onChange={(event) => setDay(Number(event.target.value))}
        >
          {Array.from({ length: dayCount }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {DAY_NAMES[value - 1]}
            </option>
          ))}
        </select>
      </div>

      <p className={`mt-1.5 text-[11.5px] ${invalid ? "text-danger" : "text-faint"}`}>
        {invalid
          ? "这个农历日期不存在，请重新选择"
          : preview
            ? `${monthText(month)}${DAY_NAMES[day - 1]} · 公历 ${preview.year}年${preview.month}月${preview.day}日`
            : " "}
      </p>

      <input type="hidden" name={`${namePrefix}Year`} value={year} />
      <input type="hidden" name={`${namePrefix}Month`} value={Math.abs(month)} />
      <input type="hidden" name={`${namePrefix}Day`} value={day} />
      <input type="hidden" name={`${namePrefix}Leap`} value={month < 0 ? "true" : "false"} />
    </div>
  );
}
