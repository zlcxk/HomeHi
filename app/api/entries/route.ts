import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getApiContext } from "@/lib/auth";
import { publishedEntryWhere } from "@/lib/access";
import { prisma } from "@/lib/db";
import { PAGE_SIZE, ENTRY_TYPES } from "@/lib/constants";
import { entryCardInclude, toEntryCard } from "@/lib/entries-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getApiContext();
  if (!context) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const viewer = { userId: context.user.id, householdId: context.household.id };

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const tag = url.searchParams.get("tag");
  const profile = url.searchParams.get("profile");
  const typeParam = url.searchParams.get("type");
  const q = url.searchParams.get("q")?.trim();

  const conditions: Prisma.EntryWhereInput[] = [];
  if (typeParam && (ENTRY_TYPES as readonly string[]).includes(typeParam)) {
    conditions.push({ entryType: typeParam });
  }
  if (tag) conditions.push({ tags: { some: { tag: { name: tag } } } });
  if (profile) conditions.push({ profiles: { some: { profileId: profile } } });
  if (q) {
    conditions.push({
      OR: [{ title: { contains: q } }, { body: { contains: q } }],
    });
  }

  const where: Prisma.EntryWhereInput = {
    ...publishedEntryWhere(viewer),
    ...(conditions.length ? { AND: conditions } : {}),
  };

  const rows = await prisma.entry.findMany({
    where,
    include: entryCardInclude,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return NextResponse.json({
    entries: page.map((entry) => toEntryCard(entry, viewer)),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  });
}
