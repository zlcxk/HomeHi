-- 中等尺寸图片与压缩视频播放版；原文件继续保留。
ALTER TABLE "Media" ADD COLUMN "displayKey" TEXT;
ALTER TABLE "Media" ADD COLUMN "displaySize" INTEGER;
ALTER TABLE "Media" ADD COLUMN "playbackKey" TEXT;
ALTER TABLE "Media" ADD COLUMN "playbackSize" INTEGER;
ALTER TABLE "Media" ADD COLUMN "playbackStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Media" ADD COLUMN "playbackError" TEXT;

UPDATE "Media" SET "playbackStatus" = 'READY' WHERE "mediaType" = 'IMAGE';

-- 已有关联档案的头像同步到账号，账号头像再补回档案。
UPDATE "User"
SET "avatarMediaId" = (
  SELECT "FamilyProfile"."avatarMediaId"
  FROM "FamilyProfile"
  WHERE "FamilyProfile"."linkedUserId" = "User"."id"
    AND "FamilyProfile"."avatarMediaId" IS NOT NULL
  LIMIT 1
)
WHERE "avatarMediaId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "FamilyProfile"
    WHERE "FamilyProfile"."linkedUserId" = "User"."id"
      AND "FamilyProfile"."avatarMediaId" IS NOT NULL
  );

UPDATE "FamilyProfile"
SET "avatarMediaId" = (
  SELECT "User"."avatarMediaId" FROM "User" WHERE "User"."id" = "FamilyProfile"."linkedUserId"
)
WHERE "linkedUserId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "User"
    WHERE "User"."id" = "FamilyProfile"."linkedUserId"
      AND "User"."avatarMediaId" IS NOT NULL
  );

-- 账号称呼是身份来源，已关联档案跟随账号。
UPDATE "FamilyProfile"
SET "name" = (
  SELECT "User"."displayName" FROM "User" WHERE "User"."id" = "FamilyProfile"."linkedUserId"
)
WHERE "linkedUserId" IS NOT NULL;
