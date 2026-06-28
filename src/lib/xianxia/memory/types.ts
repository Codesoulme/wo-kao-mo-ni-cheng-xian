// TechDoc 18.6.6: 三类记忆 + 分层摘要数据模型
// PoC 阶段：内存 Map 存储，未来接 SQLite / 向量 DB

export type MemoryKind = 'episodic' | 'semantic' | 'procedural';

/** 情节记忆：玩家经历过的具体事件 */
export interface EpisodicMemory {
  id: string;
  kind: 'episodic';
  eventId: string;
  characterId: string;
  age: number;
  /** 短摘要（几十字，用于 LLM prompt / UI 列表） */
  summary: string;
  /** 完整叙事（存档用，可选） */
  fullNarrative?: string;
  timestamp: number;
  /** 向量嵌入（PoC 留空，先用关键词匹配） */
  embedding?: number[];
  /** 分层摘要指针 */
  daySummaryId?: string;
  weekSummaryId?: string;
  monthSummaryId?: string;
}

/** 语义记忆：抽象的世界观事实 / 知识 */
export interface SemanticMemory {
  id: string;
  kind: 'semantic';
  category: 'world-fact' | 'lore' | 'technique' | 'item-desc';
  fact: string;
  /** 出处：eventId / NPC id / 文档路径 */
  source: string;
  confidence: number; // 0..1
  embedding?: number[];
}

/** 程序记忆：NPC 人设 / 技能特性 / 地点规则（TechDoc 6.4 人设锁定） */
export interface ProceduralMemory {
  id: string;
  kind: 'procedural';
  entityType: 'npc' | 'technique' | 'location';
  entityId: string;
  /** 自由结构：NPC 人设 / 技能特性 / 地点规则 */
  traits: Record<string, unknown>;
  /** 人设锁定时间（毫秒） */
  lockedAt: number;
}

export type Memory = EpisodicMemory | SemanticMemory | ProceduralMemory;

export type SummaryLevel = 'day' | 'week' | 'month';

/** 分层摘要：日 / 周 / 月，递归向上 */
export interface HierarchicalSummary {
  id: string;
  level: SummaryLevel;
  characterId: string;
  startAge: number;
  endAge: number;
  summary: string;
  /** 关键事件 ID 列表（3-5 个） */
  highlights: string[];
  createdAt: number;
  /** 指向上一层（day → week → month） */
  parentId?: string;
}
