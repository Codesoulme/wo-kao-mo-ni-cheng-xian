# 架构说明

> 《我靠模拟成仙》三层架构详解
> 版本：v1.0（2026-06-27）
> 读者：开发者 / 想理解项目结构的协作者
> 上游基准：`docs/baseline/technical-design-v1.0-2026-06-17.txt`

本项目的核心架构可以浓缩为一句话：

> **AI 输出驱动 → 引擎校验 → 前端槽位投影**

三层各司其职、双层保险（Prompt 约束 + 引擎硬校验）、UI 与游戏逻辑严格分离。本文从这条主线展开。

---

## 目录

- [1. 总览](#1-总览)
- [2. 三层职责](#2-三层职责)
- [3. 数据流（一次"推进"为例）](#3-数据流一次推进为例)
- [4. 核心模块](#4-核心模块)
- [5. AI 输出驱动层](#5-ai-输出驱动层)
- [6. 引擎校验层](#6-引擎校验层)
- [7. 前端槽位投影层](#7-前端槽位投影层)
- [8. 持久化与时间](#8-持久化与时间)
- [9. 一次完整的端到端示例](#9-一次完整的端到端示例)
- [10. 演进与权衡](#10-演进与权衡)

---

## 1. 总览

### 1.1 三层架构图

```
                          ┌──────────────────────────────────────┐
                          │        玩家（Player）                  │
                          │   看 / 点 / 读 / 听 / 等               │
                          └──────────────────────────────────────┘
                                              ▲
                                              │ （投影）
                                              │
┌─────────────────────────────────────────────────────────────────────┐
│                  第三层：前端槽位投影（Next.js UI）                    │
│                                                                       │
│   状态栏 / 角色详情 / 库存 / 因缘 / 战斗 / 突破 / 坊市 / 渡劫 / 飞升     │
│                                                                       │
│   - 只读，绝不创作                                                     │
│   - 槽位规则集中在 display.ts + display-registry.ts                  │
│   - sanitize 链路：内部 key → 世界内表达                               │
└─────────────────────────────────────────────────────────────────────┘
                                              ▲
                                              │ （订阅：state / log / event）
                                              │
┌─────────────────────────────────────────────────────────────────────┐
│                  第二层：引擎校验（Engine Authority）                  │
│                                                                       │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │ Content       │  │ AI Boundary  │  │  ERPE        │             │
│   │ Registry      │  │ Validator    │  │ (Effect       │             │
│   │ 统一入口      │  │ 越权越阶      │  │  Resolver)   │             │
│   └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                       │
│   - 数值与状态唯一权威                                                  │
│   - 任何 AI 提案必须经统一校验                                          │
│   - 校验通过 → 写入 State Change Log                                  │
└─────────────────────────────────────────────────────────────────────┘
                                              ▲
                                              │ （提交：command + 上下文）
                                              │
┌─────────────────────────────────────────────────────────────────────┐
│                  第一层：AI 输出驱动（LLM GM）                        │
│                                                                       │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │ Prompt        │  │  Response    │  │  LLM 客户端   │             │
│   │ Builder       │  │  Parser      │  │ (可配置端点) │             │
│   └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                       │
│   - 玩家配置的 API 端点（OpenAI 兼容协议）                              │
│   - Prompt 受规则约束（schema / 越权 / 文风）                         │
│   - 输出必须可被引擎解析                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 为什么是这个结构

| 候选架构 | 问题 |
|----------|------|
| LLM 直接读写数据库 | 幻觉会污染存档；玩家不可信；无法回滚 |
| LLM 直接控制前端 | 文案混乱；越权改 UI 状态；测试困难 |
| 纯脚本剧情树 | 失去"每年都不同"的核心卖点 |
| 经典 RPG 数值系统 + 文本拼接 | 失去 AI 的创造性与自然语言能力 |

我们采用的方案：

- **AI 负责"生成"**——剧情、对话、NPC 行为、世界传闻。
- **引擎负责"裁决"**——所有数值、状态、物品、因果的最终权威。
- **前端负责"投影"**——把结构化数据投影到玩家视觉。

三者通过 **明确的接口** 通信，没有跨层调用。

### 1.3 双层保险

```
Prompt 约束  ────►  LLM 输出
                         │
                         ▼
                  引擎硬校验  ◄─── 不通过则丢弃/再生/阻断
                         │
                         ▼
                  State Change Log  ◄─── 可审计、可回滚
                         │
                         ▼
                  前端订阅 + 投影
```

只信 Prompt → 玩家会被幻觉坑。
只信引擎 → AI 失去创造性、变成死板脚本。
**两层缺一不可。**

---

## 2. 三层职责

### 2.1 第一层：AI 输出驱动（LLM GM）

**职责**

- 根据当前游戏状态生成：剧情、事件、选择、物品、NPC 对话、战斗描述、突破叙事、世界传闻。
- 遵守 Prompt 规则，输出可被引擎解析的 JSON。

**不做**

- 不直接修改数据库。
- 不直接修改前端状态。
- 不替玩家做"是否接受"的决定（那是引擎的事）。
- 不响应越权指令（如"给我 buff""让我直接飞升"）——会以世界内话术自然拒绝。

**实现位置**

- `src/lib/xianxia/llm.ts`：LLM 客户端 + Prompt 构造
- `src/lib/xianxia/style-anchor.ts`：文风锚定（防止 AI 文风漂移到现代 / 西幻）

**外部依赖**

- 玩家配置的 LLM 端点（OpenAI / Anthropic / 火山方舟兼容协议）
- 详见 [README.md](../README.md) 的"配置 AI 端点"

### 2.2 第二层：引擎校验（Engine Authority）

**职责**

- 接收 AI 提案 → 校验 → 落库 → 记录变更。
- 计算所有玩家可见的数值（攻击力、防御力、修为速度、炼丹成功率…）。
- 维护因缘（pendingThreads）的因果链。
- 维护世界时间与世界事实。

**核心子系统**

| 模块 | 路径 | 职责 |
|------|------|------|
| `engine.ts` | `src/lib/xianxia/engine.ts` | 主流程引擎（推进、结算、状态变更） |
| `content-registry.ts` | `src/lib/xianxia/content-registry.ts` | AI 产物的统一入口 + 校验 |
| `ai-boundary-validator.ts` | `src/lib/xianxia/ai-boundary-validator.ts` | AI 越权 / 越阶校验 |
| `effect-resolver.ts` | `src/lib/xianxia/effect-resolver.ts` | ERPE 数值结算（唯一数值源） |
| `state-change-log.ts` | `src/lib/xianxia/state-change-log.ts` | 状态变更日志（可审计、可回滚） |
| `event-scheduler.ts` | `src/lib/xianxia/event-scheduler.ts` | 事件调度器 |
| `world-time.ts` | `src/lib/xianxia/world-time.ts` | 世界时间 |
| `entity-store.ts` | `src/lib/xianxia/entity-store.ts` | NPC / 物品 / 状态持久化 |
| `advance-fallback.ts` | `src/lib/xianxia/advance-fallback.ts` | AI 失败时的回退逻辑 |

**硬约束（违反任一即拒绝）**

- 数值不能超出当前境界支持的范围。
- 物品不能引用不存在的 schema。
- 状态不能矛盾（如同时拥有"冷静"和"暴躁"）。
- 不能越权修改基础属性。
- 不能引用未注册的事件 / NPC / 地点。

**软约束（违反会 warn 但允许）**

- 因缘时间窗口过紧（建议玩家延期）。
- 装备搭配不佳（建议而非拒绝）。
- 修为增长速度异常（提示玩家注意）。

### 2.3 第三层：前端槽位投影（Next.js UI）

**职责**

- 把引擎产出的结构化数据投影到对应槽位。
- 处理用户交互（按钮点击、表单提交）。
- 把交互提交给引擎（不直接给 AI）。

**核心组件（33 个修仙组件 + shadcn/ui 基础组件）**

| 槽位 | 组件 |
|------|------|
| 顶部状态栏 | `StatusPanel.tsx` / `StatusList.tsx` / `HeartDemonCard.tsx` |
| 角色详情 | `CharacterDetailSheet.tsx` / `CharacterIntentsCard.tsx` |
| 库存 | `InventoryPanel.tsx` / `ItemDetailDialog.tsx` |
| 因缘 | `PendingThreadsCard.tsx` / `MilestonesLog.tsx` |
| 战斗 | `CombatModal.tsx` / `ActionButtons.tsx` |
| 突破 | `AscensionModal.tsx` / `TribulationModal.tsx` / `RestrictionModal.tsx` |
| 坊市 | `MarketModal.tsx` |
| 灵宠 | `PetPanel.tsx` |
| 阵法 | `FormationPanel.tsx` |
| 炼丹 | `AlchemyFurnace.tsx` |
| 重置 | `ResetWorldButton.tsx` |
| 配置 | `AIConfigDialog.tsx` |
| 流式叙事 | `EventTimeline.tsx` |
| 心境 | `HeartIntentPanel.tsx` |
| 世界遗产 | `WorldLegacyPanel.tsx` |
| 秘闻 | `SecretRealmPanel.tsx` |
| 结算 | `SettlementModal.tsx` |
| 起始 | `StartScreen.tsx` |
| 菜单 | `GameMenu.tsx` |
| 介入 | `InterfereInput.tsx` |
| 自定义 | `CustomSimulationDialog.tsx` |
| 模拟大厅 | `SimulationHallDialog.tsx` |
| 境界 | `RealmOrb.tsx` |
| 因缘节点 | `FateNodes.tsx` |

**展示规则集中点**

- `src/lib/xianxia/display.ts`：sanitize 函数、loading 文案、属性 label
- `src/lib/xianxia/display-registry.ts`：槽位投影规则注册（数量、折叠、扩展）

**UI 16 条硬约束**：详见 [docs/UI-RULES.md](UI-RULES.md)。

---

## 3. 数据流（一次"推进"为例）

下面追踪 **玩家点击 "推进" 按钮** 时发生了什么：

```
[Player] 点击 "推进"
       │
       ▼
[Next.js Client] 调 POST /api/game/advance
       │
       ▼
[Route] advance/route.ts
       │
       ├── 读当前状态（从 Zustand store 同步）
       │
       ▼
[engine.advanceOneYear]
       │
       ├── 1. 打包当前状态 + 因缘 + 历史 → EngineStateContext
       │
       ├── 2. 调用 llm.generateEvent(context)
       │       │
       │       ▼
       │   [PromptBuilder]
       │       │
       │       ▼
       │   [LLM 端点] ──► 返回 JSON（剧情 + 事件 + 选择 + 可能物品/NPC）
       │       │
       │       ▼
       │   [ResponseParser] 解析为 EngineCommand + ProposedContent
       │
       ├── 3. AI Boundary Validator 检查越权 / 越阶
       │       │
       │       ▼
       │   [ContentRegistry.propose] 统一校验
       │       │
       │       ├── 通过 → 写入 entity-store
       │       │
       │       └── 不通过 → 丢弃 / 触发再生（最多 3 次）/ 阻断
       │
       ├── 4. ERPE.resolveAttribute 重算所有属性
       │
       ├── 5. StateChangeLog 记录所有变更
       │
       └── 6. 返回结果（含叙事 + 新状态 + 因缘变化）
              │
              ▼
[Client] Zustand store 更新
       │
       ├── 触发顶部状态栏 / 因缘卡 / 主叙事区重渲染
       │
       └── 悬浮 "天道权衡中…" 关闭
              │
              ▼
[Player] 看到本年度剧情
```

**关键不变量**

- 在 `[LLM 端点]` 之后、引擎校验之前的任何产出都是 **不可信的**。
- 引擎校验通过的内容 **一定** 反映到 StateChangeLog。
- 客户端绝不直接信任 AI 输出，必须等引擎回包。

---

## 4. 核心模块

### 4.1 `types.ts`（全局类型）

所有跨模块共享的类型 / 接口 / 枚举都在这里：

- `ItemEntry`（物品）
- `StatusEntry`（状态）
- `EventTemplate` / `EventInstance`（事件）
- `Realm`（境界枚举）
- `BreakthroughQuality`（突破品质枚举）
- `EngineCommand` / `EngineResult`（引擎命令与结果）
- `ProposedContent` / `RegistrationResult`（内容提案与注册结果）

**改 `types.ts` 是高危操作**，必须配套更新：

- 对应 smoke 用例
- 对应 schema 校验（`content-registry.ts`）
- 对应展示规则（`display.ts`）
- 对应 Prompt 模板（`llm.ts`）

### 4.2 `engine.ts`（主流程引擎）

引擎的"主函数"。负责：

- 把玩家操作转成 `EngineCommand`
- 调用 AI 生成内容
- 校验 + 落库
- 返回 `EngineResult`

**主要函数（参考）**

| 函数 | 职责 |
|------|------|
| `processYear` | 处理一整年的事件 |
| `advanceYear` | 推进一岁（含年龄 + 因缘截止 + 状态衰减） |
| `resolveCombatTurn` | 结算一回合战斗 |
| `resolveBreakthrough` | 结算突破 |
| `resolveAlchemy` | 结算炼丹 |
| `resolveFormation` | 结算阵法 |
| `resolveMarket` | 结算坊市交易 |
| `resolveAuction` | 结算拍卖 |
| `resolveAscensionOutcome` | 结算飞升 |
| `resolveChoice` | 结算玩家选择 |
| `resolveInterfere` | 结算玩家介入 |
| `resolveItemUse` | 结算物品使用 |
| `resolveExploration` | 结算探索 |

### 4.3 `content-registry.ts`（内容注册中心）

**AI 内容的唯一入口**。所有 AI 生成的：

- 物品（ItemEntry）
- 状态（StatusEntry）
- 因缘（pendingThread）
- 境界变体
- NPC
- 事件（EventTemplate）

都必须经 `ContentRegistry.propose(...)` 注册。

注册流程：

```
ProposedContent (AI 输出)
   │
   ▼
[Schema 校验]      ── 失败：拒绝
   │
   ▼
[数值平衡校验]     ── 失败：拒绝 / 修改
   │
   ▼
[世界一致校验]     ── 失败：警告 / 拒绝
   │
   ▼
[边界校验]         ── 失败：拒绝 / 再生
   │
   ▼
[依赖校验]         ── 失败：拒绝
   │
   ▼
[类型特化校验]     ── 失败：拒绝 / 修改
   │
   ▼
[写入 entity-store] ── 返回 RegisteredContent + trace
```

每次注册都会留下 `ValidationTrace`，用于事后审计。

### 4.4 `effect-resolver.ts`（ERPE 数值结算）

**Single Source of Truth**——任何"攻击是多少"、"修为速度是多少"、"炼丹成功率是多少"的最终答案，都来自这里。

```
resolveAttribute(character, 'attack')
   │
   ▼
收集所有影响 attack 的活跃 Effect
   │
   ▼
按 operation 分层：
   override > add > multiply > cap / floor
   │
   ▼
返回最终数值
```

外部调用示例：

```ts
import { resolveAttribute } from '@/lib/xianxia/effect-resolver';

const finalAttack = resolveAttribute(character, 'attack');
// = 基础攻击 + 装备加成 + 状态加成 + buff 加成（已乘各种系数）
```

**禁止**：

- 直接读 `character.attack`（这是基础值，可能不等于最终值）
- 在组件里硬编"装备 +30 攻击 = 当前攻击 +30"

### 4.5 `ai-boundary-validator.ts`（AI 边界校验）

守住 AI 输出的最后一道关：

| 规则 | 说明 |
|------|------|
| `progression_locked` | 玩家当前境界不能获得超出范围的内容 |
| `undefined_effect` | AI 不能凭空给物品 / 状态加新效果 |
| `balance_violation` | 不能破坏数值平衡（如灵石价值、战斗力） |
| `deus_ex_machina` | 不能"天降神器" |
| `lore_contradiction` | 不能与已知世界矛盾 |

校验失败的动作：

- `pass`：通过
- `warn`：警告但通过
- `block_and_regenerate`：阻断并要求 AI 再生（最多 3 次）
- `block_and_fallback`：阻断并使用预设的安全默认值

### 4.6 `display.ts`（玩家可见文案 sanitize）

**所有面向玩家的文字都要经过这里**。常见 sanitize：

| 函数 | 作用 |
|------|------|
| `sanitizeNarrativeText` | narrative sanitize（去除 "AI" "预加载" 等机制词） |
| `sanitizeLootName` | 战利品命名（去除 "某某的 XX"） |
| `sanitizeBreakthroughProcessText` | 突破过程文案（去除 "突破之瞬" 等夸张表达） |
| `attributeLabel` | 内部 attribute key → 世界内表达 |
| `isVisibleNumericEventEffect` | 是否显示数值变化（0 值不显示） |
| `COMBAT_PROJECTION_LABELS` | 战斗相关 label 统一来源 |
| `LOADING_LABELS` | 加载文案统一来源 |

### 4.7 `display-registry.ts`（槽位投影规则注册）

每个 UI 槽位的展示规则都在这里注册：

- 槽位显示哪些数据
- 数量上限与排序规则
- 折叠阈值
- 扩展规则（如"3 普通状态 + 2 体质"）

---

## 5. AI 输出驱动层

### 5.1 Prompt 构造

`llm.ts` 中的 `PromptBuilder` 负责构造 Prompt。Prompt 分六层（按优先级降序）：

1. **系统设定**（恒定）—— AI 角色定位、修仙世界观、唯一例外原则
2. **场景行为**（动态）—— 当前是推进 / 战斗 / 突破 / 介入
3. **输入分类**（每条）—— 当前请求是 action / dialogue / overreach / rule_manipulation
4. **状态快照**（动态）—— 当前角色年龄 / 境界 / 状态 / 库存摘要
5. **检索记忆**（动态）—— Top-K 重要历史
6. **近期对话**（动态）—— 最近 N 轮对话

### 5.2 文风锚定

`style-anchor.ts` 注入文风锚点，防止 AI 文风漂移到：

- 现代都市
- 西幻
- 日式轻小说
- 网络爽文

锚点示例：

- 用"灵气"而非"魔力"
- 用"道友"而非"勇者"
- 修为用"境界 + 阶段"而非"等级 + 经验值"

### 5.3 输入分类

玩家输入会被 `InputClassifier` 分为 4 类：

| 类型 | 例子 | 处理 |
|------|------|------|
| `action` | "我去探那个山洞" | 转 EngineCommand 提交 |
| `dialogue` | "前辈，请问" | 让 NPC 自然回应 |
| `overreach` | "我直接飞升" | 拒绝并自然回绝 |
| `rule_manipulation` | "给我加个 buff" | 拒绝并提示 |

### 5.4 越权拒绝

越权拒绝有两类：

- **沉默拒绝**：用修仙世界内话术自然回绝，不出现"系统拒绝"等字样
- **显式阻断**：边界校验明确阻断，由 AI 再生或回退

`validateSilentRejectionOutput` 检查沉默拒绝的输出是否"够自然"。

---

## 6. 引擎校验层

### 6.1 校验的两阶段

- **阶段一（注册前校验）**：ContentRegistry 在 AI 提案落库前做 Schema / 数值 / 世界一致校验。
- **阶段二（边界校验）**：AI Boundary Validator 做事后扫描，防止"漏网之鱼"。

两阶段都失败才会真正阻断。

### 6.2 因果链（causalGraph lite）

每个因缘（pendingThread）都记录：

- 来源事件 ID
- 触发时间
- 关联 NPC / 物品 / 地点
- 解决路径

`event-scheduler.ts` 在推进时按因果链调度事件。

### 6.3 状态变更日志

任何状态变更都写入 `state-change-log.ts`：

```
StateChange {
  characterId
  age
  source (AI / manual / event / breakthrough / ...)
  field
  oldValue
  newValue
  reason
  timestamp
}
```

用于：

- 事后审计（玩家问"我什么时候丢的灵石？"）
- 回滚（开发阶段）
- AI 上下文（"你最近的变化"）

### 6.4 ERPE 的展开顺序

```
基础属性 (base_xxx)
   │
   ▼
装备加成 (ItemEntry.effects → StatusEntry)
   │
   ▼
状态加成 (StatusEntry.effects)
   │
   ▼
临时 buff / debuff
   │
   ▼
特殊规则（如心魔惩罚、突破期惩罚）
   │
   ▼
最终属性（resolveAttribute 返回值）
```

---

## 7. 前端槽位投影层

### 7.1 槽位分类

| 类别 | 槽位 | 说明 |
|------|------|------|
| 持久 | 状态栏 / 角色详情 / 库存 | 永远或大部分时间可见 |
| 临时 | 战斗 / 突破 / 渡劫 / 飞升 | 模态弹层，玩家主动关闭 |
| 流式 | 主叙事 | SSE 流式生成 |
| 弹出 | 介入 / 配置 / 重置 | 玩家主动触发 |

### 7.2 状态栏的展示规则

- 状态标签最多 3 个普通 buff，按时间倒序（最新在前）
- 体质标签最多 2 个，独立样式
- 心魔值用特殊图标
- 因缘数量用红色小点（紧迫因缘时高亮）

### 7.3 长文本处理

- 默认折叠（line-clamp）
- 显示"展开全部"按钮
- 折叠阈值由 `display.ts` 统一常量控制

### 7.4 战斗 UI

- 默认等待玩家出手（不自运）
- 出招中显示悬浮加载层
- 一旦胜负判定立即关闭加载层 + 自运
- 战利品名 sanitize（去除敌人归属）

### 7.5 移动端布局

- 90dvh 安全区
- 长内容滚动
- 按钮固定底部
- 模态弹层 fullscreen（小屏）

### 7.6 重置世界

- 使用游戏内确认弹窗（不是浏览器原生 confirm）
- 二次确认（输入"确认重置"或点击两次）
- 销毁所有本地数据

---

## 8. 持久化与时间

### 8.1 持久化方案

| 数据 | 存储 |
|------|------|
| 角色基础数据 | Prisma `Character` 表 |
| 状态变更日志 | Prisma `StateChangeLog` 表 |
| AI 产物 | Prisma JSON 字段 |
| 临时流式输出 | 不持久化（前端 SSE 缓存） |
| 玩家配置 | `.xianxia-ai-config`（本地文件，不入库） |

### 8.2 世界时间

`world-time.ts` 维护：

- 当前年（青岚仙历 5001 年起）
- 当前季节（春夏秋冬）
- 当前日期
- 当前时辰

时间推进规则：

- 1 推进 = 1 年
- 因缘 deadline 按年 / 月计算
- 修炼时间不消耗现实时间

### 8.3 存档 / 归档

- 当前游戏支持 5 个归档槽位
- 归档包含：完整状态 + 因缘 + 世界事实
- 重置世界 = 销毁当前档 + 归档
- 不支持云存档（暂）

---

## 9. 一次完整的端到端示例

**场景**：玩家在炼气期，新获得一把"灵木短剑"，装备后参与战斗。

**流程**：

```
1. [Player] 获得"灵木短剑"（AI 在某次推进中生成）
   │
   ▼
2. [Engine] ContentRegistry 注册 ItemEntry
   │
   ├── Schema 校验：通过
   ├── 数值校验：攻击力 +5 在炼气期合理
   ├── 世界一致：灵木短剑在当前世界类型中存在
   ├── 边界：非神器、非禁物
   └── 注册成功 → 写入 entity-store
       │
       ▼
3. [Player] 装备"灵木短剑"
   │
   ▼
4. [Engine] item/route.ts 装备路由
   │
   ├── 装备位校验：短剑 → 武器位
   ├── 状态机映射：ItemEntry(equip) → StatusEntry(duration=-1)
   └── ERPE 注册：attack += 5
       │
       ▼
5. [Engine] 进入战斗
   │
   ├── resolveAttribute('attack') = base 50 + 灵木短剑 5 + 修为阶段 10 = 65
   │
   ▼
6. [Client] 显示"灵木短剑 +5"在装备区；攻击显示 65
   │
   ▼
7. [Engine] 一回合战斗
   │
   ├── 玩家攻击：65 攻击
   ├── 敌人防御 30
   ├── 伤害 = max(65 - 30, 1) * (1 + 暴击伤害) = 35 * 1.5 = 52
   ├── AI 生成叙事："短剑刺入，敌人踉跄后退"
   └── 校验：伤害数值与装备一致
       │
       ▼
8. [Player] 看到叙事 + 伤害数字 + 装备仍显示"灵木短剑 +5"
```

**关键点**：

- AI 没有直接说"这把剑 +5"——是 ContentRegistry 校验后注入的。
- 攻击 65 不是组件硬编，是 ERPE 实时算的。
- 叙事是 AI 生成的，但"短剑刺入"这种细节是 AI 根据当前装备状态自然生成。

---

## 10. 演进与权衡

### 10.1 当前是"原型已通"

当前版本：

- ✅ 三层架构基本走通
- ✅ 核心 API 完整
- ✅ UI 槽位覆盖大部分场景
- ✅ Smoke 50+ 用例
- ⚠️ 因果链是 Lite 版
- ⚠️ ERPE 是 Lite 版
- ⚠️ AI 边界校验是 Lite 版

详见 [docs/GAP_ANALYSIS.md](GAP_ANALYSIS.md)。

### 10.2 已知权衡

| 权衡点 | 当前选择 | 理由 |
|--------|----------|------|
| 引擎语言 | TypeScript | 与前端共享类型，迭代快 |
| 数据库 | SQLite / PostgreSQL | 本地开发友好，扩展可换 |
| AI 协议 | OpenAI 兼容 | 火山方舟 / 自部署端点都支持 |
| 状态管理 | Zustand | 轻量、TS 友好 |
| 持久化粒度 | 状态变更日志 | 可审计、可回滚；代价是写入量稍大 |
| 文案 sanitize | 中心化函数 | 修改成本低；缺点是漏掉就出问题 |
| 移动端 | Web 优先 | 不绑 Unity，迭代快；后续可桥接 |

### 10.3 演进方向

#### 短期（Phase 2-3）

- 因果链加深（CausalGraph 完整版）
- ERPE 完整数值源
- AI 边界校验加强（更多越权场景）
- 状态变更日志查询 UI

#### 中期（Phase 4）

- ECS 改造（Entity-Component-System）
- 事件溯源（Event Sourcing + CQRS）
- 效果 DSL（让 operation 可扩展）

#### 长期

- Unity 客户端桥接（不重做，只桥接）
- 多语言 i18n
- 云存档

### 10.4 不要做的事

- ❌ 不要让 AI 直接读写数据库（哪怕是"只读"）
- ❌ 不要让前端直接调用 LLM（必须经引擎）
- ❌ 不要在 React 组件里硬编剧情
- ❌ 不要绕过 ContentRegistry 直接写 entity-store
- ❌ 不要在 display.ts 之外的地方 sanitize 文案
- ❌ 不要提交 `.xianxia-ai-config` 或日志

---

## 附录 A：API 路由清单（23 个）

| 路由 | 作用 |
|------|------|
| POST `/api/game/new` | 创建角色 |
| GET `/api/game/state` | 读当前状态 |
| POST `/api/game/advance` | 推进一岁 |
| POST `/api/game/advance-batch` | 批量推进 |
| POST `/api/game/advance-sse` | 流式推进 |
| POST `/api/game/preload-advance` | 预加载下一次选择 |
| POST `/api/game/choose` | 提交选择 |
| POST `/api/game/interfere` | 玩家介入 |
| POST `/api/game/combat` | 进入战斗 |
| POST `/api/game/combat/action` | 战斗出招 |
| POST `/api/game/item` | 物品使用 / 装备 |
| POST `/api/game/market` | 坊市买卖 |
| POST `/api/game/alchemy` | 炼丹 |
| POST `/api/game/formation` | 阵法 |
| POST `/api/game/pet` | 灵宠 |
| POST `/api/game/ascension` | 飞升 |
| POST `/api/game/tribulation` | 渡劫 |
| POST `/api/game/restriction` | 境界压制 |
| POST `/api/game/auction` | 拍卖 |
| POST `/api/game/exploration` | 探索 |
| POST `/api/game/settlement` | 结算 |
| POST `/api/game/reset-world` | 重置世界 |
| POST `/api/game/archive` | 归档 / 读档 |
| GET `/api/game/latest` | 最近一次结果 |

---

## 附录 B：相关文档

- [README.md](../README.md)
- [docs/DESIGN.md](DESIGN.md) — 当前实现对齐说明
- [docs/UI-RULES.md](UI-RULES.md) — UI 16 条规则
- [docs/GAP_ANALYSIS.md](GAP_ANALYSIS.md) — 待补强项
- [docs/CONTRIBUTING.md](CONTRIBUTING.md) — 贡献者指南
- [docs/PLAYER-GUIDE.md](PLAYER-GUIDE.md) — 玩家上手
- [docs/baseline/technical-design-v1.0-2026-06-17.txt](baseline/technical-design-v1.0-2026-06-17.txt) — v1.0 原始技术设计

---

> "三层各司其职、双层保险、UI 与游戏逻辑严格分离。" —— 这是我们写每一行代码前都会想一遍的话。