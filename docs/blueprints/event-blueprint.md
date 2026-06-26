# 事件蓝图（Event Blueprint）

> 本表界定游戏中"事件"分类、触发条件、因果链。AI 据此决定事件类型选择、叙事风格、因果承接。
>
> **设计原则**：事件类型由引擎路由、AI 写具体叙事；不允许引擎硬编码固定事件剧本。
>
> 维护：每次新增事件类型需同步 `src/lib/xianxia/llm.ts` 中对应 prompt 段。

| 事件类型 | 内部 key | 触发条件 | AI 接管策略 | 因果链 |
|------|------|------|------|------|
| 年度推进 | `annual` | 玩家点"推进" | AI 写当年事件链 | 承接 pendingThreads |
| 连续推进 | `advance-batch` | 玩家点多岁 | AI 压缩叙事为摘要 | 合并同年代叙事 |
| 战斗 | `combat` | 遭遇/主动挑衅/秘境陷阱 | AI 写回合叙事 | 落败/逃脱→enemy 线索 |
| 战斗后 | `post-combat` | 战斗 status !== ongoing | 引擎自动补 enemy 线索 | 见 AI-29 smoke |
| 拍卖 | `auction` | 玩家参与拍品 | AI 写竞拍场景 + aftermath | 拍得品→后续机缘 |
| 拍卖余波 | `auction-aftermath` | 拍后 1-3 岁 | AI 写余波事件 | 关联拍品 + 仇敌 |
| 秘境探索 | `exploration` | 玩家选秘境 | AI 写秘境事件链 | 探索→新线索 |
| 秘境结局 | `realm-end` | 秘境完成/退出 | AI 写结局 | 进入"已探索"列表 |
| 抉择 | `choice` | AI 给分支 | AI 写选项 + 影响 | 选项→状态变化 |
| 坊市 | `market` | 玩家逛坊市 | AI 写 NPC + 物品 | 物品→购买线索 |
| 炼丹 | `alchemy` | 玩家炼丹 | AI 写丹方 + 丹成 | 丹药→疗伤/突破 |
| 灵宠 | `pet` | 玩家召灵 | AI 写灵契事件 | 灵宠→羁绊剧情 |
| 阵法 | `formation` | 玩家布阵 | AI 写阵法效果 | 阵法→战斗加成 |
| 因果介入 | `interfere` | 玩家主动干预 | AI 评估代价 | 干预→境界/心魔 |
| 心魔试炼 | `heartDemon` | 心魔 ≥ 阈值 | AI 写试炼关卡 | 通过/失败→境界印记 |
| 突破 | `breakthrough` | 修为达上限 | AI 写破境叙事 | 破境→新境界特性 |
| 重置世界 | `reset` | 玩家重置 | AI 写新一轮开始 | 新身份+新境界 |
| 飞升 | `ascend` | 化神期满 | AI 写飞升叙事 | 飞升→结算 |
| 死亡 | `death` | 气血 ≤ 0 | AI 写陨落叙事 | 死亡→结算 |
| 结算 | `settlement` | 飞升/死亡/放弃 | 玩家选 1 继承 | 结算→新角色 |

## 因果链核心规则

- **线索承接**：年度事件必须承接 pendingThreads（详见 UI-RULES Phase 2 规则 10）
- **状态参与**：事件必须让 activeStatuses 真实参与（详见 UI-RULES Phase 2 规则 10/11）
- **回响原则**：deadlineAge 已到的线索不是建议，是必须承接
- **去重**：同年代相同事件不重复触发（dedupe by category + age）

## AI 接管要点

- **类型选择**：引擎按"今年还能做什么"给候选类型，AI 据角色状态选具体类型
- **叙事风格**：由 `styleAnchor` + `entityStore` + `rhythmVariation` 控制（见 llm.ts）
- **篇幅控制**：单事件 150-250 字，连续推进压缩为 ≤80 字/岁
- **承接约束**：禁止"上回说到/且听下回分解"等局外词（见 llm.ts AI-18）
- **标题自然**：线索 title ≤ 12 字，用具体名词开头（见 llm.ts AI-19）