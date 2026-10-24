"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  getContext,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import {
  changePasswordSchema,
  firstError,
  formString,
  loginSchema,
  setupSchema,
  type ActionState,
} from "@/lib/validation";
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

  const existingHousehold = await prisma.household.count();
  if (existingHousehold > 0) return { error: "这个 HomeHi 已经完成初始化，请直接登录" };

  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingUser) return { error: "该邮箱已被使用" };

  const passwordHash = await hashPassword(parsed.data.password);

  const { householdId, userId } = await prisma.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: {
        name: parsed.data.householdName,
        timezone: parsed.data.timezone,
      },
    });
    const user = await tx.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        displayName: parsed.data.displayName,
        timezone: parsed.data.timezone,
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
        name: parsed.data.displayName,
        linkedUserId: user.id,
        visibility: "HOUSEHOLD",
      },
    });
    return { householdId: household.id, userId: user.id };
  });

  await createSession({ userId, householdId, role: "OWNER" });
  redirect("/today");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email").toLowerCase(),
    password: formString(formData, "password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { memberships: true },
  });
  if (!user) return { error: "邮箱或密码不正确" };

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return { error: "邮箱或密码不正确" };

  const membership = user.memberships[0];
  if (!membership) return { error: "这个账号还没有加入任何家庭空间" };

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({
    userId: user.id,
    householdId: membership.householdId,
    role: membership.role,
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

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  revalidatePath("/settings/profile");
  return { success: "密码已更新" };
}
