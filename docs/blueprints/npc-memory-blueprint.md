# NPC 长期记忆蓝图（NPC Memory Blueprint）

> 本表界定游戏中"NPC 与角色的长期交互记忆"如何积累、衰减、AI 接管。
>
> **设计原则**：NPC 记忆由引擎持久化、AI 叙事化、UI 折叠展示；记忆是 NPC 行为的因果基础。

---

## 1. 数据契约

### 1.1 NPC 记忆字段

```ts
interface NpcMemoryEntry {
  npcId: string;                    // NPC 唯一 id
  npcName: string;                  // NPC 名称
  recentInteractions: Array<{       // 最近交互（最多 10 条）
    age: number;
    type: 'meeting' | 'combat' | 'trade' | 'quest' | 'favor' | 'betrayal';
    summary: string;                // 30-60 字摘要
    emotionalImpact: number;        // -100 ~ 100
  }>;
  relationshipChanges: Array<{      // 关系变化历史（最多 20 条）
    age: number;
    fromRelation: string;
    toRelation: string;
    triggerEvent: string;
  }>;
  lastSeenAge: number;              // 最后一次出场年龄
  faction: string;                  // 所属宗门（可空）
  alive: boolean;
  currentDisposition: number;       // 当前好感度 -100 ~ 100
}
```

### 1.2 字段持久化

- 存储在 `npcsJson` 字段（已有）
- 每存档最多 50 个 NPC（超出按 LRU 淘汰）
- 记忆条目按时间倒序

---

## 2. 演化规则

### 2.1 记忆触发

| 事件 | 类型 | 默认 emotionalImpact |
|------|------|------|
| 首次相遇 | meeting | +10 |
| 同门相认 | meeting | +30 |
| 战斗胜利 | combat | +20 |
| 战斗失败 | combat | -15 |
| 接受任务 | quest | +5 |
| 完成任务 | quest | +25 |
| 赠送物品 | favor | +15 |
| 背叛 | betrayal | -50 |
| 拒绝 | favor | -5 |
| 救其性命 | favor | +40 |

### 2.2 衰减规则

- 每 5 年 emotionalImpact 自动衰减 10%（朝 0 收敛）
- 记忆条目超过 10 条时，删除最旧的
- 关系变化超过 20 条时，删除最旧的

### 2.3 AI 接管

- **新 NPC 创建**：AI 据事件叙事主动提出，引擎校验去重
- **记忆更新**：AI 写"该 NPC 与角色过去的交集"，不暴露具体数值
- **NPC 行为决策**：AI 据 `currentDisposition` 决定 NPC 对角色态度，但**不暴露数字**
- **记忆展示**：UI 折叠区，玩家主动点开才显示

---

## 3. 玩家可见文案

- 「此人似乎与你有过一面之缘」
- 「他对你颇为警惕，似乎记得之前的不快」
- 「她对你满是感激，多次帮过你」
- NPC 列表界面：「江湖人物」 / 「相识」

---

## 4. Smoke 验证清单

| Smoke | 验证项 |
|------|------|
| `smokeNpcMemoryFieldsExist` | NPC 记忆字段完整 |
| `smokeNpcMemoryDecayLogic` | 衰减规则正确 |
| `smokeNpcMemoryAiPrompt` | llm.ts prompt 含 NPC 记忆指导 |

---

## 5. 边界约束

- **AI 不能改变 NPC 已固化的过往**：已入 history 的事件不可删改
- **记忆不阻塞游戏**：记忆丢失不导致游戏卡死，引擎自动降级为默认行为
- **展示世界内化**：所有 label/描述全中文，禁止内部 enum 暴露
- **隐私保护**：NPC 不知道玩家没告诉它的信息

---

## 6. 与其他蓝图的关系

- `sect-relation-blueprint.md`：NPC 关系变化可能触发宗门关系变化
- `causality-net-blueprint.md`：NPC 是因果网的"人物节点"
- `event-blueprint.md`：NPC 出现由事件触发