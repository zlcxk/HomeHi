"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { canViewMedia } from "@/lib/access";
import {
  firstError,
  formArray,
  formString,
  mediaUpdateSchema,
  albumSchema,
  type ActionState,
} from "@/lib/validation";

function revalidatePhotoSurfaces(mediaId?: string) {
  revalidatePath("/photos");
  revalidatePath("/today");
  revalidatePath("/timeline");
  if (mediaId) revalidatePath(`/photos/${mediaId}`);
}

export async function updateMediaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  const id = formString(formData, "id");
  const parsed = mediaUpdateSchema.safeParse({
    caption: formString(formData, "caption"),
    favorite: formString(formData, "favorite") === "true",
    visibility: formString(formData, "visibility") || "HOUSEHOLD",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const media = await prisma.media.findUnique({ where: { id } });
  if (!media || !canViewMedia(media, { userId: context.user.id, householdId: context.household.id })) {
    return { error: "照片不存在或没有权限" };
  }
  if (media.uploadedBy !== context.user.id && context.role !== "OWNER") {
    return { error: "只有上传者可以修改这张照片" };
  }

  await prisma.media.update({
    where: { id },
    data: {
      caption: parsed.data.caption || null,
      favorite: parsed.data.favorite,
      visibility: parsed.data.visibility,
    },
  });
  revalidatePhotoSurfaces(id);
  return { success: "已保存" };
}

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media || !canViewMedia(media, { userId: context.user.id, householdId: context.household.id })) {
    redirect("/photos");
  }
  await prisma.media.update({ where: { id }, data: { favorite: !media.favorite } });
  revalidatePhotoSurfaces(id);
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const media = await prisma.media.findUnique({
    where: { id },
    include: { entryLinks: true, albumLinks: true },
  });
  if (
    !media ||
    media.householdId !== context.household.id ||
    (media.uploadedBy !== context.user.id && context.role !== "OWNER")
  ) {
    redirect("/photos");
  }
  if (media.status === "ACTIVE") {
    await prisma.media.update({
      where: { id },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    await prisma.albumMedia.deleteMany({ where: { mediaId: id } });
  }
  revalidatePhotoSurfaces();
  redirect("/photos");
}

export async function saveAlbumAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  const id = formString(formData, "id");
  const parsed = albumSchema.safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  if (id) {
    const album = await prisma.album.findUnique({ where: { id } });
    if (!album || album.householdId !== context.household.id) return { error: "相册不存在" };
    await prisma.album.update({
      where: { id },
      data: { name: parsed.data.name, description: parsed.data.description || null },
    });
    revalidatePath("/photos");
    revalidatePath(`/photos/albums/${id}`);
    redirect(`/photos/albums/${id}`);
  }

  const album = await prisma.album.create({
    data: {
      householdId: context.household.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      createdBy: context.user.id,
    },
  });
  revalidatePath("/photos");
  redirect(`/photos/albums/${album.id}`);
}

export async function deleteAlbumAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const album = await prisma.album.findUnique({ where: { id } });
  if (album && album.householdId === context.household.id) {
    await prisma.album.delete({ where: { id } });
  }
  revalidatePath("/photos");
  redirect("/photos");
}

export async function addMediaToAlbumAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const albumId = formString(formData, "albumId");
  const mediaIds = Array.from(new Set(formArray(formData, "mediaIds"))).slice(0, 200);

  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album || album.householdId !== context.household.id) redirect("/photos");

  const allowed = mediaIds.length
    ? await prisma.media.findMany({
        where: {
          id: { in: mediaIds },
          householdId: context.household.id,
          status: "ACTIVE",
          OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
        },
        select: { id: true },
      })
    : [];

  for (const media of allowed) {
    await prisma.albumMedia.upsert({
      where: { albumId_mediaId: { albumId, mediaId: media.id } },
      create: { albumId, mediaId: media.id },
      update: {},
    });
  }
  if (!album.coverMediaId && allowed[0]) {
    await prisma.album.update({ where: { id: albumId }, data: { coverMediaId: allowed[0].id } });
  }

  revalidatePath("/photos");
  revalidatePath(`/photos/albums/${albumId}`);
  redirect(`/photos/albums/${albumId}`);
}

export async function removeMediaFromAlbumAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const albumId = formString(formData, "albumId");
  const mediaId = formString(formData, "mediaId");
  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album || album.householdId !== context.household.id) redirect("/photos");

  await prisma.albumMedia.deleteMany({ where: { albumId, mediaId } });
  if (album.coverMediaId === mediaId) {
    const next = await prisma.albumMedia.findFirst({
      where: { albumId },
      orderBy: { sortOrder: "asc" },
    });
    await prisma.album.update({
      where: { id: albumId },
      data: { coverMediaId: next?.mediaId ?? null },
    });
  }
  revalidatePath("/photos");
  revalidatePath(`/photos/albums/${albumId}`);
  redirect(`/photos/albums/${albumId}`);
}

export async function setAlbumCoverAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const albumId = formString(formData, "albumId");
  const mediaId = formString(formData, "mediaId");
  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album || album.householdId !== context.household.id) redirect("/photos");
  const link = await prisma.albumMedia.findUnique({
    where: { albumId_mediaId: { albumId, mediaId } },
  });
  if (link) {
    await prisma.album.update({ where: { id: albumId }, data: { coverMediaId: mediaId } });
  }
  revalidatePath("/photos");
  revalidatePath(`/photos/albums/${albumId}`);
  redirect(`/photos/albums/${albumId}`);
}
