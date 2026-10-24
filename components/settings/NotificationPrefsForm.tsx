"use client";

import { useActionState } from "react";
import { updateNotificationPrefsAction } from "@/app/actions/settings";
import { Switch } from "@/components/settings/Switch";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function NotificationPrefsForm({
  notifyEvent,
  notifyTask,
  notifyOther,
}: {
  notifyEvent: boolean;
  notifyTask: boolean;
  notifyOther: boolean;
}) {
  const [state, action] = useActionState(updateNotificationPrefsAction, initialState);

  return (
    <form action={action} className="card px-4 py-2 sm:px-5">
      <div className="divide-y divide-line">
        <Switch
          name="notifyEvent"
          defaultChecked={notifyEvent}
          label="日程提醒"
          description="生日、纪念日、约会等日程的提醒邮件。"
        />
        <Switch
          name="notifyTask"
          defaultChecked={notifyTask}
          label="待办提醒"
          description="待办到期前的提醒邮件。"
        />
        <Switch
          name="notifyOther"
          defaultChecked={notifyOther}
          label="其他家庭动态"
          description="保留给后续的摘要邮件，目前不会单独发送。"
        />
      </div>
      <div className="border-t border-line py-3">
        <FormMessage error={state.error} success={state.success} />
      </div>
      <div className="flex justify-end pb-3">
        <SubmitButton className="btn btn-primary btn-sm">保存偏好</SubmitButton>
      </div>
    </form>
  );
}
