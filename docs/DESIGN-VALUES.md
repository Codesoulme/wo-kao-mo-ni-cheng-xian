# 《我靠模拟成仙》数值设计文档（DESIGN-VALUES）

> 文档版本：v0.1
> 状态：phase-g 设计细化稿（第一版）
> 适用：`src/lib/xianxia/engine.ts` / `display.ts` / `event-scheduler.ts` 数值归算与边界
> 维护原则：本文档只规定**可由引擎复算、可校验的硬数值边界**。AI 负责生成叙事与合理内的弹性，引擎负责按本表兜底；冲突时以引擎为准。
> 关联文档：
> - `docs/DESIGN.md` §3 / §4.6 / §4.8（核心循环、修炼速度、战斗）
> - `docs/blueprints/value-blueprint.md`（价值取向，不是数值公式）
> - `docs/blueprints/event-blueprint.md`（事件类型路由，不是数值边界）
> - `docs/baseline/technical-design-v1.0-2026-06-17.txt`（数值原始基准）

---

## 0. 文档约定

- **倍率（% / 倍）**：默认 `1.0 = 100%`，写作 `+X%` 表示在该来源上叠加 `1 + X/100`。
- **边界（floor / cap）**：所有百分比结果都会经 `clamp(下限, 上限)`。
- **示例输入**：示例中所有属性名取自 `src/lib/xianxia/types.ts`：`realm` / `level` / `cultivationExp` / `attack` / `defense` / `luck` / `comprehension` / `heartDemon` / `spiritualRoot` / `status` / `equipment` / `faction` / `pendingThread.weight`。
- **现实化校验**：公式所有乘子最终落到结果上后，必须再走一次 `sanitize`（去掉暴露字段、清洗玩家可见文案）。

---

## 1. 修炼速度倍率（cultivationSpeed）

### 1.1 公式

```
finalSpeed = base
           × (1 + sum(techniqueBonus%))    // 功法加成（可叠加多门）
           × (1 + spiritualRootBonus%)     // 灵根加成
           × (1 + equipmentBonus%)         // 装备加成
           × (1 + statusBonus%)            // 状态加成（增益为正、减益为负）
           × heartDemonPenalty             // 心魔惩罚（非加和）
           × realmLevelBonus               // 境界小层级加成（与境界 idx 挂钩）
           × factionMultiplier             // 宗门加成（身份字段校验）
```

合成后：`finalSpeed = clamp(finalSpeed, 0.05, 5.0)`（下限 5% 保底玩家不会因极端减益"完全无法修炼"，上限 500% 保底数值不溢出）。

### 1.2 来源细则

| 来源（source key） | 默认值 | 边界 | 备注 |
|---|---|---|---|
| `base` | 1.0 | 不变 | 玩家未装备任何功法/状态时的基准 |
| `techniqueBonus` | 单门 +5% ~ +60% | 单门 clamp(0%, +60%)；总功法 clamp(0%, +120%) | 来自 `techniqueAffinity` 字段；只有 `scripture` 装备槽生效 |
| `spiritualRootBonus` | 天灵根 +25%；单灵根 +15%；双灵根 +5%；杂灵根 0%；异灵根 -10% | clamp(-15%, +30%) | 来自 `spiritualRoot` 枚举 |
| `equipmentBonus` | 单件 +1% ~ +15% | 单件 clamp(0%, +15%)；总装备 clamp(0%, +40%) | 含灵宠被动加成（按被动 trait 计算） |
| `statusBonus` | 增益 +10% ~ +50%；减益 -5% ~ -30% | 总状态 clamp(-50%, +80%) | 与 `status.category` 一一对应（见 DESIGN-STATUSES.md） |
| `heartDemonPenalty` | 0~29 → 1.0；30~59 → 0.85；60~89 → 0.65；≥90 → 0.4 | step 函数 | 心魔越高修炼越慢；非加和，与百分比加成分开乘 |
| `realmLevelBonus` | `level × 0.5%` | clamp(0%, +8%) | 仅对小层级生效（凡人不算、炼气 1 层起算） |
| `factionMultiplier` | 内门 1.05；外门 1.02；记名 1.0；散修 0.95；宗门弃徒 0.85 | clamp(0.7, 1.2) | 来自 `faction.identity` 校验 |

### 1.3 边界说明

- 同一来源内部按**加和**合并；不同来源之间按**乘积**合并。
- 心魔惩罚是 step 函数，不是线性，避免心魔 1 点就减 50%。
- 上限 5.0 / 下限 0.05 是为了防止"传说道具 ×10"、"重伤 -99%"等破坏沉浸的极端。
- 玩家可见 UI 上不展示"乘以 5 倍"这种机械表达，而是按 `display.ts` 显示"修炼进境神速""近乎停滞"等世界内语言。

### 1.4 示例

输入：
- 灵根：单灵根（+15%）
- 功法：1 本黄阶上品功法（+30%）
- 装备：1 件聚灵佩（+8%）
- 状态：「灵台澄澈」增益（+20%）
- 心魔：42 → 0.85
- 境界：炼气三层 → +1.5%
- 身份：内门弟子 → 1.05

计算：
```
finalSpeed = 1.0
           × (1 + 0.30)
           × (1 + 0.15)
           × (1 + 0.08)
           × (1 + 0.20)
           × 0.85
           × (1 + 0.015)
           × 1.05
           ≈ 1.30 × 1.15 × 1.08 × 1.20 × 0.85 × 1.015 × 1.05
           ≈ 1.566
```

→ 实际修炼进境约为基准的 1.57 倍；UI 显示"进境神速，灵气盈盈"。

---

## 2. 战斗伤害公式（combatDamage）

### 2.1 公式

```
rawDamage = max(1, attacker.attack - defender.defense)

elementMul = 1.0
if (克):    elementMul = 1.20
elif (被克): elementMul = 0.80
else:        elementMul = 1.00

artifactSkillMul = 1.0 + sum(法宝灵禁贡献%)    // 多个法宝灵禁按加和

tempoMul = 1.0
# 战势映射（来自 CombatTempo）：
#   pressing 乘 1.15；opening 乘 1.30；turning 乘 1.10；flee_window 乘 0.85（敌方）；
#   stalemate 乘 1.00；danger 乘 0.80（己方）；chaos 乘 0.95

stanceMul = 1.0   # 来自 CombatStance（attack/defense/balanced/evasive）

finalDamage = rawDamage
            × elementMul
            × artifactSkillMul
            × tempoMul
            × stanceMul
            × critMul                    # 暴击 1.5 / 0.7
            × variance                   # 随机 0.9 ~ 1.1

finalDamage = clamp(round(finalDamage), 1, attacker.attack × 3)
```

### 2.2 关键边界

- **最小伤害 1**：防止高防低攻"零伤"破坏战局。
- **最大伤害 = 攻击 × 3**：防止一击秒杀、破坏战局推进。
- **五行克制表**：`metal > wood > water > fire > earth > metal`（金克木、木克土、水克火、火克金、土克水）。
- **法宝灵禁**：归入"法术/灵禁"类伤害，按 `equipment.spellBonus` 加和（与 §2.1 中 `artifactSkillMul` 一致）。
- **战势（CombatTempo）**：由 AI/引擎综合回合事件判定；玩家可见 UI 上要展示（参见 `display.ts` `COMBAT_TEMPO_LABEL`）。
- **架势（CombatStance）**：玩家主动选择，影响攻/防/闪/均。
- **variance 0.9~1.1**：每拍伤害带 ±10% 随机，避免"每回合 99"的机械感。

### 2.3 触发例外

- **破防 / 无视防御**：当敌人被附"破绽"状态，伤害公式第一行改为 `rawDamage = attacker.attack × 1.2`（无视防御）。
- **护体光环**：法宝被动"护体"按 `artifactSkillMul` 反向减伤（同乘子，不重复叠加）。
- **会心**：暴击与战势乘子是乘积关系；不要把暴击塞进 `rawDamage`，保持可读。

### 2.4 示例

输入：
- 攻击方：炼气五层，剑修，主法宝「残光护符」附加灵禁「残光护幕」（+25%）
- 防守方：筑基二层，土行灵龟护甲
- 五行：木（攻）克土（守）→ elementMul = 1.20
- 战势：opening（乘 1.30）
- 架势：attack
- 暴击：无（critMul = 1.0）
- variance：1.05

```
rawDamage         = max(1, 180 - 220) = max(1, -40) = 1
elementMul        = 1.20
artifactSkillMul  = 1 + 0.25 = 1.25
tempoMul          = 1.30
stanceMul         = 1.10
critMul           = 1.0
variance          = 1.05

finalDamage = 1 × 1.20 × 1.25 × 1.30 × 1.10 × 1.0 × 1.05
            = 1 × 2.257 ≈ 2.26
            ≈ 2（clamp 后）
```

→ 引擎层面最终伤害为 2；玩家可见文本"残光护幕一闪，剑气破入龟甲缝隙，灵龟闷哼一声"。

> 注：本例用于说明**防御高于攻击**的边界行为；实战中 AI 必须按境界差距、战势、护甲分类给出更合理叙事，不能让"扣 2 血"成为常驻战局。

---

## 3. 突破成功率（breakthroughSuccess）

### 3.1 公式

```
baseSuccess = realmBaseRate[realm]            // 见下表
cultivationFit = min(1.0, cultivationExp / expPerLevel)   // 0 ~ 1
resourceFit   = resource / requiredResource   // 0 ~ 1+（超 1 不再叠加）
statusFit     = 1.0 + sum(状态加成±%)         // 增益为正、减益为负
fateFit       = pendingThreadFateBonus        // 0.8 ~ 1.2

rawSuccess = baseSuccess
           × cultivationFit
           × resourceFit
           × statusFit
           × fateFit

successRate = clamp(rawSuccess, 0.05, 0.95)
```

#### 3.1.1 境界基础成功率表

| realm | baseSuccess | 备注 |
|---|---|---|
| qi_refining | 0.70 | 入门期，失败可重试 |
| foundation | 0.55 | 失败扣气血 |
| golden_core | 0.40 | 失败扣寿元 |
| nascent_soul | 0.30 | 失败引心魔 |
| spirit_severing | 0.22 | 失败走火 |
| great_vehicle | 0.15 | 失败难挽回 |
| tribulation | 0.10 | 雷劫额外校验 |

#### 3.1.2 状态 / 因缘系数表

| 来源 | 默认 | 边界 |
|---|---|---|
| 增益（如"心境圆融"） | +20% | clamp(+0%, +40%) |
| 减益（如"心绪不宁"） | -15% | clamp(-30%, +0%) |
| 因缘（仙缘类 pendingThread） | +0% ~ +20% | clamp(-20%, +20%) |
| 心魔（独立 step 函数） | 0~29 → 1.0；30~59 → 0.85；60~89 → 0.70；≥90 → 0.50 | step |
| 丹毒 / 走火余伤 | -25% | clamp(-50%, +0%) |

### 3.2 边界说明

- 成功率下限 0.05：即使满状态也有 5% 概率失败，避免"必成"破坏紧张感。
- 成功率上限 0.95：即使完美状态也有 5% 概率失败，给玩家保留不确定性。
- 失败时由引擎根据境界分配**失败代价**（扣气血 / 扣寿元 / 加心魔 / 走火），不只扣修为。
- 雷劫（tribulation）单独走 `TribulationHandler`，不混入本公式。

### 3.3 示例

输入：
- 境界：炼气九层 → base = 0.70
- 修为：满（cultivationFit = 1.0）
- 资源：1 颗"筑基丹"（resourceFit = 1.2 → clamp 到 1.0）
- 状态："心境圆融"增益（+20%）+"丹毒余伤"减益（-25%）→ 1.0 × 1.20 × 0.75 = 0.90
- 因缘：与师尊的"筑基之约"（+10%）→ × 1.10
- 心魔：18 → 1.0

```
rawSuccess = 0.70 × 1.0 × 1.0 × 0.90 × 1.10 × 1.0 ≈ 0.693
successRate = clamp(0.693, 0.05, 0.95) = 0.693
```

→ 69.3% 成功率；玩家可见提示"筑基之机已现，仍有变数"。

---

## 4. 战利品价值范围（lootValue）

### 4.1 公式

```
baseValue = enemyRealmLevel × levelCoef × rarity
variance  = random(0.85, 1.15)
finalValue = round(baseValue × variance)

levelCoef = {
  mortal:      5,
  qi_refining: 20,
  foundation:  80,
  golden_core: 320,
  nascent_soul: 1280,
  spirit_severing: 5120,
  great_vehicle: 20480,
  tribulation: 80000,
  ascension:   320000,
}[enemyRealm]
```

### 4.2 来源细则

- 敌人境界按 `level × levelCoef`；同境界层数越高价值越高（不与境界 idx 重复加权）。
- 稀有度乘子：`common 1.0 / uncommon 1.5 / rare 2.5 / epic 4.5 / legendary 8.0 / mythic 15.0`。
- variance 0.85~1.15 保证不掉落死板固定值。
- 战利品最终进入物品系统，遵循 `equipment` / `material` / `consumable` / `scripture` 分类，不直接给灵石（除非敌人是商队）。

### 4.3 边界

- `finalValue` 最低 1，最高不超过 `levelCoef × 30 × 15`（防止 mythic × 999 层叠溢出）。
- 凡人 / 炼气低层敌人不掉落 mythic。
- 同年第一次进入秘境后保持不变，刷新/再进入不会重置已掉清单（参见 DESIGN.md 坊市规则）。

### 4.4 示例

输入：
- 敌人：炼气五层狼妖（level = 5，realm = qi_refining）
- 稀有度：rare（×2.5）

```
baseValue = 5 × 20 × 2.5 = 250
variance  = 1.07
finalValue = round(250 × 1.07) = 268
```

→ 战利品总估值 ≈ 268 灵石（实际拆分到 1~3 件物品，每件附 source 字段记录"自狼妖"）。

---

## 5. 拍卖会底价 / 溢价范围（auctionPricing）

### 5.1 公式

```
floorPrice   = itemValue × 0.5            // 底价
reservePrice = itemValue × 0.85           // 起拍价（reserve）
finalPrice   = reservePrice × bidRounds   // 多轮竞价累乘
premiumCap   = itemValue × 5.0            // 溢价上限

bidRounds ∈ [1.0, premiumCap / reservePrice]   // 折算约 1.0 ~ 5.88
```

### 5.2 边界说明

- 底价：玩家主动放弃时，NPC 兜底以此价成交（不能让玩家白忙一场）。
- 起拍价（reserve）：第一轮报价下限；低于此价的竞价无效。
- 溢价上限：防止恶意哄抬或 AI 编造不合理数字（玩家可见"此物再珍贵亦值不到万金"）。
- 同一件拍品**同年**只上一场；上一年未成交的拍品可顺延，但价格按 `itemValue × 0.95` 折扣。

### 5.3 竞价者行为权重

- 竞价者由 AI 生成 3~5 名 `BidderPersonality`：
  - aggressive（急抢）：每轮 +20%~40%
  - cautious（试探）：每轮 +5%~15%
  - lastMinute（末路杀手）：前 2 轮不抢，最后 1 轮 +50%~80%
  - budgetLimited（兜底型）：最高出到 `floorPrice × 2` 就停
- 玩家 AI 接管：玩家输入具体出价后，引擎按 `reservePrice × bidRounds` 校验；高于上限时拒绝并提示。

### 5.4 示例

输入：
- 拍品：1 本玄阶下品功法"潮汐引"（itemValue = 3200）

```
floorPrice   = 3200 × 0.5  = 1600
reservePrice = 3200 × 0.85 = 2720
premiumCap   = 3200 × 5.0  = 16000
```

→ 起拍 2720，上限 16000；正常终拍 4000~9000 之间，取决于竞价者类型组合。

---

## 6. 因缘权重与回响概率（threadWeight / threadEcho）

### 6.1 因缘权重公式

```
threadWeight = baseWeight(category)
             + ageBonus
             + relationshipBonus
             + fateTouchedBonus

baseWeight = {
  competition: 40,
  enemy:       50,
  quest:       45,
  promise:     60,
  mystery:     35,
  romance:     55,
  debt:        50,
  inheritance: 70,
  exploration: 40,
}[category]

ageBonus         = min(20, (currentAge - startAge) × 0.5)
relationshipBonus = (relationshipValue / 100) × 25    // 来自 NPC 关系 0~100
fateTouchedBonus  = isFateTouched ? 20 : 0
```

### 6.2 回响概率公式

```
baseEcho = clamp(threadWeight / 100, 0.1, 0.95)
urgencyMul = deadlineAge <= currentAge + 1 ? 1.5 : 1.0
stagnationMul = (currentAge - lastEchoAge) > 5 ? 1.2 : 1.0

echoChance = clamp(baseEcho × urgencyMul × stagnationMul, 0.1, 0.95)
```

### 6.3 边界说明

- weight 范围：30~120（一般不超过 120）。
- 回响概率：每年推进时引擎按 `echoChance` 判定是否承接；承接不必然完成，可以是"提醒 / 进展 / 转折 / 了结"四态之一。
- `deadlineAge <= currentAge + 1` 时强制进入 `urgent` 状态，AI 必须给出承接选项（参见 `event-scheduler.ts` AI-29 smoke）。
- 承接概率与时间脱钩：年龄增长 5 年未承接 → 概率 ×1.2（防止线索永久沉睡）。

### 6.4 示例

输入：
- 因缘："与师尊的筑基之约"（category = promise）
- 起始年龄：14 岁；当前年龄：17 岁
- NPC 关系：师尊 = 88
- isFateTouched = true

```
baseWeight        = 60
ageBonus          = min(20, 3 × 0.5) = 1.5
relationshipBonus = (88 / 100) × 25 = 22
fateTouchedBonus  = 20

threadWeight      = 60 + 1.5 + 22 + 20 = 103.5

baseEcho          = clamp(103.5 / 100, 0.1, 0.95) = 0.95
urgencyMul        = 18 <= 17 + 1 ? 1.5 : 1.0 → 1.5
stagnationMul     = (17 - lastEchoAge=15) > 5 ? 1.2 : 1.0 → 1.0

echoChance        = clamp(0.95 × 1.5 × 1.0, 0.1, 0.95) = 0.95
```

→ 回响概率 95%（即将到期）；AI 必须在 18 岁那一年的推进中触发"筑基之约"承接（提示、转折或了结）。

---

## 7. 公共边界（适用以上所有公式）

1. **clamp / round**：所有结果必须 `clamp(下限, 上限)` 后再 `round()`，避免浮点小数。
2. **随机种子**：variance / crit / echoChance 的随机必须用同一随机种子（推进编号 + 角色 id），保证可回放。
3. **持久化校验**：所有结果必须经 `display.ts sanitize` 清洗后写入存档，玩家可见字段不能含内部 key / NaN / `undefined`。
4. **AI vs 引擎边界**：AI 负责"在该范围内挑哪一段"，引擎负责"挑的不能越界"。例如：AI 给出的物品价值若超过 `levelCoef × 30 × 15`，引擎必须拒绝并打回 AI。
5. **不暴露术语**：玩家可见 UI 上不出现"乘以 / clamp / baseSuccess"等字样，按 `display.ts` 的世界内语言展示。

---

## 8. 数值边界速查表（一页汇总）

| 项 | 默认 / 基准 | 下限 | 上限 | 单位 |
|---|---|---|---|---|
| 修炼速度倍率 | 1.0 | 0.05 | 5.0 | 倍 |
| 战斗伤害 | attack - defense | 1 | attack × 3 | 点 |
| 五行克制 | 1.0 | 0.8 | 1.2 | 倍 |
| 法宝灵禁叠加 | +0% | +0% | +80% | % |
| 战势乘子 | 1.0 | 0.80 | 1.30 | 倍 |
| 突破成功率 | 见 §3.1.1 | 0.05 | 0.95 | 概率 |
| 心魔 step 惩罚 | 1.0 | 0.40 | 1.0 | 倍 |
| 战利品价值 | levelCoef × level × rarity | 1 | levelCoef × 30 × 15 | 灵石 |
| 拍卖底价 | itemValue × 0.5 | — | — | 灵石 |
| 拍卖溢价 | itemValue × 5.0 | — | — | 灵石 |
| 因缘权重 | 见 §6.1 | 30 | 120 | 点 |
| 回响概率 | weight / 100 | 0.10 | 0.95 | 概率 |

---

## 9. 待补 / 不在本期

- **雷劫（tribulation）单独公式**：参见 `docs/blueprints/tribulation-heart-demon.md`，本表不重复。
- **声望 / 悟性 / 神魂的具体曲线**：本期不细化，留到 phase-h 数值曲线稿。
- **AI 自适应难度**：本期不引入。
- **多人对战 / 阵营战**：本期不引入。

---

> 维护者：phase-g worker D · 小薪2号D
> 关联 issue：phase-g 设计细化
