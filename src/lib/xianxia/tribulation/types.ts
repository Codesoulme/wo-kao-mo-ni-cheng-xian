// 沉浸版 PoC：雷劫判定系统的类型定义。
// Phase-α 批 1 α-1：仅 PoC 范围——纯函数 + 4 种劫型 + 大境界映射表。
// 不依赖 db / store / 路由，纯契约层。

// ==================== 雷劫分类（参考凡人修仙 / 诛仙 / 遮天 / 完美世界）====================

/**
 * TribulationKind：修真界常见的雷劫 / 心魔 / 天象类型。
 * PoC 阶段枚举 4 种，覆盖"内劫（心魔）+ 外劫（雷火）+ 天象（异常天象）"三类基础场景。
 * - heart_demon（心魔劫）：凡人→炼气、金丹→元婴 常见；内观执念。
 * - thunder_fire（雷火劫）：元婴→化神 常见；外雷 + 心火夹击。
 * - celestial_omen（天象劫）：化神→大乘 罕见；天降异象（如九星连珠、血月当空）。
 * - heart_fire（心火劫）：筑基→金丹 常见；丹田心火自焚。
 */
export type TribulationKind =
  | 'heart_demon'      // 心魔劫（内）
  | 'thunder_fire'     // 雷火劫（外 + 内）
  | 'celestial_omen'   // 天象劫（天地）
  | 'heart_fire';      // 心火劫（丹田）

// ==================== 渡劫结果 ====================

/**
 * TribulationOutcome：渡劫后果的四级分类。
 * - success（淬体成功）：突破境界 + 淬炼肉身 / 神识。
 * - fall_realm（降境失败）：境界跌落一层 / 一大境，未死。
 * - severe（重伤）：境界不变，但气血 / 神识重伤，需长时间修养。
 * - fatal（陨落）：身死道消，角色结束。
 */
export type TribulationOutcome =
  | 'success'
  | 'fall_realm'
  | 'severe'
  | 'fatal';

// ==================== 大境界映射（per 大境界的劫型配置）====================

/**
 * RealmMajor：修真大境界的语义分类（与 Realm enum 不同——只关心"突破时会发生什么劫"）。
 * PoC 阶段 6 大境界：凡人 / 炼气 / 筑基 / 金丹 / 元婴 / 化神。
 * 注意：渡劫/飞升不在此列——它们有自己的 Event Sourcing 流程（resolveTribulationBolt）。
 */
export type RealmMajor =
  | 'mortal'      // 凡人
  | 'qi_refining' // 炼气
  | 'foundation'  // 筑基
  | 'golden_core' // 金丹
  | 'nascent_soul'// 元婴
  | 'soul_formation'; // 化神（spirit_severing 的别名，与 Realm 对齐用 soul_formation）

/**
 * TribulationProfile：单一大境界突破时的劫型配置。
 * - kind：劫型（修真常识 + 故事张力）
 * - difficulty：艰难度 1-10（数值越大越凶险；与陨落概率间接相关）
 * - possibleOutcomes：可能下场列表（不含概率——概率在 attemptTribulation 内硬编码）
 */
export interface TribulationProfile {
  kind: TribulationKind;
  difficulty: number; // 1-10
  possibleOutcomes: TribulationOutcome[];
  description: string;
}

/**
 * TRIBULATION_PROFILES：大境界 → 渡劫配置映射表（修真常识版）。
 * - 凡人→炼气：心魔劫（难度 2，最温和，几乎无陨落）
 * - 炼气→筑基：心火劫（难度 4）
 * - 筑基→金丹：雷火劫（难度 6）
 * - 金丹→元婴：心魔劫 + 雷火劫 双劫（难度 8，陨落概率最高）
 * - 元婴→化神：天象劫（难度 9）
 * - 化神→大乘：天象劫 + 心火劫 三劫合一（难度 10，飞升前奏）
 */
export const TRIBULATION_PROFILES: Record<RealmMajor, TribulationProfile> = {
  mortal: {
    kind: 'heart_demon',
    difficulty: 2,
    possibleOutcomes: ['success', 'severe'],
    description: '初入修真之门，心魔多为俗世执念，难度最低。',
  },
  qi_refining: {
    kind: 'heart_fire',
    difficulty: 4,
    possibleOutcomes: ['success', 'severe', 'fall_realm'],
    description: '丹田初成，心火自燃，若根基不稳易跌回炼气初期。',
  },
  foundation: {
    kind: 'thunder_fire',
    difficulty: 6,
    possibleOutcomes: ['success', 'severe', 'fall_realm'],
    description: '天雷初降 + 丹田火起，需外护内守。',
  },
  golden_core: {
    kind: 'thunder_fire',
    difficulty: 7,
    possibleOutcomes: ['success', 'severe', 'fall_realm', 'fatal'],
    description: '金丹凝形关键期，雷火夹击，陨落概率上升。',
  },
  nascent_soul: {
    kind: 'heart_demon',
    difficulty: 9,
    possibleOutcomes: ['success', 'severe', 'fall_realm', 'fatal'],
    description: '元婴出窍之际，七情六欲皆化为心魔，渡之难如登天。',
  },
  soul_formation: {
    kind: 'celestial_omen',
    difficulty: 10,
    possibleOutcomes: ['success', 'severe', 'fatal'],
    description: '化神需应天象，九星连珠 / 血月当空皆为劫兆。',
  },
};

// ==================== 渡劫输入 / 输出 ====================

/**
 * TribulationInput：attemptTribulation 的输入参数。
 * - character：当前角色 snapshot（仅读，不修改）
 * - targetRealm：目标大境界（PoC 阶段只关心 major，跳过 minor）
 * - hpRatio：当前气血比例 0-1（外部传入——避免 engine.ts 耦合血量计算）
 * - soulStrength：神识强度 0-100
 * - heartDemon：心魔值 0-100
 * - hasBondedArtifact：是否携带本命法宝（true 时 +10% success）
 * - hasTribulationPill：是否服用渡劫辅助丹药（true 时 -10% fatal）
 */
export interface TribulationInput {
  character: {
    id: string;
    name: string;
    age: number;
    realm: RealmMajor;
  };
  targetRealm: RealmMajor;
  hpRatio: number;        // 0-1
  soulStrength: number;   // 0-100
  heartDemon: number;     // 0-100
  hasBondedArtifact?: boolean;
  hasTribulationPill?: boolean;
}

/**
 * NarrativeHook：给 LLM prompt 用的雷劫叙事钩子（单条）。
 * 沉浸版之要：每条钩子是"具体场景 + 情绪 + 主角反应"三要素，
 * 让 LLM 生成叙事时直接据此润色，而不是凭空编。
 */
export interface NarrativeHook {
  category: 'setting' | 'emotion' | 'action' | 'aftermath';
  text: string;
  weight: number; // 1-3，越高越优先被 LLM 采纳
}

/**
 * TribulationResult：渡劫判定结果。
 * - outcome：四级结局之一
 * - cause：导致该结局的核心原因（用于叙事归因）
 * - hpDelta：气血变化（成功时可能 +；失败时 -）
 * - narrativeHooks：给 LLM 的叙事钩子列表（最多 charLimit 字符）
 */
export interface TribulationResult {
  outcome: TribulationOutcome;
  cause: string;
  hpDelta: number;
  narrativeHooks: NarrativeHook[];
  /** 命中的劫型（来自 TRIBULATION_PROFILES，方便调用方审计） */
  kind: TribulationKind;
  /** 该大境界的艰难度（debug / 展示用） */
  difficulty: number;
}

// ==================== 工具函数 ====================

/**
 * 将 Realm 字符串（来自 types.ts 的 Realm union）映射到 RealmMajor。
 * PoC 阶段硬编码映射表——不依赖 REALMS 数组避免循环依赖。
 */
export function realmToMajor(realm: string): RealmMajor | null {
  switch (realm) {
    case 'mortal': return 'mortal';
    case 'qi_refining': return 'qi_refining';
    case 'foundation':
    case 'foundation_building': return 'foundation';
    case 'golden_core': return 'golden_core';
    case 'nascent_soul': return 'nascent_soul';
    case 'spirit_severing': return 'soul_formation';
    default: return null; // 渡劫/飞升等不在 PoC 范围内
  }
}