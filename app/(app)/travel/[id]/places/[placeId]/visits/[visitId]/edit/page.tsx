import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tripWhere } from "@/lib/access";
import { findTravelTemplate, isCategorizedTemplate } from "@/lib/travel-templates";
import { VisitForm } from "@/components/travel/VisitForm";

export default async function EditTripVisitPage({
  params,
}: {
  params: Promise<{ id: string; placeId: string; visitId: string }>;
}) {
  const { id, placeId, visitId } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;

  const visit = await prisma.tripVisit.findFirst({
    where: {
      id: visitId,
      placeId,
      place: { tripId: id, trip: tripWhere(viewer) },
    },
    include: {
      place: {
        select: {
          name: true,
          trip: { select: { visibility: true, templateId: true } },
        },
      },
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
  });
  if (!visit) notFound();

  const media = visit.photos
    .filter(
      (photo) =>
        photo.media.status === "ACTIVE" &&
        (photo.media.visibility === "HOUSEHOLD" || photo.media.uploadedBy === context.user.id),
    )
    .map((photo) => ({
      id: photo.media.id,
      mediaType: photo.media.mediaType,
      thumbUrl: `/api/media/${photo.media.id}/thumb`,
      url: `/api/media/${photo.media.id}/file`,
    }));

  const today = DateTime.now().setZone(timezone).toFormat("yyyy-MM-dd");
  const template = visit.place.trip.templateId
    ? findTravelTemplate(visit.place.trip.templateId)
    : undefined;

  return (
    <VisitForm
      tripId={id}
      placeId={placeId}
      placeName={visit.place.name}
      defaultDate={today}
      visibility={visit.place.trip.visibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD"}
      itemMode={isCategorizedTemplate(template)}
      initial={{
        id: visit.id,
        visitedAt: DateTime.fromJSDate(visit.visitedAt, { zone: timezone }).toFormat("yyyy-MM-dd"),
        location: visit.location || "",
        note: visit.note || "",
        media,
      }}
    />
  );
}
