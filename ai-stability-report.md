# AI Interface Stability Report

> Generated: 2026-06-27
> Script: scripts/test-ai-fallback.ts
> Raw data: logs/bench/ai-fallback.<timestamp>.json
> Scope: in-memory fetch + retry + fallback；不真打 Z.ai

## 1. 目的

AI-108: 守护"调用 AI 接口"这条链路在以下 4 类故障下的行为：

1. **网络/超时层**：ECONNRESET、socket timeout、连接被拒
2. **HTTP 状态层**：5xx（服务端瞬时故障）、429（限流）、4xx（客户端错误）
3. **内容层**：LLM 返回非 JSON / 截断 / 字段缺失
4. **降级层**：所有重试耗尽后，引擎层 fallback 内容是否可用

任何一类处理错（不重试 5xx / 重试 4xx / fallback 仍抛错），都会在 CI 失败。

## 2. 设计

### fetchJson 包装器

- **入参**：url + RetryPolicy + 一个 `fetcher(url) => FetchResult`（生产中是 `globalThis.fetch`，测试中是 in-memory mock）
- **策略**：maxRetries=3，baseDelay=50ms，maxDelay=800ms，指数退避 + 25% jitter
- **判定哪些错误可重试**：
  - 可重试：`status === 429`、`status >= 500 && < 600`、fetcher 抛错（NETWORK_ERROR/TIMEOUT）
  - 不可重试：4xx（非 429）、malformed JSON（说明 LLM 数据坏了，再试也白搭）
- **抛错语义**：用 `MockFetchError`（reason: 'server_error' | 'rate_limited' | 'client_error' | 'malformed_json' | 'network_error' | 'timeout' | 'exhausted'）

### callAIWithFallback

- 跑 fetchJson；成功 → 返回真实 content
- 失败 → 调用 `aiFallbackContent(prompt)` 兜底，标 `isFallbackGenerated: true`

### 虚拟时钟

- `VirtualClock.sleep` 不真睡眠，只累加当前时间戳
- `random()` 用当前时间戳取模，**确定性 jitter**，CI 不抖

## 3. 10 个测试用例与结果

| # | 场景 | 期望 outcome | 实际 attempts | 实际 reason | 实际 wait (ms) | 结果 |
| --- | --- | --- | ---: | --- | ---: | :---: |
| 01 | 一次成功 | success | 1 | — | 0 | ✓ |
| 02 | 500→503→成功 | success | 3 | — | 151 | ✓ |
| 03 | 500×3→成功（用尽预算） | success | 4 | — | 358 | ✓ |
| 04 | 500×4（用尽+1） | fallback | 4 | server_error | 358 | ✓ |
| 05 | 429→成功 | success | 2 | — | 50 | ✓ |
| 06 | ECONNRESET→成功 | success | 2 | — | 50 | ✓ |
| 07 | TIMEOUT→成功 | success | 2 | — | 50 | ✓ |
| 08 | 401 unauthorized | fallback | 1 | client_error | 0 | ✓ |
| 09 | 200 + HTML（非 JSON） | fallback | 1 | malformed_json | 0 | ✓ |
| 10 | 6 次 ECONNREFUSED（彻底掉线） | fallback | 4 | network_error | 358 | ✓ |

**结果汇总：10/10 全通过；success 6 例 / fallback 4 例。**

## 4. 关键 fallback 触发条件

按出现频次：

| 触发条件 | reason | 重试次数 | 兜底内容 | 是否抛错给上层 |
| --- | --- | ---: | --- | --- |
| 5xx 持续到 retry 用尽 | `server_error` | 3 (默认) | `aiFallbackContent` | 否（静默降级） |
| 429 重试到上限 | `rate_limited` | 3 | `aiFallbackContent` | 否 |
| 网络层连续断 | `network_error` | 3 | `aiFallbackContent` | 否 |
| 客户端错误（4xx） | `client_error` | 0（不重试） | `aiFallbackContent` | 否 |
| LLM 返回坏 JSON | `malformed_json` | 0（不重试） | `aiFallbackContent` | 否 |
| 重试预算耗尽 | `exhausted` | — | `aiFallbackContent` | 否 |

设计原则：**对上层永不抛错**。失败一定有兜底内容，让玩家游戏不会卡死。

## 5. 重试退避曲线（实际测量）

- attempt 1 → 2：delay = 50 + jitter ≈ 50–62ms
- attempt 2 → 3：delay = 100 + jitter ≈ 100–125ms
- attempt 3 → 4：delay = 200 + jitter ≈ 200–250ms
- maxDelay cap = 800ms

用例 02（2 次重试后成功）总等待 151ms（≈ 50 + 100 + jitter）
用例 03/04（3 次重试后成功/失败）总等待 358ms（≈ 50 + 100 + 200 + jitter）

## 6. 与现有 `src/lib/xianxia/llm.ts` 的对照

仓库里现行的 AI 调用是直接 `await fetch(endpoint, ...)` + 错误处理写在调用点（llm.ts 行 1177 / 1195 / 1286），**没有统一的 fetchJson / 重试预算 / 退避**。

本次脚本实现的是**契约级 mock 验证**，不是要替代 llm.ts。后续若要把 fetchJson 抽到 `src/lib/xianxia/ai-fetch.ts`，本脚本可以原样接入（fetcher 换成 `globalThis.fetch` 即可）。

## 7. 关键约束

- **不打真接口**：所有 response 来自 in-memory list（`scenario.responses`）
- **不依赖网络**：CI / 离线 / 本地都能跑
- **确定性**：jitter 用虚拟时钟模 1000，无 `Math.random()`，多跑结果一致
- **覆盖典型故障**：4 类（网络 / 5xx / 4xx / malformed）各至少 1 用例

## 8. 重新运行

```bash
bun scripts/test-ai-fallback.ts
```

最新结果打印在 stdout 末尾，JSON 落到 `logs/bench/ai-fallback.<ISO>.json`。

## 9. 结论

- AI-108 已交付：脚本 `scripts/test-ai-fallback.ts`（457 行）能 `bun` 跑通。
- 10 个用例覆盖 4 类故障模式，全通过。
- retry 策略（maxRetries=3 / 50ms / 800ms cap）实测符合指数退避预期。
- fallback 内容（`aiFallbackContent`）在所有失败路径上保证上层拿得到可用降级内容，永不抛错。
- 推荐把此脚本纳入 phase-f 后回归套件，作为"AI 接入层契约"的稳定基线。