import Link from "next/link";
import { DateTime } from "luxon";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Cake,
  Boxes,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { eventWhere } from "@/lib/access";
import { formatTime, monthGrid, monthLabel, dayKey } from "@/lib/dates";
import { occurrencesBetween, recurrenceSummary } from "@/lib/recurrence";
import { holidayMap } from "@/lib/holidays";
import { parseStringArray } from "@/lib/json";
import { cancelEventAction, deleteEventAction } from "@/app/actions/events";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string }>;
}) {
  const context = await requireContext();
  const timezone = context.household.timezone;
  const params = await searchParams;

  const today = DateTime.now().setZone(timezone).startOf("day");
  const selected = params.date
    ? DateTime.fromISO(params.date, { zone: timezone }).startOf("day")
    : today;
  const selectedDay = selected.isValid ? selected : today;

  const monthParam = params.month ? DateTime.fromFormat(params.month, "yyyy-MM", { zone: timezone }) : null;
  const monthBase = monthParam?.isValid
    ? monthParam
    : selectedDay.startOf("month");
  const grid = monthGrid(monthBase.year, monthBase.month, timezone);
  const gridStart = grid[0].startOf("day");
  const gridEnd = grid[grid.length - 1].endOf("day");

  const [events, dayTasks, profiles, assets, holidays] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: eventWhere({ userId: context.user.id, householdId: context.household.id }),
      orderBy: { startsAt: "asc" },
      take: 500,
    }),
    prisma.task.findMany({
      where: {
        householdId: context.household.id,
        status: { in: ["TODO", "DONE"] },
        dueAt: { gte: selectedDay.toUTC().toJSDate(), lte: selectedDay.endOf("day").toUTC().toJSDate() },
        AND: [{ OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }] }],
      },
      orderBy: { dueAt: "asc" },
    }),
    prisma.familyProfile.findMany({
      where: {
        householdId: context.household.id,
        birthday: { not: null },
        OR: [{ visibility: "HOUSEHOLD" }, { linkedUserId: context.user.id }],
      },
      select: { id: true, name: true, birthday: true, profileType: true },
    }),
    prisma.asset.findMany({
      where: {
        householdId: context.household.id,
        OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
      },
      select: { id: true, name: true },
    }),
    holidayMap([gridStart.year, gridEnd.year]),
  ]);

  const assetNames = new Map(assets.map((asset) => [asset.id, asset.name]));

  const byDay = new Map<string, { event: (typeof events)[number]; occurrence: Date }[]>();
  for (const event of events) {
    const occurrences = occurrencesBetween(
      event.startsAt,
      {
        type: event.recurrenceType,
        interval: event.recurrenceInterval,
        until: event.recurrenceUntil,
      },
      gridStart.toJSDate(),
      gridEnd.toJSDate(),
      timezone,
      200,
    );
    for (const occurrence of occurrences) {
      const key = dayKey(occurrence, timezone);
      const list = byDay.get(key);
      if (list) list.push({ event, occurrence });
      else byDay.set(key, [{ event, occurrence }]);
    }
  }

  const selectedKey = selectedDay.toFormat("yyyy-MM-dd");
  const selectedHoliday = holidays.get(selectedKey);
  const dayItems = (byDay.get(selectedKey) || []).sort(
    (a, b) => a.occurrence.getTime() - b.occurrence.getTime(),
  );
  const dayBirthdays = profiles.filter((profile) => {
    if (!profile.birthday) return false;
    const birth = DateTime.fromJSDate(profile.birthday, { zone: timezone });
    return birth.month === selectedDay.month && birth.day === selectedDay.day;
  });

  const prevMonth = monthBase.minus({ months: 1 });
  const nextMonth = monthBase.plus({ months: 1 });
  const selectedInMonth = selectedDay.hasSame(monthBase, "month");

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Calendar</p>
          <h1 className="font-display mt-1.5 whitespace-nowrap text-[28px] leading-none tracking-tight sm:text-[40px]">
            {monthLabel(monthBase.year, monthBase.month)}
          </h1>
          <p className="mt-1.5 text-[12px] text-muted">
            {selectedDay.setLocale("zh-CN").toFormat("M月d日 cccc")}
            {dayItems.length > 0 ? ` · ${dayItems.length} 件日程` : " · 没有日程"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <Link
            href={`/calendar?month=${prevMonth.toFormat("yyyy-MM")}`}
            className="icon-btn icon-btn-plain"
            aria-label="上个月"
          >
            <ArrowLeft size={17} />
          </Link>
          <Link
            href={`/calendar?month=${nextMonth.toFormat("yyyy-MM")}`}
            className="icon-btn icon-btn-plain"
            aria-label="下个月"
          >
            <ArrowRight size={17} />
          </Link>
          <Link href="/compose/event" className="btn btn-primary btn-sm ml-1">
            <Plus size={14} /> 日程
          </Link>
        </div>
      </header>

      <div className="card mb-6 overflow-hidden p-2 sm:p-3">
        <div className="grid grid-cols-7 pb-1">
          {WEEKDAYS.map((label) => (
            <span key={label} className="py-1.5 text-center text-[10.5px] text-faint">
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((day) => {
            const key = day.toFormat("yyyy-MM-dd");
            const inMonth = day.hasSame(monthBase, "month");
            const isToday = day.hasSame(today, "day");
            const isSelected = key === selectedKey;
            const items = byDay.get(key) || [];
            const holiday = holidays.get(key);
            return (
              <Link
                key={key}
                href={`/calendar?month=${monthBase.toFormat("yyyy-MM")}&date=${key}`}
                className={`relative flex min-h-[58px] flex-col rounded-xl px-1 pb-1 pt-1.5 transition sm:min-h-[82px] sm:px-1.5 ${
                  isSelected
                    ? "bg-raised/80 ring-1 ring-line-strong"
                    : isToday
                      ? "bg-accent-soft/70 text-ink"
                      : inMonth
                        ? "hover:bg-raised"
                        : "text-faint/70 hover:bg-raised/60"
                }`}
                aria-current={isSelected ? "date" : undefined}
              >
                <span
                  className={`flex h-[21px] w-[21px] items-center justify-center self-start rounded-full text-[11.5px] tabular-nums leading-none ${
                    isSelected
                      ? "bg-ink font-semibold text-paper"
                      : isToday
                        ? "font-semibold text-accent"
                        : ""
                  }`}
                >
                  {day.day}
                </span>
                {holiday ? (
                  <span
                    className={`mt-0.5 block w-full truncate text-[8px] leading-none sm:text-[9px] ${
                      holiday.isOffDay ? "text-accent" : "text-faint"
                    }`}
                    title={`${holiday.name}${holiday.isOffDay ? "" : "（调休上班）"}`}
                  >
                    {holiday.isOffDay ? holiday.name : "班"}
                  </span>
                ) : null}
                <span className="mt-1 hidden flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                  {items.slice(0, 2).map(({ event, occurrence }, index) => (
                    <span
                      key={`${event.id}-${index}`}
                      className="truncate text-[9.5px] leading-tight text-muted"
                    >
                      {event.isAllDay ? "" : `${formatTime(occurrence, timezone)} `}
                      {event.title}
                    </span>
                  ))}
                  {items.length > 2 ? (
                    <span className="text-[8.5px] text-faint">+{items.length - 2}</span>
                  ) : null}
                </span>
                <span className="mt-auto flex gap-0.5 pt-1 sm:hidden">
                  {items.slice(0, 3).map(({ event }, index) => (
                    <span key={`${event.id}-${index}`} className="h-1 w-1 rounded-full bg-accent" />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">
          {selectedInMonth ? selectedDay.setLocale("zh-CN").toFormat("M月d日") : selectedDay.setLocale("zh-CN").toFormat("yyyy年M月d日")}
          <span className="ml-2 text-[11px] font-normal text-faint">
            {selectedDay.setLocale("zh-CN").toFormat("cccc")}
          </span>
        </h2>
        <span className="flex items-center gap-2">
          {!selectedDay.hasSame(today, "day") ? (
            <Link href="/calendar" className="text-[11.5px] text-faint hover:text-ink">
              回到今天
            </Link>
          ) : null}
          <Link
            href={`/compose/event?date=${selectedKey}`}
            className="text-[11.5px] text-accent"
          >
            + 添加
          </Link>
        </span>
      </div>

      {selectedHoliday ? (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-accent-soft/60 px-3.5 py-2.5 text-[12px]">
          <span className="font-medium text-accent">{selectedHoliday.name}</span>
          <span className="text-muted">{selectedHoliday.isOffDay ? "休息日" : "调休上班"}</span>
        </div>
      ) : null}

      {dayItems.length === 0 && dayTasks.length === 0 && dayBirthdays.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line-strong px-5 py-8 text-center">
          <p className="text-[13.5px] font-medium">这一天还没有安排</p>
          <Link href={`/compose/event?date=${selectedKey}`} className="btn btn-outline btn-sm mt-4">
            <CalendarDays size={14} /> 添加日程
          </Link>
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {dayBirthdays.map((profile) => (
            <div key={`birthday-${profile.id}`} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--gold)_16%,transparent)] text-gold">
                <Cake size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{profile.name} 的生日</p>
                <p className="text-[10.5px] text-faint">
                  {profile.profileType === "PET" ? "宠物生日" : "记得说生日快乐"}
                </p>
              </div>
              <Link href={`/profiles/${profile.id}`} className="text-[11.5px] text-accent">
                看看
              </Link>
            </div>
          ))}

          {dayItems.map(({ event, occurrence }) => (
            <div key={`${event.id}-${occurrence.toISOString()}`} className="px-4 py-3.5">
              <div className="flex items-start gap-3">
                <span className="w-[46px] shrink-0 pt-0.5 text-[11.5px] tabular-nums text-muted">
                  {event.isAllDay ? "全天" : formatTime(occurrence, timezone)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium leading-snug">
                    {event.title}
                    {event.status === "CANCELLED" ? (
                      <span className="ml-1.5 text-[10px] font-normal text-danger">已取消</span>
                    ) : null}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-faint">
                    {event.location ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin size={10} /> {event.location}
                      </span>
                    ) : null}
                    {event.recurrenceType !== "NONE" ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Repeat size={10} /> {recurrenceSummary(event.recurrenceType, event.recurrenceInterval)}
                      </span>
                    ) : null}
                    {parseStringArray(event.relatedProfileIds).length > 0 ? (
                      <span>{parseStringArray(event.relatedProfileIds).length} 人相关</span>
                    ) : null}
                    {parseStringArray(event.relatedAssetIds)
                      .map((id) => assetNames.get(id))
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((name) => (
                        <span key={name} className="inline-flex items-center gap-0.5">
                          <Boxes size={10} /> {name}
                        </span>
                      ))}
                  </div>
                  {event.description ? (
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">{event.description}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Link
                    href={`/calendar/events/${event.id}/edit`}
                    className="icon-btn icon-btn-plain"
                    aria-label="编辑日程"
                  >
                    <Pencil size={13.5} />
                  </Link>
                  <form action={cancelEventAction}>
                    <input type="hidden" name="id" value={event.id} />
                    <SubmitButton className="icon-btn icon-btn-plain" pendingText="">
                      <Ban size={13.5} />
                    </SubmitButton>
                  </form>
                  <form action={deleteEventAction}>
                    <input type="hidden" name="id" value={event.id} />
                    <ConfirmButton
                      className="icon-btn icon-btn-plain text-faint hover:text-danger"
                      message="删除这个日程？重复日程的所有提醒也会取消。"
                      pendingText=""
                    >
                      <Trash2 size={13.5} />
                    </ConfirmButton>
                  </form>
                </div>
              </div>
            </div>
          ))}

          {dayTasks.map((task) => (
            <Link
              key={task.id}
              href="/tasks"
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-raised/60"
            >
              <span className="w-[46px] shrink-0 text-[11.5px] tabular-nums text-muted">
                {task.dueAt ? formatTime(task.dueAt, timezone) : "全天"}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sage-soft text-sage">
                <CheckCircle2 size={13} />
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-[13px] ${
                  task.status === "DONE" ? "text-faint line-through" : ""
                }`}
              >
                {task.title}
              </span>
              {task.priority === "IMPORTANT" ? (
                <span className="text-[9.5px] text-accent">重要</span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
