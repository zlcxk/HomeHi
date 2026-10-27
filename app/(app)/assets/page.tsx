import Link from "next/link";
import {
  Boxes,
  Car,
  FileText,
  Laptop,
  Plus,
  Refrigerator,
  Sofa,
  Wrench,
} from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assetWhere } from "@/lib/access";
import { parseStringArray } from "@/lib/json";
import { ASSET_CATEGORIES, assetCategoryLabel, assetStatusLabel, expiryHint } from "@/lib/assets";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

const ICONS: Record<string, typeof Boxes> = {
  APPLIANCE: Refrigerator,
  ELECTRONICS: Laptop,
  FURNITURE: Sofa,
  VEHICLE: Car,
  TOOL: Wrench,
  DOCUMENT: FileText,
  OTHER: Boxes,
};

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const context = await requireContext();
  const viewer = { userId: context.user.id, householdId: context.household.id };
  const timezone = context.household.timezone;
  const { category } = await searchParams;
  const activeCategory = ASSET_CATEGORIES.some((item) => item.value === category) ? category : null;

  const [assets, tasks, events] = await Promise.all([
    prisma.asset.findMany({
      where: { ...assetWhere(viewer), category: activeCategory ?? undefined },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 300,
      select: {
        id: true,
        name: true,
        category: true,
        brand: true,
        model: true,
        location: true,
        status: true,
        warrantyUntil: true,
        insuranceUntil: true,
        photoMediaId: true,
        visibility: true,
      },
    }),
    prisma.task.findMany({
      where: {
        householdId: context.household.id,
        status: "TODO",
        relatedAssetIds: { not: null },
        OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
      },
      select: { relatedAssetIds: true },
      take: 500,
    }),
    prisma.calendarEvent.findMany({
      where: {
        householdId: context.household.id,
        status: "ACTIVE",
        relatedAssetIds: { not: null },
        OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
      },
      select: { relatedAssetIds: true },
      take: 500,
    }),
  ]);

  const planCounts = new Map<string, number>();
  for (const row of [...tasks, ...events]) {
    for (const id of parseStringArray(row.relatedAssetIds)) {
      planCounts.set(id, (planCounts.get(id) ?? 0) + 1);
    }
  }

  const allCounts = new Map<string, number>();
  for (const asset of await prisma.asset.findMany({
    where: assetWhere(viewer),
    select: { category: true },
  })) {
    allCounts.set(asset.category, (allCounts.get(asset.category) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="物品与资产"
        eyebrow="Household items"
        action={
          <Link href="/assets/new" className="btn btn-primary btn-sm">
            <Plus size={14} /> 登记
          </Link>
        }
      />

      {allCounts.size > 0 ? (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <Link href="/assets" className={`chip ${!activeCategory ? "chip-active" : ""}`}>
            全部
            <span className="ml-1 opacity-60">{Array.from(allCounts.values()).reduce((a, b) => a + b, 0)}</span>
          </Link>
          {ASSET_CATEGORIES.filter((item) => allCounts.has(item.value)).map((item) => (
            <Link
              key={item.value}
              href={`/assets?category=${item.value}`}
              className={`chip ${activeCategory === item.value ? "chip-active" : ""}`}
            >
              {item.label}
              <span className="ml-1 opacity-60">{allCounts.get(item.value)}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {assets.length === 0 ? (
        <EmptyState
          icon={<Boxes strokeWidth={1.7} />}
          title={activeCategory ? "这个分类还是空的" : "还没有登记物品"}
          description="登记后可以关联日程，并为质保、保养和保险设置提醒。"
          action={
            <Link href="/assets/new" className="btn btn-primary btn-sm">
              <Plus size={14} /> 登记一件
            </Link>
          }
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {assets.map((asset) => {
            const Icon = ICONS[asset.category] || Boxes;
            const warranty = expiryHint(asset.warrantyUntil, timezone, "质保");
            const insurance = expiryHint(asset.insuranceUntil, timezone, "保险");
            const plans = planCounts.get(asset.id) ?? 0;
            return (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}`}
                className="card flex items-center gap-3.5 p-3.5 transition hover:border-line-strong"
              >
                {asset.photoMediaId ? (
                  <img
                    src={`/api/media/${asset.photoMediaId}/thumb`}
                    alt=""
                    loading="lazy"
                    className="h-[54px] w-[54px] shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl bg-raised text-muted">
                    <Icon size={21} strokeWidth={1.7} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold">{asset.name}</span>
                    {asset.visibility === "PRIVATE" ? (
                      <span className="shrink-0 rounded-full bg-raised px-1.5 py-0.5 text-[9px] text-faint">
                        私密
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-faint">
                    {[assetCategoryLabel(asset.category), asset.brand, asset.model, asset.location]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
                    <span className="text-faint">{assetStatusLabel(asset.status)}</span>
                    {warranty ? <span className="text-accent">{warranty}</span> : null}
                    {insurance ? <span className="text-accent">{insurance}</span> : null}
                    {plans > 0 ? <span className="text-muted">{plans} 项计划</span> : null}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
