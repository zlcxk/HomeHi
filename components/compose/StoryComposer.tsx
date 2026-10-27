"use client";

import { useActionState, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { saveEntryAction } from "@/app/actions/entries";
import { ComposeHeader } from "@/components/compose/ComposeHeader";
import { SaveBar } from "@/components/compose/SaveBar";
import { MediaUploader, type MediaItem } from "@/components/MediaUploader";
import { ProfilePicker, type ProfileOption } from "@/components/pickers/ProfilePicker";
import { LocationField } from "@/components/pickers/LocationField";
import { TagPicker } from "@/components/pickers/TagPicker";
import { VisibilityControl } from "@/components/pickers/VisibilityControl";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export type StoryInitial = {
  id: string;
  entryType: string;
  title: string;
  body: string;
  location: string;
  occurredAt: string;
  visibility: string;
  status: string;
  media: MediaItem[];
  profileIds: string[];
  tags: string[];
};

export function StoryComposer({
  profiles,
  tags,
  locations = [],
  defaultVisibility,
  defaultOccurredAt,
  initial,
  backHref = "/today",
}: {
  profiles: ProfileOption[];
  tags: string[];
  locations?: string[];
  defaultVisibility: string;
  defaultOccurredAt: string;
  initial?: StoryInitial;
  backHref?: string;
}) {
  const [state, action] = useActionState(saveEntryAction, initialState);
  const [visibility, setVisibility] = useState(
    initial?.visibility || (defaultVisibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD"),
  );
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const editing = Boolean(initial);
  const isDraft = initial?.status === "DRAFT";

  return (
    <>
      <ComposeHeader
        title={editing ? "编辑记录" : "写一篇手记"}
        eyebrow={isDraft ? "Draft" : editing ? "Edit" : "New story"}
        backHref={backHref}
        dirty={dirty}
      />

      <form action={action} onInput={() => setDirty(true)}>
        {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
        <input type="hidden" name="entryType" value={initial?.entryType || "STORY"} />

        <div className="pt-6">
          <input
            name="title"
            defaultValue={initial?.title || ""}
            placeholder="给这段日子起个名字"
            maxLength={160}
            className="w-full border-0 bg-transparent p-0 font-display text-[32px] leading-[1.15] outline-none placeholder:text-faint sm:text-[38px]"
            aria-label="标题（可选）"
          />
          <textarea
            name="body"
            defaultValue={initial?.body || ""}
            rows={8}
            placeholder="从这里开始写。天气、对话、一个小细节，都值得留下。"
            className="mt-6 min-h-[32vh] w-full resize-y border-0 bg-transparent p-0 text-[16px] leading-[1.9] outline-none placeholder:text-faint"
          />
        </div>

        <div className="mt-4">
          <MediaUploader
            initial={initial?.media || []}
            visibility={visibility}
            max={40}
            onBusyChange={setBusy}
          />
        </div>

        <details className="group card mt-7 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2 text-[13px] font-medium">
              <SlidersHorizontal size={15} className="text-muted" />
              更多选项
            </span>
            <span className="text-[11px] text-faint group-open:hidden">展开</span>
          </summary>
          <div className="space-y-4 border-t border-line px-4 py-4">
            <div>
              <label className="label" htmlFor="story-occurred">
                发生时间
              </label>
              <input
                id="story-occurred"
                name="occurredAt"
                type="datetime-local"
                defaultValue={initial?.occurredAt || defaultOccurredAt}
                className="field"
                required
              />
            </div>
            <LocationField defaultValue={initial?.location || ""} suggestions={locations} />
            <ProfilePicker options={profiles} initialIds={initial?.profileIds || []} />
            <TagPicker options={tags} initial={initial?.tags || []} />
            <VisibilityControl initial={visibility} onChange={setVisibility} />
          </div>
        </details>

        <div className="mt-5">
          <FormMessage error={state.error} />
        </div>

        <SaveBar note="存为草稿后，只有你能看到，可以随时回来继续写。">
          <SubmitButton
            name="status"
            value="DRAFT"
            className="btn btn-outline btn-lg flex-1 sm:flex-none"
            disabled={busy}
            pendingText="保存中…"
          >
            存草稿
          </SubmitButton>
          <SubmitButton
            name="status"
            value="PUBLISHED"
            className="btn btn-primary btn-lg flex-1 sm:flex-none"
            disabled={busy}
            pendingText="保存中…"
          >
            {busy ? "上传中…" : editing ? "保存修改" : "发布"}
          </SubmitButton>
        </SaveBar>
      </form>
    </>
  );
}
