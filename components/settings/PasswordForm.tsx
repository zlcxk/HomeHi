"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialState);

  return (
    <form action={action} className="card p-4 sm:p-5">
      <h2 className="text-[13px] font-semibold">修改密码</h2>
      <p className="mt-1 text-[11px] text-faint">至少 8 位，建议使用密码管理器生成。</p>
      <div className="mt-4 space-y-3">
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          placeholder="当前密码"
          className="field"
          aria-label="当前密码"
        />
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="新密码"
          className="field"
          aria-label="新密码"
        />
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="再次输入新密码"
          className="field"
          aria-label="再次输入新密码"
        />
        <FormMessage error={state.error} success={state.success} />
      </div>
      <div className="mt-4 flex justify-end">
        <SubmitButton className="btn btn-outline btn-sm">更新密码</SubmitButton>
      </div>
    </form>
  );
}
