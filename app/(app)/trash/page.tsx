import Link from "next/link";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateFull, formatDateTime } from "@/lib/dates";
import { restoreEntryAction, purgeEntryAction } from "@/app/actions/entries";
import {
  purgeMediaAction,
  restoreMediaAction,
} from "@/app/actions/media";
import {
  blockingReferenceCount,
  describeMediaReferences,
  getMediaReferenceCounts,
} from "@/lib/media-lifecycle";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";

function mediaTitle(media: { caption: string | null; originalFilename: string }) {
  return media.caption?.trim() || media.originalFilename || "照片";
}

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const context = await requireContext();
  const timezone = context.household.timezone;
  const { error: errorParam } = await searchParams;
  const errorMessage =
    typeof errorParam === "string" && errorParam ? errorParam.slice(0, 200) : null;

  const [entries, deletedMedia] = await Promise.all([
    prisma.entry.findMany({
      where: {
        householdId: context.household.id,
        status: "DELETED",
        OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
      },
      orderBy: { deletedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        body: true,
        occurredAt: true,
        deletedAt: true,
        createdBy: true,
      },
    }),
    prisma.media.findMany({
      where: {
        householdId: context.household.id,
        status: "DELETED",
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
        deletedAt: true,
        purgeError: true,
        purgeAttemptedAt: true,
      },
    }),
  ]);

  const referenceCounts = await getMediaReferenceCounts(deletedMedia.map((media) => media.id));

  return (
    <div>
      <header className="mb-6">
        <Link href="/my" className="mb-3 inline-flex items-center gap-1 text-[11.5px] text-faint hover:text-ink">
          <ArrowLeft size={13} /> 我的
        </Link>
        <p className="eyebrow">Recently deleted</p>
        <h1 className="font-display mt-1.5 text-[34px] leading-none tracking-tight">回收站</h1>
      </header>

      {errorMessage ? (
        <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-[12px] text-danger">
          {errorMessage}
        </p>
      ) : null}

      {entries.length === 0 && deletedMedia.length === 0 ? (
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
                照片 <span className="font-normal text-faint">{deletedMedia.length}</span>
              </h2>
              <p className="mb-2.5 text-[10.5px] text-faint">
                彻底删除前，原图、缩略图和展示图都会保留。仍在记录或旅行中的照片需要先解除引用。
              </p>
              <div className="card divide-y divide-line overflow-hidden">
                {deletedMedia.map((media) => {
                  const counts = referenceCounts.get(media.id);
                  const blocking = counts ? blockingReferenceCount(counts) : 0;
                  const labels = counts ? describeMediaReferences(counts) : [];
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
                          </p>
                          {blocking > 0 ? (
                            <p className="mt-1 text-[10.5px] text-muted">
                              仍被 {labels.join("、") || `${blocking} 处数据`} 引用，解除后才能彻底删除。
                            </p>
                          ) : null}
                          {media.purgeError ? (
                            <p className="mt-1 text-[10.5px] text-danger">
                              上次清理失败：{media.purgeError}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <form action={restoreMediaAction}>
                            <input type="hidden" name="id" value={media.id} />
                            <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">
                              <RotateCcw size={12} /> 恢复
                            </SubmitButton>
                          </form>
                          {blocking === 0 ? (
                            <form action={purgeMediaAction}>
                              <input type="hidden" name="id" value={media.id} />
                              <ConfirmButton
                                className="btn btn-ghost btn-sm text-danger"
                                message="彻底删除后，原图、缩略图、展示图和播放版都会被清理，无法恢复。"
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
                <p className="mt-2 text-[10.5px] text-faint">只显示最近 50 张已删除照片。</p>
              ) : null}
            </section>
          ) : null}

          {entries.length > 0 ? (
            <section>
              <h2 className="mb-2.5 flex items-baseline gap-2 text-[12px] font-semibold text-muted">
                记录 <span className="font-normal text-faint">{entries.length}</span>
              </h2>
              <div className="card divide-y divide-line overflow-hidden">
                {entries.map((entry) => (
                  <div key={entry.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium">
                          {entry.title || entry.body?.slice(0, 40) || "一条记录"}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-faint">
                          {formatDateFull(entry.occurredAt, timezone)}
                          {entry.deletedAt ? ` · 删除于 ${formatDateTime(entry.deletedAt, timezone)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <form action={restoreEntryAction}>
                          <input type="hidden" name="id" value={entry.id} />
                          <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">
                            <RotateCcw size={12} /> 恢复
                          </SubmitButton>
                        </form>
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
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
