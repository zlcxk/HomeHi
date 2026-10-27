"use client";

import { useState } from "react";

export function Switch({
  name,
  defaultChecked = false,
  label,
  description,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
  description?: string;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {description ? <p className="mt-0.5 text-[11px] leading-relaxed text-faint">{description}</p> : null}
      </div>
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => setChecked((value) => !value)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked
            ? "bg-accent shadow-[inset_0_1px_1px_rgba(0,0,0,0.08)]"
            : "bg-line-strong/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.22)] transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
