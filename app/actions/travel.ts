"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { dateInputToUtc } from "@/lib/dates";
import { tripWhere } from "@/lib/access";
import { normalizeTripLink, parseCoordinates } from "@/lib/travel";
import { findTravelTemplate, templateEntries } from "@/lib/travel-templates";
import {
  firstError,
  formArray,
  formString,
  tripLinkSchema,
  tripPlaceSchema,
  tripSchema,
  tripVisitSchema,
  type ActionState,
} from "@/lib/validation";

function revalidateTravel(tripId?: string) {
  revalidatePath("/travel");
  revalidatePath("/my");
  if (tripId) revalidatePath(`/travel/${tripId}`);
}

async function findTrip(id: string, context: NonNullable<Awaited<ReturnType<typeof getContext>>>) {
  return prisma.trip.findFirst({
    where: { id, ...tripWhere({ userId: context.user.id, householdId: context.household.id }) },
    select: { id: true },
  });
}

export async function saveTripAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  const id = formString(formData, "id");
  const timezone = context.household.timezone;

  const parsed = tripSchema.safeParse({
    kind: formString(formData, "kind") || "SINGLE",
    title: formString(formData, "title"),
    subtitle: formString(formData, "subtitle"),
    description: formString(formData, "description"),
    startDate: formString(formData, "startDate"),
    endDate: formString(formData, "endDate"),
    status: formString(formData, "status") || "PLANNING",
    coverMediaId: formString(formData, "coverMediaId"),
    visibility: formString(formData, "visibility") || "HOUSEHOLD",
    templateId: formString(formData, "templateId"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const startDate = data.kind === "SINGLE" && data.startDate ? dateInputToUtc(data.startDate, timezone) : null;
  const endDate = data.kind === "SINGLE" && data.endDate ? dateInputToUtc(data.endDate, timezone) : null;
  if (data.kind === "SINGLE" && data.startDate && !startDate) return { error: "开始日期格式不正确" };
  if (data.kind === "SINGLE" && data.endDate && !endDate) return { error: "结束日期格式不正确" };
  if (startDate && endDate && endDate < startDate) return { error: "结束日期不能早于开始日期" };

  let coverMediaId: string | null = null;
  if (data.coverMediaId) {
    const media = await prisma.media.findFirst({
      where: {
        id: data.coverMediaId,
        householdId: context.household.id,
        status: "ACTIVE",
        OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
      },
      select: { id: true },
    });
    coverMediaId = media?.id ?? null;
  }

  const payload = {
    kind: data.kind,
    title: data.title,
    subtitle: data.subtitle || null,
    description: data.description || null,
    coverMediaId,
    startDate,
    endDate,
    status: data.status,
    visibility: data.visibility,
  };

  let tripId = id;
  if (id) {
    const existing = await findTrip(id, context);
    if (!existing) return { error: "旅行不存在或没有编辑权限" };
    await prisma.trip.update({ where: { id }, data: payload });
  } else {
    // 模板只提供初始地点/事项，之后和普通主题旅行完全一样，可以自由增删
    const template =
      data.kind === "THEME" && data.templateId ? findTravelTemplate(data.templateId) : undefined;
    // 只有新的分类事项模板登记 templateId 并做幂等复用；
    // 传统地点模板保持原有行为，允许重复创建。
    const managedTemplate = template?.categories?.length ? template : undefined;

    // 同一个账号重复启用同一模板时，直接复用已有旅行，不重复初始化事项。
    if (managedTemplate) {
      const existing = await prisma.trip.findFirst({
        where: {
          householdId: context.household.id,
          createdBy: context.user.id,
          templateId: managedTemplate.id,
        },
        select: { id: true },
      });
      if (existing) {
        revalidateTravel(existing.id);
        redirect(`/travel/${existing.id}`);
      }
    }

    const entries = template ? templateEntries(template) : [];
    let created: { id: string };
    try {
      created = await prisma.trip.create({
        data: {
          ...payload,
          householdId: context.household.id,
          createdBy: context.user.id,
          templateId: managedTemplate?.id ?? null,
          coverImage: template?.cover ?? null,
          ...(template
            ? {
                places: {
                  create: entries.map((entry) => ({
                    name: entry.name,
                    region: entry.region || null,
                    category: entry.category,
                    sortOrder: entry.sortOrder,
                  })),
                },
              }
            : {}),
        },
        select: { id: true },
      });
    } catch (error) {
      // 并发重复提交时唯一索引会拒绝第二次创建，找到已有实例即可。
      if (managedTemplate && isUniqueConstraintError(error)) {
        const existing = await prisma.trip.findFirst({
          where: {
            householdId: context.household.id,
            createdBy: context.user.id,
            templateId: managedTemplate.id,
          },
          select: { id: true },
        });
        if (existing) {
          revalidateTravel(existing.id);
          redirect(`/travel/${existing.id}`);
        }
      }
      throw error;
    }
    tripId = created.id;
  }

  revalidateTravel(tripId);
  redirect(`/travel/${tripId}`);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * 从旅行页的主题卡片一键启用内置模板。
 * 复用与新建主题旅行相同的数据结构；重复启用同一模板会回到已有实例。
 */
export async function enableTripTemplateAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");

  const templateId = formString(formData, "templateId");
  const template = findTravelTemplate(templateId);
  if (!template?.categories?.length) redirect("/travel");

  const existing = await prisma.trip.findFirst({
    where: {
      householdId: context.household.id,
      createdBy: context.user.id,
      templateId: template.id,
    },
    select: { id: true },
  });
  if (existing) {
    revalidateTravel(existing.id);
    redirect(`/travel/${existing.id}`);
  }

  const entries = templateEntries(template);
  let tripId: string;
  try {
    const created = await prisma.trip.create({
      data: {
        householdId: context.household.id,
        createdBy: context.user.id,
        kind: "THEME",
        title: template.title,
        subtitle: template.subtitle,
        description: template.description,
        coverImage: template.cover,
        status: "PLANNING",
        visibility: context.user.defaultVisibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD",
        templateId: template.id,
        places: {
          create: entries.map((entry) => ({
            name: entry.name,
            region: entry.region || null,
            category: entry.category,
            sortOrder: entry.sortOrder,
          })),
        },
      },
      select: { id: true },
    });
    tripId = created.id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const again = await prisma.trip.findFirst({
        where: {
          householdId: context.household.id,
          createdBy: context.user.id,
          templateId: template.id,
        },
        select: { id: true },
      });
      if (again) {
        revalidateTravel(again.id);
        redirect(`/travel/${again.id}`);
      }
    }
    throw error;
  }

  revalidateTravel(tripId);
  redirect(`/travel/${tripId}`);
}

export async function deleteTripAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const trip = await findTrip(id, context);
  if (!trip) redirect("/travel");

  // 封面照片和到访照片都留在媒体库里，删除旅行只删关系。
  await prisma.trip.delete({ where: { id } });
  revalidateTravel();
  redirect("/travel");
}

export async function saveTripPlaceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  const tripId = formString(formData, "tripId");
  const id = formString(formData, "id");
  const trip = await findTrip(tripId, context);
  if (!trip) return { error: "旅行不存在或没有编辑权限" };

  const parsed = tripPlaceSchema.safeParse({
    name: formString(formData, "name"),
    region: formString(formData, "region"),
    address: formString(formData, "address"),
    note: formString(formData, "note"),
    latitude: formString(formData, "latitude"),
    longitude: formString(formData, "longitude"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;
  const coordinates = parseCoordinates(data.latitude, data.longitude);

  const payload = {
    name: data.name,
    region: data.region || null,
    address: data.address || null,
    note: data.note || null,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
  };

  let placeId = id;
  if (id) {
    const existing = await prisma.tripPlace.findFirst({
      where: { id, tripId },
      select: { id: true },
    });
    if (!existing) return { error: "这个地点不属于当前旅行" };
    await prisma.tripPlace.update({ where: { id }, data: payload });
  } else {
    const max = await prisma.tripPlace.aggregate({
      where: { tripId },
      _max: { sortOrder: true },
    });
    const created = await prisma.tripPlace.create({
      data: { ...payload, tripId, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
    placeId = created.id;
  }

  revalidatePath(`/travel/${tripId}`);
  revalidatePath(`/travel/${tripId}/places/${placeId}`);
  redirect(`/travel/${tripId}/places/${placeId}`);
}

export async function deleteTripPlaceAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const tripId = formString(formData, "tripId");
  const id = formString(formData, "id");
  const trip = await findTrip(tripId, context);
  if (!trip) redirect("/travel");

  await prisma.tripPlace.deleteMany({ where: { id, tripId } });
  revalidatePath(`/travel/${tripId}`);
  redirect(`/travel/${tripId}`);
}

export async function addTripVisitAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  const tripId = formString(formData, "tripId");
  const placeId = formString(formData, "placeId");
  const visitId = formString(formData, "id");

  const place = await prisma.tripPlace.findFirst({
    where: {
      id: placeId,
      tripId,
      trip: tripWhere({ userId: context.user.id, householdId: context.household.id }),
    },
    select: { id: true },
  });
  if (!place) return { error: "地点不存在或没有权限" };

  // 编辑时只替换当前用户看得见的照片关联，保留其他成员的私密照片。
  let editablePhotoMediaIds: string[] = [];
  if (visitId) {
    const visit = await prisma.tripVisit.findFirst({
      where: {
        id: visitId,
        placeId,
        place: {
          tripId,
          trip: tripWhere({ userId: context.user.id, householdId: context.household.id }),
        },
      },
      select: {
        id: true,
        photos: {
          select: {
            mediaId: true,
            media: { select: { status: true, visibility: true, uploadedBy: true } },
          },
        },
      },
    });
    if (!visit) return { error: "打卡记录不存在或没有编辑权限" };
    editablePhotoMediaIds = visit.photos
      .filter(
        (photo) =>
          photo.media.status === "ACTIVE" &&
          (photo.media.visibility === "HOUSEHOLD" ||
            photo.media.uploadedBy === context.user.id),
      )
      .map((photo) => photo.mediaId);
  }

  const parsed = tripVisitSchema.safeParse({
    visitedAt: formString(formData, "visitedAt"),
    location: formString(formData, "location"),
    note: formString(formData, "note"),
    mediaIds: Array.from(new Set(formArray(formData, "mediaIds"))).slice(0, 30),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const visitedAt = dateInputToUtc(data.visitedAt, context.household.timezone);
  if (!visitedAt) return { error: "到访日期格式不正确" };

  const media = data.mediaIds.length
    ? await prisma.media.findMany({
        where: {
          id: { in: data.mediaIds },
          householdId: context.household.id,
          status: "ACTIVE",
          OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
        },
        select: { id: true },
      })
    : [];
  if (media.length !== data.mediaIds.length) return { error: "有照片已失效，请重新选择" };

  const photoCreate = data.mediaIds.length
    ? { create: data.mediaIds.map((mediaId, index) => ({ mediaId, sortOrder: index })) }
    : {};

  if (visitId) {
    // 编辑时替换可见的照片关系：先删旧关联再建新关联，避免重复或孤立记录。
    await prisma.tripVisit.update({
      where: { id: visitId },
      data: {
        visitedAt,
        location: data.location || null,
        note: data.note || null,
        photos: {
          ...(editablePhotoMediaIds.length
            ? { deleteMany: { mediaId: { in: editablePhotoMediaIds } } }
            : {}),
          ...photoCreate,
        },
      },
    });
  } else {
    await prisma.tripVisit.create({
      data: {
        placeId,
        visitedAt,
        location: data.location || null,
        note: data.note || null,
        createdBy: context.user.id,
        ...(data.mediaIds.length ? { photos: photoCreate } : {}),
      },
    });
  }

  revalidatePath("/travel");
  revalidatePath(`/travel/${tripId}`);
  revalidatePath(`/travel/${tripId}/places/${placeId}`);
  redirect(`/travel/${tripId}/places/${placeId}`);
}

/** 取消完成：删掉这个事项的全部打卡记录，照片关系级联删除，媒体仍留在照片库。 */
export async function clearTripPlaceVisitsAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const tripId = formString(formData, "tripId");
  const placeId = formString(formData, "placeId");

  const place = await prisma.tripPlace.findFirst({
    where: {
      id: placeId,
      tripId,
      trip: tripWhere({ userId: context.user.id, householdId: context.household.id }),
    },
    select: { id: true },
  });
  if (!place) redirect(`/travel/${tripId}`);

  await prisma.tripVisit.deleteMany({ where: { placeId } });
  revalidatePath("/travel");
  revalidatePath(`/travel/${tripId}`);
  redirect(`/travel/${tripId}`);
}

export async function deleteTripVisitAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const tripId = formString(formData, "tripId");
  const placeId = formString(formData, "placeId");
  const id = formString(formData, "id");

  const visit = await prisma.tripVisit.findFirst({
    where: {
      id,
      placeId,
      place: {
        tripId,
        trip: tripWhere({ userId: context.user.id, householdId: context.household.id }),
      },
    },
    select: { id: true },
  });
  if (!visit) redirect(`/travel/${tripId}`);

  await prisma.tripVisit.delete({ where: { id } });
  revalidatePath("/travel");
  revalidatePath(`/travel/${tripId}`);
  revalidatePath(`/travel/${tripId}/places/${placeId}`);
  redirect(`/travel/${tripId}/places/${placeId}`);
}

export async function addTripLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  const tripId = formString(formData, "tripId");
  const trip = await findTrip(tripId, context);
  if (!trip) return { error: "旅行不存在或没有编辑权限" };

  const parsed = tripLinkSchema.safeParse({
    title: formString(formData, "title"),
    url: formString(formData, "url"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const url = normalizeTripLink(parsed.data.url);
  if (!url) return { error: "没有找到有效链接，请粘贴网址、小程序链接或分享文案" };

  const max = await prisma.tripLink.aggregate({
    where: { tripId },
    _max: { sortOrder: true },
  });
  await prisma.tripLink.create({
    data: { tripId, title: parsed.data.title, url, sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });

  revalidatePath(`/travel/${tripId}`);
  return { success: "链接已保存" };
}

export async function deleteTripLinkAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const tripId = formString(formData, "tripId");
  const id = formString(formData, "id");
  const trip = await findTrip(tripId, context);
  if (!trip) redirect("/travel");

  await prisma.tripLink.deleteMany({ where: { id, tripId } });
  revalidatePath(`/travel/${tripId}`);
  redirect(`/travel/${tripId}`);
}
