export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "Asia/Shanghai", label: "中国标准时间 · 上海" },
  { value: "Asia/Hong_Kong", label: "香港时间" },
  { value: "Asia/Taipei", label: "台北时间" },
  { value: "Asia/Tokyo", label: "日本时间 · 东京" },
  { value: "Asia/Singapore", label: "新加坡时间" },
  { value: "Asia/Seoul", label: "韩国时间 · 首尔" },
  { value: "Asia/Bangkok", label: "泰国时间 · 曼谷" },
  { value: "Asia/Dubai", label: "海湾时间 · 迪拜" },
  { value: "Europe/London", label: "英国时间 · 伦敦" },
  { value: "Europe/Paris", label: "中欧时间 · 巴黎" },
  { value: "Europe/Berlin", label: "中欧时间 · 柏林" },
  { value: "Europe/Moscow", label: "莫斯科时间" },
  { value: "America/New_York", label: "美东时间 · 纽约" },
  { value: "America/Chicago", label: "美中时间 · 芝加哥" },
  { value: "America/Denver", label: "山地时间 · 丹佛" },
  { value: "America/Los_Angeles", label: "美西时间 · 洛杉矶" },
  { value: "America/Vancouver", label: "太平洋时间 · 温哥华" },
  { value: "Australia/Sydney", label: "悉尼时间" },
  { value: "Pacific/Auckland", label: "新西兰时间 · 奥克兰" },
  { value: "UTC", label: "协调世界时 · UTC" },
];

export function timezoneOptions(current?: string | null): { value: string; label: string }[] {
  const base = [...COMMON_TIMEZONES];
  if (current && !base.some((zone) => zone.value === current)) {
    base.unshift({ value: current, label: current });
  }
  return base;
}

export function isValidTimezone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("zh-CN", { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  } catch {
    return "Asia/Shanghai";
  }
}
