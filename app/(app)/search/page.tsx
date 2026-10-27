import Link from "next/link";
import {
  Boxes,
  CalendarDays,
  CheckCircle2,
  Images,
  PenLine,
  Search as SearchIcon,
  Users,
} from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assetWhere, mediaWhere, publishedEntryWhere, taskWhere, profileWhere } from "@/lib/access";
import { dayKey, formatDateFull, formatDayLabel, formatTime } from "@/lib/dates";
import { entryCardInclude, toEntryCard } from "@/lib/entries-view";
import { assetCategoryLabel, expiryHint } from "@/lib/assets";
import { EntryCard } from "@/components/entries/EntryCard";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";

const SEARCH_TYPES = [
  { value: "all", label: "全部" },
  { value: "entries", label: "记录" },
  { value: "media", label: "照片" },
  { value: "events", label: "日程" },
  { value: "tasks", label: "待办" },
  { value: "profiles", label: "家人与宠物" },
  { value: "assets", label: "物品与资产" },
] as const;

function SearchForm({ q, type, autoFocus = false }: { q: string; type: string; autoFocus?: boolean }) {
  return (
    <form action="/search" className="card mb-5 p-2.5">
      <div className="flex items-center gap-2 px-1.5">
        <SearchIcon size={17} className="shrink-0 text-faint" />
        <input
          name="q"
          defaultValue={q}
          autoFocus={autoFocus}
          placeholder="搜点什么…"
          className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base outline-none placeholder:text-faint sm:text-[14px]"
          aria-label="搜索"
        />
        <button type="submit" className="btn btn-soft btn-sm shrink-0">
          搜索
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-line px-1.5 pt-2">
        <label htmlFor="search-type" className="text-[11px] text-faint">
          范围
        </label>
        <select id="search-type" name="type" defaultValue={type} className="select-inline max-w-[62%]">
          {SEARCH_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const type = SEARCH_TYPES.some((item) => item.value === params.type) ? params.type! : "all";
  const show = (key: string) => type === "all" || type === key;

  if (!q) {
    const [tags, recent] = await Promise.all([
      prisma.tag.findMany({
        where: { householdId: context.household.id },
        orderBy: { name: "asc" },
        take: 24,
        select: { name: true },
      }),
      prisma.entry.findMany({
        where: publishedEntryWhere(viewer),
        include: entryCardInclude,
        orderBy: { occurredAt: "desc" },
        take: 4,
      }),
    ]);

    return (
      <div>
        <PageHeader title="搜索" eyebrow="Find anything" />

        <SearchForm q="" type={type} autoFocus />

        {tags.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-2.5 text-[13px] font-semibold">按标签找</h2>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Link key={tag.name} href={`/timeline?tag=${encodeURIComponent(tag.name)}`} className="chip">
                  #{tag.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {recent.length > 0 ? (
          <section>
            <h2 className="mb-2.5 text-[13px] font-semibold">最近留下的</h2>
            <div className="space-y-3">
              {recent.map((entry) => (
                <EntryCard key={entry.id} entry={toEntryCard(entry, viewer)} timezone={timezone} compact />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  const contains = { contains: q } as const;
  const [entries, media, events, tasks, profiles, tags, assets] = await Promise.all([
    prisma.entry.findMany({
      where: {
        ...publishedEntryWhere(viewer),
        OR: [{ title: contains }, { body: contains }, { location: contains }],
      },
      include: entryCardInclude,
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),
    prisma.media.findMany({
      where: {
        ...mediaWhere(viewer),
        OR: [{ caption: contains }, { originalFilename: contains }],
      },
      orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: { id: true, thumbnailKey: true, caption: true },
    }),
    prisma.calendarEvent.findMany({
      where: {
        householdId: context.household.id,
        status: "ACTIVE",
        AND: [
          { OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }] },
          { OR: [{ title: contains }, { description: contains }, { location: contains }] },
        ],
      },
      orderBy: { startsAt: "desc" },
      take: 8,
    }),
    prisma.task.findMany({
      where: {
        ...taskWhere(viewer),
        AND: [{ OR: [{ title: contains }, { description: contains }, { location: contains }] }],
      },
      orderBy: [{ status: "asc" }, { dueAt: "desc" }],
      take: 8,
    }),
    prisma.familyProfile.findMany({
      where: {
        ...profileWhere(viewer),
        OR: [{ name: contains }, { description: contains }, { breed: contains }],
      },
      take: 8,
    }),
    prisma.tag.findMany({
      where: { householdId: context.household.id, name: contains },
      take: 12,
    }),
    prisma.asset.findMany({
      where: {
        ...assetWhere(viewer),
        OR: [
          { name: contains },
          { brand: contains },
          { model: contains },
          { serialNumber: contains },
          { location: contains },
          { notes: contains },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  const avatarIds = profiles.map((p) => p.avatarMediaId).filter((id): id is string => Boolean(id));
  const avatars = avatarIds.length
    ? new Set(
        (
          await prisma.media.findMany({
            where: {
              id: { in: avatarIds },
              householdId: context.household.id,
              status: "ACTIVE",
              OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
            },
            select: { id: true },
          })
        ).map((m) => m.id),
      )
    : new Set<string>();

  const total =
    (show("entries") ? entries.length : 0) +
    (show("media") ? media.length : 0) +
    (show("events") ? events.length : 0) +
    (show("tasks") ? tasks.length : 0) +
    (show("profiles") ? profiles.length : 0) +
    (show("assets") ? assets.length : 0) +
    (type === "all" ? tags.length : 0);

  return (
    <div>
      <PageHeader title="搜索" eyebrow="Find anything" />

      <SearchForm q={q} type={type} />

      <p className="mb-6 text-[12px] text-muted">
        「{q}」找到 {total} 条结果
      </p>

      {total === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line-strong px-5 py-12 text-center">
          <SearchIcon size={22} className="mx-auto text-faint" />
          <p className="mt-3 text-[14px] font-medium">没有找到</p>
          <p className="mt-1 text-[12.5px] text-muted">换个词试试。</p>
          <Link href="/timeline" className="btn btn-outline btn-sm mt-4">
            看看时光
          </Link>
        </div>
      ) : null}

      {show("entries") && entries.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
            <PenLine size={14} className="text-faint" /> 记录
            <span className="font-normal text-faint">{entries.length}</span>
          </h2>
          <div className="space-y-3">
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={toEntryCard(entry, viewer)} timezone={timezone} compact />
            ))}
          </div>
        </section>
      ) : null}

      {show("media") && media.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
            <Images size={14} className="text-faint" /> 照片
            <span className="font-normal text-faint">{media.length}</span>
          </h2>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {media.map((item) => (
              <Link
                key={item.id}
                href={`/photos/${item.id}`}
                className="aspect-square overflow-hidden rounded-xl bg-raised"
              >
                {item.thumbnailKey ? (
                  <img
                    src={`/api/media/${item.id}/thumb`}
                    alt={item.caption || ""}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {show("profiles") && profiles.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
            <Users size={14} className="text-faint" /> 家人与宠物
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {profiles.map((profile) => (
              <Link
                key={profile.id}
                href={`/profiles/${profile.id}`}
                className="card flex items-center gap-3 p-3.5"
              >
                <Avatar
                  name={profile.name}
                  size={38}
                  src={
                    profile.avatarMediaId && avatars.has(profile.avatarMediaId)
                      ? `/api/media/${profile.avatarMediaId}/thumb`
                      : null
                  }
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{profile.name}</p>
                  <p className="truncate text-[10.5px] text-faint">
                    {profile.species || (profile.profileType === "PET" ? "宠物" : "家庭成员")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {show("events") && events.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
            <CalendarDays size={14} className="text-faint" /> 日程
          </h2>
          <div className="card divide-y divide-line overflow-hidden">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/calendar?date=${dayKey(event.startsAt, timezone)}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60"
              >
                <span className="w-[78px] shrink-0 whitespace-nowrap text-[10.5px] text-muted">
                  {formatDateFull(event.startsAt, timezone)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{event.title}</span>
                <span className="text-[10px] text-faint">
                  {event.isAllDay ? "全天" : formatTime(event.startsAt, timezone)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {show("tasks") && tasks.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
            <CheckCircle2 size={14} className="text-faint" /> 待办
          </h2>
          <div className="card divide-y divide-line overflow-hidden">
            {tasks.map((task) => (
              <Link key={task.id} href="/tasks" className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60">
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{task.title}</span>
                <span className="text-[10px] text-faint">
                  {task.dueAt ? formatDayLabel(task.dueAt, timezone) : "没有时间"}
                  {task.status === "DONE" ? " · 已完成" : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {show("assets") && assets.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
            <Boxes size={14} className="text-faint" /> 物品与资产
            <span className="font-normal text-faint">{assets.length}</span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {assets.map((asset) => {
              const warranty = expiryHint(asset.warrantyUntil, timezone, "质保");
              return (
                <Link
                  key={asset.id}
                  href={`/assets/${asset.id}`}
                  className="card flex items-center gap-3 p-3.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-muted">
                    <Boxes size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{asset.name}</span>
                    <span className="block truncate text-[10.5px] text-faint">
                      {[assetCategoryLabel(asset.category), asset.brand, asset.location]
                        .filter(Boolean)
                        .join(" · ")}
                      {warranty ? ` · ${warranty}` : ""}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {type === "all" && tags.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2.5 text-[13px] font-semibold">标签</h2>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Link key={tag.id} href={`/timeline?tag=${encodeURIComponent(tag.name)}`} className="chip">
                #{tag.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
