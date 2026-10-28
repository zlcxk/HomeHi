import { CheckCircle2, CircleAlert, Mail } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { smtpStatus } from "@/lib/mailer";
import { TestEmailForm } from "@/components/settings/TestEmailForm";

export default async function EmailSettingsPage() {
  const context = await requireContext();
  const status = smtpStatus();

  return (
    <div className="space-y-5">
      <div className="card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[13px] font-semibold">
              <Mail size={15} className="text-muted" /> SMTP 邮件
            </h2>
          </div>
          {status.configured ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 text-[10.5px] text-sage">
              <CheckCircle2 size={11} /> 已配置
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-2.5 py-1 text-[10.5px] text-danger">
              <CircleAlert size={11} /> 未完成
            </span>
          )}
        </div>

        {status.configured ? (
          <dl className="mt-4 space-y-2 rounded-xl bg-raised/60 px-3.5 py-3 text-[11.5px]">
            <div className="flex justify-between gap-4">
              <dt className="text-faint">服务器</dt>
              <dd className="tabular-nums">
                {status.host}:{status.port}
                {status.secure ? " · TLS" : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-faint">发件人</dt>
              <dd className="truncate">{status.from}</dd>
            </div>
            {status.user ? (
              <div className="flex justify-between gap-4">
                <dt className="text-faint">账号</dt>
                <dd className="truncate">{status.user}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
            提醒会记录在「提醒记录」里，但不会发出邮件。
          </p>
        )}

        <TestEmailForm email={context.user.email} configured={status.configured} />
      </div>
    </div>
  );
}
