"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarClock, Sunrise } from "lucide-react";
import { saveTaskAction } from "@/app/actions/tasks";
import { ComposeHeader } from "@/components/compose/ComposeHeader";
import { SaveBar } from "@/components/compose/SaveBar";
import { ProfilePicker, type ProfileOption } from "@/components/pickers/ProfilePicker";
import { RecurrencePicker } from "@/components/pickers/RecurrencePicker";
import { ReminderPicker } from "@/components/pickers/ReminderPicker";
import { VisibilityControl } from "@/components/pickers/VisibilityControl";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export type TaskInitial = {
  id: string;
  title: string;
  description: string;
  dueAt: string;
  priority: string;
  assigneeUserId: string;
  recurrenceType: string;
  recurrenceInterval: number;
  recurrenceUntil: string;
  visibility: string;
  reminderOffsets: number[];
  relatedProfileIds: string[];
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function localInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function dateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function TaskComposer({
  profiles,
  members,
  defaultVisibility,
  smtpConfigured,
  initial,
  backHref = "/tasks",
}: {
  profiles: ProfileOption[];
  members: { id: string; name: string; role: string }[];
  defaultVisibility: string;
  smtpConfigured: boolean;
  initial?: TaskInitial;
  backHref?: string;
}) {
  const [state, action] = useActionState(saveTaskAction, initialState);
  const [due, setDue] = useState(initial?.dueAt || "");
  const [priority, setPriority] = useState(initial?.priority || "NORMAL");
  const [visibility, setVisibility] = useState(
    initial?.visibility || (defaultVisibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD"),
  );
  const [dirty, setDirty] = useState(false);
  const editing = Boolean(initial);

  const quickOptions = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = (8 - monday.getDay()) % 7 || 7;
    monday.setDate(monday.getDate() + diff);
    monday.setHours(9, 0, 0, 0);
    return [
      { label: "今天 20:00", value: localInput(today) },
      { label: "明天 09:00", value: localInput(tomorrow) },
      { label: "下周一 09:00", value: localInput(monday) },
    ];
  }, []);

  return (
    <>
      <ComposeHeader
        title={editing ? "编辑待办" : "新建待办"}
        eyebrow={editing ? "Edit task" : "New task"}
        backHref={backHref}
        dirty={dirty}
      />

      <form action={action} onInput={() => setDirty(true)}>
        {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

        <div className="pt-6">
          <input
            name="title"
            defaultValue={initial?.title || ""}
            placeholder="需要做什么？"
            maxLength={160}
            required
            className="w-full border-0 bg-transparent p-0 font-display text-[32px] leading-[1.15] outline-none placeholder:text-faint sm:text-[38px]"
            aria-label="待办标题"
          />
        </div>

        <div className="card mt-5 p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] font-medium">
              <CalendarClock size={15} className="text-muted" /> 截止时间
            </span>
            <span className="text-[11px] text-faint">可选</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {quickOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setDue(option.value)}
                className={`chip ${due === option.value ? "chip-active" : ""}`}
              >
                {option.label}
              </button>
            ))}
            {due ? (
              <button type="button" className="chip" onClick={() => setDue("")}>
                清除
              </button>
            ) : null}
          </div>

          <input
            name="dueAt"
            type="datetime-local"
            value={due}
            onChange={(event) => setDue(event.target.value)}
            className="field mt-3"
            aria-label="截止时间"
          />
          <p className="field-hint">
            {due ? "到期前会按下面的设置发送邮件提醒。" : "不设时间也可以；没有截止时间就不会发送邮件提醒。"}
          </p>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <span className="label">优先级</span>
            <input type="hidden" name="priority" value={priority} />
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1">
              {[
                { value: "NORMAL", label: "普通" },
                { value: "IMPORTANT", label: "重要" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPriority(option.value)}
                  className={`rounded-xl px-2 py-2 text-[12.5px] transition ${
                    priority === option.value ? "bg-ink text-paper" : "text-muted hover:bg-raised"
                  }`}
                  aria-pressed={priority === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="task-assignee">
              负责人 <span className="font-normal text-faint">可选</span>
            </label>
            <select
              id="task-assignee"
              name="assigneeUserId"
              defaultValue={initial?.assigneeUserId || ""}
              className="field"
            >
              <option value="">不指定</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                  {member.role === "OWNER" ? "（管理员）" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5">
          <label className="label" htmlFor="task-description">
            备注 <span className="font-normal text-faint">可选</span>
          </label>
          <textarea
            id="task-description"
            name="description"
            defaultValue={initial?.description || ""}
            rows={3}
            maxLength={4000}
            placeholder="买什么、去哪里、需要注意什么…"
            className="field"
          />
        </div>

        <div className="mt-6 space-y-5">
          <RecurrencePicker
            initialType={initial?.recurrenceType || "NONE"}
            initialInterval={initial?.recurrenceInterval || 1}
            initialUntil={initial?.recurrenceUntil || ""}
          />
          <ReminderPicker initial={initial?.reminderOffsets || []} smtpConfigured={smtpConfigured} />
          <ProfilePicker options={profiles} initialIds={initial?.relatedProfileIds || []} label="和谁有关" />
          <VisibilityControl initial={visibility} onChange={setVisibility} />
        </div>

        <div className="mt-5">
          <FormMessage error={state.error} />
        </div>

        <SaveBar note="周期待办完成后，会自动排到下一次，历史完成记录会保留。">
          <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto">
            <Sunrise size={16} /> {editing ? "保存待办" : "创建待办"}
          </SubmitButton>
        </SaveBar>
      </form>
    </>
  );
}
