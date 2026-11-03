"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  getContext,
  hashPassword,
  verifyPassword,
  verifyPasswordOrDummy,
} from "@/lib/auth";
import {
  changePasswordSchema,
  firstError,
  formString,
  loginSchema,
  setupSchema,
  type ActionState,
} from "@/lib/validation";
import { createInitialHousehold, isSetupComplete } from "@/lib/setup";
import { clientIp, loginThrottleBuckets, retryAfterMinutes } from "@/lib/login-throttle";
import {
  checkLoginThrottle,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/login-throttle-store";
import { isValidTimezone } from "@/lib/timezones";

export async function setupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = setupSchema.safeParse({
    householdName: formString(formData, "householdName"),
    displayName: formString(formData, "displayName"),
    email: formString(formData, "email").toLowerCase(),
    password: formString(formData, "password"),
    timezone: formString(formData, "timezone"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!isValidTimezone(parsed.data.timezone)) return { error: "时区不可用，请选择列表中的时区" };

  // 已初始化时直接返回，避免未认证请求反复触发 bcrypt；最终仍由 createInitialHousehold 判定。
  // 这里不查询邮箱是否存在，避免把 setup 变成账号枚举接口。
  if (await isSetupComplete()) {
    return { error: "这个 HomeHi 已经完成初始化，请直接登录" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const result = await createInitialHousehold({
    householdName: parsed.data.householdName,
    displayName: parsed.data.displayName,
    email: parsed.data.email,
    passwordHash,
    timezone: parsed.data.timezone,
  });
  if (!result.ok) return { error: result.error };

  await createSession({
    userId: result.userId,
    householdId: result.householdId,
    role: "OWNER",
    sessionVersion: result.sessionVersion,
  });
  redirect("/today");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email").toLowerCase(),
    password: formString(formData, "password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const requestHeaders = await headers();
  const buckets = loginThrottleBuckets(parsed.data.email, clientIp(requestHeaders));
  const throttle = await checkLoginThrottle(buckets);
  if (throttle.blocked) {
    return {
      error: `尝试次数过多，请 ${retryAfterMinutes(throttle.retryAfterMs)} 分钟后再试`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { memberships: true },
  });

  // 用户不存在时也执行一次 bcrypt，避免通过响应时间枚举邮箱。
  const valid = await verifyPasswordOrDummy(parsed.data.password, user?.passwordHash);
  if (!user || !valid) {
    await recordLoginFailure(buckets);
    return { error: "邮箱或密码不正确" };
  }

  const membership = user.memberships[0];
  if (!membership) return { error: "这个账号还没有加入任何家庭空间" };

  await clearLoginFailures(buckets);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({
    userId: user.id,
    householdId: membership.householdId,
    role: membership.role,
    sessionVersion: user.sessionVersion,
  });
  redirect("/today");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formString(formData, "currentPassword"),
    newPassword: formString(formData, "newPassword"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const user = await prisma.user.findUnique({ where: { id: context.user.id } });
  if (!user) return { error: "账号不存在" };

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { error: "当前密码不正确" };

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      sessionVersion: { increment: 1 },
    },
    select: { sessionVersion: true },
  });

  // 旧 JWT 因版本号不匹配立即失效；当前设备换发一张新 Cookie，保持登录。
  await createSession({
    userId: user.id,
    householdId: context.household.id,
    role: context.role,
    sessionVersion: updated.sessionVersion,
  });
  revalidatePath("/settings/profile");
  return { success: "密码已更新，其他设备上的登录已失效" };
}
