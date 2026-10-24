import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";

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

export async function saveBuffer(key: string, data: Buffer): Promise<void> {
  const target = ensureSafeKey(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}

export async function saveStream(key: string, stream: NodeJS.ReadableStream): Promise<void> {
  const target = ensureSafeKey(key);
  await mkdir(path.dirname(target), { recursive: true });
  await pipeline(stream, createWriteStream(target));
}

export async function removeStoredFile(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await unlink(ensureSafeKey(key));
  } catch {
    // already gone
  }
}

export function readStoredStream(key: string, options?: { start?: number; end?: number }) {
  return createReadStream(ensureSafeKey(key), options);
}

export async function statStoredFile(key: string) {
  try {
    return await stat(ensureSafeKey(key));
  } catch {
    return null;
  }
}

export async function storageUsage(): Promise<{ bytes: number; files: number }> {
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
