export const APP_NAME = "HomeHi";
export const APP_TAGLINE = "把日子收好";

export const ENTRY_TYPES = ["MOMENT", "STORY", "EVENT_RECAP", "GENERAL"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABEL: Record<string, string> = {
  MOMENT: "瞬间",
  STORY: "手记",
  EVENT_RECAP: "回顾",
  GENERAL: "日常",
};

export const VISIBILITY = ["HOUSEHOLD", "PRIVATE"] as const;
export type Visibility = (typeof VISIBILITY)[number];

export const VISIBILITY_LABEL: Record<string, string> = {
  HOUSEHOLD: "全家可见",
  PRIVATE: "仅自己",
};

export const MEMBER_ROLES = ["OWNER", "MEMBER"] as const;

export const TASK_STATUS = ["TODO", "DONE", "CANCELLED"] as const;
export const PRIORITY_LABEL: Record<string, string> = {
  NORMAL: "普通",
  IMPORTANT: "重要",
};

export const RECURRENCE_OPTIONS = [
  { value: "NONE", label: "不重复" },
  { value: "DAILY", label: "每天" },
  { value: "WEEKLY", label: "每周" },
  { value: "MONTHLY", label: "每月" },
  { value: "YEARLY", label: "每年" },
] as const;

export const RECURRENCE_LABEL: Record<string, string> = {
  NONE: "不重复",
  DAILY: "每天",
  WEEKLY: "每周",
  MONTHLY: "每月",
  YEARLY: "每年",
};

export const REMINDER_OPTIONS = [
  { value: 0, label: "准时" },
  { value: 60, label: "提前 1 小时" },
  { value: 180, label: "提前 3 小时" },
  { value: 1440, label: "提前 1 天" },
  { value: 4320, label: "提前 3 天" },
  { value: 10080, label: "提前 1 周" },
] as const;

export const REMINDER_LABEL: Record<number, string> = Object.fromEntries(
  REMINDER_OPTIONS.map((o) => [o.value, o.label]),
);

export const NOTIFICATION_STATUS_LABEL: Record<string, string> = {
  PENDING: "待发送",
  SENDING: "发送中",
  SENT: "已发送",
  FAILED: "发送失败",
  CANCELLED: "已取消",
};

export const MEDIA_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const MEDIA_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export const DEMO_SETTING_KEY = "demo_seeded";
export const LAST_EXPORT_SETTING_KEY = "last_export_at";
export const STORAGE_SETTING_KEY = "storage_config";

export const PAGE_SIZE = 20;
export const MEDIA_PAGE_SIZE = 36;
