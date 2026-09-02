// AUTO-SPLIT from engine.ts — physical extraction only, logic unchanged.

import { DEFAULT_STORAGE_CAPACITY } from '../types/item';
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
  evaluateTechniqueCompatibility,
  isConstitutionStatus,
  isFateStatus,
} from './items';
import {
  buildStateContext,
} from './lifecycle';
import {
  computePetPassiveBonus,
} from './pet';
import {
  adaptTechniqueEffect,
  clampProfileNumber,
  normalizeCultivationBearingItem,
  normalizeThreadsCompletion,
  realmPowerMultiplier,
  sanitizeRealmProfile,
  SCRIPTURE_NAME_RE,
  defaultScriptureMultiplier,
} from './shared';
import {
  filterMeaningfulStatuses,
  normalizeIdentityStatuses,
} from './statuses';
import {
  buildQuestEntriesFromThreads,
} from './threads';

export interface DBCharacter {
  id: string; name: string; age: number; lifespan: number; gender: string;
  spiritualRoot: string; rootDetail: string; realm: string; realmLevel: number;
  cultivationExp: number; expToBreak: number;
  elementMetal: number; elementWood: number; elementWater: number; elementFire: number; elementEarth: number;
  hp: number; maxHp: number; mp: number; maxMp: number;
  attack: number; defense: number; speed: number; luck: number; comprehension: number;
  spiritStones: number; reputation: number;
  alive: boolean; ascended: boolean; causeOfDeath: string;
  faction: string; master: string; location: string;
  fateNodes: string; isAtChoice: boolean; lastEventAge: number;
  statusJson: string; inventoryJson: string; memoryJson: string;
  equippedJson: string; storageCapacity: number;
  cultivationMultiplier: number;
  cultivationInsight: string;
  cultivationFactorsJson: string;
  // ===== Task 20 新增 =====
  pendingThreadsJson: string;
  characterIntentsJson: string;
  combatStateJson: string;
  recentEventTypesJson: string;
  recentBlueprintCategoriesJson: string;
  // ===== Task 23 新增 =====
  petsJson?: string;
  // ===== Task 24 新增 =====
  exploredRealmsJson?: string;
  npcsJson?: string;
  causalGraphJson?: string;
  worldFactsJson?: string;
}

// 旧存档 equippedJson 可能是 slot-map（{weapon: {...}}）或已是数组（[{...}]）
// 本函数将其统一转为数组；旧 slot-map 会带上默认 equipNote（如「兵器」「功法」）
function parseEquippedJson(raw: string): ItemEntry[] {
  if (!raw) return [];
  const parsed = safeParse<any>(raw, []);
  if (Array.isArray(parsed)) return parsed as ItemEntry[];
  // 旧 slot-map 格式：转换为数组
  if (typeof parsed === 'object' && parsed !== null) {
    const out: ItemEntry[] = [];
    for (const slot of Object.keys(parsed) as EquipSlot[]) {
      const it = (parsed as EquippedMap)[slot];
      if (it) {
        out.push({ ...it, equipNote: it.equipNote || SLOT_LABEL[slot] });
      }
    }
    return out;
  }
  return [];
}

// 判定一个物品是否是「储物袋」（含 storageCapacity 效果的 tool）
export function isStorageBag(item: ItemEntry): boolean {
  if (!item) return false;
  if (item.item_type !== 'tool') return false;
  return (item.effects || []).some(e => e.target_attribute === 'storageCapacity' && e.operation === 'add' && e.value > 0);
}

export function dbToState(c: DBCharacter): CharacterState {
  const rootInfo = SPIRITUAL_ROOTS[c.spiritualRoot as SpiritualRoot];
  const equipped = parseEquippedJson(c.equippedJson || '[]').map(normalizeCultivationBearingItem);
  const inventory = safeParse<ItemEntry[]>(c.inventoryJson, []).map(normalizeCultivationBearingItem);
  const storageCapacity = c.storageCapacity ?? DEFAULT_STORAGE_CAPACITY;
  // Task 20: 解析新字段
  const parsedPendingThreads = safeParse<PendingThread[]>(c.pendingThreadsJson || '[]', []);
  const pendingThreads = normalizeThreadsCompletion(Array.isArray(parsedPendingThreads) ? parsedPendingThreads : []);
  const parsedCharacterIntents = safeParse<CharacterIntent[]>(c.characterIntentsJson || '[]', []);
  const characterIntents = Array.isArray(parsedCharacterIntents) ? parsedCharacterIntents : [];
  const combatSession = c.combatStateJson ? safeParse<CombatSession | null>(c.combatStateJson, null) : null;
  const recentEventTypes = safeParse<string[]>(c.recentEventTypesJson || '[]', []);
  const recentBlueprintCategories = safeParse<string[]>(c.recentBlueprintCategoriesJson || '[]', []);
  const state: CharacterState = {
    id: c.id, name: c.name, age: c.age, lifespan: c.lifespan, gender: c.gender,
    spiritualRoot: c.spiritualRoot as SpiritualRoot,
    rootDetail: c.rootDetail,
    rootMultiplier: rootInfo?.multiplier ?? 0,
    realm: c.realm as Realm, realmLevel: c.realmLevel,
    cultivationExp: c.cultivationExp, expToBreak: c.expToBreak,
    elements: { metal: c.elementMetal, wood: c.elementWood, water: c.elementWater, fire: c.elementFire, earth: c.elementEarth },
    hp: c.hp, maxHp: c.maxHp, mp: c.mp, maxMp: c.maxMp,
    attack: c.attack, defense: c.defense, speed: c.speed,
    luck: c.luck, comprehension: c.comprehension,
    spiritStones: c.spiritStones, reputation: c.reputation,
    alive: c.alive, ascended: c.ascended, causeOfDeath: c.causeOfDeath,
    faction: c.faction, master: c.master, location: c.location,
    fateNodes: c.fateNodes ? c.fateNodes.split(',').filter(Boolean).map(Number) : [],
    isAtChoice: c.isAtChoice, lastEventAge: c.lastEventAge,
    activeStatuses: filterMeaningfulStatuses(safeParse<StatusEntry[]>(c.statusJson, [])),
    inventory,
    equipped,
    storageCapacity,
    // cultivationMultiplier 与 cultivationFactors 始终根据灵根 + 已装备 + 状态词条实时重算
    // 不信任数据库旧值（旧存档可能含已被移除的 AI 补充因素，会导致顶部倍率与来源条目不一致）
    cultivationMultiplier: 0,
    cultivationInsight: c.cultivationInsight || '',
    cultivationFactors: [],
    longTermMemory: safeParse<string[]>(c.memoryJson, []),
    // Task 20 新字段
    pendingThreads,
    questEntries: buildQuestEntriesFromThreads(pendingThreads, c.age),
    characterIntents,
    combatSession,
    // Task 22 新字段
    heartDemon: (c as any).heartDemon ?? 0,
    karma: (c as any).karma ?? 0,
    merit: (c as any).merit ?? 0,
    sin: (c as any).sin ?? 0,
    // Task 23 新字段
    pets: safeParse<Pet[]>((c as any).petsJson || '[]', []),
    // Task 24 新字段
    exploredRealms: safeParse<ExplorationRecord[]>((c as any).exploredRealmsJson || '[]', []),
    npcs: safeParse<WorldNpc[]>((c as any).npcsJson || '[]', []),
    causalGraph: safeParse<CausalGraph>((c as any).causalGraphJson || '{ "nodes": [], "edges": [] }', { nodes: [], edges: [] }),
    worldFacts: safeParse<WorldFact[]>((c as any).worldFactsJson || '[]', []),
    origin: safeParse<{ ethnicity: string; lineage: string } | null>((c as any).originJson || 'null', null),
    bodyGrowthResidual: safeParse<{ attack: number; defense: number; speed: number; maxHp: number } | undefined>(
      (c as any).bodyGrowthResidualJson || 'null',
      undefined,
    ),
  };
  // 持久化的 recentEventTypes / recentBlueprintCategories 不进 state（仅 ctx 用），但需要保留
  // 这里通过闭包变量传给 buildStateContext（在 advance route 中调用）
  (state as any)._recentEventTypes = recentEventTypes;
  (state as any)._recentBlueprintCategories = recentBlueprintCategories;
  const rate = computeEffectiveCultivationRate(state);
  state.cultivationMultiplier = rate.multiplier;
  state.cultivationFactors = computeCultivationFactors(state);
  state.realmProfile = getRealmProfile(state);
  state.cultivationAttributes = deriveCultivationAttributes(state);
  const coreAttrs = deriveCoreCultivationAttributes(state);
  const soulRealm = deriveSoulRealm({ ...state, ...coreAttrs });
  Object.assign(state, {
    ...coreAttrs,
    soulRealmName: soulRealm.name,
    soulRealmRank: soulRealm.rank,
    soulRealmGap: soulRealm.gap,
    realmTraits: deriveRealmTraits(state),
    combatProjection: deriveCombatProjection({ ...state, ...coreAttrs }),
  });
  return state;
}
function cultivationAttributeCategory(category?: string): CultivationAttributeEntry['category'] {
  if (!category) return 'custom';
  const map: Record<string, CultivationAttributeEntry['category']> = {
    body: 'body',
    spirit: 'spirit',
    dao: 'dao',
    combat: 'combat',
    fate: 'fate',
    custom: 'custom',
    // 旧存档中文 category 兼容
    '\u8eab\u4f53': 'body',
    '\u795e\u9b42': 'spirit',
    '\u9053\u5fb7': 'dao',
    '\u6218\u6597': 'combat',
    '\u5929\u8fd0': 'fate',
  };
  return map[category] || 'custom';
}

export function deriveCultivationAttributes(state: CharacterState): CultivationAttributeEntry[] {
  const byId = new Map<string, CultivationAttributeEntry>();
  for (const attr of state.cultivationAttributes || []) {
    if (!attr || !attr.name || attr.visible === false) continue;
    byId.set(attr.id || attr.name, { ...attr, id: attr.id || attr.name, category: cultivationAttributeCategory(attr.category) });
  }
  for (const status of state.activeStatuses || []) {
    if (!status || status.category !== 'attribute' || !status.name) continue;
    const firstEffect = Array.isArray(status.effects) ? status.effects.find(e => e && e.value !== undefined) : undefined;
    const id = status.id || `attr-${status.name}`;
    byId.set(id, {
      id,
      name: status.name,
      value: firstEffect?.description || firstEffect?.value,
      description: status.description || firstEffect?.description || status.name,
      source: status.source,
      category: cultivationAttributeCategory((status as any).attributeCategory),
      visible: true,
    });
  }
  const core = deriveCoreCultivationAttributes(state);
  const soul = deriveSoulRealm({ ...state, ...core });
  byId.set('spiritualSense', {
    id: 'spiritualSense',
    name: '\u795e\u8bc6',
    value: core.spiritualSense,
    description: '\u611f\u77e5\u3001\u63a2\u67e5\u3001\u795e\u5ff5\u538b\u5236\u4e0e\u9ad8\u9636\u7981\u5236\u5224\u65ad\u7684\u57fa\u7840\u3002',
    source: '\u5883\u754c\u4e0e\u795e\u9b42\u6d3e\u751f',
    category: 'spirit',
    visible: true,
  });
  byId.set('soulStrength', {
    id: 'soulStrength',
    name: '\u9b42\u9b44',
    value: core.soulStrength,
    description: `\u5f53\u524d\u795e\u9b42\u5883\u754c\uff1a${soul.name}\uff08${soul.gap}\uff09\uff0c\u5f71\u54cd\u5143\u5a74\u51fa\u7a8d\u3001\u593a\u820d\u98ce\u9669\u3001\u5fc3\u9b54\u627f\u53d7\u548c\u795e\u8bc6\u79d8\u672f\u3002`,
    source: '\u5883\u754c\u4e0e\u5fc3\u6027\u6d3e\u751f',
    category: 'spirit',
    visible: true,
  });
  byId.set('physicalFoundation', {
    id: 'physicalFoundation',
    name: '\u4f53\u9b44',
    value: core.physicalFoundation,
    description: '\u8089\u8eab\u6839\u57fa\u4e0e\u627f\u8f7d\u529b\uff0c\u5f71\u54cd\u91cd\u4f24\u627f\u53d7\u3001\u70bc\u4f53\u673a\u7f18\u548c\u5927\u5883\u754c\u7a81\u7834\u7a33\u5b9a\u5ea6\u3002',
    source: '\u8089\u8eab\u4e0e\u5883\u754c\u6d3e\u751f',
    category: 'body',
    visible: true,
  });
  return [...byId.values()].slice(0, 24);
}


function firstNumber(...values: any[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function attributeNumber(state: CharacterState, ids: string[]) {
  const wanted = new Set(ids);
  for (const attr of state.cultivationAttributes || []) {
    if (!attr) continue;
    if (!wanted.has(String(attr.id || '')) && !ids.some(id => String(attr.name || '').includes(id))) continue;
    const n = Number(attr.value);
    if (Number.isFinite(n)) return n;
  }
  for (const status of state.activeStatuses || []) {
    const text = `${status.name || ''} ${status.description || ''}`;
    if (!ids.some(id => text.includes(id))) continue;
    const effect = (status.effects || []).find(e => Number.isFinite(Number(e.value)));
    if (effect) return Number(effect.value);
  }
  return undefined;
}

export function deriveCoreCultivationAttributes(state: CharacterState) {
  const realmIdx = Math.max(0, REALMS.findIndex(r => r.id === state.realm));
  const levelRatio = Math.max(0, Number(state.realmLevel || 0)) / Math.max(1, Number(getRealmInfo(state.realm).levels || 1));
  const profilePower = realmPowerMultiplier(state);
  // \u5c81\u6708\u7d2f\u79ef\uff1a\u8eab\u795e\u4e09\u5b9d\u968f\u5e74\u9f84\u7f13\u6162\u589e\u957f\uff08\u51e1\u4eba\u671f\u6700\u660e\u663e\uff0c\u5883\u754c\u7a81\u7834\u540e\u88ab realm \u9879\u4e3b\u5bfc\uff09
  // age \u7cfb\u6570\uff1a\u795e\u8bc6 0.04/\u5c81\u3001\u9b42\u9b44 0.035/\u5c81\u3001\u4f53\u9b44 0.045/\u5c81
  // \u51e1\u4eba 50 \u5c81 \u2248 \u795e\u8bc6 +1.8 / \u9b42\u9b44 +1.6 / \u4f53\u9b44 +2.0\uff1b\u70bc\u6c14 200 \u5c81 \u2248 +7.8 / +6.8 / +8.8
  const age = Math.max(0, Number(state.age || 0));
  const ageDriftSS = age * 0.04;
  const ageDriftSoul = age * 0.035;
  const ageDriftPhys = age * 0.045;
  const spiritualSense = Math.round(firstNumber(
    (state as any).spiritualSense,
    attributeNumber(state, ['spiritualSense', '\u795e\u8bc6']),
    5 + realmIdx * 24 + levelRatio * 18 + (state.comprehension || 0) * 0.45 + (state.maxMp || 0) * 0.04 + ageDriftSS,
  )! * profilePower);
  const soulStrength = Math.round(firstNumber(
    (state as any).soulStrength,
    attributeNumber(state, ['soulStrength', '\u9b42\u9b44', '\u795e\u9b42', '\u5143\u795e']),
    8 + realmIdx * 22 + levelRatio * 16 + (state.comprehension || 0) * 0.35 - (state.heartDemon || 0) * 0.15 + ageDriftSoul,
  )! * profilePower);
  const physicalFoundation = Math.round(firstNumber(
    (state as any).physicalFoundation,
    attributeNumber(state, ['physicalFoundation', '\u4f53\u9b44', '\u8089\u8eab', '\u6839\u9aa8']),
    20 + realmIdx * 18 + levelRatio * 12 + (state.maxHp || 0) * 0.08 + (state.defense || 0) * 0.2 + ageDriftPhys,
  )! * profilePower);
  return {
    spiritualSense: Math.max(0, Math.min(9999, spiritualSense)),
    soulStrength: Math.max(0, Math.min(9999, soulStrength)),
    physicalFoundation: Math.max(0, Math.min(9999, physicalFoundation)),
  };
}

export function deriveSoulRealm(state: CharacterState) {
  const core = deriveCoreCultivationAttributes(state);
  const score = core.soulStrength + core.spiritualSense * 0.65;
  const tiers = [
    { name: '\u672a\u51dd\u795e', rank: 0, min: 0 },
    { name: '\u7075\u611f\u521d\u840c', rank: 1, min: 45 },
    { name: '\u795e\u8bc6\u521d\u6210', rank: 2, min: 85 },
    { name: '\u795e\u9b42\u7a33\u56fa', rank: 3, min: 150 },
    { name: '\u5143\u795e\u51fa\u7a8d', rank: 4, min: 260 },
    { name: '\u5143\u795e\u663e\u5316', rank: 5, min: 420 },
    { name: '\u795e\u610f\u901a\u7384', rank: 6, min: 680 },
  ];
  const tier = [...tiers].reverse().find(t => score >= t.min) || tiers[0];
  const bodyRank = Math.max(0, REALMS.findIndex(r => r.id === state.realm));
  const gap = tier.rank > bodyRank + 1
    ? '\u795e\u9b42\u8d85\u524d'
    : tier.rank + 1 < bodyRank
      ? '\u795e\u9b42\u843d\u540e'
      : '\u8eab\u795e\u76f8\u79f0';
  return { ...tier, gap, score: Math.round(score), ...core };
}

export function deriveRealmTraits(state: CharacterState) {
  const base = REALM_TRAITS[state.realm] || REALM_TRAITS.mortal;
  const patch = getRealmProfile(state)?.traits || {};
  return {
    ...base,
    ...patch,
    capabilities: [...new Set([...(base.capabilities || []), ...(patch.capabilities || [])])].slice(0, 8),
    limitations: [...new Set([...(base.limitations || []), ...(patch.limitations || [])])].slice(0, 8),
    worldAccess: [...new Set([...(base.worldAccess || []), ...(patch.worldAccess || [])])].slice(0, 8),
    combatStyle: [...new Set([...(base.combatStyle || []), ...(patch.combatStyle || [])])].slice(0, 8),
    resourceNeeds: [...new Set([...(base.resourceNeeds || []), ...(patch.resourceNeeds || [])])].slice(0, 8),
    riskTags: [...new Set([...(base.riskTags || []), ...(patch.riskTags || [])])].slice(0, 8),
  };
}

export function deriveCombatProjection(state: CharacterState) {
  const core = deriveCoreCultivationAttributes(state);
  const realmTraits = deriveRealmTraits(state);
  const force = Math.max(0, Math.round((state.attack || 0) + core.spiritualSense * 0.12 + (state.comprehension || 0) * 0.08));
  const guard = Math.max(0, Math.round((state.defense || 0) + core.physicalFoundation * 0.16 + core.soulStrength * 0.06));
  const agility = Math.max(0, Math.round((state.speed || 0) + core.spiritualSense * 0.10 + (state.luck || 0) * 0.04));
  const advantages = [
    force >= guard && force >= agility ? '\u7834\u52bf\u504f\u76db' : '',
    guard >= force && guard >= agility ? '\u62a4\u6301\u7a33\u539a' : '',
    agility >= force && agility >= guard ? '\u673a\u53d8\u7075\u52a8' : '',
    core.spiritualSense >= core.physicalFoundation + 30 ? '\u795e\u8bc6\u8d85\u524d' : '',
    core.physicalFoundation >= core.spiritualSense + 30 ? '\u4f53\u9b44\u627f\u538b\u5f3a' : '',
  ].filter(Boolean).slice(0, 4);
  const vulnerabilities = [
    core.soulStrength + 25 < core.spiritualSense ? '\u795e\u8bc6\u9510\u800c\u9b42\u9b44\u627f\u8f7d\u4e0d\u8db3' : '',
    guard + 20 < force ? '\u653b\u950b\u8fc7\u76db\uff0c\u62a4\u6301\u504f\u8584' : '',
    agility + 20 < guard ? '\u627f\u538b\u6709\u4f59\uff0c\u8f6c\u632a\u504f\u6162' : '',
    (state.heartDemon || 0) >= 60 ? '\u5fc3\u9b54\u7275\u52a8\u795e\u9b42' : '',
  ].filter(Boolean).slice(0, 4);
  return {
    force,
    guard,
    agility,
    spiritualAwareness: core.spiritualSense,
    soulStability: core.soulStrength,
    bodyTenacity: core.physicalFoundation,
    forceLabel: COMBAT_PROJECTION_LABELS.force,
    guardLabel: COMBAT_PROJECTION_LABELS.guard,
    agilityLabel: COMBAT_PROJECTION_LABELS.agility,
    summary: `${realmTraits.combatStyle?.[0] || '循势斗法'}：${COMBAT_PROJECTION_LABELS.force}${force}、${COMBAT_PROJECTION_LABELS.guard}${guard}、${COMBAT_PROJECTION_LABELS.agility}${agility}`,
    advantages,
    vulnerabilities,
  };
}

function safeParse<T>(s: string, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}


export function getRealmProfile(state: CharacterState): RealmProfile | undefined {
  const explicit = sanitizeRealmProfile((state as any).realmProfile);
  if (explicit) return explicit;

  const status = (state.activeStatuses || []).find(st =>
    st.category === 'special' &&
    /境界|道基|金丹|筑基|炼气|練氣|元婴|元嬰|化神|大乘|渡劫|飞升|飛升|九转|完美|叠层|道果/.test(`${st.name} ${st.description}`) &&
    (st.effects || []).some(e => ['realmMaxLevel', 'realmPower', 'realmExp'].includes(e.target_attribute))
  );
  if (!status) return undefined;

  const profile: RealmProfile = {
    name: status.name?.slice(0, 16),
    reason: status.description?.slice(0, 120),
  };
  for (const eff of status.effects || []) {
    if (eff.target_attribute === 'realmMaxLevel') profile.maxLevel = Math.round(clampProfileNumber(eff.value, 0, 999, 9));
    if (eff.target_attribute === 'realmPower') profile.powerMultiplier = clampProfileNumber(eff.value, 0.5, 9, 1);
    if (eff.target_attribute === 'realmExp') profile.expMultiplier = clampProfileNumber(eff.value, 0.2, 20, 1);
  }
  return sanitizeRealmProfile(profile);
}

export const ATTRIBUTE_BOUNDS: Record<string, { min: number; max: number }> = {
  lifespan:        { min: 1,    max: 99999 },
  cultivationExp:  { min: 0,    max: 99999999 },
  hp:              { min: 0,    max: 99999 },
  maxHp:           { min: 1,    max: 99999 },
  mp:              { min: 0,    max: 99999 },
  maxMp:           { min: 0,    max: 99999 },
  attack:          { min: 0,    max: 99999 },
  defense:         { min: 0,    max: 99999 },
  speed:           { min: 0,    max: 99999 },
  luck:            { min: 0,    max: 100 },
  comprehension:   { min: 0,    max: 100 },
  spiritualSense:  { min: 0,    max: 9999 },
  soulStrength:    { min: 0,    max: 9999 },
  physicalFoundation: { min: 0, max: 9999 },
  spiritStones:    { min: 0,    max: 99999999 },
  reputation:      { min: -9999,max: 99999 },
  elementMetal:    { min: 0,    max: 100 },
  elementWood:     { min: 0,    max: 100 },
  elementWater:    { min: 0,    max: 100 },
  elementFire:     { min: 0,    max: 100 },
  elementEarth:    { min: 0,    max: 100 },
  // Task 22: 心魔值（0-100）
  heartDemon:      { min: 0,    max: 100 },
};

export function applyChanges(state: CharacterState, changes: AttributeChange[]): CharacterState {
  return resolveAttributeChanges(state, changes, {
    bounds: ATTRIBUTE_BOUNDS,
    source: 'applyChanges',
  }).state;
}

// ==================== 装备管理 (引擎权威) ====================

// 把物品的 add 效果应用到角色属性（装备时 +delta，卸下时 -delta）
export function recalcCultivationMultiplier(state: CharacterState): CharacterState {
  const { multiplier } = computeEffectiveCultivationRate(state);
  return { ...state, cultivationMultiplier: multiplier };
}

// 灵根稀有度映射（用于 cultivationFactors 的 rarity 着色）
const ROOT_RARITY: Record<SpiritualRoot, 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'> = {
  none: 'common', mixed: 'common', common: 'uncommon', pure: 'rare', heavenly: 'legendary', chaos: 'mythic',
};

const CONSTITUTION_CULTIVATION_MULTIPLIER_BY_RARITY: Record<string, number> = {
  common: 1.03,
  uncommon: 1.06,
  rare: 1.10,
  epic: 1.16,
  legendary: 1.25,
  mythic: 1.40,
};

function hasCultivationEffect(status: Partial<StatusEntry> | null | undefined): boolean {
  return Array.isArray(status?.effects) && status.effects.some((eff: any) => eff?.target_attribute === 'cultivationExp' && eff.operation && eff.value !== undefined && eff.value !== 0);
}

function getConstitutionCultivationMultiplier(status: Partial<StatusEntry>): number {
  if (!isConstitutionStatus(status)) return 1;
  const rarityBase = CONSTITUTION_CULTIVATION_MULTIPLIER_BY_RARITY[status.rarity || 'common'] || 1.06;
  const stage = Math.max(1, Number(status.constitution?.currentStage || 1));
  return Number((rarityBase + Math.max(0, stage - 1) * 0.04).toFixed(2));
}

// 引擎权威：从 state 计算修炼速度来源条目（保证数值准确，不依赖 AI 的主观感知）
// AI 仍可输出 cultivationFactors（用于补充环境/心境等引擎不跟踪的因素），引擎会合并去重
export function computeCultivationFactors(state: CharacterState): CultivationFactor[] {
  const factors: CultivationFactor[] = [];
  // 1. 灵根（始终第一条）
  const rootInfo = SPIRITUAL_ROOTS[state.spiritualRoot];
  if (rootInfo && rootInfo.multiplier > 0) {
    factors.push({
      name: state.rootDetail || rootInfo.name,
      value: rootInfo.multiplier,
      operation: 'multiply',
      rarity: ROOT_RARITY[state.spiritualRoot],
      note: '灵根根基',
    });
  }
  // 2. 特殊体质独立于普通状态：若 AI 已给 cultivationExp 效果则按效果，否则按稀有度/觉醒阶段给基础修炼共鸣。
  for (const s of (state.activeStatuses || []).filter(isConstitutionStatus)) {
    const cultivationEffects = (s.effects || []).filter(e => e.target_attribute === 'cultivationExp');
    if (cultivationEffects.length) {
      for (const eff of cultivationEffects) {
        if (eff.operation === 'multiply' && eff.value > 0) {
          factors.push({ name: s.name, value: eff.value, operation: 'multiply', rarity: s.rarity as any, note: '体质共鸣' });
        } else if (eff.operation === 'add' && eff.value !== 0) {
          factors.push({ name: s.name, value: eff.value, operation: 'add', rarity: s.rarity as any, note: '体质滋养' });
        }
      }
    } else {
      const value = getConstitutionCultivationMultiplier(s);
      if (value > 1) factors.push({ name: s.name, value, operation: 'multiply', rarity: s.rarity as any, note: '体质根骨' });
    }
  }
  // 3. 已装备物品中所有影响 cultivationExp 的效果
  for (const it of state.equipped || []) {
    const compat = evaluateTechniqueCompatibility(state, it);
    if (!compat.usable) {
      factors.push({ name: it.name, value: 0, operation: 'multiply', rarity: it.rarity as any, note: compat.reasons[0] || '\u6839\u57fa\u4e0d\u5408\uff0c\u6682\u96be\u4fee\u4e60' });
      continue;
    }
    let hasMultiplyCultivationEffect = false;
    for (const rawEff of it.effects || []) {
      const eff = adaptTechniqueEffect(state, it, rawEff);
      if (!eff) continue;
      if (eff.target_attribute === 'cultivationExp') {
        if (eff.operation === 'multiply' && eff.value > 0) {
          hasMultiplyCultivationEffect = true;
          factors.push({
            name: it.name,
            value: eff.value,
            operation: 'multiply',
            rarity: it.rarity as any,
            note: '功法加成',
          });
        } else if (eff.operation === 'add' && eff.value !== 0) {
          factors.push({
            name: it.name,
            value: eff.value,
            operation: 'add',
            rarity: it.rarity as any,
            note: '额外修为/岁',
          });
        }
      }
    }
    // 兜底：AI 生成 scripture 时若忘给 cultivationExp x multiplier 效果，
    // 按名字/描述/类型识别为功法后补上稀有度默认倍率，
    // 保证 UI 与引擎读到同一份权威 factors。
    if (!hasMultiplyCultivationEffect) {
      const looksLikeScripture = it.item_type === 'scripture'
        || SCRIPTURE_NAME_RE.test(`${it.name || ''}${it.description || ''}`);
      if (looksLikeScripture) {
        factors.push({
          name: it.name,
          value: defaultScriptureMultiplier(it.rarity as string),
          operation: 'multiply',
          rarity: it.rarity as any,
          note: '功法加成',
        });
      }
    }
  }
  // 4. 普通状态词条中影响 cultivationExp 的（体质已在上方独立计算）
  for (const s of (state.activeStatuses || []).filter(status => !isConstitutionStatus(status))) {
    for (const eff of s.effects || []) {
      if (eff.target_attribute === 'cultivationExp') {
        if (eff.operation === 'multiply' && eff.value > 0) {
          factors.push({
            name: s.name,
            value: eff.value,
            operation: 'multiply',
            rarity: s.rarity as any,
            note: '奇缘加持',
          });
        } else if (eff.operation === 'add' && eff.value !== 0) {
          factors.push({
            name: s.name,
            value: eff.value,
            operation: 'add',
            rarity: s.rarity as any,
            note: '奇缘加成',
          });
        }
      }
    }
  }
  // 5. Task 22: 心魔值惩罚（仅当 >= 30 显示）
  const hd = state.heartDemon ?? 0;
  if (hd >= 30) {
    const penalty = Math.min(0.7, Math.floor((hd - 20) / 10) * 0.1);
    factors.push({
      name: '心魔侵扰',
      value: 1 - penalty, // 显示为 ×0.9 / ×0.8 / ...
      operation: 'multiply',
      rarity: hd >= 90 ? 'mythic' : hd >= 60 ? 'legendary' : 'epic',
      note: `心魔值 ${hd}/100，道心不稳`,
    });
  }
  // 6. Task 23: 灵宠陪伴效应
  if (state.pets && state.pets.length > 0) {
    const petBonus = computePetPassiveBonus(state).cultivationRate;
    if (petBonus > 0) {
      // 取最高稀有度的灵宠代表
      const topPet = [...state.pets].sort((a, b) => {
        const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
        return order.indexOf(b.rarity) - order.indexOf(a.rarity);
      })[0];
      factors.push({
        name: `灵宠陪伴（${state.pets.length}只）`,
        value: 1 + petBonus,
        operation: 'multiply',
        rarity: topPet.rarity as any,
        note: `${topPet.name}等灵宠伴修`,
      });
    }
  }
  return factors;
}

// 引擎权威：从 state 计算有效修炼速率
// multiplier = 灵根倍率 × 所有 multiply cultivationExp 效果之积（即 cultivationMultiplier）
// flatBonus  = 所有 add cultivationExp 效果之和（每岁固定修为加成，不受倍率影响）
// 前端顶部展示「×{multiplier} +{flatBonus}/岁」让玩家看清倍率与加成各自贡献
// 每岁修为增量公式：baseGain × multiplier + flatBonus（baseGain 由 AI 在 changes 里给）
export function computeEffectiveCultivationRate(state: CharacterState): { multiplier: number; flatBonus: number } {
  const rootInfo = SPIRITUAL_ROOTS[state.spiritualRoot];
  let multiplier = rootInfo?.multiplier ?? 0;
  let flatBonus = 0;
  for (const s of (state.activeStatuses || []).filter(isConstitutionStatus)) {
    if (hasCultivationEffect(s)) {
      for (const eff of s.effects || []) {
        if (eff.target_attribute !== 'cultivationExp') continue;
        if (eff.operation === 'multiply' && eff.value > 0) multiplier *= eff.value;
        else if (eff.operation === 'add') flatBonus += eff.value;
      }
    } else {
      multiplier *= getConstitutionCultivationMultiplier(s);
    }
  }
  for (const it of state.equipped || []) {
    if (!evaluateTechniqueCompatibility(state, it).usable) continue;
    for (const rawEff of it.effects || []) {
      const eff = adaptTechniqueEffect(state, it, rawEff);
      if (!eff || eff.target_attribute !== 'cultivationExp') continue;
      if (eff.operation === 'multiply' && eff.value > 0) multiplier *= eff.value;
      else if (eff.operation === 'add') flatBonus += eff.value;
    }
  }
  for (const s of (state.activeStatuses || []).filter(status => !isConstitutionStatus(status))) {
    for (const eff of s.effects || []) {
      if (eff.target_attribute !== 'cultivationExp') continue;
      if (eff.operation === 'multiply' && eff.value > 0) multiplier *= eff.value;
      else if (eff.operation === 'add') flatBonus += eff.value;
    }
  }
  // Task 22: 心魔值惩罚——30+ 修炼效率 -10%，每 10 点额外 -10%（60→-40%，90→-70%）
  // 心魔扰乱心神，难以入定，故修炼速度倍率折扣
  const hd = state.heartDemon ?? 0;
  if (hd >= 30 && multiplier > 0) {
    const penalty = Math.min(0.7, Math.floor((hd - 20) / 10) * 0.1); // 30→0.1, 40→0.2, ..., 90→0.7
    multiplier = Math.max(0, multiplier * (1 - penalty));
  }
  // Task 23: 灵宠陪伴效应——所有灵宠略微提升修炼速度倍率
  // 仅当 multiplier > 0（即已能修炼）时才生效，无灵根者灵宠无法可促其修炼
  if (multiplier > 0 && state.pets && state.pets.length > 0) {
    const petBonus = computePetPassiveBonus(state).cultivationRate;
    if (petBonus > 0) multiplier *= (1 + petBonus);
  }
  return { multiplier, flatBonus };
}


// 引擎权威：把修炼速度倍率与来源条目重算回状态。
// 用于买卖、战斗结算、物品移除等路径，防止已卖/已毁物品的旧加成残留。
export function normalizeCultivationState(state: CharacterState): CharacterState {
  const normalizedState: CharacterState = {
    ...state,
    hp: Math.max(0, Math.min(Number(state.hp ?? 0), Math.max(1, Number(state.maxHp ?? 1)))),
    mp: Math.max(0, Math.min(Number(state.mp ?? 0), Math.max(0, Number(state.maxMp ?? 0)))),
    inventory: (state.inventory || []).map(normalizeCultivationBearingItem),
    equipped: (state.equipped || []).map(normalizeCultivationBearingItem),
    activeStatuses: normalizeIdentityStatuses(filterMeaningfulStatuses(state.activeStatuses || [])),
  };
  const rate = computeEffectiveCultivationRate(normalizedState);
  return {
    ...normalizedState,
    cultivationMultiplier: rate.multiplier,
    activeStatuses: normalizedState.activeStatuses,
    cultivationFactors: computeCultivationFactors(normalizedState),
  };
}

// 默认 equipNote（玩家点装备时若物品无 equipNote 则按类型生成）

// ==================== 年度属性成长（沉浸版 Phase-N + Phase-8）====================
// 之前 advance-sse 用 Math.max(state.xxx, baseline_age_formula) 兜底，导致出生定下的值永远锁死、
// 后续年份 spiritualSense/soulStrength/physicalFoundation 不再增长 → 派生 force/guard/agility 也不动。
// 本函数在每年推进时按「主角当前 age / realm / rootMultiplier / 出身 / 族裔」算 baseline delta，
// 只在 baseline > current 时推 current（修真者 current 永远不被压低），保证年度成长可见。
//
// 同时维护 force / guard / agility（破势 / 护持 / 机变）的派生——这三项由 8 维 + comprehension/luck 派生，
// 主项增长后自动刷新，不需要单独存。
export interface AnnualAttributeGrowth {
  state: CharacterState;
  growth: {
    attack: number;
    defense: number;
    speed: number;
    spiritualSense: number;
    soulStrength: number;
    physicalFoundation: number;
    maxHp: number;
    maxMp: number;
    force: number;
    guard: number;
    agility: number;
  };
  baseline: {
    attack: number;
    defense: number;
    speed: number;
    spiritualSense: number;
    soulStrength: number;
    physicalFoundation: number;
    maxHp: number;
    maxMp: number;
  };
}

/** 凡人肉身地板的封顶岁数：过了壮年，肉身不再随年岁自然见长。 */
export const MORTAL_BASELINE_PEAK_AGE = 60;

export function applyAnnualAttributeGrowth(state: CharacterState): AnnualAttributeGrowth {
  const age = Math.max(0, Number(state.age || 0));
  const realm = String(state.realm || 'mortal');
  const mul = Number(state.rootMultiplier ?? 0.3);
  // 修真后灵根倍率不再主导（realm 自己给大倍率）；mul 只在凡人段补底
  const effectiveMul = realm === 'mortal' ? Math.max(0.1, mul) : 1.0;
  // 凡人 baseline：放大成长系数，确保每年都能涨一点（避免「出生定值 > 年龄公式」导致 delta 一直 0）
  // 修真者 current 远高于 baseline 时仍 max() 取 current，逻辑不变
  // 2026-08-31：兜底按岁数封顶。
  // 旧版这几条随年龄无限线性涨，活到三百岁体魄兜底就有七百多，
  // 而寿元又按体魄算加成——活得久 → 体魄高 → 活得更久，自己喂自己。
  // 这几条本就只是凡人肉身的地板，肉身过了壮年不再长，所以按壮年封顶；
  // 修真者的真实数值由 deriveCoreCultivationAttributes 按境界推，不受这里影响。
  // 取 max() 保底，老存档已经涨上去的数值不会被压回。
  const bodyAge = Math.min(age, MORTAL_BASELINE_PEAK_AGE);
  const baselineAttack = Math.max(1, Math.floor(bodyAge * 1.2 * effectiveMul));
  const baselineDefense = Math.max(1, Math.floor(bodyAge * 0.8 * effectiveMul));
  const baselineSpeed = Math.max(3, 3 + Math.floor(bodyAge * 0.7 * effectiveMul));
  const baselinePF = Math.max(1, Math.round(5 + bodyAge * 2.5 * effectiveMul));
  const baselineSS = Math.max(1, 3 + Math.floor(bodyAge * 0.8 * effectiveMul));
  const baselineSoul = Math.max(1, 3 + Math.floor(bodyAge * 0.7 * effectiveMul));
  const baselineMaxHp = Math.max(10, 30 + bodyAge * 4);
  const baselineMaxMp = Math.max(0, 10 + Math.floor(bodyAge * 0.8));

  // 修真后 8 维由 deriveCoreCultivationAttributes 按 age × profile_power 推——为了保证"每年成长可见"，
  // 在这里按 age 增量强制刷一次（每次 +age 时 derive 都会重算，但 firstNumber 短路会读到 state 上的旧值；
  // 我们直接把 state 上的 8 维重置为 deriveCoreCultivationAttributes 当岁算出的值，让 delta 可见）。
  const core = deriveCoreCultivationAttributes(state);

  const newAttack = Math.max(state.attack || 0, baselineAttack);
  const newDefense = Math.max(state.defense || 0, baselineDefense);
  const newSpeed = Math.max(state.speed || 0, baselineSpeed);
  const newMaxHp = Math.max(state.maxHp || 0, baselineMaxHp);
  const newMaxMp = Math.max(state.maxMp || 0, baselineMaxMp);
  const newPF = Math.max(state.physicalFoundation || 0, core.physicalFoundation, baselinePF);
  const newSS = Math.max(state.spiritualSense || 0, core.spiritualSense, baselineSS);
  const newSoul = Math.max(state.soulStrength || 0, core.soulStrength, baselineSoul);

  const growth: AnnualAttributeGrowth['growth'] = {
    attack: newAttack - (state.attack || 0),
    defense: newDefense - (state.defense || 0),
    speed: newSpeed - (state.speed || 0),
    spiritualSense: newSS - (state.spiritualSense || 0),
    soulStrength: newSoul - (state.soulStrength || 0),
    physicalFoundation: newPF - (state.physicalFoundation || 0),
    maxHp: newMaxHp - (state.maxHp || 0),
    maxMp: newMaxMp - (state.maxMp || 0),
    force: 0,
    guard: 0,
    agility: 0,
  };

  const nextState: CharacterState = {
    ...state,
    attack: newAttack,
    defense: newDefense,
    speed: newSpeed,
    maxHp: newMaxHp,
    maxMp: newMaxMp,
    spiritualSense: newSS,
    soulStrength: newSoul,
    physicalFoundation: newPF,
    // hp/mp 上限若提升，按上限补满（避免血条出现"超出血量"不一致）
  };
  if ((nextState.hp ?? 0) > nextState.maxHp) nextState.hp = nextState.maxHp;
  if ((nextState.mp ?? 0) > nextState.maxMp) nextState.mp = nextState.maxMp;

  // 派生 force / guard / agility（破势 / 护持 / 机变）—— 在派生时使用 nextState 的新值
  const newForce = Math.max(0, Math.round((nextState.attack || 0) + (nextState.spiritualSense || 0) * 0.12 + (nextState.comprehension || 0) * 0.08));
  const newGuard = Math.max(0, Math.round((nextState.defense || 0) + (nextState.physicalFoundation || 0) * 0.16 + (nextState.soulStrength || 0) * 0.06));
  const newAgility = Math.max(0, Math.round((nextState.speed || 0) + (nextState.spiritualSense || 0) * 0.10 + (nextState.luck || 0) * 0.04));
  // 把派生写进 combatProjection，UI 读取它即可看到破势/护持/机变增长
  const prevProj = (state as any).combatProjection || {};
  growth.force = newForce - (Number(prevProj.force) || 0);
  growth.guard = newGuard - (Number(prevProj.guard) || 0);
  growth.agility = newAgility - (Number(prevProj.agility) || 0);
  nextState.combatProjection = {
    ...prevProj,
    force: newForce,
    guard: newGuard,
    agility: newAgility,
    spiritualAwareness: nextState.spiritualSense,
    soulStability: nextState.soulStrength,
    bodyTenacity: nextState.physicalFoundation,
  };

  return {
    state: nextState,
    growth,
    baseline: {
      attack: baselineAttack,
      defense: baselineDefense,
      speed: baselineSpeed,
      spiritualSense: baselineSS,
      soulStrength: baselineSoul,
      physicalFoundation: baselinePF,
      maxHp: baselineMaxHp,
      maxMp: baselineMaxMp,
    },
  };
}
