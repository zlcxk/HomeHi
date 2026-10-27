"use client";

import { useActionState, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { saveEntryAction } from "@/app/actions/entries";
import { ComposeHeader } from "@/components/compose/ComposeHeader";
import { SaveBar } from "@/components/compose/SaveBar";
import { MediaUploader } from "@/components/MediaUploader";
import { ProfilePicker, type ProfileOption } from "@/components/pickers/ProfilePicker";
import { TagPicker } from "@/components/pickers/TagPicker";
import { VisibilityControl } from "@/components/pickers/VisibilityControl";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function MomentComposer({
  profiles,
  tags,
  defaultVisibility,
  defaultOccurredAt,
}: {
  profiles: ProfileOption[];
  tags: string[];
  defaultVisibility: string;
  defaultOccurredAt: string;
}) {
  const [state, action] = useActionState(saveEntryAction, initialState);
  const [visibility, setVisibility] = useState(
    defaultVisibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD",
  );
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  return (
    <>
      <ComposeHeader title="一个瞬间" eyebrow="New moment" backHref="/today" dirty={dirty} />

      <form action={action} onInput={() => setDirty(true)}>
        <input type="hidden" name="entryType" value="MOMENT" />
        <input type="hidden" name="status" value="PUBLISHED" />

        <div className="pt-5">
          <MediaUploader
            visibility={visibility}
            max={12}
            onBusyChange={setBusy}
            hint="拍照或从相册选择"
          />
        </div>

        <textarea
          name="body"
          rows={2}
          placeholder="这一刻，想记住什么？"
          className="mt-6 min-h-[76px] w-full resize-none border-0 bg-transparent p-0 font-display text-[23px] leading-[1.45] outline-none placeholder:text-faint"
        />

        <details className="group card mt-7 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2 text-[13px] font-medium">
              <SlidersHorizontal size={15} className="text-muted" />
              补充时间、人物、标签与隐私
            </span>
            <span className="text-[11px] text-faint group-open:hidden">展开</span>
          </summary>
          <div className="space-y-4 border-t border-line px-4 py-4">
            <div>
              <label className="label" htmlFor="moment-occurred">
                发生时间
              </label>
              <input
                id="moment-occurred"
                name="occurredAt"
                type="datetime-local"
                defaultValue={defaultOccurredAt}
                className="field"
                required
              />
            </div>
            <ProfilePicker options={profiles} />
            <TagPicker options={tags} />
            <VisibilityControl initial={visibility} onChange={setVisibility} />
          </div>
        </details>

        <div className="mt-5">
          <FormMessage error={state.error} />
        </div>

        <SaveBar>
          <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto" disabled={busy}>
            {busy ? "照片上传中…" : "记下这一刻"}
          </SubmitButton>
        </SaveBar>
      </form>
    </>
  );
}
