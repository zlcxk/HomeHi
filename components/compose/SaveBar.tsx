import type { ReactNode } from "react";

export function SaveBar({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div
      className="sticky bottom-0 z-20 -mx-4 mt-9 border-t border-line bg-[color-mix(in_srgb,var(--paper)_90%,transparent)] px-4 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-[680px] items-center gap-2.5">
        {note ? <p className="mr-auto hidden text-[11px] leading-snug text-faint sm:block">{note}</p> : null}
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">{children}</div>
      </div>
    </div>
  );
}
