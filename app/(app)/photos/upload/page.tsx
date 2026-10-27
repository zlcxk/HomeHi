import { requireContext } from "@/lib/auth";
import { PhotoUploadScreen } from "@/components/photos/PhotoUploadScreen";

export default async function PhotoUploadPage() {
  const context = await requireContext();

  return <PhotoUploadScreen defaultVisibility={context.user.defaultVisibility} />;
}
