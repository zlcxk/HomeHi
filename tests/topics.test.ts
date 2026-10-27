import { describe, expect, it } from "vitest";
import {
  deriveLinkTitle,
  detectLinkPlatform,
  extractSharedUrl,
  formatFileSize,
  topicState,
} from "@/lib/topics";

describe("topic links", () => {
  it("extracts a url from share text", () => {
    expect(
      extractSharedUrl(
        "周末去露营 复制打开小红书，看看【京郊露营攻略】 https://www.xiaohongshu.com/explore/abc123?x=1 复制本条信息，打开小红书查看",
      ),
    ).toBe("https://www.xiaohongshu.com/explore/abc123?x=1");
  });

  it("stops at Chinese punctuation", () => {
    expect(extractSharedUrl("https://example.com/a。下一句")).toBe("https://example.com/a");
  });

  it("rejects text without a link", () => {
    expect(extractSharedUrl("没有链接")).toBeNull();
    expect(extractSharedUrl("ftp://example.com/file")).toBeNull();
  });

  it("prefers the bracketed title from share text", () => {
    const text =
      "看看【京郊露营攻略】 https://www.xiaohongshu.com/explore/abc123 复制本条信息";
    const url = extractSharedUrl(text)!;
    expect(deriveLinkTitle(text, url)).toBe("京郊露营攻略");
  });

  it("detects platforms by host and falls back to share words", () => {
    expect(detectLinkPlatform("https://b23.tv/abcd", "")).toBe("B站");
    expect(detectLinkPlatform("https://example.com/post", "分享一篇小红书笔记")).toBe("小红书");
  });

  it("formats sizes", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});

describe("topic state", () => {
  it("shows a decision when a closed topic has one", () => {
    expect(topicState("CLOSED", true).label).toBe("已决定");
    expect(topicState("CLOSED", false).label).toBe("已结束");
    expect(topicState("OPEN", true).label).toBe("讨论中");
  });
});
