"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/settings/profile", label: "账户" },
  { href: "/settings/household", label: "家庭" },
  { href: "/settings/notifications", label: "通知" },
  { href: "/settings/email", label: "邮件" },
  { href: "/settings/storage", label: "存储" },
  { href: "/settings/data", label: "数据" },
  { href: "/settings/appearance", label: "外观" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mb-7 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-1 rounded-2xl border border-line bg-surface p-1 sm:w-auto">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={`rounded-xl px-3.5 py-1.5 text-[12.5px] transition ${
                active ? "bg-ink text-paper" : "text-muted hover:bg-raised"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
