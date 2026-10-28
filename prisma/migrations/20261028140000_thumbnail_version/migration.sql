-- 记录缩略图规格版本：0 表示旧的 240px / 480px 封面，升级后由读取或 worker 重做。
ALTER TABLE "Media" ADD COLUMN "thumbnailVersion" INTEGER NOT NULL DEFAULT 0;
