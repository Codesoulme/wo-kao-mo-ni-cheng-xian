# 家族/宗门兴衰蓝图（Clan/Sect Rise & Fall Blueprint）

> 本表界定游戏中"家族与宗门的兴衰"如何由玩家行为和世界事件驱动模拟。
>
> **设计原则**：兴衰不由公式计算，由"关键人物 + 关键事件"驱动；玩家可主动参与或被动见证。

---

## 1. 兴衰状态机

### 1.1 状态枚举

| 状态 | 内部 enum | 中文 label | 特征 |
|------|------|------|------|
| 初创 | `founding` | 初创 | 1-3 个核心人物 |
| 兴起 | `rising` | 兴起 | 招贤纳士 |
| 鼎盛 | `flourishing` | 鼎盛 | 势力庞大 |
| 守成 | `stable` | 守成 | 维持现状 |
| 内忧 | `unrest` | 内忧 | 派系斗争 |
| 外患 | `underSiege` | 外患 | 被外敌围攻 |
| 衰败 | `declining` | 衰败 | 人物凋零 |
| 复兴 | `revival` | 复兴 | 改革图强 |
| 灭门 | `extinct` | 灭门 | 已消亡 |

### 1.2 状态转移规则

- 5 段式生命周期：founding → rising → flourishing → stable → declining → (extinct | revival)
- 不可越级（不能从 founding 直接跳到 flourishing）
- 进入 declining 5 年后若未触发 revival → extinct

---

## 2. 兴衰因子

### 2.1 关键人物

| 角色 | 影响 |
|------|------|
| 宗主/族长 | 决策者，决定宗门走向 |
| 长老 | 派系力量，影响内部稳定 |
| 核心弟子 | 实力担当，外战主力 |
| 叛徒 | 削弱势力，可能引发分裂 |
| 故友 | 外援，影响外交关系 |

### 2.2 关键事件

| 事件类型 | 兴衰影响 |
|------|------|
| 宗主突破 | +10 势力值 |
| 长老陨落 | -15 势力值 |
| 收徒成功 | +5 势力值 |
| 弟子叛逃 | -10 势力值 |
| 战胜敌对势力 | +20 势力值 |
| 被敌对势力击败 | -20 势力值 |
| 内部派系斗争 | -5 ~ -15 势力值 |
| 发现秘境/资源 | +15 势力值 |

### 2.3 AI 接管

- **兴衰判定**：AI 据事件叙事主动评估，引擎校验边界
- **叙事化**：AI 写"此宗门何以鼎盛 / 何以衰败"，不暴露数值
- **状态转移**：AI 触发，引擎按规则校验合法性
- **灭绝叙事**：extinct 状态时 AI 写"最后一战"叙事

---

## 3. 玩家参与

### 3.1 玩家可为

- 加入宗门 → 提升所在宗门势力
- 叛出 → 削弱原宗门
- 援助 → 临时 + 势力
- 救难 → 防止宗门衰败
- 引发内战 → 加速衰败

### 3.2 玩家不可为

- 直接控制其他宗门
- 凭空创建宗门
- 让已 extinct 宗门复活（除非继承传承）

---

## 4. 数据契约

```ts
interface SectState {
  sectId: string;
  name: string;
  status: SectStatus;
  power: number;                    // 0-100 综合势力
  foundingAge: number;
  leaderNpcId?: string;             // 宗主 NPC
  elderNpcIds: string[];            // 长老 NPC
  coreDiscipleNpcIds: string[];     // 核心弟子 NPC
  alliances: string[];              // 同盟宗门
  enemies: string[];                // 敌对宗门
  resources: {
    spiritStones: number;
    territories: string[];
    secretRealms: string[];
  };
  reputationRequired: number;       // 加入门槛
  lastPowerChangeAge: number;
  historyEvents: Array<{            // 历史事件（最多 50 条）
    age: number;
    type: string;
    description: string;
    powerDelta: number;
  }>;
}
```

---

## 5. 玩家可见文案

- 状态标识：「初创」「兴起」「鼎盛」「守成」「内忧」「外患」「衰败」「复兴」「灭门」
- 界面：「江湖大势」 / 「势力兴衰」 / 「山门录」
- 叙事：「青云门这三十年间，由初创而至鼎盛，弟子万千」
- 灭绝：「青云门已灭，只余残卷传于后人」

---

## 6. Smoke 验证清单

| Smoke | 验证项 |
|------|------|
| `smokeClanSectStatusEnum` | 9 种状态枚举完整 |
| `smokeClanSectLifecyclePath` | 生命周期路径合法 |
| `smokeClanSectBlueprint` | 蓝图文档完整 |

---

## 7. 边界约束

- **状态转移合法性**：引擎校验生命周期顺序，AI 不能跳级
- **灭绝不可逆**：extinct 不可改回 flourishing（除非新角色传承重生）
- **玩家不直接控制**：玩家只能影响兴衰因子
- **展示世界内化**：标签/描述全中文
- **持久化**：SectState 存 `worldFactsJson` 或独立 `sectStatesJson`

---

## 8. 与其他蓝图的关系

- `sect-relation-blueprint.md`：宗门关系影响兴衰
- `npc-memory-blueprint.md`：NPC 关系变化是兴衰因子
- `inheritance-blueprint.md`：宗门灭绝后，传承给新角色的是"前宗门记忆"