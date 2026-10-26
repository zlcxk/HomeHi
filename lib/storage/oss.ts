import type { Readable } from "node:stream";
import type {
  OssConfig,
  StorageDriver,
  StorageKind,
  StorageUsage,
  StoredObject,
  StoredStat,
} from "./types";

/** ali-oss 的最小接口，避免把整个 SDK 的类型带进应用代码。 */
type OssResponse = {
  res: { status: number; headers: Record<string, string> };
};

type OssClient = {
  put(name: string, file: Buffer, options?: Record<string, unknown>): Promise<OssResponse>;
  getStream(
    name: string,
    options?: Record<string, unknown>,
  ): Promise<OssResponse & { stream: Readable }>;
  head(name: string): Promise<OssResponse>;
  delete(name: string): Promise<OssResponse>;
  list(query: Record<string, unknown>): Promise<{
    objects?: { name: string; size: number }[];
    isTruncated?: boolean;
    nextMarker?: string;
  }>;
};

const USAGE_LIST_LIMIT = 20_000;

function isNotFound(error: unknown): boolean {
  const status = (error as { status?: number; code?: string } | null)?.status;
  const code = (error as { code?: string } | null)?.code;
  return status === 404 || code === "NoSuchKey" || code === "NoSuchBucket";
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

async function createClient(config: OssConfig): Promise<OssClient> {
  // 动态引入：只配置本地存储时不需要加载 OSS SDK。
  const mod = (await import("ali-oss")) as unknown as {
    default: new (options: Record<string, unknown>) => OssClient;
  };
  const Ctor = mod.default;
  const options: Record<string, unknown> = {
    region: config.region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    secure: true,
  };
  if (config.endpoint) options.endpoint = config.endpoint;
  return new Ctor(options);
}

export class OssStorageDriver implements StorageDriver {
  readonly kind: StorageKind = "OSS";

  private readonly prefix: string;
  private clientPromise: Promise<OssClient> | null = null;

  constructor(private readonly config: OssConfig) {
    this.prefix = normalizePrefix(config.prefix);
  }

  private client(): Promise<OssClient> {
    if (!this.clientPromise) this.clientPromise = createClient(this.config);
    return this.clientPromise;
  }

  private name(key: string): string {
    return `${this.prefix}${key.replace(/^\/+/, "")}`;
  }

  async put(key: string, data: Buffer, contentType?: string | null): Promise<void> {
    const client = await this.client();
    await client.put(this.name(key), data, contentType ? { mime: contentType } : undefined);
  }

  async get(key: string, range?: { start: number; end: number }): Promise<StoredObject | null> {
    const client = await this.client();
    try {
      const result = await client.getStream(
        this.name(key),
        range
          ? { headers: { Range: `bytes=${range.start}-${range.end}` } }
          : undefined,
      );
      const headers = result.res.headers;
      return {
        stream: result.stream,
        size: Number(headers["content-length"] ?? 0),
        contentType: headers["content-type"] ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async stat(key: string): Promise<StoredStat | null> {
    const client = await this.client();
    try {
      const result = await client.head(this.name(key));
      const headers = result.res.headers;
      return {
        size: Number(headers["content-length"] ?? 0),
        contentType: headers["content-type"] ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    const client = await this.client();
    try {
      await client.delete(this.name(key));
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  async usage(): Promise<StorageUsage> {
    const client = await this.client();
    let bytes = 0;
    let files = 0;
    let marker: string | undefined;
    let partial = false;

    for (;;) {
      const page = await client.list({
        prefix: this.prefix,
        "max-keys": 1000,
        marker,
      });
      for (const object of page.objects ?? []) {
        bytes += object.size;
        files += 1;
        if (files >= USAGE_LIST_LIMIT) {
          partial = true;
          break;
        }
      }
      if (partial || !page.isTruncated || !page.nextMarker) break;
      marker = page.nextMarker;
    }

    return { bytes, files, partial };
  }

  async check(): Promise<void> {
    const client = await this.client();
    const name = this.name(`.homehi-check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const payload = Buffer.from("homehi-storage-check");
    await client.put(name, payload, { mime: "text/plain" });
    try {
      const head = await client.head(name);
      const size = Number(head.res.headers["content-length"] ?? 0);
      if (size !== payload.byteLength) {
        throw new Error("OSS 返回的对象大小与写入内容不一致");
      }
    } finally {
      await client.delete(name).catch(() => undefined);
    }
  }
}
