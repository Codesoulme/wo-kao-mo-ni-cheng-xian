



// ==================== AI-66: 宗门历史条目 ====================

export interface SectHistoryEntry {

  sectId: string;

  sectName: string;

  joinedAge: number;

  leftAge?: number;            // 未离开则为 undefined

  reason: 'joined' | 'left' | 'banished' | 'ascended' | 'retired' | 'martyred';

}




// ==================== AI-I4xx: 宗门兴衰系统类型 ====================

export type SectPhase = 'founding' | 'prosperous' | 'stable' | 'declining' | 'crisis' | 'scattered' | 'remnant';


export interface SectEvent {

  id: string;

  sectId: string;

  age: number;

  kind: string;

  phase: SectPhase;

  narrative: string;

  impact: number;

  description?: string;

  severity?: 'info' | 'warning' | 'critical' | number;

  characterIds?: string[];

  worldFactIds?: string[];

}


export interface SectPowerMetric {

  sectId: string;

  realmPower: number;

  internalCohesion: number;

  externalReputation: number;

  resourceReserve: number;

  resourceStock?: number;

  reputation?: number;

  memberCount: number;

  combatPower?: number;

  timeStamp?: number;

}


export interface SectTrajectory {

  sectId: string;

  factionId?: string;

  fromPhase: SectPhase;

  toPhase: SectPhase;

  phase?: SectPhase;

  startedAge: number;

  endedAge?: number;

  triggers: string[];

  currentLeader?: string;

  fate?: string;

  history?: SectEvent[];

  powerCurve?: SectPowerMetric[];

}


export interface SectInfluenceMap {

  sectId: string;

  influence: Record<string, number>;

}




// ==================== Phase-H Worker A: Sect Relation Graph Types ====================

// AI-H301~H304: Sect faction relations and player affinity (additive only).

// ----------------------------------------------------------------------------



/**

 * AI-H301 宗门阵营。

 * 修仙界主要阵营/势力分类；用于 SectNode.alignment 与玩家宗门亲缘。

 */

export type SectFaction =

  | 'qingyun-pavilion'      // 青云阁：正道剑修名门

  | 'blood-saber-sect'      // 血刀宗：魔道刀修

  | 'heavenly-talisman-sect'// 天符宗：符箓正宗

  | 'ten-thousand-sword-sect' // 万剑宗：剑道圣地

  | 'wandering-cultivator'  // 散修：自由人

  | 'demonic-ways'          // 魔道：旁门左道

  | 'royal-court'           // 王庭：世俗王朝与皇族

  | 'merchant-guild';       // 商盟：修士商贾




/**

 * AI-H302 宗门关系类型。

 * 描述两个宗门阵营之间的关系性质，强度由 SectRelationEdge.intensity 决定。

 */

export type SectRelation =

  | 'ally'         // 同盟

  | 'rival'        // 竞争/宿敌但未全面开战

  | 'enemy'        // 死敌

  | 'neutral'      // 中立

  | 'vassal'       // 附庸

  | 'subordinate'  // 下属/支脉

  | 'wary-respect';// 警惕中互敬




/**

 * AI-H303 宗门节点。

 * 一个宗门或势力的具体画像。

 */

export interface SectNode {

  id: string;

  name: string;

  /** 阵营归属：与 SectFaction 对齐，用于关系图与玩家亲缘推导 */

  alignment: SectFaction;

  /** 阵营最低境界 tier（0=mortal, 1=qi_refining ...） */

  realmTierMin: number;

  /** 阵营最高境界 tier */

  realmTierMax: number;

  /** 综合实力排名（数字越小越强） */

  powerRank: number;

  /** 当代掌门/领袖名号（世界内可读名） */

  currentLeader: string;

  /** 山门/总部所在地理位置（世界内文本） */

  seatLocation: string;

  /** 对外公开立场摘要（一句话） */

  publicStance: string;

}




/**

 * AI-H304 宗门关系有向边。

 * 表达 from -> to 的关系性质与强度；强度 0-1。

 */

export interface SectRelationEdge {

  from: string;        // 源 SectNode.id

  to: string;          // 目标 SectNode.id

  relation: SectRelation;

  /** 关系强度 0..1（数字越大关系越紧密/激烈） */

  intensity: number;

  /** 该关系自角色哪一年龄起生效（用于时间线） */

  sinceAge: number;

  /** 世界内叙事注解（AI 生成） */

  narrativeNote: string;

}




/**

 * AI-H304 宗门关系图（不可变快照）。

 * - nodes: 图中所有宗门节点

 * - edges: 全部有向关系边

 * - lastUpdatedAge: 上次更新时间（角色年龄）

 * - currentAge: 当前角色年龄快照

 */

export interface SectRelationGraph {

  nodes: SectNode[];

  edges: SectRelationEdge[];

  lastUpdatedAge: number;

  currentAge: number;

}
