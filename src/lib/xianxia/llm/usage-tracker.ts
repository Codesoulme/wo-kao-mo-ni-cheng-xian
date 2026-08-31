// 修仙模拟器 - LLM 调用观测层（纯增量遥测，不改任何提示词内容）
//
// 目的：为后续提示词重排提供仪表——记下每次 LLM 调用真正重算了多少输入 token、
// 命中了多少前缀缓存、推理花了多少 token。有了这条基线，才能判断重排到底省没省。
//
// 三层累加：
//   perSession[sessionKey] —— 单次会话内累计
//   perDay[YYYY-MM-DD]     —— 按天汇总，便于看配额趋势
//   total                  —— 本进程生命周期总量
//
// 每次调用还会 append 一行到 .xianxia-usage/usage-YYYY-MM-DD.jsonl，
// 事后用 jq / grep 直接分析。
//
// 硬约束：遥测故障绝不能阻断主流程。本文件所有对外函数都只 warn 不抛。

import fs from 'fs';
import path from 'path';

// ==================== 类型 ====================

/** 调用场景。主路三条显式标注，其余辅助调用归 aux。 */
export type LLMScene = 'advance' | 'choose' | 'interfere' | 'aux';

export interface LLMUsageSnapshot {
  model: string;
  /** = prompt_tokens - cached_tokens，即真正重新计算的输入部分 */
  freshInputTokens: number;
  outputTokens: number;
  /** 命中前缀缓存、按折扣计价的输入 token */
  cachedTokens: number;
  reasoningTokens: number;
  /** null = 无法给出单价（套餐计费 / 单价未核实）。与 0 语义不同：0 是"算过，确实不要钱"。 */
  estimatedCostUsd: number | null;
  sessionKey?: string;
  scene: LLMScene;
  /** 可选：写入缓存的 token（Anthropic cache_creation_input_tokens）。按量付费时按 1.25x 计价。 */
  cacheWriteTokens?: number;
}

/** 一层累加器。calls 是这一层累计的调用次数。 */
export interface LLMUsageTotals {
  model: string;
  calls: number;
  freshInputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  estimatedCostUsd: number | null;
}

// ==================== 定价表 ====================
//
// 结构照参考实现的形状：单价是 provider 目录里的事实，折算比例是计费规则。
// 参考侧哲学：is_plan_billed 为真就返回 None —— 套餐计费不等于免费，
// 也不等于可以套按量付费的单价去编一个数字出来。

interface ModelRate {
  /** 输入单价，美元 / token。null = 未核实，不编造。 */
  promptUsdPerToken: number | null;
  /** 输出单价，美元 / token。null = 未核实。 */
  completionUsdPerToken: number | null;
  /** 套餐计费。为真则 estimatedCostUsd 恒为 null。 */
  planBilled: boolean;
  /** 命中缓存的折算系数（相对输入单价）。null = 未核实。 */
  cacheReadFactor: number | null;
  /** 写入缓存的折算系数（相对输入单价）。null = 未核实。 */
  cacheWriteFactor: number | null;
  note: string;
}

// 按量付费 provider 的通用缓存折算比例（参考实现口径）：
//   读缓存 = cache_read  × prompt_rate × 0.1
//   写缓存 = cache_write × prompt_rate × 1.25   （5 分钟 ephemeral TTL）
const PAYG_CACHE_READ_FACTOR = 0.1;
const PAYG_CACHE_WRITE_FACTOR = 1.25;

const PRICING: Record<string, ModelRate> = {
  // 火山方舟 Coding Plan：月卡套餐计费。
  // 自动前缀缓存默认开启，usage 回传 prompt_tokens_details.cached_tokens。
  // 命中 token 的折扣系数查不到（联网被拦），故标 null 而不是猜一个。
  // 无论折扣系数是否已知，planBilled 为真时成本恒 null。
  'ark-code-latest': {
    promptUsdPerToken: null,
    completionUsdPerToken: null,
    planBilled: true,
    cacheReadFactor: null,
    cacheWriteFactor: null,
    note: '套餐计费，折扣系数未核实',
  },

  // MiniMax-M3：兜底链路，走 Anthropic 协议。
  // 结构在此留好：若日后核实到官方单价，把下面两个 null 换成
  // 「美元每百万 token / 1e6」即可，其余算术不用改；
  // planBilled 保持 false，缓存折算走上面两个 PAYG 常量。
  'MiniMax-M3': {
    promptUsdPerToken: null,
    completionUsdPerToken: null,
    planBilled: false,
    cacheReadFactor: PAYG_CACHE_READ_FACTOR,
    cacheWriteFactor: PAYG_CACHE_WRITE_FACTOR,
    note: '按量付费，单价未核实——填入官方单价后即可算钱',
  },
};

// 只对每个未知 model warn 一次，别把日志刷爆
const WARNED_UNKNOWN = new Set<string>();

/**
 * 估算单次调用的美元成本。
 * 返回 null 的三种情形：套餐计费 / 未知模型 / 单价未核实。
 * 调用方必须能接受 null —— token 数照记，钱数留空。
 */
export function estimateCostUsd(params: {
  model: string;
  freshInputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
}): number | null {
  try {
    const rate = PRICING[params.model];
    if (!rate) {
      if (!WARNED_UNKNOWN.has(params.model)) {
        WARNED_UNKNOWN.add(params.model);
        console.warn(`[usage] 定价表无此模型 '${params.model}'，成本估算记为 null`);
      }
      return null;
    }
    // 套餐买的是订阅，本次调用没有对应的单 token 价格可陈述
    if (rate.planBilled) return null;
    const pr = rate.promptUsdPerToken;
    const cr = rate.completionUsdPerToken;
    if (pr === null || cr === null) {
      if (!WARNED_UNKNOWN.has(params.model)) {
        WARNED_UNKNOWN.add(params.model);
        console.warn(`[usage] 模型 '${params.model}' 单价未核实（${rate.note}），成本估算记为 null`);
      }
      return null;
    }
    const readFactor = rate.cacheReadFactor ?? 0;
    const writeFactor = rate.cacheWriteFactor ?? 0;
    return (
      params.freshInputTokens * pr +
      params.outputTokens * cr +
      (params.cachedTokens || 0) * pr * readFactor +
      (params.cacheWriteTokens || 0) * pr * writeFactor
    );
  } catch (err: any) {
    console.warn('[usage] 成本估算异常，记为 null：', err?.message || err);
    return null;
  }
}

/** 查定价口径，供报告 / 调试用。未登记返回 null。 */
export function getPricingNote(model: string): { planBilled: boolean; note: string } | null {
  const rate = PRICING[model];
  return rate ? { planBilled: rate.planBilled, note: rate.note } : null;
}

// ==================== 累加器 ====================

const USAGE_DIR = '.xianxia-usage';
/** 攒够这么多条才落盘，摊薄 IO */
const FLUSH_EVERY = 5;
/** 攒着但久未落盘的，下次记录时顺手 flush，避免低频调用一直躺在内存 */
const FLUSH_MAX_AGE_MS = 10_000;

/** 进程级默认会话键：调用方没给 sessionKey 时用它，保证 perSession 分层仍有意义 */
const PROCESS_SESSION_KEY = `proc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function emptyTotals(model: string): LLMUsageTotals {
  return {
    model,
    calls: 0,
    freshInputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    estimatedCostUsd: null,
  };
}

const perSession: Map<string, LLMUsageTotals> = new Map();
const perDay: Map<string, LLMUsageTotals> = new Map();
const total: LLMUsageTotals = emptyTotals('__total__');

let callCount = 0;
let buffer: string[] = [];
let bufferFirstAt = 0;
let exitHooksInstalled = false;

function todayKey(): string {
  // 本地日期，与落盘文件名一致
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function addInto(acc: LLMUsageTotals, s: LLMUsageSnapshot): void {
  acc.calls += 1;
  acc.freshInputTokens += num(s.freshInputTokens);
  acc.outputTokens += num(s.outputTokens);
  acc.cachedTokens += num(s.cachedTokens);
  acc.cacheWriteTokens += num(s.cacheWriteTokens);
  acc.reasoningTokens += num(s.reasoningTokens);
  // 套餐计费的调用贡献 token 但不贡献金额；把 null 当 0 累加会读成"这些调用免费"
  if (s.estimatedCostUsd !== null && s.estimatedCostUsd !== undefined && Number.isFinite(s.estimatedCostUsd)) {
    acc.estimatedCostUsd = (acc.estimatedCostUsd ?? 0) + s.estimatedCostUsd;
  }
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function copyTotals(src: LLMUsageTotals): LLMUsageTotals {
  return { ...src };
}

// ==================== 落盘 ====================

function installExitHooks(): void {
  if (exitHooksInstalled) return;
  exitHooksInstalled = true;
  try {
    if (typeof process === 'undefined' || typeof process.on !== 'function') return;
    // exit 回调里只能跑同步逻辑，故 flush 全程用 *Sync
    process.on('exit', () => { flushUsage(); });
    process.on('beforeExit', () => { flushUsage(); });
    for (const sig of ['SIGINT', 'SIGTERM'] as const) {
      process.on(sig, () => { flushUsage(); });
    }
  } catch (err: any) {
    console.warn('[usage] 注册退出前 flush 失败（不影响主流程）：', err?.message || err);
  }
}

/**
 * 把缓冲区里的行写进 .xianxia-usage/usage-YYYY-MM-DD.jsonl（append-only）。
 * 任何异常只 warn 并丢掉缓冲，绝不抛给主流程。
 */
export function flushUsage(): void {
  if (buffer.length === 0) return;
  const rows = buffer;
  buffer = [];
  bufferFirstAt = 0;
  try {
    const dir = path.join(process.cwd(), USAGE_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `usage-${todayKey()}.jsonl`);
    fs.appendFileSync(file, rows.join(''), 'utf-8');
  } catch (err: any) {
    console.warn(`[usage] 落盘失败（${err?.message || err}），丢弃 ${rows.length} 行；主流程不受影响`);
  }
}

// ==================== 对外记录入口 ====================

/**
 * 记一次 LLM 调用。三层累加 + 缓冲落盘。
 * 本函数吞掉一切异常：遥测坏了也不能让主循环停。
 */
export function recordLLMUsage(s: LLMUsageSnapshot): void {
  try {
    installExitHooks();

    const key = s.sessionKey || PROCESS_SESSION_KEY;
    let sessionAcc = perSession.get(key);
    if (!sessionAcc) {
      sessionAcc = emptyTotals(s.model);
      perSession.set(key, sessionAcc);
    }
    addInto(sessionAcc, s);

    const day = todayKey();
    let dayAcc = perDay.get(day);
    if (!dayAcc) {
      dayAcc = emptyTotals('__day__');
      perDay.set(day, dayAcc);
    }
    addInto(dayAcc, s);

    addInto(total, s);

    callCount += 1;
    const row = JSON.stringify({
      ts: new Date().toISOString(),
      model: s.model,
      scene: s.scene,
      sessionKey: key,
      freshInputTokens: num(s.freshInputTokens),
      outputTokens: num(s.outputTokens),
      cachedTokens: num(s.cachedTokens),
      cacheWriteTokens: num(s.cacheWriteTokens),
      reasoningTokens: num(s.reasoningTokens),
      estimatedCostUsd: s.estimatedCostUsd ?? null,
    }) + '\n';
    buffer.push(row);
    if (bufferFirstAt === 0) bufferFirstAt = Date.now();

    const stale = Date.now() - bufferFirstAt >= FLUSH_MAX_AGE_MS;
    if (callCount % FLUSH_EVERY === 0 || stale) flushUsage();
  } catch (err: any) {
    // 这条是硬要求：遥测故障不能阻断主循环
    console.warn('[usage] 记录失败（不影响主流程）：', err?.message || err);
  }
}

/** 读三层累加结果的拷贝。 */
export function getUsageTotals(): {
  perSession: Record<string, LLMUsageTotals>;
  perDay: Record<string, LLMUsageTotals>;
  total: LLMUsageTotals;
} {
  const sessions: Record<string, LLMUsageTotals> = {};
  const days: Record<string, LLMUsageTotals> = {};
  try {
    for (const [k, v] of perSession) sessions[k] = copyTotals(v);
    for (const [k, v] of perDay) days[k] = copyTotals(v);
  } catch (err: any) {
    console.warn('[usage] 读取累加结果异常：', err?.message || err);
  }
  return { perSession: sessions, perDay: days, total: copyTotals(total) };
}

/** 清空内存累加（仅供测试 / 长驻进程重置用，不动已落盘文件）。 */
export function resetUsageTotals(): void {
  try {
    perSession.clear();
    perDay.clear();
    Object.assign(total, emptyTotals('__total__'));
    callCount = 0;
    buffer = [];
    bufferFirstAt = 0;
    WARNED_UNKNOWN.clear();
  } catch (err: any) {
    console.warn('[usage] 重置累加异常：', err?.message || err);
  }
}

// ==================== 协议适配 ====================
//
// 两条链路的 usage 字段名不同，各自归一到 LLMUsageSnapshot 的口径
// （freshInputTokens 一律是"真正重算的输入"）。

/**
 * OpenAI 兼容分支（火山方舟走这条）。
 * 方舟 prompt_tokens 含命中缓存部分，所以 fresh = prompt_tokens - cached_tokens。
 */
export function recordOpenAIUsage(
  model: string,
  usage: any,
  scene: LLMScene = 'aux',
  sessionKey?: string,
): void {
  try {
    const prompt = num(usage?.prompt_tokens ?? usage?.input_tokens);
    const cached = num(usage?.prompt_tokens_details?.cached_tokens);
    const output = num(usage?.completion_tokens ?? usage?.output_tokens);
    const reasoning = num(usage?.completion_tokens_details?.reasoning_tokens);
    const fresh = Math.max(0, prompt - cached);
    recordLLMUsage({
      model,
      freshInputTokens: fresh,
      outputTokens: output,
      cachedTokens: cached,
      reasoningTokens: reasoning,
      estimatedCostUsd: estimateCostUsd({
        model,
        freshInputTokens: fresh,
        outputTokens: output,
        cachedTokens: cached,
      }),
      sessionKey,
      scene,
    });
  } catch (err: any) {
    console.warn('[usage] OpenAI 兼容 usage 解析失败（不影响主流程）：', err?.message || err);
  }
}

/**
 * Anthropic 分支（MiniMax-M3 兜底走这条）。
 * Anthropic 的 input_tokens 本身已排除缓存部分，直接当 fresh 用，不再减。
 */
export function recordAnthropicUsage(
  model: string,
  usage: any,
  scene: LLMScene = 'aux',
  sessionKey?: string,
): void {
  try {
    const fresh = num(usage?.input_tokens);
    const cacheRead = num(usage?.cache_read_input_tokens);
    const cacheWrite = num(usage?.cache_creation_input_tokens);
    const output = num(usage?.output_tokens);
    recordLLMUsage({
      model,
      freshInputTokens: fresh,
      outputTokens: output,
      cachedTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      reasoningTokens: 0,
      estimatedCostUsd: estimateCostUsd({
        model,
        freshInputTokens: fresh,
        outputTokens: output,
        cachedTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
      }),
      sessionKey,
      scene,
    });
  } catch (err: any) {
    console.warn('[usage] Anthropic usage 解析失败（不影响主流程）：', err?.message || err);
  }
}
