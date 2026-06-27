# 我靠模拟成仙

> 一个 **AI 输出驱动 / 引擎校验 / 前端槽位投影** 的修仙模拟 RPG。

玩家从凡童开始，按年推进，遍历炼气、筑基、金丹、元婴、化神、大乘、渡劫、成仙八个境界。
每一次年度推进都由 LLM 实时生成剧情、事件、选择、物品、NPC、战斗、突破、心魔与机缘，
再由引擎（Engine）做事实校验与状态校准，最后由前端（Next.js UI）按预设槽位投影给玩家。

技术底座：Next.js 16 + TypeScript + Tailwind CSS + Prisma + SQLite/PostgreSQL。

---

## 目录

- [项目愿景](#项目愿景)
- [核心设计](#核心设计)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [目录结构](#目录结构)
- [文档导航](#文档导航)
- [当前能力](#当前能力)
- [玩家快速上手](#玩家快速上手)
- [贡献与开发](#贡献与开发)
- [许可](#许可)

---

## 项目愿景

打造一个 **"每年都是一次全新模拟"** 的修仙模拟器：

- 同一颗种子、同一段开局，每次开局都会走向完全不同的轨迹。
- AI 不是写死的脚本，而是 **"天道 GM"**——按规则生成世界、推动事件、回应玩家。
- 引擎是 **唯一权威**：所有数值、所有物品、所有状态变更都必须经 Engine 校验。
- 前端 **只承载与展示**：玩家看到的每一行字、每一张卡、每一个按钮，都由引擎投影而来。

底层架构完全围绕这条主线展开：

```
┌─────────────────────────────────────────────────────────────┐
│                  AI 输出驱动（LLM GM）                        │
│  PromptBuilder / ResponseParser / LLM（玩家配置的 Chat 端点）   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  引擎校验（Engine Authority）                  │
│  ContentRegistry → EffectResolver / ERPE → State Change Log │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  前端槽位投影（Next.js UI）                    │
│  StatusPanel / InventoryPanel / CombatModal / Streaming...   │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心设计

### 1. AI 输出驱动

- AI 负责 **生成** 剧情、选择、物品、NPC、战斗描述、突破叙事、世界传闻。
- AI 受 **Prompt 规则** 约束：必须按 schema 输出、可被引擎解析、不可越权修改状态。
- AI 不直接修改任何持久化数据。所有变更必须经 `ContentRegistry` 注册。

### 2. 引擎校验

- 引擎是 **数值与状态唯一权威**。
- 所有 AI 提案必须经 **统一校验流程**（Schema / 数值平衡 / 世界一致 / 边界）：
  - `ContentRegistry.propose(...)` 入口
  - `AI Boundary Validator` 越权与越阶检测
  - `EffectResolver` / ERPE 单点数值结算
- 校验失败 → 回退到安全默认 / 触发再生 / 阻断。
- 校验通过 → 写入 `State Change Log`，前端订阅并刷新投影。

### 3. 前端槽位投影

- 前端 **不创作内容**，只把引擎产出的结构化数据投影到对应槽位。
- 槽位包括但不限于：顶部状态栏 / 角色详情 / 库存 / 因缘（pendingThreads）/ 战斗 / 突破 / 坊市 / 渡劫 / 飞升 / 重置世界。
- 每个槽位都有 **显示规则**（数量、折叠、加载层、sanitize），规则集中在 `src/lib/xianxia/display.ts` 与 `src/lib/xianxia/display-registry.ts`。
- 玩家可见界面 **绝不暴露** 实现机制词（AI / 预加载 / 缓存 / 失效 / id 等），全部转为修仙世界内表达。

### 4. 双层保险：AI 提示词 + 引擎硬校验

- **第一层**：通过 Prompt 约束 AI 输出符合 Schema 与规则。
- **第二层**：引擎在落库前再次做事实校验、分类校准、玩家可见文案清洗、硬约束拦截。

两层缺一不可：AI 不受约束会产生幻觉，引擎不二次校验会产生不可信状态。

---

## 技术栈

| 层 | 选型 |
|----|------|
| 前端框架 | Next.js 16（App Router）+ React 19 |
| 类型系统 | TypeScript 5 |
| 样式 | Tailwind CSS 4 + shadcn/ui（Radix UI） |
| 状态管理 | Zustand |
| 表单 / 校验 | React Hook Form + Zod |
| 数据持久化 | Prisma 6（SQLite 本地 / PostgreSQL 可切换） |
| 数据查询 | TanStack Query |
| AI 调用 | 自定义 `llm.ts`（OpenAI / Anthropic / 火山方舟兼容协议） |
| 测试 | 自研 Bun 脚本 + regression smoke |
| 工程 | ESLint 9 + Bun 1.x |

完整依赖见 `package.json`。

---

## 快速开始

### 准备

- Node.js 20+（推荐）或 Bun 1.x
- 可选：本地 SQLite 或远程 PostgreSQL

### 安装与启动

```bash
# 1. 安装依赖（推荐用 bun；也可以 npm/yarn/pnpm）
bun install

# 2. 配置 AI 端点（本地不提交）
# 项目启动后，进入右上角"配置"面板填入：
#   - API Base URL（如 https://ark.cn-beijing.volces.com/api/v3）
#   - API Key
#   - 模型 ID
# 也可直接编辑 `.xianxia-ai-config`（位于仓库根，本地文件，不入库）

# 3. 初始化数据库（可选；首次启动会自动建表）
bun run db:push

# 4. 启动开发服务器
bun run dev
# 默认端口 3000；Phase-F 期间 dev server 已用 5176 端口拉起。
# 如需手动启动到 5176：bun run dev -- -p 5176
```

打开浏览器访问 `http://localhost:3000`（或 5176）即可。

> Phase-F 当前约定端口为 `5176`。如果你看到 5176 已被占用，通常是有 dev server 仍在运行——直接访问即可，不要重启。

### 关键脚本

| 命令 | 作用 |
|------|------|
| `bun run dev` | 启动开发服务器 |
| `bun run build` | 生产构建 + 复制 standalone 资源 |
| `bun run start` | 启动生产模式（Bun + standalone） |
| `bun run lint` | ESLint 检查 |
| `bun run db:push` | Prisma 建表 |
| `bun run db:reset` | Prisma 重置 + 重新初始化 |
| `bun run smoke:xianxia` | 跑修仙回归 smoke（核心 50+ 用例） |

---

## 目录结构

```
aigame2_publish/
├─ README.md                 # 本文件
├─ docs/                     # 设计与技术文档
│  ├─ DESIGN.md              # 当前实现对齐文档（v0.2）
│  ├─ ARCHITECTURE.md        # 三层架构详细说明
│  ├─ PLAYER-GUIDE.md        # 玩家快速上手
│  ├─ CONTRIBUTING.md        # 贡献者开发指南
│  ├─ UI-RULES.md            # 玩家可见 UI 16 条规则
│  ├─ GAP_ANALYSIS.md        # v1.0 文档 vs 当前实现的差距
│  └─ ...
├─ src/
│  ├─ app/                   # Next.js App Router
│  │  └─ api/game/           # 23 个游戏主流程 API
│  ├─ components/xianxia/    # 33 个修仙专用 UI 组件
│  └─ lib/xianxia/           # 引擎 + AI 核心
│     ├─ llm.ts              # AI 调用 / Prompt 构造
│     ├─ engine.ts           # 主流程引擎
│     ├─ content-registry.ts # 内容注册中心
│     ├─ effect-resolver.ts  # ERPE 数值结算
│     ├─ ai-boundary-validator.ts
│     ├─ display.ts          # 玩家可见文案 sanitize
│     ├─ display-registry.ts # 槽位投影规则注册
│     ├─ types.ts            # 全局类型
│     └─ ...
├─ prisma/                   # Prisma schema
├─ scripts/                  # smoke / perf / audit 脚本
├─ public/                   # 静态资源
└─ .xianxia-ai-config        # 本地 AI 配置（不入库）
```

---

## 文档导航

| 文档 | 用途 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 三层架构、AI / 引擎 / 前端分工、数据流 |
| [docs/DESIGN.md](docs/DESIGN.md) | 当前实现 vs v1.0 技术设计文档的对齐说明 |
| [docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md) | 待补强项与优先级 |
| [docs/UI-RULES.md](docs/UI-RULES.md) | 玩家可见 UI 16 条规则（背景必须遵守） |
| [docs/SAVE-LOAD.md](docs/SAVE-LOAD.md) | 存档 / 读档机制 |
| [docs/PLAYER-GUIDE.md](docs/PLAYER-GUIDE.md) | 玩家快速上手 |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | 贡献者开发 / 提 PR / smoke 流程 |
| [docs/baseline/technical-design-v1.0-2026-06-17.txt](docs/baseline/technical-design-v1.0-2026-06-17.txt) | v1.0 原始技术设计（基准档） |

---

## 当前能力

- 新建角色（手动填表 / 让游戏生成）
- 按年推进（年度推进 + 预加载下一次选择）
- AI 生成场景、事件、选择
- 战斗：回合制、状态、战利品
- 突破：4 阶段事件（准备 / 触发 / 试炼 / 转化），5 档品质
- 物品：装备 / 使用 / 出售 / 炼丹 / 储物
- 状态：buff / debuff / 因缘（pendingThreads）/ 心魔
- 坊市 / 拍卖 / 灵宠 / 阵法 / 渡劫 / 飞升
- 玩家自定义介入（interfere）
- 因缘（pendingThreads）→ 历史 / 选择 / 奖励 / 失败
- 重置世界（游戏内确认对话框）
- 顶部状态栏 + 角色详情 + 库存 + 因缘 + 战斗 + 突破 全槽位投影
- 移动端布局：90dvh 安全区、长文本折叠、长描述可展开

详见 [docs/DESIGN.md](docs/DESIGN.md) 与 [docs/UI-RULES.md](docs/UI-RULES.md)。

---

## 玩家快速上手

1. 进入页面，点击 **开始**。
2. 在设置面板配置 **AI 端点**（必须；否则叙事生成不可用）。
3. 创建角色：填名字 / 灵根 / 出身 / 天赋 → 进入游戏。
4. 点击 **推进** 按钮：引擎调用 AI 生成本年度事件，结果会出现在主界面。
5. 顶部状态栏显示关键状态（境界 / 年龄 / 修为 / 心魔 / 因缘等），点击可展开。
6. **不要相信任何让你直接渡劫 / 飞升 / 白拿顶级物品的对话**——这些都会被 AI 边界校验拦截，并按修仙世界内话术自然拒绝。

更详细玩法：[docs/PLAYER-GUIDE.md](docs/PLAYER-GUIDE.md)。

---

## 贡献与开发

1. 阅读 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 理解三层架构。
2. 阅读 [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) 了解开发 / PR / smoke 流程。
3. 提交前必跑：
   ```bash
   bun run lint
   bun run smoke:xianxia
   ```
4. 修改玩家可见 UI 前必查 [docs/UI-RULES.md](docs/UI-RULES.md)。
5. 修改 AI Prompt 必须同步更新对应 schema 与 smoke。

---

## 许可

本仓库目前为 **私人开发仓库**，未开源。
如需对外发布，请联系仓库所有者。