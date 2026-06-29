// 修真界感改进 - 任务 D：寿元压力
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
