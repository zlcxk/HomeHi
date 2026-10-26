import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SetupForm } from "@/components/auth/SetupForm";
import { getContext, hasHousehold } from "@/lib/auth";

export const metadata: Metadata = { title: "建立家庭空间" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasHousehold()) redirect("/login");
  const context = await getContext();
  if (context) redirect("/today");

  return (
    <AuthShell
      eyebrow="第一次见面"
      title={
        <>
          建立你家的
          <br />
          私人空间。
        </>
      }
      subtitle="只需要一分钟。这里没有公开主页，也没有陌生人，只有你们自己的日子。"
    >
      <SetupForm />
    </AuthShell>
  );
}
