import { describe, expect, it } from "vitest";
import {
  TRASH_RETENTION_DAYS,
  TRASH_RETENTION_MS,
  formatTrashRemaining,
  isTrashExpired,
  trashExpiresAt,
  trashRemainingMs,
} from "@/lib/trash";
import { restoredEntryStatus } from "@/lib/entry-status";

const DAY = 24 * 60 * 60 * 1000;

describe("trash retention", () => {
  it("固定保留 30 × 24 小时，不依赖时区", () => {
    expect(TRASH_RETENTION_DAYS).toBe(30);
    expect(TRASH_RETENTION_MS).toBe(30 * DAY);
    const deletedAt = new Date("2026-01-01T00:00:00.000Z");
    expect(trashExpiresAt(deletedAt).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("到达 30 天整点时算过期，提前 1 毫秒仍可恢复", () => {
    const deletedAt = new Date("2026-01-01T00:00:00.000Z");
    expect(isTrashExpired(deletedAt, new Date("2026-01-30T23:59:59.999Z"))).toBe(false);
    expect(isTrashExpired(deletedAt, new Date("2026-01-31T00:00:00.000Z"))).toBe(true);
    expect(isTrashExpired(null, new Date())).toBe(false);
  });

  it("剩余时间不会变成负数", () => {
    const deletedAt = new Date("2026-01-01T00:00:00.000Z");
    expect(trashRemainingMs(deletedAt, new Date("2026-02-05T00:00:00.000Z"))).toBe(0);
  });

  it("剩余时间文案覆盖分钟、小时、天和过期", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    expect(formatTrashRemaining(new Date(now.getTime() - 1 * DAY), now)).toBe("剩余 29 天");
    expect(formatTrashRemaining(new Date(now.getTime() - 28 * DAY - 20 * 60 * 60_000), now)).toBe(
      "剩余 1 天 4 小时",
    );
    expect(formatTrashRemaining(new Date(now.getTime() - 29 * DAY - 23 * 60 * 60_000), now)).toBe(
      "剩余 1 小时",
    );
    expect(
      formatTrashRemaining(
        new Date(now.getTime() - 29 * DAY - 23 * 60 * 60_000 - 59 * 60_000 - 30_000),
        now,
      ),
    ).toBe("不到 1 分钟");
    expect(formatTrashRemaining(new Date(now.getTime() - 31 * DAY), now)).toBe("已超过保留期");
    expect(formatTrashRemaining(null, now)).toBe("保留期未知");
  });
});

describe("entry restore status", () => {
  it("恢复删除前的草稿、发布或归档状态", () => {
    expect(restoredEntryStatus("DRAFT")).toBe("DRAFT");
    expect(restoredEntryStatus("PUBLISHED")).toBe("PUBLISHED");
    expect(restoredEntryStatus("ARCHIVED")).toBe("ARCHIVED");
  });

  it("历史数据或异常值回到已发布", () => {
    expect(restoredEntryStatus(null)).toBe("PUBLISHED");
    expect(restoredEntryStatus("DELETED")).toBe("PUBLISHED");
    expect(restoredEntryStatus("UNKNOWN")).toBe("PUBLISHED");
  });
});
