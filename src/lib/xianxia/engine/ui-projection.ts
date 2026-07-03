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


export interface PlayerUISlotEntry {
  slot: string;
  displayLabel: string;
  description: string;
  tone: 'good' | 'neutral' | 'danger' | 'mystery';
  priority: number;
  renderHint: 'card' | 'meter' | 'chip' | 'timeline' | 'list';
  sourceKind: string;
  sourceId: string;
  category: string;
  displayGroup: string;
}

export interface PlayerUIProjection {
  kind: string;
  slots: PlayerUISlotEntry[];
  primarySlot: PlayerUISlotEntry | null;
  narrative: string;
}

function _kbSafeTone(t: any): 'good' | 'neutral' | 'danger' | 'mystery' {
  return t === 'good' || t === 'danger' || t === 'mystery' ? t : 'neutral';
}

function _kbSafeRenderHint(h: any): 'card' | 'meter' | 'chip' | 'timeline' | 'list' {
  return h === 'meter' || h === 'chip' || h === 'timeline' || h === 'list' ? h : 'card';
}

function _kbClampPriority(p: any): number {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(10, Math.floor(p)));
}

function _kbDescribeSectPhase(p: string): string {
  if (p === 'founding') return '草创';
  if (p === 'growth') return '中兴';
  if (p === 'peak') return '鼎盛';
  if (p === 'decline') return '式微';
  if (p === 'refuge') return '遗脉';
  return '蛰伏';
}

function _kbDescribeEndingArchetype(a: string): string {
  if (a === 'ascend-immortal') return '飞升成仙';
  if (a === 'sit-death') return '坐化陨落';
  if (a === 'fall-demonic') return '堕入魔道';
  if (a === 'found-sect') return '开宗立派';
  if (a === 'reincarnate') return '转世轮回';
  if (a === 'escape-world') return '超脱此界';
  if (a === 'world-collapse') return '世界崩解';
  return '归于凡尘';
}

function _kbMakeSlot(
  slot: string,
  displayLabel: string,
  description: string,
  tone: 'good' | 'neutral' | 'danger' | 'mystery',
  priority: number,
  renderHint: 'card' | 'meter' | 'chip' | 'timeline' | 'list',
  sourceKind: string,
  sourceId: string,
  category: string,
  displayGroup: string,
): PlayerUISlotEntry {
  return {
    slot,
    displayLabel,
    description,
    tone: _kbSafeTone(tone),
    priority: _kbClampPriority(priority),
    renderHint: _kbSafeRenderHint(renderHint),
    sourceKind,
    sourceId,
    category,
    displayGroup,
  };
}

/**
 * Phase-K B / k-611: project inheritance into UI slots.
 * Renders current heir, active claims, lost techniques into a panel.
 */
export function projectInheritanceForUI(
  character: { id?: string; age?: number; realm?: string; master?: string; faction?: string } | null | undefined,
  inheritanceChain: any | null | undefined,
): PlayerUIProjection {
  const ch = character && typeof character === 'object' ? character : {};
  const chain = inheritanceChain && typeof inheritanceChain === 'object' ? inheritanceChain : null;
  const slots: PlayerUISlotEntry[] = [];

  if (chain) {
    const generations = Array.isArray(chain.generations) ? chain.generations : [];
    if (generations.length > 0) {
      const last = generations[generations.length - 1];
      const label = `上一代传承 · ${typeof last.characterId === 'string' ? last.characterId : '未知'}`;
      slots.push(_kbMakeSlot(
        'topTags', '传承信物', label,
        'mystery', 5, 'chip',
        'inheritance', typeof last.characterId === 'string' ? last.characterId : 'unknown',
        'inheritance', 'topTags',
      ));
    }
    const activeClaims = Array.isArray(chain.activeClaims) ? chain.activeClaims : [];
    if (activeClaims.length > 0) {
      slots.push(_kbMakeSlot(
        'threadPage', '未了结继承线索', `${activeClaims.length} 条待了结`,
        'danger', 7, 'list',
        'inheritance', 'active-claims',
        'inheritance', 'threadPage',
      ));
    }
    const lostTech = Array.isArray(chain.lostTechniques) ? chain.lostTechniques : [];
    if (lostTech.length > 0) {
      slots.push(_kbMakeSlot(
        'characterDetail', '上一代遗产', `${lostTech.length} 项失落传承记录`,
        'neutral', 4, 'card',
        'inheritance', 'lost-tech',
        'inheritance', 'characterDetail',
      ));
    }
  }

  if (typeof ch.master === 'string' && ch.master) {
    slots.push(_kbMakeSlot(
      'topTags', '师承', ch.master,
      'good', 6, 'chip',
      'character', 'master',
      'identity', 'topTags',
    ));
  }

  const narrative = chain
    ? `审视自身的传承谱系，已知 ${slots.length} 项可投影。`
    : '尚无传承谱系可投影。';
  return {
    kind: 'inheritance',
    slots,
    primarySlot: slots[0] || null,
    narrative,
  };
}

/**
 * Phase-K B / k-612: project sect trajectory into UI slots.
 */
export function projectSectTrajectoryForUI(
  character: any,
  sectState: any,
): PlayerUIProjection {
  const ch = character && typeof character === 'object' ? character : {};
  const ss = sectState && typeof sectState === 'object' ? sectState : null;
  const slots: PlayerUISlotEntry[] = [];

  if (ss) {
    if (typeof ss.phase === 'string') {
      slots.push(_kbMakeSlot(
        'characterDetail', '宗门阶段', _kbDescribeSectPhase(ss.phase),
        'neutral', 6, 'card',
        'sect', 'phase',
        'sect', 'characterDetail',
      ));
    }
    if (typeof ss.currentPower === 'number') {
      slots.push(_kbMakeSlot(
        'statusPage', '宗门实力', `${Math.round(ss.currentPower * 100)}/100`,
        ss.currentPower > 0.6 ? 'good' : (ss.currentPower < 0.3 ? 'danger' : 'neutral'),
        7, 'meter',
        'sect', 'power',
        'sect', 'statusPage',
      ));
    }
    if (ss.dangerImminent === true) {
      slots.push(_kbMakeSlot(
        'topTags', '宗门危机', '近期将有重大危机',
        'danger', 9, 'chip',
        'sect', 'danger',
        'sect', 'topTags',
      ));
    }
    const history = Array.isArray(ss.history) ? ss.history : [];
    if (history.length > 0) {
      slots.push(_kbMakeSlot(
        'threadPage', '宗门大事', `${history.length} 件往事可循`,
        'mystery', 3, 'timeline',
        'sect', 'history',
        'sect', 'threadPage',
      ));
    }
  }

  if (typeof ch.faction === 'string' && ch.faction) {
    slots.push(_kbMakeSlot(
      'topTags', '所属宗门', ch.faction,
      'good', 8, 'chip',
      'character', 'faction',
      'identity', 'topTags',
    ));
  }

  const narrative = ss
    ? `感怀宗门兴衰轨迹，可投影 ${slots.length} 项。`
    : '尚无宗门轨迹可投影。';
  return {
    kind: 'sect-trajectory',
    slots,
    primarySlot: slots[0] || null,
    narrative,
  };
}

/**
 * Phase-K B / k-613: project fate echoes into UI slots.
 */
export function projectFateEchoForUI(
  character: any,
  fateEchoes: any,
): PlayerUIProjection {
  const ch = character && typeof character === 'object' ? character : {};
  const echoes = Array.isArray(fateEchoes) ? fateEchoes : [];
  const slots: PlayerUISlotEntry[] = [];

  if (echoes.length > 0) {
    const resolved = echoes.filter((e: any) => e && e.resolved === true).length;
    const pending = echoes.length - resolved;
    slots.push(_kbMakeSlot(
      'worldLegacy', '命运网密度', `${resolved} 已了 / ${pending} 待了`,
      pending > resolved ? 'danger' : 'good',
      7, 'meter',
      'fate', 'density',
      'fate', 'worldLegacy',
    ));
    if (resolved > 0) {
      slots.push(_kbMakeSlot(
        'threadPage', '已触发回响', `${resolved} 桩因果已落定`,
        'good', 5, 'timeline',
        'fate', 'resolved',
        'fate', 'threadPage',
      ));
    }
    const pendingList = echoes.filter((e: any) => e && e.resolved !== true);
    if (pendingList.length > 0) {
      slots.push(_kbMakeSlot(
        'topTags', '未触发回响', `${pendingList.length} 桩仍悬而未决`,
        'mystery', 8, 'chip',
        'fate', 'pending',
        'fate', 'topTags',
      ));
    }
    const linkedThreads = echoes.filter((e: any) => e && e.linkedThreadId);
    if (linkedThreads.length > 0) {
      slots.push(_kbMakeSlot(
        'characterDetail', '串接线索', `${linkedThreads.length} 条命运线索与现有牵挂相连`,
        'neutral', 4, 'card',
        'fate', 'links',
        'fate', 'characterDetail',
      ));
    }
  }

  const narrative = echoes.length > 0
    ? `回望自身命途，已布下 ${echoes.length} 道因果。`
    : '尚无命运回响可投影。';
  return {
    kind: 'fate-echo',
    slots,
    primarySlot: slots[0] || null,
    narrative,
  };
}

/**
 * Phase-K B / k-614: project ending tilt into UI slots.
 */
export function projectEndingForUI(
  character: any,
  worldState: any,
): PlayerUIProjection {
  const ch = character && typeof character === 'object' ? character : {};
  const ws = worldState && typeof worldState === 'object' ? worldState : null;
  const slots: PlayerUISlotEntry[] = [];

  if (ws) {
    const endings = Array.isArray(ws.possibleEndings) ? ws.possibleEndings : [];
    if (endings.length > 0) {
      slots.push(_kbMakeSlot(
        'characterDetail', '可达结局', endings.length > 0
          ? endings.slice(0, 3).map((e: any) => _kbDescribeEndingArchetype(typeof e.archetype === 'string' ? e.archetype : '')).join('、')
          : '尚无',
        'mystery', 6, 'card',
        'ending', 'possible',
        'ending', 'characterDetail',
      ));
    }
    const fixed = Array.isArray(ws.fixedEndings) ? ws.fixedEndings : [];
    if (fixed.length > 0) {
      slots.push(_kbMakeSlot(
        'threadPage', '已定结局', `${fixed.length} 项结局已成定数`,
        'neutral', 5, 'timeline',
        'ending', 'fixed',
        'ending', 'threadPage',
      ));
    }
    const irreversible = Array.isArray(ws.irreversibleChoices) ? ws.irreversibleChoices : [];
    if (irreversible.length > 0) {
      slots.push(_kbMakeSlot(
        'topTags', '不可逆成本', `${irreversible.length} 项选择已无法回退`,
        'danger', 9, 'chip',
        'ending', 'irreversible',
        'ending', 'topTags',
      ));
    }
    if (typeof ws.endgameMeter === 'number') {
      slots.push(_kbMakeSlot(
        'statusPage', '可达性', `${Math.round(ws.endgameMeter * 100)}/100`,
        ws.endgameMeter > 0.7 ? 'good' : 'neutral',
        4, 'meter',
        'ending', 'meter',
        'ending', 'statusPage',
      ));
    }
  }

  const narrative = ws
    ? `远眺结局之崖，可投影 ${slots.length} 项。`
    : '尚无结局倾向可投影。';
  return {
    kind: 'ending',
    slots,
    primarySlot: slots[0] || null,
    narrative,
  };
}
