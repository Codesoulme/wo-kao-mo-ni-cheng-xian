// @ts-nocheck - script tool, no strict types needed

// scripts/audit-smoke-coverage.ts
// AI-106: smoke 覆盖率审计
// 用法: bun scripts/audit-smoke-coverage.ts
//
// 目标:
//   1. 列出 display-registry.ts 中定义的 7 个 DisplaySlot:
//      topTags / characterDetail / statusPage / threadPage / combatPanel / inventoryPanel / worldLegacy
//   2. 扫描 scripts/ 下所有 *.ts (含 xianxia-regression-smoke.ts) 里:
//      - 直接 import 自 display-registry 的覆盖率
//      - 通过 React 组件 / 路径出现 slot 字面量的覆盖率
//      - engine.ts 哪些 export function 被 smoke 测过
//   3. 写出 smoke-coverage-report.md

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ALL_SLOTS = [
  'topTags',
  'characterDetail',
  'statusPage',
  'threadPage',
  'combatPanel',
  'inventoryPanel',
  'worldLegacy',
] as const;

interface SlotCoverage {
  slot: string;
  displayRegistryHits: number;
  reactComponentHits: number;
  smokeHits: number;
  covered: boolean;
}

interface FnCoverage {
  name: string;
  importHits: number;
  callHits: number;
  covered: boolean;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const ROOT = '.';
const SCRIPTS_DIR = 'scripts';
const SRC_DIR = 'src';

// 收集源文件
const scriptFiles = existsSync(SCRIPTS_DIR)
  ? walk(SCRIPTS_DIR).filter((p) => !p.includes('node_modules'))
  : [];
const srcFiles = walk(SRC_DIR);

console.log(`[smoke-audit] scripts: ${scriptFiles.length}, src: ${srcFiles.length}`);

// ---------- 1) DisplaySlot 覆盖率 ----------
const slotCov: SlotCoverage[] = ALL_SLOTS.map((slot) => ({
  slot,
  displayRegistryHits: 0,
  reactComponentHits: 0,
  smokeHits: 0,
  covered: false,
}));

// 扫 display-registry 自身 (基准)
const displayRegistryPath = 'src/lib/xianxia/display-registry.ts';
let displayRegistrySrc = '';
if (existsSync(displayRegistryPath)) {
  displayRegistrySrc = readFileSync(displayRegistryPath, 'utf-8');
}

// 扫 src/**/*.tsx 中是否引用了某个 slot 字面量 (一般是 entriesForSlot 调用)
const slotRefPattern = new RegExp(`(['"\`]${ALL_SLOTS.join('|')}['"\`])`, 'g');
let reactHits: Record<string, number> = {};
for (const f of srcFiles) {
  const src = readFileSync(f, 'utf-8');
  let mm: RegExpExecArray | null;
  slotRefPattern.lastIndex = 0;
  while ((mm = slotRefPattern.exec(src))) {
    const slot = mm[1].slice(1, -1);
    reactHits[slot] = (reactHits[slot] ?? 0) + 1;
  }
}

// 扫 scripts/* 中是否覆盖了 slot
for (const f of scriptFiles) {
  const src = readFileSync(f, 'utf-8');
  let mm: RegExpExecArray | null;
  slotRefPattern.lastIndex = 0;
  while ((mm = slotRefPattern.exec(src))) {
    const slot = mm[1].slice(1, -1);
    const cov = slotCov.find((s) => s.slot === slot);
    if (cov) cov.smokeHits++;
  }
}

// 扫 src 中 import 自 display-registry 的频次
const displayRegImportPattern = /from\s+['"][^'"]*display-registry['"]/g;
let displayRegImports = 0;
for (const f of srcFiles) {
  const src = readFileSync(f, 'utf-8');
  if (displayRegImportPattern.test(src)) displayRegImports++;
}

for (const cov of slotCov) {
  cov.reactComponentHits = reactHits[cov.slot] ?? 0;
  cov.covered = cov.reactComponentHits > 0 && cov.smokeHits > 0;
}

// ---------- 2) engine.ts export function 覆盖率 ----------
const enginePath = 'src/lib/xianxia/engine.ts';
const engineSrc = existsSync(enginePath) ? readFileSync(enginePath, 'utf-8') : '';
const engineFnPattern = /^export function (\w+)/gm;
const fnNames: string[] = [];
let mm: RegExpExecArray | null;
while ((mm = engineFnPattern.exec(engineSrc))) {
  fnNames.push(mm[1]);
}
console.log(`[smoke-audit] engine.ts exported functions: ${fnNames.length}`);

const fnCov: FnCoverage[] = fnNames.map((name) => {
  let importHits = 0;
  let callHits = 0;
  // scripts 里直接 import engine 的会被 named import, 检查 named symbol
  for (const f of scriptFiles) {
    const src = readFileSync(f, 'utf-8');
    const importLinePattern = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"][^'"]*engine['"]`, 'g');
    if (importLinePattern.test(src)) importHits++;
    const callPattern = new RegExp(`\\b${name}\\s*\\(`, 'g');
    const matches = src.match(callPattern);
    if (matches) callHits += matches.length;
  }
  return { name, importHits, callHits, covered: importHits > 0 && callHits > 0 };
});

// ---------- 3) 输出 ----------
const coveredSlots = slotCov.filter((s) => s.covered).length;
const coveredFns = fnCov.filter((f) => f.covered).length;
const slotPct = ((coveredSlots / slotCov.length) * 100).toFixed(1);
const fnPct = ((coveredFns / fnCov.length) * 100).toFixed(1);

console.log('\n[smoke-audit] === DisplaySlot coverage ===');
for (const s of slotCov) {
  console.log(`  ${s.covered ? '✓' : '✗'}  ${s.slot.padEnd(20)} display-reg=${s.displayRegistryHits} react=${s.reactComponentHits} smoke=${s.smokeHits}`);
}
console.log(`\n  total: ${coveredSlots}/${slotCov.length} (${slotPct}%)`);

console.log('\n[smoke-audit] === engine.ts export fn coverage (top 30 by callHits) ===');
const sorted = [...fnCov].sort((a, b) => b.callHits - a.callHits);
for (const f of sorted.slice(0, 30)) {
  console.log(`  ${f.covered ? '✓' : '✗'}  ${f.name.padEnd(40)} imports=${f.importHits} calls=${f.callHits}`);
}
console.log(`\n  covered: ${coveredFns}/${fnCov.length} (${fnPct}%)`);

// ---------- 4) 落 JSON ----------
if (!existsSync('logs/bench')) mkdirSync('logs/bench', { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const summary = {
  suite: 'audit-smoke-coverage',
  date: new Date().toISOString(),
  scriptCount: scriptFiles.length,
  srcCount: srcFiles.length,
  displayRegImports,
  slotCoverage: slotCov,
  slotCoveragePct: Number(slotPct),
  fnCoverage: fnCov,
  fnCoveragePct: Number(fnPct),
  uncoveredSlots: slotCov.filter((s) => !s.covered).map((s) => s.slot),
  uncoveredFns: fnCov.filter((f) => !f.covered).map((f) => f.name),
};
writeFileSync(`logs/bench/smoke-coverage.${ts}.json`, JSON.stringify(summary, null, 2));
console.log(`\n[smoke-audit] wrote logs/bench/smoke-coverage.${ts}.json`);
console.log(JSON.stringify(summary));