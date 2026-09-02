/**
 * 引擎行为：年龄驱动的身体成长
 *
 * 凡人/低境界角色从幼年到壮年，attack/defense/speed/maxHp 应随年龄自然增长
 * 修仙后由功法/境界倍率再放大
 *
 * 这是纯引擎行为：不依赖 AI 输出、不依赖 narrative 关键词
 * 在 executeAIEvent 流程最早期调用，确保属性随年龄长
 *
 * 第二阶段：叙事身体修正
 * - 叙事写"久病/缠绵病榻" → body 压到 baseline 30%
 * - 叙事写"病弱/旧疾" → body 压到 baseline 50%
 * - 叙事写"病愈/初愈" → body 恢复 baseline
 * - 修仙后属性保留：current > 修正后 baseline 时保留 current
 *
 * 第三阶段：族裔/出身差异（乘法叠加）
 * - 族裔影响"壮年峰值"（人族 1.0x / 妖族 1.4x / 灵族 1.3x 等）
 * - 出身影响"早期抢跑"（凡人平均 / 仙门嫡传早期抢跑 / 王族遗血后期加成 等）
 * - 婴儿 baseline 也压到 ~5% 起，保证真的"从小长大"
 *
 * 第四阶段：修真世界观的衰老曲线
 * - 0-40 岁生长期所有境界一致：25 岁金丹和 25 岁凡人身体都是成年态
 * - 40+ 岁衰退段按境界寿元拉伸：凡人 40→100 岁快速衰，金丹 40→500 岁缓慢衰
 * - 金丹 100 岁只等于凡人 45 岁、元婴 300 岁只等于凡人 46 岁
 * - 只在本境寿元将尽时才耄耋（60 岁凡人 / 250 岁金丹 / 500 岁元婴）
 */
import type { CharacterState } from './types';
import { detectBodyModifier } from './narrative-body-modifier';
import { baseLifespanFor } from './npc-growth';
import { canonicalRealm, type CanonicalRealm } from './types/realm';

// 各境界的"凡人成年体"基线（attack/defense/speed/maxHp）
// 凡人=1x，炼气=1.5x，筑基=2x，金丹=3x，元婴=4x...
//
// 2026-08-31：原表键写的是 soul_transformation / immortal 两个玩法不产出的别名，
// 化神(spirit_severing)、大乘(great_vehicle)、飞升(ascension) 三个真键反而缺席，
// 取值处的 ?? 1.0 让这三档拿了凡人倍率——元婴 21/208 一步跌到 5/52，
// 突破一次反而变弱，渡劫又跳回 34/341。改用权威九键并按境界单调递增。
const REALM_BODY_MULTIPLIER: Record<CanonicalRealm, number> = {
  mortal: 1.0,
  qi_refining: 1.5,
  foundation: 2.2,
  golden_core: 3.0,
  nascent_soul: 4.0,
  spirit_severing: 5.0,
  great_vehicle: 6.5,
  tribulation: 8.0,
  ascension: 10.0,
};


// 凡人成年 baseline（25 岁壮年）— attack 5、defense 5、speed 5、maxHp 50
const MORTAL_PEAK = {
  attack: 5,
  defense: 5,
  speed: 5,
  maxHp: 50,
};

// ==================== 族裔峰值倍率 ====================
// 影响壮年 baseline —— 天生血脉体质差异
// 人族标准 1.0x；妖族肉身强横；灵族根骨异；巫族肉身最坚；羽族速度最快；海族水行天成
export type EthnicityKey = 'human' | 'demon' | 'witch' | 'winged' | 'sea' | 'spirit';

const ETHNICITY_PEAK: Record<EthnicityKey, { attack: number; defense: number; speed: number; maxHp: number }> = {
  human:  { attack: 1.0,  defense: 1.0,  speed: 1.0,  maxHp: 1.0  },
  demon:  { attack: 1.4,  defense: 1.3,  speed: 1.2,  maxHp: 1.5  }, // 妖族肉身强横
  witch:  { attack: 1.2,  defense: 1.5,  speed: 0.9,  maxHp: 1.4  }, // 巫族肉身最坚，速度平常
  winged: { attack: 1.0,  defense: 0.9,  speed: 1.6,  maxHp: 0.95 }, // 羽族御风最捷，骨骼中空
  sea:    { attack: 1.1,  defense: 1.2,  speed: 1.1,  maxHp: 1.25 }, // 海族水下天成
  spirit: { attack: 1.15, defense: 1.15, speed: 1.15, maxHp: 1.3  }, // 灵族根骨非凡
};

// ==================== 出身早期抢跑/后期加成 ====================
// 影响"年龄→系数"曲线：用 ageOffset 让生理年龄早于/晚于实际年龄
// 正 offset = 抢跑（资源足，5 岁看起来像 8 岁）
// 负 offset = 后期加成（王族遗血觉醒晚，20 岁前普通，20 岁后加速）
// growthTailBoost = 壮年之后的额外峰值加成
export type LineageKey =
  | 'mortal' | 'fallen_cultivator' | 'sect_heir' | 'demon_heir'
  | 'sealed_child' | 'divine_reincarnation' | 'beast_hybrid'
  | 'fisherman' | 'scholar' | 'merchant' | 'hunter' | 'royal_blood';

const LINEAGE_GROWTH: Record<LineageKey, { earlyBoost: number; peakBonus: number; tailBoost: number }> = {
  // earlyBoost：0-18 岁曲线额外系数（1.0 = 无加成）
  // peakBonus：18-40 岁壮年 baseline 额外乘数
  // tailBoost：40+ 岁衰退曲线的补偿（>1.0 = 衰退更慢）
  mortal:               { earlyBoost: 1.0, peakBonus: 1.0,  tailBoost: 1.0  },
  fallen_cultivator:    { earlyBoost: 1.1, peakBonus: 1.05, tailBoost: 1.05 }, // 家学残留
  sect_heir:            { earlyBoost: 1.4, peakBonus: 1.2,  tailBoost: 1.1  }, // 资源丰厚，早熟
  demon_heir:           { earlyBoost: 1.25, peakBonus: 1.25, tailBoost: 1.15 }, // 血脉压制，觉醒早
  sealed_child:         { earlyBoost: 0.9, peakBonus: 1.15, tailBoost: 1.2  }, // 封印期弱，解封后强
  divine_reincarnation: { earlyBoost: 0.95, peakBonus: 1.3, tailBoost: 1.3  }, // 神明转世，觉醒后神威
  beast_hybrid:         { earlyBoost: 1.35, peakBonus: 1.15, tailBoost: 1.05 }, // 混血身强，早熟
  fisherman:            { earlyBoost: 1.1, peakBonus: 1.0,  tailBoost: 1.0  }, // 水行江海强
  scholar:              { earlyBoost: 0.85, peakBonus: 0.95, tailBoost: 1.05 }, // 文弱，寿命略久
  merchant:             { earlyBoost: 1.05, peakBonus: 1.0,  tailBoost: 1.0  },
  hunter:               { earlyBoost: 1.2, peakBonus: 1.05, tailBoost: 1.0  }, // 山野磨炼，早熟
  royal_blood:          { earlyBoost: 0.9, peakBonus: 1.15, tailBoost: 1.2  }, // 王族觉醒晚，后期强
};

const DEFAULT_LINEAGE_GROWTH = { earlyBoost: 1.0, peakBonus: 1.0, tailBoost: 1.0 };
const DEFAULT_ETHNICITY_PEAK = ETHNICITY_PEAK.human;

/**
 * 按年龄计算凡人身体成长系数（0~1+）
 * - 0 岁：0.05（襁褓）
 * - 5 岁：0.20（幼童）
 * - 10 岁：0.40（少年）
 * - 18 岁：0.75
 * - 25 岁：1.00（壮年 baseline）
 * - 40 岁：1.05（壮年巅峰）
 * - 60 岁：0.90（中年开始衰退）
 * - 80 岁：0.65（老年）
 * - 100 岁：0.40（耄耋）
 *
 * @param earlyBoost 出身对 0-18 岁段的额外乘数（sect_heir 1.4x → 5 岁看起来像 7 岁）
 * @param tailBoost  出身对 40+ 岁衰退的补偿（>1.0 = 衰退更慢）
 */
function rawAgeGrowthFactor(age: number, earlyBoost = 1.0, tailBoost = 1.0): number {
  let base: number;
  if (age <= 0) base = 0.05;
  else if (age <= 5) base = 0.05 + (age / 5) * 0.15; // 0.05 → 0.20
  else if (age <= 10) base = 0.20 + ((age - 5) / 5) * 0.20; // 0.20 → 0.40
  else if (age <= 18) base = 0.40 + ((age - 10) / 8) * 0.35; // 0.40 → 0.75
  else if (age <= 25) base = 0.75 + ((age - 18) / 7) * 0.25; // 0.75 → 1.00
  else if (age <= 40) base = 1.00 + ((age - 25) / 15) * 0.05; // 1.00 → 1.05
  else if (age <= 60) base = 1.05 - ((age - 40) / 20) * 0.15; // 1.05 → 0.90
  else if (age <= 80) base = 0.90 - ((age - 60) / 20) * 0.25; // 0.90 → 0.65
  else if (age <= 100) base = 0.65 - ((age - 80) / 20) * 0.25; // 0.65 → 0.40
  else base = Math.max(0.20, 0.40 - ((age - 100) / 50) * 0.20); // 100+ → 0.40 → 0.20

  // 0-18 应用早期抢跑：earlyBoost 只影响年轻曲线，避免 sect_heir 老年时又拉高
  if (age <= 18) {
    base *= earlyBoost;
    // early cap：早期抢跑后不能超过壮年峰值本身（否则 5 岁 sect_heir 反而超过壮年）
    base = Math.min(base, 1.05);
  }
  // 40+ 应用衰退补偿：tailBoost > 1 让老年更抗衰退
  if (age > 40 && tailBoost !== 1.0) {
    // 拉升衰退部分：把 base 向峰值 1.05 靠近，靠近程度 = (tailBoost-1) * 0.5
    const towardsPeak = (1.05 - base) * ((tailBoost - 1.0) * 0.5);
    base += Math.max(0, towardsPeak);
  }
  return Math.max(0.05, base);
}

/**
 * 修真世界观校准：0-40 岁生长期所有境界一致，只有 40+ 衰退期按境界寿元拉伸
 *
 * 也就是说：
 * - 25 岁金丹与 25 岁凡人身体一样成年
 * - 40 岁金丹与 40 岁凡人一样壮年巅峰
 * - 40 岁之后凡人快速衰，60 岁进入衰退
 * - 但金丹 100 岁只等于凡人 45 岁、250 岁等于凡人 67 岁、500 岁（寿元将尽）才耄耋
 *
 * 数学：把 mortal [40, 100] 衰退段映射到 realm [40, realmLifespan] 上
 *
 * @param age 实际年龄
 * @param realm 当前境界
 * 返回：折算后喂给 rawAgeGrowthFactor 的「等效凡人年龄」
 */
function realmAdjustedAge(age: number, realm: string | undefined): number {
  // 生长期不折算：40 岁前所有境界都按凡人曲线长身骨
  if (age <= 40) return age;
  const MORTAL_LIFESPAN_END = 100; // 凡人曲线的"耄耋"锚点
  if (!realm || realm === 'mortal' || realm === 'qi_refining') return age;
  const realmLifespan = baseLifespanFor(realm);
  if (realmLifespan <= MORTAL_LIFESPAN_END) return age;
  // 把 [40, realmLifespan] 拉伸映射到 [40, 100]，越靠近本境寿终越"老"
  const postPrimeRatio = (age - 40) / (realmLifespan - 40);
  return 40 + postPrimeRatio * (MORTAL_LIFESPAN_END - 40);
}

function ageGrowthFactor(age: number, earlyBoost = 1.0, tailBoost = 1.0, realm?: string): number {
  return rawAgeGrowthFactor(realmAdjustedAge(age, realm), earlyBoost, tailBoost);
}

export interface BodyGrowthResult {
  state: CharacterState;
  growth: {
    attack: number;
    defense: number;
    speed: number;
    maxHp: number;
  };
  factor: number;
  realmMultiplier: number;
  bodyModifier: {
    mode: 'healthy' | 'weak' | 'critically_ill' | 'recovered';
    multiplier: number;
    reason: string;
  };
  ethnicity: EthnicityKey;
  lineage: LineageKey | 'unknown';
}

/**
 * 从 state 读 origin，返回族裔/出身键（未知时 fallback 到 human/mortal）
 */
function resolveOrigin(state: CharacterState): { ethnicity: EthnicityKey; lineage: LineageKey | 'unknown' } {
  const origin = (state as any).origin;
  if (origin && typeof origin === 'object') {
    const eth = origin.ethnicity as EthnicityKey;
    const lin = origin.lineage as LineageKey;
    if (ETHNICITY_PEAK[eth] && LINEAGE_GROWTH[lin]) {
      return { ethnicity: eth, lineage: lin };
    }
    if (ETHNICITY_PEAK[eth]) return { ethnicity: eth, lineage: 'unknown' };
  }
  return { ethnicity: 'human', lineage: 'unknown' };
}

/**
 * 计算指定年龄的身体 baseline（不含叙事修正，供 new/route 出生初始化直接调用）
 *
 * @param age  目标年龄
 * @param realm 境界（默认 mortal）
 * @param ethnicity 族裔
 * @param lineage 出身
 */
export function computeBodyBaseline(
  age: number,
  realm: string = 'mortal',
  ethnicity: EthnicityKey = 'human',
  lineage: LineageKey | 'unknown' = 'unknown',
): { attack: number; defense: number; speed: number; maxHp: number; factor: number } {
  const ethPeak = ETHNICITY_PEAK[ethnicity] || DEFAULT_ETHNICITY_PEAK;
  const linGrowth = (lineage !== 'unknown' && LINEAGE_GROWTH[lineage]) || DEFAULT_LINEAGE_GROWTH;
  const factor = ageGrowthFactor(age, linGrowth.earlyBoost, linGrowth.tailBoost, realm);
  const realmMult = REALM_BODY_MULTIPLIER[canonicalRealm(realm)];
  const peakBonus = linGrowth.peakBonus;
  return {
    attack: Math.max(1, Math.round(MORTAL_PEAK.attack * factor * realmMult * ethPeak.attack * peakBonus)),
    defense: Math.max(1, Math.round(MORTAL_PEAK.defense * factor * realmMult * ethPeak.defense * peakBonus)),
    speed: Math.max(1, Math.round(MORTAL_PEAK.speed * factor * realmMult * ethPeak.speed * peakBonus)),
    // maxHp 保底 10（新生婴儿也不能一击死）
    maxHp: Math.max(10, Math.round(MORTAL_PEAK.maxHp * factor * realmMult * ethPeak.maxHp * peakBonus)),
    factor,
  };
}

/**
 * 应用年龄驱动的身体成长（+ 叙事修正 + 族裔/出身差异）
 *
 * @param state 当前状态
 * @param newAge 推进后的年龄
 * @param narrative 当岁 narrative（用于检测病弱/垂危等）
 *
 * 计算：
 * 1. resolve origin（族裔/出身，缺失按 human/unknown）
 * 2. ageFactor（考虑出身早期抢跑/后期加成）
 * 3. realmMultiplier（境界）
 * 4. ethnicityPeak（族裔壮年倍率）
 * 5. lineagePeakBonus（出身壮年额外加成）
 * 6. narrativeBodyMultiplier（叙事修正：1.0 / 0.5 / 0.3）
 * 7. baseline = MORTAL_PEAK * factor * realmMult * ethPeak * peakBonus * narrativeMod
 * 8. current > baseline → 保留 current（修仙成果不被抹除）
 * 9. current < baseline → 拉到 baseline（身体在成长 / 病愈）
 */
export function applyAgeBasedBodyGrowth(state: CharacterState, newAge: number, narrative?: string): BodyGrowthResult {
  const { ethnicity, lineage } = resolveOrigin(state);
  const ethPeak = ETHNICITY_PEAK[ethnicity];
  const linGrowth = (lineage !== 'unknown' && LINEAGE_GROWTH[lineage]) || DEFAULT_LINEAGE_GROWTH;

  const factor = ageGrowthFactor(newAge, linGrowth.earlyBoost, linGrowth.tailBoost, state.realm);
  const realmMult = REALM_BODY_MULTIPLIER[canonicalRealm(state.realm)];
  const bodyMod = detectBodyModifier(narrative || '');
  const effectiveMult = realmMult * bodyMod.multiplier;
  const peakBonus = linGrowth.peakBonus;
  // 浮点 baseline —— 婴幼段 factor 变化 <1 时也能记账
  const rawAttack = MORTAL_PEAK.attack * factor * effectiveMult * ethPeak.attack * peakBonus;
  const rawDefense = MORTAL_PEAK.defense * factor * effectiveMult * ethPeak.defense * peakBonus;
  const rawSpeed = MORTAL_PEAK.speed * factor * effectiveMult * ethPeak.speed * peakBonus;
  const rawMaxHp = MORTAL_PEAK.maxHp * factor * effectiveMult * ethPeak.maxHp * peakBonus;
  // 保底：atk/def/spd >=1，maxHp >=10
  const baselineAttackF = Math.max(1, rawAttack);
  const baselineDefenseF = Math.max(1, rawDefense);
  const baselineSpeedF = Math.max(1, rawSpeed);
  const baselineMaxHpF = Math.max(10, rawMaxHp);

  // 浮点残余记账：state 上存整数，浮点 baseline 与整数的差值累计到 residual
  // 例：baseline(6岁)=1.2，state.attack=1，residual=0.2；
  //     baseline(7岁)=1.4，累计 target = 1.4 + 0.2 = 1.6，floor → 1，residual=0.6；
  //     baseline(8岁)=1.6，累计 target = 1.6 + 0.6 = 2.2，floor → 2（出 +1 chip！），residual=0.2
  // 这样成长期每 2~3 年至少能出一次 +1，成长曲线不再断线
  const prev = state.bodyGrowthResidual;
  const residualBefore = {
    attack: Number(prev?.attack) || 0,
    defense: Number(prev?.defense) || 0,
    speed: Number(prev?.speed) || 0,
    maxHp: Number(prev?.maxHp) || 0,
  };
  const targetAttackF = baselineAttackF + residualBefore.attack;
  const targetDefenseF = baselineDefenseF + residualBefore.defense;
  const targetSpeedF = baselineSpeedF + residualBefore.speed;
  const targetMaxHpF = baselineMaxHpF + residualBefore.maxHp;

  // 修仙者属性保留：若 current > 浮点 target，取 current（修仙巅峰不被凡人曲线压低）
  const growAttack = Math.floor(targetAttackF);
  const growDefense = Math.floor(targetDefenseF);
  const growSpeed = Math.floor(targetSpeedF);
  const growMaxHp = Math.floor(targetMaxHpF);
  const newAttack = Math.max(state.attack, growAttack);
  const newDefense = Math.max(state.defense, growDefense);
  const newSpeed = Math.max(state.speed, growSpeed);
  const newMaxHp = Math.max(state.maxHp, growMaxHp);

  // 新 residual：小数部分累计；若修仙者 current 远高于凡人曲线，residual 清零避免无意义累加
  const isFarAboveBaseline = (current: number, baselineF: number) => current > baselineF * 2;
  const nextResidual = {
    attack: isFarAboveBaseline(newAttack, baselineAttackF) ? 0 : targetAttackF - growAttack,
    defense: isFarAboveBaseline(newDefense, baselineDefenseF) ? 0 : targetDefenseF - growDefense,
    speed: isFarAboveBaseline(newSpeed, baselineSpeedF) ? 0 : targetSpeedF - growSpeed,
    maxHp: isFarAboveBaseline(newMaxHp, baselineMaxHpF) ? 0 : targetMaxHpF - growMaxHp,
  };

  return {
    state: {
      ...state,
      attack: newAttack,
      defense: newDefense,
      speed: newSpeed,
      maxHp: newMaxHp,
      bodyGrowthResidual: nextResidual,
    },
    growth: {
      attack: newAttack - state.attack,
      defense: newDefense - state.defense,
      speed: newSpeed - state.speed,
      maxHp: newMaxHp - state.maxHp,
    },
    factor,
    realmMultiplier: realmMult,
    bodyModifier: {
      mode: bodyMod.mode,
      multiplier: bodyMod.multiplier,
      reason: bodyMod.reason,
    },
    ethnicity,
    lineage,
  };
}
