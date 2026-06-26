# 状态蓝图（Status Blueprint）

> 本表界定游戏中"角色身上的状态"分类、生命周期、玩家可见性。AI 据此决定哪些状态参与事件、哪些隐藏、哪些需要折叠展示。
>
> **设计原则**：状态由引擎持久化、AI 命名与叙事化；UI 由 `display.ts` 统一映射。
>
> 维护：每次新增状态需同步 `src/lib/xianxia/display.ts` 中 `ATTRIBUTE_LABEL` 与 `REALM_SECTION_LABELS`/`IDENTITY_SECTION_LABELS`。

| 状态分类 | 内部 key | 玩家可见字段 | AI 接管策略 | 隐藏条件 |
|------|------|------|------|------|
| 修炼类 | `cultivationStatuses` | 当前境界、心境、瓶颈 | AI 写修炼感悟 | 修为为 0 |
| 伤患类 | `injuries` | 内伤/外伤/中毒 | AI 决定伤势进展 | 已治愈 |
| 心魔类 | `heartDemon` | 心魔值 + 试炼名 | AI 写心魔事件 | 心魔 = 0 |
| 关系类 | `relationships` | 师徒/道侣/仇敌 | AI 决定关系变化 | 关系值 = 0 |
| 承诺类 | `promises` | 约期/誓言 | AI 决定践诺/破誓 | 已兑现 |
| 境界印记类 | `realmTraits` | 特性名 + 效果 | AI 写特性叙事 | 无特性 |
| 命格类 | `fateNodes` | 命格名 + 触发 | AI 写命格事件 | 命格无激活 |
| 任务类 | `questEntries` | 任务名 + 进度 | AI 推进/失败 | 已完成 |
| 线索类 | `pendingThreads` | 标题 + 剩余年限 | AI 推进/了断 | 已结清 |
| 装备类 | `equipped` | 法宝名 + 加成 | AI 决定掉落/升级 | 未装备 |
| 储物类 | `inventory` | 物品名 + 数量 | AI 决定获得/消耗 | 空储物 |
| 灵宠类 | `pets` | 灵宠名 + 羁绊 | AI 写灵契事件 | 无灵宠 |
| 阵法类 | `activeFormation` | 阵名 + 状态 | AI 写阵法效果 | 未激活 |
| 长期记忆类 | `longTermMemory` | （隐藏内部用） | AI 维护记忆压缩 | N/A |

## 玩家可见性规则

参考 `docs/UI-RULES.md` 规则 2-3：
- **顶部状态（最近获得）**：仅显示 ≤3 项新状态 + ≤2 项关键时刻
- **角色页（折叠区）**：可展开显示所有有意义的状态
- **史册（默认折叠）**：最近事件默认展开，更早事件折叠

## AI 接管要点

- 状态的"何时获得""何时消失"由引擎根据叙事因果判定，AI 不能凭空新增或删除
- 状态的"玩家可见文案"由 `display.ts` sanitize 函数清洗（去掉元数据、内部 key）
- 状态的"参与事件"由 `llm.ts` 的"【当前状态必须参与事件】"段强制约束（见 UI-RULES Phase 2）