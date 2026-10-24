"use client";

import { useActionState, useState } from "react";
import { saveAlbumAction } from "@/app/actions/media";
import { ComposeHeader } from "@/components/compose/ComposeHeader";
import { SaveBar } from "@/components/compose/SaveBar";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function AlbumForm({
  initial,
  backHref = "/photos",
}: {
  initial?: { id: string; name: string; description: string };
  backHref?: string;
}) {
  const [state, action] = useActionState(saveAlbumAction, initialState);
  const [dirty, setDirty] = useState(false);

  return (
    <>
      <ComposeHeader
        title={initial ? "编辑相册" : "新建相册"}
        eyebrow="Album"
        backHref={backHref}
        dirty={dirty}
      />
      <form action={action} onInput={() => setDirty(true)}>
        {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
        <div className="pt-6">
          <input
            name="name"
            defaultValue={initial?.name || ""}
            placeholder="给相册起个名字"
            maxLength={60}
            required
            className="w-full border-0 bg-transparent p-0 font-display text-[32px] leading-[1.15] outline-none placeholder:text-faint sm:text-[38px]"
            aria-label="相册名称"
          />
        </div>
        <div className="mt-6">
          <label className="label" htmlFor="album-description">
            说明 <span className="font-normal text-faint">可选</span>
          </label>
          <textarea
            id="album-description"
            name="description"
            defaultValue={initial?.description || ""}
            rows={3}
            maxLength={500}
            placeholder="这是哪一段日子？"
            className="field"
          />
        </div>
        <div className="mt-5">
          <FormMessage error={state.error} />
        </div>
        <SaveBar note="创建后可以挑选照片放进相册。">
          <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto">
            {initial ? "保存相册" : "创建相册"}
          </SubmitButton>
        </SaveBar>
      </form>
    </>
  );
}
