# 合成与炼制蓝图（Crafting Blueprint）

> 本表界定游戏中"物品合成 / 丹药炼制 / 功法学习"的统一机制、数据契约、AI 接管策略。
>
> **设计原则**：合成/炼制是"消耗材料 → 产出物品"的玩家主动行为；AI 决定产出品质与副作用。

---

## 1. 系统分类

| 子系统 | 内部 key | 输入 | 输出 | 失败处理 |
|------|------|------|------|------|
| 物品合成 | `crafting` | 多个物品 | 新物品 | 材料消耗，无产出 |
| 丹药炼制 | `alchemy` | 灵草 + 丹方 | 丹药 | 材料消耗 + 丹炉损耗 |
| 阵法排布 | `formation` | 阵旗 + 阵图 | 激活阵法 | 材料消耗 |
| 功法学习 | `techniqueLearning` | 功法书 + 悟性 | 习得功法 | 失败退步/走火 |
| 法宝祭炼 | `artifactForging` | 材料 + 法宝胚胎 | 进阶法宝 | 失败材料浪费 |

---

## 2. 数据契约

### 2.1 配方字段

```ts
interface CraftingRecipe {
  id: string;                       // 配方 id
  name: string;                     // 配方名（中文）
  type: 'crafting' | 'alchemy' | 'formation' | 'techniqueLearning' | 'artifactForging';
  inputs: Array<{                   // 输入材料
    itemId: string;
    quantity: number;
  }>;
  output: {
    itemId?: string;                // 产出物品 id（techniqueLearning 不用）
    techniqueId?: string;           // 产出功法 id
    quantity: number;
    minQuality: QualityTier;        // 最低品质
    maxQuality: QualityTier;        // 最高品质
  };
  requiredRealm: RealmEnum;         // 境界门槛
  difficulty: number;               // 难度 0-100
  luckFactor: number;               // 气运加成权重 0-1
  failureConsequence?: string;      // 失败后果
}
```

### 2.2 品质等级

| 品质 | 中文 label | 概率（无气运） | 概率（高气运） |
|------|------|------|------|
| 凡品 | 凡品 | 60% | 30% |
| 良品 | 良品 | 25% | 30% |
| 上品 | 上品 | 10% | 25% |
| 极品 | 极品 | 4% | 12% |
| 绝品 | 绝品 | 1% | 3% |

---

## 3. AI 接管

### 3.1 产出判定

- **基础产出**：引擎据配方 + 玩家属性生成候选结果
- **AI 接管**：AI 据"此刻意境"决定：
  - 品质微调（如：高悟性 + 高心魔 → 绝品但带心魔反噬）
  - 副作用（如：炼丹走火入魔 → 灵根受损）
  - 隐藏产出（如：炼丹时偶然得一缕先天灵气）

### 3.2 叙事化

- AI 写炼制过程叙事（50-150 字）
- AI 写成功/失败的"灵机"感受
- 禁止"系统提示"等局外词

### 3.3 反重复

- 同配方 30 岁内不得触发相同隐藏产出
- 玩家已知的隐藏产出 → 不再触发
- 同配方连续失败 3 次 → 强制成功（避免玩家卡死）

---

## 4. 玩家可见文案

- 入口：「开炉」「祭炼」「布阵」「习法」
- 品质标识：「凡」「良」「上」「极」「绝」
- 失败提示：「灵机未通」「炼废」「走火」
- 副作用：「此丹带魔」「灵根受损」

---

## 5. Smoke 验证清单

| Smoke | 验证项 |
|------|------|
| `smokeCraftingRecipeSchema` | 配方数据契约完整 |
| `smokeCraftingQualityTierDistribution` | 品质概率分布合理 |
| `smokeCraftingFailureConsequence` | 失败处理路径 |
| `smokeCraftingBlueprint` | 蓝图文档完整 |

---

## 6. 边界约束

- **AI 不能凭空创造配方**：配方由 setup 提供，AI 仅在合成结果上加工
- **失败不能卡死玩家**：失败必有兜底（如材料半价回收）
- **品质不能越界**：maxQuality 不可突破
- **展示世界内化**：标签/描述全中文
- **持久化**：玩家已习得功法 + 炼制历史存 `memoryJson`

---

## 7. 与其他蓝图的关系

- `event-blueprint.md`：炼丹/炼器事件由事件系统触发
- `value-blueprint.md`：合成/炼制是"习得功法 / 获得法宝"的实现路径
- `npc-memory-blueprint.md`：NPC 可作为炼制的"助手 / 师父"