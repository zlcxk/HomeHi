"use client";

import { useActionState, useState } from "react";
import { updateAccountAction } from "@/app/actions/settings";
import { MediaUploader } from "@/components/MediaUploader";
import { VisibilityControl } from "@/components/pickers/VisibilityControl";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function AccountForm({
  displayName,
  email,
  defaultVisibility,
  avatarMediaId,
  avatarUrl,
}: {
  displayName: string;
  email: string;
  defaultVisibility: string;
  avatarMediaId: string | null;
  avatarUrl: string | null;
}) {
  const [state, action] = useActionState(updateAccountAction, initialState);
  const [busy, setBusy] = useState(false);

  return (
    <form action={action} className="card p-4 sm:p-5">
      <div className="space-y-5">
        <div>
          <label className="label">头像</label>
          <MediaUploader
            initial={
              avatarMediaId
                ? [
                    {
                      id: avatarMediaId,
                      mediaType: "IMAGE",
                      thumbUrl: avatarUrl,
                      url: `/api/media/${avatarMediaId}/file`,
                    },
                  ]
                : []
            }
            visibility="HOUSEHOLD"
            max={1}
            single
            avatar
            compact
            fieldName="avatarMediaId"
            label=""
            hint="会显示在时光、家庭议题和成员列表里。"
            onBusyChange={setBusy}
          />
        </div>
        <div>
          <label className="label" htmlFor="account-name">
            称呼
          </label>
          <input
            id="account-name"
            name="displayName"
            defaultValue={displayName}
            required
            maxLength={40}
            className="field"
          />
          <p className="field-hint">称呼和头像会同步到「家人与宠物」里你的档案。</p>
        </div>
        <div>
          <span className="label">登录邮箱</span>
          <p className="rounded-xl border border-line bg-raised px-3.5 py-2.5 text-[13px] text-muted">{email}</p>
          <p className="field-hint">邮箱用于登录和接收提醒。修改邮箱请联系家庭管理员。</p>
        </div>
        <VisibilityControl initial={defaultVisibility} label="新记录默认可见性" />
        <FormMessage error={state.error} success={state.success} />
      </div>
      <div className="mt-4 flex justify-end">
        <SubmitButton className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? "照片上传中…" : "保存"}
        </SubmitButton>
      </div>
    </form>
  );
}
