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
  alchemy,
} from './alchemy-crafting';

export function generateEntityId(prefix: string, safe?: string): string {
  if (safe && typeof safe === 'string' && safe.length > 0) {
    return prefix + '_' + safe;
  }
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function causalId(prefix: string, seed: string): string {
  const safe = String(seed || '').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_').slice(0, 48);
  return generateEntityId(prefix, safe);
}

export function normalizeCausalGraph(graph?: CausalGraph): CausalGraph {
  return {
    nodes: Array.isArray(graph?.nodes) ? graph!.nodes : [],
    edges: Array.isArray(graph?.edges) ? graph!.edges : [],
    updatedAtAge: graph?.updatedAtAge,
  };
}

export function appendCausalGraph(state: CharacterState, nodes: CausalNode[], edges: CausalEdge[]): CharacterState {
  if (!nodes.length && !edges.length) return state;
  const graph = normalizeCausalGraph(state.causalGraph);
  const nodeMap = new Map<string, CausalNode>();
  for (const node of graph.nodes) if (node?.id) nodeMap.set(node.id, node);
  for (const node of nodes) if (node?.id) nodeMap.set(node.id, node);

  const edgeMap = new Map<string, CausalEdge>();
  for (const edge of graph.edges) if (edge?.id) edgeMap.set(edge.id, edge);
  for (const edge of edges) if (edge?.id && edge.from && edge.to) edgeMap.set(edge.id, edge);

  return {
    ...state,
    causalGraph: {
      nodes: Array.from(nodeMap.values()).slice(-160),
      edges: Array.from(edgeMap.values()).slice(-240),
      updatedAtAge: state.age,
    },
  };
}

export type ActionCausalityOptions = {
  actionId: string;
  actionType: 'alchemy' | 'item' | 'trade' | 'auction' | 'formation' | 'pet' | 'combat' | 'exploration' | 'choice' | 'interference' | 'system';
  title: string;
  summary?: string;
  tags?: string[];
  newItems?: ItemEntry[];
  usedItems?: ItemEntry[];
  consumedItems?: ItemEntry[];
  removedItems?: ItemEntry[];
  equippedItems?: ItemEntry[];
  unequippedItems?: ItemEntry[];
  threads?: PendingThread[];
  statuses?: StatusEntry[];
  pets?: Pet[];
  removedPets?: Pet[];
  realms?: SecretRealm[];
};

export function recordActionCausality(state: CharacterState, opts: ActionCausalityOptions): CharacterState {
  const age = state.age;
  const actionNodeId = causalId('event', opts.actionId || opts.title || opts.actionType);
  const nodes: CausalNode[] = [{
    id: actionNodeId,
    type: opts.actionType === 'combat' ? 'combat' : opts.actionType === 'choice' ? 'choice' : 'event',
    label: opts.title || opts.actionType,
    age,
    refId: opts.actionId,
    summary: String(opts.summary || '').slice(0, 180),
    tags: [opts.actionType, ...(opts.tags || [])].filter(Boolean),
  }];
  const edges: CausalEdge[] = [];

  const addItem = (item: ItemEntry | undefined, edgeType: CausalEdge['type'], summary?: string) => {
    if (!item?.id || !item?.name) return;
    const nodeId = causalId('item', item.id);
    nodes.push({
      id: nodeId,
      type: 'item',
      label: item.name,
      age,
      refId: item.id,
      summary: item.description?.slice(0, 140),
      tags: [item.rarity, item.item_type, item.source || ''].filter(Boolean),
    });
    edges.push({
      id: causalId('edge', actionNodeId + '_' + edgeType + '_' + nodeId),
      from: actionNodeId,
      to: nodeId,
      type: edgeType,
      age,
      summary: summary || item.source || opts.title,
    });
  };

  for (const item of opts.newItems || []) addItem(item, 'rewards', '由本次行动所得');
  for (const item of opts.usedItems || []) addItem(item, 'mentions', '本次行动使用或触发');
  for (const item of opts.consumedItems || []) addItem(item, 'caused', '本次行动消耗');
  for (const item of opts.removedItems || []) addItem(item, 'caused', '本次行动移出');
  for (const item of opts.equippedItems || []) addItem(item, 'updated', '本次行动装备');
  for (const item of opts.unequippedItems || []) addItem(item, 'updated', '本次行动卸下');

  for (const thread of opts.threads || []) {
    if (!thread?.id || !thread?.title) continue;
    const nodeId = causalId('thread', thread.id);
    nodes.push({
      id: nodeId,
      type: 'thread',
      label: thread.title,
      age: thread.startAge || age,
      refId: thread.id,
      summary: (thread.followUpHint || thread.description || '').slice(0, 160),
      tags: [thread.status, thread.category].filter(Boolean),
    });
    edges.push({
      id: causalId('edge', actionNodeId + '_triggers_' + nodeId),
      from: actionNodeId,
      to: nodeId,
      type: 'triggers',
      age,
      summary: thread.followUpHint || thread.description?.slice(0, 100),
    });
  }

  for (const status of opts.statuses || []) {
    if (!status?.id || !status?.name) continue;
    const nodeId = causalId('status', status.id);
    nodes.push({
      id: nodeId,
      type: 'status',
      label: status.name,
      age,
      refId: status.id,
      summary: status.description?.slice(0, 140),
      tags: [status.category, status.rarity].filter(Boolean),
    });
    edges.push({
      id: causalId('edge', actionNodeId + '_caused_' + nodeId),
      from: actionNodeId,
      to: nodeId,
      type: 'caused',
      age,
      summary: status.description?.slice(0, 100),
    });
  }

  const addPetNode = (pet: Pet | undefined, edgeType: CausalEdge['type'], summary: string) => {
    if (!pet?.id || !pet?.name) return;
    const nodeId = causalId('pet', pet.id);
    nodes.push({
      id: nodeId,
      type: 'pet',
      label: pet.name,
      age: pet.acquiredAge || age,
      refId: pet.id,
      summary: pet.description?.slice(0, 140),
      tags: [pet.species, pet.rarity, pet.realm || ''].filter(Boolean),
    });
    edges.push({
      id: causalId('edge', actionNodeId + '_' + edgeType + '_' + nodeId),
      from: actionNodeId,
      to: nodeId,
      type: edgeType,
      age,
      summary,
    });
  };

  for (const pet of opts.pets || []) addPetNode(pet, 'created', '本次行动结缘或照料灵宠');
  for (const pet of opts.removedPets || []) addPetNode(pet, 'updated', '本次行动放归或离散灵宠');

  for (const realm of opts.realms || []) {
    if (!realm?.id || !realm?.name) continue;
    const nodeId = causalId('realm', realm.id);
    nodes.push({
      id: nodeId,
      type: 'realm',
      label: realm.name,
      age,
      refId: realm.id,
      summary: realm.description?.slice(0, 140),
      tags: [realm.tier, ...(realm.themeTags || [])].filter(Boolean),
    });
    edges.push({
      id: causalId('edge', actionNodeId + '_triggers_' + nodeId),
      from: actionNodeId,
      to: nodeId,
      type: 'triggers',
      age,
      summary: '本次行动探入或牵动此处秘境',
    });
  }

  return appendCausalGraph(state, nodes, edges);
}
