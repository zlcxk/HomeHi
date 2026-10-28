"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { saveProfileAction } from "@/app/actions/profiles";
import { MediaUploader } from "@/components/MediaUploader";
import { LunarDatePicker, type LunarInitial } from "@/components/pickers/LunarDatePicker";
import { VisibilityControl } from "@/components/pickers/VisibilityControl";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export type ProfileInitial = {
  id: string;
  profileType: string;
  name: string;
  birthday: string;
  birthdayMode?: "SOLAR" | "LUNAR";
  lunarBirthday?: LunarInitial | null;
  joinedDate: string;
  species: string;
  breed: string;
  gender: string;
  description: string;
  visibility: string;
  avatarUrl: string | null;
  avatarMediaId: string | null;
  isLinkedAccount?: boolean;
};

export function ProfileForm({
  initial,
  defaultVisibility,
}: {
  initial?: ProfileInitial;
  defaultVisibility: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(saveProfileAction, initialState);
  const [type, setType] = useState(initial?.profileType || "PERSON");
  const [birthdayMode, setBirthdayMode] = useState<"SOLAR" | "LUNAR">(
    initial?.birthdayMode === "LUNAR" ? "LUNAR" : "SOLAR",
  );
  const [visibility, setVisibility] = useState(
    initial?.visibility || (defaultVisibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD"),
  );
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <header className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="icon-btn icon-btn-plain -ml-2 mb-3"
          aria-label="返回"
        >
          <ArrowLeft size={19} strokeWidth={1.8} />
        </button>
        <p className="eyebrow">{initial ? "Edit profile" : "New profile"}</p>
        <h1 className="font-display mt-1.5 text-[32px] leading-tight">
          {initial ? "编辑档案" : "添加一位家人"}
        </h1>
      </header>

      <form action={action}>
        {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
        <input type="hidden" name="profileType" value={type} />

        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1">
          {[
            { value: "PERSON", label: "家人" },
            { value: "PET", label: "宠物" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setType(option.value)}
              className={`rounded-xl px-2 py-2.5 text-[13px] transition ${
                type === option.value ? "bg-ink text-paper" : "text-muted hover:bg-raised"
              }`}
              aria-pressed={type === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <label className="label">{type === "PET" ? "它的照片" : "头像"}</label>
          {initial?.isLinkedAccount ? (
            <p className="field-hint mb-2">这是你的账号档案，称呼和头像会同步到账号与所有记录。</p>
          ) : null}
          <MediaUploader
            initial={
              initial?.avatarMediaId
                ? [
                    {
                      id: initial.avatarMediaId,
                      mediaType: "IMAGE",
                      thumbUrl: initial.avatarUrl,
                      url: `/api/media/${initial.avatarMediaId}/file`,
                    },
                  ]
                : []
            }
            visibility={visibility}
            max={1}
            single
            avatar
            fieldName="avatarMediaId"
            label="选择照片"
            onBusyChange={setBusy}
          />
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="profile-name">
              名字
            </label>
            <input
              id="profile-name"
              name="name"
              defaultValue={initial?.name || ""}
              required
              maxLength={40}
              placeholder={type === "PET" ? "它叫什么？" : "怎么称呼"}
              className="field"
            />
          </div>

          {type === "PET" ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="label" htmlFor="profile-species">
                  种类
                </label>
                <input
                  id="profile-species"
                  name="species"
                  defaultValue={initial?.species || ""}
                  maxLength={40}
                  placeholder="猫 / 狗 / 兔子"
                  className="field"
                />
              </div>
              <div>
                <label className="label" htmlFor="profile-breed">
                  品种
                </label>
                <input
                  id="profile-breed"
                  name="breed"
                  defaultValue={initial?.breed || ""}
                  maxLength={60}
                  placeholder="可选"
                  className="field"
                />
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="label mb-0" htmlFor="profile-birthday">
                生日
              </label>
              <div
                className="flex rounded-full border border-line bg-surface p-0.5"
                role="group"
                aria-label="生日历法"
              >
                {[
                  { value: "SOLAR", label: "公历" },
                  { value: "LUNAR", label: "农历" },
                ].map((option) => {
                  const active = birthdayMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBirthdayMode(option.value as "SOLAR" | "LUNAR")}
                      aria-pressed={active}
                      className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                        active ? "bg-ink text-paper" : "text-muted hover:bg-raised"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <input type="hidden" name="birthdayMode" value={birthdayMode} />
            <input
              id="profile-birthday"
              name="birthday"
              type="date"
              defaultValue={initial?.birthday || ""}
              className={birthdayMode === "SOLAR" ? "field" : "hidden"}
            />
            <LunarDatePicker
              namePrefix="birthdayLunar"
              initial={initial?.lunarBirthday}
              seedDate={initial?.birthday || undefined}
              yearRange={[1900, new Date().getFullYear()]}
              className={birthdayMode === "LUNAR" ? "" : "hidden"}
            />
          </div>

          <div>
            <label className="label" htmlFor="profile-joined">
              {type === "PET" ? "到家日" : "加入这个家的日子"}
            </label>
            <input
              id="profile-joined"
              name="joinedDate"
              type="date"
              defaultValue={initial?.joinedDate || ""}
              className="field"
            />
          </div>

          <div>
            <label className="label" htmlFor="profile-description">
              关于 {type === "PET" ? "它" : "TA"}
            </label>
            <textarea
              id="profile-description"
              name="description"
              defaultValue={initial?.description || ""}
              rows={3}
              maxLength={2000}
              placeholder={type === "PET" ? "喜欢什么、害怕什么、有什么小习惯…" : "喜欢的事、正在做的事、想记住的细节…"}
              className="field"
            />
          </div>

          <VisibilityControl initial={visibility} onChange={setVisibility} />
        </div>

        <div className="mt-5">
          <FormMessage error={state.error} />
        </div>

        <div className="mt-6 flex justify-end pb-8">
          <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto" disabled={busy}>
            {busy ? "照片上传中…" : initial ? "保存档案" : "添加档案"}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
