"use client";

import { useState } from "react";
import Link from "next/link";
import { Boxes, Car, FileText, Laptop, Plus, Sofa, Wrench, Refrigerator } from "lucide-react";
import { assetCategoryLabel } from "@/lib/assets";
import type { AssetOption } from "@/lib/view";

const ICONS: Record<string, typeof Boxes> = {
  APPLIANCE: Refrigerator,
  ELECTRONICS: Laptop,
  FURNITURE: Sofa,
  VEHICLE: Car,
  TOOL: Wrench,
  DOCUMENT: FileText,
  OTHER: Boxes,
};

export function AssetPicker({
  options,
  initialIds = [],
  name = "relatedAssetIds",
  label = "关联物品",
}: {
  options: AssetOption[];
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
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />

      {options.length === 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-line-strong px-3.5 py-3">
          <p className="text-[12px] text-faint">还没有登记物品</p>
          <Link href="/assets/new" className="btn btn-outline btn-sm">
            <Plus size={13} /> 添加
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = selected.includes(option.id);
            const Icon = ICONS[option.category] || Boxes;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggle(option.id)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-full border py-1 pl-2 pr-3 text-[12.5px] transition ${
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
                }`}
              >
                {option.photoUrl ? (
                  <img
                    src={option.photoUrl}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      active ? "bg-white/15" : "bg-raised"
                    }`}
                  >
                    <Icon size={12.5} strokeWidth={1.8} />
                  </span>
                )}
                {option.name}
                <span className={`text-[9.5px] ${active ? "text-paper/60" : "text-faint"}`}>
                  {assetCategoryLabel(option.category)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
