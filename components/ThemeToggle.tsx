"use client";

import { useEffect, useState } from "react";
import { Check, Contrast, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";

type Palette = "warm" | "celadon" | "ink" | "peach" | "soda" | "night" | "lime";

type PaletteOption = {
  value: Palette;
  label: string;
  paper: string;
  accent: string;
  ink: string;
  tint: string;
};

const PALETTES: PaletteOption[] = [
  { value: "warm", label: "暖纸", paper: "#f7f1e7", accent: "#e75d31", ink: "#211d17", tint: "#a9c25e" },
  { value: "celadon", label: "青瓷", paper: "#eff4f1", accent: "#2f7d63", ink: "#18211c", tint: "#45a184" },
  { value: "ink", label: "墨白", paper: "#f2f2ef", accent: "#2a2b30", ink: "#17181a", tint: "#4a4b52" },
  { value: "peach", label: "蜜桃", paper: "#fdf3f4", accent: "#7059d6", ink: "#2b2028", tint: "#64b394" },
  { value: "soda", label: "汽水", paper: "#fdf7df", accent: "#6a4bf2", ink: "#22201a", tint: "#a9c81f" },
  { value: "night", label: "夜色", paper: "#f0f3f8", accent: "#2f6bff", ink: "#131820", tint: "#b7d92b" },
  { value: "lime", label: "青柠", paper: "#f3f4f1", accent: "#b9e334", ink: "#111310", tint: "#b9e334" },
];

const PALETTE_VALUES = new Set<string>(PALETTES.map((option) => option.value));

function applyTheme(theme: Theme) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.dataset.theme = resolved;
  if (theme === "system") localStorage.removeItem("homehi-theme");
  else localStorage.setItem("homehi-theme", theme);
}

function applyPalette(palette: Palette) {
  document.documentElement.dataset.palette = palette;
  if (palette === "warm") localStorage.removeItem("homehi-palette");
  else localStorage.setItem("homehi-palette", palette);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [palette, setPalette] = useState<Palette>("warm");

  useEffect(() => {
    const stored = localStorage.getItem("homehi-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
    const storedPalette = localStorage.getItem("homehi-palette");
    if (storedPalette && PALETTE_VALUES.has(storedPalette)) {
      setPalette(storedPalette as Palette);
      document.documentElement.dataset.palette = storedPalette;
    }
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  function choosePalette(next: Palette) {
    setPalette(next);
    applyPalette(next);
  }

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "浅色", icon: Sun },
    { value: "dark", label: "深色", icon: Moon },
    { value: "system", label: "跟随系统", icon: Contrast },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2.5 text-[12.5px] font-semibold text-muted">配色</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="配色主题">
          {PALETTES.map((option) => {
            const active = palette === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => choosePalette(option.value)}
                aria-pressed={active}
                className={`rounded-2xl border p-2 text-left transition active:scale-[0.985] ${
                  active
                    ? "border-ink bg-surface shadow-[0_12px_26px_-20px_rgba(20,18,16,0.55)]"
                    : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                <span
                  className="relative flex h-[54px] w-full overflow-hidden rounded-xl border"
                  style={{
                    backgroundColor: option.paper,
                    borderColor: `${option.ink}16`,
                  }}
                >
                  <span
                    className="absolute -left-4 -top-5 h-12 w-12 rounded-full"
                    style={{ backgroundColor: option.accent, opacity: 0.16 }}
                  />
                  <span
                    className="absolute -bottom-5 -right-3 h-14 w-14 rounded-full"
                    style={{ backgroundColor: option.tint, opacity: 0.26 }}
                  />
                  <span
                    className="absolute right-1.5 top-1.5 h-2.5 w-6 rounded-full"
                    style={{ backgroundColor: option.accent }}
                  />
                  <span className="relative mt-auto flex w-full items-end gap-1 p-1.5">
                    <span
                      className="h-5 w-5 rounded-full"
                      style={{ backgroundColor: option.accent }}
                    />
                    <span className="flex flex-col gap-1">
                      <span
                        className="h-1 w-8 rounded-full"
                        style={{ backgroundColor: option.ink, opacity: 0.72 }}
                      />
                      <span
                        className="h-1 w-5 rounded-full"
                        style={{ backgroundColor: option.ink, opacity: 0.24 }}
                      />
                    </span>
                    <span
                      className="ml-auto h-4 w-4 rounded-md"
                      style={{ backgroundColor: option.ink, opacity: 0.86 }}
                    />
                  </span>
                </span>
                <span className="mt-2 flex items-center justify-between px-0.5 text-[12px] font-medium">
                  <span className="flex items-center gap-1">
                    {option.label}
                    {option.value === "warm" ? (
                      <span className="rounded-full bg-raised px-1.5 py-0.5 text-[9px] font-normal text-faint">
                        默认
                      </span>
                    ) : null}
                  </span>
                  {active ? <Check size={12} strokeWidth={2.4} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-[12.5px] font-semibold text-muted">明暗</h3>
        <div
          className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-1"
          role="group"
          aria-label="明暗模式"
        >
          {options.map((option) => {
            const Icon = option.icon;
            const active = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => choose(option.value)}
                aria-pressed={active}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[12.5px] transition ${
                  active ? "bg-ink text-paper" : "text-muted hover:bg-raised"
                }`}
              >
                <Icon size={14} strokeWidth={1.8} />
                {option.label}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
