import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assetWhere } from "@/lib/access";
import { toDateInput } from "@/lib/dates";
import { AssetForm, type AssetInitial } from "@/components/assets/AssetForm";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const timezone = context.household.timezone;
  const viewer = { userId: context.user.id, householdId: context.household.id };

  const asset = await prisma.asset.findFirst({ where: { id, ...assetWhere(viewer) } });
  if (!asset) notFound();

  const photo = asset.photoMediaId
    ? await prisma.media.findFirst({
        where: {
          id: asset.photoMediaId,
          householdId: context.household.id,
          status: "ACTIVE",
          OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
        },
        select: { id: true },
      })
    : null;

  const initial: AssetInitial = {
    id: asset.id,
    name: asset.name,
    category: asset.category,
    status: asset.status,
    brand: asset.brand || "",
    model: asset.model || "",
    serialNumber: asset.serialNumber || "",
    location: asset.location || "",
    purchaseDate: asset.purchaseDate ? toDateInput(asset.purchaseDate, timezone) : "",
    purchasePrice: asset.purchasePrice !== null ? String(asset.purchasePrice) : "",
    vendor: asset.vendor || "",
    warrantyUntil: asset.warrantyUntil ? toDateInput(asset.warrantyUntil, timezone) : "",
    maintenanceEveryDays:
      asset.maintenanceEveryDays !== null ? String(asset.maintenanceEveryDays) : "",
    insuranceUntil: asset.insuranceUntil ? toDateInput(asset.insuranceUntil, timezone) : "",
    insuranceProvider: asset.insuranceProvider || "",
    notes: asset.notes || "",
    visibility: asset.visibility,
    photoUrl: photo ? `/api/media/${photo.id}/thumb` : null,
    photoMediaId: photo?.id ?? null,
  };

  return <AssetForm initial={initial} defaultVisibility={context.user.defaultVisibility} />;
}
