-- CreateTable
CREATE TABLE "NarrativeDigest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "startAge" INTEGER NOT NULL,
    "endAge" INTEGER NOT NULL,
    "realmAtStart" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "highlightsJson" TEXT NOT NULL DEFAULT '[]',
    "coveredEventCount" INTEGER NOT NULL DEFAULT 0,
    "boundaryFingerprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NarrativeDigest_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NarrativeDigest_characterId_level_startAge_idx" ON "NarrativeDigest"("characterId", "level", "startAge");

-- CreateIndex
CREATE INDEX "NarrativeDigest_characterId_startAge_idx" ON "NarrativeDigest"("characterId", "startAge");

-- CreateIndex
CREATE UNIQUE INDEX "NarrativeDigest_characterId_boundaryFingerprint_key" ON "NarrativeDigest"("characterId", "boundaryFingerprint");

