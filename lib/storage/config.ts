// 不使用 `server-only`：tsx 脚本（seed / backup）也会读取这份配置。
import { prisma } from "@/lib/db";
import { STORAGE_SETTING_KEY } from "@/lib/constants";
import {
  STORAGE_KINDS,
  type OssConfig,
  type StorageConfig,
  type StorageKind,
} from "./types";

const CACHE_TTL_MS = 10_000;

let cached: { at: number; config: StorageConfig } | null = null;

export function clearStorageConfigCache(): void {
  cached = null;
}

export function normalizeStorageKind(value: string | null | undefined): StorageKind {
  const upper = (value ?? "").trim().toUpperCase();
  return (STORAGE_KINDS as readonly string[]).includes(upper) ? (upper as StorageKind) : "LOCAL";
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** 只有必填项齐全时才认为 OSS 配置可用。 */
export function normalizeOssConfig(
  input: Partial<OssConfig> | null | undefined,
): OssConfig | null {
  if (!input) return null;
  const region = clean(input.region);
  const bucket = clean(input.bucket);
  const accessKeyId = clean(input.accessKeyId);
  const accessKeySecret = clean(input.accessKeySecret);
  if (!region || !bucket || !accessKeyId || !accessKeySecret) return null;
  return {
    region,
    bucket,
    accessKeyId,
    accessKeySecret,
    endpoint: clean(input.endpoint),
    prefix: clean(input.prefix),
  };
}

function parseStoredConfig(raw: string): StorageConfig | null {
  try {
    const parsed = JSON.parse(raw) as { driver?: string; oss?: Partial<OssConfig> | null };
    return {
      driver: normalizeStorageKind(parsed.driver),
      oss: normalizeOssConfig(parsed.oss),
    };
  } catch {
    return null;
  }
}

/** 没有在界面里保存过配置时，允许用环境变量初始化。 */
export function envStorageConfig(): StorageConfig {
  const driver = normalizeStorageKind(process.env.STORAGE_DRIVER);
  const oss = normalizeOssConfig({
    region: process.env.OSS_REGION,
    bucket: process.env.OSS_BUCKET,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    endpoint: process.env.OSS_ENDPOINT,
    prefix: process.env.OSS_PREFIX,
  });
  if (driver === "OSS" && oss) return { driver: "OSS", oss };
  return { driver: "LOCAL", oss };
}

export async function getStorageConfig(): Promise<StorageConfig> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.config;

  let config = envStorageConfig();
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: STORAGE_SETTING_KEY } });
    if (row) {
      const parsed = parseStoredConfig(row.value);
      if (parsed) config = parsed;
    }
  } catch {
    // 数据库还没初始化（例如首次构建）时，退回环境变量 / 本地存储。
  }

  cached = { at: Date.now(), config };
  return config;
}

export async function saveStorageConfig(config: StorageConfig): Promise<void> {
  const normalized: StorageConfig = {
    driver: config.driver === "OSS" ? "OSS" : "LOCAL",
    // 即使当前使用本地存储，也保留 OSS 配置，切换后旧对象仍然可读。
    oss: normalizeOssConfig(config.oss),
  };

  await prisma.appSetting.upsert({
    where: { key: STORAGE_SETTING_KEY },
    create: { key: STORAGE_SETTING_KEY, value: JSON.stringify(normalized) },
    update: { value: JSON.stringify(normalized) },
  });
  clearStorageConfigCache();
}
