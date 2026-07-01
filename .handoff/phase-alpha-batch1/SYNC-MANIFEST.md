# Phase-α 批 1 SYNC-MANIFEST（修仙感 publish ← aigame2 主仓）

## 范围
修仙沉浸钩子 batch 1 在 aigame2 主仓实现后，publish 仓需同步：
1. **数据/类型透传**：spiritGarden / awakeningStage / tribulationProfile 等修仙沉浸字段
2. **LLM 提示词**：修仙感 narrative 风格在 llm.ts 的 prompt 中体现
3. **不修 UI**：修仙感 design-core "AI 是注册者" — 不写"渡劫选择器/业力调节器/灵田编辑器"等 UI

## 主仓状态（修仙沉浸钩子 batch 1）

| Worker | α 编号 | 修仙沉浸钩子 | aigame2 主仓 | smoke |
| --- | --- | --- | --- | --- |
| worker-1 | α-1 + α-2 | 雷劫/天劫生死关 + 因果业力双轴 | ✅ 实现（types.ts tribulationProfile + engine.ts computeTribulationOutcome/adjustKarma） | ✅ alpha-001~004 全 pass |
| worker-2 | α-4 | 功法三段（经/诀/神通） | ✅ 实现（types.ts AwakeningStage 三阶段 practiced/awakened/transcendent） | ✅ alpha-005 经/诀/神通三段叙事 |
| worker-3 | α-5 | 法宝养灵 / 器灵觉醒 | ✅ 实现（types.ts nurtureProgress/awakeningStage/sentientName） | ✅ alpha-007 未启/初醒/启智 |
| worker-4 | α-7 | 灵田 / 灵植 / 24 节气物候 | ✅ 实现（types.ts spiritGarden.zones[]） | ✅ alpha-008 立春/惊蛰/谷雨/芒种/秋分/霜降/大寒 |

## publish 仓同步状态

### 已完成（修仙沉浸钩子 batch 1）
- ✅ 5 面板减法（page.tsx 删 EndingPanel/YinyuanTimelinePanel/TechniqueCreatorPanel/PetPanel/FormationPanel 引用）
- ✅ 自创功法（TechniqueCreatorPanel.tsx + custom-technique.ts）删除 — "UI 不可管理 AI 输出"
- ✅ 连推流式修复（ActionButtons.tsx 逐条 450ms 流式浮现）
- ⏳ worker-1~4 修仙沉浸钩子 narrative 集成（修仙感 publish llm.ts 待修仙沉浸钩子验证）

### 待办
1. publish 仓跑 alpha-001~008 smoke 验证修仙沉浸钩子 narrative 在 publish 端能正确产出
2. publish 仓 llm.ts 修仙沉浸钩子 prompt 校验（不出现"渡劫选择器/业力调节器/灵田编辑器"等 UI 违规词）
3. publish 仓修仙沉浸钩子 UI 检查：灵田/器灵/因果/劫难的展示面板是否存在"调节按钮"——若有违规，按修仙感 design-core 立刻减掉

## 修仙感 design-core 硬约束
- "UI 不可管理 AI 输出"：玩家不应通过面板主动制造修仙沉浸钩子触发条件
- "AI 是注册者"：修仙沉浸钩子（劫难/因果/器灵/灵田）由 LLM 在 narrative 自然产出，引擎落定状态
- 修仙感平衡：劫难失败陨落概率 ≤30%，首次大境界失败可掉一小层但不直接掉大境界

## 版本
修仙感 publish：V0.053 → V0.054（待修仙沉浸钩子同步验证后）
修仙感 aigame2 主仓：修仙沉浸钩子 batch 1 全 pass