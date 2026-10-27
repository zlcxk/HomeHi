import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mediaWhere } from "@/lib/access";
import { addMediaToAlbumAction } from "@/app/actions/media";
import { MediaPicker } from "@/components/photos/MediaPicker";

export default async function AddAlbumMediaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };

  const album = await prisma.album.findFirst({
    where: { id, householdId: context.household.id },
    include: { media: { select: { mediaId: true } } },
  });
  if (!album) notFound();

  const existing = new Set(album.media.map((link) => link.mediaId));
  const media = await prisma.media.findMany({
    where: { ...mediaWhere(viewer), id: { notIn: Array.from(existing) } },
    orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
    take: 300,
    select: { id: true, mediaType: true, thumbnailKey: true, caption: true },
  });

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
        items={media.map((item) => ({
          id: item.id,
          mediaType: item.mediaType,
          thumbUrl: item.thumbnailKey ? `/api/media/${item.id}/thumb` : null,
          caption: item.caption,
        }))}
        action={addMediaToAlbumAction}
        hidden={{ albumId: album.id }}
      />
    </div>
  );
}
