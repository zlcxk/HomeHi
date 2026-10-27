"use client";

import { useState } from "react";
import { BellOff, Mail } from "lucide-react";
import { REMINDER_OPTIONS } from "@/lib/constants";

export function ReminderPicker({
  initial = [],
  name = "reminderOffsets",
  smtpConfigured,
}: {
  initial?: number[];
  name?: string;
  smtpConfigured: boolean;
}) {
  const [selected, setSelected] = useState<number[]>(initial);

  function toggle(value: number) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value].sort((a, b) => b - a),
    );
  }

  return (
    <div>
      <span className="label">邮件提醒</span>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSelected([])}
          className={`chip ${selected.length === 0 ? "chip-active" : ""}`}
        >
          <BellOff size={12} /> 不提醒
        </button>
        {REMINDER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => toggle(option.value)}
            className={`chip ${selected.includes(option.value) ? "chip-active" : ""}`}
            aria-pressed={selected.includes(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!smtpConfigured ? (
        <p className="field-hint flex items-start gap-1.5">
          <Mail size={12} className="mt-0.5 shrink-0" />
          邮件未配置，提醒暂时发不出去。可在「设置 → 邮件」中开启。
        </p>
      ) : null}
    </div>
  );
}
