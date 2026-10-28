import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { dayKey } from "@/lib/dates";
import { birthdayOccursOn, nextBirthdayOf } from "@/lib/birthdays";
import {
  lunarOccurrenceInYear,
  lunarToSolar,
  solarToLunar,
} from "@/lib/lunar";
import { occurrenceAt } from "@/lib/recurrence";

const TZ = "Asia/Shanghai";

describe("lunar conversion", () => {
  it("converts a lunar date to the matching solar date", () => {
    expect(lunarToSolar(2026, 8, 15)).toEqual({ year: 2026, month: 9, day: 25 });
  });

  it("rejects a lunar day that does not exist in that month", () => {
    // 2026 年八月只有 29 天
    expect(lunarToSolar(2026, 8, 30)).toBeNull();
  });

  it("converts a solar date back to lunar", () => {
    expect(solarToLunar(2026, 9, 25)).toEqual({
      year: 2026,
      month: 8,
      day: 15,
      leap: false,
    });
  });

  it("keeps yearly occurrences on the lunar date", () => {
    expect(lunarOccurrenceInYear(2027, 8, 15)).toEqual({ year: 2027, month: 9, day: 15 });
  });
});

describe("lunar birthdays", () => {
  const profile = {
    birthday: new Date("1990-10-03T00:00:00Z"),
    birthdayCalendar: "LUNAR",
    lunarMonth: 8,
    lunarDay: 15,
    lunarLeap: false,
  };

  it("matches the solar day of the lunar birthday", () => {
    const day = DateTime.fromObject({ year: 2026, month: 9, day: 25 }, { zone: TZ });
    expect(birthdayOccursOn(profile, day, TZ)).toBe(true);
    const other = DateTime.fromObject({ year: 2026, month: 9, day: 24 }, { zone: TZ });
    expect(birthdayOccursOn(profile, other, TZ)).toBe(false);
  });

  it("rolls to next year after the birthday passes", () => {
    const before = nextBirthdayOf(profile, TZ, new Date("2026-09-01T00:00:00Z"));
    expect(dayKey(before as Date, TZ)).toBe("2026-09-25");

    const after = nextBirthdayOf(profile, TZ, new Date("2026-09-26T00:00:00Z"));
    expect(dayKey(after as Date, TZ)).toBe("2027-09-15");
  });

  it("falls back to the regular month when a leap month is absent", () => {
    const leapProfile = {
      birthday: new Date("1990-10-03T00:00:00Z"),
      birthdayCalendar: "LUNAR",
      lunarMonth: 6,
      lunarDay: 15,
      lunarLeap: true,
    };
    // 2025 年有闰六月
    const leapDay = DateTime.fromObject({ year: 2025, month: 8, day: 8 }, { zone: TZ });
    expect(birthdayOccursOn(leapProfile, leapDay, TZ)).toBe(true);
    // 2026 年没有闰六月，按普通六月过
    const regularDay = DateTime.fromObject({ year: 2026, month: 7, day: 28 }, { zone: TZ });
    expect(birthdayOccursOn(leapProfile, regularDay, TZ)).toBe(true);
  });
});

describe("lunar yearly recurrence", () => {
  const anchor = new Date("2026-09-25T01:00:00Z"); // 2026-09-25 09:00 Asia/Shanghai

  it("computes subsequent occurrences from the lunar date", () => {
    const next = occurrenceAt(
      anchor,
      { type: "YEARLY", interval: 1, lunar: { month: 8, day: 15 } },
      1,
      TZ,
    );
    expect(dayKey(next as Date, TZ)).toBe("2027-09-15");
    expect(DateTime.fromJSDate(next as Date, { zone: TZ }).toFormat("HH:mm")).toBe("09:00");
  });

  it("leaves solar yearly recurrence unchanged", () => {
    const next = occurrenceAt(anchor, { type: "YEARLY", interval: 1 }, 1, TZ);
    expect(dayKey(next as Date, TZ)).toBe("2027-09-25");
  });
});
