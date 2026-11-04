-- Phase 3：按真实查询调整索引。
-- 列表查询统一使用 [takenAt, createdAt, id] 稳定排序，游标依赖末尾的 id 列。
DROP INDEX "Media_householdId_status_takenAt_idx";
DROP INDEX "Media_householdId_status_createdAt_idx";

CREATE INDEX "Media_householdId_status_takenAt_id_idx"
  ON "Media"("householdId", "status", "takenAt", "id");
CREATE INDEX "Media_householdId_status_createdAt_id_idx"
  ON "Media"("householdId", "status", "createdAt", "id");
-- 视频列表与首页最近照片：先按类型等值过滤，再按时间取页。
CREATE INDEX "Media_householdId_status_mediaType_takenAt_id_idx"
  ON "Media"("householdId", "status", "mediaType", "takenAt", "id");
-- 成员维度的数量统计/筛选。
CREATE INDEX "Media_householdId_status_uploadedBy_createdAt_id_idx"
  ON "Media"("householdId", "status", "uploadedBy", "createdAt", "id");

-- 相册详情按 [sortOrder, mediaId] 游标分页；不再使用只有两列的前缀索引。
DROP INDEX "AlbumMedia_albumId_sortOrder_idx";
DROP INDEX "AlbumMedia_mediaId_idx";

CREATE INDEX "AlbumMedia_albumId_sortOrder_mediaId_idx"
  ON "AlbumMedia"("albumId", "sortOrder", "mediaId");
-- 覆盖“这张图属于哪些相册”和添加页的 NOT EXISTS 排除条件。
CREATE INDEX "AlbumMedia_mediaId_albumId_idx"
  ON "AlbumMedia"("mediaId", "albumId");
