import { Crown, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { timezoneOptions } from "@/lib/timezones";
import { removeMemberAction } from "@/app/actions/settings";
import { HouseholdForm } from "@/components/settings/HouseholdForm";
import { AddMemberForm } from "@/components/settings/AddMemberForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Avatar } from "@/components/Avatar";

export default async function HouseholdSettingsPage() {
  const context = await requireContext();
  const isOwner = context.role === "OWNER";

  const members = await prisma.householdMember.findMany({
    where: { householdId: context.household.id },
    include: {
      user: {
        select: { id: true, displayName: true, email: true, lastLoginAt: true, avatarMediaId: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-5">
      {isOwner ? (
        <HouseholdForm
          name={context.household.name}
          timezone={context.household.timezone}
          zones={timezoneOptions(context.household.timezone)}
        />
      ) : (
        <div className="card p-4 sm:p-5">
          <h2 className="text-[13px] font-semibold">家庭空间</h2>
          <p className="mt-2 text-[13px]">{context.household.name}</p>
          <p className="mt-1 text-[11px] text-faint">时区 {context.household.timezone} · 只有家庭管理员可以修改</p>
        </div>
      )}

      <section>
        <h2 className="mb-2.5 text-[13px] font-semibold">
          成员 <span className="font-normal text-faint">{members.length}</span>
        </h2>
        <div className="card divide-y divide-line overflow-hidden">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 px-4 py-3.5">
              <Avatar
                name={member.user.displayName}
                src={
                  member.user.avatarMediaId
                    ? `/api/media/${member.user.avatarMediaId}/thumb`
                    : null
                }
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                  {member.user.displayName}
                  {member.role === "OWNER" ? <Crown size={11} className="text-gold" /> : null}
                  {member.user.id === context.user.id ? (
                    <span className="rounded-full bg-raised px-1.5 py-0.5 text-[9px] text-faint">你</span>
                  ) : null}
                </p>
                <p className="truncate text-[10.5px] text-faint">{member.user.email}</p>
              </div>
              {isOwner && member.user.id !== context.user.id ? (
                <form action={removeMemberAction}>
                  <input type="hidden" name="userId" value={member.user.id} />
                  <ConfirmButton
                    className="icon-btn icon-btn-plain text-faint hover:text-danger"
                    message="把这个成员移出家庭？TA 将无法再登录这个家庭空间，但已创建的记录会保留。"
                    pendingText=""
                  >
                    <Trash2 size={14} />
                  </ConfirmButton>
                </form>
              ) : (
                <span className="text-[10px] text-faint">{member.role === "OWNER" ? "管理员" : "成员"}</span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
          每个账号只能看到自己家庭空间里的内容。移出成员不会删除 TA 写下的记录。
        </p>
      </section>

      {isOwner ? <AddMemberForm /> : null}
    </div>
  );
}
