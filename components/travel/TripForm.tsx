"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Compass, MapPin, Repeat } from "lucide-react";
import { saveTripAction } from "@/app/actions/travel";
import { MediaUploader } from "@/components/MediaUploader";
import { SaveBar } from "@/components/compose/SaveBar";
import { VisibilityControl } from "@/components/pickers/VisibilityControl";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { TRIP_KINDS, TRIP_STATUSES } from "@/lib/travel";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export type TripInitial = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  visibility: string;
  coverMediaId: string | null;
  coverUrl: string | null;
};

export function TripForm({
  initial,
  defaultVisibility,
}: {
  initial?: TripInitial;
  defaultVisibility: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(saveTripAction, initialState);
  const [visibility, setVisibility] = useState(
    initial?.visibility || (defaultVisibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD"),
  );
  const [kind, setKind] = useState(initial?.kind === "THEME" ? "THEME" : "SINGLE");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial);

  return (
    <div>
      <header className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="icon-btn icon-btn-plain -ml-2 mb-3"
          aria-label="返回"
        >
          <ArrowLeft size={19} strokeWidth={1.8} />
        </button>
        <p className="eyebrow">{editing ? "Edit trip" : "New trip"}</p>
        <h1 className="font-display mt-1.5 text-[32px] leading-tight">
          {editing ? "编辑旅行" : "开始一段旅行"}
        </h1>
      </header>

      <form action={action}>
        {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
        <input type="hidden" name="kind" value={kind} />

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TRIP_KINDS.map((option) => {
            const active = kind === option.value;
            const Icon = option.value === "THEME" ? Repeat : Compass;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                aria-pressed={active}
                className={`rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${
                  active ? "border-ink bg-surface" : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <Icon size={15} strokeWidth={1.9} className={active ? "text-accent" : "text-muted"} />
                  {option.label}
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-faint">{option.hint}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          <MediaUploader
            initial={
              initial?.coverMediaId
                ? [
                    {
                      id: initial.coverMediaId,
                      mediaType: "IMAGE",
                      thumbUrl: initial.coverUrl,
                      url: `/api/media/${initial.coverMediaId}/file`,
                    },
                  ]
                : []
            }
            visibility={visibility}
            max={1}
            single
            fieldName="coverMediaId"
            label="封面"
            hint="不选也可以，列表会用配色底图。"
            onBusyChange={setBusy}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="trip-title">
              名称
            </label>
            <input
              id="trip-title"
              name="title"
              defaultValue={initial?.title || ""}
              placeholder={kind === "THEME" ? "例如：全国博物馆打卡" : "例如：京都五日"}
              maxLength={80}
              required
              className="field"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="trip-subtitle">
              副标题
            </label>
            <input
              id="trip-subtitle"
              name="subtitle"
              defaultValue={initial?.subtitle || ""}
              placeholder={kind === "THEME" ? "想走完的那些馆、那些城" : "和谁、为什么出发"}
              maxLength={120}
              className="field"
            />
          </div>

          <div>
            <label className="label" htmlFor="trip-status">
              状态
            </label>
            <select
              id="trip-status"
              name="status"
              defaultValue={initial?.status || "PLANNING"}
              className="field"
            >
              {TRIP_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {kind === "SINGLE" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="trip-start">
                  出发
                </label>
                <input
                  id="trip-start"
                  name="startDate"
                  type="date"
                  defaultValue={initial?.startDate || ""}
                  className="field"
                />
              </div>
              <div>
                <label className="label" htmlFor="trip-end">
                  返程
                </label>
                <input
                  id="trip-end"
                  name="endDate"
                  type="date"
                  defaultValue={initial?.endDate || ""}
                  className="field"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-line-strong px-3.5 py-3 text-[11.5px] leading-relaxed text-faint">
              <MapPin size={14} className="shrink-0" />
              主题旅行按地点累计进度，不需要起止日期。
            </div>
          )}
        </div>

        <div className="mt-6">
          <label className="label" htmlFor="trip-description">
            介绍
          </label>
          <textarea
            id="trip-description"
            name="description"
            defaultValue={initial?.description || ""}
            rows={4}
            maxLength={4000}
            placeholder="为什么想去、想收集什么、有什么约定…"
            className="field"
          />
        </div>

        <div className="mt-6">
          <VisibilityControl initial={visibility} onChange={setVisibility} />
        </div>

        <div className="mt-5">
          <FormMessage error={state.error} />
        </div>

        <SaveBar>
          <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto" disabled={busy}>
            {busy ? "封面上传中…" : editing ? "保存旅行" : "创建旅行"}
          </SubmitButton>
        </SaveBar>
      </form>
    </div>
  );
}
