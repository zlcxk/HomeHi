"use client";

import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { PasswordField } from "@/components/auth/PasswordField";
import { FormMessage } from "@/components/FormMessage";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          登录邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="field"
          placeholder="you@example.com"
          autoComplete="email"
          required
          autoFocus
        />
      </div>

      <PasswordField name="password" label="密码" autoComplete="current-password" placeholder="输入密码" />

      <FormMessage error={state.error} />

      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 size={17} className="animate-spin" /> 正在进入…
          </>
        ) : (
          <>
            进入 HomeHi <ArrowRight size={17} />
          </>
        )}
      </button>

      <p className="pt-2 text-center text-[11.5px] leading-relaxed text-faint">
        忘记密码时，可由部署管理员在服务器上重置。
        <br />
        你的内容不会被发送到任何第三方。
      </p>
    </form>
  );
}
