"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

/** 手机上左右滑动切换月份，不影响纵向滚动。 */
export function CalendarSwipe({
  prevHref,
  nextHref,
  children,
}: {
  prevHref: string;
  nextHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      onTouchStart={(event) => {
        const touch = event.touches[0];
        start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
      }}
      onTouchEnd={(event) => {
        const origin = start.current;
        const touch = event.changedTouches[0];
        start.current = null;
        if (!origin || !touch) return;
        const dx = touch.clientX - origin.x;
        const dy = touch.clientY - origin.y;
        if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
        router.push(dx > 0 ? prevHref : nextHref);
      }}
    >
      {children}
    </div>
  );
}
