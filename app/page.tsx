import { redirect } from "next/navigation";
import { getContext, hasHousehold } from "@/lib/auth";

// 这个页面在请求时需要读数据库和 cookie，不能在构建期预渲染。
// 否则 `next build` 会在没有 DATABASE_URL 的构建环境里连库失败。
export const dynamic = "force-dynamic";

export default async function RootPage() {
  if (!(await hasHousehold())) redirect("/setup");
  const context = await getContext();
  redirect(context ? "/today" : "/login");
}
