import Link from "next/link";
import { DateTime } from "luxon";
import { ArrowLeft, BellRing, RotateCcw } from "lucide-react";
import type { Notification } from "@prisma/client";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { asDateTime, formatDateTime } from "@/lib/dates";
import { NOTIFICATION_STATUS_LABEL } from "@/lib/constants";
import { retryNotificationAction } from "@/app/actions/notifications";
import { EmptyState } from "@/components/EmptyState";
import { SubmitButton } from "@/components/SubmitButton";

const STATUS_TONE: Record<string, string> = {
  SENT: "bg-sage-soft text-sage",
  PENDING: "bg-raised text-muted",
  SENDING: "bg-raised text-muted",
  FAILED: "bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-danger",
  CANCELLED: "bg-raised text-faint",
};

function notificationStamp(value: Date, timezone: string) {
  const local = asDateTime(value, timezone).setLocale("zh-CN");
  return local.year === DateTime.now().setZone(timezone).year
    ? formatDateTime(value, timezone)
    : local.toFormat("yyyy年M月d日 HH:mm");
}

function NotificationRow({
  notification,
  timezone,
}: {
  notification: Notification;
  timezone: string;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[9.5px] ${STATUS_TONE[notification.status] || "bg-raised"}`}
            >
              {NOTIFICATION_STATUS_LABEL[notification.status] || notification.status}
            </span>
            <span className="text-[10px] text-faint">
              {notificationStamp(notification.scheduledAt, timezone)}
            </span>
            {notification.attemptCount > 0 ? (
              <span className="text-[10px] text-faint">尝试 {notification.attemptCount} 次</span>
            ) : null}
          </div>
          <p className="mt-1.5 text-[13px] font-medium leading-snug">{notification.targetTitle}</p>
          {notification.lastError ? (
            <p className="mt-1 text-[10.5px] leading-relaxed text-danger">{notification.lastError}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {notification.targetUrl ? (
            <Link href={notification.targetUrl} className="text-[10.5px] text-accent">
              查看
            </Link>
          ) : null}
          {notification.status === "FAILED" ? (
            <form action={retryNotificationAction}>
              <input type="hidden" name="id" value={notification.id} />
              <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">
                <RotateCcw size={11} /> 重试
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const context = await requireContext();
  const timezone = context.household.timezone;
  const { status } = await searchParams;
  const filter = status && STATUS_TONE[status] ? status : undefined;

  const baseWhere = {
    householdId: context.household.id,
    recipientUserId: context.user.id,
  };

  let upcoming: Notification[] = [];
  let history: Notification[] = [];
  let filtered: Notification[] = [];

  if (filter) {
    filtered = await prisma.notification.findMany({
      where: { ...baseWhere, status: filter },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    });
  } else {
    [upcoming, history] = await Promise.all([
      prisma.notification.findMany({
        where: { ...baseWhere, status: "PENDING" },
        orderBy: { scheduledAt: "asc" },
        take: 8,
      }),
      prisma.notification.findMany({
        where: { ...baseWhere, status: { in: ["SENT", "FAILED"] } },
        orderBy: { scheduledAt: "desc" },
        take: 40,
      }),
    ]);
  }

  const empty = filter ? filtered.length === 0 : upcoming.length === 0 && history.length === 0;

  return (
    <div>
      <header className="mb-6">
        <Link href="/my" className="mb-3 inline-flex items-center gap-1 text-[11.5px] text-faint hover:text-ink">
          <ArrowLeft size={13} /> 我的
        </Link>
        <p className="eyebrow">Reminders</p>
        <h1 className="font-display mt-1.5 text-[34px] leading-none tracking-tight">提醒记录</h1>
        <p className="mt-1.5 text-[12px] text-muted">
          发给你自己的邮件提醒。失败的会写明原因，修好邮件设置后可以在这里重试。
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-1.5">
        <Link href="/notifications" className={`chip ${!filter ? "chip-active" : ""}`}>
          全部
        </Link>
        {["PENDING", "SENT", "FAILED"].map((item) => (
          <Link
            key={item}
            href={`/notifications?status=${item}`}
            className={`chip ${filter === item ? "chip-active" : ""}`}
          >
            {NOTIFICATION_STATUS_LABEL[item]}
          </Link>
        ))}
      </div>

      {empty ? (
        <EmptyState
          icon={<BellRing strokeWidth={1.7} />}
          title="还没有提醒"
          description="给日程或待办设置邮件提醒后，记录会出现在这里。需要先配置 SMTP 才能实际发出。"
          action={
            <Link href="/settings/email" className="btn btn-outline btn-sm">
              查看邮件设置
            </Link>
          }
        />
      ) : filter ? (
        <div className="card divide-y divide-line overflow-hidden">
          {filtered.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} timezone={timezone} />
          ))}
        </div>
      ) : (
        <div className="space-y-7">
          {upcoming.length > 0 ? (
            <section>
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="text-[13px] font-semibold">
                  接下来<span className="ml-1.5 font-normal text-faint">{upcoming.length}</span>
                </h2>
                <span className="text-[10.5px] text-faint">按时间顺序排队</span>
              </div>
              <div className="card divide-y divide-line overflow-hidden">
                {upcoming.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} timezone={timezone} />
                ))}
              </div>
            </section>
          ) : null}

          {history.length > 0 ? (
            <section>
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="text-[13px] font-semibold">
                  发送记录<span className="ml-1.5 font-normal text-faint">{history.length}</span>
                </h2>
                <span className="text-[10.5px] text-faint">最新在前</span>
              </div>
              <div className="card divide-y divide-line overflow-hidden">
                {history.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} timezone={timezone} />
                ))}
              </div>
            </section>
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[11.5px] text-faint">
              还没有发送记录。到时间后，后台进程会尝试发送。
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-[10.5px] leading-relaxed text-faint">
        提醒由后台进程发送。运行 <code className="rounded bg-raised px-1 py-0.5">npm run worker</code> 或将 worker 作为服务常驻，才能按时发出。
      </p>
    </div>
  );
}
