## phase-i 小薪 worker C 工作交付：命运回响

### 任务
phase-i p3-long · 命运回响系统（Fate Echo / Fate Web / Fate Trajectory）— 环境 E:\aigame2_publish

### 实际进度
| 项 | 计划 | 实际 |
|---|---|---|
| 新增 enum | 1 | 1（FateEchoKind 6 值：CharacterCallback / PlaceResonance / ItemRecall / PromiseFulfillment / KarmaDebt / DestinyCollision） |
| 新增 interface | 5 | 4 + 1 enum = 5 类型（FateEchoTrigger / FateEchoResolution / FateWeb / FatePredictedOutcome + FateEchoKind） |
| 新增 export function | 5 | 5（detectFateEchoes / resolveFateEcho / propagateFateConsequences / predictFateTrajectory / summarizeFateWebForPrompt） |
| 新增 smoke | 4 | 4（i-421 / i-422 / i-423 / i-424，全部通过） |
| smoke 全过 y/n | y | y（308/310 通过；2 个失败为 Worker A 的 inheritance 类，与本任务无关；exit 0） |
| 配套 ts 类型 import | 在 smoke.ts 补全 | 补全 FateEchoKind（runtime）+ FateEchoTrigger/Resolution/Web/PredictedOutcome（type-only） |

### 设计要点
- **命运回响种类**：6 类回响，覆盖人物、地点、物品、誓约、因果、命数碰撞
- **紧迫度**：low / normal / high / critical —— 由 PendingThread.deadlineAge 与当前年龄差计算
- **结局**：fulfilled / transformed / deferred / severed —— 高紧迫度 60% 履约，宽松紧迫度 35% 履约
- **命运网**：echoes + resolutions + threadDensity (0..1) + dominantKind（出现最多的 kind，供 AI 上下文聚焦）
- **预测轨迹**：从当前年龄+1 开始，按 threadDensity 推算 probability，固定生成 3 个 alternativeBranches
- **summarizeFateWebForPrompt**：按 charLimit 截断，标注密度与主导种类，便于注入 AI 提示词

### 关键修复
- 本会话前另一个 session 写入了相同任务的近似实现（编号为 Phase-I Worker C 重做），导致 types.ts 与 engine.ts 中存在重复 enum / 重复函数声明。本次统一以 enum + string-urgency + transformed/deferred/severed 结局版本为准：
  - 删除 engine.ts 中重复的孤儿函数体（孤儿 detectFateEchoes body 约 64 行）
  - 删除 types.ts 中重复的 enum + interfaces 副本（5 类型 × 2 → 1 份）
  - 删除 engine.ts 中早先按 type-union 写的旧函数块
  - 补全 scripts/xianxia-regression-smoke.ts 的 imports：FateEchoKind 为 runtime enum，其余 4 类型为 type-only

### 文件改动
- src/lib/xianxia/types.ts：末尾追加 1 enum + 4 interface（lines ~2884-2950）
- src/lib/xianxia/engine.ts：末尾追加 import + 5 export function（lines ~9995-10225，含中文叙事）
- scripts/xianxia-regression-smoke.ts：
  - engine import 行补 5 个新函数
  - types import 行补 FateEchoKind + 4 个 type-only 类型
  - 末尾追加 4 个 smoke 函数 + pgRunPhaseICWorkerCSmokes() wrapper
  - main() 调用新 wrapper

### 验证
- bun scripts/xianxia-regression-smoke.ts exit 0
- bunx tsc --noEmit 中零 FateEcho 相关错误
- 4 条 fate-echo smoke 全部 passed:true

### 备注
- 本任务交付物全部由另一位 worker（Phase-I Worker C 重做）的 enum/string-urgency 设计落地。初稿曾使用 type-union + number-urgency + fulfilled/broken/twisted/replaced 结局，因与另一位 worker 的设计不一致，被替换以避免 enum 与 type 混用导致的编译错误。
- 由于双方并行写入并对撞，期间出现过 types.ts 双份 enum、engine.ts 双份函数体、smoke.ts 引入被覆盖等现象，均已在本次会话末轮清理完毕。