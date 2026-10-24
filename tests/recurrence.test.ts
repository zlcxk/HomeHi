import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { occurrenceAt, occurrencesBetween, recurrenceSummary } from "@/lib/recurrence";

const UTC = "UTC";

function iso(value: Date | null): string | null {
  return value ? DateTime.fromJSDate(value, { zone: "utc" }).toISO() : null;
}

describe("recurrence engine", () => {
  it("repeats daily with an interval", () => {
    const occurrences = occurrencesBetween(
      "2026-01-01T09:00:00.000Z",
      { type: "DAILY", interval: 2 },
      "2026-01-01T00:00:00.000Z",
      "2026-01-06T00:00:00.000Z",
      UTC,
    );
    expect(occurrences.map(iso)).toEqual([
      "2026-01-01T09:00:00.000Z",
      "2026-01-03T09:00:00.000Z",
      "2026-01-05T09:00:00.000Z",
    ]);
  });

  it("repeats weekly on the anchor weekday", () => {
    const occurrences = occurrencesBetween(
      "2026-10-24T12:00:00.000Z",
      { type: "WEEKLY", interval: 1 },
      "2026-10-01T00:00:00.000Z",
      "2026-11-15T00:00:00.000Z",
      UTC,
    );
    expect(occurrences.map((d) => DateTime.fromJSDate(d).toFormat("yyyy-MM-dd"))).toEqual([
      "2026-10-24",
      "2026-10-31",
      "2026-11-07",
      "2026-11-14",
    ]);
  });

  it("clamps monthly occurrences to the last day and returns to the anchor day", () => {
    const occurrences = occurrencesBetween(
      "2026-01-31T09:00:00.000Z",
      { type: "MONTHLY", interval: 1 },
      "2026-01-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z",
      UTC,
    );
    expect(occurrences.map((d) => DateTime.fromJSDate(d).toFormat("yyyy-MM-dd"))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("handles leap-day yearly rules from the anchor", () => {
    const leap = occurrenceAt("2024-02-29T09:00:00.000Z", { type: "YEARLY", interval: 1 }, 1, UTC);
    const backToLeap = occurrenceAt("2024-02-29T09:00:00.000Z", { type: "YEARLY", interval: 1 }, 4, UTC);
    expect(iso(leap)).toBe("2025-02-28T09:00:00.000Z");
    expect(iso(backToLeap)).toBe("2028-02-29T09:00:00.000Z");
  });

  it("keeps local wall-clock time across a DST change", () => {
    // 2026-03-08 is the US DST switch. 09:00 local is 14:00Z before, 13:00Z after.
    const next = occurrenceAt(
      "2026-03-07T14:00:00.000Z",
      { type: "DAILY", interval: 1 },
      1,
      "America/New_York",
    );
    expect(iso(next)).toBe("2026-03-08T13:00:00.000Z");
    expect(DateTime.fromJSDate(next!, { zone: "America/New_York" }).hour).toBe(9);
  });

  it("stops after until (inclusive of that local day)", () => {
    const occurrences = occurrencesBetween(
      "2026-10-01T09:00:00.000Z",
      { type: "DAILY", interval: 1, until: "2026-10-03T00:00:00.000Z" },
      "2026-10-01T00:00:00.000Z",
      "2026-10-10T00:00:00.000Z",
      UTC,
    );
    expect(occurrences.map((d) => DateTime.fromJSDate(d).toFormat("yyyy-MM-dd"))).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  it("includes a one-off event only when it falls inside the range", () => {
    const rule = { type: "NONE", interval: 1 } as const;
    expect(
      occurrencesBetween("2026-10-24T09:00:00.000Z", rule, "2026-10-24T00:00:00.000Z", "2026-10-25T00:00:00.000Z", UTC),
    ).toHaveLength(1);
    expect(
      occurrencesBetween("2026-10-24T09:00:00.000Z", rule, "2026-10-25T00:00:00.000Z", "2026-10-26T00:00:00.000Z", UTC),
    ).toHaveLength(0);
  });

  it("labels recurrence intervals for people", () => {
    expect(recurrenceSummary("NONE", 1)).toBe("不重复");
    expect(recurrenceSummary("WEEKLY", 1)).toBe("每周");
    expect(recurrenceSummary("MONTHLY", 2)).toBe("每 2 个月");
  });
});
