import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAlbumPickerPage } from "@/lib/media-query";
import { addMediaToAlbumAction } from "@/app/actions/media";
import { MediaPicker } from "@/components/photos/MediaPicker";

export default async function AddAlbumMediaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };

  const album = await prisma.album.findFirst({
    where: { id, householdId: context.household.id },
    select: { id: true, name: true },
  });
  if (!album) notFound();

  const initialPage = await getAlbumPickerPage(viewer, album.id, context.household.timezone);

  return (
    <div>
      <header className="mb-6">
        <Link
          href={`/photos/albums/${album.id}`}
          className="icon-btn icon-btn-plain -ml-2 mb-3"
          aria-label="返回相册"
        >
          <ArrowLeft size={19} strokeWidth={1.8} />
        </Link>
        <p className="eyebrow">Add photos</p>
        <h1 className="font-display mt-1 text-[32px] leading-tight">放进「{album.name}」</h1>
      </header>

      <MediaPicker
        albumId={album.id}
        initialItems={initialPage.items}
        initialCursor={initialPage.nextCursor}
        action={addMediaToAlbumAction}
      />
    </div>
  );
}
