// AUTO-SPLIT from engine.ts — physical extraction only, logic unchanged.

import {
  combatVerdict,
  realmDiff,
} from '../realm-power';
import {
  canonicalRealm,
  CANONICAL_REALM_IDS,
  type CanonicalRealm,
} from '../types/realm';
import {
  CharacterState,
  AttributeChange,
  StatusEntry,
  StatusEffect,
  ItemEntry,
  TechniqueProfile,
  TechniqueRequirement,
  ArtifactAbility,
  ConstitutionProfile,
  ElementType,
  Realm,
  RealmProfile,
  REALMS,
  REALM_TRAITS,
  getRealmInfo,
  CombatProjectionTraits,
  getNextRealm,
  SpiritualRoot,
  SPIRITUAL_ROOTS,
  FATE_NODES,
  AIEventOutput,
  SpiritualRootChange,
  EngineStateContext,
  NarrativeOutcomeKind,
  EquipSlot,
  EquippedMap,
  ITEM_TYPE_LABEL,
  SLOT_LABEL,
  itemToSlot,
  ELEMENTS,
  CultivationFactor,
  EventBlueprint,
  EVENT_BLUEPRINTS,
  BlueprintCategory,
  CharacterIntent,
  PendingThread,
  QuestEntry,
  QuestEntryStage,
  CombatEnemy,
  CombatRound,
  CombatRoundProposal,
  CombatSession,
  CombatActionOption,
  CombatActionPalette,
  CombatActionGroupKey,
  Formation,
  FormationType,
  Pet,
  PetSpecies,
  PET_SPECIES_TEMPLATES,
  TalismanType,
  SecretRealm,
  SECRET_REALMS,
  ExplorationRecord,
  WorldNpc,
  WorldFact,
  WorldFactKind,
  CausalGraph,
  CausalNode,
  CausalEdge,
  EffectResolveTrace,
  CultivationAttributeEntry,
  AlchemyAIOutcome,
  CombatLootAIOutcome,
  PetBondAIOutcome,
  PetCareAIOutcome,
  HeartDemonType,
  WorldTier,
  AscensionRequirement,
  AscensionSession,
  Restriction,
  CombatStance,
  CombatStanceUsage,
  CombatResourceType,
  CombatResourceUsage,
  BreakthroughStage,
  BreakthroughAttempt,
  ComboChain,
  COMBAT_STANCE_LABEL,
  WorldRegion,
  RegionTier,
  LocationNode,
  TravelRoute,
  WorldMap,
  COMBAT_RESOURCE_LABEL,
  BREAKTHROUGH_STAGE_LABEL,
  SectFaction,
  SectRelation,
  SectNode,
  SectRelationEdge,
  SectRelationGraph,
  EndingArchetype,
  EndingCondition,
  EndingChoice,
  EndingOutcome,
  EndingPathMap,
  InheritanceKind,
  InheritanceRecipient,
  InheritanceClaim,
  InheritanceChain,
  InheritancePool,
  CraftingRecipe,
  CraftingSession,
  CraftingResult,
  CraftingSideEffect,
  TechniqueStudy,
  CombatLogEntry,
  LootTable,
  LootCondition,
  StatusExpireRule,
  StatusExpiryMeta,
  PetCultivationPath,
  PillRecipeUnlockCondition,
  PillRecipe,
  PillCraftResult,
  FormationStackRule,
  FormationStackResult,
  BidderPersonality,
  BidderAction,
  ThreadChainNode,
  BottleSpirit,
  SwordAptitude,
  InnatePhysique,
  FakeDeathRule,
  NPCMemoryEntry,
  WorldRumor,
  NPCMemoryTier,
  NPCMemory,
  NPCMemoryCluster,
  NPCBehaviorInfluence,
  SectPhase,
  SectEvent,
  SectPowerMetric,
  SectTrajectory,
  SectInfluenceMap,
  FateEchoKind,
  FateEchoTrigger,
  FateEchoResolution,
  FateWeb,
  FatePredictedOutcome,
} from '../types';
import type {
  PillSideEffect,
  PillEffectiveness,
  PillSideEffectResolution,
  FormationDrawingStep,
  FormationDrawingSession,
  FormationDrawingProgress,
  PetEvolutionStage,
  PetEvolutionRequirement,
  PetEvolutionEligibility,
  PetInsight,
  PetCommunication,
  PetCombatSkill,
  PetSkillUsage,
  PetCombatSkillEvent,
  SecretRealmTriggerCondition,
  SecretRealmEntryAttempt,
  BidderArchetype,
  BidderBehaviorProfile,
  CombatCauseChain,
  StalemateExit,
} from '../types';
import {
  COMBAT_PROJECTION_LABELS,
  sanitizeLootName,
  sanitizeNarrativeText,
} from '../display';
import {
  hasRealmEntryRequirement,
} from '../secret-realm-utils';
import {
  resolveAttributeChanges,
} from '../effect-resolver';
import {
  inferAttributeChangesFromNarrative,
} from '../narrative-inference';
import {
  applyAgeBasedBodyGrowth,
} from '../body-growth';
import {
  validateAIBoundary,
  BoundaryValidationTrace,
} from '../ai-boundary-validator';
import {
  buildStateChangeLog,
  StateChangeLogEntry,
} from '../state-change-log';
import {
  buildEventSchedulerPlan,
} from '../event-scheduler';
import {
  attemptTribulation,
} from '../tribulation/engine';
import {
  realmToMajor,
} from '../tribulation/types';
import {
  appendEvent,
} from '../events/store';
import {
  applyKarmaDelta,
  computeKarmaShiftFromEvent,
} from '../karma';
import {
  registerItem,
  registerMany,
  registerStatus,
  registerThread,
  registerNpc,
  ValidationTrace,
} from '../content-registry';
import type {
  KarmaShiftPayload,
} from '../events/types';

import {
  getRealmProfile,
} from './attributes';

export function tryBreakthrough(
  state: CharacterState,
  intent?: { reason?: string; targetRealm?: Realm; targetLevel?: number }
): { state: CharacterState; success: boolean; newRealm?: Realm; major?: boolean; steps?: number; reasonAccepted?: boolean } {
  if (state.cultivationExp < state.expToBreak) {
    return { state, success: false };
  }

  // 修仙世界允许「连破数境」，但不能无因果乱跳。
  // 普通积累：最多升一小层；有明确奇遇/丹药/传承/顿悟等由头，且修为溢出足够时，可连续突破。
  const reason = String(intent?.reason || '').trim();
  const hasStrongReason = /奇遇|传承|顿悟|丹|灵药|天材地宝|灌顶|秘境|仙缘|雷劫|天劫|血脉|功法|灵脉|机缘/.test(reason);
  const requestedTargetRealm = intent?.targetRealm;
  const requestedTargetLevel = Number(intent?.targetLevel || 0);
  // 悟性影响连破：comprehension ≥ 70 时允许 1 步额外连破（无强因果时），≥ 85 时允许 2 步
  const comprehensionChainBonus = (state.comprehension || 0) >= 85 ? 2 : (state.comprehension || 0) >= 70 ? 1 : 0;
  const allowChain = hasStrongReason && (Boolean(requestedTargetRealm) || requestedTargetLevel > state.realmLevel + 1);
  const maxSteps = allowChain ? 4 : (comprehensionChainBonus > 0 ? 1 + comprehensionChainBonus : 1);

  let next: CharacterState = { ...state };
  let steps = 0;
  let major = false;
  let lastRealm: Realm | undefined;

  while (steps < maxSteps && next.cultivationExp >= next.expToBreak) {
    const info = getRealmInfo(next.realm);

    // 小境界优先；只有满层时才进入下一大境界。
    if (info.levels > 0 && next.realmLevel < info.levels - 1) {
      const minor = tryMinorBreakthrough(next);
      if (!minor.advanced) break;
      next = minor.state;
      steps += 1;
      lastRealm = next.realm;
    } else {
      const nextRealm = getNextRealm(next.realm);
      if (!nextRealm) break;
      const nextInfo = getRealmInfo(nextRealm);
      const remainingExp = Math.max(0, next.cultivationExp - next.expToBreak);
      const realmIdx = Math.max(1, REALMS.findIndex(r => r.id === nextRealm));
      const boost = 1.15 + realmIdx * 0.12;
      next = {
        ...next,
        realm: nextRealm,
        realmLevel: 0,
        cultivationExp: remainingExp,
        expToBreak: Math.floor(nextInfo.expPerLevel * (getRealmProfile(next)?.expMultiplier || 1)),
        lifespan: Math.max(next.lifespan, nextInfo.baseLifespan),
        maxHp: Math.floor(next.maxHp * boost),
        maxMp: Math.floor(next.maxMp * boost),
        attack: Math.floor(next.attack * boost),
        defense: Math.floor(next.defense * boost),
        speed: Math.floor(next.speed * boost),
      };
      next.hp = next.maxHp;
      next.mp = next.maxMp;
      steps += 1;
      major = true;
      lastRealm = nextRealm;
    }

    // 无强因果时不许跨大境界，防止「资质普通无奇遇，炼气一层直筑基」。
    // 2026-08-31：旧版在这里无条件 break，上面按悟性算出的 maxSteps 根本走不到——
    // 悟性 85 与悟性 10 连破表现完全一样，那个档位是个空旋钮。
    // 现在改成：跨大境界仍需强因果，小层连破交给悟性放行。
    if (!allowChain && major) break;

    // 若 AI 给了明确目标，到达目标后停止；目标是显示层数（1基），内部 realmLevel 为0基。
    if (requestedTargetRealm && next.realm === requestedTargetRealm) {
      if (!requestedTargetLevel || next.realmLevel + 1 >= requestedTargetLevel) break;
    } else if (!requestedTargetRealm && requestedTargetLevel && next.realmLevel + 1 >= requestedTargetLevel) {
      break;
    }
  }

  if (steps <= 0) return { state, success: false };
  return { state: next, success: true, newRealm: lastRealm || next.realm, major, steps, reasonAccepted: allowChain };
}

// ==================== 小境界提升 ====================

export function tryMinorBreakthrough(state: CharacterState): { state: CharacterState; advanced: boolean } {
  const info = getRealmInfo(state.realm);
  if (state.realmLevel >= info.levels - 1) {
    return { state, advanced: false };
  }
  const newState: CharacterState = {
    ...state,
    realmLevel: state.realmLevel + 1,
    cultivationExp: state.cultivationExp - state.expToBreak,
    expToBreak: Math.floor(state.expToBreak * 1.3),
    maxHp: Math.floor(state.maxHp * 1.1),
    hp: state.maxHp * 1.1 > state.maxHp ? Math.floor(state.maxHp * 1.1) : state.hp,
    maxMp: Math.floor(state.maxMp * 1.1),
    attack: Math.floor(state.attack * 1.08),
    defense: Math.floor(state.defense * 1.08),
    speed: Math.floor(state.speed * 1.05),
  };
  return { state: newState, advanced: true };
}


export type TribulationVerdict =
  | 'passed_with_refinement'  // 渡过并获得淬体加成（天降祥瑞、灵台稳固）
  | 'passed_barely'           // 堪堪渡过，身心俱疲，轻伤
  | 'failed_fall_realm'       // 失败跌回原境界，不掉大境界
  | 'failed_fatal'            // 渡劫陨落
  | 'skipped';                // 跳过——已在该大境界历劫过

export interface TribulationOutcome {
  verdict: TribulationVerdict;
  targetRealm: Realm;
  // 失败时的回滚境界（仅 failed_fall_realm 使用）
  revertedRealm?: Realm;
  // 渡劫后的淬体加成（仅 passed_with_refinement 使用）
  refinementBonus?: { maxHp?: number; maxMp?: number; attack?: number; defense?: number; speed?: number };
  // 因果残响（karma 偏移）
  karmaShift: number;
  // 中文叙事因由（渡劫者视角的一句话）
  reason: string;
}

// 计算渡劫下场（不落 state）
// 修仙风味的硬约束：
// - 致命陨落 ≤ 30% 上限（owner 关注点）
// - 首次大境界失败：fall-realm 概率占多数，fatal 仅在极低气血/极重业火时触发
// - 高 karma（善）提升 passed_with_refinement 概率；低 karma（恶）提升 failed_fall_realm 概率
// - sin 高叠加会提升致命概率
export function computeTribulationOutcome(state: CharacterState, targetRealm: Realm): TribulationOutcome {
  const karma = Number(state.karma || 0);
  const sin = Number(state.sin || 0);
  const merit = Number(state.merit || 0);
  const hpRatio = state.maxHp > 0 ? state.hp / state.maxHp : 0;
  // 修仙三宝·身神 — 渡劫加成：体魄/魂魄/悟 各按值缩窄致命/跌落区间
  const bodyTenacity = state.physicalFoundation ?? 0;
  const soulStability = state.soulStrength ?? 0;
  const enlightenment = state.comprehension ?? 0;
  const tribulationDefenseBonus = Math.min(0.20, bodyTenacity * 0.0008);
  const tribulationSoulBonus = Math.min(0.12, soulStability * 0.0006);
  const tribulationEnlightenBonus = Math.min(0.10, enlightenment * 0.0005);

  // 基础判定值（0..1）：修仙世界观'天时、地利、人和'用伪随机种子近似模拟
  const seedRaw = Math.abs(Math.floor(state.age)) + sin * 7 - merit * 3 + state.realmLevel * 5;
  const seed = ((seedRaw % 100) + 100) % 100;
  const fateRoll = seed / 100;

  const karmaDelta = Math.max(-0.15, Math.min(0.15, karma * 0.15));

  const fatalRange = Math.max(0.0, Math.min(0.30, 0.05 + sin * 0.01) + (hpRatio < 0.3 ? 0.15 : 0) - tribulationDefenseBonus);
  const fallRange = Math.max(0.0, Math.min(0.25, 0.10 + sin * 0.005 + (karma < 0 ? -karma * 0.05 : 0)) - tribulationSoulBonus);
  // 2026-08-31：原式是 fateRoll - karmaDelta - tribulationEnlightenBonus，
  // 而下面 adjusted 越小越靠 failed_fatal——等于善念与悟性都被当成惩罚项。
  // 实测千次采样：大恶者致命 0%、最佳结局 62%；大善者致命 23%、最佳 32%。
  // 与本函数上方注释「高 karma（善）提升 passed_with_refinement 概率」正好相反，改回加号。
  const adjusted = fateRoll + karmaDelta + tribulationEnlightenBonus;

  let verdict: TribulationVerdict = 'passed_barely';
  let refinementBonus: TribulationOutcome['refinementBonus'] | undefined;
  let karmaShift = 0;
  let reason = '';

  if (adjusted < fatalRange) {
    verdict = 'failed_fatal';
    karmaShift = -0.05 - sin * 0.001;
    reason = sin > 20
      ? '业火缠身，天雷灌顶，道基崩解'
      : hpRatio < 0.3
        ? '气血早已亏虚，天雷之下再无余力'
        : '天雷凶猛，道基难承，魂飞魄散';
  } else if (adjusted < fatalRange + fallRange) {
    verdict = 'failed_fall_realm';
    karmaShift = -0.02;
    reason = karma < -0.3
      ? '杀业深重，天雷反噬，跌回原境界'
      : '雷云之下难以寸进，跌回原境界以图再破';
  } else if (adjusted < 0.50) {
    verdict = 'passed_barely';
    karmaShift = 0;
    reason = '勉强渡过天劫，神魂疲惫，根基尚稳';
  } else {
    verdict = 'passed_with_refinement';
    refinementBonus = { maxHp: 1.2, maxMp: 1.2, attack: 1.15, defense: 1.15, speed: 1.1 };
    reason = '天雷淬体，根基稳固，灵台愈发清明';
  }
  return { verdict, targetRealm, refinementBonus, karmaShift, reason };
}

// ==================== 寿元检查 ====================

const ASCENSION_REQUIREMENTS: Record<WorldTier, AscensionRequirement> = {
  humanWorld: {
    fromTier: 'humanWorld',
    toTier: 'spiritWorld',
    minRealm: 'great_vehicle',
    tribulationPassed: true,
    lifespanMin: 500,
    reputationMin: 5000,
    cultivationExpMin: 100000,
    daoHeartMin: 80,
  },
  spiritWorld: {
    fromTier: 'spiritWorld',
    toTier: 'immortalWorld',
    minRealm: 'ascension',
    tribulationPassed: true,
    lifespanMin: 2000,
    reputationMin: 50000,
    cultivationExpMin: 1000000,
    daoHeartMin: 95,
  },
  immortalWorld: {
    fromTier: 'immortalWorld',
    toTier: 'immortalWorld',
    minRealm: 'ascension',
    tribulationPassed: true,
    lifespanMin: 99999,
    reputationMin: 999999,
    cultivationExpMin: 99999999,
    daoHeartMin: 100,
  },
};

/**
 * AI-68: 派生飞升要求（按当前三界层级）
 */
export function deriveAscensionRequirements(currentTier: WorldTier): AscensionRequirement {
  return ASCENSION_REQUIREMENTS[currentTier];
}

/**
 * AI-68: 检查角色是否符合飞升资格
 */
export function checkAscensionEligibility(
  character: { realm: Realm; cultivationExp: number; lifespan: number; reputation: number; daoHeart?: number },
  requirements: AscensionRequirement,
): { eligible: boolean; missing: string[] } {
  const missing: string[] = [];
  // 境界顺序比对（避免硬编码 enum 索引）
  // 2026-08-31：原数组混着别名（foundation_building / deity_transformation /
  // void_refinement / unity / mahayana），真键筑基、化神、大乘全缺，indexOf 返 -1，
  // 于是"境界不足"这条会对正常存档误报。改成直接引权威顺序表。
  const realmOrder = CANONICAL_REALM_IDS;
  const charIdx = realmOrder.indexOf(canonicalRealm(character.realm));
  const reqIdx = realmOrder.indexOf(canonicalRealm(requirements.minRealm));
  if (charIdx < reqIdx) missing.push(`境界不足（需 ${requirements.minRealm}）`);

  if (!requirements.tribulationPassed) missing.push('未渡天劫');
  if (character.lifespan < requirements.lifespanMin) missing.push(`寿命不足（需 ${requirements.lifespanMin}）`);
  if (character.reputation < requirements.reputationMin) missing.push(`声望不足（需 ${requirements.reputationMin}）`);
  if (character.cultivationExp < requirements.cultivationExpMin) missing.push(`修为不足（需 ${requirements.cultivationExpMin}）`);
  if ((character.daoHeart ?? 0) < requirements.daoHeartMin) missing.push(`道心不足（需 ${requirements.daoHeartMin}）`);
  return { eligible: missing.length === 0, missing };
}

/**
 * AI-68: 派生飞升触发（年龄 + 境界触发）
 */
export function deriveAscensionTrigger(age: number, realm: Realm): { triggered: boolean; reason: string } {
  // 2026-08-31：原判定是 realm === 'mahayana'（别名，玩法不产出）与
  // realm === 'ascension'（这个 id 的名字本身就是「飞升」）——等于"先飞升才能触发飞升"，
  // 想飞升的正常路径（大乘、渡劫期）两条全堵死。按权威 id 重接。
  const r = canonicalRealm(realm);
  if (r === 'great_vehicle' && age >= 500) return { triggered: true, reason: '大乘期 500 岁可尝试飞升' };
  if (r === 'tribulation' && age >= 2000) return { triggered: true, reason: '渡劫期 2000 岁可尝试飞升仙界' };
  return { triggered: false, reason: `${realm} @ ${age} 岁，未达飞升条件` };
}

/**
 * AI-68: 飞升判定（roll + 阈值）
 */
export function resolveAscensionOutcome(opts: {
  characterRoll: number;
  daoHeart: number;
  tribulationPassed: boolean;
  requirements: AscensionRequirement;
}): { passed: boolean; narrative: string } {
  if (!opts.tribulationPassed) {
    return { passed: false, narrative: '天劫未渡，飞升失败。' };
  }
  const baseThreshold = 0.5;
  const daoBonus = opts.daoHeart / 200;
  const effectiveRoll = opts.characterRoll + daoBonus;
  const passed = effectiveRoll >= baseThreshold;
  return {
    passed,
    narrative: passed
      ? `渡过 ${opts.requirements.fromTier} → ${opts.requirements.toTier} 飞升天劫！`
      : `飞升失败，跌回原境。`,
  };
}

/**
 * AI-69: 派生跨域通道（按当前层级）
 */
export interface CrossRealmPath {
  from: WorldTier;
  to: WorldTier;
  type: 'ascension' | 'starSky' | 'token' | 'forbidden';
  difficulty: number; // 0-100
  costSpiritStones: number;
}

export function deriveCrossRealmPaths(currentTier: WorldTier): CrossRealmPath[] {
  const paths: CrossRealmPath[] = [];
  // 升界
  if (currentTier === 'humanWorld') {
    paths.push({ from: 'humanWorld', to: 'spiritWorld', type: 'ascension', difficulty: 80, costSpiritStones: 0 });
  } else if (currentTier === 'spiritWorld') {
    paths.push({ from: 'spiritWorld', to: 'immortalWorld', type: 'ascension', difficulty: 95, costSpiritStones: 0 });
  }
  // 降界 + 跨界
  if (currentTier === 'spiritWorld') {
    paths.push({ from: 'spiritWorld', to: 'humanWorld', type: 'starSky', difficulty: 60, costSpiritStones: 100000 });
  } else if (currentTier === 'immortalWorld') {
    paths.push({ from: 'immortalWorld', to: 'spiritWorld', type: 'token', difficulty: 40, costSpiritStones: 0 });
    paths.push({ from: 'immortalWorld', to: 'humanWorld', type: 'token', difficulty: 70, costSpiritStones: 0 });
  }
  return paths;
}

// ==================== AI-70: 禁制派生函数 ====================

/**
 * AI-70: 检查禁制开启条件
 */
export function checkRestrictionAccess(
  restriction: Restriction,
  character: { inventory: ItemEntry[]; realm: Realm; faction?: string },
  providedPassword?: string,
  currentTiming?: string,
): { accessible: boolean; reason: string } {
  switch (restriction.accessMethod) {
    case 'token':
    case 'key': {
      if (!restriction.requiredItemId) return { accessible: false, reason: '禁制缺少钥匙定义' };
      const has = character.inventory.some((it) => it.id === restriction.requiredItemId);
      return has
        ? { accessible: true, reason: '持有钥匙/令牌' }
        : { accessible: false, reason: `缺少 ${restriction.requiredItemId}` };
    }
    case 'password': {
      if (providedPassword && restriction.requiredPassword === providedPassword) {
        return { accessible: true, reason: '口令正确' };
      }
      return { accessible: false, reason: '口令错误' };
    }
    case 'identity': {
      if (!restriction.requiredIdentity) return { accessible: false, reason: '禁制缺少身份定义' };
      if (restriction.requiredIdentity.includes('realm:')) {
        const req = restriction.requiredIdentity.replace('realm:', '');
        return character.realm === req
          ? { accessible: true, reason: `身份（${req}）符合` }
          : { accessible: false, reason: `需 ${req} 境界` };
      }
      // faction 等其他身份
      return restriction.requiredIdentity === character.faction
        ? { accessible: true, reason: '身份符合' }
        : { accessible: false, reason: '身份不符' };
    }
    case 'timing': {
      if (!restriction.timingWindows || restriction.timingWindows.length === 0) {
        return { accessible: false, reason: '禁制缺少时机定义' };
      }
      if (currentTiming && restriction.timingWindows.includes(currentTiming)) {
        return { accessible: true, reason: `时机（${currentTiming}）符合` };
      }
      return { accessible: false, reason: '时机不符' };
    }
    case 'combat': {
      return { accessible: false, reason: '需战斗开启' };
    }
    default:
      return { accessible: false, reason: '未知开启方式' };
  }
}

/**
 * AI-70: 派生禁制触发（根据角色是否进入禁制范围）
 */
export function deriveRestrictionTrigger(
  restriction: Restriction,
  character: { realm: Realm },
): { triggered: boolean; reason: string } {
  // 默认：进入范围即触发
  const triggered = true;
  return { triggered, reason: `进入 ${restriction.name} 范围` };
}

/**
 * AI-70: 禁制交互判定
 */
export function resolveRestrictionInteraction(
  restriction: Restriction,
  characterChoice: 'attempt' | 'retreat' | 'combat',
  characterPower: number,
): { outcome: 'unlocked' | 'locked' | 'combat' | 'retreated'; narrative: string } {
  if (characterChoice === 'retreat') {
    return { outcome: 'retreated', narrative: `退出 ${restriction.name}` };
  }
  if (restriction.accessMethod === 'combat') {
    if (characterPower >= (restriction.combatPower ?? 100)) {
      return { outcome: 'unlocked', narrative: `以力破禁，开启 ${restriction.name}` };
    }
    return { outcome: 'combat', narrative: `${restriction.name} 力量不足，进入战斗` };
  }
  // 非战斗类由 checkRestrictionAccess 判定
  return { outcome: 'locked', narrative: `尝试开启 ${restriction.name}，需进一步验证` };
}

// ==================== AI-71: 禁制 + 洞府联动 ====================

/**
 * AI-71: 派生秘境禁制检查
 */
export function deriveRealmRestrictionCheck(
  realm: { id: string; requiredRestrictionsPassed?: string[]; restrictions?: Restriction[] },
  passedRestrictionIds: string[],
): { canEnter: boolean; missingRestrictions: string[]; reason: string } {
  const required = realm.requiredRestrictionsPassed ?? [];
  const missing = required.filter((rid) => !passedRestrictionIds.includes(rid));
  const allRestrictions = realm.restrictions ?? [];
  return {
    canEnter: missing.length === 0,
    missingRestrictions: missing,
    reason: missing.length === 0
      ? `禁制已通过（${allRestrictions.length} 道），可进入秘境`
      : `需通过 ${missing.length} 道禁制：${missing.join('、')}`,
  };
}
// 以下为纯函数派生器，不依赖 db/store，调用方负责持久化。仅作契约层 + 简单逻辑：
// - deriveTribulationTrigger: 判断境界突破是否触发天劫
// - resolveTribulationBolt: 渡一道雷的判定
// - resolveHeartDemon: 心魔试炼判定

/**
 * AI-67: 判断境界突破是否触发天劫。
 * 规则：化神及以上每次大境界突破触发 9 道雷劫；其余境界不触发。
 */
export function deriveTribulationTrigger(
  realmBefore: Realm | null,
  realmAfter: Realm,
): { triggered: boolean; reason: string } {
  if (!realmBefore) return { triggered: false, reason: '无前境' };
  if (realmBefore === realmAfter) return { triggered: false, reason: '同境' };
  // 2026-08-31：原名单六项里四项是玩法不产出的别名（deity_transformation /
  // void_refinement / unity / mahayana），真正可达的化神与大乘反而不在列，
  // 于是后期两次大突破整段没有雷劫。改用权威 id 并先把入参归一。
  const tribulationRealms: CanonicalRealm[] = [
    'spirit_severing', 'great_vehicle', 'tribulation', 'ascension',
  ];
  const after = canonicalRealm(realmAfter);
  const isTrigger = tribulationRealms.includes(after);

  return isTrigger
    ? { triggered: true, reason: `${realmBefore} → ${realmAfter} 需渡天劫` }
    : { triggered: false, reason: `${realmAfter} 不在天劫境界之列` };
}

/**
 * AI-67: 渡一道雷的判定。
 * characterRoll 0-1 + 心魔值 + soulStrength 0-100 + 本命法宝共鸣。
 */
export function resolveTribulationBolt(opts: {
  boltNumber: number;            // 1-9
  characterRoll: number;         // 0-1
  heartDemon: number;            // 0-100
  soulStrength: number;          // 0-100
  bondedArtifactResonance: boolean;
  /** 挨这道雷之前的实际气血。旧调用方不传时按满血 100 起算（与改动前一致）。 */
  hpBefore?: number;
  /** 气血上限。旧调用方不传时按 100。 */
  maxHp?: number;
}): { passed: boolean; hpRemaining: number; hpDelta: number; narrative: string } {
  const baseThreshold = 0.3 + opts.boltNumber * 0.07;
  const heartDemonPenalty = Math.max(0, (opts.heartDemon - 30) / 200);
  const soulBonus = opts.soulStrength / 500;
  const artifactBonus = opts.bondedArtifactResonance ? 0.1 : 0;
  const effectiveRoll = opts.characterRoll + soulBonus + artifactBonus - heartDemonPenalty;
  const passed = effectiveRoll >= baseThreshold;
  // 2026-08-31：扣血改按上限折算，并且从真实气血往下扣。
  //   旧写法 hpRemaining = clamp(100 + hpDelta)，每道雷都从凭空的满血 100 重算，
  //   九道雷连着挨下来气血一点没少；更荒唐的是挡不住反而比挡住剩得多——
  //   第七道扛过去扣 35 剩 65，扛不过去只扣 30 剩 70。
  //   现在从真实气血往下扣，扣量按上限折算，且失败恒重于成功。
  //   曲线按「九道全挡下来约耗上限五成半」定：挡住 boltNumber×1.2%，破防 15%+boltNumber×2%。
  //   上限 100 时全挡合计 55 点，留得下一线生机；每道破防都比挡住疼两三倍。
  const maxHp = Math.max(1, Math.round(Number(opts.maxHp) || 100));
  const hpBefore = Math.max(0, Math.min(maxHp, Math.round(Number(opts.hpBefore ?? maxHp))));
  const passCost = Math.max(2, Math.round(maxHp * opts.boltNumber * 0.012));
  const failCost = Math.max(passCost + 3, Math.round(maxHp * (0.15 + opts.boltNumber * 0.02)));
  const hpDelta = -(passed ? passCost : failCost);
  const hpRemaining = Math.max(0, Math.min(maxHp, hpBefore + hpDelta));
  return {
    passed,
    hpRemaining,
    hpDelta: hpRemaining - hpBefore,
    narrative: passed
      ? `第 ${opts.boltNumber} 道天雷落下，险中求胜，气血大损。`
      : `第 ${opts.boltNumber} 道天雷破防，气血暴跌！`,
  };
}

/**
 * AI-67: 心魔试炼判定。选主导维度为心魔类型。
 */
export function resolveHeartDemon(opts: {
  innerState: { obsession: number; hatred: number; love: number; fear: number; regret: number };
  resolveRoll: number;          // 0-1
}): {
  demonType: HeartDemonType;
  passed: boolean;
  narrative: string;
} {
  const dims = opts.innerState;
  const max = Math.max(dims.obsession, dims.hatred, dims.love, dims.fear, dims.regret);
  let demonType: HeartDemonType = 'obsession';
  if (dims.hatred === max) demonType = 'hatred';
  else if (dims.love === max) demonType = 'love';
  else if (dims.fear === max) demonType = 'fear';
  else if (dims.regret === max) demonType = 'regret';

  const passed = opts.resolveRoll >= 0.5;
  return {
    demonType,
    passed,
    narrative: passed
      ? `心魔（${demonType}）被斩，识海重归澄澈。`
      : `心魔（${demonType}）反噬，识海动荡！`,
  };
}

// 探索结束后更新探索记录（在 explore route 收到 AI 输出后调用）
export function deriveBreakthroughStage(
  realmBefore: Realm,
  realmAfter: Realm,
  attemptNumber: number,
  age: number,
  heartDemon: number = 0,
): BreakthroughStage {
  if (realmBefore === realmAfter) return 'passed';
  if (!attemptNumber || attemptNumber <= 0) return 'perception';
  if (attemptNumber === 1) {
    if (heartDemon >= 60) return 'storm';
    if (age >= 80) return 'condense';
    return 'perception';
  }
  if (attemptNumber === 2) return 'condense';
  if (attemptNumber === 3) return heartDemon >= 50 ? 'storm' : 'stabilize';
  // 第 4 次及以上视为稳固或失败前的最后尝试
  return 'stabilize';
}

/**
 * AI-83: 根据尝试次数、外援数、心魔值推导本次突破的结局。
 * - 返回 'success' | 'failed' | 'continue'
 */
export function resolveBreakthroughOutcome(opts: {
  attempt: BreakthroughAttempt;
  heartDemon: number;
  helperPower: number;
}): { outcome: 'success' | 'failed' | 'continue'; narrative: string } {
  const { attempt, heartDemon, helperPower } = opts;
  // 已通过 → 成功
  if (attempt.stage === 'passed') {
    return { outcome: 'success', narrative: '境界已稳，新阶已立' };
  }
  // 风暴阶段 + 高心魔 → 失败概率提升
  if (attempt.stage === 'storm' && heartDemon >= 60) {
    return { outcome: 'failed', narrative: '心魔趁势反扑，突破溃散' };
  }
  // 稳固阶段 + 外援够 → 成功
  if (attempt.stage === 'stabilize') {
    if (helperPower >= 3 || attempt.helperCount >= 1) {
      return { outcome: 'success', narrative: '得外援助力，新境界稳固下来' };
    }
    return { outcome: 'continue', narrative: '还需闭关巩固' };
  }
  // 默认 → 继续
  return { outcome: 'continue', narrative: '仍需继续推进' };
}

// ==================== AI-84: Combat Stalemate Break ====================

/**
 * AI-84: 检测战斗是否陷入僵局。
 * - 当连续多回合无任何一方血量变化或状态变化 → 僵局
 * - 仅有低伤害互刮不算推进
 */