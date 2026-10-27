"use client";

import { useActionState, useEffect, useState } from "react";
import { addTopicOpinionAction } from "@/app/actions/topics";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { TOPIC_STANCES } from "@/lib/topics";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function TopicOpinionForm({ topicId }: { topicId: string }) {
  const [state, action] = useActionState(addTopicOpinionAction, initialState);
  const [stance, setStance] = useState("NEUTRAL");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!state.success) return;
    setBody("");
    setStance("NEUTRAL");
  }, [state]);

  return (
    <form action={action} className="card p-4">
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="stance" value={stance} />

      <div className="flex flex-wrap gap-1.5">
        {TOPIC_STANCES.map((item) => {
          const active = stance === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setStance(item.value)}
              aria-pressed={active}
              className={`chip ${active ? "chip-active" : ""}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <textarea
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={500}
        placeholder="写点什么"
        className="field mt-3 resize-y"
        aria-label="你的看法"
      />

      <div className="mt-3 flex items-center justify-end">
        <SubmitButton className="btn btn-primary btn-sm" pendingText="记下中…">
          说说看法
        </SubmitButton>
      </div>

      <FormMessage error={state.error} success={state.success} />
    </form>
  );
}
