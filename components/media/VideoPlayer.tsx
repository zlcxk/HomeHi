"use client";

import { useState } from "react";
import { Play } from "lucide-react";

type VideoPlayerProps = {
  src: string;
  poster?: string | null;
  originalSrc?: string | null;
  className?: string;
  videoClassName?: string;
};

/**
 * 默认只显示封面，用户点击后才挂载 video 元素。
 * 这样列表和详情首屏不会为了一个没点开的视频下载完整文件。
 */
export function VideoPlayer({
  src,
  poster,
  originalSrc,
  className = "",
  videoClassName = "",
}: VideoPlayerProps) {
  const [active, setActive] = useState(false);

  if (active) {
    return (
      <div className={`relative overflow-hidden rounded-[22px] bg-black ${className}`}>
        <video
          controls
          autoPlay
          playsInline
          preload="metadata"
          poster={poster || undefined}
          className={videoClassName}
          src={src}
        />
        {originalSrc && originalSrc !== src ? (
          <a
            href={originalSrc}
            target="_blank"
            rel="noreferrer"
            className="absolute right-2.5 top-2.5 rounded-full bg-black/50 px-3 py-1.5 text-[10px] text-white backdrop-blur transition hover:bg-black/70"
          >
            原视频
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      className={`group relative block w-full overflow-hidden rounded-[22px] bg-black text-left ${className}`}
      aria-label="播放视频"
    >
      {poster ? (
        <img
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
          className={`w-full object-contain ${videoClassName}`}
        />
      ) : (
        <div className={`aspect-video w-full bg-[radial-gradient(circle_at_30%_20%,#34302a,#111_65%)] ${videoClassName}`} />
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] backdrop-blur transition duration-300 group-hover:scale-105 group-hover:bg-black/60">
          <Play size={20} fill="currentColor" className="ml-0.5" />
        </span>
      </span>
    </button>
  );
}
