


// ==================== Task 23: 符箓系统 ====================



// 符箓子类型——单次使用、即时生效的战斗道具

// 复用 item_type='consumable'，通过 effects 中的 target_attribute 区分

export type TalismanType =

  | 'talisman_attack'    // 攻击符：直接对敌人造成伤害

  | 'talisman_defense'   // 防御符：本回合减伤

  | 'talisman_heal'      // 治疗符：回复 HP

  | 'talisman_escape'    // 遁逃符：高概率逃跑

  | 'talisman_stun';     // 镇压符：让敌人本回合无法行动




export const TALISMAN_TYPE_LABEL: Record<TalismanType, string> = {

  talisman_attack: '攻符',

  talisman_defense: '防符',

  talisman_heal: '疗符',

  talisman_escape: '遁符',

  talisman_stun: '镇符',

};
