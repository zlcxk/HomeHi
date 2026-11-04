"use client";

import { useState } from "react";
import { Film, Images } from "lucide-react";
import type { MediaGridItem } from "@/lib/media-list";

/** 列表统一走缩略图；加载失败时显示占位，不触发原图请求。 */
export function MediaThumb({
  item,
  className = "",
}: {
  item: MediaGridItem;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!item.thumbUrl || failed) {
    return (
      <span className="flex h-full w-full items-center justify-center text-faint">
        {item.mediaType === "VIDEO" ? <Film size={18} /> : <Images size={18} />}
      </span>
    );
  }
  return (
    <img
      src={item.thumbUrl}
      alt={item.caption || ""}
      loading="lazy"
      decoding="async"
      width={480}
      height={480}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
