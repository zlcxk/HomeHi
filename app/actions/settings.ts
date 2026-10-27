"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext, hashPassword } from "@/lib/auth";
import { sendTestEmail, smtpStatus } from "@/lib/mailer";
import { isValidTimezone } from "@/lib/timezones";
import {
  getStorageConfig,
  normalizeOssConfig,
  saveStorageConfig,
  testStorageConfig,
  type StorageConfig,
} from "@/lib/storage";
import {
  firstError,
  formBoolean,
  formString,
  householdSchema,
  memberSchema,
  profileSettingsSchema,
  storageSchema,
  type ActionState,
} from "@/lib/validation";

export async function updateAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };

  const parsed = profileSettingsSchema.safeParse({
    displayName: formString(formData, "displayName"),
    timezone: context.user.timezone,
    defaultVisibility: formString(formData, "defaultVisibility") || "HOUSEHOLD",
    avatarMediaId: formString(formData, "avatarMediaId"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  let avatarMediaId: string | null = null;
  if (parsed.data.avatarMediaId) {
    const media = await prisma.media.findFirst({
      where: {
        id: parsed.data.avatarMediaId,
        householdId: context.household.id,
        status: "ACTIVE",
        OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
      },
      select: { id: true },
    });
    if (!media) return { error: "头像照片不可用，请重新选择" };
    avatarMediaId = media.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: context.user.id },
      data: {
        displayName: parsed.data.displayName,
        defaultVisibility: parsed.data.defaultVisibility,
        avatarMediaId,
      },
    });
    // 账号是这个人的身份来源：同步到已关联的家庭档案，避免两个地方各叫各的。
    await tx.familyProfile.updateMany({
      where: {
        householdId: context.household.id,
        linkedUserId: context.user.id,
      },
      data: { name: parsed.data.displayName, avatarMediaId },
    });
  });

  // 称呼与头像出现在时光、议题、待办、导航等所有页面，整棵路由一起失效。
  revalidatePath("/", "layout");
  return { success: "已保存" };
}

export async function updateNotificationPrefsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };

  await prisma.user.update({
    where: { id: context.user.id },
    data: {
      notifyEvent: formBoolean(formData, "notifyEvent"),
      notifyTask: formBoolean(formData, "notifyTask"),
      notifyOther: formBoolean(formData, "notifyOther"),
    },
  });

  revalidatePath("/settings/notifications");
  revalidatePath("/my");
  return { success: "通知偏好已更新。新的提醒会按这个设置发送。" };
}

export async function updateHouseholdAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  if (context.role !== "OWNER") return { error: "只有家庭管理员可以修改家庭设置" };

  const parsed = householdSchema.safeParse({
    name: formString(formData, "name"),
    timezone: formString(formData, "timezone"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!isValidTimezone(parsed.data.timezone)) return { error: "时区不可用，请从列表中选择" };

  await prisma.household.update({
    where: { id: context.household.id },
    data: { name: parsed.data.name, timezone: parsed.data.timezone },
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings/household");
  return { success: "家庭设置已更新" };
}

type StorageFormResult = { config: StorageConfig } | { error: string };

async function readStorageForm(formData: FormData): Promise<StorageFormResult> {
  const parsed = storageSchema.safeParse({
    driver: formString(formData, "driver") || "LOCAL",
    ossRegion: formString(formData, "ossRegion"),
    ossBucket: formString(formData, "ossBucket"),
    ossAccessKeyId: formString(formData, "ossAccessKeyId"),
    ossAccessKeySecret: formString(formData, "ossAccessKeySecret"),
    ossEndpoint: formString(formData, "ossEndpoint"),
    ossPrefix: formString(formData, "ossPrefix"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const data = parsed.data;
  const existing = await getStorageConfig();
  const hasOssInput = Boolean(
    data.ossRegion || data.ossBucket || data.ossAccessKeyId || data.ossAccessKeySecret,
  );

  // 用已保存的值补全留空字段；Secret 留空表示“保持不变”。
  const oss = hasOssInput
    ? normalizeOssConfig({
        region: data.ossRegion || existing.oss?.region,
        bucket: data.ossBucket || existing.oss?.bucket,
        accessKeyId: data.ossAccessKeyId || existing.oss?.accessKeyId,
        accessKeySecret: data.ossAccessKeySecret || existing.oss?.accessKeySecret,
        endpoint: data.ossEndpoint,
        prefix: data.ossPrefix,
      })
    : existing.oss;

  if (data.driver === "OSS" && !oss) {
    return { error: "使用阿里云 OSS 需要填写 Region、Bucket、AccessKey ID 和 AccessKey Secret" };
  }

  return { config: { driver: data.driver, oss } };
}

export async function updateStorageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  if (context.role !== "OWNER") return { error: "只有家庭管理员可以修改存储设置" };

  const result = await readStorageForm(formData);
  if ("error" in result) return { error: result.error };

  if (formString(formData, "intent") === "test") {
    try {
      await testStorageConfig(result.config);
      return { success: "连接正常：测试文件已写入并删除。" };
    } catch (error) {
      return {
        error: `连接失败：${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  }

  await saveStorageConfig(result.config);
  revalidatePath("/settings/storage");
  revalidatePath("/settings/data");
  return {
    success:
      result.config.driver === "OSS"
        ? "已切换到阿里云 OSS。之后上传的新文件会写入 OSS，已有文件仍可正常访问。"
        : "已切换到本地磁盘。之后上传的新文件会写入 storage/ 目录，已有文件仍可正常访问。",
  };
}

export async function addMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  if (context.role !== "OWNER") return { error: "只有家庭管理员可以添加成员" };

  const parsed = memberSchema.safeParse({
    email: formString(formData, "email").toLowerCase(),
    displayName: formString(formData, "displayName"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { memberships: true },
  });
  if (existing) {
    if (existing.memberships.some((m) => m.householdId === context.household.id)) {
      return { error: "这个邮箱已经是家庭成员" };
    }
    return { error: "这个邮箱已被其他账号使用，请换一个" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        passwordHash,
        timezone: context.household.timezone,
      },
    });
    await tx.householdMember.create({
      data: { householdId: context.household.id, userId: user.id, role: "MEMBER" },
    });
    await tx.familyProfile.create({
      data: {
        householdId: context.household.id,
        profileType: "PERSON",
        name: parsed.data.displayName,
        linkedUserId: user.id,
      },
    });
  });

  revalidatePath("/settings/household");
  revalidatePath("/profiles");
  return {
    success: `已添加 ${parsed.data.displayName}。请通过安全的方式把邮箱和临时密码告诉 TA，登录后可自行修改密码。`,
  };
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context || context.role !== "OWNER") return;
  const userId = formString(formData, "userId");
  if (!userId || userId === context.user.id) return;

  const membership = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId: context.household.id, userId } },
  });
  if (membership) {
    await prisma.householdMember.delete({
      where: { householdId_userId: { householdId: context.household.id, userId } },
    });
    await prisma.familyProfile.updateMany({
      where: { householdId: context.household.id, linkedUserId: userId },
      data: { linkedUserId: null },
    });
  }
  revalidatePath("/settings/household");
  revalidatePath("/profiles");
}

export async function sendTestEmailAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  if (context.role !== "OWNER") return { error: "只有家庭管理员可以测试邮件" };
  const status = smtpStatus();
  if (!status.configured) {
    return { error: `SMTP 尚未配置完整，缺少：${status.missing.join("、")}` };
  }
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await sendTestEmail(context.user.email, appUrl);
    return { success: `测试邮件已发送到 ${context.user.email}，请检查收件箱和垃圾邮件。` };
  } catch (error) {
    return {
      error: `发送失败：${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}
