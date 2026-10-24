import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { ageLabel, daysUntil, nextBirthday } from "@/lib/dates";

const SHANGHAI = "Asia/Shanghai";

function local(date: Date | null): string | null {
  return date ? DateTime.fromJSDate(date, { zone: SHANGHAI }).toFormat("yyyy-MM-dd HH:mm") : null;
}

describe("birthdays", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T04:00:00.000Z")); // 12:00 in Shanghai
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps today's birthday for the whole day", () => {
    expect(local(nextBirthday(new Date("1990-10-24T00:00:00.000Z"), SHANGHAI))).toBe("2026-10-24 09:00");
  });

  it("starts countdown next year once the date is past", () => {
    expect(local(nextBirthday(new Date("1990-10-23T00:00:00.000Z"), SHANGHAI))).toBe("2027-10-23 09:00");
  });

  it("returns this year's date when it is still ahead", () => {
    expect(local(nextBirthday(new Date("1990-12-31T00:00:00.000Z"), SHANGHAI))).toBe("2026-12-31 09:00");
  });

  it("falls back to Feb 28 for a leap-day birthday in a non-leap year", () => {
    expect(local(nextBirthday(new Date("1992-02-29T00:00:00.000Z"), SHANGHAI))).toBe("2027-02-28 09:00");
  });

  it("counts whole days to a date", () => {
    expect(daysUntil(new Date("2026-10-27T09:00:00.000Z"), SHANGHAI)).toBe(3);
  });

  it("renders an age in years", () => {
    expect(ageLabel(new Date("1990-10-24T00:00:00.000Z"), SHANGHAI)).toBe("36 岁");
  });
});
