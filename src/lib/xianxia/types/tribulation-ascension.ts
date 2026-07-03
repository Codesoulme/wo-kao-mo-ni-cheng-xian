import type { Realm } from './realm';




// ==================== AI-67: 天劫系统 ====================

// 天劫阶段：开劫 → 9 道雷 → 渡/败

export type TribulationStage =

  | 'opening'         // 开劫（天象异变）

  | 'bolt1' | 'bolt2' | 'bolt3' | 'bolt4' | 'bolt5'

  | 'bolt6' | 'bolt7' | 'bolt8' | 'bolt9'

  | 'passed'          // 渡过

  | 'failed';         // 失败




// 心魔类型（5 种：执/恨/爱/惧/悔）

export type HeartDemonType = 'obsession' | 'hatred' | 'love' | 'fear' | 'regret';




// ==================== AI-68: 飞升系统 ====================

// 三界层级：凡间 → 灵界 → 仙界

export type WorldTier = 'humanWorld' | 'spiritWorld' | 'immortalWorld';




// 飞升要求（按 WorldTier 组合）

export interface AscensionRequirement {

  fromTier: WorldTier;

  toTier: WorldTier;

  minRealm: Realm;

  tribulationPassed: boolean;

  lifespanMin: number;       // 最低寿命要求

  reputationMin: number;     // 最低声望

  cultivationExpMin: number; // 最低修为

  daoHeartMin: number;       // 道心强度 0-100

}




// 飞升会话

export interface AscensionSession {

  id: string;

  characterId: string;

  fromTier: WorldTier;

  toTier: WorldTier;

  requirements: AscensionRequirement;

  startedAge: number;

  passed: boolean;

  outcome: 'ascended' | 'failed' | 'ongoing' | 'abandoned';

  narrative: string;

}




// ==================== AI-70: 禁制系统 ====================

// 禁制类型（6 种）：门/困/传送/封/卫/障

export type RestrictionType = 'door' | 'trap' | 'transport' | 'seal' | 'ward' | 'barrier';




// 禁制开启方式（6 种）：令牌/口令/身份/钥匙/时机/战斗

export type RestrictionAccessMethod = 'token' | 'password' | 'identity' | 'key' | 'timing' | 'combat';




// 禁制定义

export interface Restriction {

  id: string;

  name: string;

  type: RestrictionType;

  accessMethod: RestrictionAccessMethod;

  requiredItemId?: string;        // 钥匙/令牌时填

  requiredPassword?: string;      // 口令时填

  requiredIdentity?: string;      // 身份要求（如"宗门弟子""渡劫期"）

  combatPower?: number;           // 战斗要求（仅 combat）

  timingWindows?: string[];       // 时机要求（如"月圆之夜""正午"）

  description: string;

  difficulty: number;             // 0-100

}




// 天劫会话

export interface TribulationSession {

  id: string;

  characterId: string;

  startedAge: number;

  fromRealm: Realm;

  toRealm: Realm;

  currentStage: TribulationStage;

  boltsCompleted: number;          // 已渡雷数

  hpRemaining: number;            // 当前气血百分比 0-100

  heartDemonActive: HeartDemonType | null;  // 当前触发的心魔

  heartDemonResolved: boolean;

  narrative: string;              // 渡劫叙事

  passed: boolean;                // 是否渡过

  outcome: 'ascended' | 'failed' | 'ongoing' | 'abandoned';

}
