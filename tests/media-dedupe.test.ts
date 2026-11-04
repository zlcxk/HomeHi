import { describe, expect, it } from "vitest";
import {
  MAX_ALBUM_MEDIA_BATCH,
  dedupeScopeFor,
  isUniqueConstraintError,
  normalizedMediaVisibility,
} from "@/lib/media-dedupe";

describe("media dedupe scope", () => {
  it("共享图片按上传者隔离，不复用其他成员的媒体", () => {
    expect(dedupeScopeFor("IMAGE", "HOUSEHOLD", "user-a")).toBe("user-a:HOUSEHOLD");
    expect(dedupeScopeFor("IMAGE", undefined, "user-a")).toBe("user-a:HOUSEHOLD");
    expect(dedupeScopeFor("IMAGE", "HOUSEHOLD", "user-a")).not.toBe(
      dedupeScopeFor("IMAGE", "HOUSEHOLD", "user-b"),
    );
  });

  it("私有图片按上传者隔离，并与共享版本分开", () => {
    expect(dedupeScopeFor("IMAGE", "PRIVATE", "user-a")).toBe("user-a:PRIVATE");
    expect(dedupeScopeFor("IMAGE", "PRIVATE", "user-b")).toBe("user-b:PRIVATE");
    expect(dedupeScopeFor("IMAGE", "PRIVATE", "user-a")).not.toBe(
      dedupeScopeFor("IMAGE", "HOUSEHOLD", "user-a"),
    );
  });

  it("视频和历史数据不参与内容去重", () => {
    expect(dedupeScopeFor("VIDEO", "HOUSEHOLD", "user-a")).toBeNull();
    expect(dedupeScopeFor("DOCUMENT", "PRIVATE", "user-a")).toBeNull();
  });

  it("未知可见性按共享处理，避免意外扩大私有范围", () => {
    expect(normalizedMediaVisibility("PRIVATE")).toBe("PRIVATE");
    expect(normalizedMediaVisibility("HOUSEHOLD")).toBe("HOUSEHOLD");
    expect(normalizedMediaVisibility(null)).toBe("HOUSEHOLD");
    expect(normalizedMediaVisibility("private")).toBe("HOUSEHOLD");
  });

  it("只把 Prisma P2002 识别为唯一约束冲突", () => {
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
    expect(isUniqueConstraintError({ code: "P2034" })).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError(new Error("P2002"))).toBe(false);
  });

  it("相册单次提交上限固定为 200", () => {
    expect(MAX_ALBUM_MEDIA_BATCH).toBe(200);
  });
});
