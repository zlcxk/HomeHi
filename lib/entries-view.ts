import type { Prisma } from "@prisma/client";

export const entryCardInclude = {
  media: { orderBy: { sortOrder: "asc" }, include: { media: true } },
  profiles: {
    include: {
      profile: { select: { id: true, name: true, profileType: true } },
    },
  },
  tags: { include: { tag: { select: { name: true } } } },
  creator: { select: { id: true, displayName: true, avatarMediaId: true } },
} satisfies Prisma.EntryInclude;

export type EntryCardRecord = Prisma.EntryGetPayload<{ include: typeof entryCardInclude }>;

export type EntryCardMedia = {
  id: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  thumbUrl: string | null;
  /** 大图卡片（单张照片）用 960px 预览图，避免列表里被放大发虚。 */
  displayUrl: string | null;
  url: string;
};

export type EntryCardData = {
  id: string;
  entryType: string;
  title: string | null;
  body: string | null;
  location: string | null;
  occurredAt: string;
  visibility: string;
  status: string;
  isDemo: boolean;
  creatorName: string;
  creatorAvatarUrl: string | null;
  media: EntryCardMedia[];
  profiles: { id: string; name: string; profileType: string }[];
  tags: string[];
};

export function toEntryCard(
  entry: EntryCardRecord,
  viewer: { userId: string },
): EntryCardData {
  return {
    id: entry.id,
    entryType: entry.entryType,
    title: entry.title,
    body: entry.body,
    location: entry.location,
    occurredAt: entry.occurredAt.toISOString(),
    visibility: entry.visibility,
    status: entry.status,
    isDemo: entry.isDemo,
    creatorName: entry.creator.displayName,
    creatorAvatarUrl: entry.creator.avatarMediaId
      ? `/api/media/${entry.creator.avatarMediaId}/thumb`
      : null,
    media: entry.media
      .map((link) => link.media)
      .filter((media) => media.status === "ACTIVE")
      .filter((media) => media.visibility === "HOUSEHOLD" || media.uploadedBy === viewer.userId)
      .map((media) => ({
        id: media.id,
        mediaType: media.mediaType,
        width: media.width,
        height: media.height,
        durationSeconds: media.durationSeconds,
        // 图片即使还没有缩略图也可以走 /thumb：接口会按需生成，失败时回退到原图。
        thumbUrl:
          media.mediaType === "VIDEO"
            ? media.thumbnailKey
              ? `/api/media/${media.id}/thumb?v=${encodeURIComponent(media.thumbnailKey)}`
              : null
            : `/api/media/${media.id}/thumb?v=${encodeURIComponent(media.thumbnailKey || "0")}`,
        // 动图没有 960 预览图，退回缩略图，避免列表直接加载大体积原文件。
        displayUrl:
          media.mediaType === "IMAGE" && media.displayStatus === "READY" && media.displayKey
            ? `/api/media/${media.id}/display?v=${encodeURIComponent(media.displayKey)}`
            : null,
        url: `/api/media/${media.id}/file?v=${media.fileSize}`,
      })),
    profiles: entry.profiles.map((link) => ({
      id: link.profile.id,
      name: link.profile.name,
      profileType: link.profile.profileType,
    })),
    tags: entry.tags.map((link) => link.tag.name),
  };
}
