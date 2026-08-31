-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "age" INTEGER NOT NULL DEFAULT 0,
    "lifespan" INTEGER NOT NULL DEFAULT 80,
    "gender" TEXT NOT NULL DEFAULT 'male',
    "spiritualRoot" TEXT NOT NULL DEFAULT 'none',
    "rootDetail" TEXT NOT NULL DEFAULT '',
    "realm" TEXT NOT NULL DEFAULT 'mortal',
    "realmLevel" INTEGER NOT NULL DEFAULT 0,
    "cultivationExp" INTEGER NOT NULL DEFAULT 0,
    "expToBreak" INTEGER NOT NULL DEFAULT 100,
    "elementMetal" INTEGER NOT NULL DEFAULT 20,
    "elementWood" INTEGER NOT NULL DEFAULT 20,
    "elementWater" INTEGER NOT NULL DEFAULT 20,
    "elementFire" INTEGER NOT NULL DEFAULT 20,
    "elementEarth" INTEGER NOT NULL DEFAULT 20,
    "hp" INTEGER NOT NULL DEFAULT 100,
    "maxHp" INTEGER NOT NULL DEFAULT 100,
    "mp" INTEGER NOT NULL DEFAULT 50,
    "maxMp" INTEGER NOT NULL DEFAULT 50,
    "attack" INTEGER NOT NULL DEFAULT 10,
    "defense" INTEGER NOT NULL DEFAULT 5,
    "speed" INTEGER NOT NULL DEFAULT 10,
    "luck" INTEGER NOT NULL DEFAULT 50,
    "comprehension" INTEGER NOT NULL DEFAULT 50,
    "spiritStones" INTEGER NOT NULL DEFAULT 0,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "alive" BOOLEAN NOT NULL DEFAULT true,
    "ascended" BOOLEAN NOT NULL DEFAULT false,
    "causeOfDeath" TEXT NOT NULL DEFAULT '',
    "faction" TEXT NOT NULL DEFAULT '',
    "master" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '凡间',
    "fateNodes" TEXT NOT NULL DEFAULT '',
    "isAtChoice" BOOLEAN NOT NULL DEFAULT false,
    "lastEventAge" INTEGER NOT NULL DEFAULT -1,
    "statusJson" TEXT NOT NULL DEFAULT '[]',
    "inventoryJson" TEXT NOT NULL DEFAULT '[]',
    "equippedJson" TEXT NOT NULL DEFAULT '[]',
    "storageCapacity" INTEGER NOT NULL DEFAULT 9,
    "cultivationMultiplier" REAL NOT NULL DEFAULT 1.0,
    "cultivationInsight" TEXT NOT NULL DEFAULT '',
    "cultivationFactorsJson" TEXT NOT NULL DEFAULT '[]',
    "pendingChoiceJson" TEXT NOT NULL DEFAULT '',
    "memoryJson" TEXT NOT NULL DEFAULT '[]',
    "pendingThreadsJson" TEXT NOT NULL DEFAULT '[]',
    "characterIntentsJson" TEXT NOT NULL DEFAULT '[]',
    "combatStateJson" TEXT NOT NULL DEFAULT '',
    "recentEventTypesJson" TEXT NOT NULL DEFAULT '[]',
    "npcsJson" TEXT NOT NULL DEFAULT '[]',
    "causalGraphJson" TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    "worldFactsJson" TEXT NOT NULL DEFAULT '[]',
    "recentBlueprintCategoriesJson" TEXT NOT NULL DEFAULT '[]',
    "heartDemon" INTEGER NOT NULL DEFAULT 0,
    "petsJson" TEXT NOT NULL DEFAULT '[]',
    "styleAnchorsJson" TEXT NOT NULL DEFAULT '[]',
    "entityEntriesJson" TEXT NOT NULL DEFAULT '[]',
    "exploredRealmsJson" TEXT NOT NULL DEFAULT '[]',
    "ascensionPending" BOOLEAN NOT NULL DEFAULT false,
    "ascensionSessionJson" TEXT NOT NULL DEFAULT 'null',
    "restrictionPending" BOOLEAN NOT NULL DEFAULT false,
    "restrictionDataJson" TEXT NOT NULL DEFAULT 'null',
    "tribulationPending" BOOLEAN NOT NULL DEFAULT false,
    "tribulationSessionJson" TEXT NOT NULL DEFAULT 'null',
    "tribulationResultJson" TEXT NOT NULL DEFAULT 'null',
    "worldCalendarJson" TEXT NOT NULL DEFAULT '{"eraName":"青岚仙历","calendarYear":5000,"elapsedDays":0}',
    "originJson" TEXT NOT NULL DEFAULT 'null',
    "bodyGrowthResidualJson" TEXT NOT NULL DEFAULT 'null',
    CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'normal',
    "effects" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChoiceLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "chosenIndex" INTEGER NOT NULL,
    "chosenText" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChoiceLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterferenceLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "input" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'action',
    "response" TEXT NOT NULL,
    "effects" TEXT NOT NULL DEFAULT '[]',
    "accepted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterferenceLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdvancePreload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "baseAge" INTEGER NOT NULL,
    "baseStateHash" TEXT NOT NULL,
    "preparedStateJson" TEXT NOT NULL,
    "blueprintJson" TEXT NOT NULL,
    "aiOutputJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdvancePreload_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "previousEventId" TEXT,
    "aggregateVersion" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAtAge" INTEGER,
    "source" TEXT NOT NULL,
    "aiPromptHash" TEXT,
    "triggerActor" TEXT,
    CONSTRAINT "Event_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_previousEventId_fkey" FOREIGN KEY ("previousEventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectionSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "lastEventVersion" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorldChronicle" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "eraName" TEXT NOT NULL DEFAULT '青岚仙历',
    "currentYear" INTEGER NOT NULL DEFAULT 5000,
    "generatedUntilYear" INTEGER NOT NULL DEFAULT 5000,
    "scheduleJson" TEXT NOT NULL DEFAULT '[]',
    "historyJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NpcRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "npcKey" TEXT NOT NULL,
    "npcName" TEXT NOT NULL,
    "affinity" INTEGER NOT NULL DEFAULT 0,
    "trust" INTEGER NOT NULL DEFAULT 0,
    "hostility" INTEGER NOT NULL DEFAULT 0,
    "lastAge" INTEGER NOT NULL DEFAULT 0,
    "lastEvent" TEXT NOT NULL DEFAULT '',
    "tag" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NpcRelationship_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NarrativeMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "intensity" INTEGER NOT NULL DEFAULT 50,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "age" INTEGER NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NarrativeMemory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_token_idx" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Character_userId_idx" ON "Character"("userId");

-- CreateIndex
CREATE INDEX "EventLog_characterId_age_idx" ON "EventLog"("characterId", "age");

-- CreateIndex
CREATE INDEX "EventLog_characterId_idx" ON "EventLog"("characterId");

-- CreateIndex
CREATE INDEX "ChoiceLog_characterId_age_idx" ON "ChoiceLog"("characterId", "age");

-- CreateIndex
CREATE INDEX "InterferenceLog_characterId_age_idx" ON "InterferenceLog"("characterId", "age");

-- CreateIndex
CREATE UNIQUE INDEX "AdvancePreload_characterId_key" ON "AdvancePreload"("characterId");

-- CreateIndex
CREATE INDEX "AdvancePreload_characterId_baseAge_idx" ON "AdvancePreload"("characterId", "baseAge");

-- CreateIndex
CREATE INDEX "Event_characterId_aggregateVersion_idx" ON "Event"("characterId", "aggregateVersion");

-- CreateIndex
CREATE INDEX "Event_characterId_type_idx" ON "Event"("characterId", "type");

-- CreateIndex
CREATE INDEX "Event_characterId_timestamp_idx" ON "Event"("characterId", "timestamp");

-- CreateIndex
CREATE INDEX "Event_previousEventId_idx" ON "Event"("previousEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectionSnapshot_characterId_key" ON "ProjectionSnapshot"("characterId");

-- CreateIndex
CREATE INDEX "ProjectionSnapshot_characterId_idx" ON "ProjectionSnapshot"("characterId");

-- CreateIndex
CREATE INDEX "NpcRelationship_characterId_idx" ON "NpcRelationship"("characterId");

-- CreateIndex
CREATE INDEX "NpcRelationship_npcKey_idx" ON "NpcRelationship"("npcKey");

-- CreateIndex
CREATE UNIQUE INDEX "NpcRelationship_characterId_npcKey_key" ON "NpcRelationship"("characterId", "npcKey");

-- CreateIndex
CREATE INDEX "NarrativeMemory_characterId_resolved_idx" ON "NarrativeMemory"("characterId", "resolved");

-- CreateIndex
CREATE INDEX "NarrativeMemory_characterId_intensity_idx" ON "NarrativeMemory"("characterId", "intensity");

-- CreateIndex
CREATE INDEX "NarrativeMemory_sourceEventId_idx" ON "NarrativeMemory"("sourceEventId");

