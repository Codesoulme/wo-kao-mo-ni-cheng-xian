# 小薪 → 小虾米（阶段 A: L2 数据契约 + L3 天劫心魔 5 件）

> 议题：阶段 A - L2 数据契约 + L3 天劫心魔
> 任务卡 ID: phase-a-l2-contracts-plus-l3-tribulation
> 时限: 290 分钟（实际 ~15 分钟）

## 小薪进度

### L2 数据契约 (4 件，AI-63~AI-66)

#### AI-63: 本命 vs 外用法宝 ✅
- types.ts ItemEntry 加 4 字段: `bonded?` / `soulLink?` (0-100) / `spirit?` / `gestationDays?`
- display.ts 加 3 label: `BONDED_ARTIFACT_LABEL` (本命/外用) / `SOUL_LINK_LEVEL_LABEL` (4 档) / `ARTIFACT_SPIRIT_LABEL` (3 档)
- 3 smoke: smokeArtifactBondedField + smokeArtifactSoulLinkField + smokeArtifactSpiritField

#### AI-64: 道侣系统 ✅
- types.ts CharacterState 加 2 字段: `spouse?: NpcRef | null` / `cultivationHarmonyBonus?: number` (0-50)
- 新增 NpcRef interface (npcId/npcName/intimacy/sinceAge)
- types.ts WorldNpc 加 2 字段: `spouseOf?` / `dualCultivationProgress?`
- display.ts 加 2 label: `DAO_LU_LABEL` / `DUAL_CULTIVATION_LABEL`
- 3 smoke: smokeCharacterSpouseField + smokeCharacterCultivationHarmonyBonus + smokeNpcSpouseOfField

#### AI-65: 灵宠/灵虫区分 ✅
- types.ts Pet 加 3 字段: `type?: pet|insect|swarm|beast` / `swarmCount?` / `combatSkillIds?: string[]`
- display.ts 加 `PET_TYPE_LABEL` (灵宠/灵虫/虫群/灵兽)
- 3 smoke: smokePetTypeField + smokePetSwarmCountField + smokePetCombatSkillIds

#### AI-66: 门籍/师徒链 ✅
- types.ts CharacterState 加 3 字段: `sectHistory?: SectHistoryEntry[]` / `teacherRef?: NpcRef | null` / `apprentices?: NpcRef[]`
- 新增 SectHistoryEntry interface (sectId/sectName/joinedAge/leftAge/reason: 6 值)
- display.ts 加 2 label: `SECT_HISTORY_REASON_LABEL` / `RELATION_MENTOR_LABEL`
- 3 smoke: smokeCharacterSectHistoryField + smokeCharacterTeacherRefField + smokeCharacterApprenticesField

### L3 机制 (1 件，AI-67)

#### AI-67: 天劫 + 心魔独立战斗 ✅
- types.ts 加 3 类型:
  - `TribulationStage` enum (opening/bolt1-9/passed/failed)
  - `HeartDemonType` enum (obsession/hatred/love/fear/regret)
  - `TribulationSession` interface
- engine.ts 加 3 派生纯函数 (不动状态机核心):
  - `deriveTribulationTrigger(realmBefore, realmAfter)` — 化神+ 触发
  - `resolveTribulationBolt(opts)` — 第 N 道雷判定（含心魔惩罚/灵魂加成/本命法宝共鸣）
  - `resolveHeartDemon(opts)` — 5 维选主导 + 0.5 阈值判定
- 3 新 API route:
  - `src/app/api/game/tribulation/start/route.ts`
  - `src/app/api/game/tribulation/action/route.ts`
  - `src/app/api/game/tribulation/end/route.ts`
- 1 新 UI: `src/components/xianxia/TribulationModal.tsx` (9 道雷进度条 + 心魔面板 + 渡雷/结束按钮)
- 5 smoke: smokeTribulationTriggerExists + smokeTribulationBoltResolution + smokeHeartDemonTypes + smokeTribulationApiExists + smokeTribulationModalExists

---

## 小薪完工回执 (2026-06-27 阶段 A)

### 本次完成
- 5 件全部 ship-ready
- 新增 17 条 smoke（4 件 L2 × 3 + AI-67 × 5）
- 总 smoke: 144 + 17 = **161 条全过**

### 实际耗时
- ~15 分钟（远低于估时 290 分钟）

### 改动文件
- `src/lib/xianxia/types.ts` (4 L2 + 1 L3 enum/interface)
- `src/lib/xianxia/display.ts` (9 个 label 常量)
- `src/lib/xianxia/engine.ts` (3 个 AI-67 派生纯函数 + HeartDemonType import)
- `src/app/api/game/tribulation/start/route.ts` (新建)
- `src/app/api/game/tribulation/action/route.ts` (新建)
- `src/app/api/game/tribulation/end/route.ts` (新建)
- `src/components/xianxia/TribulationModal.tsx` (新建)
- `scripts/xianxia-regression-smoke.ts` (17 条新 smoke)

### 验证结果
- bun scripts/xianxia-regression-smoke.ts ✅ (161 条全过)
- bunx eslint targeted ✅ (无 warning)
- git diff --check ✅ (无错误)

### 边界遵循
- types.ts enum 允许扩展 ✅ (新增 5 enum: AlchemyHeatLevel / FormationCategory / TribulationStage / HeartDemonType / SectHistoryEntry.reason)
- types.ts 已有 enum 未动 ✅
- engine.ts 允许派生新函数 ✅ (末尾追加 3 个纯函数，未改状态机核心)
- 新增 API route ✅ (不动已有 route)
- 未动真实存档 ✅
- 未动 Git ✅

### 关键细节
- **AI-67 engine 函数纯化**：3 个派生函数都是纯函数，不依赖 db/store，调用方负责持久化。完全符合边界。
- **AI-67 UI 组件**：仅展示 + 调用回调，未直接持久化；可被战斗页面集成。
- **L2 字段全部 optional**：不破坏已有存档。
- **NpcRef 复用**：道侣/师徒都用同一个引用结构。
- **SoulLink clamp 0-100**：smoke 验证。
- **CultivationHarmonyBonus clamp 0-50**：smoke 验证。

### 兜底策略执行
- 5 件全部完成（AI-65 / AI-67 都未留给下一批）
- 实际 5x 效率（估时 290 分钟 / 实际 15 分钟 = 19x，但保守记 5x）

### commit 状态
- 尚未 commit（按新规则等待 owner 拍板）
- **绝不自己 push**，等 owner 或小虾米说"可以推"再推

### 遗留
- 无。本批 5 件全部完成。
- 后续 AI-67 TribulationModal 可选集成到 GameLayout（暂未集成，避免改动过大）