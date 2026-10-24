"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export function TagPicker({
  options,
  initial = [],
  name = "tags",
}: {
  options: string[];
  initial?: string[];
  name?: string;
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [all, setAll] = useState<string[]>(options);
  const [draft, setDraft] = useState("");

  function toggle(tag: string) {
    setSelected((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  }

  function addTag() {
    const value = draft.trim().replace(/^#/, "");
    if (!value) return;
    if (!all.includes(value)) setAll((prev) => [...prev, value]);
    if (!selected.includes(value)) setSelected((prev) => [...prev, value]);
    setDraft("");
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">标签</span>
        <span className="text-[11px] text-faint">可选</span>
      </div>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />

      <div className="flex flex-wrap items-center gap-1.5">
        {all.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`chip ${active ? "chip-active" : ""}`}
              aria-pressed={active}
            >
              #{tag}
            </button>
          );
        })}
        <div className="inline-flex h-[34px] items-center gap-1 rounded-full border border-line bg-surface pl-3 pr-1">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "," || event.key === "，") {
                event.preventDefault();
                addTag();
              }
            }}
            placeholder="新标签"
            maxLength={30}
            className="w-[76px] bg-transparent text-[12.5px] outline-none placeholder:text-faint"
            aria-label="新建标签"
          />
          <button
            type="button"
            onClick={addTag}
            className="flex h-6 w-6 items-center justify-center rounded-full text-faint transition hover:bg-raised hover:text-ink"
            aria-label="添加标签"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] text-faint">已选：</span>
          {selected.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className="inline-flex items-center gap-0.5 rounded-full bg-raised px-2 py-0.5 text-[10.5px] text-muted"
            >
              #{tag} <X size={9} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
