import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeMediaListView } from "@/lib/media-list";
import {
  getAlbumMediaPage,
  getAlbumPickerPage,
  getPhotoMediaPage,
} from "@/lib/media-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 列表分页接口。每页条数固定，客户端只传游标；
 * 相册相关模式必须先确认相册属于当前家庭。
 */
export async function GET(request: Request) {
  const context = await getApiContext();
  if (!context) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;
  const cursor = searchParams.get("cursor");
  const albumId = searchParams.get("albumId");
  const mode = searchParams.get("mode");

  if (albumId) {
    const album = await prisma.album.findFirst({
      where: { id: albumId, householdId: context.household.id },
      select: { id: true },
    });
    if (!album) return NextResponse.json({ error: "相册不存在" }, { status: 404 });

    const page =
      mode === "picker"
        ? await getAlbumPickerPage(viewer, albumId, timezone, cursor)
        : await getAlbumMediaPage(viewer, albumId, timezone, cursor);
    return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
  }

  const page = await getPhotoMediaPage(viewer, timezone, {
    view: normalizeMediaListView(searchParams.get("view")),
    cursor,
  });
  return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
}
