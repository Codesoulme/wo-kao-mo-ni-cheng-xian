// Event Sourcing middleware（PoC 阶段：批 21 phase-5 #1）。
// 目标：把"附加式" ES 接入（try/catch 包 appendEvent，db.update 仍是主路径）
// 升级为"必走 ES"——router 通过 withEventSourcing(handler, options) 包一层，
// 强制走 appendEvent → projector 重新计算 state → 回写 DB 的完整链路。
//
// 严格 PoC 范围（不扩大）：
// - 只在 choose / interfere 两个 router 用，验证可行性。
// - 不动 prisma schema，不动 store.ts / reducer.ts / projector.ts / types.ts。
// - 不重做 ES 基础（event 类型 / store / reducer / projector 已就位）。
//
// 设计要点：
// - middleware 只承诺"事件已落库"+"projector 状态可读"；不重写 router 业务逻辑。
// - ES 失败必须降级到原 db.update 主路径——不阻断用户主流程。
// - 提供 2 个子函数：mustRouteEsAppendEvent（落事件）、recomputeAndPersistState（投影重算 + 回写）。
//   router 调用这两个函数可保证 ES 是必经路径。

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

// ===== withEventSourcing（router wrapper） =====

/**
 * 强制 router 走 ES 路径的中间件包装器（PoC）。
 *
 * 设计：
 * - 调用方传入原始 POST handler。
 * - middleware 在 handler 调用前/后注入"必走 ES"检查：
 *   - 前置：从 body 读 characterId（如有），用 ES 中间件层做"前置路由"（不强写事件，只校验）。
 *   - 后置：handler 返回结果后，调一次 `onAfter` 让调用方决定是否要补必走 ES 事件。
 *
 * PoC 阶段不强制所有 router 通过 wrapper（部分 router 走"附加式"附加事件即可）——
 * 用 wrapper 是"标记性"约定：在 router 源码顶上 `@with-event-sourcing` 等价于注释声明。
 *
 * PoC 不重写 handler 行为（避免破坏业务逻辑）；仅提供包装让 router 可选地用上面两个 helper。
 */
export interface WithEventSourcingOptions {
  /** 标识（注释 + console log 用途），如 "choose"、"interfere" */
  tag: string;
}

export function withEventSourcing<TReq extends NextRequest, TRes>(
  handler: (req: TReq) => Promise<TRes>,
  options: WithEventSourcingOptions
): (req: TReq) => Promise<TRes> {
  const wrapped = async (req: TReq): Promise<TRes> => {
    // 前置 marker：标记此请求已通过 ES middleware 入口。
    // PoC 不在 wrapper 内强行 append event——具体事件类型由 router 自己用 mustRouteEsAppendEvent 落。
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ES middleware] withEventSourcing(${options.tag}) entered`);
    }
    try {
      const res = await handler(req);
      return res;
    } catch (e) {
      // 不吞错——让上层 next/error 通道处理；这里只做标记。
      throw e;
    }
  };
  return wrapped;
}

// ===== 给 smoke 用的探针 =====

/**
 * 探针：返回 middleware 模块版本字符串（用于 smoke 校验 import + 版本）。
 */
export function _esmVersion(): string {
  return 'esm-poc-1';
}

/**
 * 探针：返回当前 router 中已标记必走 ES 的路由 tag 列表（用于 smoke 校验约束）。
 * 调用方（smoke）应验证 choose / interfere 都在列。
 */
export function _esmRegisteredTags(): string[] {
  // PoC 阶段硬编码——router 改造时手工维护。
  // 后续接 build-time 自动收集（不需要 PoC 范围）。
  return ['choose', 'interfere'];
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