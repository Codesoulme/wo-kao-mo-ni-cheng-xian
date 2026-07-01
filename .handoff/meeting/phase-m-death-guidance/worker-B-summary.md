# Worker #2 — P0 #2 死亡后引导（Death Guidance Panel）

## 任务
实现角色死亡后的清晰引导：3 个明确下一步选项（轮回重开 / 回归入凡 / 继续旁观），不破坏现有死亡叙事。

## 交付内容

### 新增 / 修改文件

| 文件 | 变更 | 说明 |
| --- | --- | --- |
| `src/components/xianxia/DeathGuidancePanel.tsx` | 新建 | 死亡引导面板，含 3 个按钮 + 死因/终年展示 + 折叠交互 |
| `src/app/page.tsx` | 修改 | 在 EndingPanel 后注入 `<DeathGuidancePanel>`，挂到 `data-testid="death-guidance-section"` |
| `src/lib/xianxia/store.ts` | 修改 | 加 4 个 state 字段 + 3 个 actions：`deathGuidanceDismissed`、`dismissDeathGuidance`、`selectNextProtagonistAndContinue`、`resetCharacterToMortalStart` |
| `scripts/xianxia-regression-smoke.ts` | 修改 | 加 `pgRunPhaseODeathGuidanceSmokes()` + 5 个 Phase-O smoke + Phase-M #4 100 年端到端 smoke |

### Store 新增签名

```ts
// 字段
deathGuidanceDismissed: boolean;

// 关闭引导（玩家选「继续旁观」）
dismissDeathGuidance: () => void;

// 轮回重开：triggerEndingEvaluation → 从 worldLegacies / pool 派生候选 → selectNextProtagonist → claimInheritanceCandidate
selectNextProtagonistAndContinue: () => {
  ok: boolean;
  narrative?: string;
  selectedId?: string;
  error?: 'no-pool' | 'no-candidates' | 'no-pick';
};

// 回归入凡：清 character/pendingChoice/events/choices/ceremony 字段，保留 worldCalendar/heritageVault/settlementResult/hallOfSimulations/inheritancePool
resetCharacterToMortalStart: () => void;
```

### UI 文案（沉浸修仙风，无乱码，无 AI/引擎/调试词）

- 标题：`魂归道山 · 此生已尽` / 飞升时 `飞升证道 · 此生已尽`
- 死因标签：`陨落因由`
- 终年：`青岚仙历5000年 · 28岁`（取 `worldCalendar.eraName + calendarYear + age`）
- 引导语：`道途未绝，择一续缘：`
- 按钮：
  - 「轮回重开」— 承继衣钵，再世修仙
  - 「回归入凡」— 散尽修为，重新投胎
  - 「继续旁观」— 收敛此篇，留待后人
- 失败提示：`无可继承之人，仙路轮转暂止。` / `传承评定未果，暂且按下。`

### 死亡检测

```ts
function isDeadLike(ch: CharacterState | null): boolean {
  if (!ch || typeof ch !== 'object') return false;
  if (ch.alive === false) return true;
  if (ch.dead === true) return true;
  if (typeof ch.causeOfDeath === 'string' && ch.causeOfDeath.trim().length > 0) return true;
  if (ch.ascended === true) return true;
  return false;
}
```

面板在 `isDeadLike === false` 或 `deathGuidanceDismissed === true` 时返回 `null`，不污染活着的角色界面。

## 烟雾测试

5 个 Phase-O smoke（按任务规范命名）：

| smoke | 检查 |
| --- | --- |
| `smoke-o-001-death-guidance-panel-exists` | `DeathGuidancePanel.tsx` 文件存在，含 3 个按钮标签 |
| `smoke-o-002-three-buttons-naming` | 包含「轮回重开」「回归入凡」「继续旁观」中文标签 |
| `smoke-o-003-reincarnate-calls-select-next` | 引用 `selectNextProtagonistAndContinue` 和 `triggerEndingEvaluation` |
| `smoke-o-004-reset-clears-character` | `resetCharacterToMortalStart` 实现存在并清 character |
| `smoke-o-005-alive-hides-panel` | 死亡检测函数识别活角色返回 false |

外加 Phase-M #4（100 年端到端）：构造角色 → 修行 → 触发死亡 → 评定 → 注入继承池 → 选下一任。

## 跑分结果

```
bun run scripts\xianxia-regression-smoke.ts
```

- 392 个 smoke 全过（`passed:true` × 392）
- 0 失败（`passed:false` × 0）
- 退出码 0
- 含本次新增 5 个 Phase-O smoke + 1 个 Phase-M #4 100 年 smoke

## Git 提交

- 仓库：`E:\aigame2_publish`
- 分支：`main`
- 本次提交：`7396d06 phase-m #2 death guidance (3 options + 5 smokes) + bom-fix + phase-m #4 100yr smoke`
- 已 push 到 `origin/main`（`343c61a..7396d06  main -> main`）
- 文件统计：`4 files changed, 1470 insertions(+), 1230 deletions(-)`

## 顺手修复

Worker #3 的 commit `7e6031d` / `343c61a` 把 `'use client';` 误写成 `'use `（丢了 `client';` 三字符），同时在文件头多塞了字面 `??`（疑似被前面 BOM 干扰）。

我在本次提交里顺手把这 3 个文件头修回 UTF-8 干净版本：

| 文件 | 修复 |
| --- | --- |
| `src/app/page.tsx` | 加回 `'use client';` |
| `src/components/xianxia/DeathGuidancePanel.tsx` | 加回 `'use client';` |
| `src/lib/xianxia/store.ts` | 去掉前缀 `??`（即丢掉字面问号，保留合法 `'use client';`） |

修完后 `bun build scripts\xianxia-regression-smoke.ts` 不再爆 `Unexpected ??`，整套 smoke 才能跑过。

## 边界处理

- 不改 `engine.ts`：复用 `selectNextProtagonist` / `triggerEndingEvaluation` / `seedInheritancePoolFromEnding`
- 不改 `EndingPanel.tsx` / `SaveSlotPanel.tsx`
- 不改 `store.ts` 的 `partialize`（仍是 12 字段，存档兼容）
- `resetCharacterToMortalStart` 保留 `worldCalendar` / `heritageVault` / `settlementResult` / `hallOfSimulations` / `inheritancePool`，让「归凡后再开新一局」能继承上一世的世界遗产
- `deathGuidanceDismissed` 不入 `partialize`，纯前端折叠态，重启不持久化
- 三个按钮全部用中文用户视角命名（轮回重开 / 继承池 / 回归入凡 / 继续旁观 / 道途未绝 / 择一续缘 / 收敛此篇）

## 已知遗留 / 不在本任务范围

- `InheritancePoolPanel.tsx` 由 Worker #3 落地，已挂到 `data-testid="inheritance-section-wrapper"`，本面板同位置共存
- 面板只读 `character.causeOfDeath`，玩家文本不暴露「天道干预」之类的机制词（符合父规则 `因缘叙事规则`）

## 自审

- ✅ 三按钮全部中文命名，无 `???`
- ✅ 死因 / 终年显示来自 `character.causeOfDeath` + `worldCalendar`，不暴露 AI/引擎/调试/id
- ✅ 复活 / 重置逻辑写在 store action 里，UI 只调 action，不自己拼剧情
- ✅ 不破坏 EndingPanel 现有展示（death-guidance-section 在 ending-section 后展开）
- ✅ 不改 partialize → 旧存档不会破
- ✅ 5 个 smoke + 1 个 e2e smoke，392/392 全过