import { describe, expect, it } from "vitest";
import { resolveSecureCookie } from "@/lib/session-cookie";

describe("resolveSecureCookie", () => {
  it("没有 HTTPS 证据时不设置 Secure，否则浏览器会丢弃登录 Cookie", () => {
    expect(resolveSecureCookie({})).toBe(false);
    expect(resolveSecureCookie({ forwardedProto: "" })).toBe(false);
  });

  it("反向代理声明 HTTPS 时设置 Secure", () => {
    expect(resolveSecureCookie({ forwardedProto: "https" })).toBe(true);
    expect(resolveSecureCookie({ forwardedProto: "HTTPS" })).toBe(true);
    expect(resolveSecureCookie({ forwardedProto: "http" })).toBe(false);
    expect(resolveSecureCookie({ forwardedProto: "https, http" })).toBe(true);
  });

  it("COOKIE_SECURE 可以强制覆盖自动判断", () => {
    expect(resolveSecureCookie({ override: "true", forwardedProto: "http" })).toBe(true);
    expect(resolveSecureCookie({ override: "FALSE", forwardedProto: "https" })).toBe(false);
    expect(resolveSecureCookie({ override: "", forwardedProto: "https" })).toBe(true);
  });
});
