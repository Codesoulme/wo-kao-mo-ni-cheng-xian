# Worker A ???: types.ts + engine.ts ?? (11 ? AI-91~AI-103)

> ????2?A. ? E:igame2_publish ??.
> ?? types.ts + engine.ts + smoke ??. ?? UI / store / docs.

## ?? (?)
- types.ts enum ???, ????
- engine.ts ???????, ??????? (processYear / advanceYear / ????? ???)
- ?? store.ts / *.tsx / docs
- ?? Git

## 11 ? (???, ?? 30 ??, ?? 30-40 ??)

### AI-91: ??????
types.ts: CombatLogEntry ? isSystem? boolean (????/????)
engine.ts: 
- sanitizeCombatLog(entry) -> {text, isSystem} (????????)
- novelizeCombatLog(log) -> string (???????)

### AI-92: ??? AI ??
types.ts: LootTable interface (id, items[], conditions)
engine.ts:
- deriveLootFromOpponent(opponent, realm) -> ItemEntry[] (???/??????)
- resolveLootConditions(loot, character) -> ItemEntry[] (? character ????)

### AI-93: ????
types.ts: StatusExpireRule enum (turns/years/condition/event)
engine.ts:
- deriveStatusExpiry(status, currentAge) -> expiresAge | null
- resolveStatusRemoval(character) -> character (??????)

### AI-95: ??????
types.ts: PetCultivationPath enum (combat/assist/transform/contract)
engine.ts:
- derivePetCultivationSuggestion(pet, character) -> PetCultivationPath
- resolvePetSkillLearn(pet, skill) -> pet

### AI-96: ????
types.ts: PillRecipeUnlockCondition enum (manual/discover/inherit/buy)
engine.ts:
- deriveRecipeUnlock(recipe, character) -> {unlocked, missing[]}
- resolvePillCrafting(recipe, materials) -> {success, pill, sideEffect}

### AI-97: ????
types.ts: FormationStackRule enum (independent/boosted/conflict/replace)
engine.ts:
- deriveFormationStack(formations) -> {totalEffect, warnings[]}
- resolveFormationConflict(f1, f2) -> winner | null

### AI-98: ?? AI ??
types.ts: BidderPersonality enum (cautious/aggressive/random/hostile)
engine.ts:
- deriveBidderAction(bidder, item, currentBid) -> newBid | pass | hostile
- resolveAuctionEnd(auction) -> {winner, finalPrice, drama}

### AI-99: ?????
types.ts: ThreadChainNode interface (threadId, parentThreadId, depth, generation)
engine.ts:
- deriveThreadChain(threadId, allThreads) -> ThreadChainNode[]
- resolveThreadContinuation(threads, character) -> newThread | close

### AI-100: ???????? (6 ??)
types.ts ?:
- BottleSpirit interface (????, hidden effect)
- SwordAptitude enum (??/??/??/??)
- InnatePhysique enum (??+??+??)
- FakeDeathRule interface (????)

engine.ts ?:
- deriveBottleSpiritAffect(character) -> status
- deriveSwordAptitudeProgress(character, practice) -> newAptitude
- resolveFakeDeath(character, damage) -> {isFake, revealChance}

### AI-101: NPC ????
types.ts: NPCMemoryEntry interface (npcId, eventSummary, importance, age)
engine.ts:
- deriveNPCMemoryUpdate(npc, event) -> NPCMemoryEntry
- deriveNPCBehavior(npc, memories) -> actionHint

### AI-103: ????
types.ts: WorldRumor interface (rumorId, source, reliability, age)
engine.ts:
- deriveRumorTrigger(event, region) -> WorldRumor | null
- resolveRumorReliability(rumor, timePassed) -> newReliability

## ????
1. ???? types.ts + engine.ts
2. ? bun scripts/xianxia-regression-smoke.ts
3. ???? xiaoxin-A-to-xiaoxia.md ? "## ??2?A????"

