import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Download,
  File,
  FileArchive,
  FileImage,
  FileText,
  Link2,
  ListTodo,
  MessageCircle,
  MessagesSquare,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { taskWhere } from "@/lib/access";
import {
  daysUntil,
  formatDate,
  formatDateFull,
  formatDayLabel,
  formatTime,
} from "@/lib/dates";
import {
  formatFileSize,
  linkHostname,
  stanceLabel,
  stanceTone,
  topicState,
  TOPIC_STANCES,
} from "@/lib/topics";
import {
  deleteTopicAction,
  deleteTopicAttachmentAction,
  deleteTopicDateAction,
  deleteTopicLinkAction,
  deleteTopicNoteAction,
  linkTopicTaskAction,
  setTopicStatusAction,
  unlinkTopicTaskAction,
} from "@/app/actions/topics";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { TopicNoteForm } from "@/components/topics/TopicNoteForm";
import { TopicOpinionForm } from "@/components/topics/TopicOpinionForm";
import { TopicLinkForm } from "@/components/topics/TopicLinkForm";
import { TopicDateForm } from "@/components/topics/TopicDateForm";
import { TopicAttachmentUploader } from "@/components/topics/TopicAttachmentUploader";
import { TopicDecisionForm } from "@/components/topics/TopicDecisionForm";
import { TopicMetaForm } from "@/components/topics/TopicMetaForm";

const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "待办",
  DONE: "已完成",
  CANCELLED: "已取消",
};

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
}) {
  return (
    <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
      {icon}
      {title}
      {typeof count === "number" ? <span className="font-normal text-faint">{count}</span> : null}
    </h2>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const className = "text-muted";
  if (mimeType.startsWith("image/")) return <FileImage size={17} className={className} />;
  if (mimeType.includes("pdf") || mimeType.startsWith("text/")) {
    return <FileText size={17} className={className} />;
  }
  if (mimeType.includes("zip") || mimeType.includes("compressed")) {
    return <FileArchive size={17} className={className} />;
  }
  return <File size={17} className={className} />;
}

export default async function TopicDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const editing = edit === "1";
  const context = await requireContext();
  const timezone = context.household.timezone;
  const viewer = { userId: context.user.id, householdId: context.household.id };

  const topic = await prisma.topic.findFirst({
    where: { id, householdId: context.household.id },
    include: {
      creator: { select: { id: true, displayName: true, avatarMediaId: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, displayName: true, avatarMediaId: true } } },
      },
      opinions: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, displayName: true, avatarMediaId: true } } },
      },
      links: {
        orderBy: { createdAt: "desc" },
        include: { creator: { select: { id: true, displayName: true } } },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        include: { uploader: { select: { id: true, displayName: true } } },
      },
      dates: {
        orderBy: { date: "asc" },
        include: { creator: { select: { id: true, displayName: true } } },
      },
      tasks: {
        where: { task: taskWhere(viewer) },
        orderBy: { createdAt: "asc" },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              dueAt: true,
              priority: true,
              assignee: { select: { displayName: true } },
            },
          },
        },
      },
    },
  });

  if (!topic) notFound();

  const linkedTaskIds = new Set(topic.tasks.map((link) => link.task.id));
  const linkableTasks = editing
    ? (
        await prisma.task.findMany({
          where: { ...taskWhere(viewer), status: "TODO" },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 100,
          select: { id: true, title: true, dueAt: true },
        })
      ).filter((task) => !linkedTaskIds.has(task.id))
    : [];

  const closed = topic.status === "CLOSED";
  const state = topicState(topic.status, Boolean(topic.decision));
  const canManage = topic.creator.id === context.user.id || context.role === "OWNER";
  const canEdit = (createdBy: string) => createdBy === context.user.id || canManage;
  const stanceCounts = TOPIC_STANCES.map((stance) => ({
    ...stance,
    count: topic.opinions.filter((opinion) => opinion.stance === stance.value).length,
  }));
  const hasContent = Boolean(
    topic.description ||
      topic.decision ||
      topic.dates.length ||
      topic.notes.length ||
      topic.opinions.length ||
      topic.links.length ||
      topic.attachments.length ||
      topic.tasks.length,
  );

  return (
    <article>
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <Link
            href={editing ? `/topics/${topic.id}` : "/topics"}
            className="icon-btn icon-btn-plain -ml-2"
            aria-label={editing ? "返回议题" : "返回议题列表"}
          >
            <ArrowLeft size={19} strokeWidth={1.8} />
          </Link>
          <div className="flex items-center gap-1">
            {editing ? (
              <Link
                href={`/topics/${topic.id}`}
                className="icon-btn icon-btn-plain"
                aria-label="完成编辑"
              >
                <Check size={16} />
              </Link>
            ) : (
              <Link
                href={`/topics/${topic.id}?edit=1`}
                className="icon-btn icon-btn-plain"
                aria-label="编辑"
              >
                <Pencil size={16} />
              </Link>
            )}
            {canManage ? (
              <>
                <form action={setTopicStatusAction}>
                  <input type="hidden" name="id" value={topic.id} />
                  <input type="hidden" name="status" value={closed ? "OPEN" : "CLOSED"} />
                  <SubmitButton className="icon-btn icon-btn-plain" pendingText="">
                    {closed ? <RotateCcw size={16} /> : <Archive size={16} />}
                  </SubmitButton>
                </form>
                <form action={deleteTopicAction}>
                  <input type="hidden" name="id" value={topic.id} />
                  <ConfirmButton
                    className="icon-btn icon-btn-plain text-faint hover:text-danger"
                    message="删除这个议题？想法、意见、链接、文件和关联待办都会一起删除。"
                    pendingText=""
                  >
                    <Trash2 size={16} />
                  </ConfirmButton>
                </form>
              </>
            ) : null}
          </div>
        </div>

        <p className="eyebrow mt-6">Family topic</p>
        <h1 className="font-display mt-2.5 text-[38px] leading-[1.08] tracking-tight sm:text-[46px]">
          {topic.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-faint">
          <span className="inline-flex items-center gap-1.5">
            <Avatar
              name={topic.creator.displayName}
              src={
                topic.creator.avatarMediaId
                  ? `/api/media/${topic.creator.avatarMediaId}/thumb`
                  : null
              }
              size={24}
            />
            {topic.creator.displayName} 发起
          </span>
          <span className="h-1 w-1 rounded-full bg-line-strong" />
          <span>{formatDateFull(topic.createdAt, timezone)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${state.tone}`}>
            {state.label}
          </span>
        </div>
      </header>

      {editing && canManage ? (
        <TopicMetaForm
          topicId={topic.id}
          title={topic.title}
          description={topic.description || ""}
        />
      ) : topic.description ? (
        <div className="card p-4 sm:p-5">
          <p className="whitespace-pre-wrap text-[13px] leading-[1.8] text-muted">
            {topic.description}
          </p>
        </div>
      ) : null}

      {!editing && !hasContent ? (
        <Link href={`/topics/${topic.id}?edit=1`} className="btn btn-outline btn-sm">
          <Plus size={14} /> 添加内容
        </Link>
      ) : null}

      {topic.decision && !(editing && canManage) ? (
        <section className="mt-4 overflow-hidden rounded-[26px] border border-sage/25 bg-sage-soft/55 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sage">
              <CheckCircle2 size={14} /> 最终决定
            </p>
            <span className="text-[10px] text-faint">
              {topic.decidedAt ? formatDateFull(topic.decidedAt, timezone) : ""}
            </span>
          </div>
          <p className="mt-2 font-display text-[20px] leading-snug">{topic.decision}</p>
          {topic.outcome ? (
            <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
              {topic.outcome}
            </p>
          ) : null}
        </section>
      ) : null}

      {editing || topic.dates.length > 0 ? (
        <section className="mt-8">
          <SectionTitle
            icon={<CalendarClock size={13} className="text-gold" />}
            title="重要日期"
            count={topic.dates.length}
          />
          {editing ? (
            <div className="mb-3">
              <TopicDateForm topicId={topic.id} />
            </div>
          ) : null}
          {topic.dates.length > 0 ? (
            <div className="card divide-y divide-line overflow-hidden">
              {topic.dates.map((item) => {
                const diff = daysUntil(item.date, timezone);
                const relative =
                  diff === 0
                    ? "就是今天"
                    : diff > 0
                      ? `还有 ${diff} 天`
                      : `已过去 ${Math.abs(diff)} 天`;
                return (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised/70">
                      <CalendarClock size={16} className="text-gold" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="text-[12.5px] font-medium">{item.label}</p>
                        <span className="rounded-full bg-raised px-1.5 py-0.5 text-[9.5px] text-muted">
                          {relative}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-faint">
                        {formatDateFull(item.date, timezone)} · {item.creator.displayName} 添加
                      </p>
                      {item.note ? (
                        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-muted">
                          {item.note}
                        </p>
                      ) : null}
                    </div>
                    {editing && canEdit(item.createdBy) ? (
                      <form action={deleteTopicDateAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="returnTo" value="edit" />
                        <ConfirmButton
                          className="icon-btn icon-btn-plain text-faint hover:text-danger"
                          message="删除这个日期？"
                          pendingText=""
                        >
                          <Trash2 size={12.5} />
                        </ConfirmButton>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {editing || topic.notes.length > 0 ? (
        <section className="mt-8">
          <SectionTitle
            icon={<MessagesSquare size={13} className="text-sage" />}
            title="想法记录"
            count={topic.notes.length}
          />
          {editing ? (
            <div className="mb-3">
              <TopicNoteForm topicId={topic.id} />
            </div>
          ) : null}

          {topic.notes.length > 0 ? (
            <div className="space-y-2">
              {topic.notes.map((note) => (
                <div key={note.id} className="card flex items-start gap-2.5 p-3.5">
                  <Avatar
                    name={note.user.displayName}
                    src={
                      note.user.avatarMediaId ? `/api/media/${note.user.avatarMediaId}/thumb` : null
                    }
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[11.5px] font-semibold">{note.user.displayName}</span>
                      <span className="text-[10px] text-faint">
                        {formatDayLabel(note.createdAt, timezone)} {formatTime(note.createdAt, timezone)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
                      {note.body}
                    </p>
                  </div>
                  {editing && canEdit(note.userId) ? (
                    <form action={deleteTopicNoteAction}>
                      <input type="hidden" name="id" value={note.id} />
                      <input type="hidden" name="returnTo" value="edit" />
                      <ConfirmButton
                        className="icon-btn icon-btn-plain text-faint hover:text-danger"
                        message="删除这条想法？"
                        pendingText=""
                      >
                        <Trash2 size={12.5} />
                      </ConfirmButton>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {editing || topic.opinions.length > 0 ? (
        <section className="mt-8">
          <SectionTitle
            icon={<MessageCircle size={13} className="text-sage" />}
            title="家人的意见"
            count={topic.opinions.length}
          />

          {editing ? (
            <div className="mb-3">
              <TopicOpinionForm topicId={topic.id} />
            </div>
          ) : null}

          {topic.opinions.length > 0 ? (
            <div className="mb-3 grid grid-cols-3 gap-2">
              {stanceCounts.map((stance) => (
                <div
                  key={stance.value}
                  className="rounded-2xl border border-line bg-surface px-3 py-2.5"
                >
                  <p className="text-[10px] text-faint">{stance.label}</p>
                  <p className="mt-0.5 font-display text-[21px] leading-none">{stance.count}</p>
                </div>
              ))}
            </div>
          ) : null}

          {topic.opinions.length > 0 ? (
            <div className="space-y-2">
              {topic.opinions.map((opinion) => (
                <div key={opinion.id} className="card flex items-start gap-2.5 p-3.5">
                  <Avatar
                    name={opinion.user.displayName}
                    src={
                      opinion.user.avatarMediaId
                        ? `/api/media/${opinion.user.avatarMediaId}/thumb`
                        : null
                    }
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[11.5px] font-semibold">
                        {opinion.user.displayName}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-medium ${stanceTone(opinion.stance)}`}
                      >
                        {stanceLabel(opinion.stance)}
                      </span>
                      <span className="text-[10px] text-faint">
                        {formatDayLabel(opinion.createdAt, timezone)}{" "}
                        {formatTime(opinion.createdAt, timezone)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
                      {opinion.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {editing || topic.links.length > 0 ? (
        <section className="mt-8">
          <SectionTitle
            icon={<Link2 size={13} className="text-accent" />}
            title="链接"
            count={topic.links.length}
          />
          {editing ? (
            <div className="mb-3">
              <TopicLinkForm topicId={topic.id} />
            </div>
          ) : null}

          {topic.links.length > 0 ? (
            <div className="card divide-y divide-line overflow-hidden">
              {topic.links.map((item) => (
                <div key={item.id} className="flex items-start gap-2 px-4 py-3">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group flex min-w-0 flex-1 items-start gap-2.5"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Link2 size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="clamp-2 text-[12.5px] font-medium leading-snug">
                        {item.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-faint">
                        {item.platform ? <span className="text-muted">{item.platform}</span> : null}
                        <span className="truncate">{linkHostname(item.url)}</span>
                        <span>· {item.creator.displayName}</span>
                      </span>
                      {item.note ? (
                        <span className="mt-1 block text-[10.5px] leading-relaxed text-muted">
                          {item.note}
                        </span>
                      ) : null}
                    </span>
                    <ArrowUpRight
                      size={13}
                      className="mt-1 shrink-0 text-faint transition group-hover:-translate-y-0.5 group-hover:text-accent"
                    />
                  </a>
                  {editing && canEdit(item.createdBy) ? (
                    <form action={deleteTopicLinkAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="returnTo" value="edit" />
                      <ConfirmButton
                        className="icon-btn icon-btn-plain text-faint hover:text-danger"
                        message="删除这个链接？"
                        pendingText=""
                      >
                        <Trash2 size={12.5} />
                      </ConfirmButton>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {editing || topic.attachments.length > 0 ? (
        <section className="mt-8">
          <SectionTitle
            icon={<Paperclip size={13} className="text-blue" />}
            title="文件"
            count={topic.attachments.length}
          />
          {editing ? (
            <div className="mb-3 card p-4">
              <TopicAttachmentUploader topicId={topic.id} />
            </div>
          ) : null}

          {topic.attachments.length > 0 ? (
            <div className="card divide-y divide-line overflow-hidden">
              {topic.attachments.map((item) => (
                <div key={item.id} className="flex items-center gap-2 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-raised text-muted">
                    <FileIcon mimeType={item.mimeType} />
                  </span>
                  <a
                    href={`/api/topic-attachments/${item.id}`}
                    className="min-w-0 flex-1"
                    title="下载文件"
                  >
                    <span className="block truncate text-[12.5px] font-medium">
                      {item.originalFilename}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-faint">
                      {formatFileSize(item.fileSize)} · {item.uploader.displayName} ·{" "}
                      {formatDate(item.createdAt, timezone)}
                    </span>
                  </a>
                  <a
                    href={`/api/topic-attachments/${item.id}`}
                    className="icon-btn icon-btn-plain text-faint hover:text-ink"
                    aria-label={`下载 ${item.originalFilename}`}
                  >
                    <Download size={14} />
                  </a>
                  {editing && canEdit(item.uploadedBy) ? (
                    <form action={deleteTopicAttachmentAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="returnTo" value="edit" />
                      <ConfirmButton
                        className="icon-btn icon-btn-plain text-faint hover:text-danger"
                        message="删除这个文件？删除后无法恢复。"
                        pendingText=""
                      >
                        <Trash2 size={13} />
                      </ConfirmButton>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {editing || topic.tasks.length > 0 ? (
        <section className="mt-8">
          <SectionTitle
            icon={<ListTodo size={13} className="text-accent" />}
            title="关联待办"
            count={topic.tasks.length}
          />
          {topic.tasks.length > 0 ? (
            <div className="card divide-y divide-line overflow-hidden">
              {topic.tasks.map((link) => {
                const task = link.task;
                const done = task.status === "DONE";
                return (
                  <div key={task.id} className="flex items-center gap-2.5 px-4 py-3">
                    <span className={done ? "text-sage" : "text-faint"}>
                      {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </span>
                    <Link href={`/tasks/${task.id}/edit`} className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[12.5px] ${done ? "text-faint line-through" : "font-medium"}`}
                      >
                        {task.title}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-faint">
                        {TASK_STATUS_LABEL[task.status] || task.status}
                        {task.dueAt ? ` · ${formatDayLabel(task.dueAt, timezone)}` : ""}
                        {task.assignee ? ` · ${task.assignee.displayName}` : ""}
                      </span>
                    </Link>
                    {editing ? (
                      <form action={unlinkTopicTaskAction}>
                        <input type="hidden" name="topicId" value={topic.id} />
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="returnTo" value="edit" />
                        <SubmitButton
                          className="icon-btn icon-btn-plain text-faint hover:text-danger"
                          pendingText=""
                        >
                          <X size={13} />
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {editing ? (
            <div className="mt-3 card p-4">
              <p className="label">关联一件待办</p>
              {linkableTasks.length > 0 ? (
                <form action={linkTopicTaskAction} className="flex gap-2">
                  <input type="hidden" name="topicId" value={topic.id} />
                  <input type="hidden" name="returnTo" value="edit" />
                  <select name="taskId" className="field min-w-0 flex-1" required defaultValue="">
                    <option value="" disabled>
                      选择一件待办
                    </option>
                    {linkableTasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                        {task.dueAt ? `（${formatDate(task.dueAt, timezone)}）` : ""}
                      </option>
                    ))}
                  </select>
                  <SubmitButton className="btn btn-outline btn-sm shrink-0" pendingText="关联中…">
                    关联
                  </SubmitButton>
                </form>
              ) : (
                <p className="text-[11.5px] text-faint">没有可关联的待办</p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {editing && canManage ? (
        <section id="topic-decision" className="mt-8 scroll-mt-24">
          <SectionTitle
            icon={<CheckCircle2 size={13} className="text-sage" />}
            title="决定与结果"
          />
          <details open={!topic.decision}>
            <summary className="mb-2 cursor-pointer list-none text-[11px] text-faint [&::-webkit-details-marker]:hidden">
              {topic.decision ? "更新决定与结果" : "记录最终决定"}
            </summary>
            <TopicDecisionForm
              topicId={topic.id}
              decision={topic.decision}
              outcome={topic.outcome}
            />
          </details>
        </section>
      ) : null}
    </article>
  );
}
