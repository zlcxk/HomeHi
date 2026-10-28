import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Database,
  Images,
  ListTodo,
  LogOut,
  Mail,
  Palette,
  PenLine,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishedEntryWhere, mediaWhere } from "@/lib/access";
import { logoutAction } from "@/app/actions/auth";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";

export default async function MyPage() {
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };

  const [entryCount, photoCount, openTaskCount, memberCount, trashCount, profile] = await Promise.all([
    prisma.entry.count({ where: { ...publishedEntryWhere(viewer), createdBy: context.user.id } }),
    prisma.media.count({ where: { ...mediaWhere(viewer), uploadedBy: context.user.id } }),
    prisma.task.count({
      where: {
        householdId: context.household.id,
        status: "TODO",
        AND: [{ OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }] }],
      },
    }),
    prisma.householdMember.count({ where: { householdId: context.household.id } }),
    prisma.entry.count({
      where: {
        householdId: context.household.id,
        status: "DELETED",
        OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
      },
    }),
    prisma.familyProfile.findFirst({
      where: { householdId: context.household.id, linkedUserId: context.user.id },
      select: { id: true },
    }),
  ]);

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

  const links = [
    { href: "/settings/profile", label: "账户与密码", icon: Settings, hint: "称呼、默认隐私、密码" },
    { href: "/settings/household", label: "成员与邀请", icon: Users, hint: `${memberCount} 位成员` },
    { href: "/notifications", label: "提醒记录", icon: BellRing, hint: "已发送与失败的邮件" },
    { href: "/settings/email", label: "邮件设置", icon: Mail, hint: "SMTP 与测试" },
    { href: "/settings/data", label: "数据与导出", icon: Database, hint: "导出、示例数据" },
    { href: "/settings/appearance", label: "外观", icon: Palette, hint: "配色与明暗" },
    { href: "/trash", label: "回收站", icon: Trash2, hint: trashCount > 0 ? `${trashCount} 条待处理` : "空的" },
  ];

  return (
    <div>
      <PageHeader title="我的" eyebrow="Home" description={context.household.name} />

      <Link
        href={profile ? `/profiles/${profile.id}` : "/profiles"}
        prefetch
        className="card hero-warm card-organic mb-6 flex items-center gap-4 p-5 transition hover:border-line-strong"
      >
        <Avatar
          name={context.user.displayName}
          src={avatar ? `/api/media/${avatar.id}/thumb` : null}
          size={64}
          ring
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[29px] leading-none tracking-[-0.025em]">
            {context.user.displayName}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-faint">{context.user.email}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted">
            <ShieldCheck size={10.5} className="text-sage" />
            {context.role === "OWNER" ? "家庭管理员" : "家庭成员"} · 数据保存在本机
          </p>
        </div>
        <ArrowRight size={16} className="shrink-0 text-faint" />
      </Link>

      <div className="mb-7 grid grid-cols-3 gap-2">
        {[
          { label: "记录", value: entryCount, href: "/timeline", icon: PenLine },
          { label: "照片", value: photoCount, href: "/photos", icon: Images },
          { label: "待办", value: openTaskCount, href: "/tasks", icon: ListTodo },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href} prefetch className="card px-3.5 py-3.5 transition hover:border-line-strong">
              <Icon size={14} className="text-faint" />
              <p className="display-number mt-2 text-[30px]">{stat.value}</p>
              <p className="mt-1 text-[10.5px] text-faint">{stat.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch
              className="card flex items-center gap-3 px-4 py-3.5 transition hover:border-line-strong"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-muted">
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium">{link.label}</span>
                <span className="block truncate text-[10.5px] text-faint">{link.hint}</span>
              </span>
              <ArrowRight size={13} className="shrink-0 text-faint" />
            </Link>
          );
        })}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3.5">
        <div className="flex items-center gap-2 text-[11px] text-faint">
          <CalendarDays size={13} />
          HomeHi · 把日子收好
        </div>
        <form action={logoutAction}>
          <button type="submit" className="btn btn-ghost btn-sm text-muted">
            <LogOut size={13} /> 退出登录
          </button>
        </form>
      </div>
    </div>
  );
}
