"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { fetchTopicTrends, replaceTopicTrends } from "@/lib/topics";
import {
  firstError,
  formString,
  topicOpinionSchema,
  topicSchema,
  type ActionState,
} from "@/lib/validation";

function refreshTopicPaths(topicId?: string) {
  revalidatePath("/topics");
  revalidatePath("/today");
  revalidatePath("/my");
  if (topicId) revalidatePath(`/topics/${topicId}`);
}

async function topicForHousehold(topicId: string, householdId: string) {
  return prisma.topic.findFirst({
    where: { id: topicId, householdId },
    select: { id: true, title: true, keyword: true, createdBy: true },
  });
}

function canManage(topic: { createdBy: string }, context: { user: { id: string }; role: string }) {
  return topic.createdBy === context.user.id || context.role === "OWNER";
}

export async function createTopicAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };

  const parsed = topicSchema.safeParse({
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    keyword: formString(formData, "keyword"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const topic = await prisma.topic.create({
    data: {
      householdId: context.household.id,
      createdBy: context.user.id,
      title: data.title,
      description: data.description || null,
      keyword: data.keyword || data.title,
    },
    select: { id: true },
  });

  refreshTopicPaths(topic.id);
  redirect(`/topics/${topic.id}`);
}

export async function refreshTopicTrendsAction(topicId: string): Promise<{
  ok: boolean;
  configured: boolean;
  count: number;
  error?: string;
}> {
  const context = await getContext();
  if (!context) return { ok: false, configured: false, count: 0, error: "登录已失效" };

  const topic = await topicForHousehold(topicId, context.household.id);
  if (!topic) return { ok: false, configured: false, count: 0, error: "议题不存在" };

  const result = await fetchTopicTrends(topic.keyword || topic.title, 10);
  if (!result.configured) {
    return { ok: false, configured: false, count: 0 };
  }
  if (result.error) {
    await prisma.topic.update({ where: { id: topic.id }, data: { trendsFetchedAt: new Date() } });
    refreshTopicPaths(topic.id);
    return { ok: false, configured: true, count: 0, error: "暂时没有拿到热门内容" };
  }

  await replaceTopicTrends(topic.id, result.items);
  refreshTopicPaths(topic.id);
  return { ok: true, configured: true, count: result.items.length };
}

export async function addTopicOpinionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };

  const parsed = topicOpinionSchema.safeParse({
    topicId: formString(formData, "topicId"),
    stance: formString(formData, "stance") || "NEUTRAL",
    body: formString(formData, "body"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const topic = await topicForHousehold(data.topicId, context.household.id);
  if (!topic) return { error: "议题不存在或已删除" };

  await prisma.topicOpinion.create({
    data: {
      topicId: topic.id,
      userId: context.user.id,
      stance: data.stance,
      body: data.body,
    },
  });

  refreshTopicPaths(topic.id);
  return { success: "已经记下你的想法" };
}

export async function setTopicStatusAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");

  const id = formString(formData, "id");
  const status = formString(formData, "status") === "CLOSED" ? "CLOSED" : "OPEN";
  const topic = await topicForHousehold(id, context.household.id);
  if (!topic || !canManage(topic, context)) redirect(`/topics/${id}`);

  await prisma.topic.update({
    where: { id: topic.id },
    data: { status, closedAt: status === "CLOSED" ? new Date() : null },
  });
  refreshTopicPaths(topic.id);
  redirect(`/topics/${topic.id}`);
}

export async function deleteTopicAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");

  const id = formString(formData, "id");
  const topic = await topicForHousehold(id, context.household.id);
  if (!topic || !canManage(topic, context)) redirect(`/topics/${id}`);

  await prisma.topic.delete({ where: { id: topic.id } });
  refreshTopicPaths();
  redirect("/topics");
}
