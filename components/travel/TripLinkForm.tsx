"use client";

import { useActionState, useEffect, useRef } from "react";
import { Link2 } from "lucide-react";
import { addTripLinkAction } from "@/app/actions/travel";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function TripLinkForm({ tripId }: { tripId: string }) {
  const [state, action] = useActionState(addTripLinkAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card p-4">
      <input type="hidden" name="tripId" value={tripId} />
      <label className="label" htmlFor={`trip-link-${tripId}`}>
        添加链接
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          id={`trip-link-${tripId}`}
          name="title"
          maxLength={80}
          placeholder="攻略、票务、预约页"
          className="field"
          aria-label="链接名称"
          required
        />
        <input
          name="url"
          maxLength={500}
          placeholder="https://"
          className="field"
          aria-label="链接地址"
          required
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1 text-[10.5px] text-faint">
          <Link2 size={11} /> 只保存 http / https 链接
        </p>
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
