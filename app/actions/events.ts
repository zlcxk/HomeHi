"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { dateInputToUtc, dayKey, localInputToUtc } from "@/lib/dates";
import { cancelPendingNotifications, clearReminderRule, syncReminderNotifications } from "@/lib/reminders";
import { validAssetIds } from "@/lib/asset-links";
import {
  eventSchema,
  firstError,
  formArray,
  formBoolean,
  formNumberArray,
  formString,
  type ActionState,
} from "@/lib/validation";

function revalidateEventSurfaces() {
  revalidatePath("/calendar");
  revalidatePath("/today");
  revalidatePath("/my");
  revalidatePath("/profiles");
  revalidatePath("/assets");
  revalidatePath("/notifications");
}

async function validProfileIds(householdId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.familyProfile.findMany({
    where: { householdId, id: { in: ids } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function saveEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  const id = formString(formData, "id");
  const timezone = context.household.timezone;

  const parsed = eventSchema.safeParse({
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    location: formString(formData, "location"),
    isAllDay: formBoolean(formData, "isAllDay"),
    start: formString(formData, "start"),
    end: formString(formData, "end"),
    recurrenceType: formString(formData, "recurrenceType") || "NONE",
    recurrenceInterval: Number(formString(formData, "recurrenceInterval") || 1),
    recurrenceUntil: formString(formData, "recurrenceUntil"),
    visibility: formString(formData, "visibility") || "HOUSEHOLD",
    reminderOffsets: formNumberArray(formData, "reminderOffsets"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const startsAt = data.isAllDay
    ? dateInputToUtc(data.start, timezone)
    : localInputToUtc(data.start, timezone);
  const endsAt = data.end
    ? data.isAllDay
      ? dateInputToUtc(data.end, timezone)
      : localInputToUtc(data.end, timezone)
    : null;

  if (!startsAt) return { error: "开始时间格式不正确" };
  if (endsAt && data.end && endsAt.getTime() < startsAt.getTime()) {
    return { error: "结束时间不能早于开始时间" };
  }
  const recurrenceUntil = data.recurrenceUntil
    ? localInputToUtc(`${data.recurrenceUntil}T23:59`, timezone)
    : null;
  if (data.recurrenceType !== "NONE" && data.recurrenceUntil && !recurrenceUntil) {
    return { error: "重复结束日期格式不正确" };
  }

  const relatedProfileIds = await validProfileIds(
    context.household.id,
    formArray(formData, "relatedProfileIds"),
  );
  const relatedAssetIds = await validAssetIds(
    context.household.id,
    context.user.id,
    formArray(formData, "relatedAssetIds"),
  );
  const offsets = data.reminderOffsets.filter((value) => value >= 0);

  let eventId = id;

  if (id) {
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (
      !existing ||
      existing.householdId !== context.household.id ||
      (existing.visibility === "PRIVATE" && existing.createdBy !== context.user.id)
    ) {
      return { error: "日程不存在或没有编辑权限" };
    }
    await prisma.calendarEvent.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description || null,
        location: data.location || null,
        startsAt,
        endsAt,
        isAllDay: data.isAllDay,
        timezone,
        recurrenceType: data.recurrenceType,
        recurrenceInterval: data.recurrenceInterval,
        recurrenceUntil,
        visibility: data.visibility,
        status: "ACTIVE",
        relatedProfileIds: relatedProfileIds.length ? JSON.stringify(relatedProfileIds) : null,
        relatedAssetIds: relatedAssetIds.length ? JSON.stringify(relatedAssetIds) : null,
      },
    });
  } else {
    const created = await prisma.calendarEvent.create({
      data: {
        householdId: context.household.id,
        createdBy: context.user.id,
        title: data.title,
        description: data.description || null,
        location: data.location || null,
        startsAt,
        endsAt,
        isAllDay: data.isAllDay,
        timezone,
        recurrenceType: data.recurrenceType,
        recurrenceInterval: data.recurrenceInterval,
        recurrenceUntil,
        visibility: data.visibility,
        relatedProfileIds: relatedProfileIds.length ? JSON.stringify(relatedProfileIds) : null,
        relatedAssetIds: relatedAssetIds.length ? JSON.stringify(relatedAssetIds) : null,
      },
    });
    eventId = created.id;
  }

  if (eventId) {
    if (offsets.length > 0) {
      await prisma.reminderRule.upsert({
        where: { targetType_targetId: { targetType: "CALENDAR_EVENT", targetId: eventId } },
        create: {
          householdId: context.household.id,
          targetType: "CALENDAR_EVENT",
          targetId: eventId,
          offsets: JSON.stringify(offsets),
          recipientUserIds: "[]",
          enabled: true,
        },
        update: { offsets: JSON.stringify(offsets), enabled: true },
      });
      await syncReminderNotifications("CALENDAR_EVENT", eventId, "refresh");
    } else {
      await clearReminderRule("CALENDAR_EVENT", eventId);
    }
  }

  revalidateEventSurfaces();
  redirect(`/calendar?date=${dayKey(startsAt, timezone)}`);
}

export async function cancelEventAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const event = await prisma.calendarEvent.findUnique({ where: { id } });
  if (
    !event ||
    event.householdId !== context.household.id ||
    (event.visibility === "PRIVATE" && event.createdBy !== context.user.id)
  ) {
    redirect("/calendar");
  }
  await prisma.calendarEvent.update({
    where: { id },
    data: { status: event.status === "ACTIVE" ? "CANCELLED" : "ACTIVE" },
  });
  if (event.status === "ACTIVE") {
    await cancelPendingNotifications("CALENDAR_EVENT", id, "日程已取消");
  } else {
    await syncReminderNotifications("CALENDAR_EVENT", id, "refresh");
  }
  revalidateEventSurfaces();
  redirect(`/calendar?date=${dayKey(event.startsAt, context.household.timezone)}`);
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const event = await prisma.calendarEvent.findUnique({ where: { id } });
  if (
    !event ||
    event.householdId !== context.household.id ||
    (event.visibility === "PRIVATE" && event.createdBy !== context.user.id)
  ) {
    redirect("/calendar");
  }
  await prisma.notification.updateMany({
    where: { targetType: "CALENDAR_EVENT", targetId: id, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "CANCELLED", lastError: "日程已删除" },
  });
  await prisma.reminderRule.deleteMany({ where: { targetType: "CALENDAR_EVENT", targetId: id } });
  await prisma.calendarEvent.delete({ where: { id } });
  revalidateEventSurfaces();
  redirect(`/calendar?date=${dayKey(event.startsAt, context.household.timezone)}`);
}
