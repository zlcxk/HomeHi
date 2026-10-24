import Link from "next/link";
import { ArrowRight, BellRing } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NotificationPrefsForm } from "@/components/settings/NotificationPrefsForm";

export default async function NotificationSettingsPage() {
  const context = await requireContext();
  const pending = await prisma.notification.count({
    where: { householdId: context.household.id, status: "PENDING" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="mb-2.5 text-[13px] font-semibold">邮件通知</h2>
        <NotificationPrefsForm
          notifyEvent={context.user.notifyEvent}
          notifyTask={context.user.notifyTask}
          notifyOther={context.user.notifyOther}
        />
        <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
          日程和待办可以为每个事项单独选择提醒时间。取消或完成事项后，未发送的提醒会自动取消。
        </p>
      </div>

      <Link
        href="/notifications"
        className="card flex items-center gap-3 p-4 transition hover:border-line-strong"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
          <BellRing size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">提醒记录</p>
          <p className="text-[10.5px] text-faint">
            {pending > 0 ? `${pending} 条待发送` : "查看已发送和失败的提醒"}
          </p>
        </div>
        <ArrowRight size={15} className="text-faint" />
      </Link>
    </div>
  );
}
