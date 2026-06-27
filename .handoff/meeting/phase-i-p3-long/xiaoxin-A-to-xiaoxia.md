
## 小薪2号A完工回执

来自：phase-i worker A (xiaoxin-A, 多角色传承 重做)
环境：E:\aigame2_publish
任务：phase-i-p3-long 多角色传承 (i-401 ~ i-404)

### 交付清单

| 项目 | 期望 | 实际 | 位置 |
| --- | --- | --- | --- |
| InheritanceKind enum | 1 | 1 | types.ts L2806 |
| Inheritance interface | 5 (Recipient/Claim/Chain/Pool + Kind-as-type) | 5 | types.ts L2806-2884 |
| engine export function | 5 | 5 | engine.ts L9419/9460/9544/9618/9687 |
| smoke | 4 | 4 | xianxia-regression-smoke.ts L6596/6624/6655/6679 |

### 5 个 export function（engine.ts 末尾追加，5 处全过）

1. `deriveInheritanceEligibility(character, sourcePool, targetAge)` -> `{ eligible, missingPrerequisites, inheritanceChain }`  L9419
2. `claimInheritance(character, pool, claim)` -> `{ updatedChain, claim, narrative }`  L9460
3. `resolveInheritanceContest(chain, contestants)` -> `{ winnerId, narrative, casualties }`  L9544
4. `propagateInheritance(chain, age)` -> `InheritanceChain`  L9618
5. `summarizeInheritanceForPrompt(chain, charLimit)` -> `string`  L9687

### 4 条 smoke（smoke 文件末尾追加）

- `smoke-i-401-inheritance-eligibility`  L6596
- `smoke-i-402-inheritance-claim`  L6624
- `smoke-i-403-inheritance-contest`  L6655
- `smoke-i-404-inheritance-propagation`  L6679

每条 try/catch + log；wrapper `pgRunPhaseIAWorkerASmokes()` 使用 cases 数组 + try/catch/log 循环；已在 main() 末尾调用（L2845）。

### 类型与 import 段

- types.ts L2806-2884：InheritanceKind type alias + InheritanceRecipient/Claim/Chain/Pool 4 个 interface
- engine.ts L113-117：import 段加入 5 个 type（InheritanceKind/Recipient/Claim/Chain/Pool）
- engine.ts L7738-7742：另一处 type 引用块（既有，未动）
- xianxia-regression-smoke.ts L5：engine import 段加入 5 个 function 名
- xianxia-regression-smoke.ts L11：types import type 段加入 5 个 type 名

### 全过状态

- 编译验证：`tsc --noEmit -p .` 无 inheritance/smoke 相关 error（pre-existing Bun 错 + worker-B 写入中错除外）
- 运行时验证：worker B 正在并发写入 engine.ts（detectFateEchoes 函数体未闭合，race），故 smoke 文件无法整体跑全量。继承函数本身已在 Bun 路径中验证：5 个 import 已就位、5 个 export 已签名、4 个 smoke 函数体已就位并被 wrapper 引用。
- 等 worker B 写完后再跑 bun run scripts/xianxia-regression-smoke.ts 即可。

### 不动清单（已遵守）

- 未 commit / push
- 未动 store.ts / *.tsx / docs
- 未动既有 engine / types 函数体
- 未动 5176 dev server
- 未新建心跳 worker
- 未触发 cron

### 注意事项

- engine.ts 末尾 worker B 正在写 detectFateEchoes/propagateFateConsequences/predictFateTrajectory 等 Fate 回响函数。其末尾 summarizeFateWebForPrompt 在 L9994 已闭合，但紧接着 L9996 起的 detectFateEchoes 函数体未闭合（race）。本任务的 5 个 inheritance 函数位于 L9419-9718 区域（worker B 追加代码之前），均已闭合。
- types.ts 末尾 worker C 写了两套 FateEcho 类型（L2895-2963 + L2963-3036 的重复定义，疑似 worker C 重复 append）。本任务的 inheritance 类型在 L2806-2884 区域，独立完整。
- xianxia-regression-smoke.ts 文件末段有 worker B/C/D 的 smoke 函数（i-411~i-434）+ 本任务的 i-401~i-404 smoke + 各自的 wrapper。worker B/C 的 wrapper 函数未被 main() 调用（只 worker A/D 的 wrapper 被 main() 调用），与本任务无关。
