"use client";

import { useActionState, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { addTopicLinkAction } from "@/app/actions/topics";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { deriveLinkTitle, detectLinkPlatform, extractSharedUrl } from "@/lib/topics";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function TopicLinkForm({ topicId }: { topicId: string }) {
  const [state, action] = useActionState(addTopicLinkAction, initialState);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);

  const url = extractSharedUrl(text);
  const platform = url ? detectLinkPlatform(url, text) : null;

  useEffect(() => {
    if (!state.success) return;
    setText("");
    setTitle("");
    setNote("");
    setTitleTouched(false);
  }, [state]);

  function updateText(value: string) {
    setText(value);
    if (titleTouched) return;
    const found = extractSharedUrl(value);
    setTitle(found ? deriveLinkTitle(value, found) : "");
  }

  return (
    <form action={action} className="card p-4">
      <input type="hidden" name="topicId" value={topicId} />
      <label className="label" htmlFor={`topic-link-${topicId}`}>
        保存链接
      </label>
      <textarea
        id={`topic-link-${topicId}`}
        name="text"
        rows={3}
        maxLength={3000}
        value={text}
        onChange={(event) => updateText(event.target.value)}
        placeholder="粘贴链接或分享文案"
        className="field resize-y"
      />

      {url ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-raised/60 px-3 py-2">
          <Link2 size={12} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate text-[10.5px] text-muted">{url}</span>
          {platform ? (
            <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[9.5px] font-medium text-muted">
              {platform}
            </span>
          ) : null}
        </div>
      ) : text.trim().length > 0 ? (
        <p className="mt-2 text-[10.5px] text-faint">未识别到链接</p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          name="title"
          value={title}
          onChange={(event) => {
            setTitleTouched(true);
            setTitle(event.target.value);
          }}
          maxLength={120}
          placeholder="标题（可选）"
          className="field"
          aria-label="链接标题"
        />
        <input
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          placeholder="备注（可选）"
          className="field"
          aria-label="链接备注"
        />
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingText="保存中…">
          保存链接
        </SubmitButton>
      </div>
      <div className="mt-3">
        <FormMessage error={state.error} success={state.success} />
      </div>
    </form>
  );
}
