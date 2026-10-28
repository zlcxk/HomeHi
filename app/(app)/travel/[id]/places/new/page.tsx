import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tripWhere } from "@/lib/access";
import { PlaceForm } from "@/components/travel/PlaceForm";

export default async function NewTripPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };

  const trip = await prisma.trip.findFirst({
    where: { id, ...tripWhere(viewer) },
    select: { id: true, title: true },
  });
  if (!trip) notFound();

  return <PlaceForm tripId={trip.id} tripTitle={trip.title} />;
}
