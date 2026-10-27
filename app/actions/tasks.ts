"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { localInputToUtc } from "@/lib/dates";
import { nextOccurrence } from "@/lib/recurrence";
import { validAssetIds } from "@/lib/asset-links";
import {
  cancelPendingNotifications,
  clearReminderRule,
  syncReminderNotifications,
} from "@/lib/reminders";
import {
  firstError,
  formArray,
  formNumberArray,
  formString,
  taskSchema,
  type ActionState,
} from "@/lib/validation";

function revalidateTaskSurfaces() {
  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/calendar");
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

async function validAssignee(householdId: string, userId: string): Promise<string | null> {
  if (!userId) return null;
  const membership = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId, userId } },
    select: { userId: true },
  });
  return membership?.userId ?? null;
}

export async function saveTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  const id = formString(formData, "id");
  const timezone = context.household.timezone;

  const parsed = taskSchema.safeParse({
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    location: formString(formData, "location"),
    dueAt: formString(formData, "dueAt"),
    priority: formString(formData, "priority") || "NORMAL",
    assigneeUserId: formString(formData, "assigneeUserId"),
    recurrenceType: formString(formData, "recurrenceType") || "NONE",
    recurrenceInterval: Number(formString(formData, "recurrenceInterval") || 1),
    recurrenceUntil: formString(formData, "recurrenceUntil"),
    visibility: formString(formData, "visibility") || "HOUSEHOLD",
    reminderOffsets: formNumberArray(formData, "reminderOffsets"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const dueAt = data.dueAt ? localInputToUtc(data.dueAt, timezone) : null;
  if (data.dueAt && !dueAt) return { error: "截止时间格式不正确" };
  const recurrenceUntil = data.recurrenceUntil
    ? localInputToUtc(`${data.recurrenceUntil}T23:59`, timezone)
    : null;
  const assigneeUserId = await validAssignee(context.household.id, data.assigneeUserId);
  const relatedProfileIds = await validProfileIds(
    context.household.id,
    formArray(formData, "relatedProfileIds"),
  );
  const relatedAssetIds = await validAssetIds(
    context.household.id,
    context.user.id,
    formArray(formData, "relatedAssetIds"),
  );

  let taskId = id;

  if (id) {
    const existing = await prisma.task.findUnique({ where: { id } });
    if (
      !existing ||
      existing.householdId !== context.household.id ||
      (existing.visibility === "PRIVATE" && existing.createdBy !== context.user.id)
    ) {
      return { error: "待办不存在或没有编辑权限" };
    }
    await prisma.task.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description || null,
        location: data.location.trim() || null,
        dueAt,
        priority: data.priority,
        assigneeUserId,
        recurrenceType: data.recurrenceType,
        recurrenceInterval: data.recurrenceInterval,
        recurrenceUntil,
        visibility: data.visibility,
        relatedProfileIds: relatedProfileIds.length ? JSON.stringify(relatedProfileIds) : null,
        relatedAssetIds: relatedAssetIds.length ? JSON.stringify(relatedAssetIds) : null,
        status: existing.status === "CANCELLED" ? "TODO" : existing.status,
      },
    });
  } else {
    const created = await prisma.task.create({
      data: {
        householdId: context.household.id,
        createdBy: context.user.id,
        title: data.title,
        description: data.description || null,
        location: data.location.trim() || null,
        dueAt,
        priority: data.priority,
        assigneeUserId,
        recurrenceType: data.recurrenceType,
        recurrenceInterval: data.recurrenceInterval,
        recurrenceUntil,
        visibility: data.visibility,
        relatedProfileIds: relatedProfileIds.length ? JSON.stringify(relatedProfileIds) : null,
        relatedAssetIds: relatedAssetIds.length ? JSON.stringify(relatedAssetIds) : null,
      },
    });
    taskId = created.id;
  }

  const offsets = data.reminderOffsets.filter((value) => value >= 0);
  if (taskId && dueAt && offsets.length > 0) {
    await prisma.reminderRule.upsert({
      where: { targetType_targetId: { targetType: "TASK", targetId: taskId } },
      create: {
        householdId: context.household.id,
        targetType: "TASK",
        targetId: taskId,
        offsets: JSON.stringify(offsets),
        recipientUserIds: "[]",
        enabled: true,
      },
      update: { offsets: JSON.stringify(offsets), enabled: true },
    });
    await syncReminderNotifications("TASK", taskId, "refresh");
  } else if (taskId) {
    await clearReminderRule("TASK", taskId);
  }

  revalidateTaskSurfaces();
  redirect("/tasks");
}

export async function toggleTaskAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const task = await prisma.task.findUnique({ where: { id } });
  if (
    !task ||
    task.householdId !== context.household.id ||
    (task.visibility === "PRIVATE" && task.createdBy !== context.user.id)
  ) {
    redirect("/tasks");
  }

  if (task.status === "DONE") {
    const last = await prisma.taskCompletion.findFirst({
      where: { taskId: id },
      orderBy: { completedAt: "desc" },
    });
    await prisma.$transaction(async (tx) => {
      if (last) await tx.taskCompletion.delete({ where: { id: last.id } });
      await tx.task.update({
        where: { id },
        data: {
          status: "TODO",
          completedAt: null,
          dueAt:
            task.recurrenceType !== "NONE" && last?.occurrenceDueAt
              ? last.occurrenceDueAt
              : task.dueAt,
        },
      });
    });
    await syncReminderNotifications("TASK", id, "refresh");
    revalidateTaskSurfaces();
    redirect("/tasks");
  }

  const now = new Date();
  const next =
    task.recurrenceType !== "NONE"
      ? nextOccurrence(
          task.dueAt ?? now,
          {
            type: task.recurrenceType,
            interval: task.recurrenceInterval,
            until: task.recurrenceUntil,
          },
          now,
          context.household.timezone,
        )
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.taskCompletion.create({
      data: {
        taskId: id,
        completedBy: context.user.id,
        occurrenceDueAt: task.dueAt,
      },
    });
    await tx.task.update({
      where: { id },
      data: next
        ? { status: "TODO", dueAt: next, completedAt: null }
        : { status: "DONE", completedAt: now },
    });
  });

  await syncReminderNotifications("TASK", id, "refresh");
  revalidateTaskSurfaces();
  redirect("/tasks");
}

export async function cancelTaskAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.householdId !== context.household.id) redirect("/tasks");
  await prisma.task.update({
    where: { id },
    data: { status: task.status === "CANCELLED" ? "TODO" : "CANCELLED" },
  });
  if (task.status === "CANCELLED") {
    await syncReminderNotifications("TASK", id, "refresh");
  } else {
    await cancelPendingNotifications("TASK", id, "待办已取消");
  }
  revalidateTaskSurfaces();
  redirect("/tasks");
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.householdId !== context.household.id) redirect("/tasks");
  await prisma.notification.updateMany({
    where: { targetType: "TASK", targetId: id, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "CANCELLED", lastError: "待办已删除" },
  });
  await prisma.reminderRule.deleteMany({ where: { targetType: "TASK", targetId: id } });
  await prisma.task.delete({ where: { id } });
  revalidateTaskSurfaces();
  redirect("/tasks");
}
