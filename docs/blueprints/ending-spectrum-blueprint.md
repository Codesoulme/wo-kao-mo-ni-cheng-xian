# 结局谱系蓝图（Ending Spectrum Blueprint）

> 本表界定游戏中"角色结局"的分类、触发条件、AI 叙事、世界影响。
>
> **设计原则**：结局是"角色一生的句号"，由玩家决策 + 世界事件 + AI 评估共同决定；不是单一结局树，而是连续谱。

---

## 1. 结局分类

### 1.1 主类（必触发）

| 结局 | 内部 enum | 中文 label | 触发条件 |
|------|------|------|------|
| 飞升 | `ascension` | 飞升 | 化神期满 + 渡过天劫 |
| 飞升失败 | `failedAscension` | 飞升失败 | 化神期满 + 未渡天劫 |
| 圆满 | `grandPerfection` | 圆满 | 寿终正寝 + 心愿皆了 |
| 战死 | `combatDeath` | 战死 | 战斗气血 ≤ 0 |
| 走火 | `qiDeviation` | 走火入魔 | 心魔 ≥ 90 + 修炼失误 |
| 老死 | `naturalDeath` | 老死 | 寿元耗尽 |
| 放弃 | `abandon` | 放弃 | 玩家主动 |

### 1.2 谱系（按因分）

| 结局类型 | 因 | 谱系 |
|------|------|------|
| 因修为 | 化神期/渡劫 | 飞升 / 飞升失败 |
| 因寿元 | 自然衰老 | 老死 |
| 因战斗 | 战斗失败 | 战死 |
| 因心境 | 心魔失控 | 走火 |
| 因选择 | 玩家决定 | 放弃 / 圆满 |
| 因传承 | 角色自决 | 圆满（带传承） |

---

## 2. 数据契约

```ts
interface CharacterEnding {
  characterId: string;
  endingType: EndingType;
  deathAge: number;
  finalRealm: RealmEnum;
  causeOfDeath?: string;             // AI 写
  finalReflection?: string;          // AI 写遗言/反思
  achievements: string[];            // 一生成就
  unfulfilled: string[];             // 终生未了之事
  inheritancesOffered: InheritanceChoice[];
  worldAftermath: string;            // AI 写"此人去后，世界如何"
  finalReputation: number;
  finalRelationships: Array<{        // 临终关系
    npcName: string;
    relation: string;
    note: string;
  }>;
}
```

---

## 3. AI 接管

### 3.1 结局判定

- 引擎据"修为 / 寿元 / 心魔 / 战斗结果"判断候选结局
- AI 评估"哪种结局最契合此角色"，从候选中选 1
- 玩家在放弃/老死时可选"具体方式"

### 3.2 结局叙事

- **主叙事**（100-200 字）：AI 写"此身终局"
- **遗言**（30-50 字）：AI 据角色性格写临终之言
- **后人评**（50-100 字）：AI 写"江湖如何评此身"

### 3.3 结局影响世界

- 宗门兴衰（宗门失去核心人物）
- NPC 命运（与角色关系深的 NPC）
- 因果网（关键节点的最后状态）
- 传承候选（见 inheritance-blueprint）

---

## 4. 结局谱系图

```
                    ┌─ 化神期满 ─┬─ 渡劫成 ─→ 【飞升】
                    │             └─ 渡劫败 ─→ 【飞升失败】
                    │
                    ├─ 寿元将尽 ─┬─ 心愿了 ─→ 【圆满】
【角色结局】         │             └─ 心愿未了 → 【老死】
                    │
                    ├─ 战斗中 ──→ 气血尽 ─→ 【战死】
                    │
                    ├─ 修炼中 ──→ 心魔爆 ─→ 【走火入魔】
                    │
                    └─ 玩家主动 ──┬─ 传承 ─→ 【圆满】
                                   └─ 中断 ─→ 【放弃】
```

---

## 5. 玩家可见文案

- 结局标题：「飞升」「飞升失败」「圆满」「战死」「走火入魔」「老死」「放弃」
- 结局界面：「此身证道」「此身陨落」「此身圆寂」
- 遗言显示：「临终遗言」/「最后之言」/「所留」
- 后人评：「江湖评此身」

---

## 6. Smoke 验证清单

| Smoke | 验证项 |
|------|------|
| `smokeEndingMainTypes` | 7 种主类结局 |
| `smokeEndingTriggerConditions` | 触发条件与枚举映射 |
| `smokeEndingAiReflection` | AI 写遗言/反思 |
| `smokeEndingBlueprint` | 蓝图文档完整 |

---

## 7. 边界约束

- **结局唯一性**：一个角色只能有 1 个结局
- **结局不可逆**：触发后不可改
- **AI 不能凭空创造新结局类型**：必须从 7 种主类中选
- **结局必伴随传承**：放弃/老死/战死/走火/飞升失败都触发传承界面
- **展示世界内化**：标签/描述全中文

---

## 8. 与其他蓝图的关系

- `inheritance-blueprint.md`：结局触发传承
- `save-load-blueprint.md`：结局写入存档
- `event-blueprint.md`：结局事件是事件系统的最终事件
- `sect-relation-blueprint.md`：角色死亡影响宗门关系