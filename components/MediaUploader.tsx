"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  ImagePlus,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Star,
  X,
} from "lucide-react";
import { durationLabel } from "@/lib/format";

export type MediaItem = {
  id: string;
  mediaType: string;
  thumbUrl?: string | null;
  url: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
};

type UploadItem = {
  key: string;
  file?: File;
  previewUrl?: string;
  posterUrl?: string;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
  media?: MediaItem;
};

async function extractVideoInfo(file: File): Promise<{
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  poster?: Blob;
}> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    let settled = false;
    let timer = 0;

    const finish = (result: {
      width: number | null;
      height: number | null;
      durationSeconds: number | null;
      poster?: Blob;
    }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(result);
    };

    timer = window.setTimeout(() => {
      finish({
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
      });
    }, 5000);

    video.onloadedmetadata = () => {
      try {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        // 跳过开头和结尾各 15%，在中间随机取一帧作为封面。
        const start = duration > 2 ? duration * 0.15 : 0.01;
        const end = duration > 2 ? duration * 0.85 : Math.max(start, duration - 0.05);
        video.currentTime = start + Math.random() * Math.max(0, end - start);
      } catch {
        finish({
          width: video.videoWidth || null,
          height: video.videoHeight || null,
          durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
        });
      }
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) throw new Error("no frame");
        const scale = Math.min(1, 1280 / w);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no ctx");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            finish({
              width: w,
              height: h,
              durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
              poster: blob || undefined,
            });
          },
          "image/jpeg",
          0.82,
        );
      } catch {
        finish({
          width: video.videoWidth || null,
          height: video.videoHeight || null,
          durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
        });
      }
    };

    video.onerror = () =>
      finish({
        width: null,
        height: null,
        durationSeconds: null,
      });
  });
}

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
};

/** 有些手机浏览器上传时 file.type 是空的，按扩展名补一个。 */
function uploadMime(file: File): string {
  const type = (file.type || "").toLowerCase();
  if (type && type !== "application/octet-stream") {
    return type === "image/jpg" ? "image/jpeg" : type;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return EXT_MIME[ext] || type;
}

function uploadWithProgress(
  payload: FormData,
  onProgress: (percent: number) => void,
): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300 && data.media) resolve(data.media as MediaItem);
        else reject(new Error(data.error || `上传失败（${xhr.status}）`));
      } catch {
        reject(new Error(`上传失败（${xhr.status}）`));
      }
    };
    xhr.onerror = () => reject(new Error("网络中断，请重试"));
    xhr.ontimeout = () => reject(new Error("上传超时，请重试"));
    xhr.timeout = 1000 * 60 * 30;
    xhr.send(payload);
  });
}

export function MediaUploader({
  initial = [],
  visibility,
  max = 30,
  single = false,
  fieldName = "mediaIds",
  compact = false,
  label,
  hint,
  onBusyChange,
}: {
  initial?: MediaItem[];
  visibility: string;
  max?: number;
  single?: boolean;
  fieldName?: string;
  compact?: boolean;
  label?: string;
  hint?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>(() =>
    initial.map((media) => ({
      key: media.id,
      previewUrl: media.thumbUrl || media.url,
      status: "done" as const,
      progress: 100,
      media,
    })),
  );
  const [reorder, setReorder] = useState(false);
  const [dragging, setDragging] = useState(false);
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    };
  }, []);

  const uploading = items.some((item) => item.status === "uploading");
  useEffect(() => {
    onBusyChange?.(uploading);
  }, [uploading, onBusyChange]);

  const doneItems = items.filter((item) => item.status === "done" && item.media);
  const hiddenValue = single
    ? doneItems[0]?.media?.id || ""
    : JSON.stringify(doneItems.map((item) => item.media!.id));
  // 单图模式允许直接替换：已有照片时按钮仍然可用，新文件会顶掉旧选择。
  const atLimit = !single && items.length >= max;

  function trackObjectUrl(url: string) {
    objectUrls.current.add(url);
    return url;
  }

  function updateItem(key: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function processFile(file: File, key: string) {
    updateItem(key, { status: "uploading", progress: 0, error: undefined });
    let info: Awaited<ReturnType<typeof extractVideoInfo>> = {
      width: null,
      height: null,
      durationSeconds: null,
    };
    if (uploadMime(file).startsWith("video/")) {
      info = await extractVideoInfo(file);
      if (info.poster) {
        const posterUrl = trackObjectUrl(URL.createObjectURL(info.poster));
        updateItem(key, { posterUrl });
      }
    }

    const payload = new FormData();
    payload.append("file", file);
    if (info.poster) payload.append("poster", info.poster, "poster.jpg");
    payload.append("visibility", visibility);
    if (info.width) payload.append("clientWidth", String(info.width));
    if (info.height) payload.append("clientHeight", String(info.height));
    if (info.durationSeconds) payload.append("durationSeconds", String(info.durationSeconds));
    if (file.lastModified) payload.append("clientTakenAt", new Date(file.lastModified).toISOString());

    try {
      const media = await uploadWithProgress(payload, (percent) => updateItem(key, { progress: percent }));
      updateItem(key, { status: "done", progress: 100, media });
    } catch (error) {
      updateItem(key, {
        status: "error",
        error: error instanceof Error ? error.message : "上传失败",
      });
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    if (single) setItems([]);
    const remaining = single ? 1 : Math.max(0, max - items.length);
    const files = Array.from(fileList).slice(0, remaining);
    for (const file of files) {
      const type = uploadMime(file);
      if (!type.startsWith("image/") && !type.startsWith("video/")) continue;
      if (single && !type.startsWith("image/")) continue;
      if (file.size > 100 * 1024 * 1024) {
        const key = crypto.randomUUID();
        setItems((prev) => [
          ...prev,
          { key, status: "error", progress: 0, error: "文件超过 100 MB" },
        ]);
        continue;
      }
      const key = crypto.randomUUID();
      const previewUrl = type.startsWith("image/")
        ? trackObjectUrl(URL.createObjectURL(file))
        : undefined;
      setItems((prev) => [
        ...prev,
        { key, file, previewUrl, status: "uploading", progress: 0 },
      ]);
      void processFile(file, key);
    }
    if (libraryRef.current) libraryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  async function removeItem(item: UploadItem) {
    setItems((prev) => prev.filter((entry) => entry.key !== item.key));
    if (item.media?.id) {
      try {
        await fetch(`/api/media/${item.media.id}`, { method: "DELETE" });
      } catch {
        // The media may still be referenced elsewhere; a failed cleanup is harmless.
      }
    }
  }

  function move(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function makeCover(index: number) {
    setItems((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.unshift(item);
      return next;
    });
  }

  const uploadButtons = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => cameraRef.current?.click()}
        disabled={atLimit}
      >
        <Camera size={15} /> 拍照
      </button>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => libraryRef.current?.click()}
        disabled={atLimit}
      >
        <ImagePlus size={15} /> 从相册选择
      </button>
    </div>
  );

  return (
    <div>
      {label ? <span className="label">{label}</span> : null}
      <input
        ref={libraryRef}
        type="file"
        accept={single ? "image/*" : "image/*,video/*"}
        multiple={!single}
        className="sr-only"
        onChange={(event) => addFiles(event.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => addFiles(event.target.files)}
      />
      <input type="hidden" name={fieldName} value={hiddenValue} />

      {items.length === 0 ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center rounded-[22px] border border-dashed px-5 py-9 text-center transition ${
            dragging ? "border-accent bg-accent-soft/40" : "border-line-strong bg-surface"
          }`}
          style={compact ? { paddingTop: "1.5rem", paddingBottom: "1.5rem" } : undefined}
        >
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-raised text-muted">
            <ImagePlus size={19} strokeWidth={1.7} />
          </div>
          <p className="text-[13.5px] font-medium">
            {single ? "选择一张照片" : "添加照片或视频"}
          </p>
          {hint ? (
            <p className="mt-1 mb-4 text-[11.5px] leading-relaxed text-faint">{hint}</p>
          ) : (
            <div className="mb-3" />
          )}
          {uploadButtons}
        </div>
      ) : (
        <div>
          <div className={`grid gap-2 ${single ? "grid-cols-1" : "grid-cols-3 sm:grid-cols-4"}`}>
            {items.map((item, index) => (
              <div
                key={item.key}
                className={`group relative overflow-hidden rounded-[16px] border border-line bg-raised ${
                  single ? "aspect-video w-full max-w-[280px]" : "aspect-square"
                }`}
              >
                {item.previewUrl || item.posterUrl ? (
                  <img
                    src={item.posterUrl || item.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,var(--ink)_8%,var(--raised))] text-muted">
                    <Play size={20} />
                  </div>
                )}

                {item.media?.mediaType === "VIDEO" ? (
                  <>
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                        <Play size={14} fill="currentColor" />
                      </span>
                    </span>
                    {item.media.durationSeconds ? (
                      <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[9.5px] text-white">
                        {durationLabel(item.media.durationSeconds)}
                      </span>
                    ) : null}
                  </>
                ) : null}

                {index === 0 && !single && item.status === "done" ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
                    封面
                  </span>
                ) : null}

                {item.status === "uploading" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white">
                    <Loader2 size={17} className="animate-spin" />
                    <span className="mt-1 text-[10px] tabular">{item.progress}%</span>
                  </div>
                ) : null}

                {item.status === "error" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 p-1 text-center text-white">
                    <AlertCircle size={15} />
                    <span className="text-[9px] leading-tight">{item.error}</span>
                    {item.file ? (
                      <button
                        type="button"
                        className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]"
                        onClick={() => void processFile(item.file!, item.key)}
                      >
                        <RotateCcw size={9} /> 重试
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {reorder && item.status === "done" ? (
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
                      onClick={() => move(index, -1)}
                      aria-label="前移"
                    >
                      <ArrowLeft size={11} />
                    </button>
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
                      onClick={() => move(index, 1)}
                      aria-label="后移"
                    >
                      <ArrowRight size={11} />
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white opacity-100 backdrop-blur-sm transition sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={() => void removeItem(item)}
                  aria-label="移除"
                >
                  <X size={12} />
                </button>

                {index > 0 && item.status === "done" ? (
                  <button
                    type="button"
                    className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white opacity-100 backdrop-blur-sm transition sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() => makeCover(index)}
                    aria-label="设为封面"
                  >
                    <Star size={11} />
                  </button>
                ) : null}
              </div>
            ))}

            {!atLimit && !single ? (
              <button
                type="button"
                onClick={() => libraryRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[16px] border border-dashed border-line-strong bg-surface text-faint transition hover:border-ink hover:text-ink"
                aria-label="继续添加"
              >
                <Plus size={19} strokeWidth={1.7} />
                <span className="text-[10px]">添加</span>
              </button>
            ) : null}
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="text-[11px] text-faint">
              {single ? "已选 1 张" : `${doneItems.length}/${max} · 第一张作为封面`}
            </p>
            <div className="flex items-center gap-2">
              {single ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => cameraRef.current?.click()}
                  >
                    <Camera size={14} /> 拍照
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => libraryRef.current?.click()}
                  >
                    <ImagePlus size={14} /> 更换
                  </button>
                </>
              ) : (
                <>
                  {doneItems.length > 1 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setReorder((value) => !value)}
                    >
                      {reorder ? "完成排序" : "调整顺序"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => libraryRef.current?.click()}
                    disabled={atLimit}
                  >
                    <Plus size={14} /> 添加
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
