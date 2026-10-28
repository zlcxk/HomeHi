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
        // 图片的缩略图和预览图可能还在后台生成，/thumb 与 /display 会按需补齐。
        thumbUrl:
          media.thumbnailKey || media.mediaType === "IMAGE"
            ? `/api/media/${media.id}/thumb?v=${encodeURIComponent(media.thumbnailKey || "0")}`
            : null,
        displayUrl:
          media.displayKey || media.mediaType === "IMAGE"
            ? `/api/media/${media.id}/display?v=${media.displaySize ?? media.fileSize}`
            : null,
        playbackStatus: media.playbackStatus,
        url: `/api/media/${media.id}/file?v=${media.fileSize}`,
      },
    });
  } catch (error) {
    console.error("[media upload]", error);
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
