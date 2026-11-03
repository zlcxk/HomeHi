/**
 * 登录失败限流的纯逻辑：不依赖数据库，便于单元测试。
 * 存储层见 lib/login-throttle-store.ts。
 */
import { createHash } from "node:crypto";

export type ThrottlePolicy = {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
};

/** 单个邮箱 15 分钟内失败 5 次后锁定 15 分钟。 */
export const EMAIL_THROTTLE: ThrottlePolicy = {
  maxFailures: 5,
  windowMs: 15 * 60_000,
  lockMs: 15 * 60_000,
};

/** 单个 IP 阈值更高，避免家庭 / 公司 NAT 下误伤所有人。 */
export const IP_THROTTLE: ThrottlePolicy = {
  maxFailures: 20,
  windowMs: 15 * 60_000,
  lockMs: 15 * 60_000,
};

export type ThrottleBucket = { key: string; policy: ThrottlePolicy };

export type ThrottleRow = {
  key: string;
  failures: number;
  windowStartedAt: Date;
  lockedUntil: Date | null;
};

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 只把哈希写进数据库和日志，不保存明文邮箱 / IP。 */
export function throttleKey(prefix: "email" | "ip", value: string): string {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 40);
  return `${prefix}:${digest}`;
}

/**
 * 按标准化邮箱和 IP 各建一个桶。
 * 没有可信 IP（直连、没有反向代理头）时只按邮箱限流，避免 "unknown" 误锁所有人。
 */
export function loginThrottleBuckets(email: string, ip: string): ThrottleBucket[] {
  const buckets: ThrottleBucket[] = [
    { key: throttleKey("email", normalizeLoginEmail(email)), policy: EMAIL_THROTTLE },
  ];
  const normalizedIp = ip.trim();
  if (normalizedIp && normalizedIp !== "unknown") {
    buckets.push({ key: throttleKey("ip", normalizedIp), policy: IP_THROTTLE });
  }
  return buckets;
}

export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function throttleBlock(
  row: ThrottleRow | null | undefined,
  policy: ThrottlePolicy,
  now: number,
): { blocked: boolean; retryAfterMs: number } {
  if (row?.lockedUntil && row.lockedUntil.getTime() > now) {
    return { blocked: true, retryAfterMs: row.lockedUntil.getTime() - now };
  }
  // 窗口已过期时按全新一轮处理；policy 参与判断，避免调用方漏传窗口。
  if (row && now - row.windowStartedAt.getTime() >= policy.windowMs) {
    return { blocked: false, retryAfterMs: 0 };
  }
  return { blocked: false, retryAfterMs: 0 };
}

export function nextFailureState(
  row: ThrottleRow | null | undefined,
  policy: ThrottlePolicy,
  now: number,
): { failures: number; windowStartedAt: Date; lockedUntil: Date | null } {
  if (!row || now - row.windowStartedAt.getTime() >= policy.windowMs) {
    return { failures: 1, windowStartedAt: new Date(now), lockedUntil: null };
  }
  const failures = row.failures + 1;
  return {
    failures,
    windowStartedAt: row.windowStartedAt,
    lockedUntil: failures >= policy.maxFailures ? new Date(now + policy.lockMs) : row.lockedUntil,
  };
}

export function retryAfterMinutes(ms: number): number {
  return Math.max(1, Math.ceil(ms / 60_000));
}
