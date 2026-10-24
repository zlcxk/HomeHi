import { redirect } from "next/navigation";
import { getContext, hasHousehold } from "@/lib/auth";

export default async function RootPage() {
  if (!(await hasHousehold())) redirect("/setup");
  const context = await getContext();
  redirect(context ? "/today" : "/login");
}
