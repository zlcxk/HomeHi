import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getApiContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorageDriver } from "@/lib/storage";
import { LAST_EXPORT_SETTING_KEY } from "@/lib/constants";
import { DateTime } from "luxon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 文件可能已被删除或存储后端已变更，单个文件失败不应该中断整次导出。 */
async function appendStoredFile(
  archive: ZipArchive,
  key: string,
  kind: string,
  name: string,
): Promise<void> {
  try {
    const driver = await getStorageDriver(kind);
    const object = await driver.get(key);
    if (object) archive.append(object.stream, { name });
  } catch {
    // 跳过读取失败的文件
  }
}

function topicAttachmentPath(topicId: string, item: { id: string; originalFilename: string }) {
  const safeName = item.originalFilename.replace(/[\\/:*?"<>|]/g, "_");
  return `topics/${topicId}/${item.id}-${safeName}`;
}

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
    assets,
    events,
    tasks,
    completions,
    rules,
    notifications,
    settings,
    topics,
    trips,
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
    prisma.asset.findMany({ where: { householdId }, orderBy: { createdAt: "asc" } }),
    prisma.calendarEvent.findMany({ where: { householdId }, orderBy: { startsAt: "asc" } }),
    prisma.task.findMany({ where: { householdId }, orderBy: { createdAt: "asc" } }),
    prisma.taskCompletion.findMany({
      where: { task: { householdId } },
      orderBy: { completedAt: "asc" },
    }),
    prisma.reminderRule.findMany({ where: { householdId } }),
    prisma.notification.findMany({ where: { householdId }, orderBy: { scheduledAt: "asc" } }),
    prisma.appSetting.findMany({ where: { householdId } }),
    prisma.topic.findMany({
      where: { householdId },
      include: {
        notes: { orderBy: { createdAt: "asc" } },
        opinions: { orderBy: { createdAt: "asc" } },
        links: { orderBy: { createdAt: "asc" } },
        attachments: { orderBy: { createdAt: "asc" } },
        dates: { orderBy: { date: "asc" } },
        tasks: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.trip.findMany({
      where: { householdId },
      include: {
        places: {
          include: {
            visits: {
              include: { photos: { select: { mediaId: true, sortOrder: true } } },
              orderBy: { visitedAt: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        links: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
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
    assets,
    events,
    tasks,
    taskCompletions: completions,
    reminderRules: rules,
    notifications,
    settings,
    topics: topics.map((topic) => ({
      ...topic,
      attachments: topic.attachments.map((item) => ({
        id: item.id,
        originalFilename: item.originalFilename,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        uploadedBy: item.uploadedBy,
        createdAt: item.createdAt,
        file: topicAttachmentPath(topic.id, item),
      })),
    })),
    trips,
  };

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.append(
    `HomeHi 数据导出\n\n导出时间：${new Date().toISOString()}\n家庭：${household?.name ?? ""}\n\nhomehi-data.json 包含完整结构化数据；media/ 是照片和视频原始文件，topics/ 是议题附件。\n照片仍受原隐私设置约束，请妥善保管这个压缩包。\n`,
    { name: "README.txt" },
  );
  archive.append(JSON.stringify(data, null, 2), { name: "homehi-data.json" });

  // 逐个读取：本地和 OSS 都通过同一套驱动接口，历史文件按记录里的后端读取。
  for (const item of media) {
    const filename = `${item.id}-${item.originalFilename.replace(/[\\/:*?"<>|]/g, "_")}`;
    await appendStoredFile(archive, item.storageKey, item.storageDriver, `media/${filename}`);
    if (item.thumbnailKey) {
      await appendStoredFile(
        archive,
        item.thumbnailKey,
        item.storageDriver,
        `media/thumbs/${item.id}.webp`,
      );
    }
  }

  for (const topic of topics) {
    for (const item of topic.attachments) {
      await appendStoredFile(
        archive,
        item.storageKey,
        item.storageDriver,
        topicAttachmentPath(topic.id, item),
      );
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
