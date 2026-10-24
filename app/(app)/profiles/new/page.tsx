import { requireContext } from "@/lib/auth";
import { ProfileForm } from "@/components/profiles/ProfileForm";

export default async function NewProfilePage() {
  const context = await requireContext();
  return <ProfileForm defaultVisibility={context.user.defaultVisibility} />;
}
