"use client";

import { useActionState } from "react";
import { updateTopicAction } from "@/app/actions/topics";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function TopicMetaForm({
  topicId,
  title,
  description,
}: {
  topicId: string;
  title: string;
  description: string;
}) {
  const [state, action] = useActionState(updateTopicAction, initialState);

  return (
    <form action={action} className="card p-4">
      <input type="hidden" name="topicId" value={topicId} />
      <label className="label" htmlFor={`topic-title-${topicId}`}>
        标题
      </label>
      <input
        id={`topic-title-${topicId}`}
        name="title"
        defaultValue={title}
        maxLength={80}
        required
        className="field"
      />

      <label className="label mt-4" htmlFor={`topic-description-${topicId}`}>
        背景
      </label>
      <textarea
        id={`topic-description-${topicId}`}
        name="description"
        rows={5}
        maxLength={2000}
        defaultValue={description}
        className="field resize-y"
      />

      <div className="mt-3 flex justify-end">
        <SubmitButton className="btn btn-primary btn-sm" pendingText="保存中…">
          保存
        </SubmitButton>
      </div>
      <div className="mt-3">
        <FormMessage error={state.error} success={state.success} />
      </div>
    </form>
  );
}
