import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Compass,
  Images,
  Link2,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mediaWhere, tripWhere } from "@/lib/access";
import { formatDateFull, formatDayRange } from "@/lib/dates";
import {
  linkHost,
  tripKindLabel,
  tripProgress,
  tripRegions,
  tripStatusLabel,
} from "@/lib/travel";
import { deleteTripAction, deleteTripLinkAction } from "@/app/actions/travel";
import { ConfirmButton } from "@/components/ConfirmButton";
import { TripLinkForm } from "@/components/travel/TripLinkForm";

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;

  const trip = await prisma.trip.findFirst({
    where: { id, ...tripWhere(viewer) },
    include: {
      places: {
        orderBy: { sortOrder: "asc" },
        include: {
          visits: {
            orderBy: { visitedAt: "desc" },
            include: {
              photos: {
                orderBy: { sortOrder: "asc" },
                include: {
                  media: {
                    select: {
                      id: true,
                      status: true,
                      visibility: true,
                      uploadedBy: true,
                      mediaType: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      links: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!trip) notFound();

  const cover = trip.coverMediaId
    ? await prisma.media.findFirst({
        where: { id: trip.coverMediaId, ...mediaWhere(viewer) },
        select: { id: true },
      })
    : null;

  const canSeeMedia = (media: {
    status: string;
    visibility: string;
    uploadedBy: string;
  }) =>
    media.status === "ACTIVE" &&
    (media.visibility === "HOUSEHOLD" || media.uploadedBy === context.user.id);

  const progress = tripProgress(trip.places);
  const regions = tripRegions(trip.places);
  const visits = trip.places
    .flatMap((place) => place.visits.map((visit) => ({ ...visit, place })))
    .sort((a, b) => b.visitedAt.getTime() - a.visitedAt.getTime());
  const photoCount = visits.reduce(
    (sum, visit) => sum + visit.photos.filter((photo) => canSeeMedia(photo.media)).length,
    0,
  );
  const isTheme = trip.kind === "THEME";

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <Link href="/travel" className="icon-btn icon-btn-plain -ml-2" aria-label="返回旅行列表">
          <ArrowLeft size={19} strokeWidth={1.8} />
        </Link>
        <div className="flex items-center gap-0.5">
          <Link href={`/travel/${trip.id}/edit`} className="icon-btn icon-btn-plain" aria-label="编辑旅行">
            <Pencil size={15} />
          </Link>
          <form action={deleteTripAction}>
            <input type="hidden" name="id" value={trip.id} />
            <ConfirmButton
              className="icon-btn icon-btn-plain text-faint hover:text-danger"
              message="删除这段旅行？地点、到访记录和链接都会一起删除，照片会留在照片库里。"
              pendingText=""
            >
              <Trash2 size={15} />
            </ConfirmButton>
          </form>
        </div>
      </div>

      <div className="card overflow-hidden">
        {cover ? (
          <img
            src={`/api/media/${cover.id}/display`}
            alt=""
            className="aspect-[16/7] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[16/5] items-center justify-center bg-raised text-faint">
            {isTheme ? <Repeat size={30} strokeWidth={1.4} /> : <Compass size={30} strokeWidth={1.4} />}
          </div>
        )}
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip">{tripKindLabel(trip.kind)}</span>
            <span className="chip">{tripStatusLabel(trip.status)}</span>
            {trip.visibility === "PRIVATE" ? <span className="chip">仅自己可见</span> : null}
          </div>
          <h1 className="font-display mt-2.5 text-[30px] leading-tight">{trip.title}</h1>
          {trip.subtitle ? <p className="mt-1 text-[12.5px] text-muted">{trip.subtitle}</p> : null}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-faint">
            {!isTheme ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={11} />
                {trip.startDate
                  ? formatDayRange(trip.startDate, trip.endDate, timezone)
                  : "日期待定"}
              </span>
            ) : null}
            {regions.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} />
                {regions.slice(0, 3).join("、")}
                {regions.length > 3 ? ` 等 ${regions.length} 个地区` : ""}
              </span>
            ) : null}
          </div>

          {trip.description ? (
            <p className="mt-4 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
              {trip.description}
            </p>
          ) : null}

          {progress.total > 0 ? (
            <div className="mt-5 rounded-2xl bg-raised/60 px-4 py-3.5">
              <div className="flex items-baseline justify-between">
                <p className="text-[12px] font-medium">
                  已打卡 {progress.visited}/{progress.total} 个地点
                </p>
                <p className="text-[11px] font-semibold text-accent">{progress.percent}%</p>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {[
          { label: "地点", value: progress.total, icon: MapPin },
          { label: "已打卡", value: progress.visited, icon: CheckCircle2 },
          { label: "到访", value: visits.length, icon: Compass },
          { label: "照片", value: photoCount, icon: Images },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card px-3 py-3 text-center">
              <Icon size={13} className="mx-auto text-faint" />
              <p className="display-number mt-1.5 text-[24px]">{stat.value}</p>
              <p className="mt-0.5 text-[10px] text-faint">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <section className="mt-7">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">
            地点 <span className="font-normal text-faint">{progress.total}</span>
          </h2>
          <Link href={`/travel/${trip.id}/places/new`} className="btn btn-ghost btn-sm">
            <Plus size={13} /> 添加地点
          </Link>
        </div>

        {trip.places.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-line-strong px-4 py-5 text-[12px] text-faint">
            {isTheme
              ? "先把你想要走完的地方列出来，去到之后打个卡，进度会自动累计。"
              : "把这次要去、去过的地方加进来，每个地点都可以打卡和留照片。"}
          </div>
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {trip.places.map((place) => {
              const latest = place.visits[0];
              return (
                <Link
                  key={place.id}
                  href={`/travel/${trip.id}/places/${place.id}`}
                  prefetch
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-raised/60"
                >
                  <span className={latest ? "shrink-0 text-sage" : "shrink-0 text-faint"}>
                    {latest ? <CheckCircle2 size={16} /> : <Circle size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{place.name}</span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-faint">
                      {place.region ? `${place.region} · ` : ""}
                      {latest
                        ? `${place.visits.length} 次到访 · 最近 ${formatDateFull(latest.visitedAt, timezone)}`
                        : "还没打卡"}
                    </span>
                  </span>
                  <ArrowRight size={13} className="shrink-0 text-faint" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {visits.length > 0 ? (
        <section className="mt-7">
          <h2 className="mb-2.5 text-[13px] font-semibold">最近到访</h2>
          <div className="space-y-2.5">
            {visits.slice(0, 6).map((visit) => {
              const photos = visit.photos.filter((photo) => canSeeMedia(photo.media));
              return (
                <div key={visit.id} className="card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/travel/${trip.id}/places/${visit.place.id}`}
                      className="min-w-0 truncate text-[13px] font-medium hover:text-accent"
                    >
                      {visit.place.name}
                    </Link>
                    <span className="shrink-0 text-[10.5px] text-faint">
                      {formatDateFull(visit.visitedAt, timezone)}
                    </span>
                  </div>
                  {visit.note ? (
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted">
                      {visit.note}
                    </p>
                  ) : null}
                  {photos.length > 0 ? (
                    <div className="mt-2.5 grid grid-cols-4 gap-1 sm:grid-cols-6">
                      {photos.slice(0, 6).map((photo) => (
                        <Link
                          key={photo.mediaId}
                          href={`/photos/${photo.mediaId}`}
                          className="aspect-square overflow-hidden rounded-lg bg-raised"
                        >
                          <img
                            src={`/api/media/${photo.mediaId}/thumb`}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-7">
        <h2 className="mb-2.5 text-[13px] font-semibold">
          链接与资料 <span className="font-normal text-faint">{trip.links.length}</span>
        </h2>

        {trip.links.length > 0 ? (
          <div className="card mb-2.5 divide-y divide-line overflow-hidden">
            {trip.links.map((link) => (
              <div key={link.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-muted">
                  <Link2 size={14} />
                </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1"
                >
                  <span className="flex items-center gap-1">
                    <span className="truncate text-[12.5px] font-medium">{link.title}</span>
                    <ArrowUpRight size={11} className="shrink-0 text-faint" />
                  </span>
                  <span className="mt-0.5 block truncate text-[10.5px] text-faint">
                    {linkHost(link.url)}
                  </span>
                </a>
                <form action={deleteTripLinkAction}>
                  <input type="hidden" name="tripId" value={trip.id} />
                  <input type="hidden" name="id" value={link.id} />
                  <ConfirmButton
                    className="icon-btn icon-btn-plain text-faint hover:text-danger"
                    message="删除这个链接？"
                    pendingText=""
                  >
                    <Trash2 size={13} />
                  </ConfirmButton>
                </form>
              </div>
            ))}
          </div>
        ) : null}

        <TripLinkForm tripId={trip.id} />
      </section>
    </div>
  );
}
