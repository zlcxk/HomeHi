import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { processMediaUpload } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await getApiContext();
  if (!context) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "没有收到文件" }, { status: 400 });
    }
    const poster = formData.get("poster");
    const stringField = (name: string) => {
      const value = formData.get(name);
      return typeof value === "string" ? value : null;
    };

    const media = await processMediaUpload(
      file,
      poster instanceof File ? poster : null,
      {
        visibility: stringField("visibility") || "HOUSEHOLD",
        clientWidth: stringField("clientWidth"),
        clientHeight: stringField("clientHeight"),
        durationSeconds: stringField("durationSeconds"),
        clientTakenAt: stringField("clientTakenAt"),
      },
      context,
    );

    return NextResponse.json({
      media: {
        id: media.id,
        mediaType: media.mediaType,
        width: media.width,
        height: media.height,
        durationSeconds: media.durationSeconds,
        mimeType: media.mimeType,
        originalFilename: media.originalFilename,
        thumbUrl: media.thumbnailKey ? `/api/media/${media.id}/thumb` : null,
        url: `/api/media/${media.id}/file`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
