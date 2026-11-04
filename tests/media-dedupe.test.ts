import { describe, expect, it } from "vitest";
import {
  MAX_ALBUM_MEDIA_BATCH,
  SHARED_DEDUPE_SCOPE,
  dedupeScopeFor,
  isUniqueConstraintError,
  normalizedMediaVisibility,
} from "@/lib/media-dedupe";

describe("media dedupe scope", () => {
  it("共享图片在同一家庭内使用固定 scope", () => {
    expect(dedupeScopeFor("IMAGE", "HOUSEHOLD", "user-a")).toBe(SHARED_DEDUPE_SCOPE);
    expect(dedupeScopeFor("IMAGE", undefined, "user-a")).toBe(SHARED_DEDUPE_SCOPE);
  });

  it("私有图片按上传者隔离", () => {
    expect(dedupeScopeFor("IMAGE", "PRIVATE", "user-a")).toBe("user-a");
    expect(dedupeScopeFor("IMAGE", "PRIVATE", "user-b")).toBe("user-b");
    expect(dedupeScopeFor("IMAGE", "PRIVATE", "user-a")).not.toBe(
      dedupeScopeFor("IMAGE", "PRIVATE", "user-b"),
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
