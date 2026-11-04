"use client";

import { useCallback, useState } from "react";
import {
  appendUniqueMedia,
  type MediaGridItem,
  type MediaListResponse,
} from "@/lib/media-list";

/**
 * 游标追加分页。按 id 去重，保证分页边界或并发上传不会插入重复卡片。
 * 只有用户主动点“加载更多”才会追加，避免无上限地增长 DOM。
 */
export function useMediaPages(
  initialItems: MediaGridItem[],
  initialCursor: string | null,
  queryString: string,
) {
  const [items, setItems] = useState<MediaGridItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(queryString);
      params.set("cursor", cursor);
      const response = await fetch(`/api/media/list?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page = (await response.json()) as MediaListResponse;
      setItems((prev) => appendUniqueMedia(prev, page.items));
      setCursor(page.nextCursor);
    } catch {
      setError("加载失败，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, queryString]);

  return { items, cursor, loading, error, loadMore };
}
