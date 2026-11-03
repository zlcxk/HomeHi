import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

export type AuditResult = "SUCCESS" | "DENIED" | "FAILED";

/** IP 只保存哈希，避免审计表本身变成一份可读的访问记录。 */
function hashIp(ip: string | null | undefined): string | null {
  const value = ip?.trim();
  if (!value || value === "unknown") return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 40);
}

/**
 * 追加一条审计记录。审计失败不应该影响主流程（例如导出），
 * 但必须在服务端日志里留下痕迹。
 */
export async function recordAuditEvent(input: {
  householdId?: string | null;
  userId?: string | null;
  action: string;
  result: AuditResult;
  ip?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        householdId: input.householdId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        result: input.result,
        ipHash: hashIp(input.ip),
        detail: input.detail ?? null,
      },
    });
  } catch (error) {
    console.error(
      "[audit] 写入审计日志失败：",
      error instanceof Error ? error.message : String(error),
    );
  }
}
