# Worker B: ?? + ?? + ???? (AI-86~AI-90, 5 ?)

> ????2? B. ???? + ?? + ??????. ???????.

## ?? (5 ?, ?? 180 ?? -> ??? ~30 ??)

### AI-86: ??????? (60 ???, ~10 ??)
src/lib/xianxia/types.ts:
- PillSideEffect enum (toxicity/cultivation-deviation/karma/qi-turbulence)
- PillEffectiveness interface (boost, sideEffectChance, sideEffectSeverity)

engine.ts:
- derivePillEffectiveness(pill, character) -> PillEffectiveness
- resolvePillSideEffects(pill, character) -> CharacterState changes

3 smoke

### AI-87: ?????? (60 ???, ~10 ??)
types.ts:
- FormationDrawingStep enum (meditate/trace/infuse/anchor/activate)
- FormationDrawingSession interface (formationId, currentStep, materialsUsed)

engine.ts:
- deriveFormationStep(formation, character) -> FormationDrawingStep
- resolveDrawingProgress(session, action) -> new state

3 smoke

### AI-88: ???? (30 ???, ~5 ??)
types.ts:
- PetEvolutionStage enum (infant/youth/mature/ascended)
- PetEvolutionRequirement interface (age, cultivation, materials)

engine.ts:
- derivePetEvolutionEligibility(pet, character) -> {eligible, missing[]}
- resolvePetEvolution(pet) -> new pet

2 smoke

### AI-89: ?????? (30 ???, ~5 ??)
types.ts:
- PetInsight interface (insightName, source, learnedAge)
- PetCommunication interface (petId, messageType, trigger, response)

engine.ts:
- derivePetInsight(pet, character) -> PetInsight | null
- resolvePetCommunication(pet, trigger) -> string

1 smoke

### AI-90: ?????? (15 ???, ~3 ??)
types.ts:
- PetCombatSkill interface (skillId, name, cooldown, range, effect)
- PetSkillUsage interface (skillId, lastUsedTurn, usesLeft)

engine.ts:
- derivePetSkillAvailable(pet, turn) -> PetCombatSkill[]
- resolvePetSkillUse(pet, skill, target) -> CombatEvent

2 smoke

## ??
- types.ts enum ????, ????
- engine.ts ???????, ???????
- ?? store.ts
- ?? Git

## ??
??? 2 ??? ## ??2?B??
?????? ## ??2?B????
?? commit + push

