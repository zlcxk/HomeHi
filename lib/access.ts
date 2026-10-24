import type { Prisma } from "@prisma/client";

type Viewer = { userId: string; householdId: string };

/**
 * Visibility rules, enforced server-side everywhere.
 * A record is visible either when shared with the household, or when the
 * viewer created it. Media carries its own visibility so a photo inside a
 * private entry does not leak through the photo library or search.
 */
export function entryWhere(viewer: Viewer, includeDeleted = false): Prisma.EntryWhereInput {
  return {
    householdId: viewer.householdId,
    ...(includeDeleted ? {} : { status: { not: "DELETED" } }),
    OR: [{ visibility: "HOUSEHOLD" }, { createdBy: viewer.userId }],
  };
}

export function publishedEntryWhere(viewer: Viewer): Prisma.EntryWhereInput {
  return {
    ...entryWhere(viewer),
    status: "PUBLISHED",
  };
}

export function mediaWhere(viewer: Viewer, includeDeleted = false): Prisma.MediaWhereInput {
  return {
    householdId: viewer.householdId,
    ...(includeDeleted ? {} : { status: "ACTIVE" }),
    OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: viewer.userId }],
  };
}

export function eventWhere(viewer: Viewer): Prisma.CalendarEventWhereInput {
  return {
    householdId: viewer.householdId,
    status: "ACTIVE",
    OR: [{ visibility: "HOUSEHOLD" }, { createdBy: viewer.userId }],
  };
}

export function taskWhere(viewer: Viewer): Prisma.TaskWhereInput {
  return {
    householdId: viewer.householdId,
    OR: [{ visibility: "HOUSEHOLD" }, { createdBy: viewer.userId }],
  };
}

export function profileWhere(viewer: Viewer): Prisma.FamilyProfileWhereInput {
  return {
    householdId: viewer.householdId,
    OR: [{ visibility: "HOUSEHOLD" }, { linkedUserId: viewer.userId }],
  };
}

export function canViewEntry(
  entry: { householdId: string; createdBy: string; visibility: string; status?: string },
  viewer: Viewer,
): boolean {
  if (entry.householdId !== viewer.householdId) return false;
  if (entry.status === "DELETED") return false;
  if (entry.status === "DRAFT" && entry.createdBy !== viewer.userId) return false;
  return entry.visibility === "HOUSEHOLD" || entry.createdBy === viewer.userId;
}

export function canViewMedia(
  media: { householdId: string; uploadedBy: string; visibility: string; status: string },
  viewer: Viewer,
): boolean {
  return (
    media.householdId === viewer.householdId &&
    media.status === "ACTIVE" &&
    (media.visibility === "HOUSEHOLD" || media.uploadedBy === viewer.userId)
  );
}

export function canEditEntry(
  entry: { householdId: string; createdBy: string; visibility: string },
  viewer: Viewer,
): boolean {
  return canViewEntry(entry, viewer);
}
