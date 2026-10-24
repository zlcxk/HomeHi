"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import { EntryCard } from "@/components/entries/EntryCard";
import { EmptyState } from "@/components/EmptyState";
import type { EntryCardData } from "@/lib/entries-view";

type FeedProps = {
  initialEntries: EntryCardData[];
  initialCursor: string | null;
  timezone: string;
  tag?: string;
  type?: string;
  profile?: string;
  q?: string;
};

export function TimelineFeed({
  initialEntries,
  initialCursor,
  timezone,
  tag,
  type,
  profile,
  q,
}: FeedProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEntries(initialEntries);
    setCursor(initialCursor);
  }, [initialEntries, initialCursor]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ cursor });
      if (tag) params.set("tag", tag);
      if (type) params.set("type", type);
      if (profile) params.set("profile", profile);
      if (q) params.set("q", q);
      const response = await fetch(`/api/entries?${params.toString()}`);
      if (!response.ok) throw new Error("加载失败");
      const data = (await response.json()) as {
        entries: EntryCardData[];
        nextCursor: string | null;
      };
      setEntries((prev) => {
        const seen = new Set(prev.map((entry) => entry.id));
        return [...prev, ...data.entries.filter((entry) => !seen.has(entry.id))];
      });
      setCursor(data.nextCursor);
    } catch {
      setError("没能加载更多，稍后再试。");
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, tag, type, profile, q]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver(
      (items) => {
        if (items[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<PenLine strokeWidth={1.7} />}
        title="这里还空着"
        description="先记下一个瞬间，或者写几句今天发生的事。日子会慢慢攒起来。"
      />
    );
  }

  return (
    <div>
      <div className="space-y-4">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} timezone={timezone} />
        ))}
      </div>

      <div ref={sentinel} className="flex flex-col items-center justify-center py-10">
        {loading ? (
          <span className="inline-flex items-center gap-2 text-[12px] text-faint">
            <Loader2 size={14} className="animate-spin" /> 正在翻更早的日子
          </span>
        ) : cursor ? (
          <button type="button" onClick={() => void loadMore()} className="btn btn-outline btn-sm">
            加载更早
          </button>
        ) : (
          <p className="text-[11.5px] text-faint">已经回到最早的一天</p>
        )}
        {error ? (
          <button type="button" onClick={() => void loadMore()} className="mt-2 text-[11.5px] text-danger">
            {error} 重试
          </button>
        ) : null}
      </div>
    </div>
  );
}
