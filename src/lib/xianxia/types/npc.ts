import type { WorldTier } from './tribulation-ascension';




// ==================== AI 输出结构 (EngineCommand) ====================



export type WorldNpcAttitude = 'ally' | 'friendly' | 'neutral' | 'hostile' | 'enemy' | 'unknown';




export interface WorldNpc {

  id: string;

  name: string;

  description: string;

  role?: string;

  realm?: string;

  faction?: string;

  attitude: WorldNpcAttitude;

  relationshipScore: number;

  firstMetAge: number;

  lastSeenAge: number;

  lastKnownLocation?: string;

  source: string;

  memory?: string;

  relatedThreadIds?: string[];

  tags?: string[];

  // AI-64: 道侣系统

  spouseOf?: string | null;             // 若为某角色道侣，存 characterId

  dualCultivationProgress?: number;     // 双修进度 0-100

  // AI-69: 三界 NPC + 跨域通道

  worldTier?: WorldTier;                // NPC 所属三界层级

  crossRealmAccess?: boolean;           // 是否持有跨域通行权


  // 沉浸版 Phase-N: NPC 自身身体成长字段 — 凡人幼壮老、修真者突破/衰老都会写回

  combatAttrs?: {

    attack: number;

    defense: number;

    speed: number;

    maxHp: number;

  };

  // 沉浸版 Phase-N: 最近一次年度推进的属性 delta（用于面板红绿微章展示）

  lastGrowth?: {

    attack: number;

    defense: number;

    speed: number;

    maxHp: number;

  };

}




// AI-64: 道侣引用（NpcRef — 简单引用结构）

export interface NpcRef {

  npcId: string;

  npcName: string;

  intimacy: number;                     // 0-100

  sinceAge: number;                     // 结缘年龄

}
