import Link from "next/link";
import { ArrowRight, Compass, MapPin, Plus, Repeat } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tripWhere } from "@/lib/access";
import { formatDayRange } from "@/lib/dates";
import { tripProgress, tripRegions, tripStatusLabel } from "@/lib/travel";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default async function TravelPage() {
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;

  const trips = await prisma.trip.findMany({
    where: tripWhere(viewer),
    orderBy: [{ updatedAt: "desc" }],
    include: {
      places: { include: { visits: { select: { id: true } } } },
    },
  });

  const themes = trips.filter((trip) => trip.kind === "THEME");
  const singles = trips.filter((trip) => trip.kind !== "THEME");

  const createLink = (
    <Link href="/travel/new" prefetch className="btn btn-primary btn-sm">
      <Plus size={14} strokeWidth={2.2} /> 新建
    </Link>
  );

  return (
    <div>
      <PageHeader
        title="旅行"
        eyebrow="Travel"
        description="把去过的地方收在一处：一次出行，或一个要慢慢走完的主题。"
        action={createLink}
      />

      {trips.length === 0 ? (
        <EmptyState
          icon={<Compass strokeWidth={1.7} />}
          title="还没有旅行"
          description="新建一次单次旅行，或者挑一个主题——博物馆、古建、石窟、名山、湖泊、地标都有现成模板，路过时打个卡就好。"
          action={
            <Link href="/travel/new" className="btn btn-primary btn-sm">
              开始第一段旅行
            </Link>
          }
        />
      ) : null}

      {themes.length > 0 ? (
        <section className="mb-8">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Repeat size={14} className="text-muted" /> 主题旅行
              <span className="font-normal text-faint">{themes.length}</span>
            </h2>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {themes.map((trip) => {
              const progress = tripProgress(trip.places);
              const regions = tripRegions(trip.places);
              const visits = trip.places.reduce((sum, place) => sum + place.visits.length, 0);
              return (
                <Link
                  key={trip.id}
                  href={`/travel/${trip.id}`}
                  prefetch
                  className="card group overflow-hidden transition hover:border-line-strong"
                >
                  {trip.coverMediaId ? (
                    <img
                      src={`/api/media/${trip.coverMediaId}/thumb`}
                      alt=""
                      loading="lazy"
                      className="aspect-[16/8] w-full object-cover"
                    />
                  ) : trip.coverImage ? (
                    <img
                      src={trip.coverImage}
                      alt=""
                      loading="lazy"
                      className="aspect-[16/8] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[16/8] items-center justify-center bg-raised text-faint">
                      <Repeat size={26} strokeWidth={1.4} />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold">{trip.title}</h3>
                        {trip.subtitle ? (
                          <p className="mt-0.5 truncate text-[11.5px] text-faint">{trip.subtitle}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-accent">
                        {progress.percent}%
                      </span>
                    </div>

                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-raised">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-500"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10.5px] text-faint">
                      已打卡 {progress.visited}/{progress.total} 个地点
                      {regions.length > 0 ? ` · ${regions.length} 个地区` : ""}
                      {visits > 0 ? ` · ${visits} 次到访` : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {singles.length > 0 ? (
        <section>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Compass size={14} className="text-muted" /> 单次旅行
              <span className="font-normal text-faint">{singles.length}</span>
            </h2>
          </div>
          <div className="card divide-y divide-line overflow-hidden">
            {singles.map((trip) => {
              const progress = tripProgress(trip.places);
              const visits = trip.places.reduce((sum, place) => sum + place.visits.length, 0);
              return (
                <Link
                  key={trip.id}
                  href={`/travel/${trip.id}`}
                  prefetch
                  className="flex items-center gap-3 px-3.5 py-3 transition hover:bg-raised/60"
                >
                  {trip.coverMediaId || trip.coverImage ? (
                    <img
                      src={
                        trip.coverMediaId
                          ? `/api/media/${trip.coverMediaId}/thumb`
                          : (trip.coverImage ?? "")
                      }
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-raised text-faint">
                      <MapPin size={18} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{trip.title}</span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-faint">
                      {trip.startDate
                        ? formatDayRange(trip.startDate, trip.endDate, timezone)
                        : "日期待定"}
                      {progress.total > 0
                        ? ` · ${progress.visited}/${progress.total} 个地点`
                        : ""}
                      {visits > 0 ? ` · ${visits} 次到访` : ""}
                    </span>
                  </span>
                  <span className="chip shrink-0">{tripStatusLabel(trip.status)}</span>
                  <ArrowRight size={13} className="shrink-0 text-faint" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
