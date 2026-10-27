"use client";

import { useActionState, useState } from "react";
import { Link2, ListTodo, MessagesSquare, Paperclip } from "lucide-react";
import { createTopicAction } from "@/app/actions/topics";
import { ComposeHeader } from "@/components/compose/ComposeHeader";
import { SaveBar } from "@/components/compose/SaveBar";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function TopicComposer() {
  const [state, action] = useActionState(createTopicAction, initialState);
  const [dirty, setDirty] = useState(false);

  return (
    <>
      <ComposeHeader title="发起议题" eyebrow="Family topic" backHref="/topics" dirty={dirty} />

      <form action={action} onInput={() => setDirty(true)}>
        <div className="pt-6">
          <input
            name="title"
            placeholder="想和家人聊什么？"
            maxLength={80}
            required
            autoFocus
            className="w-full border-0 bg-transparent p-0 font-display text-[32px] leading-[1.15] outline-none placeholder:text-faint sm:text-[38px]"
            aria-label="议题标题"
          />
        </div>

        <div className="card mt-5 p-4">
          <label className="label" htmlFor="topic-description">
            背景
          </label>
          <textarea
            id="topic-description"
            name="description"
            rows={5}
            maxLength={2000}
            placeholder="为什么想聊这件事？把你的想法和顾虑写下来。"
            className="field resize-y"
          />
        </div>

        <div className="card mt-4 p-4">
          <p className="label">发起之后，一家人可以</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <MessagesSquare size={13} className="mt-0.5 shrink-0 text-sage" />
              <p className="text-[11px] leading-relaxed text-muted">
                记下想法，补充自己的意见
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Link2 size={13} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-[11px] leading-relaxed text-muted">
                保存链接，直接粘贴其他 App 的分享文案
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Paperclip size={13} className="mt-0.5 shrink-0 text-blue" />
              <p className="text-[11px] leading-relaxed text-muted">
                上传文件和照片，留下重要日期
              </p>
            </div>
            <div className="flex items-start gap-2">
              <ListTodo size={13} className="mt-0.5 shrink-0 text-gold" />
              <p className="text-[11px] leading-relaxed text-muted">
                关联待办，最后记录决定与结果
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-raised/60 px-3.5 py-3 text-[11px] leading-relaxed text-muted">
          <MessagesSquare size={14} className="mt-0.5 shrink-0 text-sage" />
          议题默认对全家人可见，每个人都可以补充自己的看法。
        </div>

        <FormMessage error={state.error} success={state.success} />

        <SaveBar>
          <SubmitButton className="btn btn-primary w-full sm:w-auto" pendingText="正在发起…">
            发起议题
          </SubmitButton>
        </SaveBar>
      </form>
    </>
  );
}
