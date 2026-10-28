import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mediaWhere, tripWhere } from "@/lib/access";
import { toDateInput } from "@/lib/dates";
import { TripForm } from "@/components/travel/TripForm";

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;

  const trip = await prisma.trip.findFirst({ where: { id, ...tripWhere(viewer) } });
  if (!trip) notFound();

  const cover = trip.coverMediaId
    ? await prisma.media.findFirst({
        where: { id: trip.coverMediaId, ...mediaWhere(viewer) },
        select: { id: true },
      })
    : null;

  return (
    <TripForm
      defaultVisibility={context.user.defaultVisibility}
      initial={{
        id: trip.id,
        kind: trip.kind,
        title: trip.title,
        subtitle: trip.subtitle || "",
        description: trip.description || "",
        startDate: toDateInput(trip.startDate, timezone),
        endDate: toDateInput(trip.endDate, timezone),
        status: trip.status,
        visibility: trip.visibility,
        coverMediaId: cover?.id ?? null,
        coverUrl: cover ? `/api/media/${cover.id}/thumb` : null,
      }}
    />
  );
}
