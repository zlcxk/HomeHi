import { ThemeToggle } from "@/components/ThemeToggle";

export default function AppearanceSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2.5 text-[13px] font-semibold">外观</h2>
        <ThemeToggle />
        <p className="mt-2 text-[10.5px] leading-relaxed text-faint">主题保存在这台设备上。</p>
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold">关于字体</h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">标题字体本地打包，不请求外部服务。</p>
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold">减少动画</h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">跟随系统的「减少动态效果」设置。</p>
      </div>
    </div>
  );
}
