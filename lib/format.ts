export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const chars = Array.from(trimmed);
  if (/^[a-zA-Z]/.test(trimmed)) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : trimmed.slice(0, 2)).toUpperCase();
  }
  return chars.slice(0, 2).join("");
}

const AVATAR_TONES = [
  ["#E8D8C3", "#7A4B2A"],
  ["#DDE8D8", "#3F5C43"],
  ["#E6DCEB", "#5B3E68"],
  ["#EAD9D5", "#7A3F35"],
  ["#DCE4EA", "#35505F"],
  ["#EDE3CD", "#6B552A"],
];

export function avatarTone(name: string): { background: string; color: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const [background, color] = AVATAR_TONES[hash % AVATAR_TONES.length];
  return { background, color };
}

export function excerpt(text: string | null | undefined, max = 120): string {
  if (!text) return "";
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function countLabel(count: number, unit = "条"): string {
  return `${count} ${unit}`;
}

export function durationLabel(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function mediaCountLabel(count: number): string {
  return count > 0 ? `${count} 张` : "";
}

export function weekdayShort(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
}
