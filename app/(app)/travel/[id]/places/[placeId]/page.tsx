import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tripWhere } from "@/lib/access";
import { formatDateFull } from "@/lib/dates";
import { deleteTripPlaceAction, deleteTripVisitAction } from "@/app/actions/travel";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EmptyState } from "@/components/EmptyState";

export default async function TripPlacePage({
  params,
}: {
  params: Promise<{ id: string; placeId: string }>;
}) {
  const { id, placeId } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;

  const place = await prisma.tripPlace.findFirst({
    where: { id: placeId, tripId: id, trip: tripWhere(viewer) },
    include: {
      trip: { select: { id: true, title: true } },
      visits: {
        orderBy: { visitedAt: "desc" },
        include: {
          creator: { select: { displayName: true } },
          photos: {
            orderBy: { sortOrder: "asc" },
            include: {
              media: {
                select: {
                  id: true,
                  status: true,
                  visibility: true,
                  uploadedBy: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!place) notFound();

  const visits = place.visits.map((visit) => ({
    ...visit,
    photos: visit.photos.filter(
      (photo) =>
        photo.media.status === "ACTIVE" &&
        (photo.media.visibility === "HOUSEHOLD" || photo.media.uploadedBy === context.user.id),
    ),
  }));
  const latest = visits[0];
  const first = visits[visits.length - 1];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <Link
          href={`/travel/${id}`}
          className="icon-btn icon-btn-plain -ml-2"
          aria-label="返回旅行"
        >
          <ArrowLeft size={19} strokeWidth={1.8} />
        </Link>
        <div className="flex items-center gap-0.5">
          <Link
            href={`/travel/${id}/places/${place.id}/edit`}
            className="icon-btn icon-btn-plain"
            aria-label="编辑地点"
          >
            <Pencil size={15} />
          </Link>
          <form action={deleteTripPlaceAction}>
            <input type="hidden" name="tripId" value={id} />
            <input type="hidden" name="id" value={place.id} />
            <ConfirmButton
              className="icon-btn icon-btn-plain text-faint hover:text-danger"
              message="删除这个地点？它的到访记录和照片关联也会一起删除，照片仍留在照片库。"
              pendingText=""
            >
              <Trash2 size={15} />
            </ConfirmButton>
          </form>
        </div>
      </div>

      <p className="eyebrow">{place.trip.title}</p>
      <h1 className="font-display mt-1.5 text-[32px] leading-tight">{place.name}</h1>

      <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11.5px] text-muted">
        {place.region ? (
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} /> {place.region}
          </span>
        ) : null}
        {place.address ? <span className="text-faint">{place.address}</span> : null}
        {visits.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-sage">
            <CalendarDays size={11} /> {visits.length} 次到访
          </span>
        ) : (
          <span className="text-faint">还没打卡</span>
        )}
      </div>

      {place.note ? (
        <p className="mt-4 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
          {place.note}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={`/travel/${id}/places/${place.id}/checkin`} className="btn btn-primary btn-sm">
          <Plus size={13} /> 打卡
        </Link>
        {first ? (
          <span className="text-[10.5px] text-faint">
            第一次 {formatDateFull(first.visitedAt, timezone)}
            {latest && latest.id !== first.id
              ? ` · 最近 ${formatDateFull(latest.visitedAt, timezone)}`
              : ""}
          </span>
        ) : null}
      </div>

      <section className="mt-7">
        <h2 className="mb-2.5 text-[13px] font-semibold">
          到访记录 <span className="font-normal text-faint">{visits.length}</span>
        </h2>

        {visits.length === 0 ? (
          <EmptyState
            compact
            icon={<MapPin strokeWidth={1.7} />}
            title="还没有到访记录"
            description="去过之后在这里打个卡，可以记下日期、当天的事和照片。"
            action={
              <Link
                href={`/travel/${id}/places/${place.id}/checkin`}
                className="btn btn-primary btn-sm"
              >
                打第一个卡
              </Link>
            }
          />
        ) : (
          <div className="space-y-2.5">
            {visits.map((visit) => (
              <div key={visit.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">
                      {formatDateFull(visit.visitedAt, timezone)}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-faint">
                      {visit.creator.displayName}
                    </p>
                  </div>
                  <form action={deleteTripVisitAction}>
                    <input type="hidden" name="tripId" value={id} />
                    <input type="hidden" name="placeId" value={place.id} />
                    <input type="hidden" name="id" value={visit.id} />
                    <ConfirmButton
                      className="icon-btn icon-btn-plain text-faint hover:text-danger"
                      message="删除这次到访记录？照片仍会留在照片库。"
                      pendingText=""
                    >
                      <Trash2 size={13} />
                    </ConfirmButton>
                  </form>
                </div>

                {visit.note ? (
                  <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
                    {visit.note}
                  </p>
                ) : null}

                {visit.photos.length > 0 ? (
                  <div className="mt-3 grid grid-cols-3 gap-1 sm:grid-cols-4">
                    {visit.photos.map((photo) => (
                      <Link
                        key={photo.mediaId}
                        href={`/photos/${photo.mediaId}`}
                        className="aspect-square overflow-hidden rounded-xl bg-raised"
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
