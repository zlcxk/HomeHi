"use client";

import { useEffect, useState } from "react";
import { Check, Contrast, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";
type Palette = "warm" | "celadon" | "ink";

const PALETTES: { value: Palette; label: string; colors: [string, string, string] }[] = [
  { value: "warm", label: "暖纸", colors: ["#f7f1e7", "#e75d31", "#211d17"] },
  { value: "celadon", label: "青瓷", colors: ["#eff4f1", "#2f7d63", "#18211c"] },
  { value: "ink", label: "墨白", colors: ["#f2f2ef", "#2a2b30", "#17181a"] },
];

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
    if (storedPalette === "celadon" || storedPalette === "ink") {
      setPalette(storedPalette);
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
    <div className="space-y-5">
      <section>
        <h3 className="mb-2.5 text-[12.5px] font-semibold text-muted">配色</h3>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="配色主题">
          {PALETTES.map((option) => {
            const active = palette === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => choosePalette(option.value)}
                aria-pressed={active}
                className={`rounded-2xl border p-2.5 text-left transition ${
                  active
                    ? "border-ink bg-surface shadow-[0_12px_26px_-20px_rgba(20,18,16,0.55)]"
                    : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                <span
                  className="flex h-11 w-full items-center gap-1.5 rounded-xl border px-2"
                  style={{ backgroundColor: option.colors[0], borderColor: `${option.colors[2]}1a` }}
                >
                  <span
                    className="h-5 w-5 rounded-full"
                    style={{ backgroundColor: option.colors[1] }}
                  />
                  <span
                    className="h-2 flex-1 rounded-full"
                    style={{ backgroundColor: option.colors[2], opacity: 0.14 }}
                  />
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
