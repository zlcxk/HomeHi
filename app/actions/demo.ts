"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth";
import { clearDemoData, seedDemoData } from "@/lib/demo";

export async function seedDemoAction(): Promise<void> {
  const context = await getContext();
  if (!context || context.role !== "OWNER") return;
  await seedDemoData({
    householdId: context.household.id,
    userId: context.user.id,
    timezone: context.household.timezone,
  });
  revalidatePath("/", "layout");
}

export async function clearDemoAction(): Promise<void> {
  const context = await getContext();
  if (!context || context.role !== "OWNER") return;
  await clearDemoData(context.household.id);
  revalidatePath("/", "layout");
}
