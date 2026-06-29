// 修真界感改进 - 任务 B：境界碾压
// 文件目的：计算 attacker vs defender 境界差的胜率/碾压系数
// 注意：与 engine.ts 现有的 realmPowerMultiplier(state) 重载同名——后者取的是"自身 realmProfile.powerMultiplier"，
//       本函数是双角色（attacker / defender）境界差距判定。为避免冲突，导出独立的命名空间 API。

import type { CharacterState } from './types';
import { REALMS } from './types';

/** 简化的境界差系数表（任务 B 需求）：
 *  diff <= 0   → 1.0  （同阶或防守方更高 → 攻击方无加成）
 *  diff == 1   → 1.5  （攻击方高 1 阶）
 *  diff == 2   → 2.5  （高 2 阶——任务要求"境界碾压"分界线）
 *  diff == 3   → 4.0
 *  diff == 4   → 6.0
 *  diff >= 5   → 10.0 （高 5 阶及以上 = 不可战胜）
 */
function diffToMultiplier(diff: number): number {
  if (diff <= 0) return 1.0;
  if (diff === 1) return 1.5;
  if (diff === 2) return 2.5;
  if (diff === 3) return 4.0;
  if (diff === 4) return 6.0;
  return 10.0;
}

/** 在 REALMS 表中找境界的索引；找不到则视作凡人 (idx=0)。REALMS 是 types.ts 的单一权威境界序列。 */
function realmIndexSafe(realm: string | undefined | null): number {
  if (!realm) return 0;
  const idx = REALMS.findIndex(r => r.id === realm);
  return idx < 0 ? 0 : idx;
}

/** 攻击方-防守方境界差值（attacker 高返回正值）。REALMS 同序：mortal=0 → ascension=N。 */
export function realmDiff(attacker: string | undefined | null, defender: string | undefined | null): number {
  return realmIndexSafe(attacker) - realmIndexSafe(defender);
}

/** 给定差值返回碾压系数 multiplier（diff = attacker - defender，attacker 高）。 */
export function realmPowerMultiplierFromDiff(diff: number): number {
  return diffToMultiplier(diff);
}

/** 给定 attacker 境界与 defender 境界直接求 multiplier。 */
export function realmPowerBetween(attacker: string | undefined | null, defender: string | undefined | null): number {
  return diffToMultiplier(realmDiff(attacker, defender));
}

/**
 * 战斗判定（任务 B 需求）：
 *  - diff >= 2 ：attacker 100% 胜，defender 必逃
 *  - diff == 1 ：attacker 75% 胜
 *  - diff == 0 ：attacker 55% 胜（不绝对碾压，仍有对抗空间）
 *  - diff <  0 ：defender 75% 胜
 * 返回：{ attackerWinChance, defenderForcedFlee, reason }
 */
export interface CombatVerdict {
  attackerWinChance: number;       // 攻击方胜率 (0~1)
  defenderForcedFlee: boolean;     // 攻击方必胜时，防守方是否必逃
  reason: string;                  // 命中分类（同阶/小胜/碾压/不可战胜）
}

export function combatVerdict(
  attackerRealm: string | undefined | null,
  defenderRealm: string | undefined | null,
): CombatVerdict {
  const diff = realmDiff(attackerRealm, defenderRealm);
  if (diff >= 2) {
    return { attackerWinChance: 1.0, defenderForcedFlee: true, reason: '境界碾压（不可战胜）' };
  }
  if (diff === 1) {
    return { attackerWinChance: 0.75, defenderForcedFlee: false, reason: '高出一阶' };
  }
  if (diff === 0) {
    return { attackerWinChance: 0.55, defenderForcedFlee: false, reason: '同阶对垒' };
  }
  return { attackerWinChance: 0.25, defenderForcedFlee: false, reason: '守方境界更高' };
}

/** Convenience: 从 CharacterState / Realm 字符串中提取任一字段为 realm id。 */
export function realmIdOf(value: CharacterState | string | undefined | null): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  // CharacterState: 取 realm 字段
  return (value as CharacterState).realm || undefined;
}
