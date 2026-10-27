"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";

/**
 * 任意页面在顶部继续下拉，露出搜索入口。
 * 手机上比翻到固定搜索页快，也不会占用底部导航。
 */
export function PullToSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pull, setPull] = useState(0);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const distance = useRef(0);

  useEffect(() => {
    function reset() {
      startY.current = null;
      pulling.current = false;
      distance.current = 0;
      setPull(0);
    }

    function onStart(event: TouchEvent) {
      if (open || event.touches.length !== 1) return;
      if (window.scrollY > 0) return;
      startY.current = event.touches[0].clientY;
      pulling.current = true;
    }

    function onMove(event: TouchEvent) {
      if (!pulling.current || startY.current === null) return;
      if (window.scrollY > 0) {
        reset();
        return;
      }
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0) {
        distance.current = 0;
        setPull(0);
        return;
      }
      const next = Math.min(92, delta * 0.5);
      distance.current = next;
      setPull(next);
      if (next > 4 && event.cancelable) event.preventDefault();
    }

    function onEnd() {
      if (!pulling.current) return;
      const shouldOpen = distance.current >= 54;
      reset();
      if (shouldOpen) setOpen(true);
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setOpen(false);
    setQuery("");
    router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-center pt-[max(8px,env(safe-area-inset-top))] transition-opacity"
        style={{
          opacity: pull > 0 ? Math.min(1, pull / 44) : 0,
          transform: `translateY(${Math.min(0, pull - 46)}px)`,
        }}
        aria-hidden="true"
      >
        <span className="glassbar inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11.5px] text-muted">
          <Search size={13} /> 继续下拉搜索
        </span>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[rgba(20,16,11,0.38)] backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-label="搜索">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setOpen(false)}
            aria-label="关闭搜索"
          />
          <div className="animate-sheet relative mt-[max(54px,env(safe-area-inset-top))] px-3">
            <form onSubmit={submit} className="glassbar mx-auto flex max-w-[560px] items-center gap-2 rounded-full p-1.5 pl-4">
              <Search size={16} className="shrink-0 text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜记录、照片、日程、家人或物品"
                maxLength={80}
                className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base outline-none placeholder:text-faint sm:text-[14px]"
                aria-label="搜索关键词"
              />
              <button type="submit" className="btn btn-primary btn-sm px-3" aria-label="开始搜索">
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="icon-btn icon-btn-plain h-9 w-9"
                aria-label="关闭"
              >
                <X size={15} />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
