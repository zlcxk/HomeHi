"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { addTripVisitAction } from "@/app/actions/travel";
import { MediaUploader } from "@/components/MediaUploader";
import { SaveBar } from "@/components/compose/SaveBar";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function VisitForm({
  tripId,
  placeId,
  placeName,
  defaultDate,
  visibility,
}: {
  tripId: string;
  placeId: string;
  placeName: string;
  defaultDate: string;
  visibility: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(addTripVisitAction, initialState);
  const [busy, setBusy] = useState(false);

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
        <p className="eyebrow flex items-center gap-1">
          <MapPin size={12} /> {placeName}
        </p>
        <h1 className="font-display mt-1.5 text-[32px] leading-tight">在这里打个卡</h1>
      </header>

      <form action={action}>
        <input type="hidden" name="tripId" value={tripId} />
        <input type="hidden" name="placeId" value={placeId} />

        <div>
          <label className="label" htmlFor="visit-date">
            到访日期
          </label>
          <input
            id="visit-date"
            name="visitedAt"
            type="date"
            defaultValue={defaultDate}
            required
            className="field"
          />
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="visit-note">
            这次看到什么
          </label>
          <textarea
            id="visit-note"
            name="note"
            rows={3}
            maxLength={2000}
            placeholder="印象最深的一件展品、当天的天气、和谁一起…"
            className="field"
          />
        </div>

        <div className="mt-5">
          <MediaUploader
            visibility={visibility}
            max={30}
            fieldName="mediaIds"
            label="照片"
            onBusyChange={setBusy}
          />
        </div>

        <div className="mt-5">
          <FormMessage error={state.error} />
        </div>

        <SaveBar>
          <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto" disabled={busy}>
            {busy ? "照片上传中…" : "保存到访记录"}
          </SubmitButton>
        </SaveBar>
      </form>
    </div>
  );
}
