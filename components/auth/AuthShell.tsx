import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-1/4 h-[420px] w-[420px] rounded-full bg-accent-soft opacity-60 blur-[90px]" />
        <div className="absolute -right-24 bottom-0 h-[380px] w-[380px] rounded-full bg-sage-soft opacity-70 blur-[100px]" />
      </div>

      <div className="mx-auto grid min-h-dvh w-full max-w-[1180px] lg:grid-cols-[1.06fr_0.94fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line px-12 py-10 lg:flex xl:px-16">
          <Brand />

          <div className="relative z-10 max-w-[470px] py-8">
            <p className="eyebrow mb-5">A quiet place for your days</p>
            <h2 className="font-display text-[62px] leading-[0.97] tracking-tight xl:text-[72px]">
              把日子
              <br />
              好好收起来。
            </h2>
            <p className="mt-7 max-w-[360px] text-[14px] leading-[1.9] text-muted">
              照片、故事、家人的重要日子，放在一个只属于你家的地方。
              不必整理得很好，先记下来就好。
            </p>

            <div className="relative mt-10 h-[280px] w-[330px]">
              <div className="grain absolute bottom-0 left-0 h-[270px] w-[250px] overflow-hidden rounded-t-full border border-line bg-[linear-gradient(160deg,var(--accent-soft),var(--paper)_45%,var(--sage-soft))]">
                <div className="absolute bottom-0 left-1/2 h-[150px] w-[180px] -translate-x-1/2 rounded-t-full bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_38%,transparent),color-mix(in_srgb,var(--gold)_24%,transparent))] opacity-70 blur-[2px]" />
                <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] tracking-[0.3em] text-muted">
                  2026 · 家的记忆
                </div>
              </div>
              <div className="absolute bottom-0 right-2 h-[170px] w-[130px] overflow-hidden rounded-t-full border border-line bg-surface/90 p-3 backdrop-blur">
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <span className="font-display text-[36px] leading-none">24</span>
                  <span className="eyebrow">October</span>
                  <span className="mt-1 text-[10.5px] text-faint">今天，也值得记住</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5 text-[10.5px] tracking-[0.12em] text-faint">
            <span>数据私有</span>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <span>邮件提醒</span>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <span>可完整导出</span>
          </div>
        </section>

        <section className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-[392px]">
            <div className="mb-9 flex items-center justify-between lg:hidden">
              <Brand compact />
              <span className="eyebrow">私人家庭空间</span>
            </div>
            <p className="eyebrow mb-2.5">{eyebrow}</p>
            <h1 className="font-display text-[38px] leading-[1.04] tracking-tight sm:text-[42px]">{title}</h1>
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-7">{footer}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
