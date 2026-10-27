import Link from "next/link";
import { DateTime } from "luxon";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ListTodo,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  UserRound,
} from "lucide-react";
import type { Task } from "@prisma/client";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { taskWhere } from "@/lib/access";
import { formatDayLabel, formatTime } from "@/lib/dates";
import { recurrenceSummary } from "@/lib/recurrence";
import { cancelTaskAction, deleteTaskAction, toggleTaskAction } from "@/app/actions/tasks";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { QuickTaskAdd } from "@/components/tasks/QuickTaskAdd";

function TaskRow({
  task,
  timezone,
  assignee,
  done = false,
}: {
  task: Task;
  timezone: string;
  assignee?: string;
  done?: boolean;
}) {
  return (
    <div className="group flex items-start gap-3 px-4 py-3.5">
      <form action={toggleTaskAction} className="pt-0.5">
        <input type="hidden" name="id" value={task.id} />
        <SubmitButton
          className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border transition ${
            done
              ? "border-sage bg-sage text-white"
              : "border-line-strong text-transparent hover:border-sage hover:text-sage"
          }`}
          pendingText=""
        >
          <Check size={12} strokeWidth={3} />
        </SubmitButton>
      </form>

      <div className="min-w-0 flex-1">
        <p
          className={`text-[13.5px] leading-snug ${
            done ? "text-faint line-through" : "font-medium"
          }`}
        >
          {task.title}
        </p>

        {task.description && !done ? (
          <p className="mt-0.5 clamp-2 text-[11.5px] leading-relaxed text-muted">{task.description}</p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-faint">
          {task.dueAt ? (
            <span className="inline-flex items-center gap-0.5">
              <CalendarClock size={10} />
              {formatDayLabel(task.dueAt, timezone)} {formatTime(task.dueAt, timezone)}
            </span>
          ) : (
            <span>没有截止时间</span>
          )}
          {task.priority === "IMPORTANT" ? (
            <span className="inline-flex items-center gap-1 text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> 重要
            </span>
          ) : null}
          {task.recurrenceType !== "NONE" ? (
            <span className="inline-flex items-center gap-0.5">
              <Repeat size={10} /> {recurrenceSummary(task.recurrenceType, task.recurrenceInterval)}
            </span>
          ) : null}
          {assignee ? (
            <span className="inline-flex items-center gap-0.5">
              <UserRound size={10} /> {assignee}
            </span>
          ) : null}
        </div>
      </div>

      {!done ? (
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
          <Link href={`/tasks/${task.id}/edit`} className="icon-btn icon-btn-plain" aria-label="编辑待办">
            <Pencil size={13.5} />
          </Link>
          <form action={cancelTaskAction}>
            <input type="hidden" name="id" value={task.id} />
            <SubmitButton className="icon-btn icon-btn-plain" pendingText="">
              <CheckCircle2 size={13.5} />
            </SubmitButton>
          </form>
          <form action={deleteTaskAction}>
            <input type="hidden" name="id" value={task.id} />
            <ConfirmButton
              className="icon-btn icon-btn-plain text-faint hover:text-danger"
              message="删除这件待办？重复待办的历史完成记录也会一起删除。"
              pendingText=""
            >
              <Trash2 size={13.5} />
            </ConfirmButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function TaskSection({
  title,
  hint,
  tasks,
  timezone,
  names,
  done,
}: {
  title: string;
  hint?: string;
  tasks: Task[];
  timezone: string;
  names: Map<string, string>;
  done?: boolean;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="mb-7">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold">
          {title}
          <span className="ml-1.5 font-normal text-faint">{tasks.length}</span>
        </h2>
        {hint ? <span className="text-[10.5px] text-faint">{hint}</span> : null}
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            timezone={timezone}
            assignee={task.assigneeUserId ? names.get(task.assigneeUserId) : undefined}
            done={done}
          />
        ))}
      </div>
    </section>
  );
}

export default async function TasksPage() {
  const context = await requireContext();
  const timezone = context.household.timezone;
  const todayStart = DateTime.now().setZone(timezone).startOf("day");

  const [openTasks, doneTasks, members] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...taskWhere({ userId: context.user.id, householdId: context.household.id }),
        status: "TODO",
      },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 400,
    }),
    prisma.task.findMany({
      where: {
        ...taskWhere({ userId: context.user.id, householdId: context.household.id }),
        status: "DONE",
      },
      orderBy: { completedAt: "desc" },
      take: 12,
    }),
    prisma.householdMember.findMany({
      where: { householdId: context.household.id },
      include: { user: { select: { id: true, displayName: true } } },
    }),
  ]);

  const names = new Map(members.map((member) => [member.user.id, member.user.displayName]));

  const overdue: Task[] = [];
  const today: Task[] = [];
  const upcoming: Task[] = [];
  const someday: Task[] = [];

  for (const task of openTasks) {
    if (!task.dueAt) {
      someday.push(task);
      continue;
    }
    const due = DateTime.fromJSDate(task.dueAt, { zone: timezone });
    if (due < todayStart) overdue.push(task);
    else if (due.hasSame(todayStart, "day")) today.push(task);
    else upcoming.push(task);
  }

  const doneToday = doneTasks.filter(
    (task) => task.completedAt && DateTime.fromJSDate(task.completedAt, { zone: timezone }).hasSame(todayStart, "day"),
  ).length;

  const empty =
    overdue.length === 0 && today.length === 0 && upcoming.length === 0 && someday.length === 0;

  return (
    <div>
      <PageHeader
        title="待办"
        eyebrow="Things to do"
        description={
          openTasks.length > 0
            ? `还有 ${openTasks.length} 件${doneToday > 0 ? ` · 今天完成 ${doneToday} 件` : ""}`
            : undefined
        }
        action={
          <Link href="/compose/task" className="btn btn-primary btn-sm">
            <Plus size={14} /> 新待办
          </Link>
        }
      />

      <QuickTaskAdd visibility={context.user.defaultVisibility} />

      {empty ? (
        <EmptyState
          icon={<ListTodo strokeWidth={1.7} />}
          title="现在没有待办"
          action={
            <Link href="/compose/task" className="btn btn-outline btn-sm">
              <Plus size={14} /> 详细添加
            </Link>
          }
        />
      ) : (
        <>
          <TaskSection
            title="已过期"
            hint="还没完成"
            tasks={overdue}
            timezone={timezone}
            names={names}
          />
          <TaskSection title="今天" tasks={today} timezone={timezone} names={names} />
          <TaskSection title="接下来" tasks={upcoming} timezone={timezone} names={names} />
          <TaskSection title="想到再说" hint="没有截止时间" tasks={someday} timezone={timezone} names={names} />
        </>
      )}

      {doneTasks.length > 0 ? (
        <details className="mt-2">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-[12.5px] text-muted [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={14} className="text-sage" /> 最近完成
              <span className="text-faint">{doneTasks.length}</span>
            </span>
            <ArrowRight size={13} className="text-faint transition group-open:rotate-90" />
          </summary>
          <div className="card mt-2 divide-y divide-line overflow-hidden">
            {doneTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                timezone={timezone}
                assignee={task.assigneeUserId ? names.get(task.assigneeUserId) : undefined}
                done
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
