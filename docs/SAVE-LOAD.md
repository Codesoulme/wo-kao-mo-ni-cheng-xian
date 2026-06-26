# 存档与读档（Save / Load）系统说明

> 本文档界定《我靠模拟成仙》的存档数据结构、版本策略、校验机制、迁移路径、玩家可见行为。
>
> **当前状态**：P2 pilot 阶段（文档 + smoke 验证，未触及 schema/真实存档）。正式实现将在下一批 P2 决议后落地。
>
> **维护纪律**：每次 schema 字段调整需同步本文档。

---

## 1. 存档数据契约

### 1.1 物理位置
- **数据库**：SQLite（开发） / PostgreSQL（生产）— Prisma ORM
- **位置**：`prisma/schema.prisma` 中 `Character` 模型
- **关联**：每个 Character 关联 `EventLog[]` / `ChoiceLog[]` / `InterferenceLog[]` / `AdvancePreload?`

### 1.2 关键字段（玩家核心状态）

| 字段 | 内部 key | 玩家可见性 | 存档必要性 |
|------|------|------|------|
| 基础信息 | id/name/createdAt/updatedAt | 部分 | 必须 |
| 年龄 | age/lifespan/gender | ✅ | 必须 |
| 修仙核心 | realm/realmLevel/cultivationExp/expToBreak | ✅ | 必须 |
| 灵根 | spiritualRoot/rootDetail | ✅ | 必须 |
| 五行 | elementMetal/Wood/Water/Fire/Earth | ✅ | 必须 |
| 基础属性 | hp/mp/attack/defense/speed/luck/comprehension | ✅ | 必须 |
| 资源 | spiritStones/reputation | ✅ | 必须 |
| 状态 | alive/ascended/causeOfDeath | 部分 | 必须 |
| 身份 | faction/master/location | ✅ | 必须 |
| 命节点 | fateNodes/isAtChoice/lastEventAge | 部分 | 必须 |
| JSON 状态 | statusJson/inventoryJson/equippedJson | 渲染 | 必须 |
| 修炼速度 | cultivationMultiplier/cultivationInsight/cultivationFactorsJson | ✅ | 必须 |
| 抉择 | pendingChoiceJson | 渲染 | 必须 |
| 长期记忆 | memoryJson | 内部 | 必须 |
| 未决线索 | pendingThreadsJson | ✅ | 必须 |
| 角色意图 | characterIntentsJson | 部分 | 必须 |
| 战斗中 | combatStateJson | 渲染 | 必须 |
| 反重复 | recentEventTypesJson/recentBlueprintCategoriesJson | 内部 | 必须 |
| NPC | npcsJson | 渲染 | 必须 |
| 因果图 | causalGraphJson | 内部 | 必须 |
| 世界事实 | worldFactsJson | 内部 | 必须 |
| 心魔 | heartDemon | ✅ | 必须 |
| 灵宠 | petsJson | ✅ | 必须 |
| 风格锚 | styleAnchorsJson | 内部 | 必须 |
| 实体库 | entityEntriesJson | 内部 | 必须 |
| 秘境 | exploredRealmsJson | ✅ | 必须 |
| 世界历 | worldCalendarJson | ✅ | 必须 |

### 1.3 关联表
- `EventLog[]`：每岁事件流水
- `ChoiceLog[]`：玩家选择记录
- `InterferenceLog[]`：因果介入记录
- `AdvancePreload?`：预加载推进结果（可丢弃，丢失不影响主存档）

---

## 2. 版本与校验（P2 pilot 待落地）

### 2.1 Schema Version
- 新字段：`schemaVersion` (Int, default = 1)
- 用途：每次 schema 升级时 +1，前端读档时识别旧版
- 兼容性：见 §3

### 2.2 Schema Checksum
- 新字段：`schemaChecksum` (String)
- 算法：核心字段的 SHA-256（前 16 字符）
- 用途：检测"未声明但已变更"的字段
- 失败策略：UI 警告玩家存档可能损坏，让其选择"尝试恢复"或"重开"

### 2.3 存档格式（导出）
- 文件格式：JSON
- 路径：`localStorage['aigame-save-<characterId>']`
- 包含：完整 Character 字段 + 关联 EventLog/ChoiceLog/InterferenceLog
- 大小预估：1-5 MB / 1000 岁

---

## 3. 兼容性策略（P2 pilot 待落地）

### 3.1 向前兼容
- 新字段一律加 `default` 值，老存档读取时 Prisma 自动填充
- 字段删除：保留 1 个版本后迁移到 `_deprecated_` 前缀

### 3.2 向后兼容
- 读档时若 `schemaVersion < current`，按迁移脚本链处理：
  1. `v0 → v1`：基础字段补充
  2. `v1 → v2`：新增 cultivationFactorsJson 字段（default `[]`）
  3. ...
- 迁移失败：保留原存档，让玩家选择"跳过迁移 / 重置角色"

### 3.3 JSON 字段兼容
- 每个 `*Json` 字段读取时做 try-parse，失败时 fallback 到 default（`[]` 或 `{}`）
- 关键 JSON 字段：`statusJson / inventoryJson / pendingThreadsJson / combatStateJson / worldFactsJson / npcsJson / causalGraphJson`

---

## 4. 损坏恢复（P2 pilot 待落地）

### 4.1 检测信号
- Prisma 读失败 → UI 提示"读档失败"
- `schemaChecksum` 不匹配 → UI 提示"存档版本不匹配"
- JSON 字段 parse 失败 → 该字段用 default

### 4.2 恢复策略
- **轻损**（JSON 字段 parse 失败）：该字段用 default，不影响其他字段
- **中损**（关键字段缺失）：UI 列出缺失字段，让玩家选择"跳过 / 重置"
- **重损**（schema 不识别）：禁止读档，提示玩家联系开发者

### 4.3 备份
- 每次写入前自动 `localStorage['aigame-save-<id>-backup']`
- 玩家可手动"导出存档"（JSON 下载）

---

## 5. 玩家可见行为

### 5.1 自动存档
- 触发点：每次 `/api/game/advance` / `/api/game/choose` / `/api/game/item` 等接口成功返回时
- 频率：约每岁一次 + 战斗每回合

### 5.2 手动存档
- 入口：`GameMenu` 中"导出存档"
- 导出：下载 JSON 文件
- 导入：`GameMenu` 中"导入存档" → 选 JSON 文件 → 验证 → 替换当前角色

### 5.3 玩家可见文案（世界内化）
- "存档" → "记此身于此世"
- "读档" → "返此身于此世"
- "存档失败" → "命数未及记下"
- "存档损坏" → "此身命数已乱"
- "存档版本不匹配" → "世易时移，旧身难返"

---

## 6. Smoke 验证清单

| Smoke | 验证项 |
|------|------|
| `smokeSaveLoadIntegrity` | schema 完整性 + checksum 计算 |
| `smokeSaveLoadBackwardCompat` | 旧版 schema 读档不报错 |
| `smokeSaveLoadCorruptionRecovery` | JSON 字段 parse 失败 → default 兜底 |
| `smokeSaveLoadPlayerVisibleText` | 存档/读档文案世界内化 |
| `smokeSaveLoadBlueprintDocsExist` | docs/SAVE-LOAD.md + blueprints/save-load-blueprint.md 存在 |

---

## 7. P2 pilot 状态

- ✅ 文档：本文 + `docs/blueprints/save-load-blueprint.md`
- ✅ Smoke：5 条已在 `scripts/xianxia-regression-smoke.ts`
- ⏳ Schema 字段：未落地（边界"真实存档"）
- ⏳ 实际写入/读取逻辑：未落地（边界"engine 状态机核心"）

---

## 8. 后续落地计划

| 批次 | 内容 |
|------|------|
| P3 | 新增 schema 字段（schemaVersion / schemaChecksum）+ Prisma migration |
| P3 | 读档时 checksum 校验 + UI 警告 |
| P3 | 手动导出/导入 UI |
| P4 | 自动备份机制 |
| P4 | 迁移脚本链 |

---

## 9. 与其他文档的关系

- `docs/DESIGN.md`：核心循环 → 存档是核心循环的"持久化层"
- `docs/UI-RULES.md`：存档相关的玩家可见文案世界内化（见 §5.3）
- `docs/blueprints/save-load-blueprint.md`：技术实现细节（数据流 + 错误处理路径）