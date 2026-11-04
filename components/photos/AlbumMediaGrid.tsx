"use client";

import { useState } from "react";
import Link from "next/link";
import { ImagePlus, Play, Star, X } from "lucide-react";
import type { MediaGridItem } from "@/lib/media-list";
import { SubmitButton } from "@/components/SubmitButton";
import {
  removeMediaFromAlbumAction,
  setAlbumCoverAction,
} from "@/app/actions/media";
import { MediaThumb } from "@/components/photos/MediaThumb";
import { useMediaPages } from "@/components/photos/useMediaPages";

export function AlbumMediaGrid({
  albumId,
  initialItems,
  initialCursor,
  coverMediaId,
}: {
  albumId: string;
  initialItems: MediaGridItem[];
  initialCursor: string | null;
  coverMediaId: string | null;
}) {
  const { items, cursor, loading, error, loadMore } = useMediaPages(
    initialItems,
    initialCursor,
    `albumId=${encodeURIComponent(albumId)}`,
  );
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [coverId, setCoverId] = useState(coverMediaId);

  const visible = items.filter((item) => !removed.has(item.id));

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
        <p className="text-[13.5px] font-medium">这个相册还空着</p>
        <p className="mt-1 text-[12px] text-muted">从照片墙里挑几张放进来。</p>
        <Link href={`/photos/albums/${albumId}/add`} className="btn btn-primary btn-sm mt-4">
          <ImagePlus size={14} /> 挑选照片
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-1.5">
        {visible.map((item) => (
          <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-raised">
            <Link href={`/photos/${item.id}`} className="block h-full w-full">
              <MediaThumb item={item} className="h-full w-full object-cover" />
            </Link>

            {item.mediaType === "VIDEO" ? (
              <span className="pointer-events-none absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
                <Play size={9} fill="currentColor" />
              </span>
            ) : null}

            {coverId === item.id ? (
              <span className="pointer-events-none absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-ink">
                <Star size={10} fill="currentColor" />
              </span>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/55 to-transparent p-1.5 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
              {coverId !== item.id ? (
                <form
                  action={setAlbumCoverAction}
                  onSubmit={() => setCoverId(item.id)}
                >
                  <input type="hidden" name="albumId" value={albumId} />
                  <input type="hidden" name="mediaId" value={item.id} />
                  <SubmitButton
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
                    pendingText=""
                  >
                    <Star size={11} />
                  </SubmitButton>
                </form>
              ) : null}
              <form
                action={removeMediaFromAlbumAction}
                onSubmit={() =>
                  setRemoved((prev) => new Set(prev).add(item.id))
                }
              >
                <input type="hidden" name="albumId" value={albumId} />
                <input type="hidden" name="mediaId" value={item.id} />
                <SubmitButton
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
                  pendingText=""
                >
                  <X size={11} />
                </SubmitButton>
              </form>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
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
        ) : null}
      </div>
    </div>
  );
}
