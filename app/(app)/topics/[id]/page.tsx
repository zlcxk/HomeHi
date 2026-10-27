import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Flame, MessageCircle, MessagesSquare } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatDateFull, formatDayLabel, formatTime } from "@/lib/dates";
import { stanceLabel, stanceTone, TOPIC_STANCES } from "@/lib/topics";
import { deleteTopicAction, setTopicStatusAction } from "@/app/actions/topics";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { TopicTrendsStatus } from "@/components/topics/TopicTrendsStatus";
import { TopicOpinionForm } from "@/components/topics/TopicOpinionForm";
import { TrendCover } from "@/components/topics/TrendCover";

export default async function TopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const timezone = context.household.timezone;

  const topic = await prisma.topic.findFirst({
    where: { id, householdId: context.household.id },
    include: {
      creator: { select: { id: true, displayName: true, avatarMediaId: true } },
      contents: { orderBy: { sortOrder: "asc" } },
      opinions: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, displayName: true, avatarMediaId: true } } },
      },
    },
  });

  if (!topic) notFound();

  const closed = topic.status === "CLOSED";
  const canManage = topic.creator.id === context.user.id || context.role === "OWNER";
  const configured = Boolean(process.env.MEDIA_CRAWLER_URL?.trim());
  const stanceCounts = TOPIC_STANCES.map((stance) => ({
    ...stance,
    count: topic.opinions.filter((opinion) => opinion.stance === stance.value).length,
  }));

  return (
    <div>
      <PageHeader
        backHref="/topics"
        eyebrow="Family topic"
        title={topic.title}
        description={`${topic.creator.displayName} 发起 · ${formatDateFull(topic.createdAt, timezone)}`}
        action={
          <span
            className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
              closed ? "bg-raised text-faint" : "bg-accent-soft text-accent"
            }`}
          >
            {closed ? "已结束" : "讨论中"}
          </span>
        }
      />

      {topic.description ? (
        <div className="card p-4 sm:p-5">
          <p className="whitespace-pre-wrap text-[13px] leading-[1.8] text-muted">{topic.description}</p>
        </div>
      ) : null}

      <section className="mt-8">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Flame size={13} className="text-accent" />
            热门参考
            <span className="font-normal text-faint">{topic.contents.length}</span>
          </h2>
          <TopicTrendsStatus
            topicId={topic.id}
            configured={configured}
            hasFetched={Boolean(topic.trendsFetchedAt)}
          />
        </div>

        <div className="card overflow-hidden">
          {topic.contents.length > 0 ? (
            <div className="divide-y divide-line">
              {topic.contents.map((item, index) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex items-start gap-3 px-3.5 py-3 transition hover:bg-raised/60 sm:px-4"
                >
                  <span className="w-4 shrink-0 pt-1 text-center font-display text-[13px] text-faint">
                    {index + 1}
                  </span>
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-raised">
                    <TrendCover src={item.coverUrl} alt={item.title} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="clamp-2 text-[12.5px] font-medium leading-snug">{item.title}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-faint">
                      {item.platform ? (
                        <span className="rounded-full bg-raised px-1.5 py-0.5 text-[9.5px] text-muted">
                          {item.platform}
                        </span>
                      ) : null}
                      {item.author ? <span className="truncate">@{item.author}</span> : null}
                      {item.heat ? (
                        <span className="inline-flex items-center gap-0.5 text-accent">
                          <Flame size={9.5} /> {item.heat}
                        </span>
                      ) : null}
                      {item.publishedAt ? <span>{formatDate(item.publishedAt, timezone)}</span> : null}
                    </span>
                  </span>
                  <ArrowUpRight
                    size={14}
                    className="mt-1 shrink-0 text-faint transition group-hover:-translate-y-0.5 group-hover:text-accent"
                  />
                </a>
              ))}
            </div>
          ) : (
            <div className="px-5 py-9 text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <Flame size={18} />
              </span>
              <p className="mt-3 text-[13px] font-semibold">
                {configured ? "还没有抓到热门内容" : "还没有接入内容服务"}
              </p>
              <p className="mx-auto mt-1.5 max-w-[320px] text-[11.5px] leading-relaxed text-faint">
                {configured
                  ? "点右上角刷新再试一次，或者稍后再来看看。"
                  : "接入 MediaCrawler 后，发起议题会自动抓取 10 条热门参考，供家人一起看。"}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <MessagesSquare size={13} className="text-sage" />
            家人的看法
            <span className="font-normal text-faint">{topic.opinions.length}</span>
          </h2>
          {topic.opinions.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] text-faint">
              <MessageCircle size={10.5} /> 每个人都可以说一句
            </span>
          ) : null}
        </div>

        {topic.opinions.length > 0 ? (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {stanceCounts.map((stance) => (
              <div key={stance.value} className="rounded-2xl border border-line bg-surface px-3 py-2.5">
                <p className="text-[10px] text-faint">{stance.label}</p>
                <p className="mt-0.5 font-display text-[21px] leading-none">{stance.count}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-[11.5px] text-faint">还没有人发言，先从你开始吧。</p>
        )}

        {topic.opinions.length > 0 ? (
          <div className="mb-3 space-y-2">
            {topic.opinions.map((opinion) => (
              <div key={opinion.id} className="card flex items-start gap-2.5 p-3.5">
                <Avatar
                  name={opinion.user.displayName}
                  src={
                    opinion.user.avatarMediaId
                      ? `/api/media/${opinion.user.avatarMediaId}/thumb`
                      : null
                  }
                  size={30}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[12px] font-semibold">{opinion.user.displayName}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-medium ${stanceTone(opinion.stance)}`}
                    >
                      {stanceLabel(opinion.stance)}
                    </span>
                    <span className="text-[10px] text-faint">
                      {formatDayLabel(opinion.createdAt, timezone)} {formatTime(opinion.createdAt, timezone)}
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

        <TopicOpinionForm topicId={topic.id} />
      </section>

      {canManage ? (
        <details className="mt-10">
          <summary className="cursor-pointer list-none text-[10.5px] text-faint [&::-webkit-details-marker]:hidden">
            管理议题
          </summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <form action={setTopicStatusAction}>
              <input type="hidden" name="id" value={topic.id} />
              <input type="hidden" name="status" value={closed ? "OPEN" : "CLOSED"} />
              <SubmitButton className="btn btn-outline btn-sm" pendingText="处理中…">
                {closed ? "重新打开讨论" : "结束讨论"}
              </SubmitButton>
            </form>
            <form action={deleteTopicAction}>
              <input type="hidden" name="id" value={topic.id} />
              <ConfirmButton
                className="btn btn-ghost btn-sm text-danger"
                message="删除这个议题？热门参考和家人的看法都会一起删除。"
              >
                删除议题
              </ConfirmButton>
            </form>
          </div>
        </details>
      ) : null}
    </div>
  );
}
