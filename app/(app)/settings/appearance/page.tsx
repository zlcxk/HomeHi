import { ThemeToggle } from "@/components/ThemeToggle";

export default function AppearanceSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2.5 text-[13px] font-semibold">外观</h2>
        <ThemeToggle />
        <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
          主题保存在这台设备上。系统模式会跟随设备的深色设置自动切换。
        </p>
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold">关于字体</h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          HomeHi 使用本地打包的 Instrument Serif 作为标题字体，不请求外部字体服务。即使断网或在家里的旧手机上，页面也会保持一样的样子。
        </p>
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold">减少动画</h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          如果系统开启了「减少动态效果」，HomeHi 会自动关闭大部分过渡和动画。
        </p>
      </div>
    </div>
  );
}
