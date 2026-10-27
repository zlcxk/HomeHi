import { requireContext } from "@/lib/auth";
import { assetOptions, profileOptions, memberOptions } from "@/lib/view";
import { smtpStatus } from "@/lib/mailer";
import { TaskComposer } from "@/components/compose/TaskComposer";

const RECURRENCE_TYPES = new Set(["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);

export default async function ComposeTaskPage({
  searchParams,
}: {
  searchParams: Promise<{
    title?: string;
    due?: string;
    assetId?: string;
    repeat?: string;
    every?: string;
    remind?: string;
  }>;
}) {
  const context = await requireContext();
  const params = await searchParams;
  const [profiles, members, assets] = await Promise.all([
    profileOptions(context),
    memberOptions(context),
    assetOptions(context),
  ]);

  const dueParam = (params.due || "").trim();
  const defaultDueAt = dueParam
    ? dueParam.includes("T")
      ? dueParam
      : `${dueParam}T09:00`
    : "";
  const repeat = (params.repeat || "").toUpperCase();
  const every = Math.max(1, Math.min(99, Number(params.every) || 1));
  const remind = Number(params.remind);

  return (
    <TaskComposer
      profiles={profiles}
      members={members}
      assets={assets}
      defaultVisibility={context.user.defaultVisibility}
      smtpConfigured={smtpStatus().configured}
      defaultTitle={(params.title || "").slice(0, 160)}
      defaultDueAt={defaultDueAt}
      defaultAssetIds={params.assetId ? [params.assetId] : []}
      defaultRecurrence={
        RECURRENCE_TYPES.has(repeat) && repeat !== "NONE"
          ? { type: repeat, interval: every }
          : undefined
      }
      defaultReminderOffsets={
        Number.isFinite(remind) && remind > 0 ? [Math.min(remind, 525_600)] : []
      }
    />
  );
}
