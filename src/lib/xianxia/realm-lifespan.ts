// 修仙界感改进 - 任务 D：寿元压力
// 文件目的：提供"按境界 + 境界层数"算寿元的函数，供 prompt/advance 边界检查复用。
// 设计：以 types.ts 的 REALMS 表为单一权威（baseLifespan + expPerLevel/levels）。
//        同时提供一份详细 per-level 配置（REALM_LIFESPAN_TABLE）以兼容任务模板里的"perLevel"概念；
//        凡人/渡劫/飞升的 perLevel 不递增（飞升已与天地同寿，无需增加）。

import type { Realm } from './types';
import { REALMS } from './types';

export interface RealmLifespanConfig {
  base: number;        // 基础寿元（进入该境界时的寿元）
  perLevel: number;    // 每升一层的额外寿元（0 表示境界内不增寿）
}

/** 与任务模板对齐的"per-realm"寿元配置表。境界序列与 REALMS 同序。 */
export const REALM_LIFESPAN_TABLE: Record<string, RealmLifespanConfig> = {
  mortal:               { base: 80,   perLevel: 0    },  // 凡人 80 岁（任务模板保留旧值，不改写 0 岁 maxHp 100）
  qi_refining:          { base: 120,  perLevel: 10   },  // 炼气 120-200
  foundation:           { base: 200,  perLevel: 30   },  // 筑基 200+
  golden_core:          { base: 500,  perLevel: 50   },  // 金丹 500+
  nascent_soul:         { base: 1000, perLevel: 100  },  // 元婴 1000+
  spirit_severing:      { base: 2000, perLevel: 200  },  // 化神 2000+
  great_vehicle:        { base: 5000, perLevel: 1000 },  // 大乘
  tribulation:          { base: 10000, perLevel: 0   },  // 渡劫（perLevel=0，因 1 层）
  ascension:            { base: 99999, perLevel: 0   },  // 飞升
  // 别名（旧名）：
  foundation_building:  { base: 200,  perLevel: 30   },
  soul_formation:       { base: 500,  perLevel: 50   },
  mahayana:             { base: 5000, perLevel: 1000 },
  deity_transformation: { base: 2000, perLevel: 200  },
  void_refinement:      { base: 3000, perLevel: 500  },
  unity:                { base: 5000, perLevel: 1000 },
};

/** 由"境界 id + 境界层(0-based)"算寿元。优先级：REALM_LIFESPAN_TABLE 显式配置 → REALMS 表 baseLifespan。 */
export function getLifespanByRealm(realm: string | undefined | null, level: number = 0): number {
  const id = realm || 'mortal';
  const cfg = REALM_LIFESPAN_TABLE[id];
  if (cfg) {
    return Math.max(1, cfg.base + Math.max(0, level) * cfg.perLevel);
  }
  // fallback：REALMS 表的 baseLifespan
  const r = REALMS.find(r => r.id === id);
  if (r) return Math.max(1, r.baseLifespan);
  return 80; // ultimate fallback 凡人
}

/**
 * 寿元压力信号。
 *  - 'safe'      : age < lifespan - 30
 *  - 'aging'     : age 接近 lifespan (剩余 30 年内)
 *  - 'near_end'  : age >= lifespan - 20（距寿终 ≤20 年，强信号）
 *  - 'critical'  : age >= lifespan - 5（濒死）
 *  - 'expired'   : age >= lifespan（应触发寿终正寝）
 */
export type LifespanPressure = 'safe' | 'aging' | 'near_end' | 'critical' | 'expired';

export function lifespanPressure(age: number | undefined | null, lifespan: number | undefined | null): LifespanPressure {
  const a = typeof age === 'number' ? age : 0;
  const l = typeof lifespan === 'number' && lifespan > 0 ? lifespan : 80;
  if (a >= l) return 'expired';
  if (a >= l - 5) return 'critical';
  if (a >= l - 20) return 'near_end';
  if (a >= l - 30) return 'aging';
  return 'safe';
}

/** 压缩成"寿元将尽"提示文案（供 advance emit done 时使用）。 */
export function lifespanPressureStatus(age: number | undefined | null, lifespan: number | undefined | null): string | null {
  const p = lifespanPressure(age, lifespan);
  if (p === 'safe' || p === 'aging') return null;
  if (p === 'expired') return '寿元已尽';
  if (p === 'critical') return '寿元将尽（大限迫近）';
  return '寿元将尽';
}

/** 强信号判定：age 接近 lifespan（剩余 ≤20 年）。用于 prompt 引导"必须写衰老/病弱/不祥预兆"。 */
export function nearLifespan(age: number | undefined | null, lifespan: number | undefined | null): boolean {
  const p = lifespanPressure(age, lifespan);
  return p === 'near_end' || p === 'critical' || p === 'expired';
}

// ==================== 沉浸版 Phase-Life: 动态寿命 ====================
// 之前 character.lifespan = 80 写死后终身不变，NPC 不到 80 岁就暴毙、玩家延寿丹药没用、修真者不因突破延寿。
// 现按 state 动态评估：
//   base      = REALM_LIFESPAN_TABLE[realm].base + level * perLevel
//   mul       = 灵根倍率 (rootMultiplier, 0.3 凡人杂灵根 ... 2.0+ 天灵根)
//   bodyMul   = 1 + (体魄 / 200) (体魄破百 +50%, 破三百 +150%)
//   realmBoost= 修真后 (realmIdx - 1) × 80 加成（修真境界越高寿元越长）
//   lineage   = 仙门嫡传 / 神明转世 / 王族遗血 加成（血脉潜力）
//   items     = 物品/丹药/法旨累计 lifespanDelta
//   heritage  = 传承池中前代留下的"延命丹"等加到 lifespan（开局时由 advance-preload 解析）
// 修真者 current > base 仍 max() 取 current，避免被压回。
// 凡人默认 80；单灵根 + 仙门嫡传可达 100+；金丹修士可达 600+。

import type { CharacterState } from './types';

export interface DeriveLifespanInput {
  realm?: string | null;
  realmLevel?: number;
  rootMultiplier?: number;
  physicalFoundation?: number;
  // 软加成：开局时已知（族裔/出身/传承池）
  lineageBoost?: number;     // 0..1（如仙门嫡传 0.15、神明转世 0.30、王族遗血 0.20）
  ethnicityBoost?: number;   // 0..0.2（妖族 0.15 / 灵族 0.10 / 羽族 0.05）
  heritageBonus?: number;    // 传承池累计（如有"延命丹"再加 30）
  itemsDelta?: number;       // 物品累计 lifespanDelta（runtime 累计）
}

/**
 * 计算最终寿命：基础 + 灵根 / 身体 / 血脉加成 + 传承 / 物品加成。
 * 修真者 current 已 > base 时仍 max() 取 current。
 */
export function deriveLifespan(input: DeriveLifespanInput): number {
  const realm = String(input.realm || 'mortal');
  const realmLevel = Math.max(0, Math.floor(input.realmLevel || 0));
  const cfg = REALM_LIFESPAN_TABLE[realm];
  const base = cfg ? cfg.base + realmLevel * cfg.perLevel : 80;
  // 灵根倍率：凡人 rootMultiplier 默认 0.3（杂灵根），单灵根 1.0，天灵根 2.0+
  const mul = Math.max(0.3, Number(input.rootMultiplier ?? 0.3));
  // 体魄加成：体魄每 100 点加 50% 寿命，体魄 200 → 100%（×2），300 → 150%（×2.5）
  // 这样凡人 12 岁体魄破百，单灵根 → 80 × 1 × 2 × 1.0 = 160
  const pf = Math.max(0, Number(input.physicalFoundation || 0));
  const bodyMul = 1 + (pf / 100) * 0.5;
  // 血脉加成（族裔 + 出身）
  const lineageMul = 1 + Math.max(0, Number(input.lineageBoost || 0)) + Math.max(0, Number(input.ethnicityBoost || 0));
  // 传承池 / 物品累计
  const bonus = Math.max(0, Number(input.heritageBonus || 0)) + Math.max(0, Number(input.itemsDelta || 0));
  // 综合：base × 灵根 × 体魄 × 血脉 + 传承
  const computed = Math.round(base * mul * bodyMul * lineageMul + bonus);
  return Math.max(1, computed);
}

/**
 * 从 character state 评估最终寿命（含族裔 / 出身 / 灵根 / 体魄 / 传承 / 物品）。
 * - 修真者 current > base 时仍 max() 取 current，避免被压回
 * - 凡人 default 80；修真按 baseByRealm + 灵根 + 体魄 + 血脉加成
 */
export function deriveLifespanFromState(state: Partial<CharacterState> | any, opts?: {
  lineageBoost?: number;
  ethnicityBoost?: number;
  heritageBonus?: number;
  itemsDelta?: number;
}): number {
  if (!state || typeof state !== 'object') return 80;
  // 修真者保留 current 上限（已被境界 / 传承大幅提高时不让公式压回）
  const base = getLifespanByRealm(state.realm, Number(state.realmLevel || 0));
  const realm = String(state.realm || 'mortal');

  // 沉浸版 Phase-Release: 凡人不走灵根 × 体魄 × 血脉的复合公式——凡人的 80 是硬顶，
  // 只有明确的血脉软加成 / 传承池延命丹 / 事件级延寿（服延寿丹/仙人赐寿）才可突破。
  // 之前的问题：凡人 rootMultiplier=1.0 + 体魄从 5 涨到 200 让 bodyMul 从 1 涨到 2，导致寿命从 80 一路涨到 160-240。
  if (realm === 'mortal') {
    const softBoost = 1
      + Math.max(0, Number(opts?.lineageBoost || 0))
      + Math.max(0, Number(opts?.ethnicityBoost || 0));
    const bonus = Math.max(0, Number(opts?.heritageBonus || 0))
      + Math.max(0, Number(opts?.itemsDelta || 0));
    const mortalComputed = Math.round(80 * softBoost + bonus);
    const current = Number(state.lifespan || 0);
    // 凡人：computed 与 current 取大——事件延寿累计已写入 current，不让重算把它压回去
    return Math.max(current > 0 ? current : mortalComputed, mortalComputed);
  }

  const computed = deriveLifespan({
    realm: state.realm,
    realmLevel: state.realmLevel,
    rootMultiplier: state.rootMultiplier,
    physicalFoundation: state.physicalFoundation ?? state.derivedCoreCultivationAttributes?.physicalFoundation,
    lineageBoost: opts?.lineageBoost,
    ethnicityBoost: opts?.ethnicityBoost,
    heritageBonus: opts?.heritageBonus,
    itemsDelta: opts?.itemsDelta,
  });
  // 修真者：取 max(current 上限, computed)。
  const current = Number(state.lifespan || 0);
  return Math.max(current > 0 ? current : base, computed);
}

/**
 * 死亡过渡钩子：检测 narrative 中是否提及延寿 / 续命 / 服用丹药等。
 * 命中则按规则延长 lifespan（基础 +30 / +50 / +100 等）。
 * 仅作为引擎侧兜底；LLM 自然写 narrative + 延寿物品亦可走 itemsDelta 路径。
 */
export interface LifespanExtensionMatch {
  extended: number;        // 延长年数
  reason: string;          // 触发句
  hint: 'minor' | 'major' | 'major-pill' | 'immortal-favor';
}

const EXTENSION_PATTERNS: { re: RegExp; delta: number; hint: LifespanExtensionMatch['hint']; label: string }[] = [
  { re: /(延年益寿|延寿|续命|回春)/,                                 delta: 20,  hint: 'minor',        label: '延寿类' },
  { re: /(服下|服用|炼化|吞下|吃下)([^，。\s]{0,8})(延寿|续命|回春|九转|长生|不老|延年)/, delta: 40, hint: 'major',  label: '服用延寿丹' },
  { re: /(九转金丹|长生丹|延命金丹|不死药|不老泉)/,                   delta: 50,  hint: 'major-pill',   label: '高级延寿丹' },
  { re: /(仙人赐|仙人救|仙人相助|神明垂怜|天道眷顾|续命法旨|加寿)/, delta: 100, hint: 'immortal-favor', label: '仙人/天道恩赐' },
];

export function detectLifespanExtension(narrative: string): LifespanExtensionMatch | null {
  if (!narrative || typeof narrative !== 'string') return null;
  // 从最强到最弱匹配，避免弱规则吃掉强规则
  const sorted = [...EXTENSION_PATTERNS].sort((a, b) => b.delta - a.delta);
  for (const p of sorted) {
    if (p.re.test(narrative)) {
      return { extended: p.delta, reason: p.label, hint: p.hint };
    }
  }
  return null;
}

/**
 * 寿命状态机：基于 age / lifespan / nearDeath / 死亡过渡年份，给 advance 引擎用。
 * - 'alive'         : 正常
 * - 'near-death'    : 已到大限（age >= lifespan），留出"最后一年"让 narrative 收尾或延寿
 * - 'transition'    : 已 near-death 一次但没死/没延寿，第二年再判
 * - 'dead'          : 已坐化
 */
export type LifePhase = 'alive' | 'near-death' | 'transition' | 'dead';

export function getLifePhase(state: any): LifePhase {
  if (!state || !state.alive) return 'dead';
  if (state.nearDeath && state.nearDeathYear !== undefined && state.age > state.nearDeathYear) {
    return 'transition';
  }
  if (state.nearDeath && state.nearDeathYear !== undefined) {
    return 'near-death';
  }
  if (typeof state.age === 'number' && typeof state.lifespan === 'number' && state.age >= state.lifespan) {
    return 'near-death';
  }
  return 'alive';
}
