import Link from "next/link";
import { Camera, Film, FolderPlus, Heart, Images } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mediaWhere } from "@/lib/access";
import { normalizeMediaListView } from "@/lib/media-list";
import { getPhotoMediaPage } from "@/lib/media-query";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { MediaGrid } from "@/components/photos/MediaGrid";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;
  const { view: viewParam } = await searchParams;
  const view = normalizeMediaListView(viewParam);

  const visibleMedia = mediaWhere(viewer);
  const [initialPage, total, albums] = await Promise.all([
    getPhotoMediaPage(viewer, timezone, { view }),
    prisma.media.count({
      where: {
        ...visibleMedia,
        ...(view === "videos" ? { mediaType: "VIDEO" } : {}),
        ...(view === "favorites" ? { favorite: true } : {}),
      },
    }),
    prisma.album.findMany({
      where: { householdId: context.household.id },
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: {
        media: {
          where: { media: visibleMedia },
          orderBy: { sortOrder: "asc" },
          take: 1,
          include: { media: true },
        },
      },
    }),
  ]);

  const albumIds = albums.map((album) => album.id);
  const albumCounts = albumIds.length
    ? await prisma.albumMedia.groupBy({
        by: ["albumId"],
        where: { albumId: { in: albumIds }, media: visibleMedia },
        _count: { _all: true },
      })
    : [];
  const countByAlbum = new Map(albumCounts.map((row) => [row.albumId, row._count._all]));

  const filtered = view !== "all";

  return (
    <div>
      <PageHeader
        title="照片"
        eyebrow="The family album"
        action={
          <div className="flex items-center gap-1.5">
            <Link href="/photos/upload" className="btn btn-primary btn-sm">
              <Camera size={15} /> 上传
            </Link>
            <Link href="/photos/albums/new" className="btn btn-outline btn-sm">
              <FolderPlus size={15} /> 相册
            </Link>
          </div>
        }
      />

      {albums.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2.5 text-[13px] font-semibold">相册</h2>
          <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {albums.map((album) => {
              const cover = album.media[0]?.media;
              return (
                <Link
                  key={album.id}
                  href={`/photos/albums/${album.id}`}
                  className="group w-[132px] shrink-0"
                >
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-raised">
                    {cover && (cover.thumbnailKey || cover.mediaType === "IMAGE") ? (
                      <img
                        src={`/api/media/${cover.id}/thumb?v=${encodeURIComponent(cover.thumbnailKey || "0")}`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={132}
                        height={165}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-faint">
                        <Images size={20} />
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-[12.5px] font-medium">{album.name}</p>
                  <p className="text-[10.5px] text-faint">{countByAlbum.get(album.id) ?? 0} 张</p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <Link href="/photos" className={`chip ${!filtered ? "chip-active" : ""}`}>
          <Images size={12} /> 全部
        </Link>
        <Link href="/photos?view=favorites" className={`chip ${view === "favorites" ? "chip-active" : ""}`}>
          <Heart size={12} /> 收藏
        </Link>
        <Link href="/photos?view=videos" className={`chip ${view === "videos" ? "chip-active" : ""}`}>
          <Film size={12} /> 视频
        </Link>
        <span className="ml-auto text-[11px] text-faint">{total} 项</span>
      </div>

      {initialPage.items.length === 0 ? (
        <EmptyState
          icon={<Camera strokeWidth={1.7} />}
          title={filtered ? (view === "videos" ? "还没有视频" : "还没有照片") : "照片墙还空着"}
          description={filtered ? "换个筛选看看。" : "从手机相册选几张，或者现在拍一张。"}
          action={
            <Link href="/compose/moment" className="btn btn-primary btn-sm">
              <Camera size={14} /> 添加照片
            </Link>
          }
        />
      ) : (
        <MediaGrid
          key={view}
          initialItems={initialPage.items}
          initialCursor={initialPage.nextCursor}
          view={view}
          emptyTitle={filtered ? "还没有内容" : "照片墙还空着"}
          emptyDescription={filtered ? "换个筛选看看。" : "从手机相册选几张，或者现在拍一张。"}
        />
      )}
    </div>
  );
}
