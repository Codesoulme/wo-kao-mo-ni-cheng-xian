# 宗门关系蓝图（Sect Relation Blueprint）

> 本表界定游戏中"宗门之间的关系"分类、强度、演化、AI 接管策略。
>
> **设计原则**：宗门关系由引擎持久化、AI 命名与叙事化；强度变化由事件驱动，不由公式计算。
>
> **当前状态**：P2 实现阶段（schema 已留口，label/smoke 已落地）。

---

## 1. 数据契约

### 1.1 关系枚举

| 关系 | 内部 enum | 中文 label | 玩家可见颜色 | intensity 范围 |
|------|------|------|------|------|
| 同门 | `ally` | 同门/盟友 | 翠绿 `#2f8f5b` | 60-100 |
| 友善 | `friendly` | 友善 | 浅绿 `#5cb985` | 30-60 |
| 中立 | `neutral` | 中立 | 灰 `#888` | 0-30 |
| 冷淡 | `cold` | 冷淡 | 浅灰 `#aaa` | 0-(-30) |
| 对立 | `rival` | 对立 | 橙 `#e8a04c` | (-30)-(-60) |
| 仇敌 | `enemy` | 仇敌 | 红 `#c8453c` | (-60)-(-100) |

### 1.2 字段

```ts
interface SectRelation {
  sectA: string;           // 宗门 A 名
  sectB: string;           // 宗门 B 名
  relation: RelationEnum;  // ally/friendly/neutral/cold/rival/enemy
  intensity: number;       // -100 ~ 100
  causeHistory: Array<{    // 历史原因（最多 5 条）
    age: number;
    reason: string;
    deltaIntensity: number;
  }>;
  lastUpdatedAge: number;
  mutualFriendship: number;  // 互惠好感度（AI 据事件评估）
}
```

---

## 2. 演化规则

### 2.1 触发条件

| 事件 | 影响 | 默认 delta |
|------|------|------|
| 同门联合作战 | ally intensity +5 | +5 |
| 资源争夺 | friendly → cold | -10 |
| 弟子冲突 | cold → rival | -15 |
| 宗门大战 | rival → enemy | -30 |
| 共同抵御外敌 | rival → neutral | +20 |
| 联姻/结盟 | neutral → friendly | +25 |
| 叛徒事件 | friendly → enemy | -40 |

### 2.2 AI 接管

- 关系**变动判定**由 AI 在事件叙事时主动提出，引擎校验边界（intensity ∈ [-100, 100]）
- 关系**叙事化**由 AI 写"某宗门对此宗门的态度如何"，不暴露数字
- 关系**展示**：UI 折叠区显示，玩家可点开看完整关系网

### 2.3 反重复

- 同 pair 一年内不得触发超过 1 次关系变化（避免 AI 一回合多次切换）
- intensity 变化 < 5 时不写入 history（噪音过滤）

---

## 3. 玩家可见文案

- 关系类型 label：用 `SECT_RELATION_LABEL` 表（display.ts）
- 关系变化提示：「青云门与万剑宗之间的关系从『中立』变为『冷淡』」
- 关系网界面：「江湖关系」 / 「势力分布」

---

## 4. Smoke 验证清单

| Smoke | 验证项 |
|------|------|
| `smokeSectRelationLabelsMapping` | SECT_RELATION_LABEL 6 项映射正确 |
| `smokeSectRelationIntensityRange` | intensity 边界约束 ∈ [-100, 100] |
| `smokeSectRelationAiTakeoverPrompt` | llm.ts prompt 包含宗门关系指导 |

---

## 5. 边界约束

- **AI 不能凭空创建宗门**：宗门由 setup/worldFacts 提供列表，AI 只演化关系
- **强度变化必须伴随事件**：无事件的 intensity 漂移禁止
- **展示世界内化**：label/描述全中文，禁止 enum 值暴露给玩家
- **持久化**：JSON 字段 `sectRelationsJson`，单存档最多 100 条

---

## 6. 与其他蓝图的关系

- `npc-memory-blueprint.md`：宗门关系变化时，NPC 记忆同步更新
- `causality-net-blueprint.md`：宗门关系是因果网的"节点关系边"
- `event-blueprint.md`：宗门战 / 外交事件触发关系变化