"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { canViewMedia } from "@/lib/access";
import { MAX_ALBUM_MEDIA_BATCH } from "@/lib/media-dedupe";
import { purgeMedia, restoreMedia, softDeleteMedia } from "@/lib/media-lifecycle";
import {
  firstError,
  formArray,
  formString,
  mediaUpdateSchema,
  albumSchema,
  type ActionState,
} from "@/lib/validation";

function revalidatePhotoSurfaces(mediaId?: string) {
  // 删除/恢复会同时影响相册、记录正文、回收站和计数，按布局整体失效，
  // 避免 30 秒客户端缓存里还留着已经隐藏或刚恢复的照片。
  revalidatePath("/photos", "layout");
  revalidatePath("/entries", "layout");
  revalidatePath("/today");
  revalidatePath("/timeline");
  revalidatePath("/trash");
  revalidatePath("/my");
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
      // 可见性变化后旧的去重归属不再成立；释放它，避免后续上传
      // 复用一条已经改变权限范围的媒体。
      ...(media.visibility !== parsed.data.visibility ? { dedupeScope: null } : {}),
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
  const media = await prisma.media.findUnique({ where: { id } });
  if (
    !media ||
    media.householdId !== context.household.id ||
    (media.uploadedBy !== context.user.id && context.role !== "OWNER")
  ) {
    redirect("/photos");
  }
  // 只做软删除：原图和变体保留，仍被记录/旅行引用的照片可以恢复。
  if (media.status === "ACTIVE") await softDeleteMedia(id);
  revalidatePhotoSurfaces();
  redirect("/photos");
}

export async function restoreMediaAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const media = await prisma.media.findUnique({ where: { id } });
  if (
    !media ||
    media.householdId !== context.household.id ||
    (media.uploadedBy !== context.user.id && context.role !== "OWNER")
  ) {
    redirect("/trash");
  }
  const result = await restoreMedia(id);
  revalidatePhotoSurfaces(id);
  revalidatePath("/trash");
  if (!result.ok) {
    redirect(`/trash?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/trash");
}

export async function purgeMediaAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const media = await prisma.media.findUnique({ where: { id } });
  if (
    !media ||
    media.householdId !== context.household.id ||
    (media.uploadedBy !== context.user.id && context.role !== "OWNER")
  ) {
    redirect("/trash");
  }
  // 失败原因写在 Media.purgeError 上，回收站会显示并允许再次尝试。
  const result = await purgeMedia(id);
  revalidatePhotoSurfaces(id);
  revalidatePath("/trash");
  if (!result.ok) {
    redirect(`/trash?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/trash");
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
    // 只删除相册和其中的 AlbumMedia 关联；Media 记录与文件保持原样。
    await prisma.album.delete({ where: { id } });
  }
  revalidatePath("/photos");
  redirect("/photos");
}

export async function addMediaToAlbumAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  const albumId = formString(formData, "albumId");
  const mediaIds = Array.from(new Set(formArray(formData, "mediaIds")));

  if (mediaIds.length === 0) return { error: "请先选择照片" };
  // 超出上限时明确报错，而不是悄悄截断用户的选择。
  if (mediaIds.length > MAX_ALBUM_MEDIA_BATCH) {
    return { error: `一次最多添加 ${MAX_ALBUM_MEDIA_BATCH} 张，请分批放入相册` };
  }

  const album = await prisma.album.findFirst({
    where: { id: albumId, householdId: context.household.id },
    select: { id: true, coverMediaId: true },
  });
  if (!album) return { error: "相册不存在或没有权限" };

  const allowed = await prisma.media.findMany({
    where: {
      id: { in: mediaIds },
      householdId: context.household.id,
      status: "ACTIVE",
      OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
    },
    select: { id: true },
  });
  // 有不存在的、已删除的或无权限的 ID：整批拒绝，避免“选中了却没加进去”。
  if (allowed.length !== mediaIds.length) {
    return { error: "部分照片已不可用，请刷新列表后重新选择" };
  }

  const cover = album.coverMediaId ? null : allowed[0]?.id ?? null;
  await prisma.$transaction([
    ...allowed.map((media) =>
      prisma.albumMedia.upsert({
        where: { albumId_mediaId: { albumId, mediaId: media.id } },
        create: { albumId, mediaId: media.id },
        update: {},
      }),
    ),
    ...(cover
      ? [prisma.album.update({ where: { id: albumId }, data: { coverMediaId: cover } })]
      : []),
  ]);

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
      // 相册关联在软删除时会保留；选下一张封面时必须跳过回收站里的媒体。
      where: { albumId, media: { status: "ACTIVE" } },
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
  const link = await prisma.albumMedia.findFirst({
    where: { albumId, mediaId, media: { status: "ACTIVE" } },
  });
  if (link) {
    await prisma.album.update({ where: { id: albumId }, data: { coverMediaId: mediaId } });
  }
  revalidatePath("/photos");
  revalidatePath(`/photos/albums/${albumId}`);
  redirect(`/photos/albums/${albumId}`);
}
