import { requireContext } from "@/lib/auth";
import { profileOptions, memberOptions } from "@/lib/view";
import { smtpStatus } from "@/lib/mailer";
import { TaskComposer } from "@/components/compose/TaskComposer";

export default async function ComposeTaskPage() {
  const context = await requireContext();
  const [profiles, members] = await Promise.all([
    profileOptions(context),
    memberOptions(context),
  ]);

  return (
    <TaskComposer
      profiles={profiles}
      members={members}
      defaultVisibility={context.user.defaultVisibility}
      smtpConfigured={smtpStatus().configured}
    />
  );
}
