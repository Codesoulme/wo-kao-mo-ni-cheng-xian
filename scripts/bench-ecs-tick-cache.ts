// @ts-nocheck - benchmark script, no strict types needed

// scripts/bench-ecs-tick-cache.ts
// 对比 advance-sse ECS 块: 旧逻辑(new World + addSystem + createCharacterEntity) vs 新缓存逻辑(复用 World + 复用 Entity)
// 模拟 advance 1 年的总耗时

import { World } from '../src/lib/xianxia/ecs/core';
import type { Entity } from '../src/lib/xianxia/ecs/core';
import {
  createCharacterEntity,
  entityToSnapshot,
} from '../src/lib/xianxia/ecs/character-entity';
import type { MetaComponent, CultivationComponent } from '../src/lib/xianxia/ecs/components';
import { AgingSystem } from '../src/lib/xianxia/ecs/systems/aging-system';
import { CultivationSystem } from '../src/lib/xianxia/ecs/systems/cultivation-system';
import type { CharacterStateSnapshot } from '../src/lib/xianxia/events/types';

function makeSnapshot(characterId: string, age: number, cultivationExp: number): CharacterStateSnapshot {
  return {
    characterId,
    name: 'bench-char',
    age,
    realm: 'qi-refining',
    cultivationExp,
    hp: 100,
    maxHp: 100,
    spiritStones: 0,
    alive: true,
    lifespan: 200,
    inventory: [],
  };
}

// --- 旧逻辑: 每次 advance 都 new World + addSystem + createCharacterEntity ---
function ecsOldPerAdvance(characterId: string, baseSnapshot: CharacterStateSnapshot) {
  const world = new World();
  createCharacterEntity(world, baseSnapshot);
  world.addSystem(AgingSystem);
  world.addSystem(CultivationSystem);
  world.tick();
  const ticked = world.getEntity(`character-${characterId}`);
  if (ticked) {
    const s = entityToSnapshot(ticked);
    return { age: s.age, cultivationExp: s.cultivationExp, alive: s.alive };
  }
  return null;
}

// --- 新逻辑: 模块作用域缓存, 复用 World + Systems + Entity ---
type EcsCache = { world: World; entity: Entity; charId: string };
let cache: EcsCache | null = null;

function ecsNewPerAdvance(characterId: string, baseSnapshot: CharacterStateSnapshot) {
  if (!cache || cache.charId !== characterId || cache.world.listEntities().length === 0) {
    const fresh = new World();
    fresh.addSystem(AgingSystem);
    fresh.addSystem(CultivationSystem);
    const entity = createCharacterEntity(fresh, baseSnapshot);
    cache = { world: fresh, entity, charId: characterId };
  } else {
    const meta = cache.entity.getComponent<MetaComponent>('Meta')!;
    const cultivation = cache.entity.getComponent<CultivationComponent>('Cultivation')!;
    meta.age = baseSnapshot.age;
    meta.alive = baseSnapshot.alive;
    meta.lifespan = baseSnapshot.lifespan;
    cultivation.cultivationExp = baseSnapshot.cultivationExp;
  }
  cache.world.tick();
  const ticked = cache.world.getEntity(`character-${characterId}`);
  if (ticked) {
    const s = entityToSnapshot(ticked);
    return { age: s.age, cultivationExp: s.cultivationExp, alive: s.alive };
  }
  return null;
}

const ITER = 2000; // 模拟连续 advance 2000 次 (相当于 1 年里多次 advance 调用)
const WARMUP = 200;

function bench(label: string, fn: () => any) {
  for (let i = 0; i < WARMUP; i++) fn();
  const start = Bun.nanoseconds();
  for (let i = 0; i < ITER; i++) fn();
  const end = Bun.nanoseconds();
  const totalMs = (end - start) / 1e6;
  const perOpUs = ((end - start) / 1000) / ITER;
  console.log(`  ${label.padEnd(40)} total=${totalMs.toFixed(2)}ms  perOp=${perOpUs.toFixed(2)}us`);
  return { totalMs, perOpUs };
}

console.log(`Benchmark: ECS tick block, ${ITER} iters (warmup=${WARMUP})\n`);

const charId = 'bench-char-001';
let baseSnapshot = makeSnapshot(charId, 16, 0);

// 1) 旧逻辑: 每次新建 World
console.log('[OLD] new World + addSystem + createCharacterEntity every advance:');
const oldRes = bench('advance tick', () => {
  baseSnapshot = makeSnapshot(charId, baseSnapshot.age, baseSnapshot.cultivationExp);
  return ecsOldPerAdvance(charId, baseSnapshot);
});

// 2) 新逻辑: 复用 World + Entity
console.log('[NEW] cached World + Entity, only update Meta/Cultivation + tick:');
cache = null;
baseSnapshot = makeSnapshot(charId, 16, 0);
const newRes = bench('advance tick', () => {
  baseSnapshot = makeSnapshot(charId, baseSnapshot.age, baseSnapshot.cultivationExp);
  return ecsNewPerAdvance(charId, baseSnapshot);
});

console.log(`\n--- Summary ---`);
console.log(`OLD total: ${oldRes.totalMs.toFixed(2)}ms for ${ITER} advances`);
console.log(`NEW total: ${newRes.totalMs.toFixed(2)}ms for ${ITER} advances`);
const savedMs = oldRes.totalMs - newRes.totalMs;
const savedPct = (savedMs / oldRes.totalMs) * 100;
console.log(`SAVED:    ${savedMs.toFixed(2)}ms (${savedPct.toFixed(1)}%)`);
console.log(`per-advance: OLD=${oldRes.perOpUs.toFixed(2)}us  NEW=${newRes.perOpUs.toFixed(2)}us  delta=${(oldRes.perOpUs - newRes.perOpUs).toFixed(2)}us`);

// 3) 校验: 输出最后一次结果, 确认新旧逻辑数值一致
console.log(`\n--- Sanity check (last result) ---`);
cache = null;
let finalNew = null;
for (let i = 0; i < 10; i++) {
  baseSnapshot = makeSnapshot(charId, baseSnapshot.age, baseSnapshot.cultivationExp);
  finalNew = ecsNewPerAdvance(charId, baseSnapshot);
}
let finalOld = null;
for (let i = 0; i < 10; i++) {
  baseSnapshot = makeSnapshot(charId, baseSnapshot.age, baseSnapshot.cultivationExp);
  finalOld = ecsOldPerAdvance(charId, baseSnapshot);
}
console.log(`OLD last: ${JSON.stringify(finalOld)}`);
console.log(`NEW last: ${JSON.stringify(finalNew)}`);
console.log(`Match: ${JSON.stringify(finalOld) === JSON.stringify(finalNew) ? 'YES' : 'NO'}`);

// 4) charId 切换测试
console.log(`\n--- CharId switch test ---`);
const charA = 'char-A';
const charB = 'char-B';
cache = null;
const resA = ecsNewPerAdvance(charA, makeSnapshot(charA, 16, 0));
const resB = ecsNewPerAdvance(charB, makeSnapshot(charB, 30, 100));
const resA2 = ecsNewPerAdvance(charA, makeSnapshot(charA, 17, 5));
const resB2 = ecsNewPerAdvance(charB, makeSnapshot(charB, 31, 200));
console.log(`A1: ${JSON.stringify(resA)} (expected age=17, cultivationExp≈0)`);
console.log(`B1: ${JSON.stringify(resB)} (expected age=31, cultivationExp≈100)`);
console.log(`A2: ${JSON.stringify(resA2)} (expected age=18, cultivationExp≈5)`);
console.log(`B2: ${JSON.stringify(resB2)} (expected age=32, cultivationExp≈200)`);
console.log(`Switch clean: ${resA2 && resA2.age === 18 && resB2 && resB2.age === 32 ? 'YES' : 'NO'}`);