-- 旅行：主题旅行与单次旅行、地点、到访记录、到访照片和附件链接。
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SINGLE',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "coverMediaId" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "visibility" TEXT NOT NULL DEFAULT 'HOUSEHOLD',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trip_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trip_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TripPlace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "address" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TripPlace_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TripVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "placeId" TEXT NOT NULL,
    "visitedAt" DATETIME NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripVisit_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "TripPlace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TripVisit_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TripVisitPhoto" (
    "visitId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("visitId", "mediaId"),
    CONSTRAINT "TripVisitPhoto_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "TripVisit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TripVisitPhoto_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TripLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripLink_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Trip_householdId_kind_idx" ON "Trip"("householdId", "kind");
CREATE INDEX "Trip_householdId_startDate_idx" ON "Trip"("householdId", "startDate");
CREATE INDEX "TripPlace_tripId_sortOrder_idx" ON "TripPlace"("tripId", "sortOrder");
CREATE INDEX "TripVisit_placeId_visitedAt_idx" ON "TripVisit"("placeId", "visitedAt");
CREATE INDEX "TripVisitPhoto_mediaId_idx" ON "TripVisitPhoto"("mediaId");
CREATE INDEX "TripLink_tripId_sortOrder_idx" ON "TripLink"("tripId", "sortOrder");
