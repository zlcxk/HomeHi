-- 100k 基准中，收藏筛选走时间索引需要扫描大量非收藏行；补一个与列表
-- 排序键一致的收藏索引后，首页收藏列表稳定在毫秒级。
CREATE INDEX "Media_householdId_status_favorite_takenAt_createdAt_id_idx"
  ON "Media"("householdId", "status", "favorite", "takenAt", "createdAt", "id");
