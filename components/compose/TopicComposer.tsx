"use client";

import { useActionState, useState } from "react";
import { Flame, MessagesSquare } from "lucide-react";
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
          <label className="label" htmlFor="topic-keyword">
            热门内容关键词
          </label>
          <input
            id="topic-keyword"
            name="keyword"
            maxLength={40}
            placeholder="留空则使用议题标题"
            className="field"
          />
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-faint">
            <Flame size={12} className="mt-0.5 shrink-0 text-accent" />
            发起后会从已接入的内容服务抓取 10 条热门参考，供家人一起看。
          </p>
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
