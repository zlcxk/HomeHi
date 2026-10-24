"use client";

import { useState } from "react";
import { Lock, Users } from "lucide-react";

export function VisibilityControl({
  initial = "HOUSEHOLD",
  name = "visibility",
  compact = false,
  label = "谁能看到",
  onChange,
}: {
  initial?: string;
  name?: string;
  compact?: boolean;
  label?: string;
  onChange?: (value: "HOUSEHOLD" | "PRIVATE") => void;
}) {
  const [value, setValue] = useState<"HOUSEHOLD" | "PRIVATE">(
    initial === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD",
  );

  function choose(next: "HOUSEHOLD" | "PRIVATE") {
    setValue(next);
    onChange?.(next);
  }

  return (
    <div>
      {!compact ? (
        <div className="mb-2 flex items-center justify-between">
          <span className="label mb-0">{label}</span>
          <span className="text-[11px] text-faint">默认全家共享</span>
        </div>
      ) : null}
      <input type="hidden" name={name} value={value} />
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1">
        <button
          type="button"
          onClick={() => choose("HOUSEHOLD")}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12.5px] transition ${
            value === "HOUSEHOLD" ? "bg-ink text-paper" : "text-muted hover:bg-raised"
          }`}
          aria-pressed={value === "HOUSEHOLD"}
        >
          <Users size={14} strokeWidth={1.8} /> 全家可见
        </button>
        <button
          type="button"
          onClick={() => choose("PRIVATE")}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12.5px] transition ${
            value === "PRIVATE" ? "bg-ink text-paper" : "text-muted hover:bg-raised"
          }`}
          aria-pressed={value === "PRIVATE"}
        >
          <Lock size={13} strokeWidth={1.8} /> 仅自己
        </button>
      </div>
      <p className="field-hint">
        {value === "PRIVATE"
          ? "其他家庭成员看不到这条内容，其中的照片也不会出现在共享照片库。"
          : "家庭空间里的成员都可以看到。"}
      </p>
    </div>
  );
}
