import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { maxUploadBytes, sanitizeFilename } from "@/lib/media";
import { getStorageDriver, makeStorageKey, removeStoredFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await getApiContext();
  if (!context) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const topicId = formData.get("topicId");

    if (!(file instanceof File) || typeof topicId !== "string") {
      return NextResponse.json({ error: "没有收到文件" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "文件为空" }, { status: 400 });
    }
    if (file.size > maxUploadBytes()) {
      return NextResponse.json(
        { error: `文件超过 ${Math.round(maxUploadBytes() / 1024 / 1024)} MB 上限` },
        { status: 400 },
      );
    }

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, householdId: context.household.id },
      select: { id: true },
    });
    if (!topic) {
      return NextResponse.json({ error: "议题不存在或已删除" }, { status: 404 });
    }

    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 10) || "bin";
    const storageKey = makeStorageKey(extension);
    const driver = await getStorageDriver();
    const buffer = Buffer.from(await file.arrayBuffer());
    await driver.put(storageKey, buffer, file.type || "application/octet-stream");

    try {
      const attachment = await prisma.topicAttachment.create({
        data: {
          topicId: topic.id,
          uploadedBy: context.user.id,
          originalFilename: sanitizeFilename(file.name),
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          storageKey,
          storageDriver: driver.kind,
        },
        select: { id: true, originalFilename: true },
      });
      return NextResponse.json({ attachment });
    } catch (error) {
      await removeStoredFile(storageKey, driver.kind).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("[topic attachment upload]", error);
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
