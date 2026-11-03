import { describe, expect, it } from "vitest";
import {
  clientIp,
  EMAIL_THROTTLE,
  IP_THROTTLE,
  loginThrottleBuckets,
  nextFailureState,
  retryAfterMinutes,
  throttleBlock,
  throttleKey,
  type ThrottleRow,
} from "@/lib/login-throttle";

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

describe("login throttle keys", () => {
  it("never stores the raw email or IP", () => {
    const key = throttleKey("email", "someone@example.com");
    expect(key).toMatch(/^email:[a-f0-9]{40}$/);
    expect(key).not.toContain("someone");
    expect(key).not.toContain("@");
  });

  it("normalizes email case and trims whitespace", () => {
    const upper = loginThrottleBuckets("  Someone@Example.com ", "1.2.3.4");
    const lower = loginThrottleBuckets("someone@example.com", "1.2.3.4");
    expect(upper.map((bucket) => bucket.key)).toEqual(lower.map((bucket) => bucket.key));
  });

  it("creates email and IP buckets separately", () => {
    const buckets = loginThrottleBuckets("a@b.com", "1.2.3.4");
    expect(buckets).toHaveLength(2);
    expect(buckets[0].policy).toBe(EMAIL_THROTTLE);
    expect(buckets[1].policy).toBe(IP_THROTTLE);
  });

  it("skips the IP bucket when no forwarding header is available", () => {
    expect(loginThrottleBuckets("a@b.com", "unknown")).toHaveLength(1);
    expect(loginThrottleBuckets("a@b.com", "  ")).toHaveLength(1);
  });
});

describe("client IP parsing", () => {
  it("uses the first x-forwarded-for entry", () => {
    const headers = { get: (name: string) => (name === "x-forwarded-for" ? "9.9.9.9, 10.0.0.1" : null) };
    expect(clientIp(headers)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIp({ get: (name: string) => (name === "x-real-ip" ? "8.8.8.8" : null) })).toBe("8.8.8.8");
    expect(clientIp({ get: () => null })).toBe("unknown");
  });
});

describe("throttle state", () => {
  const row = (overrides: Partial<ThrottleRow> = {}): ThrottleRow => ({
    key: "email:test",
    failures: 1,
    windowStartedAt: new Date(NOW),
    lockedUntil: null,
    ...overrides,
  });

  it("allows attempts while no lock is active", () => {
    expect(throttleBlock(null, EMAIL_THROTTLE, NOW).blocked).toBe(false);
    expect(throttleBlock(row(), EMAIL_THROTTLE, NOW).blocked).toBe(false);
  });

  it("blocks until the lock expires", () => {
    const locked = row({ lockedUntil: new Date(NOW + 5 * 60_000) });
    expect(throttleBlock(locked, EMAIL_THROTTLE, NOW)).toEqual({
      blocked: true,
      retryAfterMs: 5 * 60_000,
    });
    expect(throttleBlock(locked, EMAIL_THROTTLE, NOW + 5 * 60_000).blocked).toBe(false);
  });

  it("locks the bucket when the failure limit is reached", () => {
    const atLimit = row({ failures: EMAIL_THROTTLE.maxFailures - 1 });
    const next = nextFailureState(atLimit, EMAIL_THROTTLE, NOW);
    expect(next.failures).toBe(EMAIL_THROTTLE.maxFailures);
    expect(next.lockedUntil?.getTime()).toBe(NOW + EMAIL_THROTTLE.lockMs);
  });

  it("resets the counter when the window has passed", () => {
    const expired = row({
      failures: EMAIL_THROTTLE.maxFailures,
      windowStartedAt: new Date(NOW - EMAIL_THROTTLE.windowMs - 1),
      lockedUntil: new Date(NOW - 1),
    });
    const next = nextFailureState(expired, EMAIL_THROTTLE, NOW);
    expect(next.failures).toBe(1);
    expect(next.lockedUntil).toBeNull();
  });

  it("rounds retry time up to whole minutes with a minimum of one", () => {
    expect(retryAfterMinutes(1)).toBe(1);
    expect(retryAfterMinutes(61_000)).toBe(2);
  });
});
