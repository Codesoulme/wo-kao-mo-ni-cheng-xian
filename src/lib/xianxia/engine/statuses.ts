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


export function isMeaningfulStatus(status: Partial<StatusEntry> | null | undefined): boolean {
  if (!status || !status.name) return false;
  const effects = Array.isArray(status.effects) ? status.effects.filter((e: any) =>
    e && e.target_attribute && e.operation && e.value !== undefined && e.value !== 0
  ) : [];
  if (effects.length > 0) return true;

  // 少数标志性状态允许无数值效果：身份、命格、线索、重大奇缘等，供 AI 后续判断使用。
  const category = status.category;
  const text = `${status.name || ''} ${status.description || ''} ${status.source || ''}`;
  if (category === 'identity' || category === 'quest') return true;
  if (category === 'special' && /身份|师承|宗门|命格|命途|奇缘|传承|血脉|体质|誓约|因果|线索|印记|称号|灵宠|契约/.test(text)) return true;
  return false;
}

export function filterMeaningfulStatuses(statuses: StatusEntry[]): StatusEntry[] {
  return (statuses || []).filter(isMeaningfulStatus).map(s => ({
    ...s,
    effects: Array.isArray(s.effects) ? s.effects.filter((e: any) =>
      e && e.target_attribute && e.operation && e.value !== undefined && e.value !== 0
    ) : [],
  }));
}

function identityRank(status: Partial<StatusEntry>): number {
  const text = `${status.name || ''} ${status.description || ''} ${status.source || ''}`;
  const lower = text.toLowerCase();
  let rank = 0;
  if (new RegExp('\u5019\u8865|\u89c1\u4e60|\u8bd5\u5f79|\u4e34\u65f6').test(text) || /candidate|trainee|temporary/.test(lower)) rank = Math.max(rank, 1);
  if (new RegExp('\u6b63\u5f0f|\u5916\u95e8|\u5185\u95e8|\u6267\u4e8b|\u771f\u4f20|\u957f\u8001|\u4f9b\u5949|\u638c\u95e8|\u5b97\u4e3b').test(text) || /formal|outer|inner|elder|master/.test(lower)) rank = Math.max(rank, 2);
  if (new RegExp('\u6b63\u5f0f').test(text) || /formal/.test(lower)) rank = Math.max(rank, 3);
  return rank;
}

function identityFamily(status: Partial<StatusEntry>): string {
  const text = `${status.name || ''} ${status.description || ''} ${status.source || ''}`;
  const lower = text.toLowerCase();
  if (new RegExp('\u6742\u5f79|\u5916\u95e8|\u5185\u95e8|\u6267\u4e8b|\u771f\u4f20|\u957f\u8001|\u4f9b\u5949|\u638c\u95e8|\u5b97\u4e3b|\u5b97\u95e8|\u5f1f\u5b50').test(text) || /sect|servant|disciple/.test(lower)) return 'sect-role';
  if (new RegExp('\u5e08\u5f92|\u5e08\u627f|\u5e08\u7236|\u5e08\u5c0a|\u5f92\u5f1f').test(text) || /lineage|teacher|apprentice/.test(lower)) return 'lineage-role';
  if (new RegExp('\u6563\u4fee').test(text) || /rogue cultivator/.test(lower)) return 'cultivator-role';
  return `identity:${String(status.name || '').replace(new RegExp('\u5019\u8865|\u89c1\u4e60|\u8bd5\u5f79|\u6b63\u5f0f|\u4e34\u65f6', 'g'), '').replace(/candidate|trainee|temporary|formal/gi, '')}`;
}

export function normalizeIdentityStatuses(statuses: StatusEntry[]): StatusEntry[] {
  const bestByFamily = new Map<string, { status: StatusEntry; idx: number; rank: number }>();
  const passthrough: { status: StatusEntry; idx: number }[] = [];
  for (const [idx, status] of (statuses || []).entries()) {
    if (status?.category !== 'identity') {
      passthrough.push({ status, idx });
      continue;
    }
    const family = identityFamily(status);
    const rank = identityRank(status);
    const existing = bestByFamily.get(family);
    if (!existing || rank > existing.rank || (rank === existing.rank && idx > existing.idx)) {
      bestByFamily.set(family, { status, idx, rank });
    }
  }
  return [...passthrough, ...bestByFamily.values().map(v => ({ status: v.status, idx: v.idx }))]
    .sort((a, b) => a.idx - b.idx)
    .map(v => v.status);
}

export function addStatuses(state: CharacterState, statuses: StatusEntry[]): CharacterState {
  const meaningful = filterMeaningfulStatuses(statuses || []);
  if (!meaningful.length) return state;
  const existingIds = new Set(state.activeStatuses.map(s => s.id));
  const existingNames = new Set(state.activeStatuses.map(s => s.name));
  const newStatuses = meaningful.filter(s => !existingIds.has(s.id) && !existingNames.has(s.name));
  return { ...state, activeStatuses: normalizeIdentityStatuses([...state.activeStatuses, ...newStatuses]) };
}

export function tickStatusDurations(state: CharacterState): CharacterState {
  // 每过一岁，持续状态 duration -1
  const ticked = state.activeStatuses.map(s => ({
    ...s,
    duration: s.duration === -1 ? -1 : s.duration - 1,
  }));
  const alive = ticked.filter(s => s.duration === -1 || s.duration > 0);
  return { ...state, activeStatuses: normalizeIdentityStatuses(filterMeaningfulStatuses(alive)) };
}

// 每岁自然恢复：身体与灵息会自行回转，但只恢复少量。
// 大型事件/战斗/伤势叙事仍由 AI 处理，AI 可额外生成调息、疗伤、求药等事件。
export function tickNaturalRecovery(state: CharacterState): CharacterState {
  if (!state.alive) return state;
  const hpMissing = Math.max(0, state.maxHp - state.hp);
  const mpMissing = Math.max(0, state.maxMp - state.mp);
  const hpRegen = hpMissing > 0 ? Math.max(1, Math.floor(state.maxHp * 0.08)) : 0;
  const mpRegen = mpMissing > 0 ? Math.max(1, Math.floor(state.maxMp * 0.12)) : 0;
  return {
    ...state,
    hp: Math.min(state.maxHp, state.hp + hpRegen),
    mp: Math.min(state.maxMp, state.mp + mpRegen),
  };
}

// ==================== 物品管理 ====================


export function ensureUniqueIds(statuses: StatusEntry[], items: ItemEntry[]): { statuses: StatusEntry[]; items: ItemEntry[] } {
  const usedIds = new Set<string>();
  const fixStatuses = statuses.map(s => {
    let id = s.id || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    while (usedIds.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 6)}`;
    usedIds.add(id);
    return { ...s, id };
  });
  const fixItems = items.map(it => {
    let id = it.id || `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    while (usedIds.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 6)}`;
    usedIds.add(id);
    return { ...it, id };
  });
  return { statuses: fixStatuses, items: fixItems };
}

// ==================== Task 21: 阵法系统 ====================

// 阵法激活：从阵盘物品创建 Formation 并作为 statusEntry 加入角色
// 阵盘物品本身不消耗，但激活后每岁消耗灵石维持
export function deriveStatusExpiry(status: StatusEntry & Partial<StatusExpiryMeta>, currentAge: number): number | null {
  if (!status) return null;
  const meta = (status as any).expiryMeta as StatusExpiryMeta | undefined;
  const rule = meta?.rule;
  if (rule === 'years') {
    const remain = typeof meta?.remaining === 'number' ? meta.remaining : Math.max(0, status.duration ?? 0);
    return Math.floor(currentAge) + remain;
  }
  if (rule === 'turns' || rule === 'condition' || rule === 'event') {
    return null;
  }
  return null;
}

/**
 * 跑一次 status 移除：按 expiresAge / duration / rule 自动剔除到期状态，
 * 返回新的 CharacterState（不修改原对象）。
 */
export function resolveStatusRemoval(character: CharacterState, currentAge?: number): CharacterState {
  const age = typeof currentAge === 'number' ? currentAge : character.age;
  const list = Array.isArray(character.statuses) ? character.statuses : [];
  const kept: StatusEntry[] = [];
  for (const s of list) {
    if (!s) continue;
    const meta = (s as any).expiryMeta as StatusExpiryMeta | undefined;
    if (meta?.rule === 'years') {
      const expireAge = deriveStatusExpiry(s as any, age);
      if (typeof expireAge === 'number' && age >= expireAge) continue;
    } else if (typeof s.duration === 'number' && s.duration === 0) {
      continue;
    }
    kept.push(s);
  }
  return { ...character, statuses: kept } as CharacterState;
}

// ===== AI-95: Pet Cultivation =====