# owner 决议书:combat-labels-rollback-and-category-enum-fix

## 1. 会议/决议

- **会议**: `.handoff/combat-labels-rollback-and-category-enum-fix/` (kickoff-and-handover 分支)
- **决议来源**:`task.md`(玩家可见 label `攻/守/敏` 回滚为 `破势/护持/机变` + `engine.ts` category 中文 enum 改回英文 `body/spirit/dao/combat/fate/custom`)
- **决议执行人**:小新(计划) / 小虾(评审 + 验证)
- **决议日期**:2026-06-26,HEAD `605749e`
- **本次决议**:见第 4 节

## 2. 事实核查(2026-06-29 code reality check)

对照 `xiaoxin-plan.md` P0/P1 改动清单逐一核验,结果如下:

### P0 玩家可见 label `攻/守/敏 → 破势/护持/机变`

| 文件 | plan 要求 | 现状(grep 命中) | 结果 |
|---|---|---|---|
| `src/components/xianxia/StatusPanel.tsx` line 58-60 | 用 `破势/护持/机变` | unicode escape `破势护持机变` = `破势护持机变`,已存在 | 已符合 |
| `src/components/xianxia/CharacterDetailSheet.tsx` line 222-224 | 用 `破势/护持/机变` | 字面量 `破势/护持/机变` 三处,已存在 | 已符合 |
| `src/lib/xianxia/display.ts` `MECHANISM_PATTERNS` | `attack/defense/speed → 破势/护持/机变` | `force/guard/agility → 破势/护持/机变`,已存在 | 已符合(且更准确,plan 用的是旧词) |

**反向验证**:全仓 `grep` 单字 label `攻/守/敏`(作为独立 label,非词组) → **0 命中**。其余出现都是合法语义词(`攻符威能/守成/攻伐/攻势` 等),非玩家可见属性标签。

### P1 `engine.ts` category enum 改回英文

| 文件 | plan 要求 | 现状 | 结果 |
|---|---|---|---|
| `src/lib/xianxia/engine.ts` line 344/374 | `category = 'body'`(英文 enum) | 字面量 `'body'`,已存在 | 已符合 |

**结论**:代码层面已 100% 满足 plan P0 + P1 要求,无需改动。

### `xiaoxin-fix.diff` 为空的原因

`xiaoxin-fix.diff` 文件大小 37 字节,内容仅为标题行 `# 此文件保留以记录 git diff,正常情况为空文件。` —— 这与代码现实一致:**plan 文档陈旧,实际修复已在更早 phase(phase-x 14 面板接入时)顺手完成,本次并未触发新 diff**。`[FIX] 未开始` 状态是因为没人真正动手改;不需要改 = 未开始 = 正确状态。

## 3. 结论

1. `xiaoxin-plan.md` 状态 `[FIX] 未开始` 是**文档陈旧**,不代表代码未修复
2. 代码层面已**完整满足** plan 的 P0(玩家可见 label 中文化)+ P1(category enum 英文化)要求
3. **建议关闭此 task** —— 不需要 P0 改动,不需要 P1 改动,不需要 smoke 改动
4. `xiaoxin-fix.diff` 保持空文件状态,**不补 diff**(理由同 #3)
5. 后续若发现 label 遗漏(例如"攻符威能"是否应改"破势符威能"),另立 follow-up task

## 4. 决策

- 接受本结论,**关闭此 task**
- 不执行 P0 / P1 代码改动
- 不补 `xiaoxin-fix.diff`
- 不重跑 smoke(代码未变,无回归风险)
- 后续如发现 label 遗漏 → 新开 `.handoff/<followup>/` task

决议人:一万万(项目 owner)
决议日期:2026-06-29

## 5. 附件引用(本目录其他文件状态)

| 文件 | 状态 | 备注 |
|---|---|---|
| `task.md` | 已读完 | mojibake 严重但格式保留;标题 `战斗标签回滚 + engine.ts 分类 enum 回滚` 可识别 |
| `xiaoxin-plan.md` | 已读完 | 完整中文,可读;P0/P1/smoke 清单清晰,**但状态字段陈旧** |
| `xiaoxia-review.md` | 已读完 | mojibake 严重,仅可识别章节标题;结论条目与 plan 一致 |
| `xiaoxia-verification.md` | 已读完 | mojibake 严重,但"已验证项"列表与 plan P0/P1 对齐 |
| `xiaoxin-fix.diff` | 37 字节 | 仅一行注释,无 diff —— **正确状态**(无需改 = 无 diff) |

**附录**:本次决议由 owner 直接给出,未走 `xiaoxin-fix` → `xiaoxia-verification` 流程,因为 plan 内容已无执行必要。