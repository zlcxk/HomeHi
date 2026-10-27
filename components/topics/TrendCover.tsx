"use client";

import { useState } from "react";
import { Flame } from "lucide-react";

export function TrendCover({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--accent-soft),var(--lime-soft))] text-accent/70">
        <Flame size={18} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
    />
  );
}
