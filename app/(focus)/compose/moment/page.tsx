import { requireContext } from "@/lib/auth";
import { toLocalInput } from "@/lib/dates";
import { profileOptions, householdTags } from "@/lib/view";
import { MomentComposer } from "@/components/compose/MomentComposer";

export default async function ComposeMomentPage() {
  const context = await requireContext();
  const [profiles, tags] = await Promise.all([profileOptions(context), householdTags(context)]);

  return (
    <MomentComposer
      profiles={profiles}
      tags={tags}
      defaultVisibility={context.user.defaultVisibility}
      defaultOccurredAt={toLocalInput(new Date(), context.household.timezone)}
    />
  );
}
