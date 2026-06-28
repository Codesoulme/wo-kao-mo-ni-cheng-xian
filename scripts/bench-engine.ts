// @ts-nocheck - script tool, no strict types needed

// scripts/bench-engine.ts
// AI-76: engine 派生函数性能基线
// 用法：bun scripts/bench-engine.ts
import {
  resolveTribulationBolt,
  resolveHeartDemon,
  deriveCrossRealmPaths,
  checkRestrictionAccess,
  deriveAscensionRequirements,
} from '../src/lib/xianxia/engine';
import type { Restriction } from '../src/lib/xianxia/types';

const ITERATIONS = 10000;

interface BenchResult { name: string; iterations: number; totalMs: number; perOpUs: number }

function bench(name: string, fn: () => void): BenchResult {
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) fn();
  const totalMs = performance.now() - start;
  const perOpUs = (totalMs * 1000) / ITERATIONS;
  return { name, iterations: ITERATIONS, totalMs, perOpUs };
}

const results: BenchResult[] = [];

// resolveTribulationBolt
results.push(bench('resolveTribulationBolt', () => {
  resolveTribulationBolt({
    boltNumber: (Math.floor(Math.random() * 9) + 1),
    characterRoll: Math.random(),
    heartDemon: Math.floor(Math.random() * 100),
    soulStrength: Math.floor(Math.random() * 100),
    bondedArtifactResonance: Math.random() > 0.5,
  });
}));

// resolveHeartDemon
results.push(bench('resolveHeartDemon', () => {
  resolveHeartDemon({
    innerState: {
      obsession: Math.random() * 100,
      hatred: Math.random() * 100,
      love: Math.random() * 100,
      fear: Math.random() * 100,
      regret: Math.random() * 100,
    },
    resolveRoll: Math.random(),
  });
}));

// deriveCrossRealmPaths
results.push(bench('deriveCrossRealmPaths', () => {
  deriveCrossRealmPaths('humanWorld');
  deriveCrossRealmPaths('spiritWorld');
  deriveCrossRealmPaths('immortalWorld');
}));

// checkRestrictionAccess (key 模式)
const r: Restriction = {
  id: 'r1', name: '禁门', type: 'door', accessMethod: 'key', requiredItemId: 'k1',
  description: '', difficulty: 50,
};
results.push(bench('checkRestrictionAccess', () => {
  checkRestrictionAccess(r, {
    inventory: [],
    realm: 'qi_refining',
    faction: '青云宗',
  });
}));

// deriveAscensionRequirements
results.push(bench('deriveAscensionRequirements', () => {
  deriveAscensionRequirements('humanWorld');
  deriveAscensionRequirements('spiritWorld');
  deriveAscensionRequirements('immortalWorld');
}));

// 输出
const summary = results.map((r) => ({
  name: r.name,
  iters: r.iterations,
  totalMs: Number(r.totalMs.toFixed(2)),
  perOpUs: Number(r.perOpUs.toFixed(2)),
}));
console.log(JSON.stringify({ suite: 'bench-engine', iterations: ITERATIONS, results: summary }));

// 写基线
const baseline = {
  date: new Date().toISOString(),
  iterations: ITERATIONS,
  results: summary,
};
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
if (!existsSync('logs/bench')) mkdirSync('logs/bench', { recursive: true });
writeFileSync('logs/bench/engine.baseline.json', JSON.stringify(baseline, null, 2));
console.log(JSON.stringify({ passed: true, suite: 'bench-engine', baseline: 'logs/bench/engine.baseline.json' }));