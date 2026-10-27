"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronRight, Loader2, MapPin } from "lucide-react";
import type { LocationSuggestion } from "@/lib/amap";

export function LocationField({
  defaultValue = "",
  suggestions = [],
  label = "地点",
  placeholder = "搜索地点，或直接输入",
  name = "location",
}: {
  defaultValue?: string;
  suggestions?: string[];
  label?: string;
  placeholder?: string;
  name?: string;
}) {
  const id = useId();
  const listId = `${id}-results`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [active, setActive] = useState(-1);

  const hints = suggestions.filter((place) => place !== value).slice(0, 4);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/geo/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as {
          configured?: boolean;
          results?: LocationSuggestion[];
        };
        if (controller.signal.aborted) return;
        setConfigured(data.configured !== false);
        setResults(Array.isArray(data.results) ? data.results : []);
        setActive(-1);
        setOpen(data.configured !== false);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function pick(suggestion: LocationSuggestion) {
    setValue(suggestion.name);
    setQuery("");
    setResults([]);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div ref={wrapperRef}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <MapPin
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          id={id}
          name={name}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setQuery(event.target.value);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (!open || results.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => (index + 1) % results.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => (index <= 0 ? results.length - 1 : index - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              pick(results[active >= 0 ? active : 0]);
            }
          }}
          placeholder={placeholder}
          maxLength={200}
          className="field pl-9 pr-9"
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {loading ? (
          <Loader2
            size={15}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-faint"
          />
        ) : null}
      </div>

      {open && configured ? (
        <div
          id={listId}
          role="listbox"
          className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_40px_-30px_rgba(40,30,18,0.45)]"
        >
          {results.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(item)}
              className={`flex w-full items-center gap-2.5 border-b border-line px-3.5 py-2.5 text-left transition last:border-b-0 ${
                index === active ? "bg-raised" : "hover:bg-raised/70"
              }`}
            >
              <MapPin size={13} className="mt-0.5 shrink-0 self-start text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{item.name}</span>
                {item.fullAddress && item.fullAddress !== item.name ? (
                  <span className="mt-0.5 block truncate text-[10.5px] text-faint">
                    {item.fullAddress}
                  </span>
                ) : null}
              </span>
              <ChevronRight size={14} className="shrink-0 text-faint" />
            </button>
          ))}
        </div>
      ) : null}

      {!open && hints.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hints.map((place) => (
            <button key={place} type="button" onClick={() => setValue(place)} className="chip">
              {place}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
