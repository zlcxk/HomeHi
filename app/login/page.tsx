import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { getContext, hasHousehold } from "@/lib/auth";

export const metadata: Metadata = { title: "登录" };

export default async function LoginPage() {
  if (!(await hasHousehold())) redirect("/setup");
  const context = await getContext();
  if (context) redirect("/today");

  return (
    <AuthShell
      eyebrow="欢迎回来"
      title={
        <>
          今天也回来了。
          <br />
          家里一切都在。
        </>
      }
      subtitle="输入邮箱和密码，继续你们的记录。"
    >
      <LoginForm />
    </AuthShell>
  );
}
