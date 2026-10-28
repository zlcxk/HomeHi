import { Cloud, HardDrive } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { STORAGE_KIND_LABEL, getStorageConfig, storageUsage } from "@/lib/storage";
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
    </div>
  );
}
