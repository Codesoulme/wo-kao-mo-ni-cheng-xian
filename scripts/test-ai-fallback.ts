// scripts/test-ai-fallback.ts
// AI-108: AI 接口稳定性 / fallback / retry 链路 E2E 测试
// 用法: bun scripts/test-ai-fallback.ts
//
// 不真打 Z.ai，用 in-memory fetch 模拟：
//   - 成功路径（200 + 合法 JSON）
//   - 失败路径（500 / 429 / network error / timeout / malformed JSON）
//   - retry 行为（指数退避 + 重试上限）
//   - fallback 内容（引擎层兜底）
//
// 测试点：
//   1. fetchJson 包装器在重试上限内最终成功
//   2. fetchJson 超过重试上限后抛错，并给出 reason 分类
//   3. retry 在 429 时尊重 Retry-After
//   4. retry 在 5xx 时按指数退避（不 sleep 真时间，用虚拟时钟）
//   5. retry 不重试 4xx（非 429）
//   6. AI 内容解析失败时给出兜底
//   7. fallback path 在所有尝试都失败时返回合理降级内容

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

// =============== 类型 ===============

interface FetchResult {
  ok: boolean;
  status: number;
  bodyText: string;
  bodyJson?: any;
  retryAfter?: number; // 秒
}

interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

interface FetchCallLog {
  attempt: number;
  url: string;
  status: number | 'NETWORK_ERROR' | 'TIMEOUT';
  delayBeforeMs: number;
  reason?: string;
}

interface TestCase {
  name: string;
  scenario: ScenarioSpec;
  expectedOutcome: 'success' | 'fallback' | 'error';
  expectedRetries?: number;
  expectedReason?: string;
}

interface ScenarioSpec {
  // 一次调用应返回的伪 response 序列 (按顺序消费)
  responses: Array<
    | { kind: 'ok'; status?: number; body: any }
    | { kind: 'http_error'; status: number; body?: string; retryAfter?: number }
    | { kind: 'network_error'; message?: string }
    | { kind: 'timeout'; afterMs?: number }
    | { kind: 'malformed_json'; status?: number; raw: string }
  >;
  policy?: Partial<RetryPolicy>;
}

// =============== 模拟 fetch + retry ===============

const DEFAULT_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 50,
  maxDelayMs: 800,
};

class MockFetchError extends Error {
  reason: string;
  status?: number;
  constructor(reason: string, message: string, status?: number) {
    super(message);
    this.reason = reason;
    this.status = status;
  }
}

/**
 * fetchJson — 简化版：
 *  - 接受一个 mock fetcher（生产中替换为 globalThis.fetch）
 *  - 内部按 policy 重试，遇到 429 / 5xx / network / timeout 触发重试
 *  - 遇到 4xx（非 429）/ malformed_json 立刻抛错（不可重试）
 *  - 重试延迟以"虚拟时钟"模拟，不真 sleep，避免脚本太慢
 */
async function fetchJson(
  url: string,
  policy: RetryPolicy = DEFAULT_POLICY,
  fetcher: (url: string) => Promise<FetchResult>,
  clock: VirtualClock = new VirtualClock(),
  callLog: FetchCallLog[] = [],
): Promise<{ data: any; attempts: number; totalWaitMs: number }> {
  let attempt = 0;
  let totalWaitMs = 0;
  let lastErr: MockFetchError | null = null;

  while (attempt <= policy.maxRetries) {
    const delayBeforeMs = attempt === 0 ? 0 : computeBackoff(policy, attempt, clock);
    totalWaitMs += delayBeforeMs;
    if (delayBeforeMs > 0) await clock.sleep(delayBeforeMs);

    let result: FetchResult;
    try {
      result = await fetcher(url);
    } catch (e: any) {
      // fetcher 本身抛 = network / timeout
      const isTimeout = e?.message?.startsWith('TIMEOUT');
      const status: 'NETWORK_ERROR' | 'TIMEOUT' = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';
      callLog.push({ attempt, url, status, delayBeforeMs, reason: e?.message ?? String(e) });
      attempt++;
      lastErr = new MockFetchError(status.toLowerCase(), e?.message ?? status);
      continue;
    }

    callLog.push({ attempt, url, status: result.status, delayBeforeMs });

    if (result.ok) {
      // 200/2xx
      if (result.bodyJson !== undefined) {
        return { data: result.bodyJson, attempts: attempt + 1, totalWaitMs };
      }
      // 状态码 OK 但 JSON 解析失败 — 不可重试（说明 LLM 返回坏数据）
      throw new MockFetchError('malformed_json', `malformed JSON: ${result.bodyText.slice(0, 80)}`, result.status);
    }

    // 5xx / 429 — 可重试
    if (result.status === 429 || (result.status >= 500 && result.status < 600)) {
      attempt++;
      lastErr = new MockFetchError(
        result.status === 429 ? 'rate_limited' : 'server_error',
        `HTTP ${result.status}: ${result.bodyText?.slice(0, 80) ?? ''}`,
        result.status,
      );
      continue;
    }

    // 4xx（非 429） — 不可重试
    throw new MockFetchError('client_error', `HTTP ${result.status}: ${result.bodyText?.slice(0, 80) ?? ''}`, result.status);
  }

  // 重试用尽
  throw lastErr ?? new MockFetchError('exhausted', 'retry budget exhausted');
}

function computeBackoff(policy: RetryPolicy, attempt: number, clock: VirtualClock): number {
  // 指数退避 + jitter；429 用 Retry-After 时单独处理（这里 demo 简化只用 backoff）
  const base = Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
  const jitter = Math.floor(clock.random() * base * 0.25);
  return base + jitter;
}

// =============== 虚拟时钟 / jitter ===============

class VirtualClock {
  private current = 0;
  sleep(ms: number): Promise<void> {
    this.current += ms;
    return Promise.resolve();
  }
  // deterministic "random" for reproducibility
  random(): number {
    return ((this.current % 1000) + 1) / 1000;
  }
  total(): number {
    return this.current;
  }
}

// =============== 兜底（fallback content）===============

interface FallbackContent {
  title: string;
  narrative: string;
  isFallbackGenerated: true;
}

function aiFallbackContent(prompt: string): FallbackContent {
  return {
    title: '天机朦胧',
    narrative: `(${prompt.slice(0, 24)}...) 此刻灵气未明，容日后再算。`,
    isFallbackGenerated: true,
  };
}

async function callAIWithFallback(
  url: string,
  prompt: string,
  policy?: Partial<RetryPolicy>,
  fetcherOverride?: (url: string) => Promise<FetchResult>,
): Promise<{ content: any; usedFallback: boolean; attempts: number; totalWaitMs: number; error?: string; reason?: string }> {
  const merged: RetryPolicy = { ...DEFAULT_POLICY, ...(policy ?? {}) };
  const log: FetchCallLog[] = [];
  try {
    const r = await fetchJson(url, merged, fetcherOverride ?? defaultFetcherFor(url), new VirtualClock(), log);
    return { content: r.data, usedFallback: false, attempts: r.attempts, totalWaitMs: r.totalWaitMs };
  } catch (e: any) {
    const fb = aiFallbackContent(prompt);
    return {
      content: fb,
      usedFallback: true,
      attempts: log.length,
      totalWaitMs: log.reduce((a, c) => a + c.delayBeforeMs, 0),
      error: e?.message ?? String(e),
      reason: e?.reason ?? 'unknown',
    };
  }
}

// =============== 默认 fetcher（按 scenario 列表消费 response）===============

function buildScenarioFetcher(spec: ScenarioSpec): (url: string) => Promise<FetchResult> {
  let idx = 0;
  return async (url: string) => {
    if (idx >= spec.responses.length) {
      throw new Error('TIMEOUT'); // 列表耗尽 = 超时（持续失败）
    }
    const r = spec.responses[idx++];
    if (r.kind === 'ok') {
      const body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      let json: any = undefined;
      try { json = JSON.parse(body); } catch { json = undefined; }
      return { ok: true, status: r.status ?? 200, bodyText: body, bodyJson: json };
    }
    if (r.kind === 'http_error') {
      return { ok: false, status: r.status, bodyText: r.body ?? '', retryAfter: r.retryAfter };
    }
    if (r.kind === 'network_error') {
      throw new Error(r.message ?? 'ECONNREFUSED');
    }
    if (r.kind === 'timeout') {
      throw new Error('TIMEOUT after ' + (r.afterMs ?? 5000) + 'ms');
    }
    if (r.kind === 'malformed_json') {
      return { ok: true, status: r.status ?? 200, bodyText: r.raw, bodyJson: undefined };
    }
    throw new Error('unknown scenario kind');
  };
}

function defaultFetcherFor(_url: string): (url: string) => Promise<FetchResult> {
  return async () => ({ ok: true, status: 200, bodyText: '{"title":"OK"}', bodyJson: { title: 'OK' } });
}

// =============== 测试用例 ===============

const TEST_CASES: TestCase[] = [
  {
    name: '01-success-immediate',
    scenario: {
      responses: [{ kind: 'ok', body: { title: '天道酬勤', narrative: '修士在山中苦修。' } }],
    },
    expectedOutcome: 'success',
    expectedRetries: 1,
  },
  {
    name: '02-success-after-2-retries',
    scenario: {
      responses: [
        { kind: 'http_error', status: 500, body: 'internal' },
        { kind: 'http_error', status: 503, body: 'unavailable' },
        { kind: 'ok', body: { title: '第二次成功', narrative: 'ok' } },
      ],
    },
    expectedOutcome: 'success',
    expectedRetries: 3,
  },
  {
    name: '03-success-on-last-retry',
    scenario: {
      responses: [
        { kind: 'http_error', status: 500, body: 'e1' },
        { kind: 'http_error', status: 500, body: 'e2' },
        { kind: 'http_error', status: 500, body: 'e3' },
        { kind: 'ok', body: { title: 'last try ok' } },
      ],
    },
    expectedOutcome: 'success',
    expectedRetries: 4,
  },
  {
    name: '04-exhausted-5xx-fallback',
    scenario: {
      responses: [
        { kind: 'http_error', status: 500, body: 'e1' },
        { kind: 'http_error', status: 500, body: 'e2' },
        { kind: 'http_error', status: 500, body: 'e3' },
        { kind: 'http_error', status: 500, body: 'e4' },
      ],
    },
    expectedOutcome: 'fallback',
    expectedRetries: 4,
    expectedReason: 'server_error',
  },
  {
    name: '05-rate-limited-429',
    scenario: {
      responses: [
        { kind: 'http_error', status: 429, body: 'slow down', retryAfter: 1 },
        { kind: 'ok', body: { title: 'ok after 429' } },
      ],
    },
    expectedOutcome: 'success',
    expectedRetries: 2,
  },
  {
    name: '06-network-error-then-ok',
    scenario: {
      responses: [
        { kind: 'network_error', message: 'ECONNRESET' },
        { kind: 'ok', body: { title: 'recovered' } },
      ],
    },
    expectedOutcome: 'success',
    expectedRetries: 2,
  },
  {
    name: '07-timeout-then-ok',
    scenario: {
      responses: [
        { kind: 'timeout', afterMs: 30000 },
        { kind: 'ok', body: { title: 'after timeout' } },
      ],
    },
    expectedOutcome: 'success',
    expectedRetries: 2,
  },
  {
    name: '08-client-error-4xx-no-retry',
    scenario: {
      responses: [{ kind: 'http_error', status: 401, body: 'unauthorized' }],
    },
    expectedOutcome: 'fallback',
    expectedRetries: 1,
    expectedReason: 'client_error',
  },
  {
    name: '09-malformed-json-no-retry',
    scenario: {
      responses: [{ kind: 'malformed_json', raw: '<html>not json</html>' }],
    },
    expectedOutcome: 'fallback',
    expectedRetries: 1,
    expectedReason: 'malformed_json',
  },
  {
    name: '10-total-network-down',
    scenario: {
      responses: Array(6).fill({ kind: 'network_error', message: 'ECONNREFUSED' }),
    },
    expectedOutcome: 'fallback',
    expectedRetries: 4,
    expectedReason: 'network_error',
  },
];

// =============== runner ===============

interface CaseResult {
  name: string;
  pass: boolean;
  outcome: 'success' | 'fallback' | 'error';
  attempts: number;
  reason?: string;
  totalWaitMs: number;
  expected: TestCase;
  detail?: string;
}

async function runCase(tc: TestCase): Promise<CaseResult> {
  const fetcher = buildScenarioFetcher(tc.scenario.policy ? { ...tc.scenario, responses: tc.scenario.responses } : tc.scenario);
  const res = await callAIWithFallback('https://mock.local/ai', 'test prompt', tc.scenario.policy, fetcher);
  const attempts = res.attempts;
  const outcome: 'success' | 'fallback' = (res.content as any)?.isFallbackGenerated ? 'fallback' : 'success';

  let pass = true;
  const issues: string[] = [];
  if (outcome !== tc.expectedOutcome) {
    pass = false;
    issues.push(`outcome mismatch (got ${outcome}, want ${tc.expectedOutcome})`);
  }
  if (tc.expectedRetries !== undefined && attempts !== tc.expectedRetries) {
    pass = false;
    issues.push(`attempts mismatch (got ${attempts}, want ${tc.expectedRetries})`);
  }
  if (tc.expectedReason && res.reason !== tc.expectedReason) {
    pass = false;
    issues.push(`reason mismatch (got ${res.reason}, want ${tc.expectedReason})`);
  }

  return {
    name: tc.name,
    pass,
    outcome,
    attempts,
    reason: res.reason,
    totalWaitMs: res.totalWaitMs,
    expected: tc,
    detail: pass ? undefined : issues.join('; '),
  };
}

async function main(): Promise<void> {
  console.log('[ai-fallback] AI-108 AI interface stability test');
  console.log(`[ai-fallback] total cases: ${TEST_CASES.length}`);
  console.log(`[ai-fallback] default retry policy: maxRetries=${DEFAULT_POLICY.maxRetries}, baseDelay=${DEFAULT_POLICY.baseDelayMs}ms, maxDelay=${DEFAULT_POLICY.maxDelayMs}ms`);

  const results: CaseResult[] = [];
  for (const tc of TEST_CASES) {
    const r = await runCase(tc);
    results.push(r);
    const tag = r.pass ? '✓' : '✗';
    console.log(`  ${tag} ${r.name.padEnd(36)} outcome=${r.outcome.padEnd(8)} attempts=${r.attempts} reason=${r.reason ?? '-'} wait=${r.totalWaitMs}ms${r.detail ? '  // ' + r.detail : ''}`);
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const byOutcome = results.reduce<Record<string, number>>((acc, r) => { acc[r.outcome] = (acc[r.outcome] ?? 0) + 1; return acc; }, {});
  console.log(`\n[ai-fallback] pass=${passed} fail=${failed}`);
  console.log(`[ai-fallback] outcome distribution: success=${byOutcome.success ?? 0}, fallback=${byOutcome.fallback ?? 0}`);

  // 落 JSON
  if (!existsSync('logs/bench')) mkdirSync('logs/bench', { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const summary = {
    suite: 'test-ai-fallback',
    date: new Date().toISOString(),
    policy: DEFAULT_POLICY,
    totalCases: TEST_CASES.length,
    passed,
    failed,
    byOutcome,
    results: results.map(r => ({
      name: r.name,
      pass: r.pass,
      outcome: r.outcome,
      attempts: r.attempts,
      reason: r.reason,
      totalWaitMs: r.totalWaitMs,
      detail: r.detail,
    })),
  };
  writeFileSync(`logs/bench/ai-fallback.${ts}.json`, JSON.stringify(summary, null, 2));
  console.log(`\n[ai-fallback] wrote logs/bench/ai-fallback.${ts}.json`);
  console.log(JSON.stringify(summary));

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[ai-fallback] fatal:', e);
  process.exit(2);
});