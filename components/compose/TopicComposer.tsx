"use client";

import { useActionState, useState } from "react";
import { createTopicAction } from "@/app/actions/topics";
import { ComposeHeader } from "@/components/compose/ComposeHeader";
import { SaveBar } from "@/components/compose/SaveBar";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function TopicComposer() {
  const [state, action] = useActionState(createTopicAction, initialState);
  const [dirty, setDirty] = useState(false);

  return (
    <>
      <ComposeHeader title="发起议题" eyebrow="Family topic" backHref="/topics" dirty={dirty} />

      <form action={action} onInput={() => setDirty(true)}>
        <div className="pt-6">
          <input
            name="title"
            placeholder="想和家人聊什么？"
            maxLength={80}
            required
            autoFocus
            className="w-full border-0 bg-transparent p-0 font-display text-[32px] leading-[1.15] outline-none placeholder:text-faint sm:text-[38px]"
            aria-label="议题标题"
          />
        </div>

        <div className="card mt-5 p-4">
          <label className="label" htmlFor="topic-description">
            背景
          </label>
          <textarea
            id="topic-description"
            name="description"
            rows={5}
            maxLength={2000}
            className="field resize-y"
          />
        </div>

        <FormMessage error={state.error} success={state.success} />

        <SaveBar>
          <SubmitButton className="btn btn-primary w-full sm:w-auto" pendingText="正在发起…">
            发起议题
          </SubmitButton>
        </SaveBar>
      </form>
    </>
  );
}
