"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { RECURRENCE_OPTIONS } from "@/lib/constants";

export function RecurrencePicker({
  initialType = "NONE",
  initialInterval = 1,
  initialUntil = "",
  label = "重复",
}: {
  initialType?: string;
  initialInterval?: number;
  initialUntil?: string;
  label?: string;
}) {
  const [type, setType] = useState(initialType || "NONE");
  const [interval, setIntervalValue] = useState(initialInterval || 1);

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name="recurrenceType" value={type} />
      <input type="hidden" name="recurrenceInterval" value={interval} />

      <div className="flex flex-wrap gap-1.5">
        {RECURRENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setType(option.value)}
            className={`chip ${type === option.value ? "chip-active" : ""}`}
            aria-pressed={type === option.value}
          >
            {option.value === "NONE" ? null : <Repeat size={11} />}
            {option.label}
          </button>
        ))}
      </div>

      {type !== "NONE" ? (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div>
            <label className="label" htmlFor="recurrence-interval">
              间隔
            </label>
            <div className="flex items-center gap-2">
              <input
                id="recurrence-interval"
                type="number"
                min={1}
                max={99}
                value={interval}
                onChange={(event) => setIntervalValue(Math.max(1, Number(event.target.value) || 1))}
                className="field tabular w-[86px]"
              />
              <span className="text-[12px] text-muted">
                每 {interval > 1 ? `${interval} ` : ""}
                {{ DAILY: "天", WEEKLY: "周", MONTHLY: "个月", YEARLY: "年" }[type]}一次
              </span>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="recurrence-until">
              结束于
            </label>
            <input
              id="recurrence-until"
              name="recurrenceUntil"
              type="date"
              defaultValue={initialUntil}
              className="field"
            />
          </div>
        </div>
      ) : (
        <input type="hidden" name="recurrenceUntil" value="" />
      )}
    </div>
  );
}
