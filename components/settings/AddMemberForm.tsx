"use client";

import { useActionState, useState } from "react";
import { RefreshCw } from "lucide-react";
import { addMemberAction } from "@/app/actions/settings";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

function temporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
}

export function AddMemberForm() {
  const [state, action] = useActionState(addMemberAction, initialState);
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold">邀请家庭成员</h2>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="member-name">
            称呼
          </label>
          <input
            id="member-name"
            name="displayName"
            required
            maxLength={40}
            placeholder="比如：小林"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="member-email">
            邮箱
          </label>
          <input
            id="member-email"
            name="email"
            type="email"
            required
            placeholder="name@example.com"
            className="field"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="label" htmlFor="member-password">
          临时密码
        </label>
        <div className="flex gap-2">
          <input
            id="member-password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            maxLength={200}
            placeholder="至少 8 位"
            className="field"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setPassword(temporaryPassword())}
            className="btn btn-outline btn-sm shrink-0"
          >
            <RefreshCw size={13} /> 生成
          </button>
        </div>
        <p className="field-hint">对方登录后可在「设置 → 账户」修改密码。</p>
      </div>

      {state.error || state.success ? (
        <div className="mt-3">
          <FormMessage error={state.error} success={state.success} />
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <SubmitButton className="btn btn-primary btn-sm" pendingText="创建中…">
          创建账号
        </SubmitButton>
      </div>
    </form>
  );
}
