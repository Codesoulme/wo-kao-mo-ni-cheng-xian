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
  ATTRIBUTE_BOUNDS,
  dbToState,
  deriveCombatProjection,
  deriveCoreCultivationAttributes,
  deriveCultivationAttributes,
  deriveRealmTraits,
  deriveSoulRealm,
  normalizeCultivationState,
} from './attributes';
import {
  getDiscoveredStoryRealms,
} from './exploration';
import {
  activeConstitutionStatuses,
} from './shared';
import {
  buildQuestEntriesFromThreads,
  generateCharacterIntents,
} from './threads';

export function summarizeConstitutionProfiles(state: CharacterState): { name: string; category: string; stage: number; maxStage: number; resonance: string[]; riskHint?: string; hooks: string[] }[] {
  return activeConstitutionStatuses(state).map(status => {
    const c = status.constitution as ConstitutionProfile;
    return {
      name: status.name,
      category: c.category,
      stage: c.currentStage || 1,
      maxStage: c.maxStage || 1,
      resonance: [
        ...(c.elementAffinity || []).map(el => `${ELEMENTS[el]?.name || el}?`),
        ...(c.techniqueKeywords || []).slice(0, 4),
      ].filter(Boolean),
      riskHint: c.riskHint,
      hooks: (c.narrativeHooks || []).slice(0, 3),
    };
  });
}




export function applySpiritualRootChange(state: CharacterState, change?: SpiritualRootChange): { state: CharacterState; applied?: AttributeChange; trace?: EffectResolveTrace } {
  if (!change || !change.spiritualRoot) return { state };
  const rootInfo = SPIRITUAL_ROOTS[change.spiritualRoot];
  if (!rootInfo) {
    return {
      state,
      trace: {
        severity: 'warning',
        code: 'invalid_spiritual_root_change',
        attribute: 'spiritualRoot',
        message: '灵根蜕变未生效：灵根类型不在天赋谱系中。',
        source: change.reason || 'ai-event',
      },
    };
  }
  const beforeRoot = state.spiritualRoot;
  const beforeMultiplier = state.rootMultiplier || 0;
  const rootDetail = String(change.rootDetail || rootInfo.name).trim().slice(0, 48) || rootInfo.name;
  let next: CharacterState = {
    ...state,
    spiritualRoot: change.spiritualRoot,
    rootDetail,
    rootMultiplier: rootInfo.multiplier,
  };
  next = normalizeCultivationState(next);
  if (beforeRoot === next.spiritualRoot && state.rootDetail === next.rootDetail) return { state: next };
  const applied: AttributeChange = {
    attribute: 'spiritualRoot',
    delta: Number((next.rootMultiplier - beforeMultiplier).toFixed(2)),
    reason: change.reason || `灵根蜕变为${rootDetail}`,
  };
  return {
    state: next,
    applied,
    trace: {
      severity: 'info',
      code: 'spiritual_root_changed',
      attribute: 'spiritualRoot',
      message: `灵根由${SPIRITUAL_ROOTS[beforeRoot]?.name || beforeRoot}蜕变为${rootDetail}。`,
      before: beforeMultiplier,
      delta: applied.delta,
      after: next.rootMultiplier,
      source: change.reason || 'ai-event',
    },
  };
}

// 天劫判定档位（修仙风味，不可外露为"算法/概率"机制词）
export function checkLifespan(state: CharacterState): { state: CharacterState; died: boolean; reason?: string } {
  if (!state.alive) return { state, died: false };
  if (state.age >= state.lifespan) {
    return {
      state: { ...state, alive: false, hp: 0, causeOfDeath: '寿元已尽，坐化于世' },
      died: true,
      reason: '寿元已尽，坐化于世',
    };
  }
  return { state, died: false };
}

// ==================== 命节点检查 ====================

export function checkFateNode(state: CharacterState): number | null {
  if (!state.alive) return null;
  for (const node of FATE_NODES) {
    if (state.fateNodes.includes(node.index)) continue;
    if (state.age >= node.triggerAge.min && state.age <= node.triggerAge.max) {
      // 检查境界是否已达到命节点境界
      const realmIdx = REALMS.findIndex(r => r.id === state.realm);
      const nodeRealmIdx = REALMS.findIndex(r => r.id === node.realm);
      if (realmIdx >= nodeRealmIdx - 1) {
        return node.index;
      }
    }
  }
  return null;
}

// ==================== 状态管理 ====================

export function addMemory(state: CharacterState, memory: string): CharacterState {
  if (!memory || !memory.trim()) return state;
  const next = [...state.longTermMemory, memory];
  // 最多保留 50 条长期记忆
  if (next.length > 50) {
    return { ...state, longTermMemory: next.slice(-50) };
  }
  return { ...state, longTermMemory: next };
}

// ==================== 标记命节点完成 ====================

export function markFateNodeDone(state: CharacterState, nodeIndex: number): CharacterState {
  if (state.fateNodes.includes(nodeIndex)) return state;
  return { ...state, fateNodes: [...state.fateNodes, nodeIndex] };
}

export function buildStateContext(
  state: CharacterState,
  recentEvents: { age: number; title: string; narrative: string; eventType?: string }[],
  narrativeContractFeedback: EngineStateContext['narrativeContractFeedback'] = [],
): EngineStateContext {
  const realmInfo = getRealmInfo(state.realm);
  const completedFateNodes = Array.isArray(state.fateNodes) ? state.fateNodes : [];
  const safePendingThreads = Array.isArray(state.pendingThreads) ? state.pendingThreads : [];
  const safeRecentEvents = Array.isArray(recentEvents) ? recentEvents : [];
  const safeActiveStatuses = Array.isArray(state.activeStatuses) ? state.activeStatuses : [];
  const safeInventory = Array.isArray(state.inventory) ? state.inventory : [];
  const safeEquipped = Array.isArray(state.equipped) ? state.equipped : [];
  const safeCultivationFactors = Array.isArray(state.cultivationFactors) ? state.cultivationFactors : [];
  const constitutionProfiles = summarizeConstitutionProfiles(state);
  const safeLongTermMemory = Array.isArray(state.longTermMemory) ? state.longTermMemory : [];
  const safeNpcs = Array.isArray(state.npcs) ? state.npcs : [];
  const safeWorldFacts = Array.isArray(state.worldFacts) ? state.worldFacts : [];
  const safeCausalGraph = state.causalGraph && Array.isArray(state.causalGraph.nodes) && Array.isArray(state.causalGraph.edges) ? state.causalGraph : { nodes: [], edges: [] };
  // 找下一个未完成的命节点
  const nextNode = FATE_NODES.find(n => !completedFateNodes.includes(n.index));
  // Task 20: 推进 urgent 线索状态（deadlineAge - age <= 3 视为 urgent）
  const threads = safePendingThreads.map(t => ({
    ...t,
    status: (t.status === 'pending' && (t.deadlineAge - state.age) <= 3) ? 'urgent' as const : t.status,
  }));
  const questEntries = buildQuestEntriesFromThreads(threads, state.age);
  state.questEntries = questEntries;
  state.narrativeContractFeedback = (narrativeContractFeedback || []).slice(-8);
  const eventSchedule = buildEventSchedulerPlan(state);
  // Task 20: 引擎根据当前处境生成角色主动意图（每岁重算）
  const intents = generateCharacterIntents(state, threads);
  state.characterIntents = intents;
  // recentEventTypes / recentBlueprintCategories 来自 dbToState 的临时闭包变量
  const recentEventTypes = (state as any)._recentEventTypes || [];
  const recentBlueprintCategories = (state as any)._recentBlueprintCategories || [];
  const coreAttrs = deriveCoreCultivationAttributes(state);
  const soulRealm = deriveSoulRealm({ ...state, ...coreAttrs });
  const realmTraits = deriveRealmTraits(state);
  const combatProjection = deriveCombatProjection({ ...state, ...coreAttrs });
  return {
    character: {
      name: state.name,
      age: state.age,
      lifespan: state.lifespan,
      gender: state.gender,
      spiritualRoot: state.spiritualRoot,
      rootDetail: state.rootDetail,
      realm: state.realm,
      realmName: realmInfo.name,
      realmLevel: state.realmLevel,
      realmMaxLevel: realmInfo.levels,
      cultivationExp: state.cultivationExp,
      expToBreak: state.expToBreak,
      elements: state.elements || { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
      hp: state.hp, maxHp: state.maxHp,
      mp: state.mp, maxMp: state.maxMp,
      attack: state.attack, defense: state.defense, speed: state.speed,
      cultivationAttributes: deriveCultivationAttributes(state),
      spiritualSense: coreAttrs.spiritualSense,
      soulStrength: coreAttrs.soulStrength,
      physicalFoundation: coreAttrs.physicalFoundation,
      combatProjection,
      soulRealmName: soulRealm.name,
      soulRealmRank: soulRealm.rank,
      soulRealmGap: soulRealm.gap,
      luck: state.luck, comprehension: state.comprehension,
      spiritStones: state.spiritStones, reputation: state.reputation,
      faction: state.faction, master: state.master, location: state.location,
      alive: state.alive, ascended: state.ascended,
      // Task 22: 心魔值——AI 可看到，可用 changes 中 attribute='heartDemon' 调整
      heartDemon: state.heartDemon ?? 0,
    },
    activeStatuses: safeActiveStatuses,
    constitutionProfiles,
    inventory: safeInventory,
    equipped: safeEquipped,
    storageCapacity: state.storageCapacity,
    cultivationMultiplier: state.cultivationMultiplier,
    cultivationInsight: state.cultivationInsight,
    cultivationFactors: safeCultivationFactors,
    recentEvents: safeRecentEvents.slice(-5).map(e => ({ age: e.age, title: e.title, narrative: e.narrative, eventType: e.eventType || 'normal' })),
    narrativeContractFeedback: (narrativeContractFeedback || []).slice(-8),
    longTermMemory: safeLongTermMemory.slice(-10),
    npcs: safeNpcs.slice(-20),
    causalGraph: {
      nodes: safeCausalGraph.nodes.slice(-30),
      edges: safeCausalGraph.edges.slice(-50),
      updatedAtAge: safeCausalGraph.updatedAtAge,
    },
    worldFacts: safeWorldFacts.slice(-40),
    eventSchedule,
    completedFateNodes,
    availableAttributes: Object.keys(ATTRIBUTE_BOUNDS),
    nextFateNode: nextNode ? { index: nextNode.index, name: nextNode.name, realm: nextNode.realm } : undefined,
    realmTraits,
    // Task 20 新字段
    pendingThreads: threads,
    questEntries,
    characterIntents: intents,
    recentEventTypes,
    recentBlueprintCategories,
    // Task 23 新字段
    pets: Array.isArray(state.pets) ? state.pets : [],
    // Task 24 新字段
    exploredRealms: Array.isArray(state.exploredRealms) ? state.exploredRealms : [],
    currentExploration: (state as any)._currentExploration,
    discoveredRealms: getDiscoveredStoryRealms(state),
  };
}

// ==================== Task 20: 事件蓝图选择 ====================

// 从蓝图池中按权重抽取一个主题，避开最近的同类分类，匹配角色境界/年龄/宗门
// Task 21 强化反重复：最近 3 次同类分类权重 ×0.1，最近 1 次同名蓝图权重 ×0（彻底跳过）
export function pickEventBlueprint(state: CharacterState, recentBlueprintCategories: string[]): EventBlueprint {
  const realmIdx = REALMS.findIndex(r => r.id === state.realm);
  const recentCats = recentBlueprintCategories.slice(-5);
  const lastCat = recentBlueprintCategories[recentBlueprintCategories.length - 1];
  const last2Cat = recentBlueprintCategories[recentBlueprintCategories.length - 2];
  // 1. 优先检查到期/紧急的 pendingThreads —— 若有，强制走 thread_resolve
  const urgentThreads = (state.pendingThreads || []).filter(t =>
    t.status === 'pending' && state.age >= t.deadlineAge - 1
  );
  if (urgentThreads.length > 0) {
    return {
      category: 'thread_resolve',
      name: '线索推进',
      description: `本轮必须推进未决线索：「${urgentThreads[0].title}」。该线索 deadlineAge=${urgentThreads[0].deadlineAge}，当前 age=${state.age}。AI 必须围绕此线索生成关键事件，要么完成它、要么推进进度、要么因错过而失败。`,
      weight: 0, minRealm: 0, maxRealm: 99, minAge: 0, maxAge: 99999,
      examples: [`${urgentThreads[0].title}：${urgentThreads[0].description}`],
    };
  }
  // 2. 否则从蓝图池筛选合适的
  const candidates = EVENT_BLUEPRINTS.filter(b => {
    if (realmIdx < b.minRealm || realmIdx > b.maxRealm) return false;
    if (state.age < b.minAge || state.age > b.maxAge) return false;
    if (b.requireFaction && !state.faction) return false;
    return true;
  });
  if (candidates.length === 0) {
    // 兜底：返回一个普通修炼主题
    return EVENT_BLUEPRINTS[0];
  }
  // 3. 加权抽取（强反重复）
  // - 最近 1 次同类蓝图：weight ×0（彻底跳过，避免连续两次同类）
  // - 最近 2-3 次同类蓝图：weight ×0.1
  // - 最近 4-5 次同类蓝图：weight ×0.4
  const weighted = candidates.map(b => {
    let w = b.weight;
    if (b.category === lastCat) w = 0;  // 上次刚用过的分类，彻底跳过
    else if (b.category === last2Cat) w *= 0.1;  // 上上次用过的，大幅降低
    else if (recentCats.includes(b.category)) w *= 0.1;
    return { blueprint: b, weight: w };
  }).filter(w => w.weight > 0);  // 过滤掉 weight=0 的
  // 若全部被过滤（极端情况：candidates 都属于 lastCat），fallback 用原 candidates
  if (weighted.length === 0) {
    // 退而求其次，只用 ×0.1 而不禁用 lastCat
    const w2 = candidates.map(b => ({
      blueprint: b,
      weight: b.category === lastCat ? b.weight * 0.1 : b.weight,
    }));
    const total = w2.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    for (const w of w2) {
      r -= w.weight;
      if (r <= 0) return w.blueprint;
    }
    return w2[0].blueprint;
  }
  const total = weighted.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of weighted) {
    r -= w.weight;
    if (r <= 0) return w.blueprint;
  }
  return weighted[0].blueprint;
}

// ==================== Task 20: 角色主动意图生成 ====================

// 引擎根据角色当前处境生成"主动意图"，AI 必须在事件中体现这些意图的执行
// 解决"角色太蠢"问题：快比赛了会主动备战、有仇敌会主动防备、灵石富余会主动淘宝等
export function applyCultivationInsight(state: CharacterState, rawInsight: string | undefined): CharacterState {
  if (!rawInsight || !rawInsight.trim()) return state;
  const cleaned = sanitizeNarrativeText(rawInsight.trim(), state.age);
  return { ...state, cultivationInsight: cleaned };
}

export function deriveBottleSpiritAffect(character: CharacterState): StatusEntry | null {
  const spirits = (character as any).bottleSpirits as BottleSpirit[] | undefined;
  if (!Array.isArray(spirits) || spirits.length === 0) return null;
  const revealed = spirits.find(s => s && s.revealed);
  if (!revealed) return null;
  return {
    id: `bottle-${revealed.spiritId}`,
    name: `瓶灵共鸣（${revealed.sourceName}）`,
    description: revealed.visibleEffect,
    category: 'special',
    rarity: 'rare',
    duration: -1,
    source: '瓶灵',
    effects: [],
  };
}

export function resolveFakeDeath(character: CharacterState, damage: number): { isFake: boolean; revealChance: number; ruleApplied: boolean } {
  const rules = ((character as any).fakeDeathRules as FakeDeathRule[] | undefined) ?? [];
  if (rules.length === 0) return { isFake: false, revealChance: 0, ruleApplied: false };
  const hpRatio = (character.hp ?? 0) / Math.max(1, character.maxHp ?? 1);
  for (const rule of rules) {
    if (rule.trigger === 'lethal' && hpRatio <= 0 && damage > 0) {
      return { isFake: true, revealChance: rule.revealChance, ruleApplied: true };
    }
    if (rule.trigger === 'low_hp' && hpRatio < 0.1) {
      return { isFake: true, revealChance: rule.revealChance, ruleApplied: true };
    }
  }
  return { isFake: false, revealChance: 0, ruleApplied: false };
}

// ===== AI-101: NPC Memory =====
/**
 * 给定 NPC + 当前事件，构造一条新的 NPCMemoryEntry。
 */