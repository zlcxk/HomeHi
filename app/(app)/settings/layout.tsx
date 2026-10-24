import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SettingsNav } from "@/components/settings/SettingsNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="mb-5">
        <Link href="/my" className="mb-3 inline-flex items-center gap-1 text-[11.5px] text-faint hover:text-ink">
          <ArrowLeft size={13} /> 我的
        </Link>
        <h1 className="font-display text-[34px] leading-none tracking-tight">设置</h1>
      </header>
      <SettingsNav />
      {children}
    </div>
  );
}
