import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mediaWhere } from "@/lib/access";
import { deleteAlbumAction } from "@/app/actions/media";
import { countAlbumMedia, getAlbumMediaPage } from "@/lib/media-query";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EmptyState } from "@/components/EmptyState";
import { AlbumMediaGrid } from "@/components/photos/AlbumMediaGrid";

export default async function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;

  const album = await prisma.album.findFirst({
    where: { id, householdId: context.household.id },
    select: { id: true, name: true, description: true, coverMediaId: true },
  });
  if (!album) notFound();

  const [albumCount, initialPage, cover] = await Promise.all([
    countAlbumMedia(viewer, album.id),
    getAlbumMediaPage(viewer, album.id, timezone),
    album.coverMediaId
      ? prisma.media.findFirst({
          where: { id: album.coverMediaId, ...mediaWhere(viewer) },
          select: { id: true, mediaType: true, thumbnailKey: true },
        })
      : Promise.resolve(null),
  ]);
  const countLabel = `${albumCount.count}${albumCount.capped ? "+" : ""}`;
  // 封面不在第一页或不满足可见性时，退回到第一张可见图片。
  const hero =
    cover ??
    (initialPage.items[0]
      ? {
          id: initialPage.items[0].id,
          mediaType: initialPage.items[0].mediaType,
          thumbnailKey: initialPage.items[0].thumbUrl ? "1" : null,
        }
      : null);

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

      {hero && (hero.thumbnailKey || hero.mediaType === "IMAGE") ? (
        <div className="relative mb-6 overflow-hidden rounded-[26px] bg-raised">
          <img
            src={`/api/media/${hero.id}/thumb?v=${encodeURIComponent(hero.thumbnailKey || "0")}`}
            alt=""
            className="aspect-[16/9] w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-5 pb-5 pt-16">
            <p className="eyebrow text-white/60">Album · {countLabel} 张</p>
            <h1 className="font-display mt-1 text-[32px] leading-none text-white">{album.name}</h1>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <p className="eyebrow">Album · {countLabel} 张</p>
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

      {albumCount.count === 0 ? (
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
        <AlbumMediaGrid
          albumId={album.id}
          initialItems={initialPage.items}
          initialCursor={initialPage.nextCursor}
          coverMediaId={album.coverMediaId}
        />
      )}
    </div>
  );
}
