import { requireContext } from "@/lib/auth";
import { toLocalInput } from "@/lib/dates";
import { profileOptions, householdTags, recentLocations } from "@/lib/view";
import { StoryComposer } from "@/components/compose/StoryComposer";

export default async function ComposeStoryPage() {
  const context = await requireContext();
  const [profiles, tags, locations] = await Promise.all([
    profileOptions(context),
    householdTags(context),
    recentLocations(context),
  ]);

  return (
    <StoryComposer
      profiles={profiles}
      tags={tags}
      locations={locations}
      defaultVisibility={context.user.defaultVisibility}
      defaultOccurredAt={toLocalInput(new Date(), context.household.timezone)}
    />
  );
}
