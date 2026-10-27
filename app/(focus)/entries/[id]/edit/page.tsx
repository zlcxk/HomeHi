import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewEntry } from "@/lib/access";
import { toLocalInput } from "@/lib/dates";
import { profileOptions, householdTags, recentLocations } from "@/lib/view";
import { StoryComposer, type StoryInitial } from "@/components/compose/StoryComposer";

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };

  const entry = await prisma.entry.findUnique({
    where: { id },
    include: {
      media: { orderBy: { sortOrder: "asc" }, include: { media: true } },
      profiles: { select: { profileId: true } },
      tags: { include: { tag: true } },
    },
  });

  if (!entry || entry.status === "DELETED" || !canViewEntry(entry, viewer)) notFound();

  const [profiles, tags, locations] = await Promise.all([
    profileOptions(context),
    householdTags(context),
    recentLocations(context),
  ]);
  const media = entry.media
    .filter((link) => link.media.status === "ACTIVE")
    .filter(
      (link) =>
        link.media.visibility === "HOUSEHOLD" || link.media.uploadedBy === context.user.id,
    )
    .map((link) => ({
      id: link.media.id,
      mediaType: link.media.mediaType,
      thumbUrl: `/api/media/${link.media.id}/thumb`,
      url: `/api/media/${link.media.id}/file`,
      width: link.media.width,
      height: link.media.height,
      durationSeconds: link.media.durationSeconds,
    }));

  const initial: StoryInitial = {
    id: entry.id,
    entryType: entry.entryType,
    title: entry.title || "",
    body: entry.body || "",
    location: entry.location || "",
    occurredAt: toLocalInput(entry.occurredAt, context.household.timezone),
    visibility: entry.visibility,
    status: entry.status,
    media,
    profileIds: entry.profiles.map((profile) => profile.profileId),
    tags: entry.tags.map((tag) => tag.tag.name),
  };

  return (
    <StoryComposer
      profiles={profiles}
      tags={tags}
      locations={locations}
      defaultVisibility={context.user.defaultVisibility}
      defaultOccurredAt={initial.occurredAt}
      initial={initial}
      backHref={`/entries/${entry.id}`}
    />
  );
}
