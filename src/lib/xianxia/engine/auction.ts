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


export function deriveBidderAction(bidder: { id: string; assets?: number; personality?: BidderPersonality; valuation?: number }, item: { basePrice?: number; valuation?: number }, currentBid: number): BidderAction {
  const personality: BidderPersonality = bidder?.personality ?? 'cautious';
  const assetCap = typeof bidder?.assets === 'number' ? bidder.assets : 1000;
  const itemVal = item?.valuation ?? item?.basePrice ?? currentBid;
  const seed = (bidder?.id?.length ?? 1) + (currentBid || 0);
  const roll = (((seed * 1103515245 + 12345) >> 0) % 1000) / 1000;
  const inc = (currentBid || itemVal) * (0.05 + roll * 0.1);

  switch (personality) {
    case 'cautious': {
      const ceiling = itemVal * 0.9;
      const next = (currentBid || 0) + inc;
      if (next <= ceiling && next <= assetCap) return { bidderId: bidder.id, kind: 'bid', newBid: Math.round(next), reason: '谨慎加价' };
      return { bidderId: bidder.id, kind: 'pass', reason: '超出心理价位' };
    }
    case 'aggressive': {
      const next = Math.max((currentBid || 0) + inc * 1.5, (currentBid || 0) * 1.05);
      if (next <= assetCap) return { bidderId: bidder.id, kind: 'bid', newBid: Math.round(next), reason: '激进抬价' };
      return { bidderId: bidder.id, kind: 'pass', reason: '资金见底' };
    }
    case 'random': {
      const range = (itemVal || 100) * (0.4 + roll * 0.8);
      const next = Math.max(currentBid + 1, Math.round(range));
      if (next <= assetCap) return { bidderId: bidder.id, kind: 'bid', newBid: next, reason: '随机出价' };
      return { bidderId: bidder.id, kind: 'pass' };
    }
    case 'hostile': {
      const next = Math.round((currentBid || itemVal) * (1.3 + roll * 0.7));
      if (next <= assetCap * 1.5) return { bidderId: bidder.id, kind: 'hostile', newBid: next, reason: '恶意抬价' };
      return { bidderId: bidder.id, kind: 'hostile', reason: '搅局离场' };
    }
    default:
      return { bidderId: bidder?.id ?? '', kind: 'pass' };
  }
}

/**
 * 收摊：找出最终胜者与成交价。
 * drama 字段是叙事层使用的"场上波澜"短句（如"最终被冷面商行抢得"）。
 */
export function resolveAuctionEnd(auction: { lots: Array<{ item: ItemEntry; startingPrice: number; seller: string }>; bidders: Array<{ id: string; personality?: BidderPersonality; assets?: number; valuation?: number }> }): { winner: string | null; finalPrice: number; drama: string } {
  if (!auction || !Array.isArray(auction.lots) || auction.lots.length === 0) {
    return { winner: null, finalPrice: 0, drama: '场中无人应价' };
  }
  const lot = auction.lots[0];
  let currentBid = lot.startingPrice;
  let winner: string | null = null;
  for (const b of auction.bidders) {
    const action = deriveBidderAction(
      { id: b.id, personality: b.personality, assets: b.assets, valuation: b.valuation },
      { basePrice: lot.startingPrice, valuation: b.valuation ?? lot.startingPrice },
      currentBid,
    );
    if ((action.kind === 'bid' || action.kind === 'hostile') && typeof action.newBid === 'number' && action.newBid > currentBid) {
      currentBid = action.newBid;
      winner = b.id;
    }
  }
  const drama = winner
    ? `最终被${winner}以${currentPrice(currentBid)}灵石抢得`
    : '场中无人应价';
  return { winner, finalPrice: currentBid, drama };
}

function currentPrice(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}千`;
  if (n >= 100) return `${Math.round(n / 100)}百`;
  return `${n}`;
}

// ===== AI-99: Thread Chain =====
/**
 * 给定一条线索 id + 全部线索，按 parentThreadId 反推出整条祖辈链。
 * 返回从根到当前节点的节点数组；找不到根时只返回当前节点（深度 0）。
 */
export function deriveBidderProfile(
  bidder: { id: string; assets?: number; personality?: string; valuation?: number; name?: string },
  item: { basePrice?: number; valuation?: number; rarity?: string },
): BidderBehaviorProfile {
  const assets = typeof bidder?.assets === 'number' ? bidder.assets : 1000;
  const itemVal = item?.valuation ?? item?.basePrice ?? 100;
  const rarity = item?.rarity ?? 'common';
  const idLower = (bidder?.id ?? '').toLowerCase();
  const nameLower = (bidder?.name ?? '').toLowerCase();
  const personality = bidder?.personality ?? 'cautious';

  let archetype: BidderArchetype;
  let aggressive = false;
  let hostile = false;
  if (/elder|长老|前辈|old/.test(idLower + nameLower)) {
    archetype = 'wealthy-elder';
    aggressive = assets > itemVal * 2;
    hostile = personality === 'hostile';
  } else if (/young|少年|热血|hot|junior/.test(idLower + nameLower) || personality === 'aggressive') {
    archetype = 'hot-blooded-young';
    aggressive = true;
    hostile = false;
  } else if (/scheme|算计|深沉|cunning/.test(idLower + nameLower)) {
    archetype = 'scheming-cultivator';
    aggressive = personality === 'aggressive';
    hostile = personality === 'hostile';
  } else if (/shadow|影|暗|hidden/.test(idLower + nameLower)) {
    archetype = 'shadow-bidder';
    aggressive = false;
    hostile = true;
  } else {
    archetype = 'casual-pilgrim';
    aggressive = false;
    hostile = false;
  }

  const wealthFactor: Record<BidderArchetype, number> = {
    'wealthy-elder': 1.8,
    'hot-blooded-young': 1.3,
    'scheming-cultivator': 1.4,
    'casual-pilgrim': 0.8,
    'shadow-bidder': 1.0,
  };
  const wealth = Math.round(assets * wealthFactor[archetype]);
  const rarityBoost =
    rarity === 'legendary' || rarity === 'mythic'
      ? 1.5
      : rarity === 'epic'
        ? 1.25
        : 1;
  const maxBid = Math.round(
    itemVal * (personality === 'hostile' ? 2 : 1.1) * rarityBoost,
  );
  return { archetype, wealth, maxBid, aggressive, hostile };
}

/**
 * AI-G114: Simulate one auction round given multiple bidder profiles.
 * Returns winner (archetype or null), finalPrice, drama line, postAuctionEvents[].
 */
export function simulateBiddingRound(
  round: { currentBid: number; roundIndex: number },
  item: { id: string; name: string; basePrice: number; rarity?: string },
  profiles: BidderBehaviorProfile[],
): { winner: BidderArchetype | null; finalPrice: number; drama: string; postAuctionEvents: string[] } {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return {
      winner: null,
      finalPrice: round?.currentBid ?? 0,
      drama: '无人应价',
      postAuctionEvents: ['no_bidder'],
    };
  }
  const startBid = Math.max(round?.currentBid ?? 0, item.basePrice ?? 0);
  let current = startBid;
  let winner: BidderArchetype | null = null;
  const events: string[] = [];
  for (const p of profiles) {
    if (current >= p.maxBid) {
      events.push(`${p.archetype}_cap`);
      continue;
    }
    const step = p.hostile
      ? Math.round(p.maxBid * 0.4)
      : p.aggressive
        ? Math.round(current * 0.18)
        : Math.round(current * 0.06);
    const next = current + step;
    if (next <= p.maxBid) {
      current = next;
      winner = p.archetype;
      events.push(`${p.archetype}_bid`);
    } else {
      events.push(`${p.archetype}_pass`);
    }
  }
  const drama = winner
    ? `最终由【${winner}】以 ${current} 灵石拍下「${item.name}」。`
    : `「${item.name}」最终流拍。`;
  if (profiles.some((p) => p.hostile)) events.push('hostile_outbid');
  if (profiles.some((p) => p.archetype === 'shadow-bidder' && p.maxBid > current))
    events.push('shadow_escape');
  if (profiles.some((p) => p.archetype === 'casual-pilgrim')) events.push('casual_withdraw');
  return { winner, finalPrice: current, drama, postAuctionEvents: events };
}

/**
 * AI-G115: Build a CombatCauseChain describing why an action happens, how the
 * opponent is expected to react, and what environmental side-effects follow.
 * Used by engine to validate AI-proposed combat actions.
 */