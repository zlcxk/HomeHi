"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { sendTestEmailAction } from "@/app/actions/settings";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function TestEmailForm({ email, configured }: { email: string; configured: boolean }) {
  const [state, action] = useActionState(sendTestEmailAction, initialState);

  return (
    <form action={action}>
      <div className="mt-4">
        <FormMessage error={state.error} success={state.success} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-faint">测试邮件会发送到 {email}</p>
        <SubmitButton
          className="btn btn-outline btn-sm shrink-0"
          disabled={!configured}
          pendingText="发送中…"
        >
          <Send size={13} /> 发送测试
        </SubmitButton>
      </div>
    </form>
  );
}
