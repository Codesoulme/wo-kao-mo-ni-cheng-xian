/**
 * 引擎行为：年龄驱动的身体成长
 *
 * 凡人/低境界角色从幼年到壮年，attack/defense/speed/maxHp 应随年龄自然增长
 * 修真后由功法/境界倍率再放大
 *
 * 这是纯引擎行为：不依赖 AI 输出、不依赖 narrative 关键词
 * 在 executeAIEvent 流程最早期调用一次，确保属性随年龄长
 */
import type { CharacterState } from './types';

// 各境界的"凡人成年体"基线（attack/defense/speed/maxHp）
// 凡人=1x，炼气=1.5x，筑基=2x，金丹=3x，元婴=4x...
const REALM_BODY_MULTIPLIER: Record<string, number> = {
  mortal: 1.0,
  qi_refining: 1.5,
  foundation: 2.2,
  golden_core: 3.0,
  nascent_soul: 4.0,
  soul_transformation: 5.0,
  tribulation: 6.5,
  immortal: 8.0,
};

// 凡人成年 baseline（25 岁壮年）— attack 5、defense 5、speed 5、maxHp 50
const MORTAL_PEAK = {
  attack: 5,
  defense: 5,
  speed: 5,
  maxHp: 50,
};

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
 */
function ageGrowthFactor(age: number): number {
  if (age <= 0) return 0.05;
  if (age <= 5) return 0.05 + (age / 5) * 0.15; // 0.05 → 0.20
  if (age <= 10) return 0.20 + ((age - 5) / 5) * 0.20; // 0.20 → 0.40
  if (age <= 18) return 0.40 + ((age - 10) / 8) * 0.35; // 0.40 → 0.75
  if (age <= 25) return 0.75 + ((age - 18) / 7) * 0.25; // 0.75 → 1.00
  if (age <= 40) return 1.00 + ((age - 25) / 15) * 0.05; // 1.00 → 1.05
  if (age <= 60) return 1.05 - ((age - 40) / 20) * 0.15; // 1.05 → 0.90
  if (age <= 80) return 0.90 - ((age - 60) / 20) * 0.25; // 0.90 → 0.65
  if (age <= 100) return 0.65 - ((age - 80) / 20) * 0.25; // 0.65 → 0.40
  return Math.max(0.20, 0.40 - ((age - 100) / 50) * 0.20); // 100+ → 0.40 → 0.20
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
}

/**
 * 应用年龄驱动的身体成长
 * - 计算新 baseline = MORTAL_PEAK * ageFactor * realmMultiplier
 * - 如果当前属性 < 新 baseline，提升到新 baseline（身体在成长）
 * - 如果当前属性 > 新 baseline（如修真后属性远超凡人），不降低（修真成果不被衰老抹除）
 * - 修真后 attack 30、defense 30 → 80 岁后不再涨到 baseline，但也不会"老到掉回 5"
 *
 * 这意味着：修真者继续成长修真属性，body 永远是其修真巅峰的下限
 */
export function applyAgeBasedBodyGrowth(state: CharacterState, newAge: number): BodyGrowthResult {
  const factor = ageGrowthFactor(newAge);
  const realmMult = REALM_BODY_MULTIPLIER[state.realm] ?? 1.0;
  const baselineAttack = Math.round(MORTAL_PEAK.attack * factor * realmMult);
  const baselineDefense = Math.round(MORTAL_PEAK.defense * factor * realmMult);
  const baselineSpeed = Math.round(MORTAL_PEAK.speed * factor * realmMult);
  const baselineMaxHp = Math.round(MORTAL_PEAK.maxHp * factor * realmMult);

  // 修真后属性保留：若当前 attack > baselineAttack，取当前值
  const newAttack = Math.max(state.attack, baselineAttack);
  const newDefense = Math.max(state.defense, baselineDefense);
  const newSpeed = Math.max(state.speed, baselineSpeed);
  const newMaxHp = Math.max(state.maxHp, baselineMaxHp);

  return {
    state: {
      ...state,
      attack: newAttack,
      defense: newDefense,
      speed: newSpeed,
      maxHp: newMaxHp,
    },
    growth: {
      attack: newAttack - state.attack,
      defense: newDefense - state.defense,
      speed: newSpeed - state.speed,
      maxHp: newMaxHp - state.maxHp,
    },
    factor,
    realmMultiplier: realmMult,
  };
}
