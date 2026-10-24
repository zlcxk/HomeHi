"use client";

import { useActionState, useState } from "react";
import { MapPin } from "lucide-react";
import { saveEventAction } from "@/app/actions/events";
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

export type EventInitial = {
  id: string;
  title: string;
  description: string;
  location: string;
  isAllDay: boolean;
  start: string;
  end: string;
  recurrenceType: string;
  recurrenceInterval: number;
  recurrenceUntil: string;
  visibility: string;
  reminderOffsets: number[];
  relatedProfileIds: string[];
};

export function EventComposer({
  profiles,
  defaultVisibility,
  smtpConfigured,
  defaultStart,
  initial,
  backHref = "/calendar",
}: {
  profiles: ProfileOption[];
  defaultVisibility: string;
  smtpConfigured: boolean;
  defaultStart: string;
  initial?: EventInitial;
  backHref?: string;
}) {
  const [state, action] = useActionState(saveEventAction, initialState);
  const [allDay, setAllDay] = useState(initial?.isAllDay ?? false);
  const [start, setStart] = useState(initial?.start || defaultStart);
  const [end, setEnd] = useState(initial?.end || "");
  const [visibility, setVisibility] = useState(
    initial?.visibility || (defaultVisibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD"),
  );
  const [dirty, setDirty] = useState(false);
  const editing = Boolean(initial);

  function toggleAllDay() {
    if (!allDay) {
      setStart((value) => (value.includes("T") ? value.slice(0, 10) : value));
      setEnd((value) => (value.includes("T") ? value.slice(0, 10) : value));
    } else {
      setStart((value) => (value.includes("T") ? value : `${value}T09:00`));
      setEnd((value) => (value.includes("T") ? value : value ? `${value}T10:00` : ""));
    }
    setAllDay((value) => !value);
  }

  return (
    <>
      <ComposeHeader
        title={editing ? "编辑日程" : "新建日程"}
        eyebrow={editing ? "Edit event" : "New event"}
        backHref={backHref}
        dirty={dirty}
      />

      <form action={action} onInput={() => setDirty(true)}>
        {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
        <input type="hidden" name="isAllDay" value={allDay ? "true" : "false"} />

        <div className="pt-6">
          <input
            name="title"
            defaultValue={initial?.title || ""}
            placeholder="要记住的这件事"
            maxLength={120}
            required
            className="w-full border-0 bg-transparent p-0 font-display text-[32px] leading-[1.15] outline-none placeholder:text-faint sm:text-[38px]"
            aria-label="日程标题"
          />
        </div>

        <div className="card mt-5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13.5px] font-medium">全天</p>
              <p className="mt-0.5 text-[11.5px] text-faint">生日、纪念日或不确定具体时刻的日子</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allDay}
              onClick={toggleAllDay}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                allDay ? "bg-accent" : "bg-line-strong"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  allDay ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="hairline mt-4 grid grid-cols-2 gap-2.5 pt-4">
            <div>
              <label className="label" htmlFor="event-start">
                开始
              </label>
              <input
                id="event-start"
                name="start"
                type={allDay ? "date" : "datetime-local"}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="event-end">
                结束 <span className="font-normal text-faint">可选</span>
              </label>
              <input
                id="event-end"
                name="end"
                type={allDay ? "date" : "datetime-local"}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="field"
              />
            </div>
          </div>

          <div className="hairline mt-4 pt-4">
            <label className="label" htmlFor="event-location">
              地点 <span className="font-normal text-faint">可选</span>
            </label>
            <div className="relative">
              <MapPin size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                id="event-location"
                name="location"
                defaultValue={initial?.location || ""}
                placeholder="在哪里"
                maxLength={200}
                className="field pl-9"
              />
            </div>
          </div>

          <div className="hairline mt-4 pt-4">
            <label className="label" htmlFor="event-description">
              备注 <span className="font-normal text-faint">可选</span>
            </label>
            <textarea
              id="event-description"
              name="description"
              defaultValue={initial?.description || ""}
              rows={3}
              maxLength={4000}
              placeholder="需要提前准备的、要带的东西、想说的话…"
              className="field"
            />
          </div>
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

        <SaveBar note="保存后可在日历中查看、改期或取消。">
          <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto">
            {editing ? "保存日程" : "创建日程"}
          </SubmitButton>
        </SaveBar>
      </form>
    </>
  );
}
