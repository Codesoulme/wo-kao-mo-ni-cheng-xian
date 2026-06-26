# ?? A: L2 ???? + L3 ???? (Phase A)

> ??: [AGENDA]
> ??: 2026-06-27 06:28
> ??: ???
> ??: ?? (Trae Kimi)
> ???: ?? A ???? P0/P1/P2/P3 + L1 ??? + slot UI ?? ship (HEAD 9e46f02), 144 smoke ??
> ??: ???????????????? + ??????

## ?? 1: L2 ????? (4 ?)

### AI-63: ?? vs ???? (30 ???, ~5 ????)

**types.ts**:
```ts
interface Artifact {
  // ...existing
  bonded: boolean;                    // ????
  soulLink: number;                   // ???? 0-100
  spirit: string | null;              // ???
  gestationDays: number;              // ????
}
```

**display.ts**:
- BONDED_ARTIFACT_LABEL (??/??)
- SOUL_LINK_LEVEL_LABEL (??/??/??/??)
- ARTIFACT_SPIRIT_LABEL

**smoke (3 ?)**:
- smokeArtifactBondedField
- smokeArtifactSoulLinkField
- smokeArtifactSpiritField

### AI-64: ???? (30 ???, ~5 ????)

**types.ts**:
```ts
interface CharacterState {
  // ...existing
  spouse: NpcRef | null;
  cultivationHarmonyBonus: number;    // ???? 0-50
}

interface NpcMemoryEntry {
  // ...existing
  spouseOf: CharacterRef | null;
  dualCultivationProgress: number;
}
```

**display.ts**:
- DAO_LU_LABEL (??)
- DUAL_CULTIVATION_LABEL

**smoke (3 ?)**:
- smokeCharacterSpouseField
- smokeCharacterCultivationHarmonyBonus
- smokeNpcSpouseOfField

### AI-65: ??/???? (20 ???, ~3 ????)

**types.ts**:
```ts
interface Pet {
  // ...existing
  type: 'pet' | 'insect' | 'swarm' | 'beast';
  swarmCount: number;                 // ???? (??=1)
  combatSkillIds: string[];           // ????
}
```

**display.ts**:
- PET_TYPE_LABEL (??/??/??/??)

**smoke (3 ?)**:
- smokePetTypeField
- smokePetSwarmCountField
- smokePetCombatSkillIds

### AI-66: ??/??? (30 ???, ~5 ????)

**types.ts**:
```ts
interface CharacterState {
  // ...existing
  sectHistory: Array<{
    sectId: string;
    joinedAge: number;
    leftAge: number | null;
    reason: string;
  }>;
  teacherRef: NpcRef | null;
  apprentices: NpcRef[];
}
```

**display.ts**:
- SECT_HISTORY_REASON_LABEL (??/??/??/??)
- RELATION_MENTOR_LABEL (?/?)

**smoke (3 ?)**:
- smokeCharacterSectHistoryField
- smokeCharacterTeacherRefField
- smokeCharacterApprenticesField

## ?? 2: L3 ??/?????? (1 ?)

### AI-67: ?? + ?? (180 ???, ~25 ????)

????, ??:

**types.ts**:
```ts
type TribulationStage = 'opening' | 'bolt1' | 'bolt2' | 'bolt3' | 'bolt4' | 'bolt5' | 'bolt6' | 'bolt7' | 'bolt8' | 'bolt9' | 'passed' | 'failed';
type HeartDemonType = 'obsession' | 'hatred' | 'love' | 'fear' | 'regret';

interface TribulationSession {
  id: string;
  realm: RealmEnum;                   // ?????
  target: RealmEnum;                  // ?????
  stage: TribulationStage;
  boltsSurvived: number;
  startedAtAge: number;
  demonEncountered: HeartDemonType | null;
  status: 'ongoing' | 'passed' | 'failed' | 'fled';
}
```

**engine.ts**:
- deriveTribulationTrigger(realmBefore, realmAfter) -> TribulationSession | null
- resolveTribulationBolt(session, characterRoll) -> {newStage, hpLoss, status}
- resolveHeartDemon(session, characterInnerState) -> {passed, demon}

**? API**:
- src/app/api/game/tribulation/start/route.ts
- src/app/api/game/tribulation/action/route.ts
- src/app/api/game/tribulation/end/route.ts

**? UI**:
- src/components/xianxia/TribulationModal.tsx (9 ??? + ?? 5 ?)
- GameLayout ??

**smoke (5 ?)**:
- smokeTribulationTriggerExists
- smokeTribulationBoltResolution
- smokeHeartDemonTypes
- smokeTribulationApiExists
- smokeTribulationModalExists

## ???

- ?? ID: phase-a-l2-contracts-plus-l3-tribulation
- ?? 290 ?? (5 ?, ? 5x ???)
- ???? ~43 ??

## ??

- types.ts enum ????, ????
- engine.ts ???????, ??????? (???????)
- ?? API route ??, ???? route ??
- ?????? / Git (L2 schema migration ????)

## ??

1. AI-63 -> AI-64 -> AI-65 -> AI-66 (L2 ????, 4 ???)
2. AI-67 (L3 ????, ?????)

?? token ?: AI-63/64/66 ?? (?? 3 ??), AI-65 ??????, AI-67 ????

## ??

??????, ?? 290 ?? -> ?? 40-60 ??

## ?? L3 ????

- L3-B ?????? (240 ???)
- L3-C ???? (180 ???)

