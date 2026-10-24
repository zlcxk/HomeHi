import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/Brand";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Brand />
      <p className="eyebrow mt-10">404 · Not found</p>
      <h1 className="font-display mt-3 text-[40px] leading-none">这里什么也没有。</h1>
      <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-muted">
        可能它被删除了，或者链接不太对。回到今天看看。
      </p>
      <Link href="/today" className="btn btn-primary mt-7">
        <ArrowLeft size={16} /> 回到今天
      </Link>
    </main>
  );
}
