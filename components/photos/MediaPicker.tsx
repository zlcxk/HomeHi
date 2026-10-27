"use client";

import { useState } from "react";
import { Check, Play } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";

export type PickerItem = {
  id: string;
  mediaType: string;
  thumbUrl: string | null;
  caption: string | null;
};

export function MediaPicker({
  items,
  action,
  hidden,
  label = "放入相册",
}: {
  items: PickerItem[];
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  label?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  return (
    <form action={action}>
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <input type="hidden" name="mediaIds" value={JSON.stringify(selected)} />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
          <p className="text-[13.5px] font-medium">没有可添加的内容</p>
          <p className="mt-1 text-[12px] text-muted">先记录一些照片或视频，再回来放进相册。</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
          {items.map((item) => {
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
              >
                {item.thumbUrl ? (
                  <img
                    src={item.thumbUrl}
                    alt={item.caption || ""}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-faint">
                    <Play size={18} />
                  </span>
                )}
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
      )}

      <div className="glassbar sticky bottom-0 z-20 -mx-4 mt-5 border-t border-line px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-faint">已选 {selected.length} 张</span>
          <SubmitButton className="btn btn-primary btn-sm" disabled={selected.length === 0}>
            {label}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
