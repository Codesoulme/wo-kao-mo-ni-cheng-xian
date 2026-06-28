// Event Sourcing projector: 物化视图 cache + 增量重放
//
// 设计：
// - 基础快照来自 Character 表（视为 aggregate root 的"持久化"初始状态）
// - 事件链来自 events/store（X1 负责）
// - 缓存命中条件：cache 内 lastEventVersion === 当前最新事件 version 且 TTL 未过
// - 失效：事件写入侧（store.ts）应在 appendEvent 后调 invalidateProjection(characterId)
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

export function invalidateProjection(characterId: string): void {
  projectionCache.delete(characterId);
}

export function clearProjectionCache(): void {
  projectionCache.clear();
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
export function invalidateAfterAppend(characterId: string): void {
  invalidateProjection(characterId);
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
 */
export async function getProjectedState(characterId: string): Promise<CharacterStateSnapshot> {
  const cached = projectionCache.get(characterId);
  const now = Date.now();

  // 1. base snapshot from Character table
  const char = await db.character.findUnique({ where: { id: characterId } });
  if (!char) throw new Error(`Character ${characterId} not found`);

  const baseSnapshot = charRowToBaseSnapshot({
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

  if (events.length === 0) {
    // 没事件也写入缓存（version = 0），下次同 characterId 直接命中
    if (!cached) cacheMisses++;
    projectionCache.set(characterId, {
      state: baseSnapshot,
      lastEventVersion: 0,
      updatedAt: now,
    });
    return baseSnapshot;
  }

  const latestVersion = events[events.length - 1].aggregateVersion;

  // 3. cache hit
  if (
    cached &&
    cached.lastEventVersion === latestVersion &&
    now - cached.updatedAt < CACHE_TTL_MS
  ) {
    cacheHits++;
    return cached.state;
  }
  cacheMisses++;

  // 4. cache miss / stale → replay
  let projectedState: CharacterStateSnapshot = baseSnapshot;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const reducerMod = require('./reducer');
    if (typeof reducerMod.reduceCharacterState === 'function') {
      projectedState = reducerMod.reduceCharacterState(baseSnapshot, events) as CharacterStateSnapshot;
    }
  } catch {
    // X1 reducer 未就绪 → 回退到 base snapshot（PoC 兜底）
    projectedState = baseSnapshot;
  }

  projectionCache.set(characterId, {
    state: projectedState,
    lastEventVersion: latestVersion,
    updatedAt: now,
  });

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