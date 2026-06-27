// scripts/perf-engine-cold-path.ts
// AI-104: engine cold-path perf audit
// 用法: bun scripts/perf-engine-cold-path.ts
//
// 目标:
//   1. 把 engine.ts 在"advance 一拍"里最常被调用的纯函数 cold-path 全跑一遍 benchmark
//   2. 每个函数 10000 次迭代, 统计 per-op 微秒
//   3. 任何 per-op > 100us 的函数记入 hot path 列表, 写到 perf-report.md
//   4. JSON 结果落到 logs/bench/engine-cold-path.<timestamp>.json
//
// 设计要点:
//   - 不依赖 dev server / DB, 直接 import engine + types, 在内存里造 CharacterState fixture
//   - fixture 覆盖真实生产路径会触发的字段: equipped / status / cultivationAttributes / faction / location
//   - 跑两轮 (warmup + measure) 以避免冷启动噪声

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import {
  isMeaningfulStatus,
  filterMeaningfulStatuses,
  normalizeIdentityStatuses,
  ensureUniqueIds,
  tickStatusDurations,
  tickNaturalRecovery,
  recalcCultivationMultiplier,
  computeEffectiveCultivationRate,
  computeCultivationFactors,
  normalizeCultivationState,
  applyChanges,
  isConstitutionStatus,
  deriveCultivationAttributes,
} from '../src/lib/xianxia/engine';
import type {
  CharacterState,
  StatusEntry,
  ItemEntry,
  AttributeChange,
} from '../src/lib/xianxia/types';

const ITERATIONS = 10000;
const HOT_PATH_THRESHOLD_US = 100; // > 100us/op 算 hot path

// ---------- 构造合成 fixture (不依赖 DB) ----------

function makeStatus(overrides: Partial<StatusEntry> = {}): StatusEntry {
  return {
    id: overrides.id ?? `st_${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? 'lushi',
    description: overrides.description ?? '体内灵气充盈',
    category: overrides.category ?? 'buff',
    rarity: overrides.rarity ?? 'common',
    duration: overrides.duration ?? -1,
    source: overrides.source ?? 'birth',
    effects: overrides.effects ?? [
      { target_attribute: 'cultivationExp', operation: 'add', value: 5, description: '小补' },
    ],
    ...overrides,
  } as StatusEntry;
}

function makeItem(overrides: Partial<ItemEntry> = {}): ItemEntry {
  return {
    id: overrides.id ?? `it_${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? '青锋剑',
    description: overrides.description ?? '一柄普通的灵剑',
    item_type: overrides.item_type ?? 'weapon',
    rarity: overrides.rarity ?? 'common',
    effects: overrides.effects ?? [
      { target_attribute: 'attack', operation: 'add', value: 3, description: '锋锐' },
    ],
    source: overrides.source ?? 'birth',
    ...overrides,
  } as ItemEntry;
}

function makeBaseState(): CharacterState {
  return {
    id: 'perf_char_001',
    name: '性能测试体',
    gender: 'male',
    age: 24,
    lifespan: 200,
    spiritualRoot: 'pure',
    rootDetail: '天灵根',
    rootMultiplier: 1.5,
    realm: 'foundation',
    realmName: '筑基期',
    realmColor: '#22c55e',
    realmLevel: 3,
    realmMaxLevel: 9,
    cultivationExp: 5400,
    expToBreak: 6000,
    elements: { metal: 30, wood: 30, water: 30, fire: 30, earth: 30 },
    hp: 100, maxHp: 100,
    mp: 60, maxMp: 60,
    attack: 20, defense: 12, speed: 14,
    luck: 60, comprehension: 75,
    spiritStones: 100, reputation: 50,
    alive: true, ascended: false,
    causeOfDeath: '',
    faction: '青云宗',
    master: '玄明真人',
    location: '青云山',
    fateNodes: [],
    isAtChoice: false,
    activeStatuses: [
      makeStatus({ name: 'lushi充盈', category: 'buff', rarity: 'common' }),
      makeStatus({ name: '心绪不宁', category: 'debuff', rarity: 'uncommon', duration: 3 }),
      makeStatus({ name: '剑心通明', category: 'special', rarity: 'rare' }),
      makeStatus({ name: '青云弟子', category: 'identity', rarity: 'common' }),
      makeStatus({ name: '中毒', category: 'debuff', rarity: 'rare', duration: 5 }),
    ],
    inventory: [
      makeItem({ name: '青锋剑', item_type: 'weapon' }),
      makeItem({ name: '回灵丹', item_type: 'consumable' }),
      makeItem({ name: '五行诀', item_type: 'scripture' }),
    ],
    equipped: [
      makeItem({ id: 'eq_1', name: '青锋剑(装备)', item_type: 'weapon' }),
      makeItem({ id: 'eq_2', name: '五行诀(装备)', item_type: 'scripture' }),
    ],
    storageCapacity: 5,
    cultivationMultiplier: 0,
    cultivationInsight: '近日闭关, 丹田渐满',
    cultivationAttributes: [
      { id: 'spiritualSense', displayLabel: '神识', category: 'spirit', priority: 88 } as any,
      { id: 'soulStrength', displayLabel: '魂力', category: 'spirit', priority: 88 } as any,
      { id: 'physicalFoundation', displayLabel: '体魄', category: 'body', priority: 88 } as any,
    ],
    pendingThreads: [],
    questEntries: [],
    characterIntents: [],
    combatSession: null,
    heartDemon: 12,
    pets: [],
    exploredRealms: [],
    discoveredRealms: [],
  } as unknown as CharacterState;
}

const FIXTURE = makeBaseState();

// ---------- benchmark runner ----------

interface BenchResult {
  name: string;
  iterations: number;
  totalMs: number;
  perOpUs: number;
  hotPath: boolean;
}

function bench(name: string, fn: () => void): BenchResult {
  // 跑两次, 第二次计时 (丢弃 JIT warmup)
  fn();
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) fn();
  const totalMs = performance.now() - start;
  const perOpUs = (totalMs * 1000) / ITERATIONS;
  return {
    name,
    iterations: ITERATIONS,
    totalMs: Number(totalMs.toFixed(2)),
    perOpUs: Number(perOpUs.toFixed(2)),
    hotPath: perOpUs > HOT_PATH_THRESHOLD_US,
  };
}

const results: BenchResult[] = [];

console.log('[perf] AI-104 engine cold-path audit');
console.log(`[perf] iterations=${ITERATIONS}, hot-path threshold=${HOT_PATH_THRESHOLD_US}us/op`);

// 1) isMeaningfulStatus
results.push(bench('isMeaningfulStatus', () => {
  for (const s of FIXTURE.activeStatuses) isMeaningfulStatus(s);
}));

// 2) filterMeaningfulStatuses
results.push(bench('filterMeaningfulStatuses', () => {
  filterMeaningfulStatuses(FIXTURE.activeStatuses);
}));

// 3) normalizeIdentityStatuses
results.push(bench('normalizeIdentityStatuses', () => {
  normalizeIdentityStatuses(FIXTURE.activeStatuses);
}));

// 4) ensureUniqueIds
const dupStatuses = FIXTURE.activeStatuses.concat(FIXTURE.activeStatuses.slice(0, 2));
const dupItems = FIXTURE.inventory.concat(FIXTURE.inventory.slice(0, 1));
results.push(bench('ensureUniqueIds', () => {
  ensureUniqueIds(dupStatuses, dupItems);
}));

// 5) tickStatusDurations
const stateForTick: CharacterState = JSON.parse(JSON.stringify(FIXTURE));
results.push(bench('tickStatusDurations', () => {
  tickStatusDurations(stateForTick);
}));

// 6) tickNaturalRecovery
results.push(bench('tickNaturalRecovery', () => {
  tickNaturalRecovery(stateForTick);
}));

// 7) recalcCultivationMultiplier
results.push(bench('recalcCultivationMultiplier', () => {
  recalcCultivationMultiplier(stateForTick);
}));

// 8) computeEffectiveCultivationRate
results.push(bench('computeEffectiveCultivationRate', () => {
  computeEffectiveCultivationRate(stateForTick);
}));

// 9) computeCultivationFactors
results.push(bench('computeCultivationFactors', () => {
  computeCultivationFactors(stateForTick);
}));

// 10) normalizeCultivationState
results.push(bench('normalizeCultivationState', () => {
  normalizeCultivationState(stateForTick);
}));

// 11) applyChanges
const sampleChanges: AttributeChange[] = [
  { attribute: 'cultivationExp', delta: 50, reason: '闭关' },
  { attribute: 'hp', delta: -10, reason: '受伤' },
];
results.push(bench('applyChanges', () => {
  applyChanges(stateForTick, sampleChanges);
}));

// 12) isConstitutionStatus
results.push(bench('isConstitutionStatus', () => {
  isConstitutionStatus(FIXTURE.activeStatuses[0]);
}));

// 13) deriveCultivationAttributes
results.push(bench('deriveCultivationAttributes', () => {
  deriveCultivationAttributes(stateForTick);
}));

// ---------- 汇总 ----------
const hot = results.filter((r) => r.hotPath);
const ok = results.filter((r) => !r.hotPath);

console.log('\n[perf] === cold-path summary ===');
for (const r of results) {
  const tag = r.hotPath ? '🔥 HOT' : 'ok  ';
  console.log(`  ${tag}  ${r.name.padEnd(34)} ${r.perOpUs.toFixed(2)}us/op  (total ${r.totalMs}ms / ${r.iterations} iters)`);
}
console.log(`\n[perf] hot paths: ${hot.length}, ok: ${ok.length}`);

// ---------- 落 JSON baseline ----------
if (!existsSync('logs/bench')) mkdirSync('logs/bench', { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const baseline = {
  suite: 'perf-engine-cold-path',
  date: new Date().toISOString(),
  iterations: ITERATIONS,
  thresholdUs: HOT_PATH_THRESHOLD_US,
  results,
  hotPaths: hot.map((h) => h.name),
};
writeFileSync(`logs/bench/engine-cold-path.${ts}.json`, JSON.stringify(baseline, null, 2));

console.log(`\n[perf] wrote logs/bench/engine-cold-path.${ts}.json`);

// 输出 final JSON 给后续 reporter 解析
console.log(JSON.stringify(baseline));