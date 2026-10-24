import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getApiContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureSafeKey } from "@/lib/storage";
import { LAST_EXPORT_SETTING_KEY } from "@/lib/constants";
import { DateTime } from "luxon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getApiContext();
  if (!context) return new Response("请先登录", { status: 401 });
  if (context.role !== "OWNER") return new Response("只有家庭管理员可以导出数据", { status: 403 });

  const householdId = context.household.id;
  const [
    household,
    members,
    profiles,
    entries,
    media,
    albums,
    events,
    tasks,
    completions,
    rules,
    notifications,
    settings,
  ] = await Promise.all([
    prisma.household.findUnique({ where: { id: householdId } }),
    prisma.householdMember.findMany({
      where: { householdId },
      include: { user: { select: { id: true, email: true, displayName: true, timezone: true, createdAt: true } } },
    }),
    prisma.familyProfile.findMany({ where: { householdId } }),
    prisma.entry.findMany({
      where: { householdId },
      include: {
        media: { include: { media: { select: { id: true, originalFilename: true, mimeType: true } } } },
        tags: { include: { tag: { select: { name: true } } } },
        profiles: { select: { profileId: true } },
      },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.media.findMany({ where: { householdId }, orderBy: { createdAt: "asc" } }),
    prisma.album.findMany({
      where: { householdId },
      include: { media: { select: { mediaId: true, sortOrder: true } } },
    }),
    prisma.calendarEvent.findMany({ where: { householdId }, orderBy: { startsAt: "asc" } }),
    prisma.task.findMany({ where: { householdId }, orderBy: { createdAt: "asc" } }),
    prisma.taskCompletion.findMany({
      where: { task: { householdId } },
      orderBy: { completedAt: "asc" },
    }),
    prisma.reminderRule.findMany({ where: { householdId } }),
    prisma.notification.findMany({ where: { householdId }, orderBy: { scheduledAt: "asc" } }),
    prisma.appSetting.findMany({ where: { householdId } }),
  ]);

  const data = {
    format: "homehi-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    timezone: context.household.timezone,
    household,
    members: members.map((member) => ({
      id: member.id,
      role: member.role,
      createdAt: member.createdAt,
      user: member.user,
    })),
    profiles,
    entries: entries.map((entry) => ({
      ...entry,
      media: entry.media.map((link) => ({
        mediaId: link.mediaId,
        sortOrder: link.sortOrder,
        caption: link.caption,
        filename: link.media.originalFilename,
        mimeType: link.media.mimeType,
      })),
      tags: entry.tags.map((link) => link.tag.name),
      profileIds: entry.profiles.map((link) => link.profileId),
    })),
    media: media.map((item) => ({
      id: item.id,
      originalFilename: item.originalFilename,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      mediaType: item.mediaType,
      width: item.width,
      height: item.height,
      durationSeconds: item.durationSeconds,
      takenAt: item.takenAt,
      caption: item.caption,
      favorite: item.favorite,
      visibility: item.visibility,
      status: item.status,
      createdAt: item.createdAt,
      file: `media/${item.id}-${item.originalFilename}`,
    })),
    albums,
    events,
    tasks,
    taskCompletions: completions,
    reminderRules: rules,
    notifications,
    settings,
  };

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.append(
    `HomeHi 数据导出\n\n导出时间：${new Date().toISOString()}\n家庭：${household?.name ?? ""}\n\nhomehi-data.json 包含完整结构化数据；media/ 目录是原始文件。\n照片仍受原隐私设置约束，请妥善保管这个压缩包。\n`,
    { name: "README.txt" },
  );
  archive.append(JSON.stringify(data, null, 2), { name: "homehi-data.json" });

  for (const item of media) {
    const filename = `${item.id}-${item.originalFilename.replace(/[\\/:*?"<>|]/g, "_")}`;
    archive.file(ensureSafeKey(item.storageKey), { name: `media/${filename}` });
    if (item.thumbnailKey) {
      archive.file(ensureSafeKey(item.thumbnailKey), {
        name: `media/thumbs/${item.id}.webp`,
      });
    }
  }

  void archive.finalize();

  await prisma.appSetting.upsert({
    where: { key: LAST_EXPORT_SETTING_KEY },
    create: {
      key: LAST_EXPORT_SETTING_KEY,
      value: new Date().toISOString(),
      householdId,
    },
    update: { value: new Date().toISOString(), householdId },
  });

  const filename = `homehi-export-${DateTime.now().toFormat("yyyy-LL-dd")}.zip`;

  return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
