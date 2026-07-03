// AUTO-SPLIT from engine.ts — physical extraction only, logic unchanged.

import {
  combatVerdict,
  realmDiff,
} from '../realm-power';
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
  computeEffectiveCultivationRate,
  recalcCultivationMultiplier,
} from './attributes';
import {
  applyItemEffects,
} from './items';
import {
  addStatuses,
} from './statuses';

export function activateFormation(state: CharacterState, diskItemId: string): { state: CharacterState; ok: boolean; error?: string; formation?: Formation } {
  const disk = state.inventory.find(it => it.id === diskItemId);
  if (!disk) return { state, ok: false, error: '阵盘不在储物袋中' };
  if (disk.item_type !== 'tool') return { state, ok: false, error: '该物品不是阵盘' };
  // 解析阵盘 effects 中的 formationType 信息
  const formTypeEff = (disk.effects || []).find(e => e.target_attribute === 'formationType');
  if (!formTypeEff) return { state, ok: false, error: '该物品不是阵盘（无 formationType 效果）' };

  // 根据阵盘稀有度生成阵法
  const rarityToPower: Record<string, number> = { common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 4, mythic: 5 };
  const power = rarityToPower[disk.rarity] || 1;

  // 根据阵盘名推断类型
  const name = disk.name || '';
  let formType: FormationType = 'spirit_gathering';
  let effects: Formation['effects'] = [];
  if (name.includes('聚灵')) {
    formType = 'spirit_gathering';
    effects = [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1 + 0.2 * power, description: `聚灵阵加持，修为×${(1 + 0.2 * power).toFixed(2)}` }];
  } else if (name.includes('护体') || name.includes('防御')) {
    formType = 'protection';
    effects = [{ target_attribute: 'defense', operation: 'add', value: 5 * power, description: `护体阵+${5 * power}防` }];
  } else if (name.includes('迷踪') || name.includes('隐匿')) {
    formType = 'concealment';
    effects = [{ target_attribute: 'luck', operation: 'add', value: 3 * power, description: `迷踪阵+${3 * power}气运` }];
  } else if (name.includes('杀') || name.includes('攻伐')) {
    formType = 'killing';
    effects = [{ target_attribute: 'attack', operation: 'add', value: 5 * power, description: `杀阵+${5 * power}攻` }];
  } else if (name.includes('火')) {
    formType = 'fire';
    effects = [{ target_attribute: 'elementFire', operation: 'add', value: 5 * power, description: `火阵+${5 * power}火` }];
  } else if (name.includes('水')) {
    formType = 'water';
    effects = [{ target_attribute: 'elementWater', operation: 'add', value: 5 * power, description: `水阵+${5 * power}水` }];
  } else if (name.includes('木')) {
    formType = 'wood';
    effects = [{ target_attribute: 'elementWood', operation: 'add', value: 5 * power, description: `木阵+${5 * power}木` }];
  } else if (name.includes('金')) {
    formType = 'metal';
    effects = [{ target_attribute: 'elementMetal', operation: 'add', value: 5 * power, description: `金阵+${5 * power}金` }];
  } else if (name.includes('土')) {
    formType = 'earth';
    effects = [{ target_attribute: 'elementEarth', operation: 'add', value: 5 * power, description: `土阵+${5 * power}土` }];
  } else {
    // 默认聚灵
    effects = [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1 + 0.15 * power, description: `阵法加持×${(1 + 0.15 * power).toFixed(2)}` }];
  }

  const formation: Formation = {
    id: `formation_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name,
    type: formType,
    description: disk.description || `${name}阵法`,
    rarity: disk.rarity as any,
    effects,
    requirements: {
      minRealm: 'qi_refining',
      minComprehension: 30,
      spiritStoneCost: 2 * power,
    },
    formationDiskItemId: diskItemId,
    active: true,
  };

  // 检查境界
  const realmIdx = REALMS.findIndex(r => r.id === state.realm);
  const minRealmIdx = REALMS.findIndex(r => r.id === 'qi_refining');
  if (realmIdx < minRealmIdx) {
    return { state, ok: false, error: '需达到炼气期方可激活阵法' };
  }
  // 检查悟性
  if (state.comprehension < (formation.requirements.minComprehension || 30)) {
    return { state, ok: false, error: `悟性不足，需 ${formation.requirements.minComprehension} 点` };
  }
  // 把阵法作为 statusEntry 加入角色
  const statusEntry: StatusEntry = {
    id: formation.id,
    name: `[阵法]${formation.name}`,
    description: formation.description + '（每岁消耗' + (formation.requirements.spiritStoneCost || 0) + '灵石）',
    category: 'special',
    rarity: formation.rarity,
    duration: -1, // 永久，玩家可手动关闭
    source: '阵盘激活',
    effects: formation.effects.map(e => ({ ...e, operation: e.operation as any })),
  };
  let next = addStatuses(state, [statusEntry]);
  // 应用即时 add 效果（multiply cultivationExp 不在这里应用，由 computeEffectiveCultivationRate 自动处理）
  next = applyItemEffects(next, { ...statusEntry, effects: statusEntry.effects.filter(e => e.operation === 'add') } as any, 1);
  next = recalcCultivationMultiplier(next);
  return { state: next, ok: true, formation };
}

// 关闭阵法：移除对应的 statusEntry
export function deactivateFormation(state: CharacterState, formationId: string): { state: CharacterState; ok: boolean; error?: string } {
  const entry = state.activeStatuses.find(s => s.id === formationId);
  if (!entry) return { state, ok: false, error: '阵法未激活' };
  // 反向应用 add 效果
  let next = applyItemEffects(state, { ...entry, effects: entry.effects.filter(e => e.operation === 'add') } as any, -1);
  // 移除 statusEntry
  next = { ...next, activeStatuses: next.activeStatuses.filter(s => s.id !== formationId) };
  next = recalcCultivationMultiplier(next);
  return { state: next, ok: true };
}

// 每岁阵法维持消耗灵石
export function tickFormations(state: CharacterState): { state: CharacterState; consumed: number } {
  const formations = state.activeStatuses.filter(s => s.name.startsWith('[阵法]'));
  if (!formations.length) return { state, consumed: 0 };
  let totalCost = 0;
  for (const f of formations) {
    // 估算消耗：根据 rarity
    const rarityCost: Record<string, number> = { common: 2, uncommon: 3, rare: 5, epic: 10, legendary: 20, mythic: 50 };
    totalCost += rarityCost[f.rarity] || 2;
  }
  if (state.spiritStones < totalCost) {
    // 灵石不足，自动关闭所有阵法
    let next = state;
    for (const f of formations) {
      next = deactivateFormation(next, f.id).state;
    }
    return { state: next, consumed: 0 };
  }
  return { state: { ...state, spiritStones: state.spiritStones - totalCost }, consumed: totalCost };
}

// ==================== Task 22: 心魔值系统 ====================

// 调整心魔值（钳制 0-100）
const FORMATION_DRAWING_ORDER: FormationDrawingStep[] = [
  'meditate', 'trace', 'infuse', 'anchor', 'activate',
];

/**
 * 根据角色境界与阵法稀有度，推导出当前可进行的绘制步骤。
 * 若角色境界不足以绘制该阵法，则返回 'meditate'（需先静心破境）。
 */
export function deriveFormationStep(
  formation: { id: string; name: string; rarity?: string; requirements?: { minRealm?: string; minComprehension?: number } },
  character: CharacterState
): FormationDrawingStep {
  const realm = (character as any).realm ?? 'mortal';
  const minRealm = formation.requirements?.minRealm ?? realm;
  const realmOrder: Record<string, number> = {
    mortal: 0, qi_refining: 1, foundation_building: 2, golden_core: 3,
    nascent_soul: 4, spirit_severing: 5, tribulation: 6, great_vehicle: 7, immortal: 8,
  };
  const charRank = realmOrder[realm] ?? 0;
  const reqRank = realmOrder[minRealm] ?? 0;
  if (charRank < reqRank) return 'meditate';
  // 境界达标，可从 meditate 起步；返回当前可进行的步骤起点
  return 'meditate';
}

/**
 * 创建一次阵法绘制会话。
 */
export function startFormationDrawing(
  character: CharacterState,
  formation: { id: string; name: string; rarity?: string; requirements?: any }
): FormationDrawingSession {
  return {
    id: `fds-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    formationId: formation.id,
    formationName: formation.name,
    characterId: (character as any).id ?? 'unknown',
    startedAge: character.age ?? 0,
    currentStep: deriveFormationStep(formation, character),
    completedSteps: [],
    materialsUsed: [],
    stepSuccessChance: 0.7,
    failureStreak: 0,
    finished: false,
    turnsSpent: 0,
  };
}

/**
 * 推进阵法绘制会话一步。`action` 是玩家选择的行动类型：
 * - 'advance': 尝试推进到下一步（按 stepSuccessChance 判定）
 * - 'restart': 失败次数过多时从头开始
 * - 'abort':   主动放弃
 */
export function resolveDrawingProgress(
  session: FormationDrawingSession,
  action: 'advance' | 'restart' | 'abort',
  rand: number = Math.random()
): FormationDrawingProgress {
  if (action === 'abort') {
    return {
      session: { ...session, finished: true, success: false },
      advanced: false,
      failed: false,
      finished: true,
      attributeChanges: [],
      narrativeHint: `${session.formationName}的绘制已被中止。`,
    };
  }
  if (action === 'restart') {
    return {
      session: {
        ...session,
        currentStep: 'meditate',
        completedSteps: [],
        failureStreak: 0,
        turnsSpent: 0,
      },
      advanced: true,
      failed: false,
      finished: false,
      attributeChanges: [],
      narrativeHint: `重新开始绘制${session.formationName}。`,
    };
  }

  // action === 'advance'
  if (session.finished) {
    return {
      session,
      advanced: false,
      failed: false,
      finished: true,
      attributeChanges: [],
    };
  }

  const success = rand < session.stepSuccessChance;
  if (!success) {
    const newStreak = session.failureStreak + 1;
    // 连续失败 3 次 → 会话失败
    if (newStreak >= 3) {
      return {
        session: { ...session, finished: true, success: false, failureStreak: newStreak },
        advanced: false,
        failed: true,
        finished: true,
        attributeChanges: [{ attribute: 'mp', delta: -30, reason: `formation-draw-fail:${session.formationId}` }],
        narrativeHint: `${session.formationName}绘制失败，灵力反噬。`,
      };
    }
    return {
      session: { ...session, failureStreak: newStreak, turnsSpent: session.turnsSpent + 1 },
      advanced: false,
      failed: true,
      finished: false,
      attributeChanges: [{ attribute: 'mp', delta: -5, reason: `formation-draw-step-fail:${session.formationId}` }],
      narrativeHint: `${session.formationName}的${session.currentStep}步骤失败，气息不稳。`,
    };
  }

  // 成功：推进到下一步
  const idx = FORMATION_DRAWING_ORDER.indexOf(session.currentStep);
  const completed = [...session.completedSteps, session.currentStep];
  const nextIdx = idx + 1;
  if (nextIdx >= FORMATION_DRAWING_ORDER.length) {
    return {
      session: {
        ...session,
        completedSteps: completed,
        currentStep: 'activate',
        finished: true,
        success: true,
        turnsSpent: session.turnsSpent + 1,
        failureStreak: 0,
      },
      advanced: true,
      failed: false,
      finished: true,
      attributeChanges: [],
      narrativeHint: `${session.formationName}绘制成功，阵法已成！`,
    };
  }
  return {
    session: {
      ...session,
      completedSteps: completed,
      currentStep: FORMATION_DRAWING_ORDER[nextIdx],
      turnsSpent: session.turnsSpent + 1,
      failureStreak: 0,
    },
    advanced: true,
    failed: false,
    finished: false,
    attributeChanges: [],
    narrativeHint: `${session.formationName}推进至${FORMATION_DRAWING_ORDER[nextIdx]}。`,
  };
}

// ---------------- AI-88: Pet Evolution ----------------

export function deriveFormationStack(formations: Array<{ id: string; value?: number; rule?: FormationStackRule; tag?: string }>): FormationStackResult {
  if (!Array.isArray(formations) || formations.length === 0) {
    return { totalEffect: 0, warnings: [], appliedRule: 'independent', winners: [] };
  }
  const rule: FormationStackRule = formations[0]?.rule ?? 'independent';
  const warnings: string[] = [];
  const winners: string[] = [];
  let total = 0;
  if (rule === 'independent') {
    total = formations.reduce((acc, f) => acc + (f.value ?? 0), 0);
    formations.forEach(f => winners.push(f.id));
  } else if (rule === 'boosted') {
    const base = formations.reduce((acc, f) => acc + (f.value ?? 0), 0);
    const mult = 1 + 0.25 * Math.max(0, formations.length - 1);
    total = base * mult;
    formations.forEach(f => winners.push(f.id));
  } else if (rule === 'conflict') {
    const base = formations.reduce((acc, f) => acc + (f.value ?? 0), 0);
    const penalty = Math.pow(0.7, Math.max(0, formations.length - 1));
    total = base * penalty;
    warnings.push('同源阵法互相削弱');
    formations.forEach(f => winners.push(f.id));
  } else if (rule === 'replace') {
    let best = formations[0];
    for (const f of formations) {
      if ((f.value ?? 0) > (best.value ?? 0)) best = f;
    }
    total = best.value ?? 0;
    winners.push(best.id);
    formations.filter(f => f.id !== best.id).forEach(f => warnings.push(`阵法 ${f.id} 被高优先级阵法 ${best.id} 替换`));
  }
  return {
    totalEffect: Math.round(total * 100) / 100,
    warnings,
    appliedRule: rule,
    winners,
  };
}

/**
 * 两个单阵之间的直接冲突判定：返回胜者 id（null = 完全抵消）。
 */
export function resolveFormationConflict(f1: { id: string; tag?: string; value?: number } | null, f2: { id: string; tag?: string; value?: number } | null): string | null {
  if (!f1 || !f2) return null;
  if (f1.tag && f2.tag && f1.tag === f2.tag) {
    return (f1.value ?? 0) >= (f2.value ?? 0) ? f1.id : f2.id;
  }
  return null;
}

// ===== AI-98: Auction AI =====
/**
 * 给定一个买家、当前物品和当前最高出价，决定他下一步动作。
 * - cautious: 仅在 newBid <= max(price * 0.9, currentBid + 1) 时出价
 * - aggressive: 直接加价 5%-15%
 * - random: 在 0.4~1.2 倍 currentBid 之间随机
 * - hostile: 抬高价格 1.3-2 倍扰乱市场
 */