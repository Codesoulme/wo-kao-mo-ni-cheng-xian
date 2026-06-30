# Task: Phase-α 批 2 前置 · α-7 灵田 / 灵植 / 物候

## 目标
为《我靠模拟成仙》在 `/e/aigame2/` 工程内实现角色灵田 + 24 节气物候感知：
- `CharacterState.spiritGarden`：zones[]（每块：seed/seededAt/expectedHarvestAt/quality/atmosphere）
- 引擎按 gameTime 节气 + 灵土配比计算产出
- AI 自然产出"翻土/抽薹/采收/落霜"事件

## 触发原因
详阅 `C:\Users\14262\memory\today\2026-06-30.md` §「Phase-α dev plan / α-7」段。
凡人修仙传（凝元草/玉髓芝/灵药园）/ 遮天（圣药园/轮海药引）/ 完美世界（至尊殿堂灵药）/ 飘邈之旅（灵植体系）。
修真世界物候时序：自产材料 + 节气限制 = 修真质感的核心生态。

## 范围
- **包含**：
  - `CharacterState` 加 `spiritGarden: { zones: SpiritGardenZone[] }`
  - `SpiritGardenZone = { id: string; seed: string; seededAt: GameTime; expectedHarvestAt: GameTime; quality: number; atmosphere: string }`
  - 引擎 `engine.ts`：
    - `advanceGarden(state, newTime)`：每岁推进后按 gameTime 节气 + 灵土配比更新
    - `harvestZone(state, zoneId)`：到期产出 → 走 addItems 入口（统一物品清单）
    - `addGardenZone(state, seed, quality)`：AI 在 narrative 自然产出"翻土/播种"事件
  - `stateToResponse` 透传 + `dbToState` 缺省
  - `llm.ts`：
    - aiOutput schema 加 `gardenOutput?: { action: 'plant'|'harvest'|'tend'; zoneId?: string; seed?: string; quality?: number; note: string }[]`
    - 提示词加"翻土/抽薹/采收/落霜"4 类自然指引
  - UI 投影：**仅**在 `InventoryPanel.tsx` 顶部加一个极简 collection chip 列（灵田尺寸 + 当前种子 + 距收获），**不**做种植面板主入口
  - 兼容：旧角色没 spiritGarden 字段视作 `{ zones: [] }`
  - smoke-α-008-spirit-garden：完整节气轮转产出与 narrative 一致
- **不包含**
  - 不写"种植操作面板"UI（**AI 是注册者**核心硬约束 —— 翻土/播种/采收由 AI 在 narrative 自然产生）
  - 不改 gameTime 实现（沿用 4 时辰 24 节气 现行结构）
  - 不动 worker-1/2/3 范围
  - 不改 /e/aigame2_publish（owner 后同步）
  - 不写新组件

## owner 关注点
- **修真沉浸**：节气用修仙词（惊蛰/芒种/秋分 大雪/谷雨/小满），不暴露"cron/YYYY-MM-DD"机制词
- **AI 自然产出**：翻土/播种/采收由 AI 在 narrative 自然产生，引擎累计并按节气推进
- **生态闭环**：自产材料走 addItems 入口（统一物品清单），不另立"采集路径"
- **兼容旧档**：旧角色无 spiritGarden 字段默认 `{ zones: [] }`

## 优先级
P1（批 1 范围虽原列批 2，用户已明说加 worker 提前推进）
