-- 回收站可靠性：记录删除前状态、媒体引用快照、彻底删除认领时间，
-- 并为 30 天清理扫描补索引。仅新增列和索引，不删除任何行或文件。

ALTER TABLE "Entry" ADD COLUMN "deletedFromStatus" TEXT;
ALTER TABLE "Media" ADD COLUMN "deletedRefs" TEXT;
ALTER TABLE "Media" ADD COLUMN "purgeStartedAt" DATETIME;

-- 升级前的回收站行如果缺少删除时间，从升级时刻重新计算 30 天，
-- 避免升级后立即永久删除历史数据。已有删除时间的行保持原值。
UPDATE "Entry" SET "deletedAt" = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE "status" = 'DELETED' AND "deletedAt" IS NULL;

UPDATE "Media" SET "deletedAt" = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE "status" = 'DELETED' AND "deletedAt" IS NULL;

-- 去重范围从「共享 / 私有」改为「上传者 + 可见性」，避免复用其他成员的
-- Media 行后上传者无法管理。先迁移私有行（旧 scope = 上传者 id），
-- 再迁移共享行；两步的结果不会互相冲突。
UPDATE "Media" SET "dedupeScope" = "uploadedBy" || ':PRIVATE'
WHERE "dedupeScope" IS NOT NULL AND "dedupeScope" = "uploadedBy";

UPDATE "Media" SET "dedupeScope" = "uploadedBy" || ':HOUSEHOLD'
WHERE "dedupeScope" = 'SHARED';

CREATE INDEX "Entry_status_deletedAt_idx" ON "Entry"("status", "deletedAt");
CREATE INDEX "Entry_coverMediaId_idx" ON "Entry"("coverMediaId");
CREATE INDEX "Media_status_deletedAt_idx" ON "Media"("status", "deletedAt");
CREATE INDEX "Media_status_purgeStartedAt_idx" ON "Media"("status", "purgeStartedAt");
CREATE INDEX "Album_coverMediaId_idx" ON "Album"("coverMediaId");
CREATE INDEX "Trip_coverMediaId_idx" ON "Trip"("coverMediaId");
CREATE INDEX "User_avatarMediaId_idx" ON "User"("avatarMediaId");
CREATE INDEX "FamilyProfile_avatarMediaId_idx" ON "FamilyProfile"("avatarMediaId");
CREATE INDEX "Asset_photoMediaId_idx" ON "Asset"("photoMediaId");
