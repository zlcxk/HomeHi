import "server-only";

import { prisma } from "@/lib/db";
import {
  nextFailureState,
  throttleBlock,
  type ThrottleBucket,
} from "@/lib/login-throttle";

const THROTTLE_RETENTION_MS = 24 * 60 * 60_000;

export async function checkLoginThrottle(
  buckets: ThrottleBucket[],
): Promise<{ blocked: boolean; retryAfterMs: number }> {
  if (buckets.length === 0) return { blocked: false, retryAfterMs: 0 };

  const rows = await prisma.authThrottle.findMany({
    where: { key: { in: buckets.map((bucket) => bucket.key) } },
  });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const now = Date.now();

  let retryAfterMs = 0;
  for (const bucket of buckets) {
    const state = throttleBlock(byKey.get(bucket.key), bucket.policy, now);
    if (state.blocked) retryAfterMs = Math.max(retryAfterMs, state.retryAfterMs);
  }
  return { blocked: retryAfterMs > 0, retryAfterMs };
}

export async function recordLoginFailure(buckets: ThrottleBucket[]): Promise<void> {
  if (buckets.length === 0) return;
  const now = Date.now();

  await prisma.$transaction(async (tx) => {
    for (const bucket of buckets) {
      const row = await tx.authThrottle.findUnique({ where: { key: bucket.key } });
      const next = nextFailureState(row, bucket.policy, now);
      await tx.authThrottle.upsert({
        where: { key: bucket.key },
        create: { key: bucket.key, ...next },
        update: next,
      });
    }
    // 顺手清理过期记录，避免表随时间无限增长。
    await tx.authThrottle.deleteMany({
      where: { updatedAt: { lt: new Date(now - THROTTLE_RETENTION_MS) } },
    });
  });
}

export async function clearLoginFailures(buckets: ThrottleBucket[]): Promise<void> {
  if (buckets.length === 0) return;
  await prisma.authThrottle.deleteMany({
    where: { key: { in: buckets.map((bucket) => bucket.key) } },
  });
}
