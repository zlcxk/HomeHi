import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import {
  ArrowLeft,
  Boxes,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Pencil,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assetWhere } from "@/lib/access";
import { formatDateFull, formatDateTime } from "@/lib/dates";
import { occurrencesBetween, recurrenceSummary } from "@/lib/recurrence";
import {
  assetCategoryLabel,
  assetStatusLabel,
  daysFromToday,
  expiryHint,
} from "@/lib/assets";
import { deleteAssetAction } from "@/app/actions/assets";
import { ConfirmButton } from "@/components/ConfirmButton";

function dateOnly(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: timezone }).toFormat("yyyy-MM-dd");
}

function nextMaintenance(purchaseDate: Date | null, everyDays: number | null, timezone: string): Date | null {
  if (!everyDays || everyDays <= 0) return null;
  const start = purchaseDate
    ? DateTime.fromJSDate(purchaseDate, { zone: timezone }).startOf("day")
    : DateTime.now().setZone(timezone).startOf("day");
  let next = start.plus({ days: everyDays });
  const today = DateTime.now().setZone(timezone).startOf("day");
  if (next < today) {
    const cycles = Math.ceil(today.diff(next, "days").days / everyDays);
    next = next.plus({ days: cycles * everyDays });
  }
  return next.toJSDate();
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;

  const asset = await prisma.asset.findFirst({ where: { id, ...assetWhere(viewer) } });
  if (!asset) notFound();

  const [tasks, events, photo] = await Promise.all([
    prisma.task.findMany({
      where: {
        householdId: context.household.id,
        relatedAssetIds: { contains: id },
        OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      take: 60,
    }),
    prisma.calendarEvent.findMany({
      where: {
        householdId: context.household.id,
        status: "ACTIVE",
        relatedAssetIds: { contains: id },
        OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
      },
      orderBy: { startsAt: "asc" },
      take: 60,
    }),
    asset.photoMediaId
      ? prisma.media.findFirst({
          where: {
            id: asset.photoMediaId,
            householdId: context.household.id,
            status: "ACTIVE",
            OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
          },
          select: { id: true },
        })
      : null,
  ]);

  const now = new Date();
  const horizon = DateTime.fromJSDate(now).plus({ days: 365 }).toJSDate();
  const openTasks = tasks.filter((task) => task.status === "TODO");
  const doneTasks = tasks.filter((task) => task.status === "DONE").slice(0, 6);

  const upcomingEvents = events
    .flatMap((event) =>
      occurrencesBetween(
        event.startsAt,
        {
          type: event.recurrenceType,
          interval: event.recurrenceInterval,
          until: event.recurrenceUntil,
        },
        now,
        horizon,
        timezone,
        6,
      ).map((occurrence) => ({ event, occurrence })),
    )
    .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())
    .slice(0, 8);

  const warranty = expiryHint(asset.warrantyUntil, timezone, "质保");
  const insurance = expiryHint(asset.insuranceUntil, timezone, "保险");
  const maintenanceDate = nextMaintenance(asset.purchaseDate, asset.maintenanceEveryDays, timezone);
  const maintenanceDays = daysFromToday(maintenanceDate, timezone);

  const quickPlans = [
    asset.warrantyUntil
      ? {
          key: "warranty",
          label: "质保到期提醒",
          detail: formatDateFull(asset.warrantyUntil, timezone),
          href: `/compose/task?assetId=${asset.id}&title=${encodeURIComponent(
            `${asset.name} 质保到期`,
          )}&due=${dateOnly(asset.warrantyUntil, timezone)}&remind=10080`,
        }
      : null,
    maintenanceDate
      ? {
          key: "maintenance",
          label: "保养计划",
          detail: `${formatDateFull(maintenanceDate, timezone)} 起，每 ${asset.maintenanceEveryDays} 天`,
          href: `/compose/task?assetId=${asset.id}&title=${encodeURIComponent(
            `${asset.name} 保养`,
          )}&due=${dateOnly(maintenanceDate, timezone)}&repeat=DAILY&every=${
            asset.maintenanceEveryDays
          }&remind=1440`,
        }
      : null,
    asset.insuranceUntil
      ? {
          key: "insurance",
          label: "保险续期提醒",
          detail: formatDateFull(asset.insuranceUntil, timezone),
          href: `/compose/task?assetId=${asset.id}&title=${encodeURIComponent(
            `${asset.name} 保险续期`,
          )}&due=${dateOnly(asset.insuranceUntil, timezone)}&repeat=YEARLY&every=1&remind=10080`,
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; detail: string; href: string }[];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <Link href="/assets" className="icon-btn icon-btn-plain -ml-2" aria-label="返回物品列表">
          <ArrowLeft size={19} strokeWidth={1.8} />
        </Link>
        <div className="flex items-center gap-0.5">
          <Link href={`/assets/${asset.id}/edit`} className="icon-btn icon-btn-plain" aria-label="编辑物品">
            <Pencil size={15} />
          </Link>
          <form action={deleteAssetAction}>
            <input type="hidden" name="id" value={asset.id} />
            <ConfirmButton
              className="icon-btn icon-btn-plain text-faint hover:text-danger"
              message="删除这件物品？关联的日程与待办会保留，但不再显示这件物品。"
              pendingText=""
            >
              <Trash2 size={15} />
            </ConfirmButton>
          </form>
        </div>
      </div>

      <div className="card overflow-hidden">
        {photo ? (
          <img
            src={`/api/media/${photo.id}/display`}
            alt=""
            className="aspect-[16/8] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[16/6] items-center justify-center bg-raised text-faint">
            <Boxes size={30} strokeWidth={1.4} />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">{assetCategoryLabel(asset.category)}</p>
              <h1 className="font-display mt-1.5 text-[30px] leading-tight">{asset.name}</h1>
            </div>
            <span className="chip shrink-0">{assetStatusLabel(asset.status)}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
            {asset.brand || asset.model ? (
              <span>{[asset.brand, asset.model].filter(Boolean).join(" · ")}</span>
            ) : null}
            {asset.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} /> {asset.location}
              </span>
            ) : null}
            {asset.visibility === "PRIVATE" ? <span className="text-faint">仅自己可见</span> : null}
          </div>

          <dl className="hairline mt-4 grid grid-cols-2 gap-x-4 gap-y-3 pt-4 text-[12.5px]">
            {asset.serialNumber ? (
              <div className="col-span-2">
                <dt className="text-[10.5px] text-faint">序列号</dt>
                <dd className="mt-0.5 break-all">{asset.serialNumber}</dd>
              </div>
            ) : null}
            {asset.purchaseDate ? (
              <div>
                <dt className="text-[10.5px] text-faint">购买日期</dt>
                <dd className="mt-0.5">{formatDateFull(asset.purchaseDate, timezone)}</dd>
              </div>
            ) : null}
            {asset.purchasePrice !== null ? (
              <div>
                <dt className="text-[10.5px] text-faint">价格</dt>
                <dd className="mt-0.5">¥ {asset.purchasePrice.toLocaleString("zh-CN")}</dd>
              </div>
            ) : null}
            {asset.vendor ? (
              <div>
                <dt className="text-[10.5px] text-faint">购买渠道</dt>
                <dd className="mt-0.5">{asset.vendor}</dd>
              </div>
            ) : null}
            {asset.insuranceProvider ? (
              <div>
                <dt className="text-[10.5px] text-faint">保险公司</dt>
                <dd className="mt-0.5">{asset.insuranceProvider}</dd>
              </div>
            ) : null}
          </dl>

          {asset.notes ? (
            <p className="mt-4 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
              {asset.notes}
            </p>
          ) : null}
        </div>
      </div>

      <section className="mt-6">
        <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
          <ShieldCheck size={14} className="text-muted" /> 质保与保障
        </h2>
        <div className="card divide-y divide-line overflow-hidden">
          {[
            {
              label: "质保",
              detail: asset.warrantyUntil ? formatDateFull(asset.warrantyUntil, timezone) : "未记录",
              hint: warranty,
              icon: <ShieldCheck size={14} />,
            },
            {
              label: "保养",
              detail: maintenanceDate
                ? `下次 ${formatDateFull(maintenanceDate, timezone)}`
                : "未设置周期",
              hint:
                maintenanceDays === null
                  ? null
                  : maintenanceDays < 0
                    ? "已过期"
                    : maintenanceDays <= 14
                      ? `还有 ${maintenanceDays} 天`
                      : null,
              icon: <Wrench size={14} />,
            },
            {
              label: "保险",
              detail: asset.insuranceUntil ? formatDateFull(asset.insuranceUntil, timezone) : "未记录",
              hint: insurance,
              icon: <ShieldCheck size={14} />,
            },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-muted">
                {row.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">{row.label}</span>
                <span className="block text-[11px] text-faint">{row.detail}</span>
              </span>
              {row.hint ? <span className="shrink-0 text-[10.5px] text-accent">{row.hint}</span> : null}
            </div>
          ))}
        </div>

        {quickPlans.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quickPlans.map((plan) => (
              <Link key={plan.key} href={plan.href} className="chip">
                {plan.label}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
          <CalendarDays size={14} className="text-muted" /> 相关计划
        </h2>
        {openTasks.length === 0 && upcomingEvents.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-line-strong px-4 py-5 text-[12px] text-faint">
            还没有计划。可以用上面的快捷入口，给这件物品加一条带提醒的待办。
          </div>
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {openTasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}/edit`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-raised/60"
              >
                <CheckCircle2 size={14} className="shrink-0 text-sage" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{task.title}</span>
                <span className="shrink-0 text-[10.5px] text-faint">
                  {task.dueAt ? formatDateTime(task.dueAt, timezone) : "无截止时间"}
                  {task.recurrenceType !== "NONE"
                    ? ` · ${recurrenceSummary(task.recurrenceType, task.recurrenceInterval)}`
                    : ""}
                </span>
              </Link>
            ))}
            {upcomingEvents.map(({ event, occurrence }) => (
              <Link
                key={`${event.id}-${occurrence.toISOString()}`}
                href={`/calendar/events/${event.id}/edit`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-raised/60"
              >
                <CalendarDays size={14} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{event.title}</span>
                <span className="shrink-0 text-[10.5px] text-faint">
                  {formatDateTime(occurrence, timezone)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {doneTasks.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2.5 text-[13px] font-semibold">最近完成</h2>
          <div className="card divide-y divide-line overflow-hidden">
            {doneTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                <CheckCircle2 size={13} className="shrink-0 text-faint" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted line-through">
                  {task.title}
                </span>
                <span className="shrink-0 text-[10px] text-faint">
                  {task.completedAt ? formatDateTime(task.completedAt, timezone) : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
