import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tripWhere } from "@/lib/access";
import { PlaceForm } from "@/components/travel/PlaceForm";

export default async function EditTripPlacePage({
  params,
}: {
  params: Promise<{ id: string; placeId: string }>;
}) {
  const { id, placeId } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };

  const place = await prisma.tripPlace.findFirst({
    where: { id: placeId, tripId: id, trip: tripWhere(viewer) },
    include: { trip: { select: { title: true } } },
  });
  if (!place) notFound();

  return (
    <PlaceForm
      tripId={id}
      tripTitle={place.trip.title}
      initial={{
        id: place.id,
        name: place.name,
        region: place.region || "",
        address: place.address || "",
        note: place.note || "",
      }}
    />
  );
}
