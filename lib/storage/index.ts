// 注意：这里不加 `server-only`，因为 seed/backup 等 tsx 脚本会直接复用存储层。
// 该模块只能在服务端导入，客户端请只引用 `@/lib/storage/types`。
import { randomUUID } from "node:crypto";
import { LocalStorageDriver, ensureSafeKey, ensureStorage, saveStream, storageRoot } from "./local";
import { OssStorageDriver } from "./oss";
import { getStorageConfig, normalizeStorageKind } from "./config";
import type {
  OssConfig,
  StorageConfig,
  StorageDriver,
  StorageKind,
  StorageUsage,
  StoredObject,
  StoredStat,
} from "./types";

export * from "./types";
export { ensureSafeKey, ensureStorage, saveStream, storageRoot };
export {
  clearStorageConfigCache,
  envStorageConfig,
  getStorageConfig,
  normalizeOssConfig,
  normalizeStorageKind,
  saveStorageConfig,
} from "./config";

const localDriver = new LocalStorageDriver();
let ossCache: { key: string; driver: OssStorageDriver } | null = null;

function ossDriver(config: OssConfig): OssStorageDriver {
  const key = JSON.stringify(config);
  if (ossCache?.key === key) return ossCache.driver;
  const driver = new OssStorageDriver(config);
  ossCache = { key, driver };
  return driver;
}

/**
 * 传入 kind 时按该后端读写（用于读取历史文件，媒体记录里保存了当时的后端）；
 * 不传时使用当前配置的活动后端（用于新上传）。
 */
export async function getStorageDriver(
  kind?: StorageKind | string | null,
): Promise<StorageDriver> {
  const requested = kind ? normalizeStorageKind(kind) : (await getStorageConfig()).driver;
  if (requested === "LOCAL") return localDriver;

  const config = await getStorageConfig();
  if (!config.oss) {
    throw new Error("OSS 存储尚未配置完整，无法读取该文件");
  }
  return ossDriver(config.oss);
}

/** 用尚未保存的配置做一次读写测试。 */
export async function testStorageConfig(config: StorageConfig): Promise<void> {
  let driver: StorageDriver;
  if (config.driver === "OSS") {
    if (!config.oss) throw new Error("OSS 配置不完整");
    driver = ossDriver(config.oss);
  } else {
    driver = localDriver;
  }
  await driver.check();
}

export async function saveBuffer(
  key: string,
  data: Buffer,
  contentType?: string | null,
  kind?: StorageKind | string | null,
): Promise<void> {
  const driver = await getStorageDriver(kind);
  await driver.put(key, data, contentType);
}

export async function getStoredObject(
  key: string,
  kind?: StorageKind | string | null,
  range?: { start: number; end: number },
): Promise<StoredObject | null> {
  const driver = await getStorageDriver(kind);
  return driver.get(key, range);
}

export async function statStoredFile(
  key: string,
  kind?: StorageKind | string | null,
): Promise<StoredStat | null> {
  const driver = await getStorageDriver(kind);
  return driver.stat(key);
}

export async function removeStoredFile(
  key: string | null | undefined,
  kind?: StorageKind | string | null,
): Promise<void> {
  if (!key) return;
  const driver = await getStorageDriver(kind);
  await driver.remove(key);
}

export async function storageUsage(): Promise<StorageUsage> {
  const driver = await getStorageDriver();
  return (await driver.usage()) ?? { bytes: 0, files: 0 };
}

export function makeStorageKey(extension: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `media/${year}/${month}/${randomUUID()}.${extension}`;
}

export function makeThumbKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `thumbs/${year}/${month}/${randomUUID()}.webp`;
}

export function mediaUrl(id: string, variant: "file" | "thumb" = "file", version?: string): string {
  return `/api/media/${id}/${variant}${version ? `?v=${encodeURIComponent(version)}` : ""}`;
}
