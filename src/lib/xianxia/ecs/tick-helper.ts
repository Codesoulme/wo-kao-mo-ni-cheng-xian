// ECS tick helper（PoC 阶段 — Phase 5 #2）
// 封装 "new World + createCharacterEntity + addSystem × N + tick + entityToSnapshot" 这段重复代码。
// 让 choose / interfere / advance（非 SSE 路径）都能复用同一段 ECS tick 逻辑。
//
// 设计原则（PoC）：
// - 不替换 advance / advance-sse 现有 ECS tick 实现。advance 改为调用本 helper；advance-sse 保留自带缓存策略不动。
// - 不新增 system。helper 复用现有 AgingSystem + CultivationSystem。
// - helper 失败必须 try/catch（不阻断主流程）。
// - helper 记录 tick 耗时 + entity 数（方便 bench 复用）。

import { World, Entity } from './core';
import { createCharacterEntity, entityToSnapshot } from './character-entity';
import { AgingSystem } from './systems/aging-system';
import { CultivationSystem } from './systems/cultivation-system';
import type { CharacterStateSnapshot } from '../events/types';

export interface TickEcsOptions {
  /** 是否启用 bench 日志（默认 false — 路由热路径不打印） */
  bench?: boolean;
  /** 路由标识（用于日志前缀，方便定位） */
  source?: string;
}

export interface TickEcsResult {
  /** tick 后年龄（AgingSystem +1） */
  age: number;
  /** tick 后修为（CultivationSystem 累加） */
  cultivationExp: number;
  /** tick 后存活状态（AgingSystem 在 age >= lifespan 时置 false） */
  alive: boolean;
  /** tick 耗时（ms） */
  durationMs: number;
  /** World 中的 entity 数（PoC 固定 1） */
  entityCount: number;
}

/**
 * 跑一次 ECS tick：建 World → 挂 entity → 挂 2 个 system → tick → 读回。
 * PoC 阶段每个 router 调用各自 new World()（不跨调用复用，由 advance-sse 自行缓存）。
 *
 * 失败返回 null（调用方应自己 try/catch + 决定是否合并到 finalState）。
 */
export function tickEcsForCharacter(
  characterId: string,
  baseSnapshot: CharacterStateSnapshot,
  options: TickEcsOptions = {},
): TickEcsResult | null {
  const startedAt = Date.now();
  const world = new World();
  createCharacterEntity(world, baseSnapshot);
  world.addSystem(AgingSystem);
  world.addSystem(CultivationSystem);
  world.tick();

  const entity: Entity | null = world.getEntity(`character-${characterId}`);
  if (!entity) {
    if (options.bench) {
      console.warn(`[tickEcsForCharacter${options.source ? `:${options.source}` : ''}] entity not found after tick`);
    }
    return null;
  }

  const ticked = entityToSnapshot(entity);
  const durationMs = Date.now() - startedAt;
  const result: TickEcsResult = {
    age: ticked.age,
    cultivationExp: ticked.cultivationExp,
    alive: ticked.alive,
    durationMs,
    entityCount: world.listEntities().length,
  };

  if (options.bench) {
    const tag = options.source ? `[${options.source}]` : '';
    console.log(
      `[tickEcsForCharacter${tag}] durationMs=${durationMs} entityCount=${result.entityCount} ` +
      `age=${ticked.age} cultivationExp=${ticked.cultivationExp.toFixed(2)} alive=${ticked.alive}`,
    );
  }

  return result;
}

/**
 * 把 ECS tick 结果合并到一个 finalState 对象（mutate）。PoC helper：合并 age + cultivationExp；alive 假→真时设 causeOfDeath。
 *
 * 注意：调用方应自己 try/catch；helper 不抛错。
 */
export function applyEcsTickToState<T extends { age: number; cultivationExp: number; alive: boolean; causeOfDeath?: string }>(
  state: T,
  result: TickEcsResult | null,
): T {
  if (!result) return state;
  state.age = result.age;
  state.cultivationExp = result.cultivationExp;
  if (!result.alive && state.alive) {
    state.alive = false;
    state.causeOfDeath = state.causeOfDeath || 'ecs-aging-natural';
  }
  return state;
}