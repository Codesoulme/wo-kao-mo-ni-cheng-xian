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

  // ==== 投影字段（2026-08-29 接线）====
  // 生成侧可指定这条状态落到哪些界面槽位、用什么色调与形制呈现。
  // 不填则由 display-registry.ts 的 slotsFromStatus / toneFromStatus 按归组推断，
  // 那套推断只会产出 topTags / characterDetail / statusPage / threadPage 四种，
  // 所以 inventoryPanel / combatPanel / worldLegacy 三个槽**只能靠这里显式点亮**。
  //
  // 词表边界：这三个字段的合法值与 rules/ui-slot-rules.ts 的
  // UI_SLOT_NAMES / UI_SLOT_TONES / UI_SLOT_RENDER_HINTS 逐字相同，
  // 由 registerStatus 在注册时按 UI_SLOT_RULES 剥离越界项 / 钳制到落点。
  //
  // 有意不含 displayGroup：ui-slot-rules 的归组词表是英文（identity/constitution/...），
  // 而 display-registry 的 groupFromStatus 产出汉文（身份/体质/...），两套尚未合流
  // （见 ui-slot-rules.ts 头注"批次二再收成一处"）。贸然接上会把汉文归组钳成 misc。
  displaySlots?: string[];

  tone?: string;

  renderHint?: string;

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
