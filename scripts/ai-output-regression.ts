// @ts-nocheck - script tool, no strict types needed

// scripts/ai-output-regression.ts
// TechDoc 18.6.7 AI 输出回归测试 PoC
//
// 目标：
//   1. **不实跑 LLM**：只比对预存的 expectedOutput JSON（snapshot）
//   2. **合规检查**：所有 fixture 输出不能含内部机制词（"引擎"/"AI"/"缓存"/...）
//   3. **schema 校验**：每个 fixture 的 expectedOutput 必须满足 expectedSchema
//
// Fixture 位置：tests/fixtures/ai-output/*.json
// 加新 fixture 只需在目录里加一个 .json 文件，无需改此脚本。

import fs from 'fs';
import path from 'path';

interface AITestCase {
  id: string;
  prompt: string;          // 输入 prompt（仅做调试用，不实跑）
  expectedSchema: Record<string, string>;  // { fieldName: 'string'|'number'|'boolean'|'object' }
  expectedOutput: any;     // snapshot：期望输出
  tags: string[];          // ['combat', 'infant', 'cultivation', ...]
  notes?: string;          // 可选：fixture 备注
}

// 项目根 = scripts/ 的上一级（用 fileURLToPath 避免 import.meta.dir 类型问题）
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname_esm = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname_esm, '..', 'tests', 'fixtures', 'ai-output');

// ==================== 合规词（面向玩家可见文本） ====================
// 这些词出现在 expectedOutput 里就是 PoC 失败。
// 涵盖中英文，避免 AI 把内部机制暴露给玩家。
const BANNED_TERMS = [
  // 中文
  '引擎', '缓存', '命节点', '天道干预', '预演', '预加载', '节点', '配置',
  'LLM', '大模型', '接口', '请求', '后端', '服务端', '数据库',
  // 英文
  'engine', 'cache', 'node', 'config', 'render', 'backend', 'server',
  'api', 'json', 'http', 'fetch', 'pipeline',
];

// ==================== Fixture Loader ====================
function loadFixtures(): AITestCase[] {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.warn(`[AI Regression] fixtures dir not found: ${FIXTURES_DIR}`);
    return [];
  }
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
  const out: AITestCase[] = [];
  for (const f of files) {
    const fullPath = path.join(FIXTURES_DIR, f);
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const tc = JSON.parse(raw) as AITestCase;
      // 基础校验
      if (!tc.id || !tc.expectedSchema || !tc.expectedOutput) {
        console.warn(`[AI Regression] skip invalid fixture: ${f} (missing id/schema/output)`);
        continue;
      }
      out.push(tc);
    } catch (e: any) {
      console.warn(`[AI Regression] skip malformed JSON: ${f} (${e?.message || e})`);
    }
  }
  return out;
}

// ==================== 单 fixture 验证 ====================
function validateFixture(tc: AITestCase): { passed: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. schema key 存在性 + 类型
  for (const [key, expectedType] of Object.entries(tc.expectedSchema)) {
    const v = tc.expectedOutput?.[key];
    if (v === undefined) {
      errors.push(`schema missing key: ${key}`);
      continue;
    }
    const actualType = Array.isArray(v) ? 'array' : typeof v;
    if (expectedType !== actualType) {
      errors.push(`schema type mismatch: ${key} expected=${expectedType} actual=${actualType}`);
    }
  }

  // 2. schema 中声明的字段不允许 undefined
  for (const [key] of Object.entries(tc.expectedSchema)) {
    if (tc.expectedOutput?.[key] === undefined) {
      errors.push(`output field undefined: ${key}`);
    }
  }

  // 3. 合规词检查（扫描整个 expectedOutput JSON 序列化字符串）
  const outputStr = JSON.stringify(tc.expectedOutput);
  for (const banned of BANNED_TERMS) {
    if (outputStr.includes(banned)) {
      errors.push(`banned term in output: "${banned}"`);
    }
  }

  // 4. 文本长度合理性（叙事文本 1-500 字；过短或过长可疑）
  if (typeof tc.expectedOutput?.narrative === 'string') {
    const len = tc.expectedOutput.narrative.length;
    if (len < 4) {
      errors.push(`narrative too short: ${len} chars`);
    }
    if (len > 500) {
      errors.push(`narrative too long: ${len} chars`);
    }
  }

  // 5. triggerCombat 必须是 boolean（若有）
  if ('triggerCombat' in tc.expectedOutput) {
    if (typeof tc.expectedOutput.triggerCombat !== 'boolean') {
      errors.push(`triggerCombat must be boolean, got ${typeof tc.expectedOutput.triggerCombat}`);
    }
  }

  return { passed: errors.length === 0, errors };
}

// ==================== Test Runner ====================
export interface RegressionResult {
  passed: number;
  failed: number;
  total: number;
  details: Array<{ id: string; errors: string[] }>;
}

export function runRegressionTests(): RegressionResult {
  const fixtures = loadFixtures();
  console.log(`\n[AI Output Regression] loaded ${fixtures.length} fixture(s)`);

  if (fixtures.length === 0) {
    console.log('  (no fixtures — drop JSON files into tests/fixtures/ai-output/ to enable)');
    return { passed: 0, failed: 0, total: 0, details: [] };
  }

  let passed = 0;
  let failed = 0;
  const details: Array<{ id: string; errors: string[] }> = [];

  for (const tc of fixtures) {
    const r = validateFixture(tc);
    if (r.passed) {
      passed++;
      console.log(`  ✓ ${tc.id}`);
    } else {
      failed++;
      console.error(`  ✗ ${tc.id}: ${r.errors.join('; ')}`);
      details.push({ id: tc.id, errors: r.errors });
    }
  }

  return { passed, failed, total: fixtures.length, details };
}

// ==================== Entry Point ====================
if (import.meta.main) {
  const result = runRegressionTests();
  console.log(
    `\n=== AI Output Regression: ${result.passed}/${result.total} pass / ${result.failed} fail ===`
  );
  if (result.failed > 0) {
    process.exit(1);
  }
}