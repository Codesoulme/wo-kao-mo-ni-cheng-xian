# 《我靠模拟成仙》技术设计差距分析

> 状态：基于《修仙模拟器统一技术设计文档 v1.0》与当前代码实现的对比结论
> 当前代码范围：`src/lib/xianxia/*`、`src/app/api/game/*`、`prisma/schema.prisma`、`src/components/xianxia/*`
> 用途：作为后续设计文档升级与系统化重构的执行依据

## 0. 总结

目前游戏已经做出了“能玩、能生成、能延续”的原型，但和最初设计文档相比，差距主要不在剧情文案，而在 **系统化、注册化、可追踪化** 这几层。

当前项目更像：

> AI 驱动的修仙模拟器可玩版。

设计文档想要的是：

> 有完整内容注册中心、效果传播引擎、因果图、NPC 持久化、审计轨迹的长期运营型修仙世界模拟器。

最核心的一句话：

> 注册中心管内容是否合法，ERPE 管效果如何生效，因果图管世界为何记得，NPC 系统管人物为何持续存在，审计轨迹管每次变化从哪里来。

当前游戏已经有这些东西的雏形，但还分散、轻量、临时。下一阶段最值得做的，就是把它们从“临时逻辑”升级成“系统骨架”。

---

## 1. ContentRegistry 内容注册中心：尚未真正实现

设计文档强调：

> AI 生成的物品、状态、事件、NPC、任务，必须经过 ContentRegistry 校验并注册，未注册内容对玩家不可见。

当前游戏虽然有很多 `sanitize`、`executeAIEvent`、`addItems`、`addStatuses` 等处理，但它们分散在：

- `llm.ts`
- `engine.ts`
- 各个 API route

当前链路更像：

> AI 输出 → sanitize → engine 尽量修正/接收 → 写进状态

而不是：

> AI 提议内容 → ContentRegistry 统一校验 → 生成注册 ID → 写入注册表 → 再进入游戏世界

### 当前风险

- AI 生成物品、状态、秘境、NPC 的校验逻辑分散。
- 失败原因不够结构化。
- 某个字段错了，可能被临时修正，但没有统一“注册记录”。
- 未来内容类型越来越多时，会越修越散。

### 建议补回

先做轻量版：

`src/lib/xianxia/content-registry.ts`

负责：

- `registerItem`
- `registerStatus`
- `registerThread`
- `registerRealm`
- `registerNpc`
- `registerEvent`

统一返回：

```ts
{
  ok: boolean;
  content?: RegisteredContent;
  trace: ValidationTrace[];
  warnings: string[];
  rejectedReason?: string;
}
```

---

## 2. ERPE / EffectResolver：目前局部实现，尚未成为唯一真相源

设计文档中的 ERPE 是：

> 所有装备、状态、丹炉、阵法、环境效果，都注册进 ERPE。战斗、修炼、炼丹等系统都从 ERPE.resolveAttribute 获取最终属性。

当前游戏已有接近实现：

- `computeEffectiveCultivationRate`
- `buildVisibleCultivationFactors`
- `applyItemEffects`
- 装备/状态 effects
- 修炼速度来源展示
- 储物袋容量自动生效

但很多系统仍直接读取：

- `item.effects`
- `status.effects`
- `character.attack`
- `character.defense`
- `cultivationMultiplier`

### 建议补回

新增轻量效果解析器：

`src/lib/xianxia/effect-resolver.ts`

先支持：

- `attack`
- `defense`
- `speed`
- `hp` / `maxHp`
- `mp` / `maxMp`
- `cultivationExp`
- `alchemySuccessRate`
- `storageCapacity`
- 五行属性

目标接口：

```ts
resolveAttribute(character, 'attack')
resolveAttribute(character, 'defense')
resolveAttribute(character, 'cultivationExp')
resolveAttribute(character, 'alchemySuccessRate')
```

并能解释来源：

```text
攻击 100
= 基础 50
+ 青锋剑 30
+ 剑意状态 20
```

---

## 3. 因果图 CausalGraph：目前是 pendingThreads，不是真正图结构

当前已有：

- `pendingThreads`
- `characterIntents`
- `memoryJson`
- `recentEvents`
- 同年后续
- 秘境线索
- 干扰后承接

这些已经能产生“世界有记忆”的感觉，但不是文档中的因果图。

设计文档希望：

> 每个事件是节点，事件之间有 caused_by / led_to 边，边有强度、类型、来源，可用于后续 AI 推理。

### 当前问题

- 很难追踪“这个秘境为什么出现”。
- 很难判断“这个 NPC 为什么恨我”。
- 很难把多个事件合成一条长期剧情线。
- AI 可能知道有线索，但不知道它和哪些旧事件强相关。

### 建议补回

先加 JSON 结构：

```ts
causalLinks: {
  fromEventId: string;
  toId: string;
  toType: 'thread' | 'npc' | 'realm' | 'item' | 'event';
  relation: 'caused_by' | 'led_to' | 'promised' | 'revealed' | 'angered' | 'owed';
  strength: number;
  reason: string;
}[]
```

---

## 4. NPC 系统：目前大多数 NPC 还是事件角色

设计文档希望 NPC 有身份、目标、记忆、关系、性格锁定，后续对话和行为要一致。

当前 NPC 主要存在于：

- 事件叙事文本
- 战斗敌人
- 拍卖竞拍人
- pendingThreads 描述
- 宠物/师父/宗门字段
- 少量状态/记忆

但没有正式的 `Npc` 模型。

### 当前问题

拍卖会里出现一个“资产多、阴狠、想杀人夺宝”的竞拍者，如果 AI 没有把它写进 pendingThread，它就会消失。

### 建议补回

先做：

- `knownNpcsJson`
- `registerNpcFromEvent`
- `updateNpcRelation`
- `npcMemorySummary`

基础结构：

```ts
Npc {
  id: string;
  name: string;
  realm?: string;
  faction?: string;
  personality?: string;
  goals?: string[];
  assets?: string[];
  relationshipToPlayer?: string;
  memory?: string[];
  lastSeenAge?: number;
}
```

---

## 5. 任务/承诺系统：pendingThreads 已有雏形，但不是完整任务系统

当前 `pendingThreads` 已承担很多任务功能：

- 截止年龄
- 进度
- urgent / pending / resolved / failed
- followUpHint
- reward / failureCost

但设计文档里的任务系统更正式，应包括：

- 任务来源
- 目标条件
- 阶段
- 失败条件
- 奖励注册
- 关联 NPC
- 关联地点
- 关联物品
- 关联因果边

### 建议补回

把 `PendingThread` 升级为两层：

- `PendingThread`：轻量因果线索
- `QuestEntry`：明确任务/承诺/约定

不是所有线索都变任务，但重要的应该变。

---

## 6. AI 输出违规检测：目前有规则提示，但没有统一检测层

设计文档包含：

- 输入分类
- 越权请求静默拒绝
- 规则操纵防御
- 输出边界检测
- `progression_locked`
- `undefined_effect`
- `balance_violation`
- `deus_ex_machina`
- `lore_contradiction`

当前游戏靠 prompt、干扰分类、engine 兜底和局部 normalize 处理，但还没有统一的：

```ts
validateAIOutputBoundary(aiOutput, context)
```

### 建议补回

新增：

`src/lib/xianxia/ai-boundary-validator.ts`

先检查：

- 文案禁词：AI、预加载、缓存、配置、调试、id 等。
- 奖励上限。
- 未注册属性。
- 直接飞升/跳境界。
- 未经 choice 直接替玩家做重大决定。
- 没有因果来源的秘境/NPC/物品。

---

## 7. 事件库与时间触发系统：当前是“蓝图 + AI”，调度器还不完整

当前已有：

- `EVENT_BLUEPRINTS`
- `pendingThreads`
- `recentEventTypes`
- `recentBlueprintCategories`
- same-year follow-up
- urgent deadline
- hidden preload

但还没有正式事件调度器。

### 建议补回

做轻量版事件调度：

```ts
collectEligibleEvents(state)
scoreEventBlueprints(state, threads)
selectEventCandidate(state)
```

目标是减少“AI 想到啥写啥”，让主线、秘境、拍卖、宗门、仇敌更有秩序。

---

## 8. 主线命节点：应隐藏 UI，但保留后台生命大事骨架

用户已经明确：不要在玩家 UI 暴露命节点统计，命节点不应该像固定任务表一样破坏沉浸。

但系统内部仍应有自然发生的主线大事：

- 灵根觉醒
- 初入仙门
- 第一次大劫
- 第一次结丹
- 重要道侣/仇敌/宗门选择
- 飞升相关转折

### 建议补回

后台维护：

```ts
majorLifeBeats: {
  key: string;
  status: 'locked' | 'eligible' | 'completed';
  hidden: true;
  narrativeRole: string;
}[]
```

玩家只看到自然剧情，不看到节点表。

---

## 9. 移动端体验：Web 原型优先，不急着回到 Unity 路线

文档原本目标是 iOS/Android + Unity 2022 + WebSocket + 流式叙事。当前项目是 Next.js Web 项目。

这不是坏事。当前阶段 Web 原型更适合快速迭代。

### 建议

短期不用做 Unity。先把 Web 移动端做到舒服：

- 底部操作固定。
- 所有弹窗支持 `90dvh` 内滚动。
- 长文本分段。
- 重要收益折叠。
- 大事件支持“分段显现/继续”。
- 史册手机阅读优化。

---

## 10. 数据持久化：当前 SQLite + JSON 字段，缺少审计轨迹

当前大量核心数据存在 JSON 字段：

- `statusJson`
- `inventoryJson`
- `equippedJson`
- `memoryJson`
- `pendingThreadsJson`
- `characterIntentsJson`
- `combatStateJson`
- `exploredRealmsJson`

设计文档希望有 state_changes 不可变日志、AI 调用日志、校验轨迹和事件回放。

### 建议补回

不用立即上 PostgreSQL/MongoDB，先加轻量表：

```prisma
model StateChangeLog {
  id String @id @default(cuid())
  characterId String
  age Int
  source String
  field String
  oldValue String
  newValue String
  reason String
  createdAt DateTime @default(now())
}
```

---

## 11. 炼丹系统：当前可用，但深度不够

当前已有 `AlchemyFurnace.tsx` 和 `/api/game/alchemy`，但设计文档强调：

- 丹炉效果注入
- 材料五行影响
- 成丹率来源追溯
- 丹药效果注册
- AI 不能乱造不可消费效果
- 丹炉作为 ERPE 特殊路径

### 建议补强

- 成丹率来源面板。
- 丹炉/火候/材料品质影响。
- 丹药效果走 ContentRegistry。
- 炼丹失败也产生合理副产物/状态。
- 高阶丹药需要丹方/炉鼎/火种/境界。

---

## 12. 世界观维护与事实校验：目前主要靠 prompt，没有正式事实层

当前项目主要靠 prompt、`memoryJson`、recent events、pendingThreads、state context 维持连续性。

风险：

- 宗门名变化。
- 地名变化。
- NPC 态度变化。
- 同一个秘境被改名。
- 某个敌人死了又出现。

### 建议补回

先做轻量 `worldFactsJson`：

```ts
{
  factions: [],
  locations: [],
  knownNpcs: [],
  knownRealms: [],
  promises: [],
  forbiddenContradictions: []
}
```

每次 AI 生成前注入，生成后更新。

---

## 13. 当前项目已比设计文档更落地的部分

当前项目虽然还缺系统化骨架，但已经有一些非常实用的落地成果：

- 引擎权威：战斗、突破、寿命、物品实际效果基本由 engine 控制。
- AI 生成事件：已经能按角色状态生成年度事件。
- 真实物品效果：装备、经文、储物袋、修炼速度已经开始真实生效。
- 修炼速度来源展示：比普通原型更强。
- pendingThreads：虽然不是完整因果图，但已经能承接承诺、秘境、仇敌、未来事件。
- 秘境因缘：已朝“叙事发现 → 实际入口”靠近。
- 战斗叙事 + 掉落：比设计文档里的抽象描述更具体。
- 拍卖会流程：文档没有细写，但当前新增系统很有潜力。
- 隐藏预加载：文档里没有明确写，但对体验很重要。
- 移动网页预览：虽然不是 Unity，但当前迭代效率更高。

---

## 14. 推荐补强优先级

### 第一优先级：ContentRegistry Lite

原因：这是所有 AI 内容稳定性的地基。

先做：

- 物品注册
- 状态注册
- 秘境注册
- NPC 注册
- 事件注册
- 校验轨迹

### 第二优先级：NPC 持久化

原因：玩家最容易感受到“世界活了”。

先做：

- `knownNpcsJson`
- 拍卖会竞拍者可转为 NPC
- 战斗敌人可转为仇敌/死敌/残魂/势力
- 师父、同门、黑市商人、救命恩人可持续出现

### 第三优先级：因果图 Lite

原因：解决“为什么这个秘境/敌人/机缘又出现了”。

先做：

- `causalLinksJson`
- 每个秘境、NPC、任务、物品都能追溯来源事件
- AI prompt 注入强关联因果

### 第四优先级：EffectResolver / ERPE Lite

原因：数值系统会越来越复杂，现在已经到了需要统一的时候。

先从：

- 修炼
- 战斗
- 炼丹
- 储物
- 阵法

统一成一个效果解析入口。

### 第五优先级：移动端阅读体验

原因：当前已能手机访问，这块马上能提升体验。

重点：

- 长剧情分段。
- 弹窗都可滚动。
- 史册阅读更舒服。
- 选择按钮固定在底部。
- 战斗/拍卖/秘境适合手机屏幕。
