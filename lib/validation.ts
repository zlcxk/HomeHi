import { z } from "zod";

export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function formNullableString(formData: FormData, key: string): string | null {
  const value = formString(formData, key);
  return value ? value : null;
}

export function formArray(formData: FormData, key: string): string[] {
  const value = formString(formData, key);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function formNumberArray(formData: FormData, key: string): number[] {
  const value = formString(formData, key);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map(Number).filter((n) => Number.isFinite(n))));
  } catch {
    return [];
  }
}

export function formBoolean(formData: FormData, key: string): boolean {
  const value = formString(formData, key);
  return value === "on" || value === "true" || value === "1";
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message || "请检查填写内容";
}

export const passwordSchema = z
  .string()
  .min(8, "密码至少 8 位")
  .max(200, "密码过长");

export const setupSchema = z.object({
  householdName: z.string().trim().min(1, "请填写家庭空间名称").max(60, "名称过长"),
  displayName: z.string().trim().min(1, "请填写你的称呼").max(40, "称呼过长"),
  email: z.email("邮箱格式不正确"),
  password: passwordSchema,
  timezone: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.email("邮箱格式不正确"),
  password: z.string().min(1, "请输入密码"),
});

export const entrySchema = z.object({
  title: z.string().max(160, "标题过长").optional().default(""),
  body: z.string().max(20_000, "正文过长").optional().default(""),
  location: z.string().max(200, "地点过长").optional().default(""),
  entryType: z.enum(["MOMENT", "STORY", "EVENT_RECAP", "GENERAL"]),
  occurredAt: z.string().min(1, "请选择发生时间"),
  visibility: z.enum(["HOUSEHOLD", "PRIVATE"]),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  mediaIds: z.array(z.string()).max(60),
  profileIds: z.array(z.string()).max(30),
  tags: z.array(z.string().trim().min(1).max(30)).max(20),
});

export const eventSchema = z.object({
  title: z.string().trim().min(1, "请填写日程标题").max(120, "标题过长"),
  description: z.string().max(4000).optional().default(""),
  location: z.string().max(200).optional().default(""),
  isAllDay: z.boolean(),
  start: z.string().min(1, "请选择开始时间"),
  end: z.string().optional().default(""),
  recurrenceType: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  recurrenceInterval: z.number().int().min(1).max(99),
  recurrenceUntil: z.string().optional().default(""),
  visibility: z.enum(["HOUSEHOLD", "PRIVATE"]),
  reminderOffsets: z.array(z.number().int().min(0).max(525_600)),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "请填写待办标题").max(160, "标题过长"),
  description: z.string().max(4000).optional().default(""),
  location: z.string().max(200, "地点过长").optional().default(""),
  dueAt: z.string().optional().default(""),
  priority: z.enum(["NORMAL", "IMPORTANT"]),
  assigneeUserId: z.string().optional().default(""),
  recurrenceType: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  recurrenceInterval: z.number().int().min(1).max(99),
  recurrenceUntil: z.string().optional().default(""),
  visibility: z.enum(["HOUSEHOLD", "PRIVATE"]),
  reminderOffsets: z.array(z.number().int().min(0).max(525_600)),
});

export const profileSchema = z.object({
  profileType: z.enum(["PERSON", "PET"]),
  name: z.string().trim().min(1, "请填写名字").max(40, "名字过长"),
  birthday: z.string().optional().default(""),
  joinedDate: z.string().optional().default(""),
  species: z.string().max(40).optional().default(""),
  breed: z.string().max(60).optional().default(""),
  gender: z.string().max(20).optional().default(""),
  description: z.string().max(2000).optional().default(""),
  visibility: z.enum(["HOUSEHOLD", "PRIVATE"]),
  avatarMediaId: z.string().optional().default(""),
});

export const assetSchema = z.object({
  name: z.string().trim().min(1, "请填写物品名称").max(80, "名称过长"),
  category: z.enum(["APPLIANCE", "ELECTRONICS", "FURNITURE", "VEHICLE", "TOOL", "DOCUMENT", "OTHER"]),
  status: z.enum(["ACTIVE", "REPAIRED", "RETIRED", "SOLD"]),
  brand: z.string().max(80).optional().default(""),
  model: z.string().max(80).optional().default(""),
  serialNumber: z.string().max(120).optional().default(""),
  location: z.string().max(120).optional().default(""),
  purchaseDate: z.string().optional().default(""),
  purchasePrice: z.string().optional().default(""),
  vendor: z.string().max(120).optional().default(""),
  warrantyUntil: z.string().optional().default(""),
  maintenanceEveryDays: z.string().optional().default(""),
  insuranceUntil: z.string().optional().default(""),
  insuranceProvider: z.string().max(120).optional().default(""),
  notes: z.string().max(4000).optional().default(""),
  photoMediaId: z.string().optional().default(""),
  visibility: z.enum(["HOUSEHOLD", "PRIVATE"]),
});

export const topicSchema = z.object({
  title: z.string().trim().min(2, "议题至少写 2 个字").max(80, "议题标题过长"),
  description: z.string().max(2000, "说明过长").optional().default(""),
});

export const topicNoteSchema = z.object({
  topicId: z.string().min(1),
  body: z.string().trim().min(1, "写点想法再保存").max(1000, "最多 1000 字"),
});

export const topicOpinionSchema = z.object({
  topicId: z.string().min(1),
  stance: z.enum(["AGREE", "NEUTRAL", "CONCERN"]),
  body: z.string().trim().min(1, "写一句你的想法").max(500, "最多 500 字"),
});

export const topicLinkSchema = z.object({
  topicId: z.string().min(1),
  text: z.string().trim().min(1, "请粘贴链接或分享文案").max(3000, "分享文案过长"),
  title: z.string().trim().max(120, "标题过长").optional().default(""),
  note: z.string().trim().max(500, "备注过长").optional().default(""),
});

export const topicDateSchema = z.object({
  topicId: z.string().min(1),
  label: z.string().trim().min(1, "写一个日期名称").max(40, "日期名称过长"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择日期"),
  note: z.string().trim().max(300, "备注过长").optional().default(""),
});

export const topicDecisionSchema = z.object({
  topicId: z.string().min(1),
  decision: z.string().trim().min(1, "写一句最终决定").max(500, "决定最多 500 字"),
  outcome: z.string().trim().max(2000, "结果说明过长").optional().default(""),
});

export const albumSchema = z.object({
  name: z.string().trim().min(1, "请填写相册名称").max(60, "名称过长"),
  description: z.string().max(500).optional().default(""),
});

export const mediaUpdateSchema = z.object({
  caption: z.string().max(500, "说明过长").optional().default(""),
  favorite: z.boolean().optional().default(false),
  visibility: z.enum(["HOUSEHOLD", "PRIVATE"]),
});

export const memberSchema = z.object({
  email: z.email("邮箱格式不正确"),
  displayName: z.string().trim().min(1, "请填写成员称呼").max(40, "称呼过长"),
  password: z.string().min(8, "临时密码至少 8 位").max(200),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "请再次输入新密码"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次输入的新密码不一致",
    path: ["confirmPassword"],
  });

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(1, "请填写称呼").max(40, "称呼过长"),
  timezone: z.string().min(1, "请选择时区"),
  defaultVisibility: z.enum(["HOUSEHOLD", "PRIVATE"]),
  avatarMediaId: z.string().optional().default(""),
});

export const householdSchema = z.object({
  name: z.string().trim().min(1, "请填写家庭名称").max(60, "名称过长"),
  timezone: z.string().min(1, "请选择时区"),
});

export const storageSchema = z.object({
  driver: z.enum(["LOCAL", "OSS"]),
  ossRegion: z.string().trim().max(120).optional().default(""),
  ossBucket: z.string().trim().max(120).optional().default(""),
  ossAccessKeyId: z.string().trim().max(200).optional().default(""),
  ossAccessKeySecret: z.string().trim().max(400).optional().default(""),
  ossEndpoint: z.string().trim().max(200).optional().default(""),
  ossPrefix: z.string().trim().max(200).optional().default(""),
});

export type ActionState = {
  error?: string;
  success?: string;
};
