import { requireContext } from "@/lib/auth";
import { AssetForm } from "@/components/assets/AssetForm";

export default async function NewAssetPage() {
  const context = await requireContext();

  return <AssetForm defaultVisibility={context.user.defaultVisibility} />;
}
