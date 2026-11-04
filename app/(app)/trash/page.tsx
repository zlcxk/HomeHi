import Link from "next/link";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { canViewTrashEntry, trashEntryWhere } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatDateFull, formatDateTime } from "@/lib/dates";
import { restoreEntryAction, purgeEntryAction } from "@/app/actions/entries";
import { purgeMediaAction, restoreMediaAction } from "@/app/actions/media";
import {
  blockingReferenceCount,
  describeMediaCascades,
  describeMediaReferences,
  getMediaReferenceCounts,
  hasLegacyDeletedRefs,
} from "@/lib/media-lifecycle";
import {
  formatTrashRemaining,
  isTrashExpired,
  trashExpiresAt,
  TRASH_RETENTION_DAYS,
} from "@/lib/trash";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";

function mediaTitle(media: { caption: string | null; originalFilename: string }) {
  return media.caption?.trim() || media.originalFilename || "照片";
}

const ENTRY_STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const context = await requireContext();
  const timezone = context.household.timezone;
  const now = new Date();
  const { error: errorParam } = await searchParams;
  const errorMessage =
    typeof errorParam === "string" && errorParam ? errorParam.slice(0, 200) : null;

  const viewer = { userId: context.user.id, householdId: context.household.id };

  const [entries, deletedMedia] = await Promise.all([
    prisma.entry.findMany({
      where: trashEntryWhere(viewer),
      orderBy: { deletedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        body: true,
        occurredAt: true,
        deletedAt: true,
        deletedFromStatus: true,
        createdBy: true,
        householdId: true,
        visibility: true,
        status: true,
      },
    }),
    prisma.media.findMany({
      where: {
        householdId: context.household.id,
        // PURGING 也显示出来：清理中断时用户能看到状态，而不是内容凭空消失。
        status: { in: ["DELETED", "PURGING"] },
        // OWNER 可以管理共享照片，但不在回收站里展示其他成员的 PRIVATE 媒体。
        ...(context.role === "OWNER"
          ? { OR: [{ uploadedBy: context.user.id }, { visibility: "HOUSEHOLD" }] }
          : { uploadedBy: context.user.id }),
      },
      orderBy: { deletedAt: "desc" },
      take: 50,
      select: {
        id: true,
        mediaType: true,
        originalFilename: true,
        caption: true,
        status: true,
        deletedAt: true,
        deletedRefs: true,
        purgeError: true,
        purgeStartedAt: true,
      },
    }),
  ]);

  // 查询已经按同一规则过滤；这里再校验一次，防止以后有人改查询时
  // 悄悄把别人的草稿或私密记录带回页面。
  const visibleEntries = entries.filter((entry) => canViewTrashEntry(entry, viewer));
  const referenceCounts = await getMediaReferenceCounts(deletedMedia.map((media) => media.id));

  return (
    <div>
      <header className="mb-6">
        <Link href="/my" className="mb-3 inline-flex items-center gap-1 text-[11.5px] text-faint hover:text-ink">
          <ArrowLeft size={13} /> 我的
        </Link>
        <p className="eyebrow">Recently deleted</p>
        <h1 className="font-display mt-1.5 text-[34px] leading-none tracking-tight">回收站</h1>
        <p className="mt-2 max-w-[520px] text-[11.5px] leading-relaxed text-muted">
          删除的记录和照片会保留 {TRASH_RETENTION_DAYS} 天。期间可以恢复；超过保留期后由后台自动彻底删除，也可以提前手动清理。
        </p>
      </header>

      {errorMessage ? (
        <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-[12px] text-danger">
          {errorMessage}
        </p>
      ) : null}

      {visibleEntries.length === 0 && deletedMedia.length === 0 ? (
        <EmptyState
          icon={<Trash2 strokeWidth={1.7} />}
          title="回收站是空的"
          description="删除的记录和照片会先留在这里，可以恢复。"
          action={
            <Link href="/timeline" className="btn btn-outline btn-sm">
              回到时光
            </Link>
          }
        />
      ) : (
        <div className="space-y-7">
          {deletedMedia.length > 0 ? (
            <section>
              <h2 className="mb-2.5 flex items-baseline gap-2 text-[12px] font-semibold text-muted">
                照片与视频 <span className="font-normal text-faint">{deletedMedia.length}</span>
              </h2>
              <p className="mb-2.5 text-[10.5px] leading-relaxed text-faint">
                恢复会带回原图、缩略图、展示图，以及删除前的相册、记录附件、封面和头像关系；彻底删除才会清理文件。
              </p>
              <div className="card divide-y divide-line overflow-hidden">
                {deletedMedia.map((media) => {
                  const counts = referenceCounts.get(media.id);
                  const blocking = counts ? blockingReferenceCount(counts) : 0;
                  const labels = counts ? describeMediaReferences(counts) : [];
                  const cascades = counts ? describeMediaCascades(counts) : [];
                  const expired = isTrashExpired(media.deletedAt, now);
                  const purging = media.status === "PURGING";
                  return (
                    <div key={media.id} className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium">{mediaTitle(media)}</p>
                          <p className="mt-0.5 text-[10.5px] text-faint">
                            {media.mediaType === "VIDEO" ? "视频" : "照片"}
                            {media.deletedAt
                              ? ` · 删除于 ${formatDateTime(media.deletedAt, timezone)}`
                              : ""}
                            {purging
                              ? " · 正在彻底删除…"
                              : media.deletedAt
                                ? ` · ${formatTrashRemaining(media.deletedAt, now)}`
                                : ""}
                          </p>
                          {media.deletedAt && !purging ? (
                            <p className="mt-0.5 text-[10px] text-faint">
                              {expired
                                ? "已超过保留期，等待后台自动清理"
                                : `保留至 ${formatDateTime(trashExpiresAt(media.deletedAt), timezone)}`}
                            </p>
                          ) : null}
                          {hasLegacyDeletedRefs(media.deletedRefs) ? (
                            <p className="mt-1 text-[10.5px] text-muted">
                              这张照片是在旧版本中删除的，原相册和封面关系可能已无法自动恢复。
                            </p>
                          ) : null}
                          {blocking > 0 ? (
                            <p className="mt-1 text-[10.5px] text-muted">
                              仍被 {labels.join("、") || `${blocking} 处数据`} 引用，解除后才能彻底删除。
                            </p>
                          ) : null}
                          {cascades.length > 0 ? (
                            <p className="mt-1 text-[10.5px] text-faint">
                              彻底删除时会从 {cascades.join("、")} 中移除。
                            </p>
                          ) : null}
                          {media.purgeError && !purging ? (
                            <p className="mt-1 text-[10.5px] text-danger">
                              上次清理失败：{media.purgeError}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {!purging && !expired ? (
                            <form action={restoreMediaAction}>
                              <input type="hidden" name="id" value={media.id} />
                              <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">
                                <RotateCcw size={12} /> 恢复
                              </SubmitButton>
                            </form>
                          ) : null}
                          {!purging && blocking === 0 ? (
                            <form action={purgeMediaAction}>
                              <input type="hidden" name="id" value={media.id} />
                              <ConfirmButton
                                className="btn btn-ghost btn-sm text-danger"
                                message={`彻底删除后，原图、缩略图、展示图和播放版都会被清理，无法恢复。${cascades.length ? "这张照片也会从相关相册中移除。" : ""}`}
                                pendingText="…"
                              >
                                彻底删除
                              </ConfirmButton>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {deletedMedia.length >= 50 ? (
                <p className="mt-2 text-[10.5px] text-faint">只显示最近 50 项已删除媒体。</p>
              ) : null}
            </section>
          ) : null}

          {visibleEntries.length > 0 ? (
            <section>
              <h2 className="mb-2.5 flex items-baseline gap-2 text-[12px] font-semibold text-muted">
                记录 <span className="font-normal text-faint">{visibleEntries.length}</span>
              </h2>
              <div className="card divide-y divide-line overflow-hidden">
                {visibleEntries.map((entry) => {
                  const expired = isTrashExpired(entry.deletedAt, now);
                  return (
                    <div key={entry.id} className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium">
                            {entry.title || entry.body?.slice(0, 40) || "一条记录"}
                          </p>
                          <p className="mt-0.5 text-[10.5px] text-faint">
                            {formatDateFull(entry.occurredAt, timezone)}
                            {entry.deletedAt ? ` · 删除于 ${formatDateTime(entry.deletedAt, timezone)}` : ""}
                            {entry.deletedFromStatus && ENTRY_STATUS_LABEL[entry.deletedFromStatus]
                              ? ` · 原为${ENTRY_STATUS_LABEL[entry.deletedFromStatus]}`
                              : ""}
                          </p>
                          {entry.deletedAt ? (
                            <p className="mt-0.5 text-[10px] text-faint">
                              {expired
                                ? "已超过保留期，等待后台自动清理"
                                : `${formatTrashRemaining(entry.deletedAt, now)} · 保留至 ${formatDateTime(trashExpiresAt(entry.deletedAt), timezone)}`}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {!expired ? (
                            <form action={restoreEntryAction}>
                              <input type="hidden" name="id" value={entry.id} />
                              <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">
                                <RotateCcw size={12} /> 恢复
                              </SubmitButton>
                            </form>
                          ) : null}
                          {entry.createdBy === context.user.id ? (
                            <form action={purgeEntryAction}>
                              <input type="hidden" name="id" value={entry.id} />
                              <ConfirmButton
                                className="btn btn-ghost btn-sm text-danger"
                                message="彻底删除这条记录？照片文件不会被删除，但这条记录无法恢复。"
                                pendingText="…"
                              >
                                彻底删除
                              </ConfirmButton>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {visibleEntries.length >= 100 ? (
                <p className="mt-2 text-[10.5px] text-faint">只显示最近 100 条已删除记录。</p>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
