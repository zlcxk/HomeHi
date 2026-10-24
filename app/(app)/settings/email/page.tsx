import { CheckCircle2, CircleAlert, Mail, ShieldCheck } from "lucide-react";
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
            <p className="mt-1 text-[11px] leading-relaxed text-faint">
              提醒邮件通过你自己的邮箱服务发出，不经过 HomeHi 的服务器。
            </p>
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
          <div className="mt-4 rounded-xl border border-dashed border-line-strong px-3.5 py-3">
            <p className="text-[11.5px] leading-relaxed text-muted">
              在服务器的 <code className="rounded bg-raised px-1 py-0.5 text-[10.5px]">.env</code> 里填写以下变量，然后重启应用：
            </p>
            <ul className="mt-2 space-y-1 font-mono text-[10.5px] text-faint">
              {status.missing.map((key) => (
                <li key={key}>· {key}</li>
              ))}
            </ul>
          </div>
        )}

        <TestEmailForm email={context.user.email} configured={status.configured} />
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold">
          <ShieldCheck size={14} className="text-sage" /> 提醒是怎么发出的
        </h3>
        <ol className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-muted">
          <li>1. 保存日程或待办时，HomeHi 会预先计算未来 180 天的提醒，写成待发送记录。</li>
          <li>2. 独立的后台进程 <code className="rounded bg-raised px-1 py-0.5 text-[10.5px]">npm run worker</code> 每分钟检查一次到期提醒并发送。</li>
          <li>3. 发送失败会自动重试，最多 5 次；修改或取消事项时，旧提醒会被取消，不会重复发送。</li>
        </ol>
        <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
          如果使用 Docker 部署，请同时启动 web 和 worker 两个服务。开发环境下运行 <code className="rounded bg-raised px-1 py-0.5">npm run dev:all</code>。
        </p>
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold">没有邮件服务器？</h3>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
          可以先不配置。日程和待办照常使用，提醒会记录在「提醒记录」里但不会发出。之后配置好 SMTP，新的提醒就会正常发送。
        </p>
      </div>
    </div>
  );
}
