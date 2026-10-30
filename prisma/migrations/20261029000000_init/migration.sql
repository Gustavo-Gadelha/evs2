-- CreateTable
CREATE TABLE "HistoryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sql" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "manual" BOOLEAN NOT NULL,
    "rowCount" INTEGER,
    "error" TEXT,
    "result" TEXT
);

-- CreateTable
CREATE TABLE "SavedQuery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sql" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "manual" BOOLEAN NOT NULL
);

-- CreateIndex
CREATE INDEX "HistoryEntry_createdAt_idx" ON "HistoryEntry"("createdAt");

-- CreateIndex
CREATE INDEX "SavedQuery_savedAt_idx" ON "SavedQuery"("savedAt");

