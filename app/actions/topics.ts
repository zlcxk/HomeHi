"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { taskWhere } from "@/lib/access";
import { dateInputToUtc } from "@/lib/dates";
import { deriveLinkTitle, detectLinkPlatform, extractSharedUrl } from "@/lib/topics";
import { removeStoredFile } from "@/lib/storage";
import {
  firstError,
  formString,
  topicDateSchema,
  topicDecisionSchema,
  topicLinkSchema,
  topicNoteSchema,
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
    select: {
      id: true,
      title: true,
      createdBy: true,
      status: true,
      closedAt: true,
      decision: true,
    },
  });
}

function canManage(topic: { createdBy: string }, context: { user: { id: string }; role: string }) {
  return topic.createdBy === context.user.id || context.role === "OWNER";
}

function canEditItem(
  createdBy: string,
  topic: { createdBy: string },
  context: { user: { id: string }; role: string },
) {
  return createdBy === context.user.id || canManage(topic, context);
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
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const topic = await prisma.topic.create({
    data: {
      householdId: context.household.id,
      createdBy: context.user.id,
      title: data.title,
      description: data.description || null,
    },
    select: { id: true },
  });

  refreshTopicPaths(topic.id);
  redirect(`/topics/${topic.id}`);
}

export async function addTopicNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };

  const parsed = topicNoteSchema.safeParse({
    topicId: formString(formData, "topicId"),
    body: formString(formData, "body"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const topic = await topicForHousehold(data.topicId, context.household.id);
  if (!topic) return { error: "议题不存在或已删除" };

  await prisma.topicNote.create({
    data: { topicId: topic.id, userId: context.user.id, body: data.body },
  });

  refreshTopicPaths(topic.id);
  return { success: "想法已经记下" };
}

export async function deleteTopicNoteAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");

  const id = formString(formData, "id");
  const note = await prisma.topicNote.findUnique({
    where: { id },
    include: { topic: { select: { id: true, householdId: true, createdBy: true } } },
  });
  if (
    !note ||
    note.topic.householdId !== context.household.id ||
    !canEditItem(note.userId, note.topic, context)
  ) {
    redirect(note ? `/topics/${note.topic.id}` : "/topics");
  }

  await prisma.topicNote.delete({ where: { id: note.id } });
  refreshTopicPaths(note.topic.id);
  redirect(`/topics/${note.topic.id}`);
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
  return { success: "已经记下你的意见" };
}

export async function addTopicLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };

  const parsed = topicLinkSchema.safeParse({
    topicId: formString(formData, "topicId"),
    text: formString(formData, "text"),
    title: formString(formData, "title"),
    note: formString(formData, "note"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const topic = await topicForHousehold(data.topicId, context.household.id);
  if (!topic) return { error: "议题不存在或已删除" };

  const url = extractSharedUrl(data.text);
  if (!url) return { error: "没有找到有效链接，请粘贴网址或 App 的分享文案" };

  const exists = await prisma.topicLink.findUnique({
    where: { topicId_url: { topicId: topic.id, url } },
    select: { id: true },
  });
  if (exists) return { error: "这个链接已经保存过了" };

  await prisma.topicLink.create({
    data: {
      topicId: topic.id,
      createdBy: context.user.id,
      url,
      title: data.title || deriveLinkTitle(data.text, url),
      platform: detectLinkPlatform(url, data.text),
      note: data.note || null,
    },
  });

  refreshTopicPaths(topic.id);
  return { success: "链接已经保存" };
}

export async function deleteTopicLinkAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");

  const id = formString(formData, "id");
  const link = await prisma.topicLink.findUnique({
    where: { id },
    include: { topic: { select: { id: true, householdId: true, createdBy: true } } },
  });
  if (
    !link ||
    link.topic.householdId !== context.household.id ||
    !canEditItem(link.createdBy, link.topic, context)
  ) {
    redirect(link ? `/topics/${link.topic.id}` : "/topics");
  }

  await prisma.topicLink.delete({ where: { id: link.id } });
  refreshTopicPaths(link.topic.id);
  redirect(`/topics/${link.topic.id}`);
}

export async function addTopicDateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };

  const parsed = topicDateSchema.safeParse({
    topicId: formString(formData, "topicId"),
    label: formString(formData, "label"),
    date: formString(formData, "date"),
    note: formString(formData, "note"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const topic = await topicForHousehold(data.topicId, context.household.id);
  if (!topic) return { error: "议题不存在或已删除" };

  const date = dateInputToUtc(data.date, context.household.timezone);
  if (!date) return { error: "日期格式不正确" };

  await prisma.topicDate.create({
    data: {
      topicId: topic.id,
      createdBy: context.user.id,
      label: data.label,
      date,
      note: data.note || null,
    },
  });

  refreshTopicPaths(topic.id);
  return { success: "重要日期已经添加" };
}

export async function deleteTopicDateAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");

  const id = formString(formData, "id");
  const date = await prisma.topicDate.findUnique({
    where: { id },
    include: { topic: { select: { id: true, householdId: true, createdBy: true } } },
  });
  if (
    !date ||
    date.topic.householdId !== context.household.id ||
    !canEditItem(date.createdBy, date.topic, context)
  ) {
    redirect(date ? `/topics/${date.topic.id}` : "/topics");
  }

  await prisma.topicDate.delete({ where: { id: date.id } });
  refreshTopicPaths(date.topic.id);
  redirect(`/topics/${date.topic.id}`);
}

export async function linkTopicTaskAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");

  const topicId = formString(formData, "topicId");
  const taskId = formString(formData, "taskId");
  const topic = await topicForHousehold(topicId, context.household.id);
  if (!topic) redirect("/topics");

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      ...taskWhere({ userId: context.user.id, householdId: context.household.id }),
    },
    select: { id: true },
  });
  if (!task) redirect(`/topics/${topic.id}`);

  const exists = await prisma.topicTask.findUnique({
    where: { topicId_taskId: { topicId: topic.id, taskId: task.id } },
    select: { topicId: true },
  });
  if (!exists) {
    await prisma.topicTask.create({ data: { topicId: topic.id, taskId: task.id } });
  }

  refreshTopicPaths(topic.id);
  redirect(`/topics/${topic.id}`);
}

export async function unlinkTopicTaskAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");

  const topicId = formString(formData, "topicId");
  const taskId = formString(formData, "taskId");
  const topic = await topicForHousehold(topicId, context.household.id);
  if (!topic) redirect("/topics");

  await prisma.topicTask.deleteMany({ where: { topicId: topic.id, taskId } });
  refreshTopicPaths(topic.id);
  redirect(`/topics/${topic.id}`);
}

export async function deleteTopicAttachmentAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");

  const id = formString(formData, "id");
  const attachment = await prisma.topicAttachment.findUnique({
    where: { id },
    include: { topic: { select: { id: true, householdId: true, createdBy: true } } },
  });
  if (
    !attachment ||
    attachment.topic.householdId !== context.household.id ||
    !canEditItem(attachment.uploadedBy, attachment.topic, context)
  ) {
    redirect(attachment ? `/topics/${attachment.topic.id}` : "/topics");
  }

  await prisma.topicAttachment.delete({ where: { id: attachment.id } });
  await removeStoredFile(attachment.storageKey, attachment.storageDriver).catch(() => {});
  refreshTopicPaths(attachment.topic.id);
  redirect(`/topics/${attachment.topic.id}`);
}

export async function saveTopicDecisionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };

  const parsed = topicDecisionSchema.safeParse({
    topicId: formString(formData, "topicId"),
    decision: formString(formData, "decision"),
    outcome: formString(formData, "outcome"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const topic = await topicForHousehold(data.topicId, context.household.id);
  if (!topic) return { error: "议题不存在或已删除" };
  if (!canManage(topic, context)) {
    return { error: "只有发起人或家庭管理员可以记录最终决定" };
  }

  const now = new Date();
  await prisma.topic.update({
    where: { id: topic.id },
    data: {
      decision: data.decision,
      outcome: data.outcome || null,
      decidedAt: now,
      status: "CLOSED",
      closedAt: topic.closedAt ?? now,
    },
  });

  refreshTopicPaths(topic.id);
  return { success: "最终决定已经记录" };
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
  const topic = await prisma.topic.findFirst({
    where: { id, householdId: context.household.id },
    select: {
      id: true,
      createdBy: true,
      attachments: { select: { storageKey: true, storageDriver: true } },
    },
  });
  if (!topic || !canManage(topic, context)) redirect(`/topics/${id}`);

  await prisma.topic.delete({ where: { id: topic.id } });
  for (const file of topic.attachments) {
    await removeStoredFile(file.storageKey, file.storageDriver).catch(() => {});
  }
  refreshTopicPaths();
  redirect("/topics");
}
