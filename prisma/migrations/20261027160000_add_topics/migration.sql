-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "keyword" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "trendsFetchedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Topic_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Topic_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" TEXT,
    "author" TEXT,
    "heat" TEXT,
    "summary" TEXT,
    "coverUrl" TEXT,
    "publishedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TopicContent_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicOpinion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stance" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TopicOpinion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TopicOpinion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Topic_householdId_status_createdAt_idx" ON "Topic"("householdId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TopicContent_topicId_sortOrder_idx" ON "TopicContent"("topicId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TopicContent_topicId_url_key" ON "TopicContent"("topicId", "url");

-- CreateIndex
CREATE INDEX "TopicOpinion_topicId_createdAt_idx" ON "TopicOpinion"("topicId", "createdAt");
