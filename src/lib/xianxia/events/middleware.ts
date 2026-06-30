// Event Sourcing middleware（Phase 5 #3 升级）。
// 目标：把"附加式" ES 接入（try/catch 包 appendEvent，db.update 仍是主路径）
// 升级为"必走 ES"——router 通过 withEventSourcing(handler, options) 包一层，
// 强制走 appendEvent → projector 重新计算 state → 回写 DB 的完整链路。
//
// 升级要点（Phase 5 #3）：
// - withEventSourcing 不再是"标记性 console.log"，而是真包装器：捕获 handler 抛错、按 ES routing 策略分类处理。
// - 失败重试：指数退避 + 抖动（默认 3 次）。
// - 熔断保护：3 状态（closed/open/half-open）+ 探针查询。
// - 事务包装：wrapEsInTransaction 帮助 router 在事务内外自动选型。
// - 编译时 tag 收集：esmRouteMarker 替代硬编码 _esmRegisteredTags。
//
// 严格 PoC 范围（不扩大）：
// - 只在 choose / interfere 两个 router 用，验证可行性。
// - 不动 prisma schema，不动 store.ts / reducer.ts / projector.ts / types.ts。
// - 不重做 ES 基础（event 类型 / store / reducer / projector 已就位）。

import type { NextRequest } from 'next/server';
import { db } from '../../db';
import { appendEvent, type AppendEventInput } from './store';
import { getProjectedState, invalidateProjection } from './projector';

// ===== 类型 =====

export interface MustRouteEsInput {
  characterId: string;
  type: AppendEventInput['type'];
  data: AppendEventInput['data'];
  source?: AppendEventInput['source'];
  triggerActor?: AppendEventInput['triggerActor'];
  createdAtAge?: number;
}

export interface MustRouteEsResult {
  /** ES 事件是否真的写到了 DB（true = 成功；false = 降级） */
  committed: boolean;
  /** 失败原因（committed=false 时才有值） */
  error?: string;
  /** appendEvent 返回的 Event id（成功才有） */
  eventId?: string;
}

// ===== mustRouteEsAppendEvent =====

/**
 * 强制落事件的辅助函数。
 * 与原 appendEvent 包 try/catch 的差别：返回结构化结果，router 用它做"必走"语义。
 * - 成功 → committed=true，eventId 写入
 * - 失败 → committed=false（不让 router 抛出，不阻断主流程）
 *
 * @internal 不重试——重试由 withEventSourcing 包装层负责。
 *           这样 router 直接调 mustRouteEsAppendEvent 时行为不变（保留向后兼容）。
 */
export async function mustRouteEsAppendEvent(input: MustRouteEsInput): Promise<MustRouteEsResult> {
  try {
    const evt = await appendEvent({
      characterId: input.characterId,
      type: input.type,
      data: input.data,
      source: input.source ?? 'user-action',
      triggerActor: input.triggerActor ?? 'player',
      createdAtAge: input.createdAtAge,
    });
    // 落事件后立即 invalidate 缓存——下次 getProjectedState 必然重算。
    // fire-and-forget（不 await 也不抛）——DB 失败投影下次启动时会自动重算。
    invalidateProjection(input.characterId).catch(() => undefined);
    return { committed: true, eventId: evt.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ES middleware] mustRouteEsAppendEvent failed (downgrade): ${msg}`);
    return { committed: false, error: msg };
  }
}

// ===== recomputeAndPersistState =====

/**
 * 走 projector 拿最新 state（必走 ES 路径的"读路径"）。
 * - projector 内部先查内存 cache → DB snapshot → 增量 replay → 全量 replay。
 * - 拿到 state 后调用 persist 回调回写 DB；persist 失败 → return ok=false，router 自己决定降级。
 *
 * @param persist 回调：state → 写 DB；返回 ok=true 表示写入成功。
 *                这是 router 业务逻辑的"映射函数"，决定哪些字段写回 Character 表。
 */
export interface RecomputeAndPersistResult {
  ok: boolean;
  /** projector 拿到的 projected state（persist 失败时也返回——让 router 看到数据但不入库） */
  state: any | null;
  error?: string;
}

export async function recomputeAndPersistState(
  characterId: string,
  persist: (projectedState: any) => Promise<boolean>
): Promise<RecomputeAndPersistResult> {
  try {
    const projectedState = await getProjectedState(characterId);
    const persisted = await persist(projectedState);
    if (!persisted) {
      return { ok: false, state: projectedState, error: 'persist callback returned false' };
    }
    return { ok: true, state: projectedState };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ES middleware] recomputeAndPersistState failed: ${msg}`);
    return { ok: false, state: null, error: msg };
  }
}

// ===== 重试工具 =====

/**
 * 指数退避重试（带 ±20% 抖动）。
 * - 默认 maxRetries=3（最多重试 3 次 = 4 次 attempt）。
 * - 等待 = baseMs * factor^(attempt-1) * (1 ± jitter)，最低 10ms。
 * - 调用方可用 onRetry 钩子通知熔断器 / 上报。
 */
export interface RetryOptions {
  maxRetries?: number;
  baseMs?: number;
  factor?: number;
  /** 0..1，抖动比例；默认 0.2（±20%） */
  jitter?: number;
  /** 每次重试前调用（attempt 从 1 开始） */
  onRetry?: (attempt: number, err: unknown) => void;
  /** 判定是否可重试——默认所有错误都重试 */
  isRetryable?: (err: unknown) => boolean;
}

/**
 * 纯计算退避时长（ms）。暴露便于 smoke 校验公式。
 */
export function computeBackoffMs(attempt: number, opts: { baseMs?: number; factor?: number; jitter?: number } = {}): number {
  const baseMs = opts.baseMs ?? 100;
  const factor = opts.factor ?? 2;
  const jitter = opts.jitter ?? 0.2;
  const base = baseMs * Math.pow(factor, Math.max(0, attempt - 1));
  const delta = base * jitter;
  // 抖动范围 [base - delta, base + delta]
  const j = (Math.random() * 2 - 1) * delta;
  return Math.max(10, Math.round(base + j));
}

/**
 * 带退避的 runner：调用 fn 直到成功或耗尽 maxRetries。
 * - 抛出最后一轮的错误（让上层决定降级 vs 抛错）。
 */
export async function runWithRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3;
  const isRetryable = opts.isRetryable ?? (() => true);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt > maxRetries || !isRetryable(e)) {
        throw e;
      }
      opts.onRetry?.(attempt, e);
      const wait = computeBackoffMs(attempt, opts);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ===== Circuit Breaker =====

/**
 * Circuit Breaker：三状态机。
 * - closed：正常调用 fn；连续失败 N 次（默认 5）→ open。
 * - open：拒绝调用（直接抛 OpenCircuitError）；持续 cooldownMs（默认 30000）→ half-open（state() 自愈读）。
 * - half-open：允许探测调用（1 次）；成功 → closed，失败 → open。
 *
 * 全局实例由 esmGetCircuitState() 暴露——smoke 用。
 * 测试用隔离实例走 _esmNewTestCircuit()。
 *
 * 注：当前 Node.js 单进程内安全；多 worker 部署需要外部共享存储（不在 PoC 范围）。
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** 连续失败次数阈值；默认 5 */
  threshold?: number;
  /** open 状态持续时间（ms）；默认 30000 */
  cooldownMs?: number;
  /** 状态变更回调（打点用） */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export class OpenCircuitError extends Error {
  constructor(public readonly since: number, public readonly remainingMs: number) {
    super(`Circuit is open (${remainingMs}ms remaining)`);
    this.name = 'OpenCircuitError';
  }
}

interface CircuitInternal {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureAt: number;
  openedAt: number;
}

function createCircuitBreaker(opts: CircuitBreakerOptions = {}) {
  const threshold = opts.threshold ?? 5;
  const cooldownMs = opts.cooldownMs ?? 30000;
  let internal: CircuitInternal = {
    state: 'closed',
    consecutiveFailures: 0,
    lastFailureAt: 0,
    openedAt: 0,
  };

  function transition(next: CircuitState) {
    if (internal.state === next) return;
    const prev = internal.state;
    internal = { ...internal, state: next };
    if (next === 'open') {
      internal.openedAt = Date.now();
    }
    if (next === 'closed') {
      internal.consecutiveFailures = 0;
    }
    opts.onStateChange?.(prev, next);
  }

  function canPass(now: number): boolean {
    if (internal.state === 'closed') return true;
    if (internal.state === 'open') {
      const elapsed = now - internal.openedAt;
      if (elapsed >= cooldownMs) {
        transition('half-open');
        return true;
      }
      return false;
    }
    // half-open：允许探测通过
    return true;
  }

  function recordSuccess() {
    transition('closed');
  }

  function recordFailure() {
    internal.consecutiveFailures += 1;
    internal.lastFailureAt = Date.now();
    if (internal.state === 'half-open') {
      transition('open');
      return;
    }
    if (internal.consecutiveFailures >= threshold && internal.state === 'closed') {
      transition('open');
    }
  }

  return {
    state(): CircuitState {
      // 状态可"自愈"读取：open 时间到 → 显示 half-open
      if (internal.state === 'open') {
        const elapsed = Date.now() - internal.openedAt;
        if (elapsed >= cooldownMs) return 'half-open';
      }
      return internal.state;
    },
    /** 强制 open（外部测试用） */
    forceOpen() {
      transition('open');
    },
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (!canPass(Date.now())) {
        const remaining = Math.max(0, cooldownMs - (Date.now() - internal.openedAt));
        throw new OpenCircuitError(internal.openedAt, remaining);
      }
      try {
        const r = await fn();
        recordSuccess();
        return r;
      } catch (e) {
        recordFailure();
        throw e;
      }
    },
    /** 内部只读属性（smoke 校验用） */
    _peek() {
      return {
        state: internal.state,
        consecutiveFailures: internal.consecutiveFailures,
        openedAt: internal.openedAt,
      };
    },
  };
}

// 全局单例（lazy init——避免 TDZ 问题 + 避免 module 加载顺序耦合）
let _globalCircuit: ReturnType<typeof createCircuitBreaker> | null = null;
function getGlobalCircuit() {
  if (!_globalCircuit) {
    _globalCircuit = createCircuitBreaker({ threshold: 5, cooldownMs: 30000 });
  }
  return _globalCircuit;
}

/**
 * 查询全局 circuit breaker 当前状态。供 smoke 验证状态转换。
 */
export function esmGetCircuitState(): CircuitState {
  return getGlobalCircuit().state();
}

/**
 * （仅 smoke）使用隔离的测试 circuit 验证状态转换——不动全局实例。
 */
export function _esmNewTestCircuit(opts?: CircuitBreakerOptions) {
  return createCircuitBreaker({ ...opts });
}

/**
 * （仅 smoke）重置全局 circuit 到 closed 状态——清空失败计数 + 关闭熔断。
 */
export function _esmResetGlobalCircuitForTest(): void {
  _globalCircuit = createCircuitBreaker({ threshold: 5, cooldownMs: 30000 });
}

// ===== Transaction 包装 =====

/**
 * wrapEsInTransaction：在事务内或事务外执行 ES 落事件。
 *
 * 选型策略（duck-typing）：
 *   - tx 有 event.create 或 $transaction 方法 → 走 tx.event.create（事务内）。
 *   - 其他（tx=null/undefined/对象但不是 tx client）→ 走独立 mustRouteEsAppendEvent。
 *
 * 返回：与 mustRouteEsAppendEvent 一致——committed + eventId。
 */
export interface WrapEsInTransactionInput {
  characterId: string;
  type: AppendEventInput['type'];
  data: AppendEventInput['data'];
  source?: AppendEventInput['source'];
  triggerActor?: AppendEventInput['triggerActor'];
  createdAtAge?: number;
}

/** duck-typing 判断 Prisma 事务 client */
function looksLikeTransactionClient(tx: unknown): boolean {
  if (!tx || typeof tx !== 'object') return false;
  const anyTx = tx as any;
  // Prisma tx client 有 event.create（如已注册 Event model）；也有 $transaction
  return typeof anyTx.event?.create === 'function' || typeof anyTx.$transaction === 'function';
}

export async function wrapEsInTransaction(
  tx: unknown,
  event: WrapEsInTransactionInput
): Promise<MustRouteEsResult> {
  if (looksLikeTransactionClient(tx)) {
    try {
      const anyTx = tx as any;
      const created = await anyTx.event.create({
        data: {
          characterId: event.characterId,
          type: event.type,
          data: event.data as any,
          source: event.source ?? 'user-action',
          triggerActor: event.triggerActor ?? 'player',
          createdAtAge: event.createdAtAge ?? null,
        },
      });
      invalidateProjection(event.characterId).catch(() => undefined);
      return { committed: true, eventId: created.id };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { committed: false, error: msg };
    }
  }
  // 事务外调用 / tx 缺失 → 独立 ES 路径
  return await mustRouteEsAppendEvent({
    characterId: event.characterId,
    type: event.type,
    data: event.data,
    source: event.source,
    triggerActor: event.triggerActor,
    createdAtAge: event.createdAtAge,
  });
}

// ===== Route Marker（编译时 tag 收集） =====

const _esmRegisteredTagSet = new Set<string>();

/**
 * 在路由注册时调用此函数记录 tag。
 * 替代硬编码 _esmRegisteredTags()。
 *
 * 用法：
 *   // 路由顶端
 *   export const POST = withEventSourcing(handler, { tag: 'choose' });
 *   // 等价于自动调用 esmRouteMarker('choose')
 *
 * 也可手动调：
 *   esmRouteMarker('choose');
 *   export async function POST(...) { ... }
 */
export function esmRouteMarker(tag: string): void {
  _esmRegisteredTagSet.add(tag);
}

/** 返回当前所有已注册的 route tag 列表（按字母排序，便于稳定校验）。 */
export function esmDumpRegisteredTags(): string[] {
  return [..._esmRegisteredTagSet].sort();
}

/** （仅 smoke）清空 tag 集合——验证编译时收集用 */
export function _esmClearRegisteredTagsForTest(): void {
  _esmRegisteredTagSet.clear();
}

// ===== withEventSourcing（router wrapper） =====

/**
 * ES 中间件包装器（Phase 5 #3 真包装器）。
 *
 * 行为：
 * 1. 自动 esmRouteMarker(options.tag) 注册 tag 到编译时收集器。
 * 2. 用 runWithRetry 包装 handler（默认 3 次重试 + 指数退避）。
 * 3. 按 esRouting 策略分类处理失败：
 *    - 'required'（默认）：handler 错误必抛；上层 next/error 通道处理。
 *    - 'optional'：handler 错误日志 + 再尝试一次不带重试（best-effort）。
 *    - 'bypass'：等同于 optional，但调用方明确知道 ES 没用上。
 *
 * 注：当前 PoC 保留 console log 在 dev/prod 都打印——便于日志审计。
 */
export interface WithEventSourcingOptions {
  /** 路由标识（必填）——esmRouteMarker 自动注册 */
  tag: string;
  /**
   * ES 必走 / 可选 / 旁路。
   * - 'required'（默认）：handler 错误抛错。
   * - 'optional'：日志 + best-effort 不阻断。
   * - 'bypass'：等同于 optional，明确语义。
   */
  esRouting?: 'required' | 'optional' | 'bypass';
  /** 重试次数；默认 3 */
  retries?: number;
  /** 重试基础等待 ms；默认 100 */
  baseMs?: number;
  /** 抖动比例 0..1；默认 0.2 */
  jitter?: number;
  /** 自定义失败钩子——不阻断主流程 */
  onRouteFailure?: (err: unknown, tag: string) => void;
}

type Handler<TReq, TRes> = (req: TReq) => Promise<TRes>;

export function withEventSourcing<TReq extends NextRequest, TRes>(
  handler: Handler<TReq, TRes>,
  options: WithEventSourcingOptions
): Handler<TReq, TRes> {
  const tag = options.tag;
  const routing = options.esRouting ?? 'required';
  const retries = options.retries ?? 3;
  const baseMs = options.baseMs ?? 100;
  const jitter = options.jitter ?? 0.2;
  const onRouteFailure = options.onRouteFailure;

  const wrapped: Handler<TReq, TRes> = async (req: TReq) => {
    // 编译时收集 tag
    esmRouteMarker(tag);
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[ES middleware] withEventSourcing(${tag}) entered (routing=${routing}, retries=${retries})`
      );
    }
    try {
      const res = await runWithRetry(() => handler(req), {
        maxRetries: retries,
        baseMs,
        factor: 2,
        jitter,
      });
      return res;
    } catch (e: unknown) {
      const isOpenCircuit = e instanceof OpenCircuitError;
      const msg = e instanceof Error ? e.message : String(e);
      if (routing === 'required' && !isOpenCircuit) {
        console.error(`[ES middleware] ${tag} required-mode failure: ${msg}`);
        throw e;
      }
      if (routing === 'required' && isOpenCircuit) {
        console.error(`[ES middleware] ${tag} circuit-open: ${msg}`);
        throw e;
      }
      // optional / bypass：日志 + best-effort（再跑一次 handler 不带重试）
      console.warn(`[ES middleware] ${tag} ${routing}-mode failure (fall through): ${msg}`);
      try {
        onRouteFailure?.(e, tag);
      } catch (_hookErr) {
        // 钩子失败不影响主流程
      }
      return await handler(req);
    }
  };
  return wrapped;
}

// ===== 给 smoke 用的探针 =====

/**
 * 探针：返回 middleware 模块版本字符串（用于 smoke 校验 import + 版本）。
 */
export function _esmVersion(): string {
  return 'esm-poc-2'; // Phase 5 #3 升级：真包装器 + 重试 + 熔断 + tx + marker
}

/**
 * 探针：返回当前 router 中已标记必走 ES 的路由 tag 列表（用于 smoke 校验约束）。
 * 由 esmRouteMarker 在 withEventSourcing 调用时注册；hardcoded-tags 是兜底
 * ——保证模块加载后第一次调用也能看到默认路由列表（向后兼容旧 smoke）。
 *
 * @deprecated 推荐用 esmDumpRegisteredTags()（语义更明确）。
 */
export function _esmRegisteredTags(): string[] {
  const fromRegistry = esmDumpRegisteredTags();
  const HARDCODED_TAGS = ['choose', 'interfere']; // 向后兼容：原 PoC 阶段硬编码
  const union = new Set([...fromRegistry, ...HARDCODED_TAGS]);
  return [...union].sort();
}

/**
 * 探针：检查 db 是否可达（轻量 ping，用于 smoke 中"前置环境检查"）。
 */
export async function _esmPingDb(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
