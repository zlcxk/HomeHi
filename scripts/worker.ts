import "dotenv/config";

import { DateTime } from "luxon";
import type { Notification } from "@prisma/client";
import { prisma } from "../lib/db";
import { sendReminderEmail, smtpStatus } from "../lib/mailer";
import { MAX_NOTIFICATION_ATTEMPTS, extendRecurringNotifications } from "../lib/reminders";
import {
  drainVideoQueue,
  recoverStaleVideoJobs,
  requeueVideosWithoutFfmpeg,
  resolveFfmpeg,
} from "../lib/video";
import { drainImageQueue, recoverStaleImageJobs } from "../lib/media-jobs";

const POLL_SECONDS = Math.max(5, Number(process.env.WORKER_POLL_SECONDS || 30));
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const RETRY_MINUTES = [5, 15, 45, 120];

let stopping = false;
let lastExtend = 0;
let lastVideoRecovery = 0;

function log(...args: unknown[]) {
  console.log(`[worker ${new Date().toISOString()}]`, ...args);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function occurrenceFromKey(notification: Notification): Date | null {
  const parts = notification.idempotencyKey.split(":");
  if (parts.length < 5) return null;
  const iso = parts.slice(2, parts.length - 2).join(":");
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function cancel(notification: Notification, reason: string) {
  await prisma.notification.update({
    where: { id: notification.id },
    data: { status: "CANCELLED", lastError: reason },
  });
}

async function processNotification(notification: Notification, householdCache: Map<string, { name: string; timezone: string }>) {
  let household = householdCache.get(notification.householdId);
  if (!household) {
    const row = await prisma.household.findUnique({
      where: { id: notification.householdId },
      select: { name: true, timezone: true },
    });
    if (!row) {
      await cancel(notification, "家庭空间已不存在");
      return;
    }
    household = row;
    householdCache.set(notification.householdId, row);
  }

  let title = notification.targetTitle;
  let targetUrl = notification.targetUrl || "/today";
  let occurrence: Date | null = null;
  let isAllDay = false;

  if (notification.targetType === "CALENDAR_EVENT") {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: notification.targetId },
      select: { title: true, status: true, startsAt: true, endsAt: true, isAllDay: true },
    });
    if (!event || event.status !== "ACTIVE") {
      await cancel(notification, "日程已取消或删除");
      return;
    }
    title = event.title;
    isAllDay = event.isAllDay;
    occurrence = occurrenceFromKey(notification) ?? event.startsAt;
    targetUrl = `/calendar?date=${DateTime.fromJSDate(occurrence, { zone: household.timezone }).toFormat(
      "yyyy-MM-dd",
    )}`;
  } else if (notification.targetType === "TASK") {
    const task = await prisma.task.findUnique({
      where: { id: notification.targetId },
      select: { title: true, status: true, dueAt: true },
    });
    if (!task || task.status !== "TODO") {
      await cancel(notification, "待办已完成或取消");
      return;
    }
    title = task.title;
    occurrence = occurrenceFromKey(notification) ?? task.dueAt;
  } else {
    await cancel(notification, "未知的提醒类型");
    return;
  }

  if (!smtpStatus().configured) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "FAILED",
        lastError: "SMTP 尚未配置，提醒未发出。配置后可在「提醒记录」中重试。",
        nextAttemptAt: null,
      },
    });
    return;
  }

  const when = occurrence
    ? DateTime.fromJSDate(occurrence, { zone: household.timezone }).setLocale("zh-CN")
    : DateTime.now().setZone(household.timezone);
  const whenLabel = isAllDay ? when.toFormat("M月d日") : when.toFormat("M月d日 HH:mm");

  try {
    await sendReminderEmail({
      to: notification.recipientEmail,
      householdName: household.name,
      title,
      whenLabel,
      url: targetUrl.startsWith("http") ? targetUrl : `${APP_URL}${targetUrl}`,
      kind: notification.targetType === "CALENDAR_EVENT" ? "event" : "task",
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        attemptCount: notification.attemptCount + 1,
        lastError: null,
        nextAttemptAt: null,
        targetTitle: title,
      },
    });
    log("sent", notification.targetType, title, "→", notification.recipientEmail);
  } catch (error) {
    const attempts = notification.attemptCount + 1;
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    const failed = attempts >= MAX_NOTIFICATION_ATTEMPTS;
    const retryDelay = RETRY_MINUTES[Math.min(attempts - 1, RETRY_MINUTES.length - 1)];
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: failed ? "FAILED" : "PENDING",
        attemptCount: attempts,
        lastError: message,
        nextAttemptAt: failed
          ? null
          : new Date(Date.now() + retryDelay * 60_000),
      },
    });
    log("failed", notification.id, `attempt ${attempts}/${MAX_NOTIFICATION_ATTEMPTS}`, message);
  }
}

async function tick() {
  const now = new Date();

  // Recover rows that a previous crashed worker left mid-send.
  await prisma.notification.updateMany({
    where: { status: "SENDING", updatedAt: { lt: new Date(now.getTime() - 15 * 60_000) } },
    data: { status: "PENDING", nextAttemptAt: now },
  });

  const due = await prisma.notification.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { scheduledAt: "asc" },
    take: 25,
  });

  if (due.length === 0) return;

  // Claim. A single worker process is the intended deployment; SENDING prevents
  // re-picking rows within this process while slow SMTP calls are in flight.
  await prisma.notification.updateMany({
    where: { id: { in: due.map((row) => row.id) }, status: "PENDING" },
    data: { status: "SENDING" },
  });
  const claimed = await prisma.notification.findMany({
    where: { id: { in: due.map((row) => row.id) }, status: "SENDING" },
  });

  log(`processing ${claimed.length} reminder(s)`);
  const householdCache = new Map<string, { name: string; timezone: string }>();
  for (const notification of claimed) {
    if (stopping) break;
    try {
      await processNotification(notification, householdCache);
    } catch (error) {
      log("unexpected error", notification.id, error);
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: "PENDING",
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
          nextAttemptAt: new Date(Date.now() + 5 * 60_000),
        },
      });
    }
  }

  const smtp = smtpStatus();
  if (!smtp.configured && claimed.length > 0) {
    log("SMTP is not configured; due reminders were marked FAILED so they are not sent late.");
  }
}

async function main() {
  log(
    `HomeHi worker starting · poll ${POLL_SECONDS}s · SMTP ${
      smtpStatus().configured ? "configured" : "NOT configured"
    }`,
  );
  await prisma.$connect();
  await recoverStaleVideoJobs();
  await recoverStaleImageJobs();
  const ffmpeg = await resolveFfmpeg();
  log(`video compression ${ffmpeg ? `ready (${ffmpeg})` : "unavailable; videos will keep the original file"}`);
  const requeued = await requeueVideosWithoutFfmpeg();
  if (requeued > 0) log(`requeued ${requeued} video(s) now that ffmpeg is available`);

  while (!stopping) {
    try {
      await tick();
      if (Date.now() - lastExtend > 6 * 60 * 60_000) {
        const created = await extendRecurringNotifications();
        lastExtend = Date.now();
        if (created > 0) log(`extended recurring reminders (+${created})`);
      }
      if (Date.now() - lastVideoRecovery > 10 * 60_000) {
        lastVideoRecovery = Date.now();
        await recoverStaleVideoJobs();
        await recoverStaleImageJobs();
      }
      // 图片变体很轻，先排干；视频压缩比较慢，放到后台跑。
      void drainImageQueue();
      void drainVideoQueue();
    } catch (error) {
      log("cycle failed", error);
    }
    if (stopping) break;
    await sleep(POLL_SECONDS * 1000);
  }

  await prisma.$disconnect();
  log("stopped");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) process.exit(0);
    stopping = true;
    log(`${signal} received, finishing current cycle…`);
  });
}

void main();
