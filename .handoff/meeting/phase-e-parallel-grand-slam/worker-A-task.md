# Worker A: ?? + ???? (AI-81~AI-85, 5 ?)

> ????2? A. ???? + ??????. ???????.

## ?? (5 ?, ?? 180 ?? -> ??? ~30 ??)

### AI-81: ?????? (60 ???, ~10 ??)
src/lib/xianxia/types.ts:
- CombatStance enum (aggressive/defensive/cunning/retreat)
- CombatStanceUsage interface (stance, usesLeft, cooldownTurns)

src/lib/xianxia/engine.ts:
- deriveCombatStance(character, opponent) -> CombatStance | null
- resolveCombatStanceShift(stance, opponent) -> new stance

src/components/xianxia/CombatModal.tsx:
- ???? stance ??
- ?? stance ?? (?????)

3 smoke

### AI-82: ?????? (60 ???, ~10 ??)
src/lib/xianxia/types.ts:
- CombatResourceType enum (qi/soul/stamina/focus)
- CombatResourceUsage interface (type, current, max, regenPerTurn)

src/lib/xianxia/engine.ts:
- deriveCombatResource(character) -> CombatResourceUsage[]
- resolveCombatResourceDrain(usage, action) -> new usage
- checkCombatResourceSufficient(usage, cost) -> {sufficient, missing[]}

3 smoke

### AI-83: ?????? (30 ???, ~5 ??)
src/lib/xianxia/types.ts:
- BreakthroughStage enum (perception/condense/storm/stabilize/passed)
- BreakthroughAttempt interface (stage, attemptNumber, helperCount)

engine.ts:
- deriveBreakthroughStage(realmBefore, age) -> BreakthroughStage
- resolveBreakthroughOutcome(attempt) -> success | failed | continue

2 smoke

### AI-84: ?????? (30 ???, ~5 ??)
engine.ts:
- detectCombatStalemate(history) -> {isStalemate, turnsSinceProgress}
- resolveStalemateBreak(character, opponent) -> new event

1 smoke

### AI-85: ?????? (15 ???, ~3 ??)
types.ts:
- ComboChain interface (comboName, hits, multiplier, expiresTurn)

engine.ts:
- deriveComboChain(actionHistory) -> ComboChain
- resolveComboDamage(baseDamage, combo) -> finalDamage

2 smoke

## ??
- types.ts enum ????, ????
- engine.ts ???????, ???????
- ?? store.ts
- ?? Git

## ??
??? 2 ??? ## ??2?A??
?????? ## ??2?A????
?? commit + push

