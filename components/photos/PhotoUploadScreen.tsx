"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import {
  finishPhotoUploadAction,
  revalidatePhotosAction,
} from "@/app/actions/media";
import { MediaUploader } from "@/components/MediaUploader";
import { SubmitButton } from "@/components/SubmitButton";
import { VisibilityControl } from "@/components/pickers/VisibilityControl";

export function PhotoUploadScreen({ defaultVisibility }: { defaultVisibility: string }) {
  const router = useRouter();
  const [visibility, setVisibility] = useState(
    defaultVisibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD",
  );
  const [busy, setBusy] = useState(false);
  const hadUploads = useRef(false);

  // 上传接口无法清除浏览器里的路由缓存；全部上传结束后主动走一次
  // Server Action，让返回照片页（包括点击导航栏）时拿到最新列表。
  useEffect(() => {
    if (busy) {
      hadUploads.current = true;
      return;
    }
    if (!hadUploads.current) return;
    hadUploads.current = false;
    void revalidatePhotosAction().catch(() => undefined);
  }, [busy]);

  return (
    <div>
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="icon-btn icon-btn-plain -ml-2"
            aria-label="返回"
          >
            <ArrowLeft size={19} strokeWidth={1.8} />
          </button>
          <div>
            <p className="eyebrow">Upload</p>
            <h1 className="font-display mt-1 text-[30px] leading-none">上传照片和视频</h1>
          </div>
        </div>
        <form action={finishPhotoUploadAction}>
          <SubmitButton
            className="btn btn-primary btn-sm"
            disabled={busy}
            pendingText="…"
          >
            <Check size={14} /> 完成
          </SubmitButton>
        </form>
      </header>

      <div className="mb-5">
        <VisibilityControl initial={visibility} onChange={setVisibility} />
      </div>

      <MediaUploader
        visibility={visibility}
        max={40}
        onBusyChange={setBusy}
      />
    </div>
  );
}
