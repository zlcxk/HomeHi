"use client";

import { useActionState } from "react";
import { updateHouseholdAction } from "@/app/actions/settings";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function HouseholdForm({
  name,
  timezone,
  zones,
}: {
  name: string;
  timezone: string;
  zones: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(updateHouseholdAction, initialState);

  return (
    <form action={action} className="card p-4 sm:p-5">
      <h2 className="text-[13px] font-semibold">家庭空间</h2>
      <div className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="household-name">
            家庭名称
          </label>
          <input
            id="household-name"
            name="name"
            defaultValue={name}
            required
            maxLength={60}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="household-timezone">
            家庭时区
          </label>
          <select id="household-timezone" name="timezone" defaultValue={timezone} className="field">
            {zones.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </select>
        </div>
        <FormMessage error={state.error} success={state.success} />
      </div>
      <div className="mt-4 flex justify-end">
        <SubmitButton className="btn btn-primary btn-sm">保存</SubmitButton>
      </div>
    </form>
  );
}
