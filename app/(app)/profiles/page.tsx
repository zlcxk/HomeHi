import Link from "next/link";
import { Cake, PawPrint, Plus, Users } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { profileWhere } from "@/lib/access";
import { ageLabel, daysUntil } from "@/lib/dates";
import { nextBirthdayOf } from "@/lib/birthdays";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Avatar } from "@/components/Avatar";

export default async function ProfilesPage() {
  const context = await requireContext();
  const timezone = context.household.timezone;

  const profiles = await prisma.familyProfile.findMany({
    where: profileWhere({ userId: context.user.id, householdId: context.household.id }),
    orderBy: [{ profileType: "asc" }, { createdAt: "asc" }],
    include: { linkedUser: { select: { id: true, displayName: true } } },
  });

  const avatarIds = profiles
    .map((profile) => profile.avatarMediaId)
    .filter((id): id is string => Boolean(id));
  const allowedAvatars = avatarIds.length
    ? new Set(
        (
          await prisma.media.findMany({
            where: {
              id: { in: avatarIds },
              householdId: context.household.id,
              status: "ACTIVE",
              OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
            },
            select: { id: true },
          })
        ).map((media) => media.id),
      )
    : new Set<string>();

  const people = profiles.filter((profile) => profile.profileType !== "PET");
  const pets = profiles.filter((profile) => profile.profileType === "PET");

  function ProfileCard({ profile }: { profile: (typeof profiles)[number] }) {
    const avatarUrl =
      profile.avatarMediaId && allowedAvatars.has(profile.avatarMediaId)
        ? `/api/media/${profile.avatarMediaId}/thumb`
        : null;
    const birthday = nextBirthdayOf(profile, timezone);
    const countdown = birthday ? daysUntil(birthday, timezone) : null;
    const age = ageLabel(profile.birthday, timezone);

    return (
      <Link
        href={`/profiles/${profile.id}`}
        className="card flex items-center gap-3 p-3.5 transition hover:border-line-strong sm:gap-4 sm:p-4"
      >
        <Avatar name={profile.name} src={avatarUrl} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-semibold">{profile.name}</p>
            {profile.profileType === "PET" ? <PawPrint size={12} className="text-faint" /> : null}
            {profile.visibility === "PRIVATE" ? (
              <span className="rounded-full bg-raised px-1.5 py-0.5 text-[9px] text-faint">私密</span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-muted">
            {profile.profileType === "PET"
              ? [profile.species, profile.breed].filter(Boolean).join(" · ") || "家里的宠物"
              : profile.linkedUser
                ? "家庭管理员"
                : age || "家庭成员"}
            {age && profile.profileType === "PET" ? ` · ${age}` : ""}
          </p>
          {countdown !== null ? (
            <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-faint">
              <Cake size={10.5} className={countdown <= 7 ? "text-gold" : ""} />
              {countdown === 0
                ? "今天生日"
                : countdown === 1
                  ? "明天生日"
                  : `还有 ${countdown} 天生日`}
            </p>
          ) : null}
        </div>
      </Link>
    );
  }

  return (
    <div>
      <PageHeader
        title="家人与宠物"
        eyebrow="Our people"
        action={
          <Link href="/profiles/new" className="btn btn-primary btn-sm">
            <Plus size={14} /> 添加
          </Link>
        }
      />

      {profiles.length === 0 ? (
        <EmptyState
          icon={<Users strokeWidth={1.7} />}
          title="还没有家人的档案"
          action={
            <Link href="/profiles/new" className="btn btn-primary btn-sm">
              <Plus size={14} /> 新建档案
            </Link>
          }
        />
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {people.length > 0 ? (
            <section>
              <h2 className="mb-2.5 text-[13px] font-semibold">
                家人 <span className="font-normal text-faint">{people.length}</span>
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {people.map((profile) => (
                  <ProfileCard key={profile.id} profile={profile} />
                ))}
              </div>
            </section>
          ) : null}

          {pets.length > 0 ? (
            <section>
              <h2 className="mb-2.5 text-[13px] font-semibold">
                宠物 <span className="font-normal text-faint">{pets.length}</span>
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {pets.map((profile) => (
                  <ProfileCard key={profile.id} profile={profile} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
