import Link from "next/link";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateFull, formatDateTime } from "@/lib/dates";
import { restoreEntryAction, purgeEntryAction } from "@/app/actions/entries";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";

export default async function TrashPage() {
  const context = await requireContext();
  const timezone = context.household.timezone;

  const entries = await prisma.entry.findMany({
    where: {
      householdId: context.household.id,
      status: "DELETED",
      OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
    },
    orderBy: { deletedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      body: true,
      occurredAt: true,
      deletedAt: true,
      createdBy: true,
    },
  });

  return (
    <div>
      <header className="mb-6">
        <Link href="/my" className="mb-3 inline-flex items-center gap-1 text-[11.5px] text-faint hover:text-ink">
          <ArrowLeft size={13} /> 我的
        </Link>
        <p className="eyebrow">Recently deleted</p>
        <h1 className="font-display mt-1.5 text-[34px] leading-none tracking-tight">回收站</h1>
        <p className="mt-1.5 text-[12px] text-muted">
          删除的记录会先放在这里，可以恢复。彻底删除后无法找回。
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Trash2 strokeWidth={1.7} />}
          title="回收站是空的"
          description="删除记录后，会先在这里保留一段时间，给你反悔的机会。"
          action={
            <Link href="/timeline" className="btn btn-outline btn-sm">
              回到时光
            </Link>
          }
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {entries.map((entry) => (
            <div key={entry.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">
                    {entry.title || entry.body?.slice(0, 40) || "一条记录"}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-faint">
                    {formatDateFull(entry.occurredAt, timezone)}
                    {entry.deletedAt ? ` · 删除于 ${formatDateTime(entry.deletedAt, timezone)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <form action={restoreEntryAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">
                      <RotateCcw size={12} /> 恢复
                    </SubmitButton>
                  </form>
                  {entry.createdBy === context.user.id ? (
                    <form action={purgeEntryAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <ConfirmButton
                        className="btn btn-ghost btn-sm text-danger"
                        message="彻底删除这条记录？照片文件不会被删除，但这条记录无法恢复。"
                        pendingText="…"
                      >
                        彻底删除
                      </ConfirmButton>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
