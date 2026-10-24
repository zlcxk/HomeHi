"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { canViewEntry } from "@/lib/access";
import { localInputToUtc } from "@/lib/dates";
import {
  entrySchema,
  firstError,
  formArray,
  formString,
  type ActionState,
} from "@/lib/validation";

function revalidateEntrySurfaces(entryId?: string) {
  revalidatePath("/today");
  revalidatePath("/timeline");
  revalidatePath("/photos");
  revalidatePath("/my");
  revalidatePath("/profiles");
  revalidatePath("/search");
  revalidatePath("/trash");
  if (entryId) revalidatePath(`/entries/${entryId}`);
}

export async function saveEntryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };

  const id = formString(formData, "id");
  const rawTags = formString(formData, "tags");
  let tags: string[] = [];
  if (rawTags) {
    try {
      const parsed = JSON.parse(rawTags);
      tags = Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
    } catch {
      tags = rawTags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
    }
  }

  const parsed = entrySchema.safeParse({
    title: formString(formData, "title"),
    body: formString(formData, "body"),
    entryType: formString(formData, "entryType") || "GENERAL",
    occurredAt: formString(formData, "occurredAt"),
    visibility: formString(formData, "visibility") || context.user.defaultVisibility,
    status: formString(formData, "status") || "PUBLISHED",
    mediaIds: Array.from(new Set(formArray(formData, "mediaIds"))).slice(0, 60),
    profileIds: Array.from(new Set(formArray(formData, "profileIds"))).slice(0, 30),
    tags: Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 20),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const data = parsed.data;
  const occurredAt = localInputToUtc(data.occurredAt, context.household.timezone);
  if (!occurredAt) return { error: "发生时间格式不正确" };

  if (!data.title && !data.body && data.mediaIds.length === 0) {
    return { error: "写一句话，或先放一张照片吧" };
  }

  const media = data.mediaIds.length
    ? await prisma.media.findMany({
        where: {
          id: { in: data.mediaIds },
          householdId: context.household.id,
          status: "ACTIVE",
          OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
        },
        include: {
          _count: { select: { entryLinks: true, albumLinks: true } },
        },
      })
    : [];
  if (media.length !== data.mediaIds.length) return { error: "有照片已失效，请重新选择" };

  const profiles = data.profileIds.length
    ? await prisma.familyProfile.findMany({
        where: {
          id: { in: data.profileIds },
          householdId: context.household.id,
          OR: [{ visibility: "HOUSEHOLD" }, { linkedUserId: context.user.id }],
        },
        select: { id: true },
      })
    : [];
  if (profiles.length !== data.profileIds.length) return { error: "有家庭成员档案不可用" };

  if (id) {
    const existing = await prisma.entry.findUnique({ where: { id } });
    if (
      !existing ||
      existing.householdId !== context.household.id ||
      !canViewEntry(existing, { userId: context.user.id, householdId: context.household.id })
    ) {
      return { error: "这条记录不存在或你没有权限编辑" };
    }
  }

  let entryId = id;

  await prisma.$transaction(async (tx) => {
    const entryData = {
      entryType: data.entryType,
      title: data.title || null,
      body: data.body || null,
      occurredAt,
      coverMediaId: data.mediaIds[0] || null,
      visibility: data.visibility,
      status: data.status,
      deletedAt: null,
    };

    if (entryId) {
      await tx.entry.update({
        where: { id: entryId },
        data: entryData,
      });
      await tx.entryMedia.deleteMany({ where: { entryId } });
      await tx.entryProfile.deleteMany({ where: { entryId } });
      await tx.entryTag.deleteMany({ where: { entryId } });
    } else {
      const created = await tx.entry.create({
        data: {
          ...entryData,
          householdId: context.household.id,
          createdBy: context.user.id,
        },
      });
      entryId = created.id;
    }

    if (data.mediaIds.length > 0 && entryId) {
      await tx.entryMedia.createMany({
        data: data.mediaIds.map((mediaId, index) => ({
          entryId: entryId!,
          mediaId,
          sortOrder: index,
        })),
      });
    }

    if (data.profileIds.length > 0 && entryId) {
      await tx.entryProfile.createMany({
        data: data.profileIds.map((profileId) => ({
          entryId: entryId!,
          profileId,
        })),
      });
    }

    const tagIds: string[] = [];
    for (const name of data.tags) {
      const tag = await tx.tag.upsert({
        where: { householdId_name: { householdId: context.household.id, name } },
        create: { householdId: context.household.id, name },
        update: {},
      });
      tagIds.push(tag.id);
    }
    if (tagIds.length > 0 && entryId) {
      await tx.entryTag.createMany({
        data: tagIds.map((tagId) => ({ entryId: entryId!, tagId })),
      });
    }
  });

  // Align privacy of freshly attached media with the entry, unless it is shared elsewhere.
  if (entryId && data.mediaIds.length > 0) {
    for (const item of media) {
      if (item.uploadedBy !== context.user.id) continue;
      const onlyHere =
        item._count.albumLinks === 0 &&
        (item._count.entryLinks === 0 || (id && item._count.entryLinks === 1));
      if (onlyHere && item.visibility !== data.visibility) {
        await prisma.media.update({
          where: { id: item.id },
          data: { visibility: data.visibility },
        });
      }
    }
  }

  revalidateEntrySurfaces(entryId);
  redirect(`/entries/${entryId}`);
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const entry = await prisma.entry.findUnique({ where: { id } });
  if (
    !entry ||
    !canViewEntry(entry, { userId: context.user.id, householdId: context.household.id })
  ) {
    redirect("/timeline");
  }
  await prisma.entry.update({
    where: { id },
    data: { status: "DELETED", deletedAt: new Date() },
  });
  revalidateEntrySurfaces(id);
  redirect("/timeline");
}

export async function setEntryStatusAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const status = formString(formData, "status");
  if (!["PUBLISHED", "ARCHIVED", "DRAFT"].includes(status)) return;
  const entry = await prisma.entry.findUnique({ where: { id } });
  if (
    !entry ||
    !canViewEntry(entry, { userId: context.user.id, householdId: context.household.id })
  ) {
    return;
  }
  await prisma.entry.update({
    where: { id },
    data: {
      status,
      deletedAt: null,
    },
  });
  revalidateEntrySurfaces(id);
  redirect(status === "ARCHIVED" ? `/entries/${id}` : "/timeline");
}

export async function restoreEntryAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const entry = await prisma.entry.findUnique({ where: { id } });
  if (
    entry &&
    canViewEntry(entry, { userId: context.user.id, householdId: context.household.id })
  ) {
    await prisma.entry.update({
      where: { id },
      data: { status: "PUBLISHED", deletedAt: null },
    });
  }
  revalidateEntrySurfaces(id);
  revalidatePath("/trash");
}

export async function purgeEntryAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const entry = await prisma.entry.findUnique({ where: { id } });
  if (
    entry &&
    entry.householdId === context.household.id &&
    entry.createdBy === context.user.id &&
    entry.status === "DELETED"
  ) {
    await prisma.entry.delete({ where: { id } });
  }
  revalidateEntrySurfaces(id);
  revalidatePath("/trash");
}
