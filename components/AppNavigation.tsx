"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Boxes,
  CalendarDays,
  Camera,
  ChevronRight,
  Images,
  ListTodo,
  PenLine,
  Plus,
  Search,
  Settings,
  Sunrise,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { Avatar } from "@/components/Avatar";

const mobileItems = [
  { href: "/today", label: "今日", icon: Sunrise, match: ["/today"] },
  { href: "/timeline", label: "时光", icon: BookOpen, match: ["/timeline", "/entries"] },
  { href: "/photos", label: "照片", icon: Images, match: ["/photos"] },
  { href: "/my", label: "我的", icon: UserRound, match: ["/my", "/settings"] },
];

const sideItems = [
  { href: "/today", label: "今日", icon: Sunrise },
  { href: "/timeline", label: "时光", icon: BookOpen },
  { href: "/photos", label: "照片", icon: Images },
  { href: "/calendar", label: "日历", icon: CalendarDays },
  { href: "/tasks", label: "待办", icon: ListTodo },
  { href: "/profiles", label: "家人与宠物", icon: Users },
  { href: "/assets", label: "物品与资产", icon: Boxes },
  { href: "/search", label: "搜索", icon: Search },
];

function active(pathname: string, href: string, match?: string[]) {
  const targets = match || [href];
  return targets.some((target) => pathname === target || pathname.startsWith(`${target}/`));
}

export function AppNavigation({
  userName,
  userEmail,
  householdName,
}: {
  userName: string;
  userEmail: string;
  householdName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[254px] flex-col border-r border-line bg-paper px-5 py-7 lg:flex">
        <Brand />

        <button type="button" className="btn btn-primary mt-7 w-full" onClick={() => setOpen(true)}>
          <Plus size={17} strokeWidth={2.2} />
          记录一点
        </button>

        <nav className="mt-6 flex flex-col gap-0.5" aria-label="主导航">
          {sideItems.map((item) => {
            const Icon = item.icon;
            const isActive = active(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition ${
                  isActive
                    ? "bg-surface font-semibold text-ink shadow-[0_1px_0_var(--line)]"
                    : "text-muted hover:bg-raised hover:text-ink"
                }`}
              >
                <Icon size={17} strokeWidth={1.8} className={isActive ? "text-accent" : ""} />
                {item.label}
                {isActive ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          <Link
            href="/settings/profile"
            className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-2.5 transition hover:bg-raised"
          >
            <Avatar name={userName} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{userName}</span>
              <span className="block truncate text-[11px] text-faint">{householdName}</span>
            </span>
            <Settings size={15} className="text-faint" />
          </Link>
          <p className="px-1 text-[10.5px] leading-relaxed text-faint">
            HomeHi · 数据只属于你家
            <br />
            {userEmail}
          </p>
        </div>
      </aside>

      <nav className="tabbar glassbar lg:hidden" aria-label="主导航">
        <TabItem item={mobileItems[0]} pathname={pathname} />
        <TabItem item={mobileItems[1]} pathname={pathname} />
        <button
          type="button"
          className="tabbar-create"
          onClick={() => setOpen(true)}
          aria-label="记录一点"
        >
          <Plus size={25} strokeWidth={2} />
        </button>
        <TabItem item={mobileItems[2]} pathname={pathname} />
        <TabItem item={mobileItems[3]} pathname={pathname} />
      </nav>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="选择记录方式"
        >
          <button
            type="button"
            className="animate-fade absolute inset-0 bg-[rgba(22,17,10,0.42)] backdrop-blur-[3px]"
            onClick={() => setOpen(false)}
            aria-label="关闭"
          />
          <div className="animate-sheet relative w-full max-w-[480px] px-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:px-4 sm:pb-0">
            <div className="sheet p-5 sm:mb-6 sm:rounded-[32px]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="eyebrow">新的一笔</p>
                  <h2 className="font-display mt-1 text-[27px] leading-none">记下什么？</h2>
                </div>
                <button
                  type="button"
                  className="icon-btn icon-btn-plain"
                  onClick={() => setOpen(false)}
                  aria-label="关闭"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="grid gap-1.5">
                <ComposerLink
                  href="/compose/moment"
                  onClick={() => setOpen(false)}
                  icon={<Camera size={20} strokeWidth={1.8} />}
                  tone="bg-accent-soft text-accent"
                  title="一个瞬间"
                />
                <ComposerLink
                  href="/compose/story"
                  onClick={() => setOpen(false)}
                  icon={<PenLine size={20} strokeWidth={1.8} />}
                  tone="bg-sage-soft text-sage"
                  title="一篇手记"
                />
                <ComposerLink
                  href="/compose/event"
                  onClick={() => setOpen(false)}
                  icon={<CalendarDays size={20} strokeWidth={1.8} />}
                  tone="bg-[color-mix(in_srgb,var(--gold)_16%,transparent)] text-gold"
                  title="一件日程"
                />
                <ComposerLink
                  href="/compose/task"
                  onClick={() => setOpen(false)}
                  icon={<ListTodo size={20} strokeWidth={1.8} />}
                  tone="bg-raised text-ink"
                  title="一件待办"
                />
                <ComposerLink
                  href="/assets/new"
                  onClick={() => setOpen(false)}
                  icon={<Boxes size={20} strokeWidth={1.8} />}
                  tone="bg-raised text-muted"
                  title="一件物品"
                />
              </div>

              <div className="mt-4 grid grid-cols-5 gap-1 border-t border-line pt-3">
                {[
                  { href: "/calendar", label: "日历", icon: CalendarDays },
                  { href: "/tasks", label: "待办", icon: ListTodo },
                  { href: "/profiles", label: "家人", icon: Users },
                  { href: "/assets", label: "物品", icon: Boxes },
                  { href: "/search", label: "搜索", icon: Search },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch
                      onClick={() => setOpen(false)}
                      className="flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] text-muted transition hover:bg-raised hover:text-ink"
                    >
                      <Icon size={17} strokeWidth={1.8} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TabItem({
  item,
  pathname,
}: {
  item: (typeof mobileItems)[number];
  pathname: string;
}) {
  const Icon = item.icon;
  const isActive = active(pathname, item.href, item.match);
  return (
    <Link
      href={item.href}
      prefetch
      className="tabbar-item"
      data-active={isActive}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon size={20} strokeWidth={isActive ? 2 : 1.7} />
      {item.label}
    </Link>
  );
}

function ComposerLink({
  href,
  icon,
  tone,
  title,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  tone: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group flex items-center gap-3.5 rounded-2xl px-2 py-2.5 transition hover:bg-raised"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ${tone}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-[14.5px] font-semibold leading-tight">{title}</span>
      <ChevronRight size={17} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-muted" />
    </Link>
  );
}
