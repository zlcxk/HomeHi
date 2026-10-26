import { Cloud, HardDrive, Info, ShieldCheck } from "lucide-react";
import { requireContext } from "@/lib/auth";
import {
  STORAGE_KIND_LABEL,
  getStorageConfig,
  storageRoot,
  storageUsage,
} from "@/lib/storage";
import { formatBytes } from "@/lib/format";
import { StorageForm } from "@/components/settings/StorageForm";

export default async function StorageSettingsPage() {
  const context = await requireContext();
  const isOwner = context.role === "OWNER";

  const config = await getStorageConfig();
  const usage = await storageUsage().catch(() => null);
  const oss = config.oss;
  const activeLabel = STORAGE_KIND_LABEL[config.driver];

  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[13px] font-semibold">
              {config.driver === "OSS" ? (
                <Cloud size={15} className="text-muted" />
              ) : (
                <HardDrive size={15} className="text-muted" />
              )}
              照片和视频存放位置
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-faint">
              当前：{activeLabel}
              {config.driver === "OSS" && oss ? ` · ${oss.bucket}` : ""}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 text-[10.5px] text-sage">
            {activeLabel}
          </span>
        </div>

        {usage ? (
          <p className="mt-3 text-[11px] text-faint">
            已用 {formatBytes(usage.bytes)} · {usage.files} 个文件
            {usage.partial ? "（对象较多，统计已截断）" : ""}
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-faint">暂时无法统计当前存储用量。</p>
        )}

        {isOwner ? (
          <StorageForm
            driver={config.driver}
            oss={
              oss
                ? {
                    region: oss.region,
                    bucket: oss.bucket,
                    accessKeyId: oss.accessKeyId,
                    endpoint: oss.endpoint,
                    prefix: oss.prefix,
                    hasSecret: Boolean(oss.accessKeySecret),
                  }
                : null
            }
          />
        ) : (
          <p className="mt-4 text-[11px] text-faint">只有家庭管理员可以修改存储设置。</p>
        )}
      </section>

      <section className="card p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold">
          <Info size={14} className="text-muted" /> 切换存储时会怎样
        </h3>
        <ul className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-muted">
          <li>· 新上传的照片、视频和缩略图会写入当前选择的后端。</li>
          <li>· 已有文件不会自动搬迁，仍从上传时所用的后端读取，所以切换后都能正常打开。</li>
          <li>· 需要整理历史文件时，可以先切到新后端，再把旧文件按需手动迁移。</li>
          <li>
            · 本地存储目录：<code className="rounded bg-raised px-1 py-0.5 text-[10.5px]">{storageRoot()}</code>
            （由环境变量 <code className="rounded bg-raised px-1 py-0.5 text-[10.5px]">STORAGE_DIR</code> 控制）。
          </li>
        </ul>
      </section>

      <section className="card p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold">
          <ShieldCheck size={14} className="text-sage" /> 关于密钥
        </h3>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
          OSS 的 AccessKey 保存在本机的 SQLite 数据库里，用于服务端读写对象；浏览器只会看到经过权限校验的
          <code className="mx-1 rounded bg-raised px-1 py-0.5 text-[10.5px]">/api/media/...</code>
          地址。
        </p>
        <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
          建议在阿里云 RAM 中为 HomeHi 单独创建子账号，只授予该 Bucket 的读写权限，并定期轮换密钥。使用 OSS
          时，<code className="rounded bg-raised px-1 py-0.5">npm run backup</code> 只备份数据库，对象数据请使用
          OSS 的版本控制或跨区域复制功能。
        </p>
      </section>
    </div>
  );
}
