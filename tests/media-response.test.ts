import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getStorageDriver, makeStorageKey } from "@/lib/storage";
import { storedFileResponse } from "@/lib/media-response";

let tempDir = "";
let key = "";

function request(headers: Record<string, string> = {}) {
  return storedFileResponse(new Request("http://localhost/media", { headers }), {
    key,
    kind: "LOCAL",
    contentType: "video/mp4",
    cacheControl: "private, max-age=60",
  });
}

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "homehi-media-"));
  process.env.STORAGE_DIR = tempDir;
  key = makeStorageKey("mp4");
  await (await getStorageDriver("LOCAL")).put(key, Buffer.from("0123456789"), "video/mp4");
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("storedFileResponse", () => {
  it("streams the whole file and exposes an ETag", async () => {
    const response = await request();
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-length")).toBe("10");
    expect(response?.headers.get("accept-ranges")).toBe("bytes");
    expect(response?.headers.get("etag")).toMatch(/^W\/"/);
    expect(await response?.text()).toBe("0123456789");
  });

  it("serves a single byte range with 206", async () => {
    const response = await request({ range: "bytes=2-5" });
    expect(response?.status).toBe(206);
    expect(response?.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(response?.headers.get("content-length")).toBe("4");
    expect(await response?.text()).toBe("2345");
  });

  it("supports suffix ranges", async () => {
    const response = await request({ range: "bytes=-3" });
    expect(response?.status).toBe(206);
    expect(response?.headers.get("content-range")).toBe("bytes 7-9/10");
    expect(await response?.text()).toBe("789");
  });

  it("returns 416 when the range starts past the end", async () => {
    const response = await request({ range: "bytes=20-30" });
    expect(response?.status).toBe(416);
    expect(response?.headers.get("content-range")).toBe("bytes */10");
  });

  it("answers If-None-Match with 304", async () => {
    const first = await request();
    const etag = first?.headers.get("etag") ?? "";
    const second = await request({ "if-none-match": etag });
    expect(second?.status).toBe(304);
    expect(second?.headers.get("etag")).toBe(etag);
  });
});
