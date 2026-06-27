## 小薪2号B完工回执（完整）

**任务**：在 `scripts/xianxia-regression-smoke.ts` 末尾追加 6 条 smoke（smoke-g-111~smoke-g-116），对应 6 个新 engine 导出 + 6 个新 types。

### 文件字节数（os.path.getsize 实测）
- `src/lib/xianxia/types.ts`：**110959 bytes**（6 enum/interface 已存在）
- `src/lib/xianxia/engine.ts`：**385218 bytes**（6 export 已存在）
- `scripts/xianxia-regression-smoke.ts`：**321135 bytes**（已追加 6 smoke defs + wrapper + 6 fns 导入）

### types.ts 6 个新符号（Select-String 实核，>=1 次）
- `SecretRealmTriggerCondition` — L2330 `export type SecretRealmTriggerCondition =`
- `SecretRealmEntryAttempt` — L2341 `export interface SecretRealmEntryAttempt`
- `BidderArchetype` — L2357 `export type BidderArchetype =`
- `BidderBehaviorProfile` — L2364 `export interface BidderBehaviorProfile`
- `CombatCauseChain` — L2376 `export interface CombatCauseChain`
- `StalemateExit` — L2387 `export type StalemateExit =`

全部命中，每符号 >=1 次 ✓

### engine.ts 6 个新 export（Select-String 实核，>=1 次）
- `deriveSecretRealmAccess` — L7715 `export function deriveSecretRealmAccess(`
- `resolveSecretRealmEntry` — L7806 `export function resolveSecretRealmEntry(`
- `deriveBidderProfile` — L7866 `export function deriveBidderProfile(`
- `simulateBiddingRound` — L7926 `export function simulateBiddingRound(`
- `buildCombatCauseChain` — L7977 `export function buildCombatCauseChain(`
- `resolveStalemateExit` — L8022 `export function resolveStalemateExit(`

全部命中，每符号 >=1 次 ✓

### smoke 总数 / 全过（bun 实跑）
- 新增 G111-G116：**6 条**（期望 6 ✓）
- smoke 总数：**271 条**（注：原本任务书期望 257，但 xiaoxin-C-补阶段已在文件追加 15 条 G201-G215；最终文件 5611 行；总 smoke 271 = 250 baseline + 15 C-补 + 6 B-补）
- 全过：**是 ✓**（failed = 0）
- `bun scripts\xianxia-regression-smoke.ts` exit code：**0**

### smoke-g-111 ~ smoke-g-116 实测输出（来自 `bun scripts\xianxia-regression-smoke.ts`）
```
{"smoke":"smoke-g-111-secret-realm-access","passed":true,"canAttempt":true,"triggers":2}
{"smoke":"smoke-g-112-secret-realm-entry","passed":true,"entered":true,"denied":false}
{"smoke":"smoke-g-113-bidder-profile","passed":true,"elder":"wealthy-elder","schemer":"scheming-cultivator"}
{"smoke":"smoke-g-114-bidding-round","passed":true,"winner":"casual-pilgrim","finalPrice":133,"events":4}
{"smoke":"smoke-g-115-cause-chain","passed":true,...}
{"smoke":"smoke-g-116-stalemate-exit","passed":true,"exits":"deception|disengage|risky-strike|terrain-shift|ally-intervention"}
```

### 实现要点
1. **追加 6 个 smoke 函数 defs** 到 `scripts/xianxia-regression-smoke.ts` 末尾（每条 try/catch + function-call-error 兜底，至少 1 个 assert）：
   - `smokeNewG111SecretRealmAccess`：调用 `deriveSecretRealmAccess`，断言 `canAttempt: boolean` 且 `triggers` 含 `map-fragment`
   - `smokeNewG112SecretRealmEntry`：调用 `resolveSecretRealmEntry`，断言 `{ entered, sideEffect, narrativeHint }` 字段齐
   - `smokeNewG113BidderProfile`：调用 `deriveBidderProfile`，断言 `archetype` 是 BidderArchetype 之一
   - `smokeNewG114BiddingRound`：调用 `simulateBiddingRound`，断言 `{ winner, finalPrice, drama, postAuctionEvents }` 字段齐
   - `smokeNewG115CauseChain`：调用 `buildCombatCauseChain`，断言含 `action/trigger/opponentResponse/environmentalEffect`
   - `smokeNewG116StalemateExit`：调用 `resolveStalemateExit`，断言返回值是 StalemateExit 之一

2. **新增 wrapper**：文件末尾追加 `pgRunPhaseG116Smokes()` 包装 6 条调用

3. **插入调用点**：在 main() 末尾 `pgRunPhaseGGSmokes();` 前插入 `pgRunPhaseG116Smokes();`

4. **导入新增 6 个 fns** 到 line 5 engine import（按字母序合并）：`buildCombatCauseChain / deriveBidderProfile / deriveSecretRealmAccess / resolveSecretRealmEntry / resolveStalemateExit / simulateBiddingRound`

5. **修复 1 处 bug**（非新增函数，仅修复 syntax error）：engine.ts L8069 原 `const key = ${f.source}:;` 缺反引号，补全为 `` const key = `${f.source}:`; `` —— 这是 xiaoxin-C-补并行阶段引入的回归，不修整个引擎无法 parse，所有 smoke 全部失败

### 约束遵循
- ✅ 未 commit / push（`git status` 显示 modified 但未 staged/committed）
- ✅ 未动 store.ts / *.tsx / docs
- ✅ 未修改既有 engine/types 函数（仅修复 1 处 syntax 缺反引号，未改逻辑；engine.ts 其他函数和 types.ts 全部未改）
- ✅ 未动 5176 dev server
- ✅ 未新建心跳 worker

### 最终命令
```
bun scripts\xianxia-regression-smoke.ts
# exit code: 0
# 输出: 271 行 smoke 日志，0 failed
# 新增 6 条 G111-G116 全部 passed:true
```