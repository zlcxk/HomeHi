"use client";

import { useActionState, useEffect, useState } from "react";
import { addTopicNoteAction } from "@/app/actions/topics";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function TopicNoteForm({ topicId }: { topicId: string }) {
  const [state, action] = useActionState(addTopicNoteAction, initialState);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (state.success) setBody("");
  }, [state]);

  return (
    <form action={action} className="card p-4">
      <input type="hidden" name="topicId" value={topicId} />
      <label className="label" htmlFor={`topic-note-${topicId}`}>
        记录一个想法
      </label>
      <textarea
        id={`topic-note-${topicId}`}
        name="body"
        rows={3}
        maxLength={1000}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="写点什么"
        className="field resize-y"
      />
      <div className="mt-3 flex items-center justify-end gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingText="记下中…">
          记下想法
        </SubmitButton>
      </div>
      <div className="mt-3">
        <FormMessage error={state.error} success={state.success} />
      </div>
    </form>
  );
}
