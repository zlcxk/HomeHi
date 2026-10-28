-- 农历生日与农历日程。
-- FamilyProfile: 生日仍是公历 DateTime，lunarMonth/lunarDay 记录原始农历月日。
-- CalendarEvent: startsAt 是换算后的公历时间，isLunar + lunar* 用于按农历每年重复。

ALTER TABLE "FamilyProfile" ADD COLUMN "birthdayCalendar" TEXT NOT NULL DEFAULT 'SOLAR';
ALTER TABLE "FamilyProfile" ADD COLUMN "lunarMonth" INTEGER;
ALTER TABLE "FamilyProfile" ADD COLUMN "lunarDay" INTEGER;
ALTER TABLE "FamilyProfile" ADD COLUMN "lunarLeap" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CalendarEvent" ADD COLUMN "isLunar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CalendarEvent" ADD COLUMN "lunarMonth" INTEGER;
ALTER TABLE "CalendarEvent" ADD COLUMN "lunarDay" INTEGER;
ALTER TABLE "CalendarEvent" ADD COLUMN "lunarLeap" BOOLEAN NOT NULL DEFAULT false;
