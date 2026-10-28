-- 缩略图和详情图的生成状态、尺寸与错误。原媒体字段不变。
ALTER TABLE "Media" ADD COLUMN "thumbnailWidth" INTEGER;
ALTER TABLE "Media" ADD COLUMN "thumbnailHeight" INTEGER;
ALTER TABLE "Media" ADD COLUMN "thumbnailStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Media" ADD COLUMN "thumbnailError" TEXT;
ALTER TABLE "Media" ADD COLUMN "displayWidth" INTEGER;
ALTER TABLE "Media" ADD COLUMN "displayHeight" INTEGER;
ALTER TABLE "Media" ADD COLUMN "displayStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Media" ADD COLUMN "displayError" TEXT;

-- 已有缩略图标为完成；尺寸留空，首次读取时按新的 240px 规格自动升级。
UPDATE "Media" SET "thumbnailStatus" = 'READY' WHERE "thumbnailKey" IS NOT NULL;
UPDATE "Media"
SET "thumbnailStatus" = 'SKIPPED'
WHERE "mediaType" NOT IN ('IMAGE', 'VIDEO') AND "thumbnailKey" IS NULL;

UPDATE "Media" SET "displayStatus" = 'READY' WHERE "displayKey" IS NOT NULL;
UPDATE "Media"
SET "displayStatus" = 'SKIPPED'
WHERE "mediaType" <> 'IMAGE' OR "mimeType" = 'image/gif';
