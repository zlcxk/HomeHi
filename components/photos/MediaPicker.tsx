"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { MAX_ALBUM_MEDIA_BATCH } from "@/lib/media-dedupe";
import type { MediaGridItem } from "@/lib/media-list";
import type { ActionState } from "@/lib/validation";
import { SubmitButton } from "@/components/SubmitButton";
import { MediaThumb } from "@/components/photos/MediaThumb";
import { useMediaPages } from "@/components/photos/useMediaPages";

export function MediaPicker({
  albumId,
  initialItems,
  initialCursor,
  action,
  label = "放入相册",
}: {
  albumId: string;
  initialItems: MediaGridItem[];
  initialCursor: string | null;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label?: string;
}) {
  const { items, cursor, loading, error, loadMore } = useMediaPages(
    initialItems,
    initialCursor,
    `albumId=${encodeURIComponent(albumId)}&mode=picker`,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, formAction] = useActionState(action, {});

  function toggle(id: string) {
    setNotice(null);
    if (!selected.includes(id) && selected.length >= MAX_ALBUM_MEDIA_BATCH) {
      setNotice(`一次最多选择 ${MAX_ALBUM_MEDIA_BATCH} 张，请先放入相册后再继续添加`);
      return;
    }
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  const groups: Array<{ label: string; items: MediaGridItem[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last?.label === item.groupLabel) last.items.push(item);
    else groups.push({ label: item.groupLabel, items: [item] });
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="albumId" value={albumId} />
      <input type="hidden" name="mediaIds" value={JSON.stringify(selected)} />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
          <p className="text-[13.5px] font-medium">没有可添加的内容</p>
          <p className="mt-1 text-[12px] text-muted">先记录一些照片或视频，再回来放进相册。</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 text-[11.5px] font-semibold text-muted">{group.label}</h2>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
                {group.items.map((item) => {
                  const active = selected.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={`group relative aspect-square overflow-hidden rounded-xl bg-raised transition ${
                        active ? "ring-2 ring-accent ring-offset-2 ring-offset-paper" : ""
                      }`}
                      aria-pressed={active}
                      aria-label={item.caption || (item.mediaType === "VIDEO" ? "视频" : "照片")}
                    >
                      <MediaThumb item={item} className="h-full w-full object-cover" />
                      <span
                        className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full transition ${
                          active
                            ? "bg-accent text-accent-ink"
                            : "border border-white/70 bg-black/25 text-transparent backdrop-blur"
                        }`}
                      >
                        <Check size={11} strokeWidth={3} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-4 text-center">
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

      <div className="glassbar sticky bottom-[var(--bottom-dock)] z-20 -mx-4 mt-5 border-t border-line px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        {state.error || notice ? (
          <p className="mb-2 text-[11.5px] text-danger">{state.error || notice}</p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-faint">
            已选 {selected.length} / {MAX_ALBUM_MEDIA_BATCH}
          </span>
          <SubmitButton className="btn btn-primary btn-sm" disabled={selected.length === 0}>
            {label}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
