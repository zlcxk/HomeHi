import { requireContext } from "@/lib/auth";
import { TripForm } from "@/components/travel/TripForm";

export default async function NewTripPage() {
  const context = await requireContext();

  return <TripForm defaultVisibility={context.user.defaultVisibility} />;
}
