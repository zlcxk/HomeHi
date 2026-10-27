import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorageDriver } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getApiContext();
  if (!context) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await params;
  const attachment = await prisma.topicAttachment.findUnique({
    where: { id },
    include: { topic: { select: { householdId: true } } },
  });
  if (!attachment || attachment.topic.householdId !== context.household.id) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  const driver = await getStorageDriver(attachment.storageDriver);
  const stat = await driver.stat(attachment.storageKey);
  if (!stat) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  const object = await driver.get(attachment.storageKey);
  if (!object) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  // 议题附件可能是任意类型，统一作为下载处理，避免浏览器内联执行。
  return new Response(Readable.toWeb(object.stream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        attachment.originalFilename,
      )}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
