"use client";

import { useActionState, useState } from "react";
import { Heart } from "lucide-react";
import { updateMediaAction, toggleFavoriteAction } from "@/app/actions/media";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { VisibilityControl } from "@/components/pickers/VisibilityControl";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function MediaEditor({
  id,
  caption,
  visibility,
  favorite,
  canEdit,
}: {
  id: string;
  caption: string;
  visibility: string;
  favorite: boolean;
  canEdit: boolean;
}) {
  const [state, action] = useActionState(updateMediaAction, initialState);
  const [visibilityValue, setVisibilityValue] = useState(visibility);

  return (
    <div className="card mt-6 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold">这张照片</h2>
        <form action={toggleFavoriteAction}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] transition ${
              favorite
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:border-line-strong"
            }`}
            aria-pressed={favorite}
          >
            <Heart size={12} fill={favorite ? "currentColor" : "none"} />
            {favorite ? "已收藏" : "收藏"}
          </button>
        </form>
      </div>

      {canEdit ? (
        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="favorite" value={favorite ? "true" : "false"} />
          <div>
            <label className="label" htmlFor="media-caption">
              说一句 <span className="font-normal text-faint">可选</span>
            </label>
            <textarea
              id="media-caption"
              name="caption"
              defaultValue={caption}
              rows={2}
              maxLength={500}
              placeholder="这张照片里发生了什么？"
              className="field"
            />
          </div>
          <VisibilityControl
            initial={visibilityValue}
            onChange={(value) => setVisibilityValue(value)}
          />
          <FormMessage error={state.error} success={state.success} />
          <SubmitButton className="btn btn-primary btn-sm" pendingText="保存中…">
            保存
          </SubmitButton>
        </form>
      ) : caption ? (
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{caption}</p>
      ) : null}
    </div>
  );
}
