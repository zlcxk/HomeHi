import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tripWhere } from "@/lib/access";
import { VisitForm } from "@/components/travel/VisitForm";

export default async function TripCheckinPage({
  params,
}: {
  params: Promise<{ id: string; placeId: string }>;
}) {
  const { id, placeId } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };

  const place = await prisma.tripPlace.findFirst({
    where: { id: placeId, tripId: id, trip: tripWhere(viewer) },
    include: { trip: { select: { visibility: true } } },
  });
  if (!place) notFound();

  const today = DateTime.now().setZone(context.household.timezone).toFormat("yyyy-MM-dd");

  return (
    <VisitForm
      tripId={id}
      placeId={place.id}
      placeName={place.name}
      defaultDate={today}
      visibility={place.trip.visibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD"}
    />
  );
}
