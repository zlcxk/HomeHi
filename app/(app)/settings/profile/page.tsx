import Link from "next/link";
import { ArrowUpRight, LogOut, UserRound } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/app/actions/auth";
import { AccountForm } from "@/components/settings/AccountForm";
import { PasswordForm } from "@/components/settings/PasswordForm";

export default async function AccountSettingsPage() {
  const context = await requireContext();

  const avatar = context.user.avatarMediaId
    ? await prisma.media.findFirst({
        where: {
          id: context.user.avatarMediaId,
          householdId: context.household.id,
          status: "ACTIVE",
          OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
        },
        select: { id: true },
      })
    : null;

  return (
    <div className="space-y-5">
      <AccountForm
        displayName={context.user.displayName}
        email={context.user.email}
        defaultVisibility={context.user.defaultVisibility}
        avatarMediaId={avatar?.id ?? null}
        avatarUrl={avatar ? `/api/media/${avatar.id}/thumb` : null}
      />

      <div className="card flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-muted">
            <UserRound size={15} />
          </span>
          <div>
            <p className="text-[12.5px] font-medium">你的家庭档案</p>
            <p className="text-[10.5px] text-faint">照片、生日和相关的记录</p>
          </div>
        </div>
        <Link href="/profiles" className="btn btn-outline btn-sm">
          查看 <ArrowUpRight size={12} />
        </Link>
      </div>

      <PasswordForm />

      <form action={logoutAction} className="pt-2">
        <button type="submit" className="btn btn-ghost btn-sm text-muted">
          <LogOut size={14} /> 退出登录
        </button>
      </form>

      <p className="pt-2 text-[10.5px] leading-relaxed text-faint">
        HomeHi 把数据存在你自己的服务器上。没有广告，没有分析脚本，也不会把家庭内容发给第三方。
      </p>
    </div>
  );
}
