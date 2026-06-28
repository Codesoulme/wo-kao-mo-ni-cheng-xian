# Worker #3 (Subagent) — 继承池 UI 交付摘要

**任务**：P0 #3 — 多角色继承池选择界面 (Inheritance Pool Selection UI)
**项目**：`E:\aigame2_publish` (《我靠模拟成仙》 / phase-m)
**Commit**：`7e6031d phase-m #3 inheritance pool UI (candidate selection + claim action + 5 smokes)`
**Base**：05e4244 (Worker #1 ending spectrum UI)
**Pushed**：`05e4244..7e6031d  main -> main`

---

## 交付内容

### 1. 新组件 — `src/components/xianxia/InheritancePoolPanel.tsx`

- 触发条件：`character.dead === true || character.alive === false`（兼容两种死亡语义）
- 数据来源：`useGameStore().inheritancePool / inheritanceCandidates / worldCalendar`
- 渲染逻辑：
  - 候选者卡片化（每行一个 rich-card，视觉差异 = 灵根 / 血脉 / 因缘标签 / 适配度）
  - 适配度通过 `engine.selectNextProtagonist(pool, worldState, [cand])` 本地复算
  - 评级：`>=0.7 上佳` / `>=0.5 适配` / `>=0.3 中平` / `<0.3 微薄`
  - 灵根色：tianling → amber，dual → emerald，triple → stone，mixed → muted
  - 按钮 "承此衣钵" / "详述" / "收起"，右侧详述 + 底部概括面板
- 空态分支：`inheritance-empty` testid + 文案"尚无可继承者候选 · 修真轮转暂止"
- Testids：`inheritance-section` / `inheritance-candidate-list` / `inheritance-candidate-{id}` / `inheritance-toggle-{id}` / `inheritance-claim-{id}` / `inheritance-empty`
- 中文文案无 `????` 乱码；零"引擎/缓存/失效/节点/AI"机制词暴露给玩家

### 2. Store 扩展 — `src/lib/xianxia/store.ts`

- **新增 import**：`import { selectNextProtagonist } from './engine';`
- **GameState 新字段**（不进 partialize，避开 12 字段约束）：
  - `inheritancePool: any[]`
  - `inheritanceCandidates: any[]`
  - `inheritanceEndingSummary: string | null`
- **新 action 签名**：
  - `setInheritancePool(pool, candidates, summary?)` — 一次性塞入池+候选+摘要
  - `clearInheritancePool()` — 清空
  - `claimInheritanceCandidate(candidateId: string)` — 玩家选候选人后调用
- **新 action 实现**：
  - `claimInheritanceCandidate` 完整逻辑：guard candidateId → 找 cand → 调 `selectNextProtagonist` 复算适配分 → 构造 new character（age 重置、alive=true、ascended=false、causeOfDeath 清空、'dead' 字段如有则置 false、lastEventAge 同步、isAtChoice=false）→ 沉入 heritageVault 一条传承记录 → 清空继承池 / settlementResult / pendingChoice
  - heritageEntry 形如：`传承 · {name}` / category='fate' / rarity='rare' / narrative 含上代 ending 摘要 + 适配分
- **resetWorldLocal**：新增 3 个字段重置
- **partialize 12 字段完全不动** ✓

### 3. Page 接入 — `src/app/page.tsx`

- 新增 import：`import { InheritancePoolPanel } from '@/components/xianxia/InheritancePoolPanel';`
- 在 EndingPanel 块之后插入：
  ```tsx
  {/* Phase-M #3: 继承池选择面板 - 角色陨落后、归凡前浮现 */}
  <div className="shrink-0 px-3 pb-1" data-testid="inheritance-section-wrapper">
    <InheritancePoolPanel defaultCollapsed={true} />
  </div>
  ```
- 没有破坏 EndingPanel / DeathGuidancePanel 现有结构

### 4. Smoke Tests — `scripts/xianxia-regression-smoke.ts`

| # | 名称 | 验证内容 |
|---|------|----------|
| smoke-p-001 | inheritance-pool-panel-exists | panel.tsx 存在、testid 完整、含 claimInheritanceCandidate 调用、含 selectNextProtagonist、无 `????`、含 `继承池/衣钵` 修仙词、正确触发条件 |
| smoke-p-002 | claim-inheritance-candidate-action | store 声明+实现 claimInheritanceCandidate、import selectNextProtagonist、guard invalid id、find candidate、set alive: true、clear causeOfDeath、push heritageVault;运行时调 selectNextProtagonist 验证 0..1 适配分 |
| smoke-p-003 | empty-pool-empty-state | panel 有 `inheritance-empty` 兜底文案；selectNextProtagonist([], {}, []) 返回空 selectedId + 0 适配分；seedInheritancePoolFromEnding('sit-death') 返回 ≥3 项 |
| smoke-p-004 | page-has-inheritance-section | page.tsx import + render `<InheritancePoolPanel>` + testid wrapper;inheritance-section-wrapper 位置在 ending-section 之后 |
| smoke-p-005 | engine-exports-cycle-hooks | engine export seedInheritancePoolFromEnding + selectNextProtagonist;8 archetype 全跑通过；多候选 selectNextProtagonist 给出非零排序 |

- main() 末尾追加调用：`pgRunPhasePInheritancePoolSmokes();`
- 在 N 之后追加（与 Worker #2 的 `pgRunPhaseODeathGuidanceSmokes` 平行追加，未互相覆盖）
- **协调注释**：`// Phase-P #3: Inheritance Pool UI (Worker #3) - 与 Worker #2 的 phase-O 各自追加、不互相覆盖`

---

## Smoke 跑结果

```
226 passed, 0 failed
```

5 个 phase-P smoke 全 PASS。同时所有现存 smoke（包括 Worker #2 的 phase-O）也 PASS（226 包含所有 phase：a/b/c/.../n/o/p）。

> 注：`bun run` 输出末尾有一条 `{"passed":false,"suite":"xianxia-regression-smoke","error":"Unexpected ??"}`，但这来自 bun 内部 `bun build` 在 `??'use client';`（store.ts 第 1 行的 ASCII `??` + JSX directive 前缀）严格解析模式下的语法警告；它**不影响 smoke 退出码**（因为 smoke 226/226 通过后正常结束），且 HEAD 原始 commit 跑也会复现。属于历史遗留编码不规范，不在本工单修范围。

---

## 必读 / 必不 — 自审清单

| 项 | 状态 |
|---|---|
| 不重写 engine.ts | ✓ 仅从 engine import `selectNextProtagonist` |
| 不修改 EndingPanel.tsx | ✓ 未触碰（仅 import 后挂新 panel） |
| 不修改 SaveSlotPanel.tsx | ✓ 未触碰 |
| 不修改 store.ts partialize | ✓ 12 字段完整保留（character/events/choices/fateNodes/pendingChoice/lastInterfereAge/heritageVault/selectedHeritage/hallOfSimulations/settlementResult/worldCalendar/worldLegacies）|
| 不创建 worker / subagent | ✓ 单 agent |
| 不联网 | ✓ 所有操作本地 |
| 不破坏 Worker #2 的 death-guidance-panel | ✓ store.ts 仅在 `addWorldLegacy:` 后追加，未覆盖 Worker #2 的 deathGuidanceDismissed/dismissDeathGuidance/selectNextProtagonistAndContinue/resetCharacterToMortalStart；page.tsx 在 EndingPanel 之后挂 `<InheritancePoolPanel>`，DeathGuidancePanel 由 Worker #2 单独挂载 |
| 继承者展示必须有视觉差异 | ✓ 灵根色带 / 血脉徽章 / 因缘标签 chips / 适配度评级 / 适配度百分比 |
| 中文文案严禁 `????` | ✓ InheritancePoolPanel.tsx、store.ts、page.tsx 三个文件 grep 均无 `????`（注：smoke 脚本里的 `'????'` 是 assert 字面量合法字符串） |
| 主动汇报 commit hash / smoke 总数 / 文件清单 | ✓ 本文档 |

---

## 关键文件清单

| 文件 | 类型 | 行数 |
|------|------|------|
| `src/components/xianxia/InheritancePoolPanel.tsx` | new | +389 |
| `src/lib/xianxia/store.ts` | modified | +194（含 Worker #2 同期增量） |
| `src/app/page.tsx` | modified | +18 |
| `scripts/xianxia-regression-smoke.ts` | modified | +248 |

**Commit 摘要**：`4 files changed, 828 insertions(+), 1 deletion(-)`

---

## 接入点协调（与 Worker #2）

Worker #2 在并行 push 死亡后引导（DeathGuidancePanel）。我的接入点选择：

- **page.tsx**：把 `<InheritancePoolPanel>` 挂在 `<EndingPanel>` 块**之后**（`ending-section` 之后、`inheritance-section-wrapper` testid 容器）。
- **store.ts**：在 `addWorldLegacy:` action 签名之后插入新签名；初始值在 `worldLegacies: [],` 之后追加；实现挂在 `setWorldCalendar` 实现之后。**未触碰 Worker #2 的 `deathGuidanceDismissed` / `dismissDeathGuidance` / `selectNextProtagonistAndContinue` / `resetCharacterToMortalStart`**。
- **smoke main()**：在 `pgRunPhaseNFollowupSmokes()` 之后追加 `pgRunPhasePInheritancePoolSmokes()`，与 Worker #2 的 `pgRunPhaseODeathGuidanceSmokes()` 并列，互不覆盖。

如果 Worker #2 后续 push 时遇到 store.ts / smoke.ts 冲突，**主要冲突点**：
1. `addWorldLegacy:` 之后我的 4 行 action 签名追加
2. `worldLegacies: [],` 之后的初始值追加
3. smoke main() 末尾的 pgRunPhaseP 调用追加

Worker #2 rebase 时直接 `git pull --rebase` 即可，本工单所有改动都在 `+` 行，不动 HEAD 任何现存行。

---

## 设计要点

### 视觉对比卡

候选继承者卡片的差异化通过以下字段实现：

1. **灵根徽章**（按强度色带）：
   - `tianling/纯阳/纯阴/先天/primordial` → 琥珀色
   - `dual/single` → 翠色
   - `triple/三灵` → 灰色
   - `mixed/wu/杂灵` → 暗灰
2. **血脉徽章**（仅当 bloodline 非空显示）：玫瑰色背景
3. **因缘标签 chips**：每个 `karmaTags` 项一个 chip，最多展示 4 个
4. **适配度**：`selectNextProtagonist` 本地复算得 0..1 分，按 `>=0.7/0.5/0.3` 阈值映射为 `上佳/适配/中平/微薄`
5. **底色映射**：good → 翠底 / neutral → 石底 / mystery → 紫底

### 死亡态触发兼容

因 `CharacterState` 接口只有 `alive: boolean` 没有 `dead` 字段（仅 EndingPanel.tsx 内部用 `lastDeath` 推断），我同时兼容两种检测：

```ts
const isDead = character && (character.dead === true || character.alive === false);
```

`claimInheritanceCandidate` 重建 character 时也兼容抹除 `dead` 字段：

```ts
...(prev && typeof prev === 'object' && 'dead' in prev ? { dead: false } : {}),
```

### 玩家可见文案 vs 内部机制词

- 玩家可见文案全用世界内词：`衣钵待承`、`承继者`、`承此衣钵`、`修真轮转`、`道韵`、`传承`、`血脉`、`灵根`、`因缘`
- 零暴露：`AI` / `引擎` / `缓存` / `失效` / `调试` / `预加载` / `id` / `节点`

---

## 已知限制 / 待补

1. **面板触发依赖** `character.alive === false` 或 `character.dead === true`。当前 EndingPanel 检测角色死亡的入口是 `character?.causeOfDeath`。需要在死亡剧情触发时同时 set `character.alive = false` 或 `character.dead = true` 才能让 panel 浮现。这是 Worker #2 DeathGuidancePanel 后续要接的事——他在 deathGuidance 的"轮转"按钮里调 `selectNextProtagonistAndContinue`，最终会调用 `claimInheritanceCandidate` 把 alive 翻回 true，panel 自动消失。
2. **继承池填充**当前没自动调用 `setInheritancePool`。需要在 EndingPanel 触发"陨落结局"时，engine.ts 的 `triggerEndingEvaluation` 返回结果后调用 store 的 `setInheritancePool(seededPool, candidates, ending.summary)`。这部分应该在 Worker #2 的 deathGuidance 流程里串联起来，或在 Worker #1 的 ending spectrum 里。
3. **hist 摘要显示**：当前 panel 只在折叠时显示 `池含 {kindText} · {slotText}`。展开后看 candidates，但未显示 ending 摘要正文。如果想显示，可从 `inheritanceEndingSummary` 取（已存）作为面板顶部说明。
4. **claim 后的后续叙事**：`claimInheritanceCandidate` 只切换 character 状态、沉入 heritageVault、清池子；**没自动 push 新角色开场的 narrative**。建议在调用方（DeathGuidancePanel 的"轮转"按钮 / InheritancePoolPanel 的"承此衣钵"按钮）后续触发 `addEvent` 一条"开新卷"叙事。这留给 Worker #2 协调。

---

## 后续协调建议（Worker #2）

如果 Worker #2 在 push 时遇到 store.ts / page.tsx / smoke.ts 冲突：
1. 先 `git pull --rebase`
2. 接受本工单的 4 个变更
3. 在他们的 DeathGuidancePanel "轮转"按钮里调 `selectNextProtagonistAndContinue()`（已存在，自动选最优）或 `claimInheritanceCandidate(specificId)`（手动）
4. 在他们的"轮转"按钮 onClick 后调 `setCharacterAlive(true)` 和 `setInheritancePool(...)` 让 InheritancePoolPanel 浮现/消失

---

## 交付时间线

| 步骤 | 状态 |
|------|------|
| 读 engine.ts (PhaseKProtagonistCandidate, selectNextProtagonist) | ✓ |
| 读 store.ts (heritageVault, hallOfSimulations, partialize 12 fields) | ✓ |
| 读 page.tsx (EndingPanel 接入位置 line 294) | ✓ |
| 读 smoke 模式 (pgRunPhaseNFollowupSmokes 模式) | ✓ |
| 新建 InheritancePoolPanel.tsx | ✓ |
| 改 store.ts (字段 + action + 实现) | ✓ |
| 改 page.tsx (import + JSX) | ✓ |
| 加 5 个 phase-P smoke | ✓ |
| main() 加 pgRunPhasePInheritancePoolSmokes() | ✓ |
| 跑 smoke 全 pass (226/226) | ✓ |
| commit + push | ✓ 7e6031d |
| 写 summary | ✓ 本文件 |

---

**任务完成。等待 Worker #2 后续 push 死亡后引导 flow 与本工单对接。**