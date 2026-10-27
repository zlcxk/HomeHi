"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { setupAction } from "@/app/actions/auth";
import { PasswordField } from "@/components/auth/PasswordField";
import { FormMessage } from "@/components/FormMessage";
import { timezoneOptions, browserTimezone } from "@/lib/timezones";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, initialState);
  const [zone, setZone] = useState("Asia/Shanghai");

  useEffect(() => {
    setZone(browserTimezone());
  }, []);

  const zones = useMemo(() => timezoneOptions(zone), [zone]);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="householdName">
          家庭空间名称
        </label>
        <input
          id="householdName"
          name="householdName"
          className="field"
          placeholder="例如：林家的小院"
          autoComplete="organization"
          required
          maxLength={60}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="displayName">
            你的称呼
          </label>
          <input
            id="displayName"
            name="displayName"
            className="field"
            placeholder="小康"
            autoComplete="nickname"
            required
            maxLength={40}
          />
        </div>
        <div>
          <label className="label" htmlFor="timezone">
            所在时区
          </label>
          <select
            id="timezone"
            name="timezone"
            className="field"
            value={zone}
            onChange={(event) => setZone(event.target.value)}
          >
            {zones.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

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
        />
      </div>

      <PasswordField
        name="password"
        label="设置密码"
        autoComplete="new-password"
        placeholder="至少 8 位，建议用密码管理器生成"
        minLength={8}
      />

      <FormMessage error={state.error} />

      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 size={17} className="animate-spin" /> 正在建立你的空间…
          </>
        ) : (
          <>
            建立家庭空间 <ArrowRight size={17} />
          </>
        )}
      </button>

      <div className="rounded-2xl border border-line bg-surface px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-sage-soft text-sage">
            <Check size={12} strokeWidth={2.4} />
          </span>
          <p className="text-[11.5px] leading-relaxed text-muted">
            这是自托管的私人空间，没有第三方账号。初始化完成后，你可以在「我的 → 家庭空间」里为家人创建账号。
          </p>
        </div>
      </div>

      <p className="pt-1 text-center text-[12px] text-faint">
        已经初始化过？{" "}
        <Link href="/login" className="font-medium text-ink underline decoration-line-strong underline-offset-4">
          直接登录
        </Link>
      </p>
    </form>
  );
}
