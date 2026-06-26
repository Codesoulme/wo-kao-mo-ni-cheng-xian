# 世界因果网蓝图（Causality Net Blueprint）

> 本表界定游戏中"世界因果关系图"的节点/边类型、构建规则、AI 接管、可视化。
>
> **设计原则**：因果网是叙事骨架，让"远期线索"不会无因而起；由引擎持久化、AI 维护、UI 折叠展示。

---

## 1. 因果网结构

### 1.1 节点类型

| 类型 | 内部 enum | 中文 label | 数量级 |
|------|------|------|------|
| 人物 | `person` | 人物 | 50-200 |
| 地点 | `place` | 地点 | 30-80 |
| 物品 | `item` | 物品 | 50-150 |
| 线索 | `thread` | 线索 | 10-30 |
| 事件 | `event` | 事件 | 100-500 |
| 势力 | `faction` | 势力 | 30-60 |
| 概念 | `concept` | 概念 | 5-20 |

### 1.2 边类型

| 类型 | 内部 enum | 中文 label | 含义 |
|------|------|------|------|
| 因 | `cause` | 因 | A 导致 B |
| 果 | `effect` | 果 | A 引出 B |
| 相关 | `related` | 相关 | A 与 B 有关 |
| 对立 | `oppose` | 对立 | A 与 B 对立 |
| 所属 | `belongs` | 所属 | A 属于 B |
| 创造 | `created` | 创造 | A 创造 B |
| 破坏 | `destroyed` | 破坏 | A 毁坏 B |

---

## 2. 数据契约

```ts
interface CausalityNode {
  id: string;
  type: NodeType;
  name: string;
  firstAppearanceAge: number;
  lastReferenceAge: number;
  referenceCount: number;        // 引用次数
  attributes: Record<string, unknown>;
  importance: number;             // 0-100 (AI 评估)
}

interface CausalityEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: EdgeType;
  strength: number;               // 0-100 (强度)
  age: number;                    // 关系建立年龄
  reason: string;                 // 关系原因
  expiresAge?: number;            // 过期时间
}

interface CausalityGraph {
  nodes: CausalityNode[];
  edges: CausalityEdge[];
  version: number;                // 数据版本
}
```

---

## 3. 演化规则

### 3.1 节点添加

- AI 在事件叙事中主动提出"此事涉及某人/某地/某物"
- 引擎校验唯一性（同 id 不重复）
- 节点数 > 1000 时按 LRU + importance 淘汰

### 3.2 边添加

- AI 主动建立因果关联
- 引擎校验：节点存在、边类型合法、strength ∈ [0, 100]
- 同 pair 一年最多 1 条边（反重复）

### 3.3 边衰减

- 边 strength 每 10 年衰减 5%
- strength < 5 时边删除

### 3.4 AI 接管

- **节点创建**：AI 据事件叙事
- **边创建**：AI 据叙事中"A 导致 B"主动建立
- **边叙事化**：AI 写"X 是因为 Y"，不暴露图结构
- **因果回响**：AI 据图写"前世因今生果"的远期叙事

---

## 4. 玩家可见行为

### 4.1 因果图查看

- 入口：「此世因果」「命途之网」「缘起缘灭」
- 折叠展示：默认显示最近 30 个节点 + 50 条边
- 展开：可放大缩小、按类型筛选

### 4.2 因果提示

- AI 主动揭示：「此人曾在某事件中与你结怨」
- 玩家主动查询：「此仇因何而起」→ 引擎据图回溯

### 4.3 因果干预

- 玩家可通过「因果介入」指令改写某条边
- AI 评估后果并写叙事

---

## 5. 持久化

- 已有 `causalGraphJson` 字段（lite 版）
- 本蓝图定义的是扩展版（节点数 / 边数翻倍）
- 升级路径：旧版自动迁移到新版结构

---

## 6. 玩家可见文案

- 节点类型标签：`NODE_TYPE_LABEL`（display.ts）
- 边类型标签：`EDGE_TYPE_LABEL`（display.ts）
- 因果提示：「因 X 故」「以 X 为果」

---

## 7. Smoke 验证清单

| Smoke | 验证项 |
|------|------|
| `smokeCausalityNetNodeTypes` | 7 种节点类型完整 |
| `smokeCausalityNetEdgeTypes` | 7 种边类型完整 |
| `smokeCausalityNetStrengthClamp` | 强度边界约束 |
| `smokeCausalityNetBlueprint` | 蓝图文档完整 |

---

## 8. 边界约束

- **节点唯一性**：id 不可重复
- **边合法性**：from/to 必须存在
- **因果不可凭空**：每条边必须有 reason 字段
- **展示世界内化**：标签/描述全中文
- **持久化兼容**：旧版 causalGraphJson 自动迁移

---

## 9. 与其他蓝图的关系

- `event-blueprint.md`：事件是因果网的"主节点"
- `npc-memory-blueprint.md`：NPC 是因果网的"人物节点"
- `sect-relation-blueprint.md`：宗门关系是"势力节点"边
- `inheritance-blueprint.md`：传承是"跨角色"因果边