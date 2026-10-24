"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { formString } from "@/lib/validation";

export async function retryNotificationAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (
    !notification ||
    notification.householdId !== context.household.id ||
    (notification.recipientUserId && notification.recipientUserId !== context.user.id)
  ) {
    redirect("/notifications");
  }

  if (notification.status === "FAILED") {
    await prisma.notification.update({
      where: { id },
      data: {
        status: "PENDING",
        nextAttemptAt: new Date(),
        lastError: null,
      },
    });
  }

  revalidatePath("/notifications");
  redirect("/notifications");
}
