-- 内置主题模板：记录启用的模板、事项分类和打卡地点。
ALTER TABLE "Trip" ADD COLUMN "templateId" TEXT;
ALTER TABLE "TripPlace" ADD COLUMN "category" TEXT;
ALTER TABLE "TripVisit" ADD COLUMN "location" TEXT;

-- 同一账号重复启用同一模板时复用已有旅行。
-- SQLite 的唯一索引允许多个 NULL，因此不影响未使用模板的历史旅行。
CREATE UNIQUE INDEX "Trip_householdId_createdBy_templateId_key"
  ON "Trip"("householdId", "createdBy", "templateId");
