"use client";

import { useEffect, useState } from "react";
import { Contrast, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";

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

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem("homehi-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "浅色", icon: Sun },
    { value: "dark", label: "深色", icon: Moon },
    { value: "system", label: "跟随系统", icon: Contrast },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-1" role="group" aria-label="外观主题">
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
  );
}
