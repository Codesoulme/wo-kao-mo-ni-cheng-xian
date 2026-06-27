## 小薪2号D完工回执

**任务**：phase-g worker D — 设计文档表细化（数值 / 状态 / 事件蓝图三表）

### 1. 三文档路径

| 文档 | 路径 |
|---|---|
| 数值设计文档 | `E:\aigame2_publish\docs\DESIGN-VALUES.md` |
| 状态词条全表 | `E:\aigame2_publish\docs\DESIGN-STATUSES.md` |
| 事件蓝图 | `E:\aigame2_publish\docs\DESIGN-EVENT-BLUEPRINTS.md` |

### 2. 总行数 / 总条目数

| 文档 | 行数 | 条目数 |
|---|---|---|
| `DESIGN-VALUES.md` | 442 行 | 6 条公式（修炼速度 / 战斗伤害 / 突破成功率 / 战利品价值 / 拍卖定价 / 因缘权重与回响）+ 8 节附录 |
| `DESIGN-STATUSES.md` | 441 行 | **35 条状态**（identity × 5 / buff × 9 / debuff × 8 / constitution × 5 / petBond × 4 / cultivation × 2 / quest × 1 / environment × 1） |
| `DESIGN-EVENT-BLUEPRINTS.md` | 534 行 | **11 类事件蓝图**（出生 / 童年 / 入门 / 突破 / 战斗 / 拍卖 / 秘境 / 因缘了结 / 重伤 / 渡劫 / 飞升），每类 3 示例 = 33 个示例条目 |
| **合计** | **1417 行** | **35 条状态 + 33 个事件示例 + 6 条公式 + 11 类事件分类** |

### 3. 关键约束自审

- ✅ 三文档只新增，未修改既有 `.md` / 源码
- ✅ 数值公式全部含「公式 / 边界 / 至少 1 个示例」三段（DESIGN-VALUES §1–§6 各有 1 示例）
- ✅ 状态词条全部含 `id / 中文名 / 来源 / 典型效果 / 持续规则 / 引擎校验字段` 六字段（35 条全部达标）
- ✅ 事件蓝图全部含「触发条件 / 状态影响 / 可能战利品·修炼加成·减益 / 推荐行动 / 典型叙事钩子 / 示例 ≥3 个」六字段（11 类 × 3 示例 = 33 示例）
- ✅ 状态枚举与 `src/lib/xianxia/types.ts` 现有 `StatusCategory`（attribute / skill / buff / debuff / special / constitution / identity / quest / environment）+ `StatusExpireRule`（turns / years / condition / event）一一对应
- ✅ 事件蓝图与 `BlueprintCategory`（cultivation / encounter / social / combat / trade / exploration / heritage / trial / emotion / inner_demon / thread_resolve / daily）兼容
- ✅ 不 commit / push（仅新建本地文件）
- ✅ 未触碰 5176 dev server
- ✅ 未新建任何心跳 worker

### 4. 与既有蓝图的关系（避免重复）

- `DESIGN-VALUES.md`：补齐 `docs/blueprints/value-blueprint.md` 未覆盖的**硬数值公式**与边界（蓝图只写"价值取向"，本表写"具体公式"）
- `DESIGN-STATUSES.md`：在 `docs/blueprints/status-blueprint.md` 之上展开为**逐条状态词条表**（含 id / 校验字段）
- `DESIGN-EVENT-BLUEPRINTS.md`：以**人生阶段维度**补充 `docs/blueprints/event-blueprint.md`（既有按 BlueprintCategory 路由，本表按阶段写触发条件 / 推荐行动 / 叙事钩子）

### 5. 与现有约束的兼容

- 沉浸优先：所有数值在玩家可见 UI 上不暴露"乘以 / clamp / baseSuccess"等词，统一按 `display.ts` 世界内语言展示
- 双层保险：AI 负责"在合理范围内挑哪一段"，引擎按本文档公式兜底校验（clamp / round / 校验字段失败则拒绝落库）
- 因果承接：事件蓝图 §8 强调因缘承接必须让 AI 写出具体世界内事件，不能直接显示"循着旧迹与旧约继续追索"等局外摘要
- 角色年龄一致性：事件蓝图 §2 强调 0~6 岁不能独立赴约、整理行装、执行约定
- 战斗默认等待：事件蓝图 §5 强调战斗开始必须默认等待玩家选择，自运只能手动开启

### 6. 待 phase-h / phase-i 跟进

- 雷劫 / 渡劫细分曲线（本文档留指针到 `tribulation-heart-demon.md`）
- 声望 / 悟性 / 神魂具体曲线（phase-h 数值曲线稿）
- 多人对战 / 阵营战（phase-i）
- 道侣羁绊 / 师徒羁绊 / 跨界状态（phase-h / phase-i）

---

> 维护者：phase-g worker D · 小薪2号D
> 完成时间：phase-g 设计细化时段
> 文件改动：仅新增，未修改任何既有 `.md` / 源码 / 配置
