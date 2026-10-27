"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip } from "lucide-react";

export function TopicAttachmentUploader({ topicId }: { topicId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function upload(file: File) {
    setPending(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("topicId", topicId);
      formData.set("file", file);
      const response = await fetch("/api/topic-attachments", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage({ type: "error", text: payload.error || "上传失败，请稍后再试" });
        return;
      }
      setMessage({ type: "success", text: "文件已经保存" });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "网络中断，文件没有传上去" });
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium">保存文件</p>
          <p className="mt-0.5 text-[10.5px] text-faint">合同、报价单、照片都可以放在这里</p>
        </div>
        <label
          className={`btn btn-outline btn-sm cursor-pointer ${pending ? "pointer-events-none opacity-60" : ""}`}
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
          {pending ? "上传中…" : "选择文件"}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
      </div>
      {message ? (
        <p
          role="status"
          className={`mt-2 text-[10.5px] ${message.type === "error" ? "text-danger" : "text-sage"}`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
