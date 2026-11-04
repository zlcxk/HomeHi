-- Phase 4：软删除保留文件，彻底删除失败时留下可重试的记录。
ALTER TABLE "Media" ADD COLUMN "purgeError" TEXT;
ALTER TABLE "Media" ADD COLUMN "purgeAttemptedAt" DATETIME;
