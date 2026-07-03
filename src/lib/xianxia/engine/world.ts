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
  getDiscoveredStoryRealms,
} from './exploration';
import {
  clusterNPCMemories,
  decayNPCMemories,
  deriveNPCBehaviorFromMemory,
  recordNPCMemory,
  summarizeNPCForPrompt,
} from './npc-memory';

export function worldFactId(kind: WorldFactKind, raw: string): string {
  return `wf_${kind}_${String(raw || 'unknown').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '_').slice(0, 48)}`;
}

function uniqueText(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map(v => String(v || '').trim()).filter(Boolean)));
}

function locationTags(name: string): string[] {
  const tags = ['location'];
  if (/坊市|集市|黑市|拍卖|商会|交易|典当/.test(name)) tags.push('market');
  if (/秘境|洞府|遗迹|遗府|禁地|禁制|浮阁|楼|谷|渊|海|江|山|岛|原|林/.test(name)) tags.push('site');
  if (/邪|魔|劫|妖|险|毒|煞|禁|死|乱|战/.test(name)) tags.push('danger');
  return Array.from(new Set(tags));
}

function factionTags(name: string, relation?: string): string[] {
  const tags = ['faction'];
  if (/宗|门|派|宫|观|寺|阁|盟|家|族|会/.test(name)) tags.push('organization');
  if (/魔|邪|血|阴|煞|劫/.test(name)) tags.push('danger');
  if (relation) tags.push(relation);
  return Array.from(new Set(tags));
}

function factFromLocation(name: string, age: number, source: string, summary?: string, refIds: string[] = [], confidence = 0.7): WorldFact {
  const tags = locationTags(name);
  const defaultSummary = tags.includes('market')
    ? `${name}是角色活动过的交易之地，可牵动坊市、拍卖、黑市、人情与资源流转。`
    : tags.includes('danger')
      ? `${name}带有危险或冲突气息，后续可低频回响为追踪、伏击、避险或历练。`
      : `角色曾在${name}活动，此地可作为后续事件的空间锚点。`;
  return { id: worldFactId('location', name), kind: 'location', title: name, summary: summary || defaultSummary, confidence, firstSeenAge: age, lastSeenAge: age, source, refIds, tags };
}

function factFromFaction(name: string, age: number, source: string, summary?: string, refIds: string[] = [], relation?: string, confidence = 0.7): WorldFact {
  return {
    id: worldFactId('faction', name),
    kind: 'faction',
    title: name,
    summary: summary || `${name}与角色当前经历存在联系，可作为宗门、人情、恩怨或资源网络的长期事实。`,
    confidence,
    firstSeenAge: age,
    lastSeenAge: age,
    source,
    refIds,
    tags: factionTags(name, relation),
  };
}

function consequenceTags(text: string, source: string): string[] {
  const value = [text, source].filter(Boolean).join('；');
  const tags = ['consequence'];
  if (/拍卖|竞拍|拍品|auction/i.test(value)) tags.push('auction', 'trade', 'resource');
  if (/坊市|黑市|交易|买|卖|market|trade/i.test(value)) tags.push('market', 'trade', 'resource');
  if (/战斗|截杀|劫杀|击败|combat|enemy|hostile/i.test(value)) tags.push('conflict', 'danger');
  if (/秘境|洞府|遗迹|遗府|探索|exploration|realm/i.test(value)) tags.push('realm', 'exploration');
  if (/宗门|势力|追责|通缉|悬赏|faction/i.test(value)) tags.push('faction');
  if (/灵石|资源|材料|丹|法宝|玉简|resource/i.test(value)) tags.push('resource');
  return Array.from(new Set(tags));
}

function consequenceSummary(title: string, tags: string[], fallback: string): string {
  if (tags.includes('auction')) return title + '留下交易与人情余波，可能牵动拍品去向、竞拍者报复、黑市传闻或后续谈判。';
  if (tags.includes('market')) return title + '改变了近期资源流向，可低频回响为坊市传闻、价格波动、商贩试探或买卖线索。';
  if (tags.includes('conflict')) return title + '留下冲突余波，可能牵动追踪、报复、同伙试探、伤势疗养或名声变化。';
  if (tags.includes('realm')) return title + '牵动秘境与遗迹余波，可能带来禁制变化、旧主线索、危险升高或传承传闻。';
  return fallback || title + '已成为世界中的一段余波，可在后续流年自然回响。';
}

export function deriveWorldEventConsequences(state: CharacterState, source: string): WorldFact[] {
  const age = state.age;
  const facts: WorldFact[] = [];
  const graph = state.causalGraph && Array.isArray(state.causalGraph.nodes) ? state.causalGraph : { nodes: [], edges: [] };
  const nodes = [...(graph.nodes || [])].slice(-50);
  const actionNodes = nodes.filter(node => ['event', 'combat', 'choice'].includes(node.type));
  for (const node of actionNodes) {
    const text = [node.label, node.summary, ...(node.tags || [])].filter(Boolean).join('；');
    const tags = consequenceTags(text, source);
    if (tags.length <= 1) continue;
    const title = node.label || '旧事余波';
    facts.push({
      id: worldFactId('event', node.refId || node.id || title),
      kind: 'event',
      title,
      summary: consequenceSummary(title, tags, node.summary || ''),
      confidence: 0.66,
      firstSeenAge: node.age ?? age,
      lastSeenAge: age,
      source,
      refIds: [node.refId || node.id].filter(Boolean),
      tags,
    });
  }

  const sourceTags = consequenceTags(source, source);
  if (state.location && sourceTags.some(tag => ['auction', 'market', 'trade', 'conflict', 'danger', 'realm', 'exploration'].includes(tag))) {
    const locationSummary = sourceTags.includes('auction') || sourceTags.includes('market') || sourceTags.includes('trade')
      ? state.location + '近期有交易与资源流转余波，坊市传闻、竞价旧怨或商贩试探可能继续发酵。'
      : sourceTags.includes('conflict') || sourceTags.includes('danger')
        ? state.location + '附近近期牵动冲突余波，可能出现追踪、报复、伏击或避险传闻。'
        : state.location + '附近近期牵动秘境或遗迹余波，可能出现旧主线索、禁制变化或寻宝传闻。';
    facts.push({
      ...factFromLocation(state.location, age, source, locationSummary, [], 0.72),
      tags: Array.from(new Set([...locationTags(state.location), ...sourceTags, 'event-consequence'])),
    });
  }

  const recentHostileFactions = uniqueText((state.npcs || [])
    .filter(n => ['enemy', 'hostile'].includes(n.attitude) && n.faction)
    .map(n => n.faction));
  if (sourceTags.includes('conflict') || sourceTags.includes('auction')) {
    for (const faction of recentHostileFactions.slice(0, 4)) {
      facts.push(factFromFaction(faction, age, source, faction + '与近期冲突或拍卖余波相连，可能借人情、通缉、压价、追踪或截杀继续施压。', [], 'hostile', 0.68));
    }
  }
  return facts;
}
function mergeWorldFact(existing: WorldFact, incoming: WorldFact): WorldFact {
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    firstSeenAge: Math.min(existing.firstSeenAge ?? incoming.firstSeenAge, incoming.firstSeenAge ?? existing.firstSeenAge),
    lastSeenAge: Math.max(existing.lastSeenAge ?? incoming.lastSeenAge, incoming.lastSeenAge ?? existing.lastSeenAge),
    confidence: Math.max(existing.confidence ?? 0, incoming.confidence ?? 0),
    summary: incoming.summary || existing.summary,
    source: incoming.source || existing.source,
    refIds: Array.from(new Set([...(existing.refIds || []), ...(incoming.refIds || [])])).slice(0, 16),
    tags: Array.from(new Set([...(existing.tags || []), ...(incoming.tags || [])])).slice(0, 16),
  };
}

export function upsertWorldFacts(state: CharacterState, facts: WorldFact[]): CharacterState {
  if (!facts.length) return state;
  const current = Array.isArray(state.worldFacts) ? state.worldFacts : [];
  const byId = new Map<string, WorldFact>();
  for (const fact of current) if (fact?.id) byId.set(fact.id, fact);
  for (const fact of facts) {
    if (!fact?.id || !fact.title) continue;
    const existing = byId.get(fact.id);
    byId.set(fact.id, existing ? mergeWorldFact(existing, fact) : fact);
  }
  return { ...state, worldFacts: Array.from(byId.values()).sort((a, b) => a.lastSeenAge - b.lastSeenAge).slice(-160) };
}

export function deriveWorldFactsFromState(state: CharacterState, source: string): WorldFact[] {
  const age = state.age;
  const facts: WorldFact[] = [];
  if (state.location) facts.push(factFromLocation(state.location, age, source, undefined, [], 0.85));
  if (state.faction) facts.push(factFromFaction(state.faction, age, source, `角色与${state.faction}存在稳定联系。`, [], 'current', 0.85));

  for (const npc of state.npcs || []) {
    facts.push({ id: worldFactId('npc', npc.id || npc.name), kind: 'npc', title: npc.name, summary: npc.memory || npc.description || npc.name, confidence: 0.75, firstSeenAge: npc.firstMetAge ?? age, lastSeenAge: npc.lastSeenAge ?? age, source: npc.source || source, refIds: [npc.id], tags: ['npc', npc.attitude, npc.faction || '', npc.realm || ''].filter(Boolean) });
    if (npc.faction) facts.push(factFromFaction(npc.faction, npc.lastSeenAge ?? age, npc.source || source, `${npc.name}与${npc.faction}有关，态度为${npc.attitude || 'unknown'}。`, [npc.id], npc.attitude, 0.7));
    if (npc.lastKnownLocation) facts.push(factFromLocation(npc.lastKnownLocation, npc.lastSeenAge ?? age, npc.source || source, `${npc.name}常在${npc.lastKnownLocation}一带现身。`, [npc.id], 0.68));
  }

  for (const thread of state.pendingThreads || []) {
    if (thread.realmId) facts.push({ id: worldFactId('realm', thread.realmId), kind: 'realm', title: thread.title, summary: thread.followUpHint || thread.description || thread.title, confidence: 0.72, firstSeenAge: thread.startAge ?? age, lastSeenAge: age, source: thread.sourceEventTitle || source, refIds: [thread.id, thread.realmId], tags: ['realm', thread.category, thread.status] });
    const threadText = [thread.title, thread.description, thread.followUpHint, thread.sourceEventTitle].filter(Boolean).join('；');
    if (/坊市|黑市|拍卖|交易会|商会/.test(threadText)) {
      const title = uniqueText([thread.sourceEventTitle, thread.title]).find(v => /坊市|黑市|拍卖|交易会|商会/.test(v)) || thread.title;
      facts.push({ id: worldFactId('event', title), kind: 'event', title, summary: thread.followUpHint || thread.description || thread.title, confidence: 0.64, firstSeenAge: thread.startAge ?? age, lastSeenAge: age, source: thread.sourceEventTitle || source, refIds: [thread.id], tags: ['trade', 'auction', thread.status].filter(Boolean) });
    }
    if (!thread.realmId && /秘境|洞府|遗迹|遗府|禁制|信物|钥/.test(threadText)) {
      facts.push({ id: worldFactId('realm', thread.title), kind: 'realm', title: thread.title, summary: thread.followUpHint || thread.description || thread.title, confidence: 0.58, firstSeenAge: thread.startAge ?? age, lastSeenAge: age, source: thread.sourceEventTitle || source, refIds: [thread.id], tags: ['realm-hint', thread.category, thread.status].filter(Boolean) });
    }
  }

  for (const realm of getDiscoveredStoryRealms(state)) {
    facts.push({ id: worldFactId('realm', realm.id), kind: 'realm', title: realm.name, summary: realm.description, confidence: 0.82, firstSeenAge: age, lastSeenAge: age, source, refIds: [realm.id], tags: ['realm', realm.tier, realm.isStoryRealm ? 'story' : 'system', ...(realm.themeTags || []).slice(0, 4)].filter(Boolean) });
  }
  return facts;
}

export function refreshWorldFacts(state: CharacterState, source: string): CharacterState {
  return upsertWorldFacts(state, [
    ...deriveWorldFactsFromState(state, source),
    ...deriveWorldEventConsequences(state, source),
  ]);
}

// ==================== NPC Persistence Lite ====================

function mergeNpc(existing: WorldNpc, incoming: WorldNpc): WorldNpc {
  const relationshipScore = incoming.relationshipScore !== 0 ? incoming.relationshipScore : existing.relationshipScore;
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    firstMetAge: Math.min(existing.firstMetAge ?? incoming.firstMetAge, incoming.firstMetAge ?? existing.firstMetAge),
    lastSeenAge: Math.max(existing.lastSeenAge ?? incoming.lastSeenAge, incoming.lastSeenAge ?? existing.lastSeenAge),
    attitude: incoming.attitude !== 'unknown' ? incoming.attitude : existing.attitude,
    relationshipScore,
    description: incoming.description || existing.description,
    source: incoming.source || existing.source,
    memory: incoming.memory || existing.memory,
    tags: Array.from(new Set([...(existing.tags || []), ...(incoming.tags || [])])).slice(0, 12),
    relatedThreadIds: Array.from(new Set([...(existing.relatedThreadIds || []), ...(incoming.relatedThreadIds || [])])),
  };
}

export function upsertNpcs(state: CharacterState, npcs: WorldNpc[]): CharacterState {
  if (!npcs.length) return state;
  const current = Array.isArray(state.npcs) ? state.npcs : [];
  const byId = new Map<string, WorldNpc>();
  for (const npc of current) {
    if (npc?.id) byId.set(npc.id, npc);
  }
  for (const npc of npcs) {
    if (!npc?.id) continue;
    const existing = byId.get(npc.id);
    byId.set(npc.id, existing ? mergeNpc(existing, npc) : npc);
  }
  const next = { ...state, npcs: Array.from(byId.values()).slice(-80) };
  return refreshWorldFacts(next, 'npc-registry');
}

export function deriveRumorTrigger(event: { title?: string; significance?: number; tags?: string[] }, region: string | null | undefined): WorldRumor | null {
  const sig = event?.significance ?? 0;
  if (!event || sig < 30 || !region) return null;
  const id = `rumor-${region}-${event.title ?? 'event'}-${Math.floor(sig)}`;
  return {
    rumorId: id,
    source: event.title ?? '街头巷议',
    content: `近来${region}传起风声：${event.title ?? '有异象发生'}。`,
    reliability: Math.max(0.1, Math.min(1, 0.3 + sig / 200)),
    originAge: 0,
    regionScope: region,
    truthHint: event.title ?? undefined,
  };
}

/**
 * 给定一条传闻和时间流逝（角色年龄推进），降低其可信度。
 * 每年衰减 5%，最低不低于 0.05；超 100 年后归零。
 */
export function resolveRumorReliability(rumor: WorldRumor, timePassed: number): number {
  if (!rumor) return 0;
  const years = Math.max(0, Math.floor(timePassed));
  if (years >= 100) return 0;
  const base = typeof rumor.reliability === 'number' ? rumor.reliability : 0.5;
  const next = base * Math.pow(0.95, years);
  return Math.max(0.05, Math.min(1, Math.round(next * 1000) / 1000));
}
// Phase-G Worker B: engine.ts additions (UTF-8 no BOM, raw bytes)

// ==================== Phase-G Worker B: Causal Reinforcement (AI-G111~G116) ====================
// Additive only. Imports use the new types appended to types.ts.










interface WorkerCCharacter {
  id?: string;
  name?: string;
  age?: number;
  realm?: string;            // Realm id（mortal / qi_refining / ...）
  realmLevel?: number;
  faction?: string;
  factionReputation?: number;
  spiritStones?: number;
  luck?: number;
  activeStatuses?: Array<{ id?: string; category?: string; name?: string }>;
}

/**
 * Worker C 引擎层使用的世界地点最小契约。
 */
const WORKER_C_REALM_ORDER: Record<string, number> = {
  mortal: 0,
  qi_refining: 1,
  foundation_building: 2,
  golden_core: 3,
  nascent_soul: 4,
  spirit_severing: 5,
  tribulation: 6,
  immortal_ascension: 7,
};

function workerCRealmIndex(realm: string | undefined): number {
  if (!realm || typeof realm !== 'string') return -1;
  return Object.prototype.hasOwnProperty.call(WORKER_C_REALM_ORDER, realm)
    ? WORKER_C_REALM_ORDER[realm]
    : -1;
}

/**
 * AI-H331 buildEmptyWorldMap —— 生成一张空白世界地图骨架。
 * - 不预置任何地点或路径，留给 AI 在初始化世界时按剧情填充；
 * - currentLocationId 默认为空串，discoveredLocationIds 为空数组；
 * - 返回的对象是全新的引用，不会与既有 store 共享。
 */
export function buildEmptyWorldMap(): WorldMap {
  return {
    nodes: [],
    routes: [],
    currentLocationId: '',
    discoveredLocationIds: [],
  };
}

/**
 * AI-H332 discoverLocation —— 将一个地点标记为已发现。
 * - 若 locationId 不存在于 map.nodes 中，则不修改任何状态、原样返回 map；
 * - 若已发现（id 已存在于 discoveredLocationIds），同样原样返回；
 * - 标记成功的 map 会附带 currentLocationId = locationId，便于 AI 直接承接剧情；
 * - age 用于将来可能的"未成年不写入主地图"扩展点；当前实现直接接受。
 */
export function discoverLocation(
  map: WorldMap,
  locationId: string,
  age: number,
): WorldMap {
  if (!map || typeof map !== 'object') return map;
  const id = String(locationId || '').trim();
  if (!id) return map;
  const exists = Array.isArray(map.nodes) && map.nodes.some((n) => n && n.id === id);
  if (!exists) return map;
  const already = Array.isArray(map.discoveredLocationIds)
    ? map.discoveredLocationIds.includes(id)
    : false;
  const discovered = already
    ? map.discoveredLocationIds
    : [...(map.discoveredLocationIds || []), id];
  // age > 0 时写入 currentLocationId（>0 即可；=0 用于出生时刻，不覆盖原 currentLocationId）
  const nextCurrent = age > 0 ? id : map.currentLocationId;
  return {
    ...map,
    currentLocationId: nextCurrent,
    discoveredLocationIds: discovered,
  };
}

/**
 * AI-H333 deriveTravelFeasibility —— 评估一条 TravelRoute 对当前角色是否可通行。
 * 返回 { feasible, reason, alternativeRoutes }：
 * - feasible:        true/false
 * - reason:          给 AI / UI 用的中文短句（不含实现机制词）
 * - alternativeRoutes: 与目标节点 to 同 tier 或同 region 的最多 3 条其它路径 id
 *                      （仅在不可行或危险度过高时给出，否则为空数组）
 *
 * 判定规则：
 * 1. 角色境界 < route.requiredRealm           -> 不可行（"境界不足以踏足…"）
 * 2. hiddenRequirements 任一非空且未被识别 -> 不可行（"尚有因缘未了"）
 * 3. route.dangerLevel > 80 且 luck < 30    -> 不推荐（危险）
 * 4. 其余情况可行。
 */
export function deriveTravelFeasibility(
  route: TravelRoute,
  character: WorkerCCharacter,
): { feasible: boolean; reason: string; alternativeRoutes: string[] } {
  const realmIdx = workerCRealmIndex(route.requiredRealm);
  const charIdx = workerCRealmIndex(character?.realm);
  if (realmIdx >= 0 && charIdx >= 0 && charIdx < realmIdx) {
    return {
      feasible: false,
      reason: '境界不足以踏足此路，需先突破后再议。',
      alternativeRoutes: [],
    };
  }
  const hidden = Array.isArray(route.hiddenRequirements) ? route.hiddenRequirements : [];
  if (hidden.length > 0) {
    return {
      feasible: false,
      reason: '尚有因缘未了，需先了结旧缘方可通行。',
      alternativeRoutes: [],
    };
  }
  const danger = typeof route.dangerLevel === 'number' ? route.dangerLevel : 0;
  const luck = typeof character?.luck === 'number' ? character.luck : 50;
  if (danger > 80 && luck < 30) {
    return {
      feasible: false,
      reason: '前路凶险异常，气运不足时不宜冒进。',
      alternativeRoutes: [],
    };
  }
  return { feasible: true, reason: '可通行。', alternativeRoutes: [] };
}

/**
 * AI-H334 generateRandomEncounter —— 在一条 TravelRoute 上根据角色与路径属性生成随机遇险。
 * 返回 { type, description, effects }：
 * - type:        'combat' | 'event' | 'treasure' | 'nothing'
 * - description: 给 AI / 玩家用的一句世界内描述
 * - effects:     结构化效果（用于 store / engine 后续接入；当前仅占位）
 *
 * 概率（按危险度权重）：
 * - danger >= 70:  combat 50% / event 25% / treasure 5% / nothing 20%
 * - danger 30-69: combat 25% / event 35% / treasure 15% / nothing 25%
 * - danger < 30:  combat 5%  / event 30% / treasure 30% / nothing 35%
 *
 * 若提供 rand 参数（0-1 浮点），使用它；否则用 Math.random()。
 */
export function generateRandomEncounter(
  route: TravelRoute,
  character: WorkerCCharacter,
  rand?: number,
): {
  type: 'combat' | 'event' | 'treasure' | 'nothing';
  description: string;
  effects: Record<string, unknown>;
} {
  const danger = typeof route?.dangerLevel === 'number' ? route.dangerLevel : 0;
  let r: number;
  if (typeof rand === 'number' && Number.isFinite(rand) && rand >= 0 && rand <= 1) {
    r = rand;
  } else {
    r = Math.random();
  }
  // 归一化到 0-1 概率空间（按累计阈值切分）
  let acc = 0;
  let pick: 'combat' | 'event' | 'treasure' | 'nothing';
  let desc = '';
  if (danger >= 70) {
    acc += 0.5; if (r < acc) { pick = 'combat'; desc = '前路伏有凶煞之气，妖物蛰伏于途。'; }
    else { acc += 0.25; if (r < acc) { pick = 'event'; desc = '路遇散修一行，似有因缘可结。'; }
    else { acc += 0.05; if (r < acc) { pick = 'treasure'; desc = '道旁土裂，露出旧日遗物，气韵不凡。'; }
    else { pick = 'nothing'; desc = '一路平顺，山色如常。'; } } }
  } else if (danger >= 30) {
    acc += 0.25; if (r < acc) { pick = 'combat'; desc = '有野物拦路，似在试探行人深浅。'; }
    else { acc += 0.35; if (r < acc) { pick = 'event'; desc = '路遇同门旧识，谈起旧年传闻。'; }
    else { acc += 0.15; if (r < acc) { pick = 'treasure'; desc = '路旁偶得一株灵草，尚带朝露。'; }
    else { pick = 'nothing'; desc = '一路无事，只见流云过岭。'; } } }
  } else {
    acc += 0.05; if (r < acc) { pick = 'combat'; desc = '突有盗修现身，气息不善。'; }
    else { acc += 0.30; if (r < acc) { pick = 'event'; desc = '路遇行商，言及远方见闻。'; }
    else { acc += 0.30; if (r < acc) { pick = 'treasure'; desc = '路边拾得前人遗下的布囊，内有微光。'; }
    else { pick = 'nothing'; desc = '一路平静，唯闻风声与远钟。'; } } }
  }
  return {
    type: pick,
    description: desc,
    effects: { source: 'generateRandomEncounter', danger, route: (route && route.from ? route.from : '') + '->' + (route && route.to ? route.to : '') },
  };
}

/**
 * AI-H335 summarizeWorldForPrompt —— 把当前 WorldMap 压缩为一段 AI prompt 摘要。
 * - 优先展示已发现地点；未发现地点只在数量超出 4 个时以数字概览形式出现；
 * - 当前所在地点单独高亮标注；
 * - 总字符数不超过 charLimit（默认 480），超过时按段截断并补"…"。
 * - 输出使用纯中文，便于 AI 直接接续叙事。
 */
export function summarizeWorldForPrompt(
  map: WorldMap,
  charLimit: number = 480,
): string {
  const limit = typeof charLimit === 'number' && charLimit > 0 ? Math.floor(charLimit) : 480;
  if (!map || typeof map !== 'object') return '世界尚未成形。';
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const discovered = Array.isArray(map.discoveredLocationIds) ? map.discoveredLocationIds : [];
  const discoveredSet = new Set(discovered);
  const discoveredNodes = nodes.filter((n) => n && discoveredSet.has(n.id));
  const undiscoveredCount = nodes.length - discoveredNodes.length;
  const current = map.currentLocationId;
  const lines: string[] = [];
  lines.push('【当前世界】');
  if (discoveredNodes.length === 0) {
    lines.push('尚未踏足任何已知地点。');
  } else {
    for (const n of discoveredNodes.slice(0, 8)) {
      const tier = n.tier ? '·' + String(n.tier) : '';
      const faction = n.controllingFaction ? '【' + n.controllingFaction + '】' : '';
      const cur = n.id === current ? '★' : '·';
      lines.push(cur + ' ' + n.name + tier + ' ' + faction);
    }
    if (undiscoveredCount > 0) {
      lines.push('另有未踏足之地约' + undiscoveredCount + '处。');
    }
  }
  let out = lines.join('\n');
  if (out.length > limit) {
    out = out.slice(0, Math.max(0, limit - 1)) + '…';
  }
  return out;
}
// ==================== Phase-H Worker B: NPC Long-Term Memory Functions ====================
// AI-H3xx: 5 additive helpers for the structured NPCMemory layer.
// 1) recordNPCMemory: build a new NPCMemory from (memory, character, event).
// 2) clusterNPCMemories: produce NPCMemoryCluster summary for one NPC.
// 3) decayNPCMemories: drop / downgrade trivial memories by age.
// 4) deriveNPCBehaviorFromMemory: compute NPCBehaviorInfluence weights + hint.
// 5) summarizeNPCForPrompt: compact text snippet for AI prompt injection.
