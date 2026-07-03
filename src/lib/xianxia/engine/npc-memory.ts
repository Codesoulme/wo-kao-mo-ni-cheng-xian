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
  buildEmptySectGraph,
} from './sect';
import {
  safeStringArray,
} from './shared';

export function deriveNPCMemoryUpdate(npc: { id: string; name?: string }, event: { summary: string; importance?: number; kind?: NPCMemoryEntry['kind'] }, currentAge: number): NPCMemoryEntry {
  return {
    npcId: npc?.id ?? '',
    eventSummary: event?.summary ?? '',
    importance: typeof event?.importance === 'number' ? Math.max(0, Math.min(100, event.importance)) : 50,
    age: typeof currentAge === 'number' ? currentAge : 0,
    kind: event?.kind ?? 'interaction',
  };
}

/**
 * 给定 NPC 的全部记忆，按 importance 衰减 + 加权，给出一条行为暗示。
 */
export function deriveNPCBehavior(npc: { id: string; memories?: NPCMemoryEntry[] }, memories?: NPCMemoryEntry[]): string {
  const list = (memories ?? npc?.memories ?? []) as NPCMemoryEntry[];
  if (!Array.isArray(list) || list.length === 0) return '中性观望';
  const total = list.reduce((acc, m) => acc + (m?.importance ?? 0), 0);
  if (total === 0) return '中性观望';
  const betrayal = list.filter(m => m.kind === 'betrayal').length;
  const kindness = list.filter(m => m.kind === 'kindness').length;
  if (betrayal >= kindness + 1) return '怀恨备忌';
  if (kindness >= betrayal + 1) return '心怀善意';
  return '依事缓决';
}

// ===== AI-103: World Rumor =====
/**
 * 给定一个事件 + 区域，判断是否应该产生一条传闻；返回 null 表示不应产生。
 */
function clampNpcValence(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

function normalizeNpcMemoryTier(value: unknown): NPCMemoryTier {
  const allowed: NPCMemoryTier[] = ['trivial', 'notable', 'significant', 'core', 'defining'];
  const found = allowed.find(t => t === value);
  return found || 'notable';
}

function generateNpcMemoryId(npcId: string, age: number, summary: string): string {
  const safeNpc = String(npcId || 'npc').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'npc';
  const safeSummary = String(summary || '').slice(0, 24).replace(/[^a-zA-Z0-9_]/g, '');
  return `npcmem_${safeNpc}_${Math.max(0, Math.floor(Number(age) || 0))}_${safeSummary}_${Math.random().toString(36).slice(2, 8)}`;
}


const NPC_MEMORY_TIER_WEIGHT: Record<NPCMemoryTier, number> = {
  trivial: 1,
  notable: 2,
  significant: 4,
  core: 7,
  defining: 12,
};

const NPC_MEMORY_TIER_LABEL: Record<NPCMemoryTier, string> = {
  trivial: '琐事',
  notable: '旁注',
  significant: '要事',
  core: '心结',
  defining: '执念',
};

/**
 * AI-H311: build a normalized NPCMemory record from incoming raw memory + character + event.
 * The character and event objects are loosely typed to allow AI prompts or other
 * callers to pass in just the fields they have on hand. The returned record
 * carries a deterministic-ish id, a clamped valence, and unique-only refs.
 */
export function recordNPCMemory(
  memory: Partial<NPCMemory> | null | undefined,
  character: { id?: string; age?: number; name?: string } | null | undefined,
  event: { summary?: string; tier?: NPCMemoryTier; emotionalValence?: number; involvedCharacterIds?: string[]; worldFactIds?: string[]; evidenceThreadIds?: string[] } | null | undefined,
): NPCMemory {
  const npcId = String(memory?.npcId || character?.id || 'npc_unknown');
  const ageCandidate = memory?.age ?? character?.age ?? 0;
  const age = Math.max(0, Math.floor(Number(ageCandidate) || 0));
  const summary = String(memory?.summary ?? event?.summary ?? '').trim().slice(0, 240);
  const tier = normalizeNpcMemoryTier(memory?.tier ?? event?.tier);
  const emotionalValence = clampNpcValence(memory?.emotionalValence ?? event?.emotionalValence ?? 0);
  const involvedCharacterIds = (() => {
    if (Array.isArray(memory?.involvedCharacterIds)) return safeStringArray(memory?.involvedCharacterIds);
    if (Array.isArray(event?.involvedCharacterIds)) return safeStringArray(event?.involvedCharacterIds);
    const auto = [character?.id, memory?.npcId, event && (event as any).characterId].filter(x => x != null && String(x).length > 0).map(x => String(x));
    return safeStringArray(auto);
  })();
  const worldFactIds = safeStringArray(memory?.worldFactIds ?? event?.worldFactIds);
  const evidenceThreadIds = safeStringArray(memory?.evidenceThreadIds ?? event?.evidenceThreadIds);
  const id = String(memory?.id || '').trim() || generateNpcMemoryId(npcId, age, summary || event?.summary || 'memory');
  return { id, npcId, age, summary, tier, emotionalValence, involvedCharacterIds, worldFactIds, evidenceThreadIds };
}

/**
 * AI-H312: collapse a list of NPCMemory into one NPCMemoryCluster.
 * Dominant tier = the tier with the largest weighted footprint
 * (each memory contributes tier weight). Defining trait is a short
 * Chinese label derived from the dominant tier + valence sign.
 */
export function clusterNPCMemories(memories: NPCMemory[] | null | undefined, npcIdHint?: string): NPCMemoryCluster {
  const list = Array.isArray(memories) ? memories.filter(m => m && typeof m === 'object') : [];
  const npcId = String(list[0]?.npcId || npcIdHint || 'npc_unknown');
  const tierScores: Record<NPCMemoryTier, number> = { trivial: 0, notable: 0, significant: 0, core: 0, defining: 0 };
  let lastAge = 0;
  for (const m of list) {
    tierScores[m.tier] = (tierScores[m.tier] || 0) + NPC_MEMORY_TIER_WEIGHT[m.tier];
    if (typeof m.age === 'number' && m.age > lastAge) lastAge = m.age;
  }
  let dominantTier: NPCMemoryTier = 'notable';
  let best = -1;
  for (const t of Object.keys(tierScores) as NPCMemoryTier[]) {
    if (tierScores[t] > best) { best = tierScores[t]; dominantTier = t; }
  }
  const avgValence = list.length === 0
    ? 0
    : list.reduce((acc, m) => acc + (typeof m.emotionalValence === 'number' ? m.emotionalValence : 0), 0) / list.length;
  const tone = avgValence > 0.2 ? '亲善' : avgValence < -0.2 ? '敌视' : '中立';
  const definingTrait = `${NPC_MEMORY_TIER_LABEL[dominantTier]} · ${tone}`;
  return {
    npcId,
    memories: list.slice(0, 200),
    dominantTier,
    definingTrait,
    lastInteractionAge: lastAge,
  };
}

/**
 * AI-H313: apply decay rules. Trivial memories older than `trivialDecayYears`
 * are dropped. Older low-tier memories are downgraded one tier. Higher-tier
 * memories survive but their summary is preserved as-is. The function never
 * mutates the input cluster and never changes the npcId.
 */
export function decayNPCMemories(cluster: NPCMemoryCluster | null | undefined, currentAge: number, options?: { trivialDecayYears?: number; downgradeYears?: number }): NPCMemoryCluster {
  if (!cluster || typeof cluster !== 'object') {
    return { npcId: 'npc_unknown', memories: [], dominantTier: 'notable', definingTrait: '琐事 · 中立', lastInteractionAge: 0 };
  }
  const trivialDecayYears = Math.max(1, Math.floor(Number(options?.trivialDecayYears ?? 8)));
  const downgradeYears = Math.max(1, Math.floor(Number(options?.downgradeYears ?? 20)));
  const current = Math.max(0, Math.floor(Number(currentAge) || 0));
  const tierOrder: NPCMemoryTier[] = ['trivial', 'notable', 'significant', 'core', 'defining'];
  const downgrade = (t: NPCMemoryTier): NPCMemoryTier => {
    const i = tierOrder.indexOf(t);
    if (i <= 0) return t;
    return tierOrder[i - 1];
  };
  const retained: NPCMemory[] = [];
  for (const m of cluster.memories || []) {
    if (!m) continue;
    const ageGap = current - (typeof m.age === 'number' ? m.age : 0);
    if (m.tier === 'trivial' && ageGap >= trivialDecayYears) continue;
    if (ageGap >= downgradeYears && (m.tier === 'notable' || m.tier === 'significant')) {
      retained.push({ ...m, tier: downgrade(m.tier) });
    } else {
      retained.push(m);
    }
  }
  return clusterNPCMemories(retained, cluster.npcId);
}

/**
 * AI-H314: derive friendly/hostile/neutral weights and a one-line hint
 * from the memory cluster. Weights are normalized so they sum to 1.0.
 * actionHint is a Chinese short sentence usable directly in narrative prompts.
 */
export function deriveNPCBehaviorFromMemory(cluster: NPCMemoryCluster | null | undefined, character: { age?: number; realm?: string; faction?: string } | null | undefined): NPCBehaviorInfluence {
  const list = cluster?.memories || [];
  const characterAge = Math.max(0, Math.floor(Number(character?.age) || 0));
  const recencyBoost = (m: NPCMemory) => {
    const ageGap = Math.max(0, characterAge - (typeof m.age === 'number' ? m.age : 0));
    return Math.max(0.4, 1.2 - ageGap * 0.05);
  };
  let friendly = 0;
  let hostile = 0;
  let neutral = 0;
  for (const m of list) {
    const w = NPC_MEMORY_TIER_WEIGHT[m.tier] * recencyBoost(m);
    const v = typeof m.emotionalValence === 'number' ? m.emotionalValence : 0;
    if (v > 0.15) friendly += w * v;
    else if (v < -0.15) hostile += w * -v;
    else neutral += w * (1 - Math.abs(v));
  }
  const total = friendly + hostile + neutral;
  const safeTotal = total > 0 ? total : 1;
  const friendlyWeight = +(friendly / safeTotal).toFixed(3);
  const hostileWeight = +(hostile / safeTotal).toFixed(3);
  const neutralWeight = +(neutral / safeTotal).toFixed(3);
  let actionHint = '保持距离观察';
  if (friendlyWeight >= 0.55 && friendly > hostile) actionHint = '主动示好，追寻旧日善意';
  else if (hostileWeight >= 0.45 && hostile > friendly) actionHint = '戒备森严，提防旧怨复发';
  else if (list.length === 0) actionHint = '无记忆，留待初次接触';
  else if (friendlyWeight > hostileWeight) actionHint = '略有好感，可试探亲近';
  else if (hostileWeight > friendlyWeight) actionHint = '心有隔阂，不宜贸然接近';
  else actionHint = '态度暧昧，依眼前形势而定';
  return { friendlyWeight, hostileWeight, neutralWeight, actionHint };
}

/**
 * AI-H315: produce a compact Chinese summary suitable for AI prompt injection.
 * Respects charLimit by trimming summary fields proportionally.
 */
export function summarizeNPCForPrompt(cluster: NPCMemoryCluster | null | undefined, charLimit?: number): string {
  if (!cluster || !Array.isArray(cluster.memories) || cluster.memories.length === 0) return '（无记忆）';
  const limit = Math.max(40, Math.floor(Number(charLimit) || 240));
  const tierLabel = NPC_MEMORY_TIER_LABEL[cluster.dominantTier] || '旁注';
  const defining = cluster.definingTrait || '琐事 · 中立';
  const lastAge = cluster.lastInteractionAge;
  const lines: string[] = [];
  lines.push(`NPC#${cluster.npcId}·${tierLabel}档·${defining}`);
  if (lastAge > 0) lines.push(`近一次互动于${lastAge}岁`);
  const tierOrder: NPCMemoryTier[] = ['defining', 'core', 'significant', 'notable', 'trivial'];
  const sorted = [...cluster.memories].sort((a, b) => {
    const ai = tierOrder.indexOf(a.tier);
    const bi = tierOrder.indexOf(b.tier);
    if (ai !== bi) return ai - bi;
    return (b.age || 0) - (a.age || 0);
  });
  const picked = sorted.slice(0, 5);
  for (const m of picked) {
    const valenceTag = m.emotionalValence > 0.2 ? '亲' : m.emotionalValence < -0.2 ? '敌' : '中';
    const summary = String(m.summary || '').slice(0, 48);
    lines.push(`[${NPC_MEMORY_TIER_LABEL[m.tier]}|${valenceTag}]${summary}`);
  }
  let out = lines.join('；');
  if (out.length > limit) out = out.slice(0, Math.max(40, limit - 1)) + '…';
  return out;
}


// ==================== Phase-H Worker A: Sect Relation Graph ====================
// AI-H301~H304: 5 export functions, additive only.
// ---------------------------------------------------------------------------

/**
 * AI-H301 buildEmptySectGraph
 * 构造一个空的 SectRelationGraph 快照。
 * 默认 lastUpdatedAge === currentAge === 0；不持有外部状态。
 */