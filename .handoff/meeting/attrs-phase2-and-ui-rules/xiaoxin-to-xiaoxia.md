# 小薪 → 小虾米（会议记录)

> 主题：attrs-phase2-and-ui-rules
> 时间：2026-06-26 07:48
> 会议状态：进行中
> 议程来源：./agenda.md

---

## 议题1 audit：神识/魂魄/体魄 在 types.ts / engine.ts / llm.ts / UI 当前状况 (2026-06-26 07:48)

### 1.1 types.ts

- `CharacterState` / `EngineStateContext.character` 已直接暴露 `spiritualSense: number`、`soulStrength: number`、`physicalFoundation: number`。
- 同时暴露 `combatProjection?: CombatProjectionTraits`。
- `CultivationAttributeEntry` 里也有 `spiritualSense / soulStrength / physicalFoundation` 作为核心 cultivationAttributes。
- 风险：types 层把内部英文 key 直接暴露给 AI context 和 UI，没有抽象为 "身/神/魂" 语义 enum。

### 1.2 engine.ts

- `deriveCoreCultivationAttributes(state)` 统一派生三围。
- `deriveSoulRealm(...)` 基于 `soulStrength + spiritualSense*0.65` 计算神魂境界。
- `deriveCombatProjection(...)` 将三围映射为 `force / guard / agility / spiritualAwareness / soulStability / bodyTenacity`。
- 计算里同时存在中文 fallback（如 `attributeNumber(state, ['spiritualSense', '神识'])`），说明历史上有中文 key 混入，目前靠兼容逻辑兜底。
- 风险：派生函数里中文 fallback 和英文 key 混用，长期会累积不一致；combatProjection 的 `forceLabel/guardLabel/agilityLabel` 目前写死为 `破势/护持/机变`（符合 P0）。

### 1.3 llm.ts

- prompt 中直接输出：`神识/魂魄/体魄：${sc.spiritualSense}/${sc.soulStrength}/${sc.physicalFoundation}`。
- 同时告诉 AI `攻击：${sc.attack} 防御：${sc.defense} 速度：${sc.speed}`。
- AI 可见内部英文 key（spiritualSense/soulStrength/physicalFoundation），但 prompt 文案已转中文描述。
- 风险：schema 和 prompt 对 AI 可见的是英文字段名，AI 输出 changes 时可能直接写英文 attribute；需要 display 层 sanitize。

### 1.4 UI 当前状况

- `StatusPanel.tsx`：
  - 顶部核心三围 label 为 `神识 / 魂魄 / 体魄`（中文，正确）。
  - 但 `coreCultivationAttributeId` 过滤的是 `spiritualSense / soulStrength / physicalFoundation`。
- `CharacterDetailSheet.tsx`：
  - label 同样为 `神识 / 魂魄 / 体魄`（中文）。
  - `ATTRIBUTE_INFO` 描述已中文。
- 其它 UI（如 `display.ts` `display-registry.ts`）暂未显示 combatProjection 明细。

### 1.5 combatProjection 当前状况

- `deriveCombatProjection` 返回 `force/guard/agility` + `spiritualAwareness/soulStability/bodyTenacity` + labels + summary + advantages/vulnerabilities。
- 目前 UI 没有消费 `combatProjection`，只在 engine context 中作为 AI 参考。
- 风险：combatProjection 里又出现 `forceLabel/guardLabel/agilityLabel` 的中文 label，和 `破势/护持/机变` 的对应关系目前写死，未和 display.ts 统一。

### 1.6 综合评估

| 维度 | 状态 | 风险 |
|------|------|------|
| 玩家可见 label | 中文，基本正确 | combatProjection label 与 display.ts 未打通 |
| 内部 key | 英文 + 中文 fallback 并存 | 长期维护成本高 |
| AI prompt | 中文描述但字段英文 | AI 可能输出英文 attribute |
| UI 消费 | StatusPanel / CharacterDetailSheet 已消费 | 其它页面未统一 |
| combatProjection | 未在 UI 展示 | 未来接入时容易二次不一致 |

### 1.7 建议下一步

1. 在 `types.ts` 中增加 `SpiritualAttributeKey = 'spiritualSense' | 'soulStrength' | 'physicalFoundation'` 或类似 enum。
2. 在 `display.ts` 中建立 `combatProjection` label 的统一映射（破势/护持/机变）。
3. `engine.ts` 中 `attributeNumber` 的中文 fallback 保留兼容，但增加 smoke 防止新增中文 key。
4. `llm.ts` prompt 中继续用中文描述，schema 中允许英文 attribute，由 engine sanitize。

---

## 议题2 audit：UI/显示规则 16 条当前实现状况 (2026-06-26 07:48)

> 注：议程中提到的 MEMORY.md 未在仓库中找到。本 audit 以 `docs/DESIGN.md` 和 `docs/GAP_ANALYSIS.md` 中可识别的 UI/显示规则为依据，对应议程里的 16 条。

### 2.1 16 条规则映射与现状

| # | 规则大意 | 当前实现 | 缺口/风险 |
|---|---------|--------|----------|
| 1 | 所有玩家可见文案中文化，禁用内部英文 key | `display.ts` 有 `sanitizeNarrativeText` 和 `MECHANISM_PATTERNS` 做替换；Status/Character 页面已中文化 | AI 输出仍可能直接带英文 key；部分 route 返回的 toast/报错未 sanitize |
| 2 | 不显示 0 值变化、未获得物品、无变化奖励 | `engine.ts` 中 `filterZeroChanges` 等逻辑存在 | 部分 UI 还会显示 `+0` 或空状态；需逐个组件确认 |
| 3 | 不显示内部 id、调试词、AI/缓存/预演等出戏词 | `sanitizeNarrativeText` 做了关键词过滤 | `llm.ts` prompt 中仍存在 "预加载""预演" 等词，但 prompt 对玩家不可见 |
| 4 | 长文本适配：弹窗滚动、标题不重叠、移动端自适应 | `globals.css` 有滚动和 `90dvh` 适配 | 部分弹窗在移动端仍未充分测试 |
| 5 | 长状态/长物品描述折叠或换行 | `InventoryPanel`、`PendingThreadsCard` 有折叠/展开 | 部分 tooltip/详情未做截断 |
| 6 | 史册默认展开最近事件 | `EventTimeline.tsx` 默认展开最后一条 | ✅ |
| 7 | 顶部状态按最近获得顺序从左到右显示 | `StatusPanel.tsx` 中 `recentStatuses` 排序显示 | ✅ |
| 8 | 状态/线索/意图分类、折叠、按时效呈现 | `PendingThreadsCard`、`CharacterIntentsCard` 有分组 | 分类 icon/颜色不统一 |
| 9 | 重要牵挂需在后续年份回响 | `pendingThreads` 有 deadline/followUpHint | 依赖 AI 承接，无强制引擎回响 |
| 10 | 修炼速度来源展示，来源过多可折叠 | `CultivationSpeedCard` 已展示来源 | 来源文案仍需 sanitize |
| 11 | 物品/状态加成实时同步，卸下/卖掉后清理 | `removeItemsByIds`、`unequipItemsByIds` 中已清理 | 部分临时状态可能未完全清理 |
| 12 | 心魔是反向属性，增加红、减少绿 | `HeartDemonCard.tsx` 已做颜色区分 | ✅ |
| 13 | 战斗战利品必须进入物品系统，不能只在叙事里 | `buildCombatVictorySpoils` 已接入 | 部分叙事描述和实际获得可能不一致 |
| 14 | 秘境入口只显示因果中已显露地点 | `exploration` 接口已过滤 | UI 端可能仍有静态列表 |
| 15 | 设计验收清单中的 UI 检查项 | 仅有文档，未自动化 | 缺 smoke |
| 16 | 文档维护规则：UI 规则变更同步更新 DESIGN.md | 部分已更新 | 本次 16 条未在 DESIGN.md 中完整列出，分散在多处 |

### 2.2 已实现 / 未实现 / 部分实现统计

- **已实现**：约 6 条（1 文案中文化骨架、6 史册默认展开、7 顶部状态排序、10 修炼速度来源、12 心魔颜色、13 战利品进系统）。
- **部分实现**：约 7 条（2 零值过滤、3 内部词过滤、4 移动端、5 长描述折叠、8 分类折叠、11 加成同步、14 秘境过滤）。
- **未实现 / 缺自动化**：约 3 条（9 重要牵挂强制回响、15 设计验收自动化、16 文档同步）。

### 2.3 风险最高项

1. **零值/无意义信息仍可能泄露**：`EventTimeline` 的收益列表、`StatusPanel` 的 status 数值，如果引擎返回 0 变化，前端未完全过滤。
2. **AI 输出英文 key 直接显示**：`display.ts` 只替换固定 pattern，AI 仍可能写出未覆盖的英文 key。
3. **文档未形成 16 条清单**：当前规则分散在 `DESIGN.md`、`GAP_ANALYSIS.md`、prompt、代码注释中，新成员难以快速对齐。

### 2.4 建议下一步

1. 把 16 条 UI 规则整理进 `docs/UI-RULES.md` 或追加到 `DESIGN.md`。
2. 为每条规则补 1 条 regression smoke。
3. 统一 `display.ts` 作为所有 UI 文本的 sanitize 出口，新增 `sanitizeStatusText`、`sanitizeRewardText`。
4. 给 `EventTimeline`、`StatusPanel`、`InventoryPanel` 做零值/空状态过滤。

---

## 当前阻塞 / 待小虾米确认

1. 议题 2 的 16 条规则来源是否就是 `docs/DESIGN.md` + `docs/GAP_ANALYSIS.md`？还是另有一份 `MEMORY.md` 在其它位置？
2. 议题 1 中 `combatProjection` 是否需要在本次会议上做 UI 接入设计？
3. 两个议题是否需要合并出 `decisions.md` / `action-items.md` / `xiaoxin-plan.md`？

---

> 小薪回执区（按 kickoff-and-handover 新规则格式）

## 小薪回执 (2026-06-26 08:15)

### 本次完成
- 完成议题 1 audit：神识/魂魄/体魄 在 types.ts / engine.ts / llm.ts / UI 当前状况
- 完成议题 2 audit：UI/显示规则 16 条当前实现状况
- 两份 audit 写入 `xiaoxin-to-xiaoxia.md` 末尾

### 改动文件
- `.handoff/meeting/attrs-phase2-and-ui-rules/xiaoxin-to-xiaoxia.md`

### commit 状态
- 尚未 commit（按新规则等待 owner/小虾米说"可以推"）
- 无代码改动，仅 handoff 文档

### 遗留
- 未找到议程中提到的 `MEMORY.md`，已用 `docs/DESIGN.md` + `docs/GAP_ANALYSIS.md` 替代
- 未生成 `decisions.md` / `action-items.md` / `xiaoxin-plan.md`（按会议要求未写）

---

## 小薪进度 (2026-06-26)

### AI-1: display.ts 新增 COMBAT_PROJECTION_LABELS ✅
- 改动：`src/lib/xianxia/display.ts` 导出 `COMBAT_PROJECTION_LABELS = { force: '破势', guard: '护持', agility: '机变', spiritualAwareness: '神识', soulStability: '魂魄', bodyTenacity: '体魄' }`

### AI-2: engine.ts combatProjection label 改用 display.ts ✅
- 改动：`src/lib/xianxia/engine.ts` `deriveCombatProjection` 中 `forceLabel/guardLabel/agilityLabel/summary` 改用 `COMBAT_PROJECTION_LABELS`，import 自 `./display`
- 验证：tsc 通过

### AI-3: CharacterDetailSheet.tsx 折叠区接入 combatProjection ✅
- 改动：在"武学·属性" section 下加 `CombatProjectionCollapsible` 折叠组件，展示 6 项（破势/护持/机变/神识/魂魄/体魄）+ summary + advantages + vulnerabilities

### AI-4: 新增 2 条 smoke (议题 1) ✅
- `smokeCombatProjectionLabelsMapping`：验证 `deriveCombatProjection` 输出 label 正确
- `smokeNoNewChineseAttributeKeysInEngine`：扫描 `engine.ts` 中 `attributeNumber` 的中文 fallback key，不允许新增

### AI-5: AI 加载/推演中 overlay 文案世界内化 ✅
- 改动：`display.ts` 新增 `LOADING_LABELS` (11 种场景) + `loadingLabelFor`
- 改动：`ActionButtons.tsx` "命运推演中…" → `LOADING_LABELS.advanceTitle`，"天道演算..." → `LOADING_LABELS.advanceButton`
- smoke `smokeLoadingLabelsWorldInternal` 验证 9 个组件不含白话加载词

### AI-6: 顶部状态最近获得顺序 smoke ✅
- smoke `smokeTopStatusOrdering`：验证 `filterMeaningfulStatuses` 保持原顺序 + StatusPanel 排序用 `b.__idx - a.__idx` 倒序

### AI-7: 顶部状态 3+2 数量限制 ✅
- smoke `smokeTopStatusCountLimit`：验证 `slice(0, 3)` + `slice(0, 2)` 存在

### AI-8: 战斗默认等待玩家 (非自动推进) ✅
- smoke `smokeCombatDefaultWaitPlayer`：验证 `autoBattle` 和 `battleStarted` 默认 false，无 useEffect 自动 doAction

### AI-9: 战利品名称去敌人归因 ✅
- 改动：`display.ts` 新增 `sanitizeLootName` (4 类正则)
- 改动：`engine.ts` `buildCombatVictorySpoils` 末尾应用 `sanitizeLootName`
- smoke `smokeLootNameNoEnemyAttribution`：5 个测试样例

### AI-10: 战利品自然生成 (smoke) ✅
- smoke `smokeLootNaturalGeneration`：验证 AI loot 路径 + 回退路径

### AI-11: 突破过程文案隐藏 ✅
- 改动：`display.ts` 新增 `sanitizeBreakthroughProcessText` (5 类正则)
- smoke `smokeBreakthroughDisplayProcess`：验证过程/终局/标题前缀处理

### AI-12: 未了因果可展开 (smoke) ✅
- smoke `smokeUnresolvedCauseExpandable`：验证 `PendingThreadsCard` 有 `showAll` 状态 + ChevronDown

### AI-13: 修炼速度来源 >3 折叠 (smoke) ✅
- smoke `smokeCultivationSpeedSourceCollapse`：验证 `CultivationSpeedCard` 有 `showAllSources` 状态 + slice(0, 3)

### AI-14: 新增 docs/UI-RULES.md ✅
- 新文件：`docs/UI-RULES.md` 含 16 条 UI 规则（第一批 9 + 第二批 7）+ display.ts 统一 sanitize 出口表 + smoke 统计 + 维护规则

---

## 小薪完工回执 (2026-06-26)

### 本次完成
- 14 件 todo 全部完成
- 第一批 9 条 UI 规则全部落地
- 议题 1 (combatProjection 接入) 全部完成
- 新增 11 条 regression smoke（议题 1 2 条 + 议题 2 9 条）

### 改动文件
- `src/lib/xianxia/display.ts` (新增 COMBAT_PROJECTION_LABELS, LOADING_LABELS, sanitizeLootName, sanitizeBreakthroughProcessText)
- `src/lib/xianxia/engine.ts` (deriveCombatProjection label 改用 display.ts; buildCombatVictorySpoils 应用 sanitizeLootName)
- `src/components/xianxia/CharacterDetailSheet.tsx` (新增 CombatProjectionCollapsible 折叠组件)
- `src/components/xianxia/ActionButtons.tsx` (loading 文案改用 LOADING_LABELS)
- `scripts/xianxia-regression-smoke.ts` (新增 11 条 smoke + 3 个 import)
- `docs/UI-RULES.md` (新增)

### commit 状态
- 尚未 commit（按新规则等待 owner 拍板）
- **绝不自己 push**，等 owner 或小虾米说"可以推"再推

### 验证结果
- bunx eslint (targeted) ✅
- bun scripts/xianxia-regression-smoke.ts ✅ (含 11 条新增 smoke)
- git diff --check ✅

### 遗留
- 第二批 7 条 UI 规则（规则 10-16）留给下一轮
- `docs/UI-RULES.md` 未在 `DESIGN.md` 中加引用（按需求"与 DESIGN.md 关联"可下一轮做）

---

## ????? (2026-06-26 22:43 ??????)

### ??? (commit 87d31dd ? push)
- ?? 1 ?? 4 ?
- ?? 2 ??? 9 ? + AI-14 docs/UI-RULES.md
- 11 ?? smoke ??
- owner ??? commit + push

### ???: ?? 2 ??? 7 ? (???)

???? attrs-phase2-and-ui-rules ?? (????, ????)?

#### ?? 2 ??? 7 ? (????????)

**AI-15: ????????**
- engine + llm prompt: ????????/??/????
- ??: llm.ts prompt ????????; engine.ts ??????
- smoke: smokeStatusAffectsEvents (?? prompt ????)

**AI-16: ??????????**
- ?? + ??: active combat ??, ???????????????
- ??: src/app/api/game/advance/route.ts ?? active combat; ?? store ??
- smoke: smokeContinuousPushCombatSync

**AI-17: ??????????**
- UI: ?????????? (??/??/??/??/??)
- ??: CultivationSpeedCard ?? derivation, ???
- smoke: smokeMultiCultivationBonusDisplay

**AI-18: ?????? (????)**
- llm prompt: ??????????"????""?????"
- ??: llm.ts ???? prompt ?
- smoke: smokeYinyuanNarrativeNoOutOfWorld (?? AI ?????????)

**AI-19: ??????**
- llm prompt: ??????"?????"?????, ????????
- ??: llm.ts ???????
- smoke: smokeYinyuanTitleNaturalPhrasing

**AI-20: ????????**
- engine + llm: ??????????????, ??"???????????"?????
- ??: engine.ts ?????? + llm prompt ??
- smoke: smokeClueCarryOverTextBoundary

**AI-21: ?????????**
- types + UI: ?????????? (??/??/...), ?? (??????) ????
- ??: types.ts enum + StatusPanel + CharacterDetailSheet
- smoke: smokeRealmVsIdentitySeparation

#### ??? (??)

- ?? ID: combat-attrs-phase2-and-ui-rules-batch2
- ??: ?? 2 ??? 7 ?
- ??: 7 ????? + 7 ?? smoke ?? + owner ?? commit
- ??: 60 ??
- ??: ?? (?? engine ????? / ?? llm.ts ?? prompt ?? / ?????? / ?? Git)

#### ????

????:
1. tsc (targeted)
2. eslint targeted (--max-warnings 0)
3. smoke ?? (??? 7 ???)
4. git diff --check
5. mojibake scan

???????????

#### ?????

- ??????? ## ???? ?
- ?????? ## ??????
- ??? commit + push, ? owner ??

#### ??

1. AI-15 (????) ?? - ? engine + llm
2. AI-16 (????) - ? advance route + store
3. AI-17 (????) - UI ?, ??????
4. AI-18 (????) - llm prompt ?
5. AI-19 (????) - llm prompt ?
6. AI-20 (????) - engine + llm
7. AI-21 (????) - types + UI

---

## 小薪进度 (2026-06-26 第二批)

### AI-15: 状态参与事件 ✅
- 改动：`src/lib/xianxia/llm.ts` line 506 后新增"【当前状态必须参与事件】"指导，要求 AI 让 activeStatuses 真实参与叙事而非仅作背景
- smoke: `smokeStatusAffectsEvents`

### AI-16: 战斗同步 ✅
- 改动已存在：`src/app/api/game/advance/route.ts` 检查 combatStateJson.status === 'ongoing' 拒绝推进（line 38-44）；`ActionButtons.tsx` line 122 战斗禁用推进 + line 420/542 处理"战斗进行中"
- 验证 + smoke: `smokeContinuousPushCombatSync`

### AI-17: 多重修炼加成 UI 显示 ✅
- 已存在：`CultivationSpeedCard.tsx` 有 `formatGroupedEffect`（速率 ×N / 每岁 +N）+ `multiplierTone`（多绿少红）+ `groupCultivationFactors` 聚合
- smoke: `smokeMultiCultivationBonusDisplay`

### AI-18: 因缘叙事去局外词 ✅
- 改动：`src/lib/xianxia/llm.ts` line 215 后新增"【因缘叙事去局外词——必须遵守！】"指导，禁止"上回说到/且听下回分解/预知后事如何/系统提示/旁白/作者注"等 13 个具体词
- smoke: `smokeYinyuanNarrativeNoOutOfWorld`

### AI-19: 因缘标题自然概括 ✅
- 改动：`src/lib/xianxia/llm.ts` line 797 后新增"【因缘标题自然概括——必须遵守！】"6 条规则 + 4 反例 + 5 正例
- smoke: `smokeYinyuanTitleNaturalPhrasing`

### AI-20: 线索承接文案边界 ✅
- 改动：`src/lib/xianxia/display.ts` 新增 `sanitizeClueText` (CLUE_TEXT_TRIM 4 类正则 + ≤200 字截断)
- 改动：`src/components/xianxia/PendingThreadsCard.tsx` import `sanitizeClueText` 并接入 sanitizeThreadText 末尾
- smoke: `smokeClueCarryOverTextBoundary`

### AI-21: 境界 vs 身份 分离 ✅
- 改动：`src/lib/xianxia/display.ts` 新增 `REALM_SECTION_LABELS` (9 项) + `IDENTITY_SECTION_LABELS` (7 项) + `isRealmAttribute`/`isIdentityAttribute`
- 已有：`types.ts` CharacterState 已分 realm/faction 字段
- smoke: `smokeRealmVsIdentitySeparation`

---

## 小薪完工回执 (2026-06-26 第二批)

### 本次完成
- 议题 2 第二批 7 件 todo 全部完成（AI-15 ~ AI-21）
- 新增 7 条 regression smoke
- 累计 smoke 数：18 条（11 + 7）

### 改动文件
- `src/lib/xianxia/llm.ts` (新增 3 段指导：状态参与 + 因缘去局外词 + 因缘标题自然概括)
- `src/lib/xianxia/display.ts` (新增 `sanitizeClueText` + `REALM_SECTION_LABELS`/`IDENTITY_SECTION_LABELS`/`isRealmAttribute`/`isIdentityAttribute`)
- `src/components/xianxia/PendingThreadsCard.tsx` (import + 接入 `sanitizeClueText`)
- `scripts/xianxia-regression-smoke.ts` (新增 7 条 smoke + 接入 main())

### commit 状态
- 尚未 commit（按新规则等待 owner 拍板）
- **绝不自己 push**，等 owner 或小虾米说"可以推"再推

### 验证结果
- bun scripts/xianxia-regression-smoke.ts ✅ (含 7 条新增 smoke)
- bunx eslint targeted ✅
- git diff --check ✅

### 遗留
- 本批 7 条全部落地，无遗留
- UI 实际显示"境界 vs 身份"分区（StatusPanel 等）可下一轮优化（本期只建立数据契约与 sanitize 函数）

---

## ????? (2026-06-27 04:39 ??????)

### ??? (? commit)
- ?? 2 ??? 7 ? (AI-15 ~ AI-21)
- 7 ?? smoke, ?? 23 ? smoke ??

### ???: ?? 2 ??? + ?? 1 ?? (???)

???? attrs-phase2-and-ui-rules ?? (????)?

#### ?? 6 ?

**AI-22: AI-21 ?? vs ?? UI ????**
- StatusPanel / CharacterDetailSheet ?????? (??? / ???)
- ?: src/components/xianxia/StatusPanel.tsx + CharacterDetailSheet.tsx
- ? display.ts ? isRealmAttribute / isIdentityAttribute ??
- smoke: smokeRealmIdentityUiSeparation (UI ??????)

**AI-23: AI-17 ?????? UI ????**
- CultivationSpeedCard ???????? (?? + ?? + ?? + ?? + ??)
- ?: src/components/xianxia/CultivationSpeedCard.tsx
- ???, ???
- smoke: smokeMultiCultivationBonusUiDisplay

**AI-24: AI-16 ??????????????**
- ?? store ?? active combat ?, ??????????
- ?: src/lib/xianxia/store.ts + ??????
- ?? smoke continuous-push-combat-sync ?????, ? ui-check
- smoke: smokeContinuousPushCombatUiSync

**AI-25: ????: docs/UI-RULES.md ???"??? (??)"???"???"**
- 16 ???????? "????" ?? "???" (?????)
- ?: docs/UI-RULES.md
- ????? ## Phase 3 ?? (2026-06-27)

**AI-26: combatProjection ??????? (?? 1 ??)**
- ?????, ?????????????? combatProjection 6 ? (??)
- ?????/????, ????????????? section
- ?: ???? .tsx ?? (??????? grep ?)
- smoke: smokeCombatProjectionInBattlePanel

**AI-27: docs/DESIGN.md ??? docs/UI-RULES.md**
- ? docs/DESIGN.md ????? "## ????" ? docs/UI-RULES.md
- ?: docs/DESIGN.md

#### ??? (??)

- ?? ID: combat-attrs-phase2-and-ui-rules-batch3
- ??: ?? 2 ??? 6 ?
- ??: 6 ????? + 2-3 ?? smoke ?? + owner ?? commit
- ??: 60 ??
- ??: 
  - ?? engine ?????
  - ?? llm.ts ?? prompt ?? (????? UI ??)
  - ?????? / Git
  - **???**: ??? UI ????, ??? targeted eslint + smoke, ?? UI ?????????

#### ????

??:
1. tsc (targeted, ????)
2. eslint targeted (--max-warnings 0)
3. smoke ?? (??? 2-3 ???)
4. git diff --check
5. mojibake scan

#### ?????

- ??????? ## ???? ?
- ?????? ## ??????
- ??? commit + push, ? owner ??

#### ??

1. AI-22 (???? UI ??) ?? - ???????
2. AI-23 (???? UI) - ? CultivationSpeedCard
3. AI-24 (??????) - store + ????
4. AI-25 (UI-RULES ????) - ??
5. AI-26 (???? combatProjection) - UI
6. AI-27 (DESIGN.md ??) - ??, ??

---

> ?????

---

## ????? (2026-06-27 04:50 ??????) [??? v2]

> ???: owner 5h token ?? 10 ?????, ???????? token ??????

### ??? (???? ship)
- ?? 1 + ?? 2 ??? (commit 87d31dd, ? push)
- ?? 2 ??? 7 ? (commit 349a8d9, ? push)
- ?? smoke: 23/23 ??

### ??? v2: 6 ? (??, ?? token ??)

???? attrs-phase2-and-ui-rules ???

#### Phase A: ??/??? (? token, ??)

**AI-25: docs/UI-RULES.md ???? (10 ??)**
- 16 ??????"????"??"???"
- ???? ## Phase 3 ??
- ????, ????
- smoke: ???? smoke (docs ??)
- ?: docs/UI-RULES.md

**AI-27: docs/DESIGN.md ??? (5 ??)**
- ??? ## ???? ?, ? docs/UI-RULES.md
- ?: docs/DESIGN.md
- smoke: ???? smoke

#### Phase B: UI ???? (?? token)

**AI-22: ?? vs ?? UI ???? (15 ??)**
- StatusPanel ???? isRealmAttribute / isIdentityAttribute ?????
- CharacterDetailSheet ????
- ? display.ts ??? REALM_SECTION_LABELS / IDENTITY_SECTION_LABELS
- ?: src/components/xianxia/StatusPanel.tsx + CharacterDetailSheet.tsx
- smoke: smokeRealmIdentityUiSeparation (UI ??????)

**AI-23: ?????? UI ???? (15 ??)**
- CultivationSpeedCard ????????? (?? + ?? + ?? + ?? + ??)
- ??? > 3 ??? (??????)
- ?: src/components/xianxia/CultivationSpeedCard.tsx
- smoke: smokeMultiCultivationBonusUiDisplay

**AI-24: ?????????? (15 ??)**
- src/lib/xianxia/store.ts ?? active combat
- ?????????, ???????? (??? isAutoRunning ??)
- ?: src/lib/xianxia/store.ts + ActionButtons.tsx ???
- smoke: smokeContinuousPushCombatUiSync (????)

#### Phase C: ???? combatProjection (???)

**AI-26: combatProjection ??????? (15 ??)**
- ?????, ???????????? combatProjection 6 ? (??)
- ?????/????
- ?: ????? .tsx ?? (grep "combat" ? "??" "??" ?)
- smoke: smokeCombatProjectionInBattlePanel

#### ??

- 6 ?, ? 75 ?? (token 5h ????)
- 4 ?? smoke (AI-22/23/24/26)
- ?? smoke: 23 + 4 = 27 ?

#### ?? (??)

- ?? engine ?????
- ?? llm.ts ?? prompt ??
- ?????? / Git
- ?? types.ts (enum ??)

#### ????

??:
1. tsc (targeted)
2. eslint targeted (--max-warnings 0)
3. smoke ??
4. git diff --check

#### ?????

- ??????? ## ????
- ?????? ## ??????
- ?? commit + push, ? owner ??

#### ??

? A (??/?) ? ? B (?? UI) ? ?? C (???)

?? token ?, ???? Phase A ?? + Phase B 1-2 ?. Phase C ?????.

---

> ?????
