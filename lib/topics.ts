export const TOPIC_STANCES = [
  { value: "AGREE", label: "赞成", tone: "bg-sage-soft text-sage" },
  { value: "NEUTRAL", label: "再看看", tone: "bg-raised text-muted" },
  { value: "CONCERN", label: "有顾虑", tone: "bg-accent-soft text-accent" },
] as const;

export function stanceLabel(value: string): string {
  return TOPIC_STANCES.find((item) => item.value === value)?.label || "再看看";
}

export function stanceTone(value: string): string {
  return TOPIC_STANCES.find((item) => item.value === value)?.tone || "bg-raised text-muted";
}

export function topicState(status: string, hasDecision: boolean) {
  if (status !== "CLOSED") {
    return { key: "OPEN", label: "讨论中", tone: "bg-accent-soft text-accent" };
  }
  if (hasDecision) {
    return { key: "DECIDED", label: "已决定", tone: "bg-sage-soft text-sage" };
  }
  return { key: "CLOSED", label: "已结束", tone: "bg-raised text-faint" };
}

const URL_PATTERN =
  /https?:\/\/[^\s<>"'“”‘’()[\]{}【】（）《》「」『』，。；：、！？]+/i;

const PLATFORM_HOSTS: Array<[string, string]> = [
  ["xiaohongshu.com", "小红书"],
  ["xhslink.com", "小红书"],
  ["douyin.com", "抖音"],
  ["iesdouyin.com", "抖音"],
  ["bilibili.com", "B站"],
  ["b23.tv", "B站"],
  ["weibo.com", "微博"],
  ["weibo.cn", "微博"],
  ["zhihu.com", "知乎"],
  ["kuaishou.com", "快手"],
  ["taobao.com", "淘宝"],
  ["tmall.com", "淘宝"],
  ["jd.com", "京东"],
  ["mp.weixin.qq.com", "微信"],
  ["youtube.com", "YouTube"],
  ["youtu.be", "YouTube"],
];

const PLATFORM_WORDS: Array<[string, string]> = [
  ["小红书", "小红书"],
  ["抖音", "抖音"],
  ["哔哩哔哩", "B站"],
  ["B站", "B站"],
  ["微博", "微博"],
  ["知乎", "知乎"],
  ["快手", "快手"],
  ["淘宝", "淘宝"],
  ["京东", "京东"],
  ["微信", "微信"],
];

export function linkHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

/**
 * 从一段分享文案中取出第一个合法链接。
 * 小红书/抖音等 App 分享出来通常是一段带表情和中文的文本。
 */
export function extractSharedUrl(text: string): string | null {
  const match = text.match(URL_PATTERN);
  if (!match) return null;
  const candidate = match[0].replace(/[.,;:!?]+$/, "");
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const normalized = url.toString();
    return normalized.length <= 2000 ? normalized : null;
  } catch {
    return null;
  }
}

export function detectLinkPlatform(url: string, text = ""): string | null {
  const host = linkHostname(url).toLowerCase();
  const byHost = PLATFORM_HOSTS.find(
    ([suffix]) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (byHost) return byHost[1];
  const byText = PLATFORM_WORDS.find(([word]) => text.includes(word));
  return byText ? byText[1] : null;
}

function cleanShareText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/复制(?:本条信息|此链接|打开)[^。！？\n]*/g, " ")
    .replace(/打开(?:抖音|小红书|哔哩哔哩|微博|知乎|快手)[^。！？\n]*/g, " ")
    .replace(/(?:发布|分享)了一篇[^。！？\n]*/g, " ")
    .replace(/(?:快来看吧|看看|的作品)/g, " ")
    .replace(/[^\p{L}\p{N}\s·:：,，、-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 分享文案里常见【标题】结构；没有的话，取链接前的文字做标题。
 * 都取不到时用域名兜底，用户之后可以自己改。
 */
export function deriveLinkTitle(text: string, url: string): string {
  const bracket = text.match(/【([^】]{2,80})】/);
  if (bracket) return bracket[1].trim().slice(0, 120);

  const beforeUrl = text.split(url)[0] || "";
  const candidates = [cleanShareText(beforeUrl), cleanShareText(text)];
  for (const candidate of candidates) {
    if (candidate.length >= 2) return candidate.slice(0, 120);
  }
  return linkHostname(url) || "保存的链接";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}
