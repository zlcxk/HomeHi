"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="font-display mt-3 text-[32px] leading-tight">这一页暂时没打开。</h1>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
        内容不会丢失。可以重试一次；如果一直出现，请检查服务端日志和数据库是否正常。
      </p>
      <button type="button" className="btn btn-primary mt-6" onClick={reset}>
        <RotateCcw size={16} /> 重试
      </button>
    </div>
  );
}
