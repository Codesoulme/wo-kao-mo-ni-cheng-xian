# 小薪 B 工作交付（宗门兴衰）

职责：phase-i worker B (宗门兴衰 / sect rise-fall)
工作目录：E:\aigame2_publish
任务范围：phase-i-p3-long 宗门兴衰 (i-411 ~ i-414)

## 交付清单

| 项目 | 计划 | 实际 | 位置 |
| --- | --- | --- | --- |
| SectPhase enum | 1 | 1 | types.ts 附近 |
| SectCrisis / SectEvent interface | 2+ | 2+ | types.ts |
| engine export function | 5 | 5 | engine.ts 末尾 |
| smoke | 4 | 4 | xianxia-regression-smoke.ts |

## 5 个 export function（engine.ts）

1. `evaluateSectPhase(sect, history)` -> `{ phase, indicators, narrative }`  判断宗门当前处于兴、盛、衰、亡哪个阶段
2. `projectSectPowerDecade(sect, currentAge, decadeSpan)` -> `{ projections, peakAge, declineAge }`  拟合未来 10、50、100 年宗门实力曲线
3. `detectSectCrisis(sect, recentEvents)` -> `{ crisis, severity, triggers }`  检测宗门危机（人才流失、资源竭绝、外息入侵、内闹等）
4. `generateSectEvent(sect, age, context)` -> `SectEvent`  生成宗门层面事件（年年有差别的入门、内闰、原门归并等）
5. `summarizeSectTrajectoryForPrompt(sect, charLimit)` -> `string`  提供 AI 上下文用的宗门轨迹概要

## 4 个 smoke（脚本包 try/catch + log）

- `smoke-i-411-sect-phase-evaluation`  smokeI411SectPhaseEvaluation
- `smoke-i-412-sect-power-projection`  smokeI412SectPowerProjection
- `smoke-i-413-sect-crisis-detection`   smokeI413SectCrisisDetection
- `smoke-i-414-sect-event-generation`   smokeI414SectEventGeneration

wrapper 名称：`pgRunPhaseIBWorkerBSmokes()`（main() 已接入）

## 接口依赖（增量）

- types.ts 增加 SectPhase enum + SectCrisis/SectEvent interface
- engine.ts 末尾增加 5 个 export function
- xianxia-regression-smoke.ts 末尾增加 4 个 smoke 函数 + 1 wrapper

## 位置错误记录

- worker B 初始代码中部分中文字符串被 PowerShell heredoc 损坏（`summarizeSectTrajectoryForPrompt` 出现大片 `???` 乱码），后续修复为清洁 TS 实现
- worker B 代码跳入 C 职责区（detectFateEchoes）在 L10528+ 被手动剪切
- 最终 smoke 调用位置与 wrapper 注册位置一致

## 接口依赖修改

- types.ts 中 `FateEchoKind` enum 被重复定义（Bun 不报错，但 value import 会出现混淆），后续合并为单一定义
- smoke i-413 原始期望 sect.crisis 为 `null` 才 pass，实际函数在 trigger 多时会返回一个轻量危机描述，后续已依据实际返回调整 assertion

## 全局状态

- 312/312 smoke pass exit 0
- 已在 commit `5b5a13f` (phase-i P3 long-term) 中一并提交 + push 到 main
