"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/Avatar";

export type ProfileOption = {
  id: string;
  name: string;
  profileType: string;
  avatarUrl?: string | null;
};

export function ProfilePicker({
  options,
  initialIds = [],
  name = "profileIds",
  label = "和谁一起",
}: {
  options: ProfileOption[];
  initialIds?: string[];
  name?: string;
  label?: string;
}) {
  const [selected, setSelected] = useState<string[]>(initialIds);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">{label}</span>
        <span className="text-[11px] text-faint">可选</span>
      </div>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />

      {options.length === 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-line-strong px-3.5 py-3">
          <p className="text-[12px] text-faint">还没有家人或宠物档案</p>
          <Link href="/profiles" className="btn btn-outline btn-sm">
            <Plus size={13} /> 添加
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggle(option.id)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[12.5px] transition ${
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
                }`}
              >
                <Avatar
                  name={option.name}
                  src={option.avatarUrl}
                  size={24}
                  className={active ? "ring-1 ring-white/25" : ""}
                />
                {option.name}
                {option.profileType === "PET" ? (
                  <span className={`text-[9.5px] ${active ? "text-paper/60" : "text-faint"}`}>宠物</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
