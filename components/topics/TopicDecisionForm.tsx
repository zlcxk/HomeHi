"use client";

import { useActionState } from "react";
import { saveTopicDecisionAction } from "@/app/actions/topics";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function TopicDecisionForm({
  topicId,
  decision,
  outcome,
}: {
  topicId: string;
  decision: string | null;
  outcome: string | null;
}) {
  const [state, action] = useActionState(saveTopicDecisionAction, initialState);

  return (
    <form action={action} className="card p-4">
      <input type="hidden" name="topicId" value={topicId} />
      <p className="label">最终决定</p>
      <textarea
        name="decision"
        rows={3}
        maxLength={500}
        required
        defaultValue={decision || ""}
        placeholder="最后定了什么？"
        className="field resize-y"
        aria-label="最终决定"
      />

      <p className="label mt-4">结果与后续</p>
      <textarea
        name="outcome"
        rows={4}
        maxLength={2000}
        defaultValue={outcome || ""}
        placeholder="事情办得怎么样？还有什么要跟进？"
        className="field resize-y"
        aria-label="结果与后续"
      />

      <div className="mt-3 flex justify-end">
        <SubmitButton className="btn btn-primary btn-sm" pendingText="保存中…">
          保存决定
        </SubmitButton>
      </div>

      <div className="mt-3">
        <FormMessage error={state.error} success={state.success} />
      </div>
    </form>
  );
}
