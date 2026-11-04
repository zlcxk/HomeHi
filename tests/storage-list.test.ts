import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getStorageDriver } from "@/lib/storage";

let tempDir = "";
const originalStorageDir = process.env.STORAGE_DIR;

async function collect(prefix?: string): Promise<string[]> {
  const driver = await getStorageDriver("LOCAL");
  const keys: string[] = [];
  for await (const item of driver.list(prefix)) keys.push(item.key);
  return keys.sort();
}

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "homehi-list-"));
  process.env.STORAGE_DIR = tempDir;
  const driver = await getStorageDriver("LOCAL");
  await driver.put("media/2026/01/a.jpg", Buffer.from("a"));
  await driver.put("media/2026/01/b.jpg", Buffer.from("bb"));
  await driver.put("thumbs/2026/01/a.webp", Buffer.from("thumb"));
  await driver.put("display/2026/01/a.webp", Buffer.from("display"));
  await driver.put(".homehi-check-leftover", Buffer.from("temp"));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
  if (originalStorageDir === undefined) delete process.env.STORAGE_DIR;
  else process.env.STORAGE_DIR = originalStorageDir;
});

describe("storage list", () => {
  it("列出所有对象并统一使用正斜杠逻辑路径", async () => {
    expect(await collect()).toEqual([
      ".homehi-check-leftover",
      "display/2026/01/a.webp",
      "media/2026/01/a.jpg",
      "media/2026/01/b.jpg",
      "thumbs/2026/01/a.webp",
    ]);
  });

  it("按前缀过滤", async () => {
    expect(await collect("media/")).toEqual([
      "media/2026/01/a.jpg",
      "media/2026/01/b.jpg",
    ]);
    expect(await collect("media/2026")).toEqual([
      "media/2026/01/a.jpg",
      "media/2026/01/b.jpg",
    ]);
    expect(await collect("nothing/")).toEqual([]);
  });
});
