-- AlterTable
ALTER TABLE "Task" ADD COLUMN "relatedAssetIds" TEXT;

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN "relatedAssetIds" TEXT;

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "location" TEXT,
    "purchaseDate" DATETIME,
    "purchasePrice" REAL,
    "vendor" TEXT,
    "warrantyUntil" DATETIME,
    "maintenanceEveryDays" INTEGER,
    "insuranceUntil" DATETIME,
    "insuranceProvider" TEXT,
    "notes" TEXT,
    "photoMediaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "visibility" TEXT NOT NULL DEFAULT 'HOUSEHOLD',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Asset_householdId_category_idx" ON "Asset"("householdId", "category");

-- CreateIndex
CREATE INDEX "Asset_householdId_warrantyUntil_idx" ON "Asset"("householdId", "warrantyUntil");

-- CreateIndex
CREATE INDEX "Asset_householdId_insuranceUntil_idx" ON "Asset"("householdId", "insuranceUntil");
