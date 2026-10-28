import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Cake,
  CalendarDays,
  CheckCircle2,
  Pencil,
  Trash2,
} from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { profileWhere, publishedEntryWhere } from "@/lib/access";
import { ageLabel, daysUntil, formatDateFull, formatDayLabel, formatTime, nextBirthday } from "@/lib/dates";
import { occurrencesBetween } from "@/lib/recurrence";
import { entryCardInclude, toEntryCard } from "@/lib/entries-view";
import { parseStringArray } from "@/lib/json";
import { deleteProfileAction } from "@/app/actions/profiles";
import { Avatar } from "@/components/Avatar";
import { EntryCard } from "@/components/entries/EntryCard";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";

export default async function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;

  const profile = await prisma.familyProfile.findFirst({
    where: { id, ...profileWhere(viewer) },
    include: {
      linkedUser: { select: { displayName: true } },
      entries: {
        where: { entry: publishedEntryWhere(viewer) },
        include: { entry: { include: entryCardInclude } },
        orderBy: { entry: { occurredAt: "desc" } },
        take: 8,
      },
    },
  });
  if (!profile) notFound();

  const [avatar, photos, events, tasks] = await Promise.all([
    profile.avatarMediaId
      ? prisma.media.findFirst({
          where: {
            id: profile.avatarMediaId,
            householdId: context.household.id,
            status: "ACTIVE",
            OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
          },
          select: { id: true },
        })
      : null,
    prisma.media.findMany({
      where: {
        householdId: context.household.id,
        status: "ACTIVE",
        mediaType: "IMAGE",
        OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
        entryLinks: {
          some: {
            entry: {
              status: "PUBLISHED",
              profiles: { some: { profileId: id } },
              OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
            },
          },
        },
      },
      orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: { id: true, thumbnailKey: true },
    }),
    prisma.calendarEvent.findMany({
      where: {
        householdId: context.household.id,
        status: "ACTIVE",
        OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
      },
      take: 300,
    }),
    prisma.task.findMany({
      where: {
        householdId: context.household.id,
        status: "TODO",
        AND: [{ OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }] }],
      },
      take: 200,
    }),
  ]);

  const relatedEvents = events.filter((event) => parseStringArray(event.relatedProfileIds).includes(id));
  const relatedTasks = tasks.filter((task) => parseStringArray(task.relatedProfileIds).includes(id));

  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 86_400_000);
  const upcoming: { id: string; title: string; at: Date; kind: "event" | "task" }[] = [];
  for (const event of relatedEvents) {
    for (const occurrence of occurrencesBetween(
      event.startsAt,
      { type: event.recurrenceType, interval: event.recurrenceInterval, until: event.recurrenceUntil },
      now,
      horizon,
      timezone,
      5,
    )) {
      upcoming.push({ id: event.id, title: event.title, at: occurrence, kind: "event" });
    }
  }
  for (const task of relatedTasks) {
    if (task.dueAt && task.dueAt >= now) {
      upcoming.push({ id: task.id, title: task.title, at: task.dueAt, kind: "task" });
    }
  }
  upcoming.sort((a, b) => a.at.getTime() - b.at.getTime());

  const entries = profile.entries.map((link) => toEntryCard(link.entry, viewer));
  const birthday = nextBirthday(profile.birthday, timezone);
  const countdown = birthday ? daysUntil(birthday, timezone) : null;
  const age = ageLabel(profile.birthday, timezone);
  const avatarUrl = avatar ? `/api/media/${avatar.id}/thumb` : null;
  const isSelf = profile.linkedUserId === context.user.id;

  return (
    <div>
      <header className="mb-7 flex items-center justify-between">
        <Link href="/profiles" className="icon-btn icon-btn-plain -ml-2" aria-label="返回">
          <ArrowLeft size={19} strokeWidth={1.8} />
        </Link>
        <div className="flex items-center gap-1">
          <Link href={`/profiles/${profile.id}/edit`} className="icon-btn icon-btn-plain" aria-label="编辑">
            <Pencil size={16} />
          </Link>
          {context.role === "OWNER" && !profile.linkedUserId ? (
            <form action={deleteProfileAction}>
              <input type="hidden" name="id" value={profile.id} />
              <ConfirmButton
                className="icon-btn icon-btn-plain text-faint hover:text-danger"
                message="删除这个档案？相关记录不会被删除，但会失去和 TA 的关联。"
                pendingText=""
              >
                <Trash2 size={16} />
              </ConfirmButton>
            </form>
          ) : null}
        </div>
      </header>

      <section className="mb-8">
        <div className="flex items-center gap-5">
          <Avatar name={profile.name} src={avatarUrl} size={84} ring />
          <div className="min-w-0">
            <p className="eyebrow">{profile.profileType === "PET" ? "Pet" : "Family"}</p>
            <h1 className="font-display mt-1 text-[36px] leading-none tracking-tight">{profile.name}</h1>
            <p className="mt-2 text-[12px] text-muted">
              {[profile.species, profile.breed].filter(Boolean).join(" · ")}
              {profile.profileType === "PET" && (profile.species || profile.breed) ? "" : ""}
              {(profile.species || profile.breed) && age ? " · " : ""}
              {age || ""}
              {!profile.species && !profile.breed && !age
                ? profile.linkedUser
                  ? "家庭成员"
                  : "家里的成员"
                : ""}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {profile.birthday ? (
            <span className="chip">
              <Cake size={12} />
              {formatDateFull(profile.birthday, timezone)}
              {countdown !== null && countdown <= 30
                ? ` · ${countdown === 0 ? "今天" : `${countdown} 天后`}`
                : ""}
            </span>
          ) : null}
          {profile.joinedDate ? (
            <span className="chip">
              {profile.profileType === "PET" ? "到家" : "加入"} {formatDateFull(profile.joinedDate, timezone)}
            </span>
          ) : null}
          {isSelf ? <span className="chip chip-active">这是你</span> : null}
        </div>

        {profile.description ? (
          <p className="prose-body mt-5">{profile.description}</p>
        ) : (
          <p className="mt-5 text-[12.5px] text-faint">
            还没有写关于 {profile.profileType === "PET" ? "它" : "TA"} 的介绍。
            <Link href={`/profiles/${profile.id}/edit`} className="ml-1 text-accent">
              补充一点
            </Link>
          </p>
        )}
      </section>

      {upcoming.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2.5 text-[13px] font-semibold">接下来的日子</h2>
          <div className="card divide-y divide-line overflow-hidden">
            {upcoming.slice(0, 5).map((item, index) => (
              <Link
                key={`${item.kind}-${item.id}-${index}`}
                href={item.kind === "event" ? "/calendar" : "/tasks"}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-raised/60"
              >
                <span className="w-[52px] shrink-0 text-[11px] text-muted">
                  {formatDayLabel(item.at, timezone)}
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-raised text-muted">
                  {item.kind === "event" ? <CalendarDays size={12} /> : <CheckCircle2 size={12} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{item.title}</span>
                <span className="text-[10px] text-faint">
                  {formatTime(item.at, timezone)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {photos.length > 0 ? (
        <section className="mb-8">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold">照片</h2>
            <Link
              href={`/timeline?profile=${profile.id}`}
              className="text-[11px] text-faint hover:text-ink"
            >
              所有记录
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
            {photos.map((photo) => (
              <Link
                key={photo.id}
                href={`/photos/${photo.id}`}
                className="aspect-square overflow-hidden rounded-xl bg-raised"
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
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold">
            和 {profile.profileType === "PET" ? "它" : "TA"} 有关的记录
          </h2>
          <Link
            href={`/timeline?profile=${profile.id}`}
            className="text-[11px] text-faint hover:text-ink"
          >
            全部
          </Link>
        </div>
        {entries.length === 0 ? (
          <EmptyState
            compact
            icon={<CalendarDays strokeWidth={1.7} />}
            title="还没有相关记录"
            description={`下次记录时，在「和谁一起」里选中 ${profile.name}，就会出现在这里。`}
          />
        ) : (
          <div className="space-y-3">
            {entries.slice(0, 4).map((entry) => (
              <EntryCard key={entry.id} entry={entry} timezone={timezone} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
