# Task: Phase-α 批 1 · α-1 雷劫/天劫 + α-2 因果业力

## 目标
为《我靠模拟成仙》修仙质感深耕 phase-α 批 1 在 `/e/aigame2/` 工程内实现：
1. **α-1 大境界突破的雷劫/天劫生死关** —— 修仙里程碑必须有生死攸关
2. **α-2 因果业力双轴隐藏数值** —— karma（善恶连续） + merit（功德） + sin（杀业）

## 触发原因
详阅 `C:\Users\14262\memory\today\2026-06-30.md` §「Phase-α dev plan / α-1 / α-2」段。
简言之：遮天/完美世界/凡人修仙传的"境界质变必遭天劫"质感、凡人/诛仙/我欲封天的"善恶因果双轴"反馈，都是修仙感知的核心骨架；现有 `breakthroughHappened/breakthroughMajor` 字段缺失劫难判定，因果只在叙事没有量化。

## 范围
- **包含**：
  - `CharacterState` schema 加 4 字段（tribulationProfile / karma / merit / sin）
  - prisma schema 加 4 列 + 默认值 + 兼容旧存档
  - 引擎 `engine.ts` 加 `computeTribulationOutcome` + `applyTribulationResult` + `adjustKarma` + 接入 `tryBreakthrough` + `executeAIEvent`
  - `stateToResponse` 透传 + `dbToState` 兜底缺省
  - `llm.ts` 提示词加"心境/余韵/劫难/因果"4 类指引 + aiOutput schema `tribulationTrigger?` 与 `sinReason?` 可选字段
  - smoke-α-001/002/003/004 共 4 个新 regression smoke
- **不包含**（明确不动的范围）
  - UI 任何改动（仓 14 面板一律不动；不写"渡劫选择器/业力调节器"UI —— **AI 是注册者**核心硬约束）
  - `/e/aigame2_publish/` 不修（owner 拍板后手动同步）
  - 不写新组件、不改 page.tsx
  - 不改 breakthroughCeremony 弹窗
  - 不动 statusJson 旧 schema（character.activeStatuses 序列化保持兼容）

## owner 关注点
- **修仙沉浸**：劫难叙事必须中文修仙风味，不暴露"概率/算法/引擎/字段"机制词
- **旧档兼容**：旧角色存档缺少新增字段时，必须能正确加载 + 默认值兜底，绝不破坏既有 save
- **数据可解释**：karma/merit/sin 数值在玩家可见 UI（如轮回结算、人物志）能稳定展示，但**不**为它们新增"业力调节面板"
- **修仙平衡**：失败陨落概率不许超过 30%；首次大境界突破失败可掉一小层但不直接掉大境界
- **因果叙事**：杀业累超过阈值时，AI 提示词应让 narrative 自然出现"业火炙心/天降祥瑞"反馈，引擎层做硬约束

## 优先级
P1（phase-α 批 1 主体之一，影响修仙质感+生死平衡）
