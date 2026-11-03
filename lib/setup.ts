import "server-only";

import { prisma } from "@/lib/db";
import { SETUP_COMPLETED_KEY } from "@/lib/constants";

export type SetupInput = {
  householdName: string;
  displayName: string;
  email: string;
  passwordHash: string;
  timezone: string;
};

export type SetupResult =
  | { ok: true; householdId: string; userId: string; sessionVersion: number }
  | { ok: false; error: string };

class SetupConflictError extends Error {}

function isConcurrentConflict(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code === "P2002" || code === "P2034") return true;
  // SQLite 在并发写入时可能直接返回 SQLITE_BUSY。
  const message = error instanceof Error ? error.message : "";
  return message.includes("SQLITE_BUSY") || message.includes("database is locked");
}

/** 供入口页和 Server Action 提前短路，避免已初始化后仍执行 bcrypt 等昂贵操作。 */
export async function isSetupComplete(): Promise<boolean> {
  const [marker, households] = await Promise.all([
    prisma.appSetting.findUnique({
      where: { key: SETUP_COMPLETED_KEY },
      select: { key: true },
    }),
    prisma.household.count(),
  ]);
  return Boolean(marker) || households > 0;
}

/**
 * 创建首个家庭。并发保护靠 AppSetting.key 的唯一约束：
 * 即使两个请求同时通过 count 检查，也只有一个能写入完成标记。
 * 标记与家庭数据在同一个事务里，失败时一起回滚。
 */
export async function createInitialHousehold(input: SetupInput): Promise<SetupResult> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const marker = await tx.appSetting.findUnique({
        where: { key: SETUP_COMPLETED_KEY },
        select: { key: true },
      });
      if (marker) throw new SetupConflictError();

      const existingHouseholds = await tx.household.count();
      if (existingHouseholds > 0) throw new SetupConflictError();

      await tx.appSetting.create({
        data: { key: SETUP_COMPLETED_KEY, value: new Date().toISOString() },
      });

      const household = await tx.household.create({
        data: {
          name: input.householdName,
          timezone: input.timezone,
        },
      });
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          displayName: input.displayName,
          timezone: input.timezone,
        },
      });
      await tx.householdMember.create({
        data: {
          householdId: household.id,
          userId: user.id,
          role: "OWNER",
        },
      });
      await tx.familyProfile.create({
        data: {
          householdId: household.id,
          profileType: "PERSON",
          name: input.displayName,
          linkedUserId: user.id,
          visibility: "HOUSEHOLD",
        },
      });

      return {
        householdId: household.id,
        userId: user.id,
        sessionVersion: user.sessionVersion,
      };
    });

    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof SetupConflictError || isConcurrentConflict(error)) {
      return { ok: false, error: "这个 HomeHi 已经完成初始化，请直接登录" };
    }
    // 并发写入可能表现为其他 Prisma 错误；只要家庭已经存在，就按“已初始化”处理。
    const householdExists = await prisma.household.count().catch(() => 0);
    if (householdExists > 0) {
      return { ok: false, error: "这个 HomeHi 已经完成初始化，请直接登录" };
    }
    throw error;
  }
}
