import { prisma } from "@/lib/db";
import { parseStringArray } from "@/lib/json";

/** 只保留属于本家庭、且当前用户看得到的物品 id。 */
export async function validAssetIds(householdId: string, userId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.asset.findMany({
    where: {
      householdId,
      id: { in: ids },
      OR: [{ visibility: "HOUSEHOLD" }, { createdBy: userId }],
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/** 删除物品时，把日程与待办里对它的引用一起清掉。 */
export async function removeAssetReferences(householdId: string, assetId: string): Promise<void> {
  const [tasks, events] = await Promise.all([
    prisma.task.findMany({
      where: { householdId, relatedAssetIds: { contains: assetId } },
      select: { id: true, relatedAssetIds: true },
    }),
    prisma.calendarEvent.findMany({
      where: { householdId, relatedAssetIds: { contains: assetId } },
      select: { id: true, relatedAssetIds: true },
    }),
  ]);

  if (tasks.length + events.length === 0) return;

  await prisma.$transaction([
    ...tasks.map((task) => {
      const next = parseStringArray(task.relatedAssetIds).filter((id) => id !== assetId);
      return prisma.task.update({
        where: { id: task.id },
        data: { relatedAssetIds: next.length ? JSON.stringify(next) : null },
      });
    }),
    ...events.map((event) => {
      const next = parseStringArray(event.relatedAssetIds).filter((id) => id !== assetId);
      return prisma.calendarEvent.update({
        where: { id: event.id },
        data: { relatedAssetIds: next.length ? JSON.stringify(next) : null },
      });
    }),
  ]);
}
