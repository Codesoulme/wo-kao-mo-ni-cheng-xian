# ?? B: L3 ?? Grand Slam

> ??: [AGENDA]
> ??: 2026-06-27 08:00
> ??: ???
> ??: ?? (Trae MiniMax-M3)
> ???: ?? A (L2 + L3 ??) ? ship (commit 499db04). owner ????, ??????. 161 smoke ??.
> ??: ????? L3 ?? 2 ??? (???? + ????) + ????

## ?? 1: L3-B ??????

### AI-68: ?????? (90 ???, ~12 ????)

**types.ts**:
```ts
type RealmEnum = ...; // ??
type WorldTier = 'humanWorld' | 'spiritWorld' | 'immortalWorld';

interface AscensionRequirement {
  minAge: number;
  minCultivation: number;
  minHeartDemonResistance: number;
  requireKarma: 'good' | 'neutral' | 'any';
  artifactCount: number;          // ??????
}

interface AscensionSession {
  id: string;
  fromWorld: WorldTier;
  toWorld: WorldTier;
  requirements: AscensionRequirement;
  stage: 'gathering' | 'ascending' | 'settling' | 'failed' | 'completed';
  karmaBalance: number;
  tribulationPassed: boolean;     // ??????
  failedAttempts: number;
}
```

**engine.ts ? 4 ?????**:
- `deriveAscensionRequirements(realm)` -> AscensionRequirement
- `checkAscensionEligibility(character, requirements)` -> {eligible, missing[]}
- `deriveAscensionTrigger(age, character)` -> AscensionSession | null
- `resolveAscensionOutcome(session, characterRoll)` -> {newWorld, status, message}

**? API routes**:
- src/app/api/game/ascension/check/route.ts
- src/app/api/game/ascension/start/route.ts
- src/app/api/game/ascension/end/route.ts

**? UI**:
- src/components/xianxia/AscensionModal.tsx (???? + ???? + ????)

**??????**:
- docs/world/ascension-flow.md (????????)
- docs/world/three-realms-detail.md (??????????)

**smoke (5 ?)**:
- smokeAscensionRequirementsExist
- smokeAscensionEligibilityCheck
- smokeAscensionTriggerDerivation
- smokeAscensionApiExists
- smokeAscensionModalExists

### AI-69: ?? NPC + ???? (60 ???, ~8 ????)

**types.ts ? WorldTier enum + npc ??**:
- npc.worldTier: WorldTier
- npc.crossRealmAccess: boolean

**engine.ts**:
- `deriveCrossRealmPaths(worldTier)` -> Array<{from, to, type, difficulty}>

**??????**:
- docs/world/cross-realm-npcs.md (??? NPC ??)
- docs/world/starry-sky-paths.md (????)

**smoke (3 ?)**:
- smokeNpcWorldTierField
- smokeCrossRealmPathsDerivation
- smokeCrossRealmDocsExist

## ?? 2: L3-C ????

### AI-70: ???? (90 ???, ~12 ????)

**types.ts**:
```ts
type RestrictionType = 'door' | 'trap' | 'transport' | 'seal' | 'ward' | 'barrier';
type RestrictionAccessMethod = 'token' | 'password' | 'identity' | 'key' | 'timing' | 'combat';

interface Restriction {
  id: string;
  name: string;
  type: RestrictionType;
  accessMethod: RestrictionAccessMethod;
  requiredItemId?: string;
  requiredNpcId?: string;
  requiredCultivation?: RealmEnum;
  timingCondition?: { age?: number; season?: string; lunarPhase?: string };
  isActive: boolean;
  discoveryAge?: number;
}
```

**engine.ts ? 3 ?????**:
- `checkRestrictionAccess(restriction, character, inventory)` -> {canPass, missing[]}
- `deriveRestrictionTrigger(restriction, character)` -> RestrictionEvent | null
- `resolveRestrictionInteraction(restriction, characterChoice)` -> {outcome, newRestrictionState}

**? API routes**:
- src/app/api/game/restriction/check/route.ts
- src/app/api/game/restriction/interact/route.ts

**? UI**:
- src/components/xianxia/RestrictionModal.tsx (???? + ????)

**??????**:
- docs/world/restrictions-detail.md (???? + ??????)

**smoke (5 ?)**:
- smokeRestrictionTypesExist
- smokeRestrictionAccessCheck
- smokeRestrictionTriggerDerivation
- smokeRestrictionApiExists
- smokeRestrictionModalExists

### AI-71: ?? + ??/???? (45 ???, ~6 ????)

**types.ts ? SecretRealm ??**:
- realm.restrictions: Restriction[]
- realm.requiredRestrictionsPassed: string[]

**engine.ts**:
- `deriveRealmRestrictionCheck(realm, character)` -> {canEnter, blockingRestrictions[]}

**smoke (2 ?)**:
- smokeSecretRealmRestrictionField
- smokeRealmEnterCheckDerivation

## ?? 3: ???? + smoke ?? (5 ?)

### AI-72: TribulationModal + AscensionModal ?? GameLayout (15 ???, ~3 ????)

**src/app/page.tsx**:
- import AscensionModal + RestrictionModal
- ? GameLayout ??, ????, ??????

**smoke (3 ?)**:
- smokeAscensionModalIntegrated
- smokeRestrictionModalIntegrated
- smokeAllL3ModalsInLayout

## ???

- ?? ID: phase-b-l3-full-grand-slam
- ?? 300 ?? (5 ?, ? 25x ???)
- ???? ~50 ??
- 23 ?? smoke

## ?? (??)

- types.ts enum ????, ????
- engine.ts ???????, ???????
- ?? API route ??, ???? route ??
- ?????? / Git (schema migration ????)

## ??

1. AI-68 ?????? (??, ??)
2. AI-69 ?? NPC + ??
3. AI-70 ???? (??, ???)
4. AI-71 ?? + ????
5. AI-72 ???? (??)

?? token ?: AI-68 + AI-70 ?? (2 ???), ?????

## ??

??????, ?? 300 ?? -> ?? 40-60 ?? (5 ? + 23 smoke)

## ??

- L3 ?????, ???? 1.0++ ??
- ???? (?? C) ?????
- save-load schema migration (?? D) ?????

