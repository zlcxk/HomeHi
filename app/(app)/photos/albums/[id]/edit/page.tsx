import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AlbumForm } from "@/components/photos/AlbumForm";

export default async function EditAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const album = await prisma.album.findFirst({
    where: { id, householdId: context.household.id },
    select: { id: true, name: true, description: true },
  });
  if (!album) notFound();

  return (
    <AlbumForm
      initial={{ id: album.id, name: album.name, description: album.description || "" }}
      backHref={`/photos/albums/${album.id}`}
    />
  );
}
