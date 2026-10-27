import Link from "next/link";
import { DateTime } from "luxon";
import { Camera, Film, FolderPlus, Heart, Images, Play } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mediaWhere } from "@/lib/access";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;
  const { view } = await searchParams;
  const onlyFavorites = view === "favorites";
  const onlyVideos = view === "videos";

  const [media, albums] = await Promise.all([
    prisma.media.findMany({
      where: {
        ...mediaWhere(viewer),
        mediaType: onlyVideos ? "VIDEO" : undefined,
        favorite: onlyFavorites ? true : undefined,
      },
      orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
      take: 300,
      include: { _count: { select: { albumLinks: true } } },
    }),
    prisma.album.findMany({
      where: { householdId: context.household.id },
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: {
        _count: { select: { media: true } },
        media: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          include: { media: true },
        },
      },
    }),
  ]);

  const groups = new Map<string, typeof media>();
  for (const item of media) {
    const date = DateTime.fromJSDate(item.takenAt ?? item.createdAt, { zone: timezone }).setLocale("zh-CN");
    const key = date.toFormat("yyyy年M月");
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }

  const filtered = onlyFavorites || onlyVideos;

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
                    {cover?.thumbnailKey ? (
                      <img
                        src={`/api/media/${cover.id}/thumb`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-faint">
                        <Images size={20} />
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-[12.5px] font-medium">{album.name}</p>
                  <p className="text-[10.5px] text-faint">{album._count.media} 张</p>
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
        <Link href="/photos?view=favorites" className={`chip ${onlyFavorites ? "chip-active" : ""}`}>
          <Heart size={12} /> 收藏
        </Link>
        <Link href="/photos?view=videos" className={`chip ${onlyVideos ? "chip-active" : ""}`}>
          <Film size={12} /> 视频
        </Link>
        <span className="ml-auto text-[11px] text-faint">{media.length} 项</span>
      </div>

      {media.length === 0 ? (
        <EmptyState
          icon={<Camera strokeWidth={1.7} />}
          title={filtered ? (onlyVideos ? "还没有视频" : "还没有照片") : "照片墙还空着"}
          description={filtered ? "换个筛选看看。" : "从手机相册选几张，或者现在拍一张。"}
          action={
            <Link href="/compose/moment" className="btn btn-primary btn-sm">
              <Camera size={14} /> 添加照片
            </Link>
          }
        />
      ) : (
        <div className="space-y-7">
          {Array.from(groups.entries()).map(([month, items]) => (
            <section key={month}>
              <h2 className="mb-2.5 flex items-baseline gap-2 text-[12px] font-semibold text-muted">
                {month}
                <span className="font-normal text-faint">{items.length}</span>
              </h2>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-1.5">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/photos/${item.id}`}
                    className="group relative aspect-square overflow-hidden rounded-xl bg-raised"
                  >
                    {item.thumbnailKey ? (
                      <img
                        src={`/api/media/${item.id}/thumb`}
                        alt={item.caption || ""}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-faint">
                        <Film size={18} />
                      </div>
                    )}
                    {item.mediaType === "VIDEO" ? (
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
                        <Play size={9} fill="currentColor" />
                      </span>
                    ) : null}
                    {item.favorite ? (
                      <span className="absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur">
                        <Heart size={9} fill="currentColor" />
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
