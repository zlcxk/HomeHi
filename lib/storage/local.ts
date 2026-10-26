import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type {
  StorageDriver,
  StorageKind,
  StorageUsage,
  StoredObject,
  StoredStat,
} from "./types";

export function storageRoot(): string {
  return path.resolve(process.env.STORAGE_DIR || "./storage");
}

export function ensureSafeKey(key: string): string {
  const root = storageRoot();
  const target = path.resolve(root, key);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("非法的存储路径");
  }
  return target;
}

export async function ensureStorage(): Promise<void> {
  await mkdir(storageRoot(), { recursive: true });
}

export async function saveStream(key: string, stream: NodeJS.ReadableStream): Promise<void> {
  const target = ensureSafeKey(key);
  await mkdir(path.dirname(target), { recursive: true });
  await pipeline(stream, createWriteStream(target));
}

export class LocalStorageDriver implements StorageDriver {
  readonly kind: StorageKind = "LOCAL";

  async put(key: string, data: Buffer): Promise<void> {
    const target = ensureSafeKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async get(key: string, range?: { start?: number; end?: number }): Promise<StoredObject | null> {
    const target = ensureSafeKey(key);
    let info;
    try {
      info = await stat(target);
    } catch {
      return null;
    }
    const stream = createReadStream(target, range ? { start: range.start, end: range.end } : undefined);
    return { stream, size: info.size, contentType: null };
  }

  async stat(key: string): Promise<StoredStat | null> {
    try {
      const info = await stat(ensureSafeKey(key));
      return { size: info.size, contentType: null };
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(ensureSafeKey(key));
    } catch {
      // 已经不存在
    }
  }

  async usage(): Promise<StorageUsage> {
    let bytes = 0;
    let files = 0;

    async function walk(dir: string) {
      let items;
      try {
        items = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) await walk(full);
        else if (item.isFile()) {
          files += 1;
          try {
            bytes += (await stat(full)).size;
          } catch {
            // skip
          }
        }
      }
    }

    await walk(storageRoot());
    return { bytes, files };
  }

  async check(): Promise<void> {
    await ensureStorage();
    const key = `.homehi-check-${randomUUID()}`;
    const payload = Buffer.from("homehi-storage-check");
    await this.put(key, payload);
    const info = await this.stat(key);
    await this.remove(key);
    if (!info || info.size !== payload.byteLength) {
      throw new Error(`存储目录不可写：${storageRoot()}`);
    }
  }
}
