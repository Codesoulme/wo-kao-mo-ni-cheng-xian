import type { Realm } from './realm';
import type { Element } from './spiritual-root';




// ==================== 状态词条 ====================



export type StatusCategory =

  | 'attribute' | 'skill' | 'buff' | 'debuff'

  | 'special' | 'constitution' | 'identity' | 'quest' | 'environment';




export type ConstitutionCategory = 'element' | 'combat' | 'social' | 'fate' | 'body' | 'dao';


export type ConstitutionRiskType = 'none' | 'heart_demon' | 'backlash' | 'attention' | 'conflict';




export interface ConstitutionAwakeningStage {

  stage: number;

  name: string;

  minRealm?: Realm;

  minAge?: number;

  triggerHint: string;

  description: string;

  effects?: StatusEffect[];

}




export interface ConstitutionProfile {

  id: string;

  category: ConstitutionCategory;

  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

  elementAffinity?: Element[];

  techniqueKeywords?: string[];

  resonanceTags?: string[];

  currentStage: number;

  maxStage: number;

  awakening?: ConstitutionAwakeningStage[];

  riskType?: ConstitutionRiskType;

  riskHint?: string;

  narrativeHooks?: string[];

}




export interface StatusEntry {

  id: string;

  name: string;

  description: string;

  category: StatusCategory;

  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

  duration: number;  // -1 = 永久, >0 = 剩余年龄数

  source: string;    // 来源描述

  effects: StatusEffect[];

  constitution?: ConstitutionProfile;

}




export type EffectOperation = 'add' | 'multiply' | 'override' | 'cap' | 'floor' | 'trigger';




export interface StatusEffect {

  target_attribute: string;

  operation: EffectOperation;

  value: number;

  description: string;

}




// ===== AI-93: Status Expiry =====

export type StatusExpireRule =

  | 'turns'

  | 'years'

  | 'condition'

  | 'event';




export interface StatusExpiryMeta {

  rule: StatusExpireRule;

  remaining?: number;

  trigger?: string;

}
