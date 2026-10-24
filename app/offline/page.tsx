import Link from "next/link";

export const metadata = {
  title: "暂时离线",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-raised text-2xl">⌂</div>
      <p className="eyebrow">Offline</p>
      <h1 className="font-display mt-2 text-[38px] leading-none tracking-tight">现在没有网络</h1>
      <p className="mt-4 max-w-[300px] text-[13px] leading-relaxed text-muted">
        HomeHi 的数据都在你自己的家里，但这一页需要联网才能打开。网络恢复后刷新即可。
      </p>
      <Link href="/today" className="btn btn-primary btn-sm mt-8">
        重新连接
      </Link>
    </main>
  );
}
