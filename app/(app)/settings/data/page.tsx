import Link from "next/link";
import { Download, HardDrive, Sparkles, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { STORAGE_KIND_LABEL, getStorageConfig, storageUsage } from "@/lib/storage";
import { formatBytes } from "@/lib/format";
import { DEMO_SETTING_KEY, LAST_EXPORT_SETTING_KEY } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";
import { seedDemoAction, clearDemoAction } from "@/app/actions/demo";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";

export default async function DataSettingsPage() {
  const context = await requireContext();
  const isOwner = context.role === "OWNER";

  const [config, usage, demoSetting, exportSetting, demoCounts, trashCount] = await Promise.all([
    getStorageConfig(),
    storageUsage().catch(() => null),
    prisma.appSetting.findUnique({ where: { key: DEMO_SETTING_KEY } }),
    prisma.appSetting.findUnique({ where: { key: LAST_EXPORT_SETTING_KEY } }),
    prisma.entry.count({ where: { householdId: context.household.id, isDemo: true } }),
    prisma.entry.count({ where: { householdId: context.household.id, status: "DELETED" } }),
  ]);

  const demoSeeded = demoSetting?.value === "true";

  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold">
          <Download size={15} className="text-muted" /> 导出全部数据
        </h2>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
          下载一个 ZIP：结构化数据（JSON）加上所有原始照片、视频和缩略图。随时可以带走，不锁定在 HomeHi 里。
        </p>
        {exportSetting?.value ? (
          <p className="mt-2 text-[10.5px] text-faint">
            上次导出：{formatDateTime(exportSetting.value, context.household.timezone)}
          </p>
        ) : (
          <p className="mt-2 text-[10.5px] text-faint">还没有导出过。</p>
        )}
        {isOwner ? (
          <div className="mt-4">
            <a href="/api/export" className="btn btn-primary btn-sm" download>
              <Download size={14} /> 下载 ZIP
            </a>
            <p className="field-hint">导出包含私密内容，请保存在安全的位置。</p>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-faint">只有家庭管理员可以导出全部数据。</p>
        )}
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold">
          <Sparkles size={15} className="text-accent" /> 示例数据
        </h2>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
          首次使用时可以载入一组示例：几张照片、几段记录、两位家人、日程和待办。所有示例内容都带「示例」标记，可以一键清空。
        </p>
        {demoSeeded ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-faint">
              已载入 {demoCounts} 条示例记录，照片由本地生成，不来自网络。
            </span>
            {isOwner ? (
              <form action={clearDemoAction}>
                <ConfirmButton
                  className="btn btn-outline btn-sm text-danger"
                  message="清空所有示例数据？示例记录、照片、日程、待办和示例家人档案都会被移除。你自己创建的内容不受影响。"
                  pendingText="清理中…"
                >
                  <Trash2 size={13} /> 清空示例
                </ConfirmButton>
              </form>
            ) : null}
          </div>
        ) : isOwner ? (
          <form action={seedDemoAction} className="mt-4">
            <SubmitButton className="btn btn-outline btn-sm" pendingText="生成中…">
              <Sparkles size={13} /> 载入示例数据
            </SubmitButton>
          </form>
        ) : (
          <p className="mt-3 text-[11px] text-faint">只有家庭管理员可以载入示例数据。</p>
        )}
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold">
          <HardDrive size={15} className="text-muted" /> 存储占用
        </h2>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="display-number text-[34px]">
            {usage ? formatBytes(usage.bytes) : "—"}
          </span>
          <span className="text-[11px] text-faint">
            {usage ? `${usage.files} 个文件` : "暂时无法统计"}
          </span>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
          当前后端：{STORAGE_KIND_LABEL[config.driver]}。{" "}
          <Link href="/settings/storage" className="underline underline-offset-2 hover:text-ink">
            修改存储设置
          </Link>
        </p>
      </section>

      <Link
        href="/trash"
        className="card flex items-center gap-3 p-4 transition hover:border-line-strong"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-raised text-muted">
          <Trash2 size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">回收站</p>
          <p className="text-[10.5px] text-faint">
            {trashCount > 0 ? `${trashCount} 条已删除的记录` : "没有待处理的记录"}
          </p>
        </div>
      </Link>
    </div>
  );
}
