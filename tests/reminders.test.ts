import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { notificationTitle, parseOffsets, parseRecipients, reminderBaseUtc } from "@/lib/reminders";

describe("reminder rules", () => {
  it("keeps only supported offsets, deduplicated and sorted", () => {
    expect(parseOffsets(JSON.stringify([60, 180, 60, 9999, -5]))).toEqual([180, 60]);
    expect(parseOffsets("not json")).toEqual([]);
    expect(parseOffsets(null)).toEqual([]);
  });

  it("keeps only string recipient ids", () => {
    expect(parseRecipients(JSON.stringify(["a", 3, null, "b"]))).toEqual(["a", "b"]);
    expect(parseRecipients("{")).toEqual([]);
  });

  it("schedules all-day reminders at 09:00 household time", () => {
    const occurrence = new Date("2026-10-24T04:00:00.000Z");
    expect(reminderBaseUtc(occurrence, true, "Asia/Shanghai").toISOString()).toBe(
      "2026-10-24T01:00:00.000Z",
    );
    expect(reminderBaseUtc(occurrence, false, "Asia/Shanghai").toISOString()).toBe(
      "2026-10-24T04:00:00.000Z",
    );
  });

  it("formats reminder titles in the household timezone", () => {
    const when = new Date("2026-10-24T12:00:00.000Z");
    const title = notificationTitle("CALENDAR_EVENT", "家庭电影夜", when, false, "Asia/Shanghai", 60);
    expect(title).toContain("家庭电影夜");
    expect(title).toContain("10月24日 20:00");
    expect(DateTime.fromJSDate(when, { zone: "Asia/Shanghai" }).toFormat("HH:mm")).toBe("20:00");
  });
});
