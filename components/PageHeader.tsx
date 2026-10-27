import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  action,
  backHref,
  description,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  backHref?: string;
  description?: string;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-3 sm:mb-7 sm:gap-4">
      <div className="flex min-w-0 items-start gap-2 sm:gap-3">
        {backHref ? (
          <Link href={backHref} className="icon-btn icon-btn-plain -ml-2 mt-1" aria-label="返回">
            <ArrowLeft size={19} strokeWidth={1.8} />
          </Link>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
          <h1 className="font-display text-[30px] leading-[1.08] tracking-tight sm:text-[38px]">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-lg text-[12.5px] leading-relaxed text-muted sm:text-[13.5px]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0 pt-1">{action}</div> : null}
    </header>
  );
}
