import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Trash2,
} from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewMedia, mediaWhere } from "@/lib/access";
import { formatDateFull, formatTime } from "@/lib/dates";
import { formatBytes } from "@/lib/format";
import { deleteMediaAction } from "@/app/actions/media";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MediaEditor } from "@/components/photos/MediaEditor";

export default async function PhotoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;

  const media = await prisma.media.findUnique({
    where: { id },
    include: {
      uploader: { select: { displayName: true } },
      entryLinks: {
        include: {
          entry: { select: { id: true, title: true, occurredAt: true, status: true, visibility: true, createdBy: true } },
        },
      },
    },
  });
  if (!media || !canViewMedia(media, viewer)) notFound();

  const [neighbors] = await Promise.all([
    prisma.media.findMany({
      where: mediaWhere(viewer),
      orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
      take: 500,
      select: { id: true },
    }),
  ]);
  const index = neighbors.findIndex((item) => item.id === media.id);
  const prev = index > 0 ? neighbors[index - 1] : null;
  const next = index >= 0 && index < neighbors.length - 1 ? neighbors[index + 1] : null;

  const relatedEntries = media.entryLinks
    .map((link) => link.entry)
    .filter(
      (entry) =>
        entry.status === "PUBLISHED" &&
        (entry.visibility === "HOUSEHOLD" || entry.createdBy === context.user.id),
    );

  const canEdit = media.uploadedBy === context.user.id || context.role === "OWNER";
  const takenAt = media.takenAt ?? media.createdAt;
  const playbackReady = Boolean(media.playbackKey) && media.playbackStatus === "READY";
  const videoSrc = playbackReady
    ? `/api/media/${media.id}/playback`
    : `/api/media/${media.id}/file`;
  const optimizingVideo =
    media.mediaType === "VIDEO" && media.playbackStatus === "PENDING";

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <Link href="/photos" className="icon-btn icon-btn-plain -ml-2" aria-label="返回照片">
          <ArrowLeft size={19} strokeWidth={1.8} />
        </Link>
        <div className="flex items-center gap-1">
          <a
            href={`/api/media/${media.id}/file?download=1`}
            className="icon-btn icon-btn-plain"
            aria-label="下载原图"
            download
          >
            <Download size={16} />
          </a>
          {canEdit ? (
            <form action={deleteMediaAction}>
              <input type="hidden" name="id" value={media.id} />
              <ConfirmButton
                className="icon-btn icon-btn-plain text-faint hover:text-danger"
                message="删除这张照片？它会从记录和相册中移除。"
                pendingText=""
              >
                <Trash2 size={16} />
              </ConfirmButton>
            </form>
          ) : null}
        </div>
      </header>

      <div className="relative overflow-hidden rounded-[24px] bg-black">
        {media.mediaType === "VIDEO" ? (
          <video
            controls
            autoPlay
            playsInline
            poster={media.thumbnailKey ? `/api/media/${media.id}/thumb` : undefined}
            className="max-h-[76vh] w-full"
            src={videoSrc}
          />
        ) : (
          <>
            <img
              src={`/api/media/${media.id}/display`}
              alt={media.caption || "照片"}
              className="max-h-[76vh] w-full object-contain"
            />
            <a
              href={`/api/media/${media.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-2.5 right-2.5 rounded-full bg-black/45 px-3 py-1.5 text-[10.5px] text-white backdrop-blur transition hover:bg-black/65"
            >
              查看原图
            </a>
          </>
        )}

        {prev ? (
          <Link
            href={`/photos/${prev.id}`}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
            aria-label="上一张"
          >
            <ChevronLeft size={18} />
          </Link>
        ) : null}
        {next ? (
          <Link
            href={`/photos/${next.id}`}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
            aria-label="下一张"
          >
            <ChevronRight size={18} />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
        <span>{formatDateFull(takenAt, timezone)}</span>
        <span className="h-1 w-1 rounded-full bg-line-strong" />
        <span>{formatTime(takenAt, timezone)}</span>
        {media.width && media.height ? (
          <>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <span>
              {media.width} × {media.height}
            </span>
          </>
        ) : null}
        <span className="h-1 w-1 rounded-full bg-line-strong" />
        {media.mediaType === "VIDEO" ? (
          <>
            <span>原视频 {formatBytes(media.fileSize)}</span>
            {playbackReady && media.playbackSize ? (
              <span>压缩版 {formatBytes(media.playbackSize)}</span>
            ) : optimizingVideo ? (
              <span>压缩版生成中</span>
            ) : null}
            <a
              href={`/api/media/${media.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
              title={media.playbackError || undefined}
            >
              {playbackReady ? "对比原视频" : "播放原视频"}
            </a>
          </>
        ) : (
          <>
            <span>原图 {formatBytes(media.fileSize)}</span>
            {media.displaySize ? <span>详情版 {formatBytes(media.displaySize)}</span> : null}
          </>
        )}
        {media.visibility === "PRIVATE" ? (
          <span className="inline-flex items-center gap-1">
            <Lock size={10} /> 仅自己
          </span>
        ) : null}
        <span className="ml-auto">{media.uploader.displayName} 上传</span>
      </div>

      <MediaEditor
        id={media.id}
        caption={media.caption || ""}
        visibility={media.visibility}
        favorite={media.favorite}
        canEdit={canEdit}
      />

      {relatedEntries.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2.5 text-[13px] font-semibold">出现在这些记录里</h2>
          <div className="card divide-y divide-line overflow-hidden">
            {relatedEntries.map((entry) => (
              <Link
                key={entry.id}
                href={`/entries/${entry.id}`}
                className="block px-4 py-3 transition hover:bg-raised/60"
              >
                <p className="truncate text-[13px] font-medium">{entry.title || "一段记录"}</p>
                <p className="text-[10.5px] text-faint">
                  {formatDateFull(entry.occurredAt, timezone)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
