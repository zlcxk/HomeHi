"use client";

import Link from "next/link";
import { Heart, Play } from "lucide-react";
import type { MediaGridItem, MediaListView } from "@/lib/media-list";
import { MediaThumb } from "@/components/photos/MediaThumb";
import { useMediaPages } from "@/components/photos/useMediaPages";

export function MediaGrid({
  initialItems,
  initialCursor,
  view,
  emptyTitle,
  emptyDescription,
}: {
  initialItems: MediaGridItem[];
  initialCursor: string | null;
  view: MediaListView;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const queryString = view === "all" ? "" : `view=${view}`;
  const { items, cursor, loading, error, loadMore } = useMediaPages(
    initialItems,
    initialCursor,
    queryString,
  );

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
        <p className="text-[13.5px] font-medium">{emptyTitle}</p>
        <p className="mt-1 text-[12px] text-muted">{emptyDescription}</p>
      </div>
    );
  }

  const groups: Array<{ label: string; items: MediaGridItem[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last?.label === item.groupLabel) last.items.push(item);
    else groups.push({ label: item.groupLabel, items: [item] });
  }

  return (
    <div className="space-y-7">
      {groups.map((group) => (
        <section key={group.label} className="[content-visibility:auto] [contain-intrinsic-size:auto_320px]">
          <h2 className="mb-2.5 flex items-baseline gap-2 text-[12px] font-semibold text-muted">
            {group.label}
            <span className="font-normal text-faint">{group.items.length}</span>
          </h2>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-1.5">
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={`/photos/${item.id}`}
                className="group relative aspect-square overflow-hidden rounded-xl bg-raised"
              >
                <MediaThumb
                  item={item}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                />
                {item.mediaType === "VIDEO" ? (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
                    <Play size={9} fill="currentColor" />
                  </span>
                ) : null}
                {item.favorite ? (
                  <span className="absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur">
                    <Heart size={9} fill="currentColor" />
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="pt-1 text-center">
        {error ? <p className="mb-2 text-[11.5px] text-danger">{error}</p> : null}
        {cursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="btn btn-outline btn-sm disabled:opacity-60"
          >
            {loading ? "加载中…" : "加载更多"}
          </button>
        ) : (
          <p className="text-[11px] text-faint">已经到底了</p>
        )}
      </div>
    </div>
  );
}
