import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { profileWhere } from "@/lib/access";
import { toDateInput } from "@/lib/dates";
import { ProfileForm, type ProfileInitial } from "@/components/profiles/ProfileForm";

export default async function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const timezone = context.household.timezone;
  const viewer = { userId: context.user.id, householdId: context.household.id };

  const profile = await prisma.familyProfile.findFirst({
    where: { id, ...profileWhere(viewer) },
  });
  if (!profile) notFound();

  const avatar = profile.avatarMediaId
    ? await prisma.media.findFirst({
        where: {
          id: profile.avatarMediaId,
          householdId: context.household.id,
          status: "ACTIVE",
          OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
        },
        select: { id: true },
      })
    : null;

  const initial: ProfileInitial = {
    id: profile.id,
    profileType: profile.profileType,
    name: profile.name,
    birthday: toDateInput(profile.birthday, timezone),
    joinedDate: toDateInput(profile.joinedDate, timezone),
    species: profile.species || "",
    breed: profile.breed || "",
    gender: profile.gender || "",
    description: profile.description || "",
    visibility: profile.visibility,
    avatarUrl: avatar ? `/api/media/${avatar.id}/thumb` : null,
    avatarMediaId: avatar?.id ?? null,
  };

  return <ProfileForm initial={initial} defaultVisibility={context.user.defaultVisibility} />;
}
