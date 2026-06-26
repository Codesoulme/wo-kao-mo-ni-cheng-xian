# 世界地图蓝图（World Map Blueprint）

> 本表界定游戏中"世界地图"的数据契约、地形分类、AI 接管、玩家可见行为。
>
> **设计原则**：地图数据静态（boundary 提供），AI 决定"角色能去哪 + 哪遇什么"。

---

## 1. 数据契约

### 1.1 地理要素

| 类型 | 内部 key | 玩家可见名 | 数量级 |
|------|------|------|------|
| 山脉 | `mountain` | 山脉 | 10-30 |
| 河流 | `river` | 河流 | 5-15 |
| 森林 | `forest` | 森林 | 15-30 |
| 荒漠 | `desert` | 荒漠 | 3-10 |
| 海洋 | `sea` | 海洋 | 1-3 |
| 城邦 | `city` | 城邦 | 20-50 |
| 宗门所在地 | `sectBase` | 宗门山门 | 30-60 |
| 秘境 | `secretRealm` | 秘境 | 10-20 |
| 古战场 | `ancientBattlefield` | 古战场 | 3-8 |
| 凡间 | `mortalLand` | 凡间 | 区域若干 |

### 1.2 地图状态字段

```ts
interface WorldMap {
  regions: Array<{
    id: string;
    name: string;
    type: RegionType;
    faction?: string;              // 所属宗门（仅宗门山门）
    dangerLevel: number;           // 0-10
    discoveryAge?: number;         // 玩家发现的年龄（未发现为 undefined）
    visitedCount: number;          // 玩家到访次数
    lastVisitAge?: number;
    reputationRequired?: number;   // 声望门槛
    riskDescription?: string;      // AI 写
  }>;
  paths: Array<{                  // 道路
    from: string;
    to: string;
    travelDays: number;
    dangerMultiplier: number;
  }>;
  scale: {                         // 地图规模
    width: number;
    height: number;
  };
}
```

---

## 2. 探索规则

### 2.1 可见性

| 状态 | 玩家可见 |
|------|------|
| 未发现 | 仅显示"传闻"模糊标记 |
| 已发现 | 显示区域名 + 危险等级 |
| 已访问 | 显示详细描述 + 关联线索 |

### 2.2 触发条件

- 玩家所在城市/宗门 → 邻近 3-5 个区域可选
- 听 NPC 提起 → 1 个新区域进入"传闻"
- 完成任务 → 1 个区域进入"已发现"
- 探索秘境 → 自动入"已访问"

### 2.3 AI 接管

- **新区域创建**：AI 据事件叙事主动提出"某处有古怪"，引擎校验唯一性
- **区域描述**：AI 写"该地有何物、可遇何人"，不暴露具体参数
- **NPC 关联**：AI 决定某 NPC 在某地出场
- **秘境动态**：AI 决定秘境是否解锁/关闭/冷却

### 2.4 反重复

- 同一区域一年内不得重复"传闻"（避免 AI 反复刷同一地）
- 已访问区域不重复"发现"提示

---

## 3. 玩家可见文案

- 地图界面：「此方天地」 / 「山河图」 / 「寻幽探胜」
- 区域状态：「传闻」「已显」「已至」「了无痕迹」
- 区域类型标签：`LOCATION_TYPE_LABEL`（display.ts）

---

## 4. Smoke 验证清单

| Smoke | 验证项 |
|------|------|
| `smokeWorldMapRegionsData` | 地图数据字段完整 |
| `smokeWorldMapDiscoveryVisibility` | 可见性规则正确 |
| `smokeWorldMapBlueprint` | 蓝图文档完整 |

---

## 5. 边界约束

- **AI 不能凭空新增区域**：地图区域由 setup 提供基础列表，AI 仅动态解锁
- **距离计算不可绕过**：travelDays = 路程天数，按玩家角色状态调整
- **展示世界内化**：标签/描述全中文
- **持久化**：地图状态存在 `worldFactsJson` 中（轻量化）

---

## 6. 与其他蓝图的关系

- `exploration-blueprint.md`（未来）：探索系统消费地图数据
- `sect-relation-blueprint.md`：宗门山门与宗门关系联动
- `causality-net-blueprint.md`：地图区域是因果网的"地点节点"