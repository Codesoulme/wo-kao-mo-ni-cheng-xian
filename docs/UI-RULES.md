# 《我靠模拟成仙》UI 显示规则 (16 条)

> 版本：v1.0 (2026-06-26)
> 来源：会议 attrs-phase2-and-ui-rules 决议
> 适用：所有玩家可见 UI 文本（叙事、卡片、Toast、loading、标签、按钮）

## 总原则

- **AI 生成，引擎验收，前端投影**：所有玩家可见内容必须经 `display.ts` sanitize 后输出。
- **世界内化**：禁止出现 "AI/JSON/缓存/加载中/命运推演" 等白话/系统感词，必须转译为修仙世界内语言。
- **零值过滤**：0 变化、未获得物品、无效果奖励不显示。
- **三围中文 label**：破势 / 护持 / 机变 / 神识 / 魂魄 / 体魄（display.ts `COMBAT_PROJECTION_LABELS` 唯一来源）。

---

## 第一批 9 条（本轮已落地）

### 规则 1：AI 文案世界内化（天机/因果/灵机）

- **要求**：所有 "AI 生成中/推演中/加载中" 类 loading 文案必须走 `LOADING_LABELS`，转译为"灵机牵引中"/"天机未明"/"灵契感应中"等修仙感词。
- **实现**：`display.ts` 导出 `LOADING_LABELS`，覆盖 advance/preload/reset/choose/combat/interfere/market/formation/pet/start/aiConfigTest 11 种场景。
- **smoke**：`smokeLoadingLabelsWorldInternal`

### 规则 2：顶部状态最近获得顺序

- **要求**：顶部状态按"最近获得"顺序（数组末尾 = 最新）显示。
- **实现**：`StatusPanel.tsx` 用 `b.__idx - a.__idx` 倒序取前 3。
- **smoke**：`smokeTopStatusOrdering`

### 规则 3：顶部状态 3+2 数量限制

- **要求**：顶部 normal 状态限 3 个，constitution（灵根/体质）状态限 2 个。
- **实现**：`StatusPanel.tsx` `topStatuses.slice(0, 3)` + `constitutionStatuses.slice(0, 2)`。
- **smoke**：`smokeTopStatusCountLimit`

### 规则 4：战斗默认等待玩家（非自动推进）

- **要求**：战斗开始后默认 `autoBattle=false`，等玩家点击行动。
- **实现**：`CombatModal.tsx` `useState(false)`，doAction 需玩家点击触发，无 useEffect 自动调用。
- **smoke**：`smokeCombatDefaultWaitPlayer`

### 规则 5：战利品名称去敌人归因

- **要求**：战利品名称不能带"XX 的"敌人归因（如"山匪的储物袋"→"储物袋"）。
- **实现**：`display.ts` `sanitizeLootName` 包含 4 类正则（XX的+名词 / XX遗留/留下/用剩 / 从XX处夺得 / XX的遗物/尸首）。
- **smoke**：`smokeLootNameNoEnemyAttribution`

### 规则 6：战利品自然生成（结合 enemy identity/realm/resources）

- **要求**：战利品必须从 AI 路径基于敌人身份/境界/资源生成；AI 失败时引擎回退到 `buildEnemyCarriedLoot` 模板。
- **实现**：`engine.ts` `buildCombatVictorySpoils` 优先用 `aiLoot`，否则回退到 `buildEnemyCarriedLoot`。
- **smoke**：`smokeLootNaturalGeneration`

### 规则 7：突破过程文案隐藏（仅终局显示"破境"标签）

- **要求**：破境/突破标签只用于最终突破成功叙事，过程叙事（冲关/临门一脚/准备/失败）不显示。
- **实现**：`display.ts` `sanitizeBreakthroughProcessText(text, isFinalBreakthrough)` 替换"破境之瞬/突破之瞬/破境·/突破·"为"修行/修行·"。
- **smoke**：`smokeBreakthroughDisplayProcess`

### 规则 8：未了因果可展开

- **要求**：未了因果（pendingThreads）超过可视范围时，点击可展开全部。
- **实现**：`PendingThreadsCard.tsx` `showAll` 状态 + ChevronDown 切换。
- **smoke**：`smokeUnresolvedCauseExpandable`

### 规则 9：修炼速度来源 >3 折叠

- **要求**：修炼速度来源超过 3 个时折叠，点击展开全部。
- **实现**：`CultivationSpeedCard.tsx` `showAllSources` 状态 + `groupedSources.slice(0, 3)`。
- **smoke**：`smokeCultivationSpeedSourceCollapse`

---

## 第二批 7 条（下一轮，本轮不混）

### 规则 10：重要牵挂强制回响

- **要求**：重要 pendingThread 在后续年份必须由 AI 承接，否则引擎自动补一条提醒事件。
- **计划**：engine + llm prompt 双层校验。

### 规则 11：物品/状态加成实时同步

- **要求**：装备/卸下/消耗/卖掉时，加成必须实时同步（无残留）。
- **计划**：所有 item/status 路径走 `recalcCultivationMultiplier`。

### 规则 12：心魔反向属性

- **要求**：心魔增加显示红色（负面），减少显示绿色（正面），且高心魔影响修炼速度。
- **计划**：UI 颜色 + engine 速度惩罚。

### 规则 13：秘境入口只显示已显露

- **要求**：玩家可见秘境列表只包含因果中已显露的地点。
- **计划**：llm prompt 校验 + engine 过滤。

### 规则 14：移动端长文本适配

- **要求**：所有弹窗支持 `90dvh` 内滚动，标题不重叠，长描述折叠。
- **计划**：globals.css + 组件 max-height。

### 规则 15：长状态/长物品描述折叠

- **要求**：超长 status/item 描述默认折叠，点击展开。
- **计划**：StatusList/InventoryPanel 通用折叠组件。

### 规则 16：长文本分段 + 史册默认展开

- **要求**：长 narrative 自动分段，史册默认展开最近事件。
- **计划**：EventTimeline + StreamingNarrative 联动。

---

## display.ts 统一 sanitize 出口

| 函数 | 用途 | 对应规则 |
|------|------|----------|
| `sanitizeNarrativeText` | narrative 全文 sanitize（机制词、英文 key、零值） | 规则 1, 3 |
| `sanitizeLootName` | 战利品名称去归因 | 规则 5 |
| `sanitizeBreakthroughProcessText` | 突破过程文案隐藏 | 规则 7 |
| `attributeLabel` | 内部 attribute key → 中文 label | 规则 1 |
| `isVisibleNumericEventEffect` | 零值/无效 event effect 过滤 | 规则 2 |
| `COMBAT_PROJECTION_LABELS` | 三围 label 统一来源 | 规则 1, 议题 1 |
| `LOADING_LABELS` | loading 文案统一来源 | 规则 1 |

---

## smoke 统计

- 第一批 9 条各 1 条 smoke
- 议题 1 + 议题 2 共 2 条 smoke
- AI-1 ~ AI-4 额外 smoke（combatProjection label + attribute key 约束）
- 合计新增 11 条 smoke（不含原有 P0+P1 的 5 条）

---

## 维护规则

- 修改任何 UI 显示逻辑前，先查 `display.ts` 是否已经有对应 sanitize 函数
- 新增的玩家可见文案，必须经过对应 sanitize 函数处理
- 改动 UI 后必须更新本文档对应规则
- smoke 失败 = 禁止 commit
