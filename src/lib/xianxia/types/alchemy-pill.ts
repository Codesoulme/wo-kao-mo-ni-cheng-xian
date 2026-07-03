import type { StatusEntry } from './status';
import type { ItemEntry } from './item';
import type { AttributeChange } from './event';




// ==================== Task 23: 灵宠系统 ====================



// AI-62: 炼丹火候等级（5 级：微/弱/中/强/极）—— 不动已有 enum，仅新增

export type AlchemyHeatLevel = 'micro' | 'weak' | 'moderate' | 'strong' | 'extreme';






// ==================== AI-86: Pill Side Effect System ====================

// Worker B (xiaoxin-B) - additive only, do not modify existing enums/interfaces above.



// 丹药副作用分类（仅指玩家服用丹药后可能产生的负面效果）

export type PillSideEffect =

  | 'toxicity'              // 丹毒累积，损耗根骨/寿元

  | 'cultivation-deviation' // 走火入魔，损伤经脉/修为

  | 'karma'                 // 因果牵缠，招来敌意或天道注视

  | 'qi-turbulence';        // 气机紊乱，下一段时间修炼效率下降




// 丹药服用效果评估（结合丹药品质 + 角色当前状态）

export interface PillEffectiveness {

  pillId: string;

  pillName: string;

  // 增益效果：服用后实际生效的修炼/属性加成

  boost: {

    cultivationExp?: number;       // 修为加成

    hp?: number;                   // 生命回复

    mp?: number;                   // 灵力回复

    attack?: number;               // 临时攻击

    defense?: number;              // 临时防御

    durationTurns?: number;        // 增益持续回合数（战斗/修炼）

  };

  // 副作用概率 0..1

  sideEffectChance: number;

  // 副作用严重程度 1..5（1=轻微，5=危及修行）

  sideEffectSeverity: number;

  // 可能触发的副作用类型列表（按概率排序）

  possibleSideEffects: PillSideEffect[];

}




// 服用丹药后的状态变更摘要（用于审计与 UI 展示）

export interface PillSideEffectResolution {

  pillId: string;

  triggered: boolean;             // 本次是否触发副作用

  sideEffect?: PillSideEffect;    // 触发的具体副作用

  severity: number;               // 1..5

  attributeChanges: AttributeChange[]; // 由副作用导致的属性变化

  statusChanges: StatusEntry[];   // 附带的状态变更（如"丹毒淤积"）

  narrativeHint?: string;         // 给 AI 渲染的剧情提示

}




// ===== AI-96: Pill Recipe Unlock =====

export type PillRecipeUnlockCondition =

  | 'manual'

  | 'discover'

  | 'inherit'

  | 'buy';




export interface PillRecipe {

  id: string;

  name: string;

  description: string;

  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

  unlockCondition: PillRecipeUnlockCondition;

  requiredMaterials: string[];

  minRealmIdx: number;

  requiredCauldronTier?: number;

  mainElement: 'fire' | 'water' | 'wood' | 'metal' | 'earth' | 'none';

}




export interface PillCraftResult {

  success: boolean;

  pill?: ItemEntry;

  sideEffect?: StatusEntry;

  narrativeHint?: string;

}
