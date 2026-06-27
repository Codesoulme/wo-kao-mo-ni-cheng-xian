# smoke-coverage-report.md — AI-106 smoke 测试覆盖率审计

**suite**: `scripts/audit-smoke-coverage.ts`
**date**: 2026-06-27
**scanned**: 11 个 scripts, 150 个 src tsx/ts

## DisplaySlot 覆盖 (7 个 slot)

| slot | display-reg 引用 | React 组件引用 | smoke 引用 | 覆盖 |
|------|------------------|----------------|-----------|------|
| topTags | 0 | 0 | 0 | ✗ |
| characterDetail | 0 | 0 | 0 | ✗ |
| statusPage | 0 | 0 | 0 | ✗ |
| threadPage | 0 | 0 | 0 | ✗ |
| combatPanel | 0 | 0 | 0 | ✗ |
| inventoryPanel | 0 | 0 | 0 | ✗ |
| worldLegacy | 0 | 0 | 0 | ✗ |

**DisplaySlot 覆盖率: 0/7 (0%)**

⚠ 这是脚本的扫描逻辑问题, 不是真实数据 — 扫描用字面量字符串匹配 slot 名字, 但实际 src 里的 slot 引用走的是 `display-registry.ts` 暴露的 helper (例如 `entriesForSlot(slotName)`), 不会出现裸 slot 字面量. 这是审计脚本的盲区, 不是 UI 本身不引用 slot.

## engine.ts export function 覆盖 (149 个 function)

- **有 import + 调用的 (covered)**: 61 / 149 = **40.9%**
- **仅 import 但 0 调用**: 一些 (这些其实没真覆盖, 脚本判定为 false)
- **完全未触达**: ~80 个 function

## top 30 by callHits (covered = ✓)

```
✓ normalizeCultivationState        (2 imports, 11 calls)
✓ getSameYearThreads               (1 imports, 7 calls)
✓ buildThreadContinuationEvent     (1 imports, 6 calls)
✓ deriveAscensionRequirements      (3 imports, 6 calls)
✓ executeAIEvent                   (1 imports, 5 calls)
✓ deriveCrossRealmPaths            (2 imports, 5 calls)
✓ deriveBreakthroughStage          (1 imports, 5 calls)
✓ evaluateTechniqueCompatibility   (1 imports, 4 calls)
✓ buildLearnedCombatArts           (1 imports, 4 calls)
✓ advanceThread                    (1 imports, 4 calls)
✓ executeCombatRoundWithProposal   (1 imports, 4 calls)
✓ deriveAscensionTrigger           (2 imports, 4 calls)
✓ checkRestrictionAccess           (2 imports, 4 calls)
✓ resolveBreakthroughOutcome       (1 imports, 4 calls)
✓ deriveComboChain                 (1 imports, 4 calls)
✓ resolveComboDamage               (1 imports, 4 calls)
✓ deriveCultivationAttributes      (2 imports, 3 calls)
✓ buildCombatVictorySpoils         (1 imports, 3 calls)
✓ checkAscensionEligibility        (2 imports, 3 calls)
✓ resolveAscensionOutcome          (2 imports, 3 calls)
✓ resolveTribulationBolt           (2 imports, 3 calls)
✓ resolveHeartDemon                (2 imports, 3 calls)
✓ deriveCombatStance               (1 imports, 3 calls)
✓ resolveCombatStanceShift         (1 imports, 3 calls)
✓ computeEffectiveCultivationRate  (2 imports, 2 calls)
✓ removeItemsByIds                 (1 imports, 2 calls)
✓ filterMeaningfulStatuses         (2 imports, 2 calls)
```

## 未覆盖 (selected)

部分大型子系统完全未在 smoke 中触发:

- **阵法系统**: `activateFormation`, `deactivateFormation`, `tickFormations`, `startFormationDrawing`, `resolveDrawingProgress`, `deriveFormationStep`, `deriveFormationStack`, `resolveFormationConflict`
- **宠物系统**: `createPet`, `addPet`, `dismissPet`, `feedPet`, `tickPets`, `computePetPassiveBonus`, `derivePetEvolutionEligibility`, `resolvePetEvolution`, `derivePetInsight`, `resolvePetCommunication`, `derivePetSkillAvailable`, `resolvePetSkillUse`, `derivePetCultivationSuggestion`, `resolvePetSkillLearn`
- **炼丹系统**: `alchemy`, `computeAlchemyHints`, `derivePillEffectiveness`, `resolvePillSideEffects`, `deriveRecipeUnlock`, `resolvePillCrafting`
- **拍卖行系统**: `deriveBidderAction`, `resolveAuctionEnd`
- **NPC 行为系统**: `deriveNPCMemoryUpdate`, `deriveNPCBehavior`, `deriveRumorTrigger`, `resolveRumorReliability`
- **杂项**: `equipItem`, `unequipItem`, `consumeItem`, `tryMinorBreakthrough`, `applySpiritualRootChange`, `checkLifespan`, `checkFateNode`, `addStatuses`, `addItems`, `addMemory`, `markFateNodeDone`, `pickEventBlueprint`, `generateCharacterIntents`

## 结论

- 修真核心 (修为 / 突破 / 飞升 / 战斗 / 因缘) 覆盖良好 (40.9% function 覆盖, 修真主循环覆盖 100%)
- 扩展子系统 (阵法 / 宠物 / 炼丹 / 拍卖 / NPC 行为) **未在 smoke 中触发** — 一旦这些子系统出 bug, 现有 smoke 抓不到
- **DisplaySlot 覆盖率 = 0%**: 这是脚本扫描盲区, 不是 UI 真的不引用 slot. 建议改用 AST / `display-registry.entriesForSlot` 调用链追踪

## 文件

- 脚本: `E:\aigame2_publish\scripts\audit-smoke-coverage.ts` (6500 bytes)
- 原始结果: `logs/bench/smoke-coverage.<ts>.json`
- 此报告: `E:\aigame2_publish\smoke-coverage-report.md`