-- 从高德地图选点后保存坐标，用于在页面上打开地图导航
ALTER TABLE "TripPlace" ADD COLUMN "latitude" REAL;
ALTER TABLE "TripPlace" ADD COLUMN "longitude" REAL;
