"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { MediaUploader } from "@/components/MediaUploader";
import { VisibilityControl } from "@/components/pickers/VisibilityControl";

export function PhotoUploadScreen({ defaultVisibility }: { defaultVisibility: string }) {
  const router = useRouter();
  const [visibility, setVisibility] = useState(
    defaultVisibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD",
  );
  const [busy, setBusy] = useState(false);

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
            <h1 className="font-display mt-1 text-[30px] leading-none">上传照片</h1>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={() => router.push("/photos")}
        >
          <Check size={14} /> 完成
        </button>
      </header>

      <div className="mb-5">
        <VisibilityControl initial={visibility} onChange={setVisibility} />
      </div>

      <MediaUploader
        visibility={visibility}
        max={40}
        onBusyChange={setBusy}
        hint="可一次选择多张"
      />
    </div>
  );
}
