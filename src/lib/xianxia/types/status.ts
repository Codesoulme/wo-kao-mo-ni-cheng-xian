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




// ===== 心魔投影（引擎裁决 / UI 只读） =====

// 引擎按 heartDemon 数值统一裁决分级、修炼惩罚与色调，UI 只做投影，避免多处硬编阈值分叉。

export type HeartDemonTier = 'calm' | 'unsettled' | 'restless' | 'demonic';




export interface HeartDemonProjection {

  value: number;           // 原始心魔值 0..100

  tier: HeartDemonTier;    // 分级（>=81 demonic / >=51 restless / >=21 unsettled / else calm）

  tierLabel: string;       // 世界化短语，如「心境澄明」「心魔缠身」

  tierIcon: string;        // 分级图标（emoji 或字符）

  tierColor: string;       // 主色 hex，用于边框/文字/进度条端点

  tierBorderOpacity: number; // 边框透明度 0..1

  tierBgOpacity: number;   // 背景透明度 0..1

  barGradient: string;     // 进度条 linear-gradient 字符串

  penalty: number;         // 修炼倍率折扣 0..0.7，与 computeEffectiveCultivationRate 同口径

  penaltyPct: number;      // penalty * 100 后 round，UI 直读

  penaltyText: string;     // 「修行未阻」「修炼效率 -10%」等世界化短语

}
