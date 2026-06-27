# 《我靠模拟成仙》状态词条全表（DESIGN-STATUSES）

> 文档版本：v0.1
> 状态：phase-g 设计细化稿（第一版）
> 适用：`src/lib/xianxia/types.ts` 的 `StatusCategory` enum（attribute / skill / buff / debuff / special / constitution / identity / quest / environment）+ `StatusExpireRule` enum（turns / years / condition / event）
> 维护原则：
> - 状态由引擎持久化，AI 命名与叙事化；UI 由 `display.ts` 统一映射
> - 每条状态必须有 id、中文名、来源、典型效果、持续规则、引擎校验字段
> - 玩家可见字段必须经 `sanitize`，不能暴露 id / 内部 key

---

## 0. 总览

| 分类（中文） | 内部 key | 来源 | 默认分类（StatusCategory） | 持续规则 |
|---|---|---|---|---|
| 身份 / 仙缘 | identity | 宗门 / 拜师 / 血脉 | `identity` | condition |
| 增益 | buff | 功法 / 法宝 / 丹药 / 体质 | `buff` | turns / years / condition |
| 减益 | debuff | 中毒 / 心魔 / 受伤 / 失败 | `debuff` | turns / years / condition / event |
| 体质 | constitution | 出生 / 传承 / 奇遇 | `constitution` | condition（无 exp 期限） |
| 灵宠羁绊 | petBond | 灵契 / 喂养 / 共战 | `skill` 或 `special` | condition |
| 修炼印 / 心境 | cultivation | 顿悟 / 瓶颈 / 突破 | `attribute` / `skill` | turns / years |
| 任务 / 因缘 | quest | 师门委托 / 悬赏 / 承诺 | `quest` | event / condition |
| 环境 | environment | 秘境 / 灵脉 / 丹室 | `environment` | condition |

> 共 **35 条**（identity × 5 / buff × 9 / debuff × 8 / constitution × 5 / petBond × 4 / cultivation × 2 / quest × 1 / environment × 1）。

---

## 1. 身份 / 仙缘（identity）

> 长期身份字段；通常与 `faction` / `master` / `xianYuan` 绑定；不存在 duration，由 condition 控制何时失效。

### 1.1 宗门内门弟子

- **id**：`identity.sect_inner_disciple`
- **中文名**：内门弟子
- **来源**：宗门身份（被收入内门）
- **典型效果**：修炼速度 ×1.05；可接内门任务；可入内门书阁
- **持续规则**：`condition`（离开宗门或被贬出内门即移除）
- **引擎校验字段**：`faction.identity == 'inner'`

### 1.2 宗门外门弟子

- **id**：`identity.sect_outer_disciple`
- **中文名**：外门弟子
- **来源**：宗门身份（被收入外门）
- **典型效果**：修炼速度 ×1.02；可接外门任务；不可入内门书阁
- **持续规则**：`condition`
- **引擎校验字段**：`faction.identity == 'outer'`

### 1.3 记名弟子

- **id**：`identity.registered_disciple`
- **中文名**：记名弟子
- **来源**：拜师记录名
- **典型效果**：可旁观师尊传功；不可入书阁
- **持续规则**：`condition`
- **引擎校验字段**：`master != null && faction == null`

### 1.4 散修

- **id**：`identity.loose_cultivator`
- **中文名**：散修
- **来源**：未入宗门
- **典型效果**：修炼速度 ×0.95；不受宗门任务约束；可自由出入坊市
- **持续规则**：`condition`
- **引擎校验字段**：`faction == null`

### 1.5 血脉 / 仙缘（特殊身份子集）

- **id**：`identity.fate_touched`
- **中文名**：天命所钟
- **来源**：出生定型 / 传承觉醒
- **典型效果**：突破成功率 +5%；回响概率 +20%；心魔 step -1
- **持续规则**：`condition`（至死不变）
- **引擎校验字段**：`constitution.riskType == 'none' && constitution.category == 'fate'`

---

## 2. 增益（buff）

> 持续时长可控：turns（战斗内回合）/ years（年份推进）/ condition（条件触发移除）。

### 2.1 灵台澄澈

- **id**：`buff.ling_tai_cheng_che`
- **中文名**：灵台澄澈
- **来源**：功法（《太清静心诀》大成后）
- **典型效果**：修炼速度 +20%；心魔 step 惩罚 -1
- **持续规则**：`condition`（战斗 / 走火后保留）
- **引擎校验字段**：`technique.id == 'taiqing_jingxin' && technique.level >= 5`

### 2.2 心境圆融

- **id**：`buff.xin_jing_yuan_rong`
- **中文名**：心境圆融
- **来源**：顿悟 / 闭关
- **典型效果**：突破成功率 +20%；心魔生成 -25%
- **持续规则**：`years`（默认 3 年）
- **引擎校验字段**：`status.duration > 0 && status.expireRule == 'years'`

### 2.3 灵气护体

- **id**：`buff.spirit_armor`
- **中文名**：灵气护体
- **来源**：法宝被动 / 符箓
- **典型效果**：战斗伤害 ×0.85（减伤）；持续 3 回合
- **持续规则**：`turns`（默认 3 回合）
- **引擎校验字段**：`combatSession.roundRemaining >= 0`

### 2.4 血气充盈

- **id**：`buff.blood_surge`
- **中文名**：血气充盈
- **来源**：丹药（活血丹）/ 灵膳
- **典型效果**：气血上限 +20%；恢复 +5/拍
- **持续规则**：`turns`（战斗内 5 回合）
- **引擎校验字段**：`hp.maxHp 加成`

### 2.5 识海清明

- **id**：`buff.soul_clarity`
- **中文名**：识海清明
- **来源**：丹药（清神丹）/ 突破成功
- **典型效果**：神识 +10%；心魔攻击 -15%
- **持续规则**：`condition`（无昏迷/中邪）
- **引擎校验字段**：`status.target_attribute == 'spiritualAwareness'`

### 2.6 法宝灵禁（子分类：归 buff 但代表法术/灵禁）

- **id**：`buff.artifact_skill_residual`
- **中文名**：法宝灵禁余韵
- **来源**：法宝主动释放
- **典型效果**：战斗伤害 +N%（按法宝 tier）+ 持续 2~4 回合
- **持续规则**：`turns`
- **引擎校验字段**：`equipment.spellBonus != null`

### 2.7 灵宠加持

- **id**：`buff.pet_blessing`
- **中文名**：灵宠加持
- **来源**：灵宠共战 / 灵契共鸣
- **典型效果**：修炼速度 +10%；战斗伤害 +5%
- **持续规则**：`condition`（灵宠在场）
- **引擎校验字段**：`pet.loyalty >= 60 && pet.partner == current`

### 2.8 阵中助力

- **id**：`buff.formation_assist`
- **中文名**：阵中助力
- **来源**：阵法（辅助类）
- **典型效果**：全队攻击 +10%；防御 +10%
- **持续规则**：`condition`（阵法激活期间）
- **引擎校验字段**：`formation.activeFormation.category == 'support'`

### 2.9 仙缘之佑

- **id**：`buff.fate_blessing`
- **中文名**：仙缘之佑
- **来源**：因缘承接（仙缘类 pendingThread）
- **典型效果**：回响概率 +15%；战利品价值 +20%
- **持续规则**：`event`（承接完即消）
- **引擎校验字段**：`pendingThread.category == 'romance' || 'inheritance'`

---

## 3. 减益（debuff）

### 3.1 心魔缠身

- **id**：`debuff.heart_demon_tangle`
- **中文名**：心魔缠身
- **来源**：心魔值 ≥ 30
- **典型效果**：修炼速度 ×0.85；突破成功率 ×0.85
- **持续规则**：`condition`（心魔 < 30 时移除）
- **引擎校验字段**：`heartDemon >= 30`

### 3.2 心魔入体

- **id**：`debuff.heart_demon_invasion`
- **中文名**：心魔入体
- **来源**：心魔值 ≥ 60
- **典型效果**：修炼速度 ×0.65；心魔战概率 +30%
- **持续规则**：`condition`（心魔 < 60 时移除）
- **引擎校验字段**：`heartDemon >= 60`

### 3.3 内伤

- **id**：`debuff.internal_injury`
- **中文名**：内伤
- **来源**：战斗 / 走火入魔 / 失败突破
- **典型效果**：气血上限 -20%；恢复 -3/拍
- **持续规则**：`years`（默认 1~3 年）
- **引擎校验字段**：`status.target_attribute == 'maxHp'`

### 3.4 外伤

- **id**：`debuff.external_wound`
- **中文名**：外伤
- **来源**：战斗（被利爪、利器命中）
- **典型效果**：战斗中流血，每拍 -2 气血
- **持续规则**：`turns`（战斗内 5~8 回合）
- **引擎校验字段**：`combatSession.roundRemaining >= 0`

### 3.5 中毒

- **id**：`debuff.poisoned`
- **中文名**：中毒
- **来源**：毒素 / 毒丹 / 毒妖兽
- **典型效果**：每拍 -X 气血；元素抗性 -10%
- **持续规则**：`turns`（视毒种 3~10 回合）
- **引擎校验字段**：`status.source == '毒物' / '毒丹'`

### 3.6 丹毒

- **id**：`debuff.pill_toxicity`
- **中文名**：丹毒
- **来源**：丹药副作用（参见 `PillSideEffect`）
- **典型效果**：修炼速度 ×0.80；突破成功率 -25%
- **持续规则**：`years`（默认 1~5 年，依丹品级）
- **引擎校验字段**：`status.source == '丹药副作用'`

### 3.7 神识受损

- **id**：`debuff.soul_damage`
- **中文名**：神识受损
- **来源**：神识类攻击 / 心魔战败
- **典型效果**：法术伤害 -25%；识海攻击 -30%
- **持续规则**：`years`（默认 1~2 年）
- **引擎校验字段**：`status.target_attribute == 'spiritualAwareness'`

### 3.8 心绪不宁

- **id**：`debuff.troubled_mind`
- **中文名**：心绪不宁
- **来源**：未了因缘（deadline 临近）/ 重大挫折
- **典型效果**：突破成功率 -15%；战利品价值 -10%
- **持续规则**：`condition`（因缘解除或 deadline 度过）
- **引擎校验字段**：`pendingThread.status == 'urgent'`

---

## 4. 体质（constitution）

> 来自 `ConstitutionProfile`，无 duration；condition 控制（与心性、境界、传承绑定）。

### 4.1 天灵根

- **id**：`constitution.heavenly_root`
- **中文名**：天灵根
- **来源**：出生定型
- **典型效果**：修炼速度 ×1.25；法术伤害 +10%
- **持续规则**：`condition`
- **引擎校验字段**：`spiritualRoot == 'heavenly'`

### 4.2 至阴之体

- **id**：`constitution.extreme_yin_body`
- **中文名**：至阴之体
- **来源**：特殊传承 / 母系血脉
- **典型效果**：水系法术 ×1.5；火系法术 ×0.5；寒毒概率 +20%
- **持续规则**：`condition`
- **引擎校验字段**：`constitution.category == 'body' && constitution.elementAffinity includes 'water'`

### 4.3 至阳之体

- **id**：`constitution.extreme_yang_body`
- **中文名**：至阳之体
- **来源**：父系血脉 / 奇遇
- **典型效果**：火系法术 ×1.5；冰系抵抗 +30%
- **持续规则**：`condition`
- **引擎校验字段**：`constitution.category == 'body' && constitution.elementAffinity includes 'fire'`

### 4.4 剑心通明

- **id**：`constitution.sword_heart`
- **中文名**：剑心通明
- **来源**：剑道传承 / 顿悟
- **典型效果**：剑法伤害 +20%；剑意领悟速度 ×1.5；走火概率 +5%
- **持续规则**：`condition`
- **引擎校验字段**：`constitution.category == 'combat' && constitution.techniqueKeywords includes 'sword'`

### 4.5 命格劫星

- **id**：`constitution.fate_star_calamity`
- **中文名**：命格劫星
- **来源**：出生 / 命格异变
- **典型效果**：因缘回响概率 +30%；雷劫难度 +20%；气运 -10%
- **持续规则**：`condition`
- **引擎校验字段**：`constitution.category == 'fate' && constitution.rarity >= 'legendary'`

---

## 5. 灵宠羁绊（petBond）

> 来自 `Pet.loyalty` / `PetCultivationPath`，归 `skill` 或 `special` 分类。

### 5.1 灵契初成

- **id**：`petBond.contract_formed`
- **中文名**：灵契初成
- **来源**：灵契仪式
- **典型效果**：灵宠参战；可远距感应位置
- **持续规则**：`condition`（忠诚 ≥ 30 即生效）
- **引擎校验字段**：`pet.loyalty >= 30`

### 5.2 同心共命

- **id**：`petBond.shared_destiny`
- **中文名**：同心共命
- **来源**：羁绊深化 / 共同历险
- **典型效果**：灵宠战斗伤害 +20%；主人受创灵宠分担 10%
- **持续规则**：`condition`（忠诚 ≥ 60）
- **引擎校验字段**：`pet.loyalty >= 60`

### 5.3 灵宠护主

- **id**：`petBond.guardian`
- **中文名**：灵宠护主
- **来源**：灵宠路径 = combat / 守卫本能觉醒
- **典型效果**：战斗中灵宠自动护主；减主人 30% 伤害
- **持续规则**：`condition`（忠诚 ≥ 80）
- **引擎校验字段**：`pet.cultivationPath == 'combat' && pet.loyalty >= 80`

### 5.4 心意相通

- **id**：`petBond.soul_link`
- **中文名**：心意相通
- **来源**：长期共修 / 闭关陪伴
- **典型效果**：灵宠技能冷却 -1 回合；与主人协同施法
- **持续规则**：`condition`（忠诚 ≥ 90 且羁绊 ≥ 三年）
- **引擎校验字段**：`pet.loyalty >= 90 && (currentAge - pet.acquiredAge) >= 3`

---

## 6. 修炼印 / 心境（cultivation）

### 6.1 顿悟残印

- **id**：`cultivation.epiphany_mark`
- **中文名**：顿悟残印
- **来源**：罕见顿悟 / 上古遗迹启示
- **典型效果**：同系功法修炼速度 +10%；持续 5 年
- **持续规则**：`years`（默认 5 年）
- **引擎校验字段**：`status.source == '顿悟' || '遗迹'`

### 6.2 瓶颈期

- **id**：`cultivation.bottleneck`
- **中文名**：瓶颈期
- **来源**：修为接近上限 / 心态未稳
- **典型效果**：修炼速度 ×0.50；瓶颈事件概率 +20%
- **持续规则**：`condition`（修为突破或放弃当前功法）
- **引擎校验字段**：`cultivationExp / expPerLevel >= 0.85`

---

## 7. 任务 / 因缘（quest）

### 7.1 师门委托

- **id**：`quest.master_commission`
- **中文名**：师门委托
- **来源**：`pendingThread.category == 'quest'`
- **典型效果**：完成奖励按 `pendingThread.reward`；失败代价 `pendingThread.failureCost`
- **持续规则**：`event`（了结 / 失败 / 过期）
- **引擎校验字段**：`pendingThread.status in ['pending', 'urgent']`

---

## 8. 环境（environment）

### 8.1 灵脉之中

- **id**：`environment.spirit_vein_inside`
- **中文名**：灵脉之中
- **来源**：进入灵脉 / 秘境核心
- **典型效果**：修炼速度 +30%；法术威力 +10%
- **持续规则**：`condition`（离开秘境即移除）
- **引擎校验字段**：`location.kind == 'spirit_vein' || 'secret_realm_core'`

---

## 9. 校验字段与映射总表

> 引擎在 applyStatus / removeStatus 时，按下表强制校验；校验失败则拒绝落库并提示玩家。

| 状态 id 段 | 必校验字段 | 失败动作 |
|---|---|---|
| `identity.*` | `faction` / `master` / `spiritualRoot` | 移除状态并打回 |
| `buff.*` | `status.duration > 0` 或 condition 仍成立 | 跳过（保留） |
| `debuff.*` | `status.duration > 0` 或 condition 仍成立 | 跳过 |
| `constitution.*` | `constitution.currentStage > 0` | 标记为未觉醒 |
| `petBond.*` | `pet != null` 且忠诚度阈值达标 | 移除 |
| `cultivation.*` | `cultivationExp` 范围 / 境界范围 | clamp 后保留 |
| `quest.*` | `pendingThread.status != 'resolved'` | 移除 |
| `environment.*` | `location.kind` | 离开即移除 |

---

## 10. 持续规则速查

| 规则（StatusExpireRule） | 含义 | 典型状态 |
|---|---|---|
| `turns` | 按战斗回合数 | 灵气护体、外伤、中毒 |
| `years` | 按年份推进 | 心境圆融、丹毒、内伤 |
| `condition` | 条件触发移除 | 心魔缠身、灵契初成、师门委托（待触发） |
| `event` | 事件了结 / 状态切换 | 仙缘之佑、师门委托（完成/失败） |

---

## 11. 与数值公式的挂钩

- 修炼速度：见 DESIGN-VALUES.md §1；本表 buff/debuff 直接参与 `statusBonus` 与 `heartDemonPenalty`。
- 突破成功率：见 DESIGN-VALUES.md §3；`buff.xin_jing_yuan_rong`、`debuff.pill_toxicity`、`debuff.heart_demon_*` 参与。
- 战斗伤害：见 DESIGN-VALUES.md §2；`buff.artifact_skill_residual`、`debuff.poisoned`、`buff.formation_assist` 参与。
- 因缘回响：见 DESIGN-VALUES.md §6；`buff.fate_blessing` 参与。

---

## 12. 新增状态流程（不可跳过）

1. 在本表登记 id、中文名、来源、效果、持续规则、校验字段；
2. 同步更新 `src/lib/xianxia/types.ts` 中的 `StatusCategory` / `StatusExpireRule` 引用；
3. 同步更新 `src/lib/xianxia/display.ts` 中的中文标签映射；
4. 在 `src/lib/xianxia/event-effects.ts` 注册新增状态的 resolve 逻辑；
5. 跑回归：AI-29 smoke + UI-RULES Phase 2 §10（状态必须参与事件）。

---

## 13. 待补

- **环境类**：秘境之心、雷劫前夕、丹室灵气过浓——共 3 条待 phase-h 数值稿细化。
- **羁绊深化**：道侣羁绊、师徒羁绊——归 `relationship` 分类，待 phase-h。
- **跨界状态**：跨境界反噬（飞升失败反噬）——待 phase-i。

---

> 维护者：phase-g worker D · 小薪2号D
> 关联 issue：phase-g 设计细化 / 状态词条全表

