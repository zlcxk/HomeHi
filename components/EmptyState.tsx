import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`empty-illustration flex flex-col items-center justify-center rounded-[28px] border border-line text-center ${
        compact ? "px-5 py-8" : "px-6 py-12"
      }`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface text-muted [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-[300px] text-[13px] leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
