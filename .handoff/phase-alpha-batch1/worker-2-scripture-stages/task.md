# Task: Phase-α 批 1 · α-4 功法三段（经/诀/神通）

## 目标
为《我靠模拟成仙》在 `/e/aigame2/` 工程内实现 item_type=scripture 的熟练度三段：
- `practiced`（初习）
- `awakened`（觉意）
- `transcendent`（神通 / 大成）

## 触发原因
详阅 `C:\Users\14262\memory\today\2026-06-30.md` §「Phase-α dev plan / α-4」段。
凡人修仙传（七十二变/剑光分化三境/元磁神光）/ 诛仙（神剑御雷/太极玄清三阶）/ 牧神记（功法可推演）/ 灵剑山（轻松层）。
现有 `ItemEntry` 装备无槽位系统已经能挂功法，但"习/觉/大成"的熟练度全无，AI 写"修为精进"无量化累计。

## 范围
- **包含**：
  - `ItemEntry` script 类扩展 3 字段：`scriptureStage?: 'practiced'|'awakened'|'transcendent'` + `scriptureExp?: number` + `scriptureAwakeningHook?: string`
  - 引擎 `engine.ts`：
    - `computeScriptureStage(item, exp)` —— 三段判定
    - `addScriptureProgress(state, scriptureId, exp, reason)` —— 累计 + 推段
    - `addItems` 接 scripture 类型时缺省填 `practiced` + 0 exp
    - `executeAIEvent` 后按 aiOutput.scriptureProgress 累计
  - `stateToResponse` 透传 + `dbToState` 兜底缺省
  - `llm.ts`：
    - aiOutput schema 加 `scriptureProgress?: { itemId?: string; itemName: string; expDelta: number; reason: string }[]`
    - 提示词加"经/诀/神通/融合"4 类自然指引
  - UI 投影：**仅**在 `src/components/xianxia/InventoryPanel.tsx` 的 Scripture 组按 stage 显示三段色阶 chip + 进度数字。**不做"自创功法/自选下任"UI**。
  - 兼容：旧 scripture 没有 stage 字段视作 `practiced` + 0 exp，不弹错
  - smoke-α-005 + smoke-α-006 共 2 个新 regression smoke
- **不包含**（明确不动的范围）
  - 不改装备面板其他分组
  - 不写"功法等级选择器"UI（**AI 是注册者**核心硬约束）
  - 不动 breakthrough/merit/karma（worker-1 范围）
  - 不改 /e/aigame2_publish（owner 拍板后手动同步）
  - 不写新组件

## owner 关注点
- **修仙沉浸**：stage 三段用修仙词（初习/觉意/大成），不暴露"enum/字段"机制词
- **可读 priority**：UI chip 上的熟练度按 stage 灰阶/青色/紫色区分，数字用 `xx%` 格式（不暴露内部 exp 字段名）
- **AI 自然产出**：AI 在 narrative 自然叙出"功法精进/觉醒/推演"事件，引擎累计 stage；**禁止**在 narrative 中出现"stage=practiced"等机制词
- **兼容旧档**：旧 scripture 物品无 stage 字段默认 `practiced`，加载不报错
- **不可替代**：进度数值由引擎权威累计，AI 的 scriptureProgress.delta 仅是建议（被引擎限幅 [0..30]/事件，防溢出）

## 优先级
P1（phase-α 批 1 主体之一，影响主动技能体系的延展性）
