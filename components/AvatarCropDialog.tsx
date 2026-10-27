"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Minus, Plus, X } from "lucide-react";

const OUTPUT_SIZE = 720;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 微信式的头像裁剪：选好照片后，拖动/缩放选择一个方形区域，
 * 再裁剪成 720×720 的 WebP 上传。最终头像仍以圆形展示。
 */
export function AvatarCropDialog({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState("");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState("");
  const [stageSize, setStageSize] = useState(0);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const drag = useRef<{ pointer: Point; offset: Point } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 在 effect 里创建 object URL：Strict Mode 下第一次创建的地址会被回收，
  // 这里会再创建一个，避免开发环境里预览图变成空白。
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setImage(null);
    setError("");
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setError("这张照片无法读取，请换一张试试。");
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  useEffect(() => {
    if (!mounted) return;
    const element = stageRef.current;
    if (!element) return;
    const update = () => setStageSize(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  const baseScale =
    image && stageSize
      ? Math.max(stageSize / image.naturalWidth, stageSize / image.naturalHeight)
      : 1;
  const scale = baseScale * zoom;
  const displayWidth = image ? image.naturalWidth * scale : 0;
  const displayHeight = image ? image.naturalHeight * scale : 0;
  const maxX = Math.max(0, (displayWidth - stageSize) / 2);
  const maxY = Math.max(0, (displayHeight - stageSize) / 2);

  // 缩放或容器变化后，把图片重新限制在方框内，避免露出底色。
  useEffect(() => {
    setOffset((previous) => {
      const x = clamp(previous.x, -maxX, maxX);
      const y = clamp(previous.y, -maxY, maxY);
      return x === previous.x && y === previous.y ? previous : { x, y };
    });
  }, [maxX, maxY]);

  function clampOffset(x: number, y: number, nextZoom: number): Point {
    if (!image || !stageSize) return { x: 0, y: 0 };
    const nextScale =
      Math.max(stageSize / image.naturalWidth, stageSize / image.naturalHeight) * nextZoom;
    const limitX = Math.max(0, (image.naturalWidth * nextScale - stageSize) / 2);
    const limitY = Math.max(0, (image.naturalHeight * nextScale - stageSize) / 2);
    return { x: clamp(x, -limitX, limitX), y: clamp(y, -limitY, limitY) };
  }

  function applyZoom(next: number) {
    const nextZoom = clamp(next, MIN_ZOOM, MAX_ZOOM);
    setZoom(nextZoom);
    setOffset((previous) => clampOffset(previous.x, previous.y, nextZoom));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!image || working) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 1) {
      drag.current = {
        pointer: { x: event.clientX, y: event.clientY },
        offset: { ...offset },
      };
      pinch.current = null;
    } else if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()];
      pinch.current = { distance: distance(first, second), zoom };
      drag.current = null;
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const [first, second] = [...pointers.current.values()];
      const span = distance(first, second);
      if (pinch.current.distance > 0) {
        const nextZoom = clamp(
          pinch.current.zoom * (span / pinch.current.distance),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        setZoom(nextZoom);
        setOffset((previous) => clampOffset(previous.x, previous.y, nextZoom));
      }
      return;
    }

    if (drag.current) {
      const x = drag.current.offset.x + (event.clientX - drag.current.pointer.x);
      const y = drag.current.offset.y + (event.clientY - drag.current.pointer.y);
      setOffset({ x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) });
    }
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      drag.current = null;
    } else if (pointers.current.size === 1) {
      const [point] = pointers.current.values();
      drag.current = { pointer: point, offset: { ...offset } };
    }
  }

  async function handleConfirm() {
    if (!image || !stageSize || working) return;
    setWorking(true);
    setError("");
    try {
      const sourceSize = stageSize / scale;
      const sourceX = clamp(
        (image.naturalWidth - sourceSize) / 2 - offset.x / scale,
        0,
        Math.max(0, image.naturalWidth - sourceSize),
      );
      const sourceY = clamp(
        (image.naturalHeight - sourceSize) / 2 - offset.y / scale,
        0,
        Math.max(0, image.naturalHeight - sourceSize),
      );

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("当前浏览器无法处理这张照片");
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.92),
      );
      const output =
        blob ??
        (await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.92),
        ));
      if (!output) throw new Error("生成头像失败，请重试");

      const extension = output.type === "image/webp" ? "webp" : "jpg";
      onConfirm(
        new File([output], `avatar-${Date.now()}.${extension}`, {
          type: output.type,
          lastModified: Date.now(),
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成头像失败，请重试");
      setWorking(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="调整头像"
    >
      <div className="max-h-[calc(100dvh_-_2rem)] w-full max-w-[430px] overflow-y-auto rounded-[26px] border border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[22px] leading-tight">调整头像</h2>
            <p className="mt-1 text-[11.5px] text-faint">
              拖动照片，把想露出的部分放进方框；双指或滑杆缩放。
            </p>
          </div>
          <button
            type="button"
            className="icon-btn icon-btn-plain -mr-1 -mt-1"
            onClick={onCancel}
            aria-label="关闭"
          >
            <X size={17} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div
            ref={stageRef}
            className="relative mx-auto aspect-square w-full max-w-[360px] touch-none select-none overflow-hidden rounded-[18px] bg-black"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            {image ? (
              <img
                src={url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: displayWidth,
                  height: displayHeight,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/70">
                <Loader2 size={22} className="animate-spin" />
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 border border-white/60" />
            <div
              className="pointer-events-none absolute inset-0 opacity-45"
              style={{
                backgroundImage:
                  "linear-gradient(to right, transparent 33.2%, rgba(255,255,255,.85) 33.2%, rgba(255,255,255,.85) 33.45%, transparent 33.45%, transparent 66.55%, rgba(255,255,255,.85) 66.55%, rgba(255,255,255,.85) 66.8%, transparent 66.8%), linear-gradient(to bottom, transparent 33.2%, rgba(255,255,255,.85) 33.2%, rgba(255,255,255,.85) 33.45%, transparent 33.45%, transparent 66.55%, rgba(255,255,255,.85) 66.55%, rgba(255,255,255,.85) 66.8%, transparent 66.8%)",
              }}
            />
            <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/35" />
          </div>

          {error ? (
            <p className="mt-3 rounded-xl border border-danger/25 bg-raised px-3 py-2 text-[11.5px] text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              className="icon-btn icon-btn-plain shrink-0"
              onClick={() => applyZoom(zoom - 0.2)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="缩小"
            >
              <Minus size={15} />
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(event) => applyZoom(Number(event.target.value))}
              className="h-1 w-full accent-[var(--accent)]"
              aria-label="缩放照片"
            />
            <button
              type="button"
              className="icon-btn icon-btn-plain shrink-0"
              onClick={() => applyZoom(zoom + 0.2)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="放大"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-4">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handleConfirm()}
            disabled={!image || working}
          >
            {working ? <Loader2 size={14} className="animate-spin" /> : null}
            {working ? "处理中…" : "使用照片"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
