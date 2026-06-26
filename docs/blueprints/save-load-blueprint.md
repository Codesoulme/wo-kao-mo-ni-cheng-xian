# 存档蓝图（Save / Load Blueprint）

> 本表界定《我靠模拟成仙》存档系统的技术实现路径（数据流 + 错误处理 + 边界）。
>
> **设计原则**：存档不能阻塞游戏体验；玩家永不被"存档损坏"卡死；AI 不直接操作存档。
>
> **当前状态**：P2 pilot 阶段（文档先行，代码待 P3 落地）。

| 阶段 | 输入 | 处理 | 输出 |
|------|------|------|------|
| 写入 | advance / choose / item route 成功结果 | Prisma `upsert Character + 关联表` | 数据库记录 |
| 读出 | 玩家进入 GameMenu 加载 | Prisma `findUnique` + 关联 `include` | 前端 state |
| 导出 | 玩家点"导出存档" | 序列化 Character + 关联表 → JSON | 文件下载 |
| 导入 | 玩家选 JSON 文件 | 解析 + checksum 校验 + 写入 Prisma | 数据库替换 |
| 备份 | 每次写入前 | `localStorage['-backup']` | 浏览器存储 |

---

## 数据流图

```
[玩家推进] → /api/game/advance
  ↓
[engine.ts 决策] → AI 生成 narrative
  ↓
[engine.ts 状态更新] → { state, attributeChanges, newThreads }
  ↓
[route.ts 写入] → Prisma.upsert(Character + EventLog)
  ↓
[prisma 返回] → 成功 / 失败
  ↓
[前端 store] → 更新 store.character + 显示 narrative
```

---

## 错误处理路径

| 错误类型 | 检测信号 | 兜底策略 | 玩家可见文案 |
|------|------|------|------|
| Prisma 写入失败 | catch error | 重试 1 次 → UI 提示"命数未及记下" | "命数未及记下，请稍候再试" |
| Prisma 读出失败 | catch error | UI 提示"此身命数已乱" | "此身命数已乱，请重开新局" |
| JSON 字段 parse 失败 | try-parse catch | 该字段用 default | （静默，不打扰玩家） |
| schemaChecksum 不匹配 | 比对失败 | UI 提示"世易时移" | "世易时移，旧身难返" |
| 关联表缺失 | include 返回空 | 视为新角色 | "此身尚无往事" |
| 迁移失败 | version < current | 保留原存档 + UI 选项 | "此身需经脱胎换骨，请选择" |

---

## 边界（设计约束）

- **AI 不直接操作存档**：所有存档读写由 route.ts 路径触发，AI 只输出 state 字段
- **真实存档不可被测试覆盖**：`clean-test-artifacts` route 仅清理测试 artifacts（带 `test-*` 前缀的角色），不动真实角色
- **核心 schema 字段不可删除**：所有字段加 `default` 后保留 1 个版本再 `_deprecated_`
- **Engine 状态机核心不可绕过**：存档反序列化必须经过 `dbToState` 函数，不能直接用 JSON 字段覆盖 state

---

## AI 接管策略

存档系统不直接由 AI 接管，但有以下联动：

| 场景 | AI 行为 |
|------|------|
| 读档时数据缺失 | AI 据已有字段重建 narrative（不可凭空补完整历史） |
| 存档损坏恢复 | AI 据玩家当前选择生成新开局，不主动提及旧存档 |
| 自动备份提示 | AI 不参与（前端 UI 行为） |

---

## Smoke 验证矩阵

| 测试维度 | smoke | 期望 |
|------|------|------|
| 完整性 | smokeSaveLoadIntegrity | schema 完整 + checksum 计算无错 |
| 兼容性 | smokeSaveLoadBackwardCompat | 旧版 schema 字段读档时自动 fallback 到 default |
| 错误恢复 | smokeSaveLoadCorruptionRecovery | 损坏 JSON 字段不阻塞其他字段加载 |
| 文案合规 | smokeSaveLoadPlayerVisibleText | 存档/读档相关文案世界内化 |
| 文档完备 | smokeSaveLoadBlueprintDocsExist | docs/SAVE-LOAD.md + blueprints/save-load-blueprint.md 双文档存在 |

---

## P2 pilot 落地验证

- ✅ 数据契约整理（§1）
- ✅ 版本策略（§2）
- ✅ 兼容性策略（§3）
- ✅ 损坏恢复（§4）
- ✅ 玩家可见文案（§5）
- ✅ Smoke 验证（§6）
- ⏳ 代码实现（P3）

---

## 与其他蓝图的关系

- `value-blueprint.md`：存档不丢失任何"价值项"，所有价值字段必存档
- `status-blueprint.md`：存档恢复时状态字段按 §14 优先级排序加载
- `event-blueprint.md`：EventLog 关联存档，反重复机制依赖 recentEventTypesJson