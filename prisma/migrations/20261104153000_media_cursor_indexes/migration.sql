-- Phase 3 实测修正：keyset 查询需要完整的 [takenAt, createdAt, id] 排序键。
-- 100k 行基准中，只有 takenAt、id 的索引仍会触发临时排序。
DROP INDEX "Media_householdId_status_takenAt_id_idx";
DROP INDEX "Media_householdId_status_mediaType_takenAt_id_idx";

CREATE INDEX "Media_householdId_status_takenAt_createdAt_id_idx"
  ON "Media"("householdId", "status", "takenAt", "createdAt", "id");
CREATE INDEX "Media_householdId_status_mediaType_takenAt_createdAt_id_idx"
  ON "Media"("householdId", "status", "mediaType", "takenAt", "createdAt", "id");

-- 成员维度索引会让列表查询改用错误的索引并产生 TEMP B-TREE；
-- 数量统计仍可走时间索引，因此移除该索引。
DROP INDEX "Media_householdId_status_uploadedBy_createdAt_id_idx";
