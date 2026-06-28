// scripts/property-tests.ts
// TechDoc 18.6.7 属性测试 PoC（手写 RNG，不依赖 fast-check 库）
// 目标：对任意随机输入，验证引擎不变量始终成立
//
// 设计原则：
//   1. 只用引擎已 export 的真实函数（ATTRIBUTE_BOUNDS / applyChanges）
//   2. 用确定性 LCG RNG（Linear Congruential Generator），保证可重放
//   3. 注释保留 TODO：等真实 computeEffectiveAttack / computeRealmCap 实现后再启用
//
// 注意：此脚本不实跑 LLM，纯数学 + engine 状态机验证。

import { ATTRIBUTE_BOUNDS, applyChanges } from '../src/lib/xianxia/engine';
import type { CharacterState, AttributeChange } from '../src/lib/xianxia/types';

// ==================== 工具：可重放 LCG RNG ====================
// glibc 风格 LCG：seed = seed * 1103515245 + 12345 (mod 2^31)
// 优点：纯算术、无外部依赖、跨平台一致
class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed >>> 0;
  }
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// ==================== 构造合法测试 state ====================
// ATTRIBUTE_BOUNDS 默认字段（hp/mp/attack/...）都给到中间值，绕过缺字段
function makeBaseState(): CharacterState {
  return {
    id: 'prop-test',
    name: '属性测试角色',
    age: 24,
    realm: 'qi_refining',
    faction: '青岚派',
    spiritualRoot: 'water',
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    attack: 30,
    defense: 20,
    speed: 10,
    luck: 5,
    comprehension: 50,
    spiritualSense: 100,
    lifespan: 200,
    cultivationExp: 1000,
    cultivationMultiplier: 1,
    statuses: [],
    items: [],
    techniques: [],
    bonds: [],
    activeFormation: null,
    pet: null,
    npcs: [],
    threads: [],
    worldFacts: [],
    causalGraph: { nodes: [], edges: [] },
    realmProfile: {
      realmId: 'qi_refining',
      name: '炼气',
      category: 'cultivation',
      powerMultiplier: 1.5,
    },
  } as unknown as CharacterState;
}

// ==================== 属性测试 1: ATTRIBUTE_BOUNDS 钳制 ====================
// 不变量：applyChanges 永远不应让 attribute 越出 ATTRIBUTE_BOUNDS
// 注意：只测试 makeBaseState 里已声明的字段；其它 ATTRIBUTE_BOUNDS 字段
//   （如 heartDemon）由引擎内部维护，这里跳过以免污染 base 状态。
const TESTED_ATTRS = [
  'lifespan', 'cultivationExp', 'hp', 'maxHp', 'mp', 'maxMp',
  'attack', 'defense', 'speed', 'luck', 'comprehension', 'spiritualSense',
] as const;
export function propAttributeBoundsRespected(iterations = 200): void {
  const trackedKeys: string[] = [...TESTED_ATTRS];

  for (let i = 0; i < iterations; i++) {
    const rng = new SeededRandom(0xA17B0001 + i);
    const state = makeBaseState();
    const attrKey = rng.pick(trackedKeys);
    const bounds = ATTRIBUTE_BOUNDS[attrKey];

    // 随机 change：add 操作，幅度极端大（±100000）测试钳制
    const delta = rng.int(-100000, 100000);
    const change: AttributeChange = {
      target_attribute: attrKey,
      operation: 'add',
      value: delta,
    };

    const next = applyChanges(state, [change]);
    const newVal = (next as any)[attrKey];

    if (typeof newVal !== 'number') {
      throw new Error(`propAttributeBounds: attr=${attrKey} is not number (got ${typeof newVal})`);
    }
    if (newVal < bounds.min - 1e-9 || newVal > bounds.max + 1e-9) {
      throw new Error(
        `propAttributeBounds violation: attr=${attrKey} val=${newVal} not in [${bounds.min}, ${bounds.max}] (delta=${delta}, seed iter=${i})`
      );
    }
  }
}

// ==================== 属性测试 2: applyChanges 幂等（同 changes 多次应用） ====================
// 不变量：相同 AttributeChange[] 应用 N 次，结果等于应用 1 次
//   验证 applyChanges 是纯函数映射（无隐藏随机 / 时间副作用）
export function propApplyChangesIdempotent(iterations = 100): void {
  for (let i = 0; i < iterations; i++) {
    const rng = new SeededRandom(0x1DE11A + i);
    const state = makeBaseState();

    const changes: AttributeChange[] = [
      { target_attribute: 'attack', operation: 'add', value: rng.int(-50, 50) },
      { target_attribute: 'hp', operation: 'add', value: rng.int(-100, 100) },
      { target_attribute: 'mp', operation: 'add', value: rng.int(-50, 50) },
      { target_attribute: 'cultivationExp', operation: 'add', value: rng.int(-500, 500) },
    ];

    const once = applyChanges(state, changes);
    const twice = applyChanges(once, changes);

    for (const ch of changes) {
      const a = (once as any)[ch.target_attribute];
      const b = (twice as any)[ch.target_attribute];
      if (a !== b) {
        throw new Error(
          `propApplyChangesIdempotent violation: attr=${ch.target_attribute} once=${a} twice=${b} iter=${i}`
        );
      }
    }
  }
}

// ==================== 属性测试 3: 炼丹数值钳制（基于 ALCHEMY_VALUE_CAP_BY_RARITY 思路） ====================
// 不变量：品阶越高的物品，能给出的属性 add 上限越大；低品阶绝不能超越自身 cap
//   由于 ALCHEMY_VALUE_CAP_BY_RARITY 在 engine.ts 里是 const（非 export），
//   这里用 ATTRIBUTE_BOUNDS max 做"硬上限"的近似测试，验证任何 add 都不会让属性爆炸
export function propNoAttributeExplosion(iterations = 150): void {
  for (let i = 0; i < iterations; i++) {
    const rng = new SeededRandom(0xE8E10510 + i);
    const state = makeBaseState();

    // 一次注入极端 change
    const ch: AttributeChange = {
      target_attribute: 'attack',
      operation: 'add',
      value: 1_000_000, // 远超 ATTRIBUTE_BOUNDS.attack.max = 99999
    };

    const next = applyChanges(state, [ch]);
    const finalAttack = (next as any).attack;
    const max = ATTRIBUTE_BOUNDS.attack.max;

    if (finalAttack > max) {
      throw new Error(
        `propNoAttributeExplosion violation: attack=${finalAttack} > max=${max} iter=${i}`
      );
    }
  }
}

// ==================== 属性测试 4: ATTRIBUTE_BOUNDS 自身合法（meta-property）==================
// 不变量：每个 bounds 都满足 min <= max
export function propBoundsAreSelfConsistent(): void {
  for (const [key, b] of Object.entries(ATTRIBUTE_BOUNDS)) {
    if (b.min > b.max) {
      throw new Error(`propBounds violation: ${key} min=${b.min} > max=${b.max}`);
    }
    if (!Number.isFinite(b.min) || !Number.isFinite(b.max)) {
      throw new Error(`propBounds violation: ${key} contains non-finite value`);
    }
  }
}

// ==================== 禁用 / 待启用的属性测试 ====================
// TODO: 等 engine.ts 真正 export computeEffectiveAttack(items, realm) 后，启用：
//
//   propAttackNeverExceedsRealmCap(iterations)
//     ∀ realm, items: effectiveAttack(items, realm) <= cap(realm)
//     防止数值膨胀（P0 安全约束）
//
// TODO: 等 engine.ts 真正 export computeRealmCap(realm) 后，启用：
//
//   propRealmCapMonotonic(iterations)
//     ∀ realm1 < realm2: cap(realm1) < cap(realm2)  // 境界越高 cap 越大
//
// 当前 PoC 阶段只能用 ATTRIBUTE_BOUNDS / applyChanges 这种已 export 的入口。
// 不要在属性测试里编造函数名 — 用真实存在的钩子。

// ==================== Test Runner ====================
interface TestCase {
  name: string;
  fn: () => void;
}

export interface PropertyTestResult {
  passed: number;
  failed: number;
  total: number;
  violations: string[];
}

export function runPropertyTests(): PropertyTestResult {
  const tests: TestCase[] = [
    { name: 'prop-attribute-bounds-respected', fn: propAttributeBoundsRespected },
    { name: 'prop-apply-changes-idempotent', fn: propApplyChangesIdempotent },
    { name: 'prop-no-attribute-explosion', fn: propNoAttributeExplosion },
    { name: 'prop-bounds-self-consistent', fn: propBoundsAreSelfConsistent },
  ];

  let passed = 0;
  let failed = 0;
  const violations: string[] = [];

  console.log('\n[Property Tests] running...');
  for (const t of tests) {
    try {
      t.fn();
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (e: any) {
      failed++;
      violations.push(`${t.name}: ${e?.message || String(e)}`);
      console.error(`  ✗ ${t.name}: ${e?.message || String(e)}`);
    }
  }

  return { passed, failed, total: tests.length, violations };
}

// ==================== Entry Point ====================
if (import.meta.main) {
  const result = runPropertyTests();
  console.log(
    `\n=== Property Tests: ${result.passed}/${result.total} pass / ${result.failed} fail ===`
  );
  if (result.failed > 0) {
    process.exit(1);
  }
}