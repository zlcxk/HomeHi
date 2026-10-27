import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImagePlus, Pencil, Play, Star, Trash2, X } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  deleteAlbumAction,
  removeMediaFromAlbumAction,
  setAlbumCoverAction,
} from "@/app/actions/media";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { EmptyState } from "@/components/EmptyState";

export default async function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();

  const album = await prisma.album.findFirst({
    where: { id, householdId: context.household.id },
    include: {
      media: { orderBy: { sortOrder: "asc" }, include: { media: true } },
    },
  });
  if (!album) notFound();

  const items = album.media
    .map((link) => link.media)
    .filter((media) => media.status === "ACTIVE")
    .filter((media) => media.visibility === "HOUSEHOLD" || media.uploadedBy === context.user.id);
  const cover = items.find((item) => item.id === album.coverMediaId) || items[0] || null;

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <Link href="/photos" className="icon-btn icon-btn-plain -ml-2" aria-label="返回照片">
          <ArrowLeft size={19} strokeWidth={1.8} />
        </Link>
        <div className="flex items-center gap-1">
          <Link href={`/photos/albums/${album.id}/edit`} className="icon-btn icon-btn-plain" aria-label="编辑相册">
            <Pencil size={16} />
          </Link>
          <form action={deleteAlbumAction}>
            <input type="hidden" name="id" value={album.id} />
            <ConfirmButton
              className="icon-btn icon-btn-plain text-faint hover:text-danger"
              message="删除这个相册？照片本身不会被删除。"
              pendingText=""
            >
              <Trash2 size={16} />
            </ConfirmButton>
          </form>
        </div>
      </header>

      {cover?.thumbnailKey ? (
        <div className="relative mb-6 overflow-hidden rounded-[26px] bg-raised">
          <img
            src={`/api/media/${cover.id}/thumb`}
            alt=""
            className="aspect-[16/9] w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-5 pb-5 pt-16">
            <p className="eyebrow text-white/60">Album · {items.length} 张</p>
            <h1 className="font-display mt-1 text-[32px] leading-none text-white">{album.name}</h1>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <p className="eyebrow">Album · {items.length} 张</p>
          <h1 className="font-display mt-1 text-[34px] leading-tight">{album.name}</h1>
        </div>
      )}

      {album.description ? (
        <p className="mb-5 text-[13.5px] leading-relaxed text-muted">{album.description}</p>
      ) : null}

      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-faint">相册里的照片仍然遵守各自的隐私设置。</p>
        <Link href={`/photos/albums/${album.id}/add`} className="btn btn-outline btn-sm shrink-0">
          <ImagePlus size={14} /> 添加照片
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ImagePlus strokeWidth={1.7} />}
          title="这个相册还空着"
          description="从照片墙里挑几张放进来。"
          action={
            <Link href={`/photos/albums/${album.id}/add`} className="btn btn-primary btn-sm">
              挑选照片
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-1.5">
          {items.map((item) => (
            <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-raised">
              <Link href={`/photos/${item.id}`} className="block h-full w-full">
                {item.thumbnailKey ? (
                  <img
                    src={`/api/media/${item.id}/thumb`}
                    alt={item.caption || ""}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-faint">
                    <Play size={18} />
                  </span>
                )}
              </Link>

              {album.coverMediaId === item.id ? (
                <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-ink">
                  <Star size={10} fill="currentColor" />
                </span>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/55 to-transparent p-1.5 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                {album.coverMediaId !== item.id ? (
                  <form action={setAlbumCoverAction}>
                    <input type="hidden" name="albumId" value={album.id} />
                    <input type="hidden" name="mediaId" value={item.id} />
                    <SubmitButton
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
                      pendingText=""
                    >
                      <Star size={11} />
                    </SubmitButton>
                  </form>
                ) : null}
                <form action={removeMediaFromAlbumAction}>
                  <input type="hidden" name="albumId" value={album.id} />
                  <input type="hidden" name="mediaId" value={item.id} />
                  <SubmitButton
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
                    pendingText=""
                  >
                    <X size={11} />
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
