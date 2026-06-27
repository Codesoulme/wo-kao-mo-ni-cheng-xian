# perf-report.md — AI-104 engine cold-path audit

**suite**: `scripts/perf-engine-cold-path.ts`
**date**: 2026-06-27
**iterations**: 10000 per function
**threshold**: 100 µs/op (标记 hot-path)

## 测试目标

扫 `src/lib/xianxia/engine.ts` 里高频纯函数, 测量 cold-path 调用成本, 找 hot-path (>= 100 µs/op).

## 结果 (13 个函数, 0 hot-path)

| # | function | µs/op | total ms / 10k | hot? |
|---|----------|-------|----------------|------|
| 1 | `isMeaningfulStatus` | 1.51 | 15.13 | ✓ |
| 2 | `filterMeaningfulStatuses` | 2.72 | 27.16 | ✓ |
| 3 | `normalizeIdentityStatuses` | 6.78 | 67.75 | ✓ |
| 4 | `ensureUniqueIds` | 6.63 | 66.32 | ✓ |
| 5 | `tickStatusDurations` | 9.13 | 91.30 | ✓ |
| 6 | `tickNaturalRecovery` | 0.26 | 2.56 | ✓ |
| 7 | `recalcCultivationMultiplier` | 11.74 | 117.38 | ✓ |
| 8 | `computeEffectiveCultivationRate` | 6.49 | 64.85 | ✓ |
| 9 | `computeCultivationFactors` | 6.85 | 68.49 | ✓ |
| 10 | `normalizeCultivationState` | **42.11** | **421.09** | ⚠ 接近上限 |
| 11 | `applyChanges` | 1.23 | 12.29 | ✓ |
| 12 | `isConstitutionStatus` | 0.19 | 1.92 | ✓ |
| 13 | `deriveCultivationAttributes` | 20.06 | 200.64 | ✓ |

## 结论

- **无 hot-path**: 13 个函数全部 < 100 µs/op
- **最贵**的是 `normalizeCultivationState` (42 µs/op), 是 `recalcCultivationMultiplier` / `tickStatusDurations` / `deriveCultivationAttributes` 的 2-4 倍. 但 100k 调用才 ~4 秒, 仍在可接受范围
- 最高频组合 (`computeEffectiveCultivationRate` + `tickStatusDurations` + `tickNaturalRecovery`) 在 100 年连续推进里大约 600 µs/年, 1000 年 = 600 ms / 角色, 完全可控
- `tickNaturalRecovery` 仅 0.26 µs/op, 状态恢复几乎是 free

## 建议

- 不需要做预编译 / memoize
- 如果以后出现 10x 调用频率上升, 优先看 `normalizeCultivationState` 和 `deriveCultivationAttributes`
- 写 e2e 时建议 `recalcCultivationMultiplier` 用 lazy 调用 (state 没变就不重算)

## 文件位置

- 脚本: `E:\aigame2_publish\scripts\perf-engine-cold-path.ts` (9068 bytes)
- 原始结果: `logs/bench/engine-cold-path.<ts>.json`
- 此报告: `E:\aigame2_publish\perf-report.md`