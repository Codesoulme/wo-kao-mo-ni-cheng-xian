


// ===== AI-101: NPC Memory =====

export interface NPCMemoryEntry {

  npcId: string;

  eventSummary: string;

  importance: number;

  age: number;

  kind: 'witness' | 'rumor' | 'interaction' | 'betrayal' | 'kindness';

}




// ===== AI-103: World Rumor =====

export interface WorldRumor {

  rumorId: string;

  source: string;

  content: string;

  reliability: number;

  originAge: number;

  regionScope?: string;

  truthHint?: string;

}




// ==================== Phase-H Worker B: NPC Long-Term Memory ====================

// AI-H3xx: Structured NPC memory layer with tiered importance, emotional valence,

// involved characters/facts/threads, decay rules, and prompt summarization.

// Distinct from AI-101 NPCMemoryEntry (raw witness list) — this layer stores

// normalized memories suitable for AI prompt injection and behavior derivation.



export type NPCMemoryTier = 'trivial' | 'notable' | 'significant' | 'core' | 'defining';




export interface NPCMemory {

  id: string;

  npcId: string;

  age: number;

  summary: string;

  tier: NPCMemoryTier;

  // -1 = hostile, 0 = neutral, +1 = warm. Validated/clamped to [-1, 1].

  emotionalValence: number;

  involvedCharacterIds: string[];

  worldFactIds: string[];

  evidenceThreadIds: string[];

}




export interface NPCMemoryCluster {

  npcId: string;

  memories: NPCMemory[];

  dominantTier: NPCMemoryTier;

  definingTrait: string;

  lastInteractionAge: number;

}



/**

 * AI-H313b: tunables for decayNPCMemories.

 * - trivialDecayYears: age gap after which 	rivial memories are dropped (default 8).

 * - downgradeYears: age gap after which 

otable / significant memories are downgraded one tier (default 20).


 */

export interface NPCMemoryDecayConfig {

  trivialDecayYears?: number;

  downgradeYears?: number;

}




export interface NPCBehaviorInfluence {

  friendlyWeight: number;

  hostileWeight: number;

  neutralWeight: number;

  actionHint: string;

}
