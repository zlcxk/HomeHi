import "server-only";

import { prisma } from "@/lib/db";
import type { AppContext } from "@/lib/auth";
import { assetWhere, profileWhere } from "@/lib/access";
import type { ProfileOption } from "@/components/pickers/ProfilePicker";

export async function profileOptions(context: AppContext): Promise<ProfileOption[]> {
  const profiles = await prisma.familyProfile.findMany({
    where: profileWhere({ userId: context.user.id, householdId: context.household.id }),
    orderBy: [{ profileType: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      profileType: true,
      avatarMediaId: true,
    },
  });

  const avatarIds = profiles.map((profile) => profile.avatarMediaId).filter((id): id is string => Boolean(id));
  const avatars = avatarIds.length
    ? await prisma.media.findMany({
        where: {
          id: { in: avatarIds },
          householdId: context.household.id,
          status: "ACTIVE",
          OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
        },
        select: { id: true },
      })
    : [];
  const allowed = new Set(avatars.map((avatar) => avatar.id));

  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    profileType: profile.profileType,
    avatarUrl:
      profile.avatarMediaId && allowed.has(profile.avatarMediaId)
        ? `/api/media/${profile.avatarMediaId}/thumb`
        : null,
  }));
}

export type AssetOption = {
  id: string;
  name: string;
  category: string;
  photoUrl?: string | null;
};

export async function assetOptions(context: AppContext): Promise<AssetOption[]> {
  const assets = await prisma.asset.findMany({
    where: assetWhere({ userId: context.user.id, householdId: context.household.id }),
    orderBy: [{ category: "asc" }, { name: "asc" }],
    take: 200,
    select: { id: true, name: true, category: true, photoMediaId: true },
  });

  const photoIds = assets
    .map((asset) => asset.photoMediaId)
    .filter((id): id is string => Boolean(id));
  const photos = photoIds.length
    ? await prisma.media.findMany({
        where: {
          id: { in: photoIds },
          householdId: context.household.id,
          status: "ACTIVE",
          OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
        },
        select: { id: true },
      })
    : [];
  const allowed = new Set(photos.map((photo) => photo.id));

  return assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    photoUrl:
      asset.photoMediaId && allowed.has(asset.photoMediaId)
        ? `/api/media/${asset.photoMediaId}/thumb`
        : null,
  }));
}

export async function householdTags(context: AppContext): Promise<string[]> {
  const tags = await prisma.tag.findMany({
    where: { householdId: context.household.id },
    orderBy: { name: "asc" },
    take: 60,
    select: { name: true },
  });
  return tags.map((tag) => tag.name);
}

export async function memberOptions(
  context: AppContext,
): Promise<{ id: string; name: string; role: string }[]> {
  const members = await prisma.householdMember.findMany({
    where: { householdId: context.household.id },
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return members.map((member) => ({
    id: member.user.id,
    name: member.user.displayName,
    role: member.role,
  }));
}
