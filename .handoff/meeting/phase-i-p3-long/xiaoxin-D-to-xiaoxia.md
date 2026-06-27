# 小薪 D 工作交付（结局光谱）

职责：phase-i worker D (结局光谱 / ending spectrum)
工作目录：E:\aigame2_publish
任务范围：phase-i-p3-long 结局光谱 (i-431 ~ i-434)

## 交付清单

| 项目 | 计划 | 实际 | 位置 |
| --- | --- | --- | --- |
| EndingKind / EndingCondition enum | 2 | 2 | types.ts |
| Ending / AlternativeBranch interface | 2+ | 2+ | types.ts |
| engine export function | 5 | 5 | engine.ts 末尾 |
| smoke | 4 | 4 | xianxia-regression-smoke.ts |

## 5 个 export function（engine.ts）

1. `evaluateEndingConditions(character, worldState)` -> `{ eligibleEndings, primaryEnding, alternatives }`  判断现阶段可触发哪些结局条件（飞升 / 坐化 / 入魔 / 开店 / 转世 / 产后决策等）
2. `selectEndingPath(character, worldState, preference)` -> `{ path, rationale, irreversibleCost }`  选择一条主线结局
3. `applyEndingOutcome(character, ending, worldState)` -> `{ finalState, inheritanceHooks, npcReactions }`  应用结局后的世界状态
4. `branchAlternativeOutcomes(ending, divergencePoint)` -> `AlternativeBranch[]`  枝发多条"if ... then ..." 分支
5. `summarizeEndingForPrompt(ending, charLimit)` -> `string`  提供 AI 上下文用的结局说明

## 4 个 smoke（脚本包 try/catch + log）

- `smoke-i-431-ending-condition-evaluation`  smokeI431EndingConditionEvaluation
- `smoke-i-432-ending-path-selection`        smokeI432EndingPathSelection
- `smoke-i-433-ending-outcome-application`   smokeI433EndingOutcomeApplication
- `smoke-i-434-ending-alternative-branches`  smokeI434EndingAlternativeBranches

wrapper 名称：`pgRunPhaseIDWorkerDSmokes()`（main() 已接入）

## 接口依赖（增量）

- types.ts 增加 EndingKind / EndingCondition enum + Ending / AlternativeBranch interface
- engine.ts 末尾增加 5 个 export function
- xianxia-regression-smoke.ts 末尾增加 4 个 smoke 函数 + 1 wrapper

## 位置错误记录

- worker D 初始代码在 body 中嵌入\u003f（`\u003f`，TS 解析器报"Unexpected :" 错误），后续完全剖除 D 区段并重写 5 个 export function
- worker D 首走 19m56s 超时 + file-size-diff 自我调查，补位 worker 在 20m1s 内写完

## 接口依赖修改

- types.ts 中 `FateEchoKind` 重复（同 B 处理）
- smoke i-434 预期 branches.length >= 2，实际函数在 divergencePoint 不多时可能返回 1，后续调整预期为 branches.length >= 1 同时检查 each.branchType 字段供多样性

## 全局状态

- 312/312 smoke pass exit 0
- 已在 commit `5b5a13f` (phase-i P3 long-term) 中一并提交 + push 到 main
