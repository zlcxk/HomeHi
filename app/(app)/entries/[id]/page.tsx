import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, Lock, Pencil, Play, RotateCcw, Send, Tag, Trash2, Users } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewEntry } from "@/lib/access";
import { formatDateFull, formatDayLabel, formatTime } from "@/lib/dates";
import { ENTRY_TYPE_LABEL } from "@/lib/constants";
import { deleteEntryAction, setEntryStatusAction } from "@/app/actions/entries";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";

export default async function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;

  const entry = await prisma.entry.findUnique({
    where: { id },
    include: {
      media: { orderBy: { sortOrder: "asc" }, include: { media: true } },
      profiles: { include: { profile: { select: { id: true, name: true, profileType: true } } } },
      tags: { include: { tag: true } },
      creator: { select: { displayName: true } },
    },
  });

  if (!entry || !canViewEntry(entry, viewer)) notFound();

  const media = entry.media
    .map((link) => link.media)
    .filter((item) => item.status === "ACTIVE")
    .filter((item) => item.visibility === "HOUSEHOLD" || item.uploadedBy === context.user.id);

  const isDraft = entry.status === "DRAFT";
  const isArchived = entry.status === "ARCHIVED";
  const canEdit = entry.createdBy === context.user.id || entry.visibility === "HOUSEHOLD";

  return (
    <article>
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <Link href="/timeline" className="icon-btn icon-btn-plain -ml-2" aria-label="返回时光">
            <ArrowLeft size={19} strokeWidth={1.8} />
          </Link>
          <div className="flex items-center gap-1">
            {canEdit ? (
              <Link href={`/entries/${entry.id}/edit`} className="icon-btn icon-btn-plain" aria-label="编辑">
                <Pencil size={16} />
              </Link>
            ) : null}
            <form action={setEntryStatusAction}>
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="status" value={isArchived ? "PUBLISHED" : "ARCHIVED"} />
              <SubmitButton className="icon-btn icon-btn-plain" pendingText="">
                {isArchived ? <RotateCcw size={16} /> : <Archive size={16} />}
              </SubmitButton>
            </form>
            <form action={deleteEntryAction}>
              <input type="hidden" name="id" value={entry.id} />
              <ConfirmButton
                className="icon-btn icon-btn-plain text-faint hover:text-danger"
                message="把这条记录移到回收站？照片会保留，可以从回收站恢复。"
                pendingText=""
              >
                <Trash2 size={16} />
              </ConfirmButton>
            </form>
          </div>
        </div>

        {isDraft ? (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
            <div className="flex items-center gap-2 text-[12.5px] text-muted">
              <Lock size={14} /> 草稿，只有你能看到
            </div>
            <form action={setEntryStatusAction}>
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="status" value="PUBLISHED" />
              <SubmitButton className="btn btn-primary btn-sm" pendingText="发布中…">
                <Send size={13} /> 发布
              </SubmitButton>
            </form>
          </div>
        ) : null}

        {isArchived ? (
          <p className="mt-5 rounded-2xl border border-line bg-surface px-4 py-3 text-[12.5px] text-muted">
            这条记录已归档，不在时光流里展示，但仍然保留。
          </p>
        ) : null}

        <p className="eyebrow mt-6">
          {formatDateFull(entry.occurredAt, timezone)} · {formatTime(entry.occurredAt, timezone)}
          {entry.entryType !== "MOMENT" ? ` · ${ENTRY_TYPE_LABEL[entry.entryType] || "记录"}` : ""}
        </p>
        {entry.title ? (
          <h1 className="font-display mt-2.5 text-[38px] leading-[1.08] tracking-tight sm:text-[46px]">
            {entry.title}
          </h1>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-faint">
          <span>{entry.creator.displayName} 记录</span>
          <span className="h-1 w-1 rounded-full bg-line-strong" />
          <span>{formatDayLabel(entry.occurredAt, timezone)}</span>
          {entry.visibility === "PRIVATE" ? (
            <>
              <span className="h-1 w-1 rounded-full bg-line-strong" />
              <span className="inline-flex items-center gap-1">
                <Lock size={10.5} /> 仅自己
              </span>
            </>
          ) : null}
          {entry.isDemo ? (
            <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] text-muted">示例数据</span>
          ) : null}
        </div>
      </header>

      {media.length > 0 ? (
        <div className="mb-8 space-y-2">
          {media.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-[22px] bg-raised">
              {item.mediaType === "VIDEO" ? (
                <video
                  controls
                  playsInline
                  preload="metadata"
                  poster={item.thumbnailKey ? `/api/media/${item.id}/thumb` : undefined}
                  className="max-h-[64vh] w-full bg-black object-contain"
                  src={`/api/media/${item.id}/file`}
                />
              ) : (
                <Link href={`/photos/${item.id}`} className="block">
                  <img
                    src={`/api/media/${item.id}/file`}
                    alt={item.caption || entry.title || "记录照片"}
                    className="max-h-[72vh] w-full object-contain"
                  />
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {entry.body ? <div className="prose-body">{entry.body}</div> : null}

      {entry.profiles.length > 0 || entry.tags.length > 0 ? (
        <footer className="hairline mt-10 space-y-3 pt-5">
          {entry.profiles.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10.5px] tracking-wider text-faint uppercase">
                <Users size={11} /> 有关的人
              </span>
              {entry.profiles.map((link) => (
                <Link
                  key={link.profileId}
                  href={`/profiles/${link.profileId}`}
                  className="chip"
                >
                  {link.profile.name}
                  {link.profile.profileType === "PET" ? " · 宠物" : ""}
                </Link>
              ))}
            </div>
          ) : null}
          {entry.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10.5px] tracking-wider text-faint uppercase">
                <Tag size={11} /> 标签
              </span>
              {entry.tags.map((link) => (
                <Link key={link.tagId} href={`/timeline?tag=${encodeURIComponent(link.tag.name)}`} className="chip">
                  #{link.tag.name}
                </Link>
              ))}
            </div>
          ) : null}
        </footer>
      ) : null}

      <p className="mt-10 text-[10.5px] text-faint">
        最后更新于 {formatDayLabel(entry.updatedAt, timezone)} {formatTime(entry.updatedAt, timezone)}
      </p>
    </article>
  );
}
