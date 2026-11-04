import { describe, expect, it } from "vitest";
import {
  MEDIA_PAGE_SIZE,
  appendUniqueMedia,
  mediaGroupLabel,
  normalizeMediaCursor,
  normalizeMediaListView,
  type MediaGridItem,
} from "@/lib/media-list";

function item(id: string, groupLabel = "2026年11月"): MediaGridItem {
  return {
    id,
    mediaType: "IMAGE",
    thumbUrl: `/api/media/${id}/thumb?v=1`,
    caption: null,
    width: 100,
    height: 100,
    durationSeconds: null,
    favorite: false,
    groupLabel,
  };
}

describe("media list helpers", () => {
  it("每页固定 30 条", () => {
    expect(MEDIA_PAGE_SIZE).toBe(30);
  });

  it("筛选值只接受白名单，其他值按全部处理", () => {
    expect(normalizeMediaListView("favorites")).toBe("favorites");
    expect(normalizeMediaListView("videos")).toBe("videos");
    expect(normalizeMediaListView("all")).toBe("all");
    expect(normalizeMediaListView("private")).toBe("all");
    expect(normalizeMediaListView(null)).toBe("all");
  });

  it("游标只接受 cuid 形态的字符串", () => {
    expect(normalizeMediaCursor(" cm5x8y9z0000abcd1234efgh ")).toBe("cm5x8y9z0000abcd1234efgh");
    expect(normalizeMediaCursor("short")).toBeNull();
    expect(normalizeMediaCursor("abc' OR 1=1 --")).toBeNull();
    expect(normalizeMediaCursor("")).toBeNull();
    expect(normalizeMediaCursor(undefined)).toBeNull();
  });

  it("按家庭时区分组，跨时区的拍摄时间落在正确月份", () => {
    // 2026-10-31 17:00 UTC 在上海是 2026-11-01。
    const takenAt = new Date("2026-10-31T17:00:00Z");
    expect(mediaGroupLabel(takenAt, new Date("2026-01-01T00:00:00Z"), "Asia/Shanghai")).toBe(
      "2026年11月",
    );
    expect(mediaGroupLabel(takenAt, new Date("2026-01-01T00:00:00Z"), "UTC")).toBe("2026年10月");
  });

  it("没有拍摄时间时回退到上传时间", () => {
    expect(
      mediaGroupLabel(null, new Date("2025-03-15T04:00:00Z"), "Asia/Shanghai"),
    ).toBe("2025年3月");
  });

  it("追加分页结果时按 id 去重且保持原顺序", () => {
    const first = [item("a"), item("b")];
    const merged = appendUniqueMedia(first, [item("b"), item("c"), item("a"), item("d")]);
    expect(merged.map((row) => row.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("没有新内容时返回原数组，避免无意义的状态更新", () => {
    const first = [item("a")];
    expect(appendUniqueMedia(first, [item("a")])).toBe(first);
    expect(appendUniqueMedia(first, [])).toBe(first);
  });
});
