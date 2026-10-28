import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { zoneOf } from "@/lib/dates";
import { occurrencesBetween } from "@/lib/recurrence";
import { REMINDER_OPTIONS } from "@/lib/constants";

export type TargetType = "CALENDAR_EVENT" | "TASK";

export const MAX_NOTIFICATION_ATTEMPTS = 5;

export function horizonDays(): number {
  const value = Number(process.env.WORKER_REMINDER_HORIZON_DAYS || 180);
  return Number.isFinite(value) && value > 0 ? value : 180;
}

export function parseOffsets(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set<number>(REMINDER_OPTIONS.map((o) => o.value));
    return Array.from(new Set(parsed.map(Number).filter((n) => allowed.has(n)))).sort((a, b) => b - a);
  } catch {
    return [];
  }
}

export function parseRecipients(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function reminderBaseUtc(occurrence: Date, isAllDay: boolean, timezone: string): Date {
  if (!isAllDay) return occurrence;
  return DateTime.fromJSDate(occurrence, { zone: timezone })
    .startOf("day")
    .plus({ hours: 9 })
    .toUTC()
    .toJSDate();
}

export function notificationTitle(
  targetType: TargetType,
  title: string,
  when: Date,
  isAllDay: boolean,
  timezone: string,
  offsetMinutes: number,
): string {
  const dt = DateTime.fromJSDate(when, { zone: timezone }).setLocale("zh-CN");
  const label = isAllDay ? dt.toFormat("M月d日") : dt.toFormat("M月d日 HH:mm");
  const timing =
    offsetMinutes === 0 ? label : `${label}（${REMINDER_OPTIONS.find((o) => o.value === offsetMinutes)?.label ?? "提醒"}）`;
  return `${targetType === "CALENDAR_EVENT" ? "日程" : "待办"} · ${title} · ${timing}`;
}

type LoadedTarget = {
  id: string;
  householdId: string;
  household: { timezone: string };
  createdBy: string;
  title: string;
  visibility: string;
  status: string;
  recurrenceType: string;
  recurrenceInterval: number;
  recurrenceUntil: Date | null;
  startsAt: Date | null;
  dueAt: Date | null;
  isAllDay: boolean;
  isLunar: boolean;
  lunarMonth: number | null;
  lunarDay: number | null;
  lunarLeap: boolean;
};

async function loadTarget(targetType: TargetType, targetId: string): Promise<LoadedTarget | null> {
  if (targetType === "CALENDAR_EVENT") {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: targetId },
      include: { household: { select: { timezone: true } } },
    });
    if (!event) return null;
    return {
      id: event.id,
      householdId: event.householdId,
      household: event.household,
      createdBy: event.createdBy,
      title: event.title,
      visibility: event.visibility,
      status: event.status,
      recurrenceType: event.recurrenceType,
      recurrenceInterval: event.recurrenceInterval,
      recurrenceUntil: event.recurrenceUntil,
      startsAt: event.startsAt,
      dueAt: null,
      isAllDay: event.isAllDay,
      isLunar: event.isLunar,
      lunarMonth: event.lunarMonth,
      lunarDay: event.lunarDay,
      lunarLeap: event.lunarLeap,
    };
  }

  const task = await prisma.task.findUnique({
    where: { id: targetId },
    include: { household: { select: { timezone: true } } },
  });
  if (!task) return null;
  return {
    id: task.id,
    householdId: task.householdId,
    household: task.household,
    createdBy: task.createdBy,
    title: task.title,
    visibility: task.visibility,
    status: task.status,
    recurrenceType: task.recurrenceType,
    recurrenceInterval: task.recurrenceInterval,
    recurrenceUntil: task.recurrenceUntil,
    startsAt: null,
    dueAt: task.dueAt,
    isAllDay: false,
    isLunar: false,
    lunarMonth: null,
    lunarDay: null,
    lunarLeap: false,
  };
}

export async function cancelPendingNotifications(
  targetType: TargetType,
  targetId: string,
  reason: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      targetType,
      targetId,
      status: { in: ["PENDING", "FAILED"] },
    },
    data: { status: "CANCELLED", lastError: reason },
  });
}

export async function clearReminderRule(targetType: TargetType, targetId: string): Promise<void> {
  await prisma.reminderRule.deleteMany({
    where: {
      targetType,
      targetId,
    },
  });
  await cancelPendingNotifications(targetType, targetId, "提醒已删除");
}

/**
 * Regenerates future notification rows for one event/task.
 * - refresh: deletes unsent rows first (used when the target changes)
 * - extend: only adds missing rows (used by the worker for recurring series)
 */
export async function syncReminderNotifications(
  targetType: TargetType,
  targetId: string,
  mode: "refresh" | "extend" = "refresh",
): Promise<number> {
  const target = await loadTarget(targetType, targetId);
  if (!target) {
    await cancelPendingNotifications(targetType, targetId, "目标已不存在");
    return 0;
  }

  const rule = await prisma.reminderRule.findUnique({
    where: { targetType_targetId: { targetType, targetId } },
  });
  const offsets = rule?.enabled ? parseOffsets(rule.offsets) : [];
  const timezone = zoneOf(target.household.timezone);
  const isActive =
    target.status !== "CANCELLED" && !(targetType === "TASK" && target.status !== "TODO");
  const anchor = targetType === "CALENDAR_EVENT" ? target.startsAt : target.dueAt;

  if (!rule || !isActive || offsets.length === 0 || !anchor) {
    if (!isActive) {
      await cancelPendingNotifications(targetType, targetId, "目标已取消或完成");
    } else {
      await prisma.notification.deleteMany({
        where: { targetType, targetId, status: { in: ["PENDING", "FAILED", "CANCELLED"] } },
      });
    }
    return 0;
  }

  const members = await prisma.householdMember.findMany({
    where: { householdId: target.householdId },
    include: { user: true },
  });
  const recipients = members
    .map((m) => m.user)
    .filter((user) => (targetType === "CALENDAR_EVENT" ? user.notifyEvent : user.notifyTask))
    .filter((user) => (target.visibility === "PRIVATE" ? user.id === target.createdBy : true));

  if (recipients.length === 0) {
    await prisma.notification.deleteMany({
      where: { targetType, targetId, status: { in: ["PENDING", "FAILED", "CANCELLED"] } },
    });
    return 0;
  }

  const isAllDay = targetType === "CALENDAR_EVENT" && target.isAllDay;
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + horizonDays() * 86_400_000);
  const occurrences = occurrencesBetween(
    anchor,
    {
      type: target.recurrenceType,
      interval: target.recurrenceInterval,
      until: target.recurrenceUntil,
      lunar:
        target.isLunar && target.lunarMonth && target.lunarDay
          ? { month: target.lunarMonth, day: target.lunarDay, leap: target.lunarLeap }
          : null,
    },
    now,
    horizonEnd,
    timezone,
    120,
  );

  const rows: {
    householdId: string;
    reminderRuleId: string;
    targetType: string;
    targetId: string;
    targetTitle: string;
    targetUrl: string;
    recipientUserId: string;
    recipientEmail: string;
    channel: string;
    scheduledAt: Date;
    idempotencyKey: string;
  }[] = [];

  const targetUrl =
    targetType === "CALENDAR_EVENT"
      ? `/calendar?date=${DateTime.fromJSDate(anchor, { zone: timezone }).toFormat("yyyy-MM-dd")}`
      : "/tasks";

  for (const occurrence of occurrences) {
    const base = reminderBaseUtc(occurrence, isAllDay, timezone);
    for (const offset of offsets) {
      const scheduledAt = new Date(base.getTime() - offset * 60_000);
      if (scheduledAt.getTime() <= now.getTime()) continue;
      if (scheduledAt.getTime() > horizonEnd.getTime()) continue;
      for (const recipient of recipients) {
        rows.push({
          householdId: target.householdId,
          reminderRuleId: rule.id,
          targetType,
          targetId,
          targetTitle: target.title,
          targetUrl,
          recipientUserId: recipient.id,
          recipientEmail: recipient.email,
          channel: "EMAIL",
          scheduledAt,
          idempotencyKey: `${targetType}:${targetId}:${occurrence.toISOString()}:${offset}:${recipient.id}`,
        });
      }
    }
  }

  if (mode === "refresh") {
    await prisma.notification.deleteMany({
      where: { targetType, targetId, status: { in: ["PENDING", "FAILED", "CANCELLED"] } },
    });
  }

  const existing = await prisma.notification.findMany({
    where: { idempotencyKey: { in: rows.map((r) => r.idempotencyKey) } },
    select: { idempotencyKey: true },
  });
  const existingKeys = new Set(existing.map((r) => r.idempotencyKey));
  const fresh = rows.filter((r) => !existingKeys.has(r.idempotencyKey));

  if (fresh.length > 0) {
    await prisma.notification.createMany({ data: fresh });
  }

  await prisma.reminderRule.update({
    where: { id: rule.id },
    data: {
      recipientUserIds: JSON.stringify(recipients.map((r) => r.id)),
      enabled: rule.enabled,
    },
  });

  return fresh.length;
}

/** Worker helper: extend recurring series into the rolling horizon without touching retries. */
export async function extendRecurringNotifications(): Promise<number> {
  const rules = await prisma.reminderRule.findMany({
    where: { enabled: true },
    select: { targetType: true, targetId: true },
  });
  let created = 0;
  for (const rule of rules) {
    try {
      created += await syncReminderNotifications(
        rule.targetType as TargetType,
        rule.targetId,
        "extend",
      );
    } catch (error) {
      console.error("[reminders] extend failed", rule.targetType, rule.targetId, error);
    }
  }
  return created;
}
