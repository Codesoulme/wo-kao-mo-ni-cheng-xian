# 小薪 → 小虾米（p3-archival-and-slot-coverage-plus-l1-worldview 补漏 3 件）

> 议题：3 件补漏（owner 拍板）
> 任务卡 ID: p3-archival-and-slot-coverage-plus-l1-worldview
> 时限: 30 分钟（实际 ~5 分钟）

## 小薪进度

### AI-60: WorldLegacyPanel 接入 GameLayout ✅
- `src/app/page.tsx` 新增 import + 渲染块（StatusPanel 下方折叠区）
- `WorldLegacyPanel.tsx` 新增 3 个 props：`character`（可选外部传入）+ `defaultCollapsed=true` + `maxCollapsed=3`
- 默认折叠，展开按钮（testid="world-legacy-toggle"）
- smoke: `smokeWorldLegacyPanelIntegrated` (验证 GameLayout import + render + props + toggle)

### AI-61: 8 个 L1 文档注入 llm.ts prompt ✅
- `src/lib/xianxia/llm.ts` 头部新增 `loadWorldKnowledge()` 函数（async fs.readFile + 缓存）
- 导出同步 fallback `getWorldKnowledgeSync()`
- 在 3 个入口注入：
  - `generateAgeEvent`: `await loadWorldKnowledge()` + 拼入 userPrompt
  - `generateAgeEventStream`: 同上
  - `generateBirthEvent`: 同上
- 每个文档截断 1500 字避免 prompt 过长
- smoke: `smokeL1WorldDocsPromptInjection` (验证 8 个文档 + loadWorldKnowledge + worldKnowledge 引用)

### AI-62: 5 级火候 + 6 类阵法 enum 扩展 ✅
- `src/lib/xianxia/types.ts` 新增 `AlchemyHeatLevel` (micro/weak/moderate/strong/extreme)
- `src/lib/xianxia/types.ts` 新增 `FormationCategory` (binding/slaughter/illusion/defense/support/trap)
- **未动**已有 `FormationType`（边界"不改已有 enum 值"）
- `src/lib/xianxia/display.ts` 新增 `ALCHEMY_HEAT_LABEL` (微/弱/中/强/极) + `FORMATION_CATEGORY_LABEL` (困/杀/幻/防/辅/陷)
- smoke: `smokeAlchemyHeatEnumExists` + `smokeFormationTypeEnumExists`

---

## 小薪补漏完工回执 (2026-06-27 补漏)

### 本次完成
- 3 件补漏全部完成
- 新增 3 条 smoke
- 修改 1 条已有 smoke（smokeWorldLegacyPanelExists 适配新 allEntries 命名）

### 实际耗时
- ~5 分钟（远低于估时 30 分钟）

### 改动文件
- `src/components/xianxia/WorldLegacyPanel.tsx` (AI-60 props + toggle)
- `src/app/page.tsx` (AI-60 import + render)
- `src/lib/xianxia/llm.ts` (AI-61 loadWorldKnowledge + 3 入口注入)
- `src/lib/xianxia/types.ts` (AI-62 2 enum)
- `src/lib/xianxia/display.ts` (AI-62 2 label)
- `scripts/xianxia-regression-smoke.ts` (3 条新 smoke + 1 条适配)

### 验证结果
- bun scripts/xianxia-regression-smoke.ts ✅ (73+3=76 条全过)
- bunx eslint targeted ✅ (无 warning)
- git diff --check ✅ (无错误)

### 边界遵循
- 未动 engine.ts 状态机核心 ✅
- llm.ts 允许追加 worldKnowledge 段 ✅ (在 generateAgeEvent / generateAgeEventStream / generateBirthEvent 注入，未改 prompt 主体)
- types.ts enum 允许扩展，不改已有 enum 值 ✅ (新增 AlchemyHeatLevel / FormationCategory，已有 FormationType 未动)

### 关键细节
- **AI-61 缓存机制**：`_worldKnowledgeCache` 全局缓存，多次调用只读一次磁盘
- **AI-61 截断**：每文档前 1500 字，控制 prompt 长度
- **AI-61 失败兜底**：fs.readFile 失败时静默跳过（开发期允许）
- **AI-62 命名**：用 `FormationCategory` 而非 `FormationType`，避免与已有 enum 同名

### commit 状态
- 尚未 commit（按新规则等待 owner 拍板）
- **绝不自己 push**，等 owner 或小虾米说"可以推"再推

### 遗留
- 无。本批 3 件遗留全部处理完。
- 后续 L1 文档注入可考虑加入更多入口（如 generateChoiceResult / generateInterfereResponse 等），但当前 3 个主入口（birth/advance/advanceStream）已覆盖主要叙事路径