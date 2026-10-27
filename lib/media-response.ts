import { Readable } from "node:stream";
import { getStorageDriver, type StorageKind } from "@/lib/storage";

export type StoredFileResponseOptions = {
  key: string;
  kind: StorageKind | string | null;
  contentType: string;
  cacheControl: string;
  filename?: string;
  download?: boolean;
  /** 文件大小已知时跳过 head 请求。 */
  size?: number | null;
};

function contentDisposition(filename: string, download: boolean): string {
  const safe = encodeURIComponent(filename);
  return `${download ? "attachment" : "inline"}; filename*=UTF-8''${safe}`;
}

/**
 * 从当前或历史存储后端流式返回文件，并支持单段 Range（视频拖动进度条需要）。
 * 返回 null 表示对象不存在。
 */
export async function storedFileResponse(
  request: Request,
  options: StoredFileResponseOptions,
): Promise<Response | null> {
  const driver = await getStorageDriver(options.kind);
  const stat = options.size ? { size: options.size } : await driver.stat(options.key);
  if (!stat || stat.size <= 0) return null;

  const headers: Record<string, string> = {
    "Content-Type": options.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": options.cacheControl,
    "X-Content-Type-Options": "nosniff",
  };
  if (options.filename) {
    headers["Content-Disposition"] = contentDisposition(options.filename, Boolean(options.download));
  }

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      let start = match[1] ? Number(match[1]) : NaN;
      let end = match[2] ? Number(match[2]) : NaN;

      if (!Number.isFinite(start) && Number.isFinite(end)) {
        // bytes=-500 表示最后 500 字节。
        start = Math.max(0, stat.size - end);
        end = stat.size - 1;
      } else {
        if (!Number.isFinite(start)) start = 0;
        if (!Number.isFinite(end)) end = stat.size - 1;
      }

      if (start >= 0 && start <= end && start < stat.size) {
        const safeEnd = Math.min(end, stat.size - 1);
        const object = await driver.get(options.key, { start, end: safeEnd });
        if (!object) return null;
        return new Response(Readable.toWeb(object.stream) as unknown as ReadableStream, {
          status: 206,
          headers: {
            ...headers,
            "Content-Range": `bytes ${start}-${safeEnd}/${stat.size}`,
            "Content-Length": String(safeEnd - start + 1),
          },
        });
      }

      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }
  }

  const object = await driver.get(options.key);
  if (!object) return null;
  return new Response(Readable.toWeb(object.stream) as unknown as ReadableStream, {
    status: 200,
    headers: { ...headers, "Content-Length": String(stat.size) },
  });
}
