/**
 * 媒体内容去重的纯逻辑。不引入数据库或存储层，方便在测试和客户端共享约束。
 *
 * 去重范围是「上传者 + 可见性」：
 * - 同一用户重复上传同一张图时复用自己已有的 Media；
 * - 不同用户上传同一张图时各自保留一条 Media，上传者始终能管理自己的记录；
 * - 私有和共享版本也分开，不会因为复用把私密照片变成共享访问。
 * - 视频、文档以及历史数据不参与去重（scope 为 null）。
 *
 * 因此不能只给 checksum 建全局唯一约束，也不能跨用户复用同一条 Media。
 */
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
  return `${userId}:${normalizedMediaVisibility(visibility)}`;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}
