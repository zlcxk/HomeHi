import { requireContext } from "@/lib/auth";
import { toLocalInput } from "@/lib/dates";
import { profileOptions, householdTags, recentLocations } from "@/lib/view";
import { MomentComposer } from "@/components/compose/MomentComposer";

export default async function ComposeMomentPage() {
  const context = await requireContext();
  const [profiles, tags, locations] = await Promise.all([
    profileOptions(context),
    householdTags(context),
    recentLocations(context),
  ]);

  return (
    <MomentComposer
      profiles={profiles}
      tags={tags}
      locations={locations}
      defaultVisibility={context.user.defaultVisibility}
      defaultOccurredAt={toLocalInput(new Date(), context.household.timezone)}
    />
  );
}
