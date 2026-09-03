// 沉浸版 PoC：雷劫判定系统的类型定义。
// Phase-α 批 1 α-1：仅 PoC 范围——纯函数 + 4 种劫型 + 大境界映射表。
// 不依赖 db / store / 路由，纯契约层。

import {
  type CanonicalRealm,
  CANONICAL_REALM_IDS,
  LEGACY_REALM_ALIAS,
  canonicalRealm,
} from '../types/realm';

// ==================== 雷劫分类（参考凡人修仙 / 诛仙 / 遮天 / 完美世界）====================

/**
 * TribulationKind：修仙界常见的雷劫 / 心魔 / 天象类型。
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
 * RealmMajor: 劫型配置表的键。
 *
 * 2026-08-31: 这里原先自带一套六项私有名单, 与 types/realm.ts 的权威九项各说各话, 后果三处:
 *   1. 私有名单把 soul_formation 当「化神」用, 而权威别名表里 soul_formation 是「金丹」的别名——
 *      同一字符串在两个模块指不同境界, 谁引谁都会错位;
 *   2. 大乘 / 渡劫 / 飞升三项不在名单内, realmToMajor 对它们给 null,
 *      调用方 if (targetMajor) 一挡, 顶上三次大突破整段无劫;
 *   3. 表按「起始境界」命名, 取值却按「目标境界」查, 整体错行一位——
 *      突破到金丹, 吃的是本该给元婴那一行的凶险度。
 * 现改为复用权威九项, 一套词汇, 回归里用 assertRealmKeyCoverage 盯覆盖。
 */
export type RealmMajor = CanonicalRealm;

/**
 * TribulationProfile：单一大境界突破时的劫型配置。
 * - kind：劫型（修仙常识 + 故事张力）
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
 * TRIBULATION_PROFILES: 目标境界 -> 该次突破的劫型配置。
 *
 * 2026-08-31: 键的语义改成「突破到哪个境界」, 与 attemptTribulation 里的取值方式对齐。
 * 改之前表按「从哪个境界起」命名却按目标查, 每一行都作用在了下一个境界头上。
 * 九项盖满权威境界, 不再靠 null 让顶上三次突破静默无劫。
 */
export const TRIBULATION_PROFILES: Record<CanonicalRealm, TribulationProfile> = {
  // 无人「突破到凡人」; 占位保覆盖, 难度 0 表示不成劫。
  mortal: {
    kind: 'heart_demon',
    difficulty: 0,
    possibleOutcomes: ['success'],
    description: '尚未入道, 无劫可言。',
  },
  qi_refining: {
    kind: 'heart_demon',
    difficulty: 2,
    possibleOutcomes: ['success', 'severe'],
    description: '初入门户, 心魔多是俗世执念, 最是温和。',
  },
  foundation: {
    kind: 'heart_fire',
    difficulty: 4,
    possibleOutcomes: ['success', 'severe', 'fall_realm'],
    description: '丹田初成, 心火自燃, 根基不稳则跌回炼气。',
  },
  golden_core: {
    kind: 'thunder_fire',
    difficulty: 6,
    possibleOutcomes: ['success', 'severe', 'fall_realm', 'fatal'],
    description: '天雷初降兼丹田火起, 须外护内守, 自此始有陨落。',
  },
  nascent_soul: {
    kind: 'thunder_fire',
    difficulty: 7,
    possibleOutcomes: ['success', 'severe', 'fall_realm', 'fatal'],
    description: '元婴出窍之际雷火夹击, 十人渡劫难有三四得全。',
  },
  spirit_severing: {
    kind: 'heart_demon',
    difficulty: 9,
    possibleOutcomes: ['success', 'severe', 'fall_realm', 'fatal'],
    description: '七情六欲尽化心魔, 斩之则成化神, 溺之则形神俱灭。',
  },
  great_vehicle: {
    kind: 'celestial_omen',
    difficulty: 10,
    possibleOutcomes: ['success', 'severe', 'fall_realm', 'fatal'],
    description: '需应天象, 九星连珠、血月当空皆为劫兆。',
  },
  tribulation: {
    kind: 'celestial_omen',
    difficulty: 10,
    possibleOutcomes: ['success', 'severe', 'fall_realm', 'fatal'],
    description: '天地已不容此身, 劫数连绵不绝。',
  },
  ascension: {
    kind: 'celestial_omen',
    difficulty: 10,
    possibleOutcomes: ['success', 'severe', 'fall_realm', 'fatal'],
    description: '仙门将启, 最后一道关隘, 过则超脱, 败则烟消。',
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
 * 把任意境界值(含别名、旧存档脏值)归到权威境界键。
 * 认不出来的值给 null, 由调用方决定跳过——不套 canonicalRealm 的凡人兜底,
 * 否则一个脏值会被悄悄当成「突破到凡人」, 拿到一张 0 难度的免劫牌。
 */
export function realmToMajor(realm: string): RealmMajor | null {
  const key = String(realm || "");
  if (!key) return null;
  const known = (CANONICAL_REALM_IDS as string[]).includes(key) || Boolean(LEGACY_REALM_ALIAS[key]);
  return known ? canonicalRealm(key) : null;
}