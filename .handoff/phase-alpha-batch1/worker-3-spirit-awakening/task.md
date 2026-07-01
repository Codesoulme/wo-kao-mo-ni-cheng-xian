# Task: Phase-α 批 2 前置 · α-5 法宝养灵 / 器灵觉醒

## 目标
为《我靠模拟成仙》在 `/e/aigame2/` 工程内实现装备物（item_type=artifact/tool/scripture 等任意可养）的器灵觉醒路径：
- `nurtureProgress`（养灵进度 0..100）
- `awakeningStage`（未启/初醒/启智/化形）
- `sentientName?`（AI 自然起的器灵名）

## 触发原因
详阅 `C:\Users\14262\memory\today\2026-06-30.md` §「Phase-α dev plan / α-5」段。
凡人修仙传（韩立飞剑养灵/广寒界遗宝/掌天瓶）/ 诛仙（噬血珠器灵小环/天琊）/ 一念永恒（法宝苏醒）/ 遮天（万物母气鼎器灵）。
修仙感知的核心骨架之一：器物的"长情陪伴→觉醒"是修仙小说的标志桥段。

## 范围
- **包含**：
  - `ItemEntry` 扩展 3 字段：`nurtureProgress?: number` + `awakeningStage?: 'sleeping'|'awakened'|'sentient'` + `sentientName?: string`
  - 引擎 `engine.ts`：
    - `computeAwakening(progress)`：按 progress 0..100 → 三阶段判定
    - `addNurtureProgress(state, itemId, delta, reason)`：累计；首次跨 stage 自然产出 awakening 事件落回 state
    - `executeAIEvent` 后按 aiOutput.nurtureOutput 累计 delta
  - `stateToResponse` 透传 + `dbToState` 缺省
  - `llm.ts`：
    - aiOutput schema 加 `nurtureOutput?: { itemId?: string; itemName: string; delta: number; reason: string; awakenedName?: string }[]`
    - 提示词加"心血祭炼/神识交流/器灵苏醒"3 类自然指引（器灵名由 AI 自然起，**不**提供 UI 输入）
  - UI 投影：**仅**装备面板（`InventoryPanel.tsx` 的 equipped 组）显示 item 旁的器灵图标 + 三阶段灰阶
  - 兼容：旧装备没 nurture 字段视作 `nurtureProgress=0` + `sleeping`，加载不报错
  - smoke-α-007-spirit-awakening：完整 200 岁器灵剧情链（含苏醒时刻 narrative 一致）
- **不包含**
  - 不改 worker-1/2 范围（character schema / scriptureStage 字段一律不动）
  - 不写"指定器灵名"UI（**AI 是注册者**）
  - 不动 breakthrough/merit/karma
  - 不改 /e/aigame2_publish（owner 后同步）
  - 不写新组件、不改 page.tsx

## owner 关注点
- **修仙沉浸**：三阶段用修仙词（未启/初醒/启智/化形），不暴露"enum/字段"机制词
- **AI 自然产出**：器灵苏醒由 AI 在 narrative 自然叙出，sentientName 由 AI 提供——UI 仅展示
- **兼容旧档**：旧装备无 nurture 字段默认 0/sleeping，加载不报错
- **数值保护**：AI 提议 nurture delta 由引擎限幅 [0..10]/事件，防 overflow

## 优先级
P1（批 1 范围虽原列批 2，用户已明说加 worker 提前推进）
