/**
 * 媒体内容去重的纯逻辑。不引入数据库或存储层，方便在测试和客户端共享约束。
 *
 * 去重范围：
 * - 共享（HOUSEHOLD）图片：同一家庭内共用一条 Media，scope 固定为 SHARED。
 * - 私有（PRIVATE）图片：按上传者隔离，scope 为上传者 userId。
 * - 视频、文档以及历史数据不参与去重（scope 为 null）。
 *
 * 因此不能只给 checksum 建全局唯一约束：同一张图可以同时存在共享版本
 * 和不同用户的私有版本。
 */
export const SHARED_DEDUPE_SCOPE = "SHARED";

export const MAX_ALBUM_MEDIA_BATCH = 200;

export function normalizedMediaVisibility(visibility: string | null | undefined): "HOUSEHOLD" | "PRIVATE" {
  return visibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD";
}

export function dedupeScopeFor(
  mediaType: string,
  visibility: string | null | undefined,
  userId: string,
): string | null {
  if (mediaType !== "IMAGE") return null;
  return normalizedMediaVisibility(visibility) === "PRIVATE" ? userId : SHARED_DEDUPE_SCOPE;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}
