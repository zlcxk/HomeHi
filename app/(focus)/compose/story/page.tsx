import { requireContext } from "@/lib/auth";
import { toLocalInput } from "@/lib/dates";
import { profileOptions, householdTags } from "@/lib/view";
import { StoryComposer } from "@/components/compose/StoryComposer";

export default async function ComposeStoryPage() {
  const context = await requireContext();
  const [profiles, tags] = await Promise.all([profileOptions(context), householdTags(context)]);

  return (
    <StoryComposer
      profiles={profiles}
      tags={tags}
      defaultVisibility={context.user.defaultVisibility}
      defaultOccurredAt={toLocalInput(new Date(), context.household.timezone)}
    />
  );
}
