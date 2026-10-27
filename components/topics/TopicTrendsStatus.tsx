"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { refreshTopicTrendsAction } from "@/app/actions/topics";

export function TopicTrendsStatus({
  topicId,
  configured,
  hasFetched,
}: {
  topicId: string;
  configured: boolean;
  hasFetched: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const fired = useRef(false);

  function run() {
    startTransition(async () => {
      const result = await refreshTopicTrendsAction(topicId);
      if (!result.configured) {
        setMessage("热门内容服务还没有接入");
        return;
      }
      if (result.ok) {
        setMessage(result.count > 0 ? `已更新 ${result.count} 条` : "暂时没有找到内容");
      } else {
        setMessage(result.error || "暂时没有拿到热门内容");
      }
      router.refresh();
    });
  }

  useEffect(() => {
    if (!configured || hasFetched || fired.current) return;
    fired.current = true;
    run();
    // 只在首次进入且尚未抓取时自动执行一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, hasFetched]);

  if (!configured) {
    return <span className="text-[10.5px] text-faint">未接入内容服务</span>;
  }

  return (
    <span className="flex items-center gap-2">
      {message ? <span className="text-[10.5px] text-faint">{message}</span> : null}
      {pending ? (
        <span className="inline-flex items-center gap-1 text-[10.5px] text-accent">
          <Loader2 size={12} className="animate-spin" /> 收集热门内容
        </span>
      ) : (
        <button type="button" onClick={run} className="chip h-7 px-2.5 text-[10.5px]">
          <RefreshCw size={11} /> 刷新
        </button>
      )}
    </span>
  );
}
