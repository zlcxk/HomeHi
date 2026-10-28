import Link from "next/link";
import { DateTime } from "luxon";
import {
  ArrowRight,
  Cake,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  ListTodo,
  MessagesSquare,
  PenLine,
  Plus,
  Sparkles,
} from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishedEntryWhere } from "@/lib/access";
import { formatDayLabel, formatTime, greeting, localHourNow } from "@/lib/dates";
import { occurrencesBetween } from "@/lib/recurrence";
import { entryCardInclude, toEntryCard } from "@/lib/entries-view";
import { DEMO_SETTING_KEY } from "@/lib/constants";
import { EntryCard } from "@/components/entries/EntryCard";
import { EmptyState } from "@/components/EmptyState";

type AgendaItem = {
  key: string;
  kind: "event" | "task";
  title: string;
  at: Date | null;
  isAllDay: boolean;
  href: string;
  meta?: string;
  overdue?: boolean;
};

export default async function TodayPage() {
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;
  const now = new Date();
  const dayStart = DateTime.now().setZone(timezone).startOf("day");
  const dayEnd = dayStart.endOf("day");
  const weekEnd = dayStart.plus({ days: 7 }).endOf("day");

  const [events, tasks, profiles, topics, recentRows, onThisDayRows, photos, demoSetting] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        householdId: context.household.id,
        status: "ACTIVE",
        OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
      },
      orderBy: { startsAt: "asc" },
      take: 400,
      select: {
        id: true,
        title: true,
        startsAt: true,
        isAllDay: true,
        recurrenceType: true,
        recurrenceInterval: true,
        recurrenceUntil: true,
      },
    }),
    prisma.task.findMany({
      where: {
        householdId: context.household.id,
        status: "TODO",
        dueAt: { not: null, lte: dayEnd.toJSDate() },
        AND: [{ OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }] }],
      },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 30,
      select: { id: true, title: true, dueAt: true, priority: true, assigneeUserId: true },
    }),
    prisma.familyProfile.findMany({
      where: {
        householdId: context.household.id,
        birthday: { not: null },
        OR: [{ visibility: "HOUSEHOLD" }, { linkedUserId: context.user.id }],
      },
      select: { id: true, name: true, birthday: true, profileType: true },
    }),
    prisma.topic.findMany({
      where: { householdId: context.household.id, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        _count: { select: { notes: true, opinions: true, links: true, attachments: true } },
      },
    }),
    prisma.entry.findMany({
      where: publishedEntryWhere(viewer),
      include: entryCardInclude,
      orderBy: { occurredAt: "desc" },
      take: 3,
    }),
    (() => {
      const ranges: Prisma.EntryWhereInput[] = [];
      for (let year = dayStart.year - 1; year >= dayStart.year - 40; year -= 1) {
        const start = DateTime.fromObject(
          { year, month: dayStart.month, day: dayStart.day },
          { zone: timezone },
        );
        if (!start.isValid) continue;
        ranges.push({
          occurredAt: {
            gte: start.startOf("day").toUTC().toJSDate(),
            lte: start.endOf("day").toUTC().toJSDate(),
          },
        });
      }
      return prisma.entry.findMany({
        where: {
          ...publishedEntryWhere(viewer),
          AND: [{ OR: ranges }],
        },
        include: entryCardInclude,
        orderBy: { occurredAt: "desc" },
        take: 4,
      });
    })(),
    prisma.media.findMany({
      where: {
        householdId: context.household.id,
        status: "ACTIVE",
        mediaType: "IMAGE",
        OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
      },
      orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: { id: true, thumbnailKey: true },
    }),
    prisma.appSetting.findUnique({ where: { key: DEMO_SETTING_KEY } }),
  ]);

  const todayItems: AgendaItem[] = [];
  const upcomingItems: { key: string; title: string; at: Date; isAllDay: boolean; href: string }[] = [];

  for (const event of events) {
    const rule = {
      type: event.recurrenceType,
      interval: event.recurrenceInterval,
      until: event.recurrenceUntil,
    };
    const todays = occurrencesBetween(event.startsAt, rule, dayStart.toJSDate(), dayEnd.toJSDate(), timezone, 4);
    for (const occurrence of todays) {
      todayItems.push({
        key: `event-${event.id}-${occurrence.toISOString()}`,
        kind: "event",
        title: event.title,
        at: occurrence,
        isAllDay: event.isAllDay,
        href: `/calendar?date=${dayStart.toFormat("yyyy-MM-dd")}`,
        meta: "日程",
      });
    }
    if (upcomingItems.length < 6) {
      const next = occurrencesBetween(
        event.startsAt,
        rule,
        dayStart.plus({ days: 1 }).startOf("day").toJSDate(),
        weekEnd.toJSDate(),
        timezone,
        2,
      );
      for (const occurrence of next) {
        upcomingItems.push({
          key: `event-${event.id}-${occurrence.toISOString()}`,
          title: event.title,
          at: occurrence,
          isAllDay: event.isAllDay,
          href: `/calendar?date=${DateTime.fromJSDate(occurrence, { zone: timezone }).toFormat("yyyy-MM-dd")}`,
        });
      }
    }
  }

  for (const task of tasks) {
    if (!task.dueAt) continue;
    todayItems.push({
      key: `task-${task.id}`,
      kind: "task",
      title: task.title,
      at: task.dueAt,
      isAllDay: false,
      href: "/tasks",
      meta: task.priority === "IMPORTANT" ? "重要待办" : "待办",
      overdue: DateTime.fromJSDate(task.dueAt, { zone: timezone }).toMillis() < dayStart.toMillis(),
    });
  }

  todayItems.sort((a, b) => {
    if (!a.at) return 1;
    if (!b.at) return -1;
    return a.at.getTime() - b.at.getTime();
  });
  upcomingItems.sort((a, b) => a.at.getTime() - b.at.getTime());

  const birthdaysToday = profiles.filter((profile) => {
    if (!profile.birthday) return false;
    const birth = DateTime.fromJSDate(profile.birthday, { zone: timezone });
    return birth.month === dayStart.month && birth.day === dayStart.day;
  });

  const recent = recentRows.map((entry) => toEntryCard(entry, viewer));
  const onThisDay = onThisDayRows.map((entry) => toEntryCard(entry, viewer));
  const nextUp = todayItems.find((item) => item.at && item.at.getTime() >= now.getTime());
  const overdueCount = todayItems.filter((item) => item.overdue).length;
  const firstName = context.user.displayName.trim().split(/\s+/)[0] || context.user.displayName;
  const hasAnything =
    todayItems.length > 0 ||
    birthdaysToday.length > 0 ||
    recent.length > 0 ||
    onThisDay.length > 0 ||
    topics.length > 0;

  return (
    <div>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{context.household.name} · HomeHi</p>
          <h1 className="font-display mt-2 text-[38px] leading-[1.02] tracking-[-0.03em] sm:text-[50px]">
            {greeting(localHourNow(timezone))}，{firstName}
          </h1>
          <p className="mt-2 text-[12.5px] text-faint">
            {dayStart.setLocale("zh-CN").toFormat("yyyy年M月d日 cccc")}
            {todayItems.length > 0 ? ` · ${todayItems.length} 件事` : " · 没有安排"}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <span className="display-number block text-[54px] text-ink">{dayStart.toFormat("dd")}</span>
          <span className="text-[10.5px] tracking-[0.16em] text-faint uppercase">
            {dayStart.setLocale("en").toFormat("LLL yyyy")}
          </span>
        </div>
      </header>

      {demoSetting?.value === "true" ? (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-line bg-accent-soft/60 px-4 py-3">
          <p className="text-[12px] leading-relaxed text-muted">
            <Sparkles size={13} className="mr-1 inline text-accent" />
            当前是示例数据，可随时清空。
          </p>
          <Link href="/settings/data" className="shrink-0 text-[11.5px] font-semibold text-accent">
            管理
          </Link>
        </div>
      ) : null}

      {nextUp ? (
        <section className="card hero-warm card-organic relative mb-8 overflow-hidden p-5 sm:p-6">
          <div className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow flex items-center gap-1.5">
                <Clock size={11} /> 接下来
              </p>
              <h2 className="font-display mt-2 text-[28px] leading-tight tracking-[-0.02em] sm:text-[32px]">
                {nextUp.title}
              </h2>
              <p className="mt-1.5 text-[12.5px] text-muted">
                {nextUp.isAllDay ? "全天" : nextUp.at ? formatTime(nextUp.at, timezone) : ""}
                {nextUp.meta ? ` · ${nextUp.meta}` : ""}
              </p>
            </div>
            <Link
              href={nextUp.href}
              className="icon-btn shrink-0 border-transparent bg-accent text-accent-ink"
              aria-label="查看"
            >
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mb-9">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 font-display text-[19px] leading-tight">
            今天
            {overdueCount > 0 ? (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                {overdueCount} 件已过期
              </span>
            ) : null}
          </h2>
          <Link href="/calendar" className="text-[11.5px] text-faint transition hover:text-ink">
            日历
          </Link>
        </div>

        {todayItems.length === 0 && birthdaysToday.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-line-strong px-5 py-7">
            <p className="text-[13.5px] font-medium">今天没有安排</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/compose/moment" className="btn btn-primary btn-sm">
                <Camera size={14} /> 记一个瞬间
              </Link>
              <Link href="/compose/event" className="btn btn-outline btn-sm">
                <CalendarDays size={14} /> 加日程
              </Link>
            </div>
          </div>
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {birthdaysToday.map((profile) => (
              <div key={`birthday-${profile.id}`} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--gold)_16%,transparent)] text-gold">
                  <Cake size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{profile.name} 的生日</p>
                  <p className="text-[11px] text-faint">
                    {profile.profileType === "PET" ? "宠物生日" : "生日"}
                  </p>
                </div>
                <Link href={`/profiles/${profile.id}`} className="text-[11.5px] text-accent">
                  看看
                </Link>
              </div>
            ))}

            {todayItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-raised/60"
              >
                <span className="w-[48px] shrink-0 text-[11.5px] tabular-nums text-muted">
                  {item.isAllDay ? "全天" : item.at ? formatTime(item.at, timezone) : "—"}
                </span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    item.kind === "event"
                      ? "bg-accent-soft text-accent"
                      : item.overdue
                        ? "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger"
                        : "bg-sage-soft text-sage"
                  }`}
                >
                  {item.kind === "event" ? <CalendarDays size={13} /> : <CheckCircle2 size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{item.title}</span>
                  <span className="block text-[10.5px] text-faint">
                    {item.meta}
                    {item.overdue ? " · 已过期" : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {topics.length > 0 ? (
        <section className="mb-9">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[19px] leading-tight">正在讨论</h2>
            <Link href="/topics" className="text-[11.5px] text-faint transition hover:text-ink">
              全部
            </Link>
          </div>
          <div className="card divide-y divide-line overflow-hidden">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topics/${topic.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-raised/60"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <MessagesSquare size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{topic.title}</p>
                  <p className="mt-0.5 text-[10.5px] text-faint">
                    想法 {topic._count.notes} · 意见 {topic._count.opinions} · 资料{" "}
                    {topic._count.links + topic._count.attachments}
                  </p>
                </div>
                <ArrowRight size={14} className="shrink-0 text-faint" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {onThisDay.length > 0 ? (
        <section className="mb-9">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[19px] leading-tight">那年今天</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {onThisDay.slice(0, 2).map((entry) => (
              <Link
                key={entry.id}
                href={`/entries/${entry.id}`}
                className="group relative overflow-hidden rounded-[22px] border border-line bg-raised"
              >
                {entry.media[0]?.thumbUrl ? (
                  <img
                    src={entry.media[0].thumbUrl}
                    alt=""
                    className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-raised">
                    <PenLine size={22} className="text-faint" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3.5 pt-10">
                  <p className="text-[10px] tracking-[0.14em] text-white/70 uppercase">
                    {formatDayLabel(entry.occurredAt, timezone)} · 那一年
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[13.5px] font-medium text-white">
                    {entry.title || entry.body || "一张照片"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {upcomingItems.length > 0 ? (
        <section className="mb-9">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[19px] leading-tight">接下来几天</h2>
            <Link href="/calendar" className="text-[11.5px] text-faint transition hover:text-ink">
              全部
            </Link>
          </div>
          <div className="card divide-y divide-line overflow-hidden">
            {upcomingItems.slice(0, 4).map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-raised/60"
              >
                <span className="w-[48px] shrink-0 text-[11.5px] text-muted">
                  {formatDayLabel(item.at, timezone)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{item.title}</span>
                <span className="shrink-0 text-[10.5px] text-faint">
                  {item.isAllDay ? "全天" : formatTime(item.at, timezone)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {photos.length > 0 ? (
        <section className="mb-9">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[19px] leading-tight">最近的照片</h2>
            <Link href="/photos" className="text-[11.5px] text-faint transition hover:text-ink">
              照片墙
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {photos.map((photo) => (
              <Link
                key={photo.id}
                href={`/photos/${photo.id}`}
                className="media-frame aspect-square rounded-xl"
              >
                <img
                  src={`/api/media/${photo.id}/thumb?v=${encodeURIComponent(photo.thumbnailKey || "0")}`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-[19px] leading-tight">最近留下的</h2>
          <Link href="/timeline" className="text-[11.5px] text-faint transition hover:text-ink">
            全部时光
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={<PenLine strokeWidth={1.7} />}
            title={hasAnything ? "还没有记下什么" : "从今天开始，收好一点日子"}
            description="一张照片、一句话，都可以。"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/compose/moment" className="btn btn-primary btn-sm">
                  <Camera size={14} /> 记一个瞬间
                </Link>
                <Link href="/compose/story" className="btn btn-outline btn-sm">
                  <PenLine size={14} /> 写几句
                </Link>
              </div>
            }
          />
        ) : (
          <div className="space-y-4">
            {recent.map((entry) => (
              <EntryCard key={entry.id} entry={entry} timezone={timezone} compact />
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 hidden justify-center gap-2 sm:flex">
        <Link href="/compose/moment" className="btn btn-primary btn-sm">
          <Plus size={14} /> 记录此刻
        </Link>
        <Link href="/compose/task" className="btn btn-outline btn-sm">
          <ListTodo size={14} /> 加待办
        </Link>
      </div>
    </div>
  );
}
