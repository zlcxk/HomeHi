"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { dateInputToUtc } from "@/lib/dates";
import {
  firstError,
  formString,
  profileSchema,
  type ActionState,
} from "@/lib/validation";

function revalidateProfileSurfaces(id?: string) {
  // 关联账号的档案改动会出现在时光、议题、待办和导航里，整棵路由一起失效。
  revalidatePath("/", "layout");
  revalidatePath("/profiles");
  revalidatePath("/my");
  if (id) revalidatePath(`/profiles/${id}`);
}

export async function saveProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  const id = formString(formData, "id");
  const timezone = context.household.timezone;

  const parsed = profileSchema.safeParse({
    profileType: formString(formData, "profileType") || "PERSON",
    name: formString(formData, "name"),
    birthday: formString(formData, "birthday"),
    joinedDate: formString(formData, "joinedDate"),
    species: formString(formData, "species"),
    breed: formString(formData, "breed"),
    gender: formString(formData, "gender"),
    description: formString(formData, "description"),
    visibility: formString(formData, "visibility") || "HOUSEHOLD",
    avatarMediaId: formString(formData, "avatarMediaId"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const birthday = data.birthday ? dateInputToUtc(data.birthday, timezone) : null;
  const joinedDate = data.joinedDate ? dateInputToUtc(data.joinedDate, timezone) : null;
  if (data.birthday && !birthday) return { error: "生日格式不正确" };
  if (data.joinedDate && !joinedDate) return { error: "日期格式不正确" };

  let avatarMediaId: string | null = null;
  if (data.avatarMediaId) {
    const media = await prisma.media.findFirst({
      where: {
        id: data.avatarMediaId,
        householdId: context.household.id,
        status: "ACTIVE",
        OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
      },
      select: { id: true },
    });
    avatarMediaId = media?.id ?? null;
  }

  const payload = {
    profileType: data.profileType,
    name: data.name,
    avatarMediaId,
    birthday,
    joinedDate,
    species: data.profileType === "PET" ? data.species || null : null,
    breed: data.profileType === "PET" ? data.breed || null : null,
    gender: data.gender || null,
    description: data.description || null,
    visibility: data.visibility,
  };

  let profileId = id;
  if (id) {
    const existing = await prisma.familyProfile.findFirst({
      where: {
        id,
        householdId: context.household.id,
        OR: [{ visibility: "HOUSEHOLD" }, { linkedUserId: context.user.id }],
      },
    });
    if (!existing) return { error: "档案不存在或没有权限" };
    if (existing.linkedUserId && existing.linkedUserId !== context.user.id && context.role !== "OWNER") {
      return { error: "只有管理员可以修改成员的档案" };
    }
    await prisma.$transaction(async (tx) => {
      await tx.familyProfile.update({ where: { id }, data: payload });
      if (existing.linkedUserId) {
        // 已关联账号的档案就是这个人：改称呼/头像时同步回账号，
        // 否则时光卡片、议题和导航会继续显示旧身份。
        await tx.user.update({
          where: { id: existing.linkedUserId },
          data: { displayName: data.name, avatarMediaId },
        });
      }
    });
  } else {
    const created = await prisma.familyProfile.create({
      data: {
        ...payload,
        householdId: context.household.id,
      },
    });
    profileId = created.id;
  }

  revalidateProfileSurfaces(profileId);
  redirect(`/profiles/${profileId}`);
}

export async function deleteProfileAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  if (context.role !== "OWNER") redirect("/profiles");

  const id = formString(formData, "id");
  const profile = await prisma.familyProfile.findFirst({
    where: { id, householdId: context.household.id },
  });
  if (profile && !profile.linkedUserId) {
    await prisma.familyProfile.delete({ where: { id } });
  }
  revalidateProfileSurfaces();
  redirect("/profiles");
}
