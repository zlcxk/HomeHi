import Link from "next/link";

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="var(--accent)" />
      <path
        d="M8.5 23V15.4C8.5 11.3 11.9 8 16 8s7.5 3.3 7.5 7.4V23"
        stroke="var(--accent-ink)"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <circle cx="16" cy="22.6" r="2" fill="var(--accent-ink)" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/today" className="inline-flex items-center gap-2.5" aria-label="HomeHi 首页">
      <BrandMark size={compact ? 28 : 32} />
      <span className="font-display text-[25px] leading-none tracking-tight">
        Home<span className="italic text-accent">Hi</span>
      </span>
    </Link>
  );
}
