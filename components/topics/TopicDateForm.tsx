"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTopicDateAction } from "@/app/actions/topics";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function TopicDateForm({ topicId }: { topicId: string }) {
  const [state, action] = useActionState(addTopicDateAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card p-4">
      <input type="hidden" name="topicId" value={topicId} />
      <p className="label">添加重要日期</p>

      <div className="grid items-end gap-2 sm:grid-cols-[1fr_150px_auto]">
        <div>
          <label className="mb-1 block text-[10.5px] text-faint" htmlFor={`topic-date-label-${topicId}`}>
            名称
          </label>
          <input
            id={`topic-date-label-${topicId}`}
            name="label"
            maxLength={40}
            required
            placeholder="出发日期、交房日…"
            className="field"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10.5px] text-faint" htmlFor={`topic-date-value-${topicId}`}>
            日期
          </label>
          <input
            id={`topic-date-value-${topicId}`}
            name="date"
            type="date"
            required
            className="field"
          />
        </div>
        <SubmitButton className="btn btn-primary btn-sm" pendingText="添加中…">
          添加日期
        </SubmitButton>
      </div>

      <input
        name="note"
        maxLength={300}
        placeholder="备注（可选）"
        className="field mt-2"
        aria-label="日期备注"
      />

      <div className="mt-3">
        <FormMessage error={state.error} success={state.success} />
      </div>
    </form>
  );
}
