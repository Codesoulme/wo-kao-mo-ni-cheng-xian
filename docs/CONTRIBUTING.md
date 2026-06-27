# 贡献者开发指南

> 给想给《我靠模拟成仙》添砖加瓦的人看。
> 读者画像：会 TypeScript / React / Next.js，但对项目结构尚不熟悉的开发者。

---

## 目录

- [开发环境](#开发环境)
- [代码组织总览](#代码组织总览)
- [常见开发任务](#常见开发任务)
- [Pull Request 流程](#pull-request-流程)
- [Smoke 测试清单](#smoke-测试清单)
- [文档与交接（.handoff）](#文档与交接handoff)
- [玩家可见 UI 修改自检清单](#玩家可见-ui-修改自检清单)
- [AI Prompt / Schema 修改自检清单](#ai-prompt--schema-修改自检清单)
- [常见坑](#常见坑)

---

## 开发环境

### 推荐工具

| 工具 | 用途 |
|------|------|
| Node.js 20+ 或 Bun 1.x | 运行时 / 包管理 / 跑 Bun 脚本 |
| VS Code 或 Cursor | 编辑器 |
| ESLint 9 | 静态检查（已集成） |
| Prisma CLI | 数据库 schema 管理 |
| Git | 版本控制 |

### 一次性初始化

```bash
bun install           # 或 npm install / pnpm install
bun run db:push       # 初始化数据库
bun run dev           # 启动 dev server（默认 3000；Phase-F 期间是 5176）
```

启动后访问 `http://localhost:3000`（或 `5176`）能开游戏即视为成功。

### 编辑器建议

- 安装 ESLint 扩展，自动 lint
- 安装 Prisma 扩展，自动高亮 schema
- 安装 MDX 扩展（如果你要改 `docs/` 里的 markdown）

---

## 代码组织总览

```
src/
├─ app/                          # Next.js App Router
│  ├─ page.tsx                   # 入口页
│  ├─ layout.tsx                 # 全局布局
│  └─ api/
│     ├─ ai-config/              # AI 配置读写
│     ├─ ai-config/test/         # AI 配置连通性测试
│     ├─ game/                   # 游戏主流程 API（23 个路由）
│     │  ├─ new/                 # 创建角色
│     │  ├─ state/               # 读当前状态
│     │  ├─ advance/             # 推进一岁
│     │  ├─ advance-batch/       # 批量推进
│     │  ├─ advance-sse/         # 流式推进（SSE）
│     │  ├─ preload-advance/     # 预加载下一次选择
│     │  ├─ choose/              # 提交选择
│     │  ├─ interfere/           # 玩家介入
│     │  ├─ combat/              # 战斗回合
│     │  ├─ combat/action/       # 战斗出招
│     │  ├─ item/                # 物品使用 / 装备
│     │  ├─ market/              # 坊市买卖
│     │  ├─ alchemy/             # 炼丹
│     │  ├─ formation/           # 阵法
│     │  ├─ pet/                 # 灵宠
│     │  ├─ ascension/           # 飞升
│     │  ├─ tribulation/         # 渡劫
│     │  ├─ restriction/         # 境界压制
│     │  ├─ auction/             # 拍卖
│     │  ├─ exploration/         # 秘境 / 地图探索
│     │  ├─ settlement/          # 结算
│     │  ├─ reset-world/         # 重置世界
│     │  ├─ archive/             # 归档 / 读档
│     │  └─ latest/              # 最近一次结果
│     └─ system/                 # 健康检查等
├─ components/
│  ├─ ui/                        # shadcn/ui 基础组件（不直接改）
│  └─ xianxia/                   # 修仙专用组件（33 个；按需修改）
└─ lib/
   ├─ prisma.ts                  # Prisma 客户端
   ├─ utils.ts                   # 通用工具
   └─ xianxia/                   # 引擎 + AI 核心（最重要的代码）
      ├─ types.ts                # 全局类型（ItemEntry / StatusEntry / ...）
      ├─ llm.ts                  # AI 调用 + Prompt 构造
      ├─ engine.ts               # 主流程引擎（推进、选择、状态变更）
      ├─ content-registry.ts     # 内容注册中心（AI 产物的统一入口）
      ├─ effect-resolver.ts      # ERPE 数值结算（攻击 / 防御 / 修为速度）
      ├─ ai-boundary-validator.ts # AI 越权 / 越阶校验
      ├─ display.ts              # 玩家可见文案 sanitize（关键）
      ├─ display-registry.ts     # 槽位投影规则注册（关键）
      ├─ store.ts                # Zustand 全局状态
      ├─ event-scheduler.ts      # 事件调度器
      ├─ state-change-log.ts     # 状态变更日志
      ├─ world-time.ts           # 世界时间（年 / 月 / 日 / 时辰）
      ├─ advance-preload.ts      # 推进前的预加载逻辑
      ├─ advance-fallback.ts     # AI 失败时的回退逻辑
      ├─ constitution.ts         # 体质系统
      ├─ body-growth.ts          # 身体成长曲线
      ├─ settlement.ts           # 结算逻辑
      ├─ entity-store.ts         # 实体存储（NPC / 物品 / 状态）
      ├─ event-effects.ts        # 事件效果应用
      ├─ narrative-body-modifier.ts
      ├─ narrative-inference.ts
      ├─ secret-realm-utils.ts
      ├─ style-anchor.ts         # 文风锚定（防止 AI 文风漂移）
      └─ ai-config-client.ts     # 客户端读 AI 配置

scripts/
├─ xianxia-regression-smoke.ts   # 主回归 smoke（必须通过）
├─ perf-engine-cold-path.ts      # 性能审计
├─ audit-types-deep.ts           # 类型审计
├─ audit-smoke-coverage.ts       # smoke 覆盖审计
├─ e2e-player-journey.ts         # 端到端玩家旅程测试
├─ test-ai-fallback.ts           # AI 回退测试
└─ ...

docs/                            # 设计 / 技术 / UI 文档
prisma/                          # Prisma schema 与迁移
public/                          # 静态资源
```

---

## 常见开发任务

### 改一个玩家可见的标签

例：把 `pendingThreads` 的"未了因缘"标题文案改一下。

1. **不要**直接改组件里的字面值
2. 找到标签名定义的位置：`src/lib/xianxia/display.ts` 或 `display-registry.ts`
3. 改 sanitize 函数 + 文案常量
4. 跑 `bun run smoke:xianxia`，确认所有 smoke 仍然通过
5. **不要** 暴露内部 key（"deadline"、"pending" 这种英文 ID 不能让玩家看见）

### 加一个新的 UI 槽位

例：在角色详情里新增一个"近期经历"折叠区。

1. 在 `src/components/xianxia/` 下新建组件文件
2. 把组件挂到合适的位置（通常是 `CharacterDetailSheet.tsx` 内）
3. 如果需要新的展示规则（如折叠阈值），在 `display.ts` 加常量
4. 跑 `bun run smoke:xianxia`
5. 跑 `bun run lint`
6. 跨设备验证：浏览器开发者工具切到手机尺寸看

### 加一个新的引擎函数

例：实现 `derivePetCultivationSuggestion(pet, character)`。

1. 在 `src/lib/xianxia/engine.ts`（或拆出独立模块）加函数
2. 在 `types.ts` 加相关枚举 / 接口
3. 在路由（如 `src/app/api/game/pet/route.ts`）里调用
4. 写一个 smoke 用例（参考 `scripts/xianxia-regression-smoke.ts`）
5. 跑 smoke + lint

### 加一个新的 AI Prompt 字段

例：让 AI 生成的物品包含"使用环境"。

1. 改 `src/lib/xianxia/llm.ts` 里的 Prompt 模板
2. 改 `types.ts` 里对应的 `ItemEntry` 接口
3. 改 `content-registry.ts` 的校验逻辑
4. 同步更新 `docs/ARCHITECTURE.md` 与对应 smoke
5. 在 `scripts/xianxia-regression-smoke.ts` 加新用例

### 加一条新的 AI 边界规则

例：禁止 AI 给凡人直接发灵石。

1. 在 `src/lib/xianxia/ai-boundary-validator.ts` 加规则函数
2. 在 `content-registry.ts` 调用链中挂上
3. 写 smoke 用例验证拦截 + 验证回退文本
4. 跑 smoke + lint

---

## Pull Request 流程

### 1. 分支命名

```
feat/xxx          # 新功能
fix/xxx           # 修 bug
refactor/xxx      # 重构（不改行为）
docs/xxx          # 文档
chore/xxx         # 杂项
test/xxx          # 测试
```

### 2. 提交前必跑

```bash
bun run lint
bun run smoke:xianxia
```

两条都必须通过。

### 3. 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

例：

```
feat(engine): add derivePetCultivationSuggestion

- 灵宠根据主人灵根 + 性格推导培养方向
- 5 档枚举：combat / assist / transform / contract / inherit
- engine.ts 主流程调用，pet route 暴露 API
- 新增 smoke 用例：smokePetCultivationSuggestionBasic

Refs: AI-95
```

### 4. Review 检查项（自我审查）

- [ ] `bun run lint` 通过
- [ ] `bun run smoke:xianxia` 通过
- [ ] 如果改了 `types.ts`，确认 `tsc --noEmit` 也通过
- [ ] 如果改了 AI Prompt，同步改了 smoke 和 schema
- [ ] 如果改了 UI，同步检查 [docs/UI-RULES.md](UI-RULES.md) 16 条
- [ ] 没有提交 `.xianxia-ai-config`、`node_modules`、`.next`、日志等
- [ ] 没有引入新的依赖（或在 PR 描述中说明理由）
- [ ] 没有直接修改 `docs/baseline/` 下的 v1.0 基准文档

### 5. 合并

- Squash & merge 为主
- 标题清晰，含 issue / AI 编号（如 AI-95）
- 描述里点出"测试证据"（smoke 通过的输出片段）

---

## Smoke 测试清单

主 smoke：`bun run smoke:xianxia`

覆盖范围（持续扩展中）：

| 模块 | 用例数量（参考） |
|------|------|
| 状态标签排序 / 折叠 | 3 |
| 战斗默认等待 / 自运关闭 | 2 |
| 战利品命名 / 自然生成 | 3 |
| 突破过程文案 | 1 |
| 因缘 / 库存 / 状态 长文本 | 3 |
| AI 加载文案 sanitize | 1 |
| 因缘承接改写（幼龄 / 错过） | 2 |
| ContentRegistry 校验 | 4 |
| AI 边界校验（越权 / 越阶 / 引用未知 item） | 5 |
| **合计** | **50+** |

新增功能必须配套新增至少 1 个 smoke 用例，否则不能合并。

---

## 文档与交接（.handoff）

### `.handoff/` 是什么

私人项目内部的 **任务交接目录**。每个 phase、每个 worker 的任务、回执、汇总都放在这里。

```
.handoff/
└─ meeting/
   ├─ agenda.md                  # 当前 phase 议程
   └─ phase-X-name/
      ├─ worker-A-task.md        # A 任务卡
      ├─ worker-B-task.md
      ├─ worker-C-task.md
      ├─ worker-D-task.md
      ├─ xiaoxin-A-to-xiaoxia.md # A 回执
      └─ ...
```

### 命名约定

- `worker-X-task.md`：分派给小薪 worker X 的任务卡
- `xiaoxin-X-to-xiaoxia.md`：小薪 X 给小虾的回执
- 文件名是 **约定的**，不要改

### 回执格式

每次完成一个任务，往你的 `xiaoxin-X-to-xiaoxia.md` 追加一段：

```markdown
## <任务名>回执

- 改动文件：
  - <文件 1>（+N 行 / -M 行）
  - <文件 2>（+N 行）
- 验证：smoke 通过 / lint 通过 / tsc 通过
- 备注：<任何需要主 agent 注意的>
```

全部任务完成后，最后追加 `## 小薪2号X 完工回执`，列出所有交付物路径 + 行数。

---

## 玩家可见 UI 修改自检清单

修改任何 `src/components/xianxia/*.tsx` 前，先回答：

1. **这条文案会不会让玩家看到 AI / 预加载 / 缓存 / 失效 / id 等机制词？**
   - 有 → 改文案，或加 sanitize 函数
2. **状态标签数量是否符合 3 普通 + 2 体质规则？**
3. **长文本是否有折叠 + 展开入口？**
4. **战斗 / 突破 / 飞升 模态打开时，是否会触发自运？**
5. **加载层是否在结果出现时立即关闭？**
6. **移动端（90dvh）下内容会不会被裁掉？**
7. **战利品名是否还残留"某某的 XX"？**
8. **境界栏是否被错误地显示了身份（炼气候补杂役等）？**

完整规则见 [docs/UI-RULES.md](UI-RULES.md)。

---

## AI Prompt / Schema 修改自检清单

修改 `src/lib/xianxia/llm.ts` 或 `types.ts` 前，先回答：

1. **schema 是否新增了字段？** 是 → 同步 `content-registry.ts` 的校验
2. **是否新增了枚举？** 是 → 同步所有用到这个枚举的 switch / if
3. **是否影响了玩家可见文案？** 是 → 同步 `display.ts` 的 sanitize
4. **是否影响了 ERPE 数值结算？** 是 → 同步 `effect-resolver.ts`
5. **是否新增了越权场景？** 是 → 在 `ai-boundary-validator.ts` 加拦截
6. **是否同步更新了 `docs/ARCHITECTURE.md`？**
7. **是否写了对应 smoke 用例？**

---

## 常见坑

### 1. 直接改 shadcn/ui 组件

`src/components/ui/` 是 shadcn 生成的基础组件。**不要直接改它们**。要做扩展，请在 `src/components/xianxia/` 下做包装。

### 2. 在 React 组件里写硬编剧情

剧情应该是 AI 生成 → 经引擎校验 → 写入状态 → 前端只读展示。不要在 React 组件里硬编"当 X 触发，显示 Y"——除非 X 是玩家操作 + Y 是固定 UI 文案。

### 3. 改 `display.ts` 但忘了 sanitize 链路

`display.ts` 是 **唯一** 玩家可见文案的清洗入口。改了 sanitize 函数但忘了在调用链挂上，等于没改。

### 4. 提交 `.xianxia-ai-config` 或日志

`.gitignore` 已经过滤 `.xianxia-ai-config`、`*.log`、`dev-server*.log` 等。提交前 `git status` 自查。

### 5. 改 schema 但忘了迁移

改了 `prisma/schema.prisma` 必须 `bun run db:push`（本地开发）或建迁移（生产）。否则 Prisma Client 与实际表结构不一致。

### 6. 跑 smoke 但忘了带 `--db`

`bun run smoke:xianxia` 默认不连数据库；如果你的用例要碰 DB，加 `--db`：

```bash
bun run smoke:xianxia -- --db
```

### 7. 端口冲突

Phase-F 期间约定端口 `5176`。如果 `lsof -i :5176`（或 PowerShell 的 `netstat -ano | findstr 5176`）发现被占用，**不要直接 kill**，先确认是不是 dev server 在跑——直接用就行。

---

## 价值观

- **AI 是伙伴，不是脚本**。Prompt 的语气要尊重 LLM，但底线要清楚。
- **引擎是法官**。任何 AI 输出必须经过校验，不存在"AI 直接落库"。
- **前端是舞台**。只承载和展示，不创作。
- **玩家是主角**。所有面向玩家的文案必须用修仙世界内的话术。
- **代码是注释的**。命名清晰胜过注释多。

---

> 写代码前先读 [docs/ARCHITECTURE.md](ARCHITECTURE.md)。
> 改 UI 前先读 [docs/UI-RULES.md](UI-RULES.md)。
> 改 AI 前先读 [docs/DESIGN.md](DESIGN.md) 第 4-7 章。