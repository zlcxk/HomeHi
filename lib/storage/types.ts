import type { Readable } from "node:stream";

export const STORAGE_KINDS = ["LOCAL", "OSS"] as const;
export type StorageKind = (typeof STORAGE_KINDS)[number];

export const STORAGE_KIND_LABEL: Record<StorageKind, string> = {
  LOCAL: "本地磁盘",
  OSS: "阿里云 OSS",
};

export type StoredStat = {
  size: number;
  contentType: string | null;
};

export type StoredObject = {
  stream: Readable;
  size: number;
  contentType: string | null;
};

export type StorageUsage = {
  bytes: number;
  files: number;
  /** true 表示统计被截断（对象太多时只统计了前一部分）。 */
  partial?: boolean;
};

/**
 * 所有存储后端都实现这一组最小操作。key 是数据库里保存的逻辑路径
 * （例如 `media/2026/10/xxx.jpg`），具体后端可以再加自己的前缀。
 */
export interface StorageDriver {
  readonly kind: StorageKind;
  put(key: string, data: Buffer, contentType?: string | null): Promise<void>;
  get(key: string, range?: { start: number; end: number }): Promise<StoredObject | null>;
  stat(key: string): Promise<StoredStat | null>;
  remove(key: string): Promise<void>;
  usage(): Promise<StorageUsage | null>;
  /** 读写删一个临时对象；配置有误时抛出可读的错误。 */
  check(): Promise<void>;
}

export type OssConfig = {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  /** 可选：自定义域名或内网 endpoint，留空使用 region 的默认地址。 */
  endpoint: string;
  /** 可选：对象名前缀，例如 `homehi`，便于和其他数据共用 bucket。 */
  prefix: string;
};

export type StorageConfig = {
  driver: StorageKind;
  oss: OssConfig | null;
};
