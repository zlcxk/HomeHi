"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function ComposeHeader({
  title,
  eyebrow,
  backHref = "/today",
  dirty = false,
}: {
  title: string;
  eyebrow?: string;
  backHref?: string;
  dirty?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function close() {
    if (dirty && !window.confirm("离开后，未保存的内容会丢失。确定离开吗？")) return;
    router.push(backHref);
  }

  return (
    <header className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-line/70 bg-[color-mix(in_srgb,var(--paper)_86%,transparent)] px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
      <button type="button" className="icon-btn icon-btn-plain" onClick={close} aria-label="关闭">
        <X size={20} />
      </button>
      <div className="min-w-0 text-center">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="font-display truncate text-[20px] leading-tight">{title}</h1>
      </div>
      <div className="h-10 w-10" aria-hidden="true" />
    </header>
  );
}
