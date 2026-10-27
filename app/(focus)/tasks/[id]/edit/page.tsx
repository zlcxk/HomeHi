import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toDateInput, toLocalInput } from "@/lib/dates";
import { parseStringArray } from "@/lib/json";
import { parseOffsets } from "@/lib/reminders";
import { assetOptions, profileOptions, memberOptions, recentLocations } from "@/lib/view";
import { smtpStatus } from "@/lib/mailer";
import { TaskComposer, type TaskInitial } from "@/components/compose/TaskComposer";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const timezone = context.household.timezone;

  const task = await prisma.task.findFirst({
    where: {
      id,
      householdId: context.household.id,
      OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
    },
  });
  if (!task) notFound();

  const [profiles, members, assets, locations, rule] = await Promise.all([
    profileOptions(context),
    memberOptions(context),
    assetOptions(context),
    recentLocations(context),
    prisma.reminderRule.findUnique({
      where: { targetType_targetId: { targetType: "TASK", targetId: id } },
    }),
  ]);

  const initial: TaskInitial = {
    id: task.id,
    title: task.title,
    description: task.description || "",
    location: task.location || "",
    dueAt: task.dueAt ? toLocalInput(task.dueAt, timezone) : "",
    priority: task.priority,
    assigneeUserId: task.assigneeUserId || "",
    recurrenceType: task.recurrenceType,
    recurrenceInterval: task.recurrenceInterval,
    recurrenceUntil: task.recurrenceUntil ? toDateInput(task.recurrenceUntil, timezone) : "",
    visibility: task.visibility,
    reminderOffsets: rule?.enabled ? parseOffsets(rule.offsets) : [],
    relatedProfileIds: parseStringArray(task.relatedProfileIds),
    relatedAssetIds: parseStringArray(task.relatedAssetIds),
  };

  return (
    <TaskComposer
      profiles={profiles}
      members={members}
      assets={assets}
      locations={locations}
      defaultVisibility={context.user.defaultVisibility}
      smtpConfigured={smtpStatus().configured}
      initial={initial}
      backHref="/tasks"
    />
  );
}
