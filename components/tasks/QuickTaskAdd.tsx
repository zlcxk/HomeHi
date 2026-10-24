"use client";

import { useActionState, useRef } from "react";
import { Plus } from "lucide-react";
import { saveTaskAction } from "@/app/actions/tasks";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function QuickTaskAdd({ visibility }: { visibility: string }) {
  const [state, action] = useActionState(saveTaskAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={action}
      className="card mb-6 p-2 pl-4"
      onSubmit={() => {
        window.setTimeout(() => formRef.current?.reset(), 400);
      }}
    >
      <input type="hidden" name="priority" value="NORMAL" />
      <input type="hidden" name="recurrenceType" value="NONE" />
      <input type="hidden" name="recurrenceInterval" value="1" />
      <input type="hidden" name="reminderOffsets" value="[]" />
      <input type="hidden" name="visibility" value={visibility} />
      <div className="flex items-center gap-2">
        <Plus size={16} className="shrink-0 text-faint" />
        <input
          name="title"
          required
          maxLength={160}
          placeholder="随手加一件要做的事…"
          className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[13.5px] outline-none placeholder:text-faint"
          aria-label="新待办"
        />
        <SubmitButton className="btn btn-primary btn-sm shrink-0" pendingText="添加中…">
          添加
        </SubmitButton>
      </div>
      {state.error ? (
        <div className="px-1 pb-2">
          <FormMessage error={state.error} />
        </div>
      ) : null}
    </form>
  );
}
