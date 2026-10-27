import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  MessageCircle,
  MessagesSquare,
  Paperclip,
  Plus,
} from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, startOfDay } from "@/lib/dates";
import { topicState, TOPIC_STANCES } from "@/lib/topics";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Avatar } from "@/components/Avatar";

type TopicCardData = {
  id: string;
  title: string;
  description: string | null;
  decision: string | null;
  status: string;
  createdAt: Date;
  creator: { displayName: string; avatarMediaId: string | null };
  opinions: { stance: string }[];
  dates: { label: string; date: Date }[];
  _count: {
    opinions: number;
    notes: number;
    links: number;
    attachments: number;
    tasks: number;
  };
};

function stanceSummary(opinions: { stance: string }[]) {
  if (opinions.length === 0) return null;
  return TOPIC_STANCES.map((stance) => ({
    ...stance,
    count: opinions.filter((opinion) => opinion.stance === stance.value).length,
  })).filter((stance) => stance.count > 0);
}

function TopicCard({ topic, timezone }: { topic: TopicCardData; timezone: string }) {
  const summary = stanceSummary(topic.opinions);
  const state = topicState(topic.status, Boolean(topic.decision));
  const faded = state.key === "CLOSED";
  const nextDate = topic.dates[0] ?? null;
  const fileCount = topic._count.links + topic._count.attachments;

  return (
    <Link
      href={`/topics/${topic.id}`}
      className={`card group flex flex-col p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgba(80,55,20,0.45)] sm:p-5 ${
        faded ? "opacity-80 hover:opacity-100" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${state.tone}`}>
          {state.label}
        </span>
        <span className="text-[10.5px] text-faint">{formatDate(topic.createdAt, timezone)}</span>
      </div>

      <h2
        className={`mt-3 font-display text-[22px] leading-[1.15] tracking-[-0.01em] clamp-2 ${
          faded ? "text-muted" : ""
        }`}
      >
        {topic.title}
      </h2>

      {topic.decision ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-sage">
          <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
          <span className="clamp-2">{topic.decision}</span>
        </p>
      ) : topic.description ? (
        <p className="mt-2 clamp-2 text-[11.5px] leading-relaxed text-muted">{topic.description}</p>
      ) : null}

      {nextDate ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-muted">
          <CalendarClock size={11} className="text-gold" />
          {nextDate.label} · {formatDate(nextDate.date, timezone)}
        </p>
      ) : null}

      {summary ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {summary.map((stance) => (
            <span
              key={stance.value}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stance.tone}`}
            >
              {stance.label} {stance.count}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-2 pt-4">
        <Avatar
          name={topic.creator.displayName}
          src={
            topic.creator.avatarMediaId
              ? `/api/media/${topic.creator.avatarMediaId}/thumb`
              : null
          }
          size={24}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
          {topic.creator.displayName}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[10.5px] text-faint">
          <MessagesSquare size={11} /> {topic._count.notes}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[10.5px] text-faint">
          <MessageCircle size={11} /> {topic._count.opinions}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[10.5px] text-faint">
          <Paperclip size={11} /> {fileCount}
        </span>
      </div>
    </Link>
  );
}

export default async function TopicsPage() {
  const context = await requireContext();
  const todayStart = startOfDay(new Date(), context.household.timezone);

  const topics = await prisma.topic.findMany({
    where: { householdId: context.household.id },
    orderBy: [{ status: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      decision: true,
      status: true,
      createdAt: true,
      creator: { select: { displayName: true, avatarMediaId: true } },
      opinions: { select: { stance: true } },
      dates: {
        where: { date: { gte: todayStart } },
        orderBy: { date: "asc" },
        take: 1,
        select: { label: true, date: true },
      },
      _count: {
        select: {
          opinions: true,
          notes: true,
          links: true,
          attachments: true,
          tasks: true,
        },
      },
    },
  });

  const openTopics = topics.filter((topic) => topic.status !== "CLOSED");
  const closedTopics = topics.filter((topic) => topic.status === "CLOSED");

  return (
    <div>
      <PageHeader
        title="家庭议题"
        eyebrow="Family topics"
        description="把想一起商量的事放上来，记录想法、链接和文件，最后留下家人的决定。"
        action={
          <Link href="/compose/topic" className="btn btn-primary btn-sm">
            <Plus size={14} /> 发起议题
          </Link>
        }
      />

      {topics.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare strokeWidth={1.7} />}
          title="还没有议题"
          description="装修、旅行、要不要养宠物……把需要一起决定的事写下来，家人可以补充看法、链接和重要日期。"
          action={
            <Link href="/compose/topic" className="btn btn-primary btn-sm">
              <Plus size={14} /> 发起第一个议题
            </Link>
          }
        />
      ) : (
        <>
          {openTopics.length > 0 ? (
            <section className="mb-8">
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="text-[13px] font-semibold">
                  正在讨论
                  <span className="ml-1.5 font-normal text-faint">{openTopics.length}</span>
                </h2>
                <span className="text-[10.5px] text-faint">点开补充想法和资料</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {openTopics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} timezone={context.household.timezone} />
                ))}
              </div>
            </section>
          ) : null}

          {closedTopics.length > 0 ? (
            <section>
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="text-[13px] font-semibold">
                  已经聊过
                  <span className="ml-1.5 font-normal text-faint">{closedTopics.length}</span>
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {closedTopics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} timezone={context.household.timezone} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
