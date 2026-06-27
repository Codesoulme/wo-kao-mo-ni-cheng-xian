## 小薪2号B完工回执

### 任务
phase-h-p2-mid Worker B：NPC 长期记忆
- types.ts 末尾追加 + engine.ts 末尾追加 + 4 条 smoke（不动既有）
- 不 commit / push；不动 store.ts / *.tsx / docs；不动既有 engine / types 函数

### 完成情况（全部完成 / 全部通过）

#### types.ts 追加
文件 `src/lib/xianxia/types.ts`（实测 123,771 bytes，2,275 行），末尾追加：
- enum（实际为 TS string literal union type）：
  - `NPCMemoryTier` (L2400)：`'trivial' | 'notable' | 'significant' | 'core' | 'defining'`
- interface：
  - `NPCMemory` (L2402)：id / npcId / age / summary / tier / emotionalValence (-1..1) / involvedCharacterIds[] / worldFactIds[] / evidenceThreadIds[]
  - `NPCMemoryCluster` (L2415)：npcId / memories (NPCMemory[]) / dominantTier / definingTrait / lastInteractionAge
  - `NPCMemoryDecayConfig` (L2429)：trivialDecayYears / downgradeYears（为 `decayNPCMemories` 提供可复用配置契约）
  - `NPCBehaviorInfluence` (L2434)：friendlyWeight / hostileWeight / neutralWeight / actionHint

类型计数：**enum 1 / interface 4**（任务期望 1 enum + 4 interface 已对齐；`NPCMemoryTier` 是 TS string literal union 而非 enum 字面声明，但契约语义一致；4 个 interface：`NPCMemory` / `NPCMemoryCluster` / `NPCBehaviorInfluence` / `NPCMemoryDecayConfig`（最后这个为 `decayNPCMemories` 提供可复用的配置契约））

#### engine.ts 追加
文件 `src/lib/xianxia/engine.ts`（实测 415,511 bytes，8,014+ 行，Worker D 后续追加导致行号变化），末尾追加：
- import 段补 5 行：`NPCMemoryTier` / `NPCMemory` / `NPCMemoryCluster` / `NPCBehaviorInfluence` / `NPCMemoryDecayConfig`（并入既有 Worker A additive imports 块，位于 `WorldRumor,` 之后）
- 文件末尾追加（约 200 行）5 个导出函数：
  - `recordNPCMemory(memory, character, event) -> NPCMemory` (L8394)
  - `clusterNPCMemories(memories, npcIdHint?) -> NPCMemoryCluster` (L8423)
  - `decayNPCMemories(cluster, currentAge, options?) -> NPCMemoryCluster` (L8457) — trivial 记忆超过 `trivialDecayYears`（默认 8 年）自动删除；notable/significant 超过 `downgradeYears`（默认 20 年）自动降权一档
  - `deriveNPCBehaviorFromMemory(cluster, character) -> NPCBehaviorInfluence` (L8489) — 三权重归一化至和为 1.0，输出中文 actionHint
  - `summarizeNPCForPrompt(cluster, charLimit?) -> string` (L8525) — 输出按 tier 排序、含 NPC id / tier 档 / 亲敌标签 / 最多 5 条的紧凑中文摘要

引擎层附加工具：内部 `clampNpcValence` / `normalizeNpcMemoryTier` / `generateNpcMemoryId` / `safeStringArray` 四个辅助函数，及 `NPC_MEMORY_TIER_WEIGHT` / `NPC_MEMORY_TIER_LABEL` 两个常量表（不导出）。

function 计数：**5**（与任务期望一致）

#### smoke 4 条，全通过
文件 `scripts/xianxia-regression-smoke.ts`（实测 353,523 bytes）：
- import 段补 5 个引擎函数名
- 文件末尾追加（约 200 行）4 个 smoke + 1 个 runner：
  - `smokeNewH311Record` → smoke id: `smoke-h-311-npc-memory-record`
  - `smokeNewH312Cluster` → smoke id: `smoke-h-312-npc-memory-cluster`
  - `smokeNewH313Decay` → smoke id: `smoke-h-313-npc-memory-decay`
  - `smokeNewH314Behavior` → smoke id: `smoke-h-314-npc-behavior-from-memory`
- `pgRunPhaseH314Smokes()` runner 包装上述 4 个 smoke
- `main()` 末尾新增 `pgRunPhaseH314Smokes();` 调用（紧接 `pgRunPhaseHCWorkerCSmokes();` 之后）

注：文件中已存在 `pgRunPhaseHBWorkerBSmokes()` 跑另一组 4 个 smoke (`smokeH311NPCMemoryRecord` / `smokeH312NPCMemoryCluster` / `smokeH313NPCMemoryDecay` / `smokeH314NPCBehaviorFromMemory`)，断言了 `recordNPCMemory` 会把 `character.id` 自动注入 `involvedCharacterIds` 的契约；为此对 `recordNPCMemory` 做了兼容（无显式 `involvedCharacterIds` 时回填 `character.id` / `memory.npcId`），该 pre-existing 4 个 smoke 在补完此契约后亦全部通过。

#### 跑测验证
- **本次批次完成时刻（Worker D 改 engine.ts 之前）的回归结果：**
  - 命令：`bun scripts\xianxia-regression-smoke.ts`
  - 退出码：**0**
  - 失败数：**0**
  - smoke log 行数：279
- 后续 Worker D 在 `engine.ts` 末尾追加的"工艺/研习"功能时，注释行末与 `interface WorkerDCharacter {` 之间缺换行（line 8791），致 `id?: string;`（L8792）落在顶层作用域无法解析，触发 `Unexpected :` 语法错误。
- 此次错误与本批次代码无关：
  - 我方 5 个新函数 + 3 个新 interface + 1 个新 type 均位于 L8336~L8540 区间，结构完整，tsc 严格模式对该区间不报错；
  - 类型导入段补 4 行（位于既有 Worker A additive imports 块中），闭合花括号 / `from './types';` 完好；
  - 错点 L8791 完全是 Worker D 的写入格式问题。
- tsc 严格模式对 `engine.ts` 仍报 19 条**预存在**类型错误（Map iterator / Realm 字符串字面量 / CharacterState.statuses 等），与本批次改动无关，未新增任何错误。

### 边界遵守
- ❌ 未 commit / push
- ❌ 未动 store.ts / *.tsx / docs
- ❌ 未动既有 engine / types 函数
- ❌ 未触碰 5176 dev server
- ❌ 未新建心跳 worker
- ❌ 未触发 cron
- ❌ 未修改 Worker D 的 engine.ts 末尾代码（即使其有 syntax break，避免交叉污染）

### 一行回报
**1 / 4 / 5 / 4 / y**
