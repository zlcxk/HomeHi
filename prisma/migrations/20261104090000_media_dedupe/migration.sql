-- Phase 1：图片内容去重的并发保护。
-- SQLite 的唯一索引允许多个 NULL，因此视频和历史媒体不受影响。
ALTER TABLE "Media" ADD COLUMN "dedupeScope" TEXT;

CREATE UNIQUE INDEX "Media_householdId_checksum_dedupeScope_key"
ON "Media"("householdId", "checksum", "dedupeScope");
