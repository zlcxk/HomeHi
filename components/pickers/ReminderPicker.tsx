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
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">邮件提醒</span>
        <span className="text-[11px] text-faint">可多选 · 可选</span>
      </div>
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
      <p className="field-hint flex items-start gap-1.5">
        <Mail size={12} className="mt-0.5 shrink-0" />
        {smtpConfigured
          ? "提醒会通过邮件发送给已开启通知的家庭成员。全天事项默认在当地上午 9 点提醒。"
          : "SMTP 尚未配置，提醒会先记录但无法发出。可在「设置 → 邮件」中完成配置。"}
      </p>
    </div>
  );
}
