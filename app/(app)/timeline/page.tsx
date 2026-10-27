import Link from "next/link";
import { PenLine, Plus, X } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireContext } from "@/lib/auth";
import { publishedEntryWhere } from "@/lib/access";
import { prisma } from "@/lib/db";
import { PAGE_SIZE, ENTRY_TYPES, ENTRY_TYPE_LABEL } from "@/lib/constants";
import { entryCardInclude, toEntryCard } from "@/lib/entries-view";
import { PageHeader } from "@/components/PageHeader";
import { TimelineFeed } from "@/components/entries/TimelineFeed";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; type?: string; profile?: string }>;
}) {
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const params = await searchParams;
  const tag = params.tag?.trim() || "";
  const type = params.type && (ENTRY_TYPES as readonly string[]).includes(params.type) ? params.type : "";
  const profile = params.profile || "";

  const conditions: Prisma.EntryWhereInput[] = [];
  if (tag) conditions.push({ tags: { some: { tag: { name: tag } } } });
  if (type) conditions.push({ entryType: type });
  if (profile) conditions.push({ profiles: { some: { profileId: profile } } });

  const where: Prisma.EntryWhereInput = {
    ...publishedEntryWhere(viewer),
    ...(conditions.length ? { AND: conditions } : {}),
  };

  const [rows, tags, profileRow] = await Promise.all([
    prisma.entry.findMany({
      where,
      include: entryCardInclude,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
    }),
    prisma.tag.findMany({
      where: { householdId: context.household.id },
      orderBy: { name: "asc" },
      take: 16,
      select: { name: true },
    }),
    profile
      ? prisma.familyProfile.findFirst({
          where: {
            id: profile,
            householdId: context.household.id,
            OR: [{ visibility: "HOUSEHOLD" }, { linkedUserId: context.user.id }],
          },
          select: { name: true },
        })
      : null,
  ]);

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;
  const filtered = Boolean(tag || type || profile);

  function href(next: { tag?: string; type?: string; profile?: string }) {
    const search = new URLSearchParams();
    if (next.tag) search.set("tag", next.tag);
    if (next.type) search.set("type", next.type);
    if (next.profile) search.set("profile", next.profile);
    const query = search.toString();
    return query ? `/timeline?${query}` : "/timeline";
  }

  return (
    <>
      <PageHeader
        title="时光"
        eyebrow="The days we kept"
        action={
          <Link href="/compose/story" className="btn btn-outline btn-sm">
            <PenLine size={15} /> 写手记
          </Link>
        }
      />

      <div className="mb-5 -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max items-center gap-1.5 sm:w-auto sm:flex-wrap">
          <Link href={href({})} className={`chip ${!filtered ? "chip-active" : ""}`}>
            全部
          </Link>
          {ENTRY_TYPES.filter((item) => item === "MOMENT" || item === "STORY").map((item) => (
            <Link
              key={item}
              href={href({ type: item, tag: tag || undefined, profile: profile || undefined })}
              className={`chip ${type === item ? "chip-active" : ""}`}
            >
              {ENTRY_TYPE_LABEL[item]}
            </Link>
          ))}
          {tags.length > 0 ? <span className="mx-1 h-4 w-px bg-line-strong" /> : null}
          {tags.map((item) => (
            <Link
              key={item.name}
              href={href({ tag: tag === item.name ? undefined : item.name, type: type || undefined })}
              className={`chip ${tag === item.name ? "chip-active" : ""}`}
            >
              #{item.name}
            </Link>
          ))}
          {profileRow ? (
            <Link href={href({ tag: tag || undefined, type: type || undefined })} className="chip chip-active">
              {profileRow.name} <X size={11} />
            </Link>
          ) : null}
        </div>
      </div>

      <TimelineFeed
        initialEntries={page.map((entry) => toEntryCard(entry, viewer))}
        initialCursor={nextCursor}
        timezone={context.household.timezone}
        tag={tag}
        type={type}
        profile={profile}
      />

      <div className="mt-6 flex justify-center lg:hidden">
        <Link href="/compose/moment" className="btn btn-primary">
          <Plus size={16} /> 记一个瞬间
        </Link>
      </div>
    </>
  );
}
