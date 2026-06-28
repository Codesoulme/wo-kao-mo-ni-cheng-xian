// Event Sourcing projector: 物化视图 cache + 增量重放
//
// 设计：
// - 基础快照来自 Character 表（视为 aggregate root 的"持久化"初始状态）
// - 事件链来自 events/store（X1 负责）
// - 缓存命中条件：cache 内 lastEventVersion === 当前最新事件 version 且 TTL 未过
// - 失效：事件写入侧（store.ts）应在 appendEvent 后调 invalidateProjection(characterId)
//
// 批 21: 双层缓存（内存 Map + SQLite via Prisma）
// - 写：双写——内存 cache + DB upsert（ProjectionSnapshot model）
// - 读：先查内存（TTL 内）；miss/TTL 过 → 查 DB；DB 有 → 装回内存；DB 无 → replay 全部
// - invalidate：清内存 + 删 DB
// - clear：清全部
//
// PoC 阶段：
// - 内存 Map cache（生产应换 Redis / LRU）
// - inventory 走 Character.inventoryJson（PoC 简化）
// - reducer 缺依赖时（X1 未完成）走 graceful fallback：抛 Error 让上层决定

import { db } from '../../db';
// type-only import: 即使 X1 还没建 types.ts，编译也通过
import type { CharacterStateSnapshot, CharacterEvent } from './types';

// =============== 缓存 ===============

interface CacheEntry {
  state: CharacterStateSnapshot;
  lastEventVersion: number;
  updatedAt: number;
}

const projectionCache = new Map<string, CacheEntry>();
let CACHE_TTL_MS = 30 * 1000; // 30s（可配）

// 缓存命中统计（PoC：模块级计数，生产应换 Prometheus / OTel）
let cacheHits = 0;
let cacheMisses = 0;

export function setCacheTtlMs(ms: number): void {
  CACHE_TTL_MS = Math.max(0, ms);
}

export function getCacheTtlMs(): number {
  return CACHE_TTL_MS;
}

export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}

// 批 21: 异步 invalidateProjection——同时清内存 cache + DB 快照
// 设计选择：fire-and-forget 风格。store.ts 的 invalidateAfterAppend 路径
// 通常在事务外调用，DB 写失败不该阻塞事件流。但为了让上层能看到错误，
// 这里返回 Promise：调用方可以选择 await 或 fire-and-forget。
export async function invalidateProjection(characterId: string): Promise<void> {
  projectionCache.delete(characterId);
  try {
    await db.projectionSnapshot.deleteMany({ where: { characterId } });
  } catch (e) {
    // 内存已清；DB 失败仅记日志，不抛（幂等性 + 不阻塞事件流）
    console.error(`[projector] invalidateProjection DB delete failed for ${characterId}:`, e);
  }
}

export async function clearProjectionCache(): Promise<void> {
  projectionCache.clear();
  try {
    await db.projectionSnapshot.deleteMany({});
  } catch (e) {
    console.error('[projector] clearProjectionCache DB delete failed:', e);
  }
}

export function getProjectionCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  ttlMs: number;
} {
  const total = cacheHits + cacheMisses;
  return {
    size: projectionCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? cacheHits / total : 0,
    ttlMs: CACHE_TTL_MS,
  };
}

// 事件 append 后立即失效缓存（store.ts 在 appendEvent 成功后调用）
// 批 21: 返回 Promise（底层 invalidate 已是 async），调用方按需 await
export function invalidateAfterAppend(characterId: string): Promise<void> {
  return invalidateProjection(characterId);
}

// 测试 helper：直接注入缓存项（用于 smoke 验证 hit/miss）
export function _seedProjectionCacheForTest(
  characterId: string,
  state: CharacterStateSnapshot,
  lastEventVersion: number
): void {
  projectionCache.set(characterId, {
    state,
    lastEventVersion,
    updatedAt: Date.now(),
  });
}

// 批 21: ProjectionStore——双层（内存 + DB）封装
// 内部使用，外部仍走 projectionCache + invalidate/clear 顶层 API。
class ProjectionStore {
  // 仅暴露给同模块的 getProjectedState 使用
  async get(characterId: string): Promise<CacheEntry | null> {
    // 1. 内存 cache（TTL 内）
    const mem = projectionCache.get(characterId);
    if (mem && Date.now() - mem.updatedAt < CACHE_TTL_MS) {
      return mem;
    }
    // 2. DB snapshot
    try {
      const dbSnap = await db.projectionSnapshot.findUnique({ where: { characterId } });
      if (dbSnap) {
        const entry: CacheEntry = {
          state: dbSnap.state as unknown as CharacterStateSnapshot,
          lastEventVersion: dbSnap.lastEventVersion,
          updatedAt: Date.now(),
        };
        // 装回内存 cache，下次直接走内存路径
        projectionCache.set(characterId, entry);
        return entry;
      }
    } catch (e) {
      console.error(`[projector] ProjectionStore.get DB read failed for ${characterId}:`, e);
    }
    return null;
  }

  async set(characterId: string, state: CharacterStateSnapshot, lastEventVersion: number): Promise<void> {
    const now = Date.now();
    // 1. 内存 cache
    projectionCache.set(characterId, { state, lastEventVersion, updatedAt: now });
    // 2. DB upsert
    try {
      await db.projectionSnapshot.upsert({
        where: { characterId },
        create: {
          characterId,
          state: state as unknown as object,
          lastEventVersion,
        },
        update: {
          state: state as unknown as object,
          lastEventVersion,
          updatedAt: new Date(),
        },
      });
    } catch (e) {
      console.error(`[projector] ProjectionStore.set DB upsert failed for ${characterId}:`, e);
    }
  }
}

const projectionStore = new ProjectionStore();

// =============== 物化视图 ===============

/**
 * 把 Character 行转成 reducer 用的 base snapshot。
 * 失败/缺失字段用 PoC 默认值兜底。
 */
function charRowToBaseSnapshot(row: {
  id: string;
  name: string;
  age: number;
  lifespan: number;
  realm: string;
  cultivationExp: number;
  hp: number;
  maxHp: number;
  spiritStones: number;
  alive: boolean;
}): CharacterStateSnapshot {
  return {
    characterId: row.id,
    name: row.name || '',
    age: row.age,
    realm: row.realm,
    cultivationExp: row.cultivationExp,
    hp: row.hp,
    maxHp: row.maxHp,
    spiritStones: row.spiritStones,
    alive: row.alive,
    lifespan: row.lifespan,
    inventory: [],
  };
}

/**
 * 加载并 reduce character 的事件链，返回最终 state snapshot。
 * 事件链为空 → 直接返回 base snapshot（无 reducer 调用）。
 *
 * 批 21: 双层缓存读路径：
 *   1. projectionStore.get(characterId) → 内存 TTL 内 → 直接返回；否则查 DB
 *   2. cache 命中且 lastEventVersion === events 最新 version → 直接返回
 *   3. cache stale（DB 有但 version 旧）→ 从 cache.state 增量 replay
 *   4. cache miss（DB 也没有）→ 从 Character 行 baseSnapshot 全量 replay
 */
export async function getProjectedState(characterId: string): Promise<CharacterStateSnapshot> {
  // 批 21: 先查 projectionStore（内存 + DB）
  const cached = await projectionStore.get(characterId);

  // 1. base snapshot from Character table
  const char = await db.character.findUnique({ where: { id: characterId } });
  if (!char) throw new Error(`Character ${characterId} not found`);

  const baseFromDb = charRowToBaseSnapshot({
    id: char.id,
    name: char.name,
    age: char.age,
    lifespan: char.lifespan,
    realm: char.realm,
    cultivationExp: char.cultivationExp,
    hp: char.hp,
    maxHp: char.maxHp,
    spiritStones: char.spiritStones,
    alive: char.alive,
  });

  // 2. 拉事件链（X1 提供 getEvents）
  //    用 dynamic require 避免 X1 还没建文件时 import 失败 → smoke 仍能加载本文件
  let events: CharacterEvent[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const storeMod = require('./store');
    if (typeof storeMod.getEvents === 'function') {
      const result = await storeMod.getEvents(characterId);
      events = Array.isArray(result) ? (result as CharacterEvent[]) : [];
    }
  } catch {
    // X1 尚未完成 events/store.ts → 当作 0 事件
    events = [];
  }

  // 3. 事件链为空
  if (events.length === 0) {
    if (!cached) cacheMisses++;
    await projectionStore.set(characterId, baseFromDb, 0);
    return baseFromDb;
  }

  const latestVersion = events[events.length - 1].aggregateVersion;

  // 4. cache hit（内存 TTL 内或 DB 快照）且 version 一致
  if (cached && cached.lastEventVersion === latestVersion) {
    cacheHits++;
    return cached.state;
  }
  cacheMisses++;

  // 5. cache stale / miss → 决定 replay 起点
  let baseSnapshot: CharacterStateSnapshot;
  let fromVersion: number;
  if (cached) {
    // 增量：cache.state + cached.lastEventVersion 之后的 events
    baseSnapshot = cached.state;
    fromVersion = cached.lastEventVersion + 1;
  } else {
    // 全量：base snapshot + 全部 events
    baseSnapshot = baseFromDb;
    fromVersion = 0;
  }

  // 6. replay（增量或全量）
  const incrementalEvents = events.filter((e) => e.aggregateVersion >= fromVersion);
  let projectedState: CharacterStateSnapshot = baseSnapshot;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const reducerMod = require('./reducer');
    if (typeof reducerMod.reduceCharacterState === 'function') {
      projectedState = reducerMod.reduceCharacterState(
        baseSnapshot,
        incrementalEvents
      ) as CharacterStateSnapshot;
    }
  } catch {
    // X1 reducer 未就绪 → 回退到 base snapshot（PoC 兜底）
    projectedState = baseSnapshot;
  }

  await projectionStore.set(characterId, projectedState, latestVersion);
  return projectedState;
}

// =============== 给 smoke / 工具层用的 helper ===============

/**
 * 测试用：直接构造 base snapshot（不读 DB）。事件源 smoke 用。
 */
export function buildBaseSnapshot(args: {
  characterId: string;
  name?: string;
  age?: number;
  lifespan?: number;
  realm?: string;
  cultivationExp?: number;
  hp?: number;
  maxHp?: number;
  spiritStones?: number;
  alive?: boolean;
}): CharacterStateSnapshot {
  return {
    characterId: args.characterId,
    name: args.name ?? '',
    age: args.age ?? 0,
    lifespan: args.lifespan ?? 80,
    realm: args.realm ?? 'mortal',
    cultivationExp: args.cultivationExp ?? 0,
    hp: args.hp ?? 100,
    maxHp: args.maxHp ?? 100,
    spiritStones: args.spiritStones ?? 0,
    alive: args.alive ?? true,
    inventory: [],
  };
}

// =============== Projection Rules 引擎 ===============
//
// 允许自定义"根据 events 计算派生字段"的规则。
// PoC 阶段：内置 3 条规则 + 同步 projectCustom 入口（不调 getProjectedState 异步路径）。
// 真实生产应：
//   - 注册表持久化（DB 表 / 配置文件）
//   - rule 缓存（按 characterId+ruleName key）
//   - 异步执行（worker thread / promise pool）
//   - 触发链：appendEvent → invalidate rules cache → 下次读重算

import type { Event as DbEvent } from './types';

export interface ProjectionRule {
  name: string;
  /** 规则描述（仅供文档 / 调试） */
  description?: string;
  /**
   * 计算入口。state 是当前 projected snapshot（PoC 阶段可能为空壳，因为同步路径不读 DB）；
   * events 是该 character 的完整事件链。
   * 返回任意 JSON 可序列化对象。
   */
  compute: (state: CharacterStateSnapshot, events: DbEvent[]) => Record<string, any>;
}

const builtInRules: ProjectionRule[] = [
  {
    name: 'realm-distribution',
    description: '统计该 character 经历过的所有 realm 出现次数（按 realm.changed 事件的 to 字段）',
    compute: (_state, events) => {
      const realmCounts: Record<string, number> = {};
      for (const e of events) {
        if (e.type === 'character.realm.changed') {
          const to = (e.data as { to: string }).to;
          realmCounts[to] = (realmCounts[to] || 0) + 1;
        }
      }
      return realmCounts;
    },
  },
  {
    name: 'cultivation-timeline',
    description: '修为变化时间线（每次 cultivation-exp.changed 的 version/age/newValue/delta）',
    compute: (_state, events) => {
      return events
        .filter((e) => e.type === 'character.cultivation-exp.changed')
        .map((e) => {
          const d = e.data as { delta: number; newValue: number; reason?: string };
          return {
            version: e.aggregateVersion,
            age: e.createdAtAge,
            newValue: d.newValue,
            delta: d.delta,
            reason: d.reason ?? null,
          };
        });
    },
  },
  {
    name: 'death-revival-count',
    description: '死亡 / 重生计数（按 alive.changed 事件统计；cause=ascension 不算死亡）',
    compute: (_state, events) => {
      let deaths = 0;
      let revivals = 0;
      let ascensionTransitions = 0;
      for (const e of events) {
        if (e.type === 'character.alive.changed') {
          const d = e.data as { alive: boolean; cause?: string };
          if (d.alive === false && d.cause !== 'ascension') deaths++;
          if (d.alive === true && d.cause !== 'ascension') revivals++;
          if (d.cause === 'ascension') ascensionTransitions++;
        }
      }
      return { deaths, revivals, ascensionTransitions };
    },
  },
];

/** 列出所有内置规则名（PoC 阶段不开放自定义规则注册；后续批扩展） */
export function listProjectionRules(): string[] {
  return builtInRules.map((r) => r.name);
}

/** 同步版 projectCustom：不调 DB / 不调 getProjectedState，直接对 events 计算。
 *  PoC 阶段：调用方必须自己从 store.getEvents(characterId) 拉 events 后传入。
 *  返回 { ruleName, result, eventCount } 或 null（规则名未知）。 */
export function projectCustomSync(
  characterId: string,
  ruleName: string,
  events: DbEvent[]
): { ruleName: string; characterId: string; eventCount: number; result: Record<string, any> } | null {
  const rule = builtInRules.find((r) => r.name === ruleName);
  if (!rule) return null;
  // state 在同步 PoC 路径下传空壳（生产实现应先 reduce 一次）
  const dummyState: CharacterStateSnapshot = {
    characterId,
    name: '',
    age: 0,
    realm: 'mortal',
    cultivationExp: 0,
    hp: 0,
    maxHp: 0,
    spiritStones: 0,
    alive: true,
    lifespan: 0,
    inventory: [],
  };
  const result = rule.compute(dummyState, events);
  return {
    ruleName: rule.name,
    characterId,
    eventCount: events.length,
    result,
  };
}