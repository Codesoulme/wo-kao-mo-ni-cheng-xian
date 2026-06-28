// 修仙模拟器 - 引擎核心
// 引擎权威：所有 AI 提议的变更必须经引擎校验与执行
// AI Proposes：AI 输出是"提议"，引擎有权拒绝、修改、钳制

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
  // Task 24: 秘境探索系统
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
  // AI-67
  HeartDemonType,
  // AI-68
  WorldTier,
  AscensionRequirement,
  AscensionSession,
  // AI-70
  Restriction,
  // ===== Worker A (AI-81~AI-85) additive imports =====
  CombatStance,
  CombatStanceUsage,
  CombatResourceType,
  CombatResourceUsage,
  BreakthroughStage,
  BreakthroughAttempt,
  ComboChain,
  COMBAT_STANCE_LABEL,
  // ===== Worker C (phase-h-p2-mid) additive imports =====
  WorldRegion,
  RegionTier,
  LocationNode,
  TravelRoute,
  WorldMap,

  COMBAT_RESOURCE_LABEL,
  BREAKTHROUGH_STAGE_LABEL,
  // ===== Worker A (phase-h-p2-mid) additive imports (Sect Relation Graph) =====
  SectFaction,
  SectRelation,
  SectNode,
  SectRelationEdge,
  SectRelationGraph,

  // ===== Phase-I Worker D: Ending Spectrum imports =====
  EndingArchetype,
  EndingCondition,
  EndingChoice,
  EndingOutcome,
  EndingPathMap,
  // ===== Phase-I Worker A (phase-i-p3-long) Multi-Character Inheritance imports =====
  InheritanceKind,
  InheritanceRecipient,
  InheritanceClaim,
  InheritanceChain,
  InheritancePool,
} from './types';
import {
  // ===== Worker A (AI-91/AI-92/AI-93/AI-95/AI-96/AI-97/AI-98/AI-99/AI-100/AI-101/AI-103) additive imports =====
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
  // ===== Worker B (AI-H3xx) NPC long-term memory types =====
  NPCMemoryTier,
  NPCMemory,
  NPCMemoryCluster,
  NPCBehaviorInfluence,
  // ===== Worker B (AI-I4xx) 宗门兴衰 types =====
  SectPhase,
  SectEvent,
  SectPowerMetric,
  SectTrajectory,
  SectInfluenceMap,
} from './types';
import { COMBAT_PROJECTION_LABELS, sanitizeLootName, sanitizeNarrativeText } from './display';
import { hasRealmEntryRequirement } from './secret-realm-utils';
import { resolveAttributeChanges } from './effect-resolver';
import { inferAttributeChangesFromNarrative } from './narrative-inference';
import { applyAgeBasedBodyGrowth } from './body-growth';
import { validateAIBoundary, BoundaryValidationTrace } from './ai-boundary-validator';
import { buildStateChangeLog, StateChangeLogEntry } from './state-change-log';
import { buildEventSchedulerPlan } from './event-scheduler';
import {
  registerItem,
  registerMany,
  registerStatus,
  registerThread,
  registerNpc,
  ValidationTrace,
} from './content-registry';

// ==================== 角色状态序列化 ====================

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
  const storageCapacity = c.storageCapacity ?? 5;
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
    // Task 23 新字段
    pets: safeParse<Pet[]>((c as any).petsJson || '[]', []),
    // Task 24 新字段
    exploredRealms: safeParse<ExplorationRecord[]>((c as any).exploredRealmsJson || '[]', []),
    npcs: safeParse<WorldNpc[]>((c as any).npcsJson || '[]', []),
    causalGraph: safeParse<CausalGraph>((c as any).causalGraphJson || '{ "nodes": [], "edges": [] }', { nodes: [], edges: [] }),
    worldFacts: safeParse<WorldFact[]>((c as any).worldFactsJson || '[]', []),
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
  const spiritualSense = Math.round(firstNumber(
    (state as any).spiritualSense,
    attributeNumber(state, ['spiritualSense', '\u795e\u8bc6']),
    5 + realmIdx * 24 + levelRatio * 18 + (state.comprehension || 0) * 0.45 + (state.maxMp || 0) * 0.04,
  )! * profilePower);
  const soulStrength = Math.round(firstNumber(
    (state as any).soulStrength,
    attributeNumber(state, ['soulStrength', '\u9b42\u9b44', '\u795e\u9b42', '\u5143\u795e']),
    8 + realmIdx * 22 + levelRatio * 16 + (state.comprehension || 0) * 0.35 - (state.heartDemon || 0) * 0.15,
  )! * profilePower);
  const physicalFoundation = Math.round(firstNumber(
    (state as any).physicalFoundation,
    attributeNumber(state, ['physicalFoundation', '\u4f53\u9b44', '\u8089\u8eab', '\u6839\u9aa8']),
    20 + realmIdx * 18 + levelRatio * 12 + (state.maxHp || 0) * 0.08 + (state.defense || 0) * 0.2,
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


function clampProfileNumber(n: any, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

function sanitizeRealmProfile(raw: any): RealmProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const profile: RealmProfile = {};
  const rawName = raw.name ? String(raw.name).trim() : '';
  if (rawName && !/候补|杂役|弟子|门人|执事|长老|宗主|身份|职位|职司|差役|仆役/.test(rawName)) profile.name = rawName.slice(0, 16);
  if (raw.shortName && !/候补|杂役|弟子|门人|执事|长老|身份|职位/.test(String(raw.shortName))) profile.shortName = String(raw.shortName).slice(0, 3);
  if (/^#[0-9a-fA-F]{6}$/.test(String(raw.color || ''))) profile.color = String(raw.color);
  if (raw.maxLevel !== undefined) profile.maxLevel = Math.round(clampProfileNumber(raw.maxLevel, 0, 999, 9));
  if (raw.powerMultiplier !== undefined) profile.powerMultiplier = clampProfileNumber(raw.powerMultiplier, 0.5, 9, 1);
  if (raw.expMultiplier !== undefined) profile.expMultiplier = clampProfileNumber(raw.expMultiplier, 0.2, 20, 1);
  if (raw.reason) profile.reason = String(raw.reason).slice(0, 120);
  if (raw.traits && typeof raw.traits === 'object') {
    const rawTraits = raw.traits as Record<string, any>;
    profile.traits = {};
    for (const key of ['cultivationMode', 'bottleneck', 'breakthroughTrial', 'socialWeight'] as const) {
      if (rawTraits[key]) (profile.traits as any)[key] = String(rawTraits[key]).slice(0, 160);
    }
    for (const key of ['capabilities', 'limitations', 'worldAccess', 'combatStyle', 'resourceNeeds', 'riskTags'] as const) {
      if (Array.isArray(rawTraits[key])) (profile.traits as any)[key] = rawTraits[key].map(String).filter(Boolean).slice(0, 6);
    }
    if (!Object.keys(profile.traits).length) delete profile.traits;
  }
  return Object.keys(profile).length ? profile : undefined;
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

function applyRealmProfilePatch(state: CharacterState, patch?: RealmProfile): CharacterState {
  const profile = sanitizeRealmProfile(patch);
  if (!profile) return state;
  const current = getRealmProfile(state) || {};
  return { ...state, realmProfile: { ...current, ...profile } };
}

function realmPowerMultiplier(state: CharacterState): number {
  return clampProfileNumber(getRealmProfile(state)?.powerMultiplier, 0.5, 9, 1);
}

function scaleByRealmPower(value: number, mult: number): number {
  return Math.max(1, Math.floor(value * mult));
}

// ==================== 属性变更应用 (引擎权威) ====================

// AI 可影响的属性白名单 + 钳制范围
// 注意：age（年龄）不在白名单内——年龄推进是引擎独占职责
//   - advance 流程：引擎 state.age += 1
//   - interfere 流程：引擎根据 AI 的 ageAdvance 字段推进
//   AI 不得通过 changes 直接修改 age，否则会与引擎推进叠加导致跳岁
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
export interface ItemEffectResolveResult {
  state: CharacterState;
  appliedChanges: AttributeChange[];
  rejectedChanges: AttributeChange[];
  effectResolveTrace: EffectResolveTrace[];
  effectResolveWarnings: string[];
}

export interface ItemActionResult extends ItemEffectResolveResult {
  ok: boolean;
  error?: string;
  item?: ItemEntry;
}

function emptyItemActionResult(state: CharacterState, ok = false, error?: string, item?: ItemEntry): ItemActionResult {
  return { state, ok, error, item, appliedChanges: [], rejectedChanges: [], effectResolveTrace: [], effectResolveWarnings: [] };
}

export function resolveItemEffects(state: CharacterState, item: ItemEntry, sign: 1 | -1, label?: string): ItemEffectResolveResult {
  const changes: AttributeChange[] = [];
  const compat = evaluateTechniqueCompatibility(state, item);
  if (sign > 0 && !compat.usable) {
    return {
      state,
      appliedChanges: [],
      rejectedChanges: [],
      effectResolveTrace: [{ severity: 'warning', code: 'technique_requirement_unmet', source: label || item.name, message: `${item.name}\u672a\u6ee1\u8db3\u4fee\u4e60\u6761\u4ef6\uff1a${compat.reasons.join('\uff1b') || '\u6839\u57fa\u4e0d\u5408'}` }],
      effectResolveWarnings: compat.warnings,
    };
  }
  for (const rawEff of item.effects || []) {
    const eff = sign > 0 ? adaptTechniqueEffect(state, item, rawEff) : rawEff;
    if (!eff) continue;
    if (eff.operation === 'add' && ATTRIBUTE_BOUNDS[eff.target_attribute]) {
      changes.push({
        attribute: eff.target_attribute,
        delta: sign * eff.value,
        reason: label || (sign > 0 ? `\u83b7\u5f97 ${item.name}` : `\u5931\u53bb ${item.name}`),
      });
    }
  }
  if (!changes.length) return { state, appliedChanges: [], rejectedChanges: [], effectResolveTrace: [], effectResolveWarnings: [] };
  const resolved = resolveAttributeChanges(state, changes, {
    bounds: ATTRIBUTE_BOUNDS,
    source: label || item.name || 'item-action',
  });
  const extraTrace: EffectResolveTrace[] = [];
  if (sign > 0 && compat.profile && compat.adaptation < 0.98) {
    extraTrace.push({ severity: 'warning', code: 'technique_adaptation_reduced', source: label || item.name, message: `${item.name}\u9002\u914d\u4e0d\u8db3\uff1a${compat.warnings.join('\uff1b')}` });
  }
  return {
    state: resolved.state,
    appliedChanges: resolved.appliedChanges,
    rejectedChanges: resolved.rejectedChanges,
    effectResolveTrace: [...resolved.trace, ...extraTrace],
    effectResolveWarnings: [...resolved.trace.filter(trace => trace.severity !== 'info').map(trace => trace.message), ...compat.warnings],
  };
}

export function applyItemEffects(state: CharacterState, item: ItemEntry, sign: 1 | -1): CharacterState {
  return resolveItemEffects(state, item, sign).state;
}

// 重算修炼倍率 = 灵根倍率 × 所有已装备物品与状态词条的 multiply cultivationExp 效果之积
// 统一委托给 computeEffectiveCultivationRate（同时算 flatBonus，保持口径一致）
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

const CONSTITUTION_NAME_RE = /体质|道体|圣体|灵体|剑体|雷体|火体|水体|木体|金体|土体|仙体|魔体|妖体|宝体|血脉|仙骨|灵骨|道骨|根骨|先天|天赋/;

export function isConstitutionStatus(status: Partial<StatusEntry> | null | undefined): boolean {
  if (!status || !status.name) return false;
  if (status.constitution) return true;
  if (status.category === 'constitution') return true;
  const text = `${status.name || ''} ${status.description || ''} ${status.source || ''}`;
  return status.category === 'special' && CONSTITUTION_NAME_RE.test(text);
}

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
    for (const rawEff of it.effects || []) {
      const eff = adaptTechniqueEffect(state, it, rawEff);
      if (!eff) continue;
      if (eff.target_attribute === 'cultivationExp') {
        if (eff.operation === 'multiply' && eff.value > 0) {
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
const DEFAULT_EQUIP_NOTE: Record<string, string> = {
  weapon: '手持', armor: '身穿', accessory: '佩戴', artifact: '悬身', scripture: '修习',
};


type ItemRarity = ItemEntry['rarity'];

function safeRarityIndex(rarity?: string): number {
  const idx = rarityIndex(String(rarity || 'common'));
  return idx >= 0 ? idx : 0;
}

function clampRarityIndex(idx: number): ItemRarity {
  return RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, idx))] as ItemRarity;
}

function makeLootId(prefix = 'loot'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function stripLootOwnerPrefix(name?: string): string {
  const text = String(name || '').trim();
  if (!text) return text;
  const match = text.match(/^(.{1,10})的(.{2,24})$/u);
  if (!match) return text;
  const [, owner, objectName] = match;
  const ownerLooksLikeEnemy = /修|汉|客|徒|信使|匪|贼|妖|兽|狼|虎|蛇|蛛|狐|猿|魔|邪|劫|道人|真人|老祖|敌|疤|牙|瘦|胖|黑衣|蒙面/.test(owner);
  const objectLooksLikeLoot = /符|剑|刀|珠|环|甲|袍|幡|铃|镜|印|袋|丹|诀|经|玉简|法器|法宝|护/.test(objectName);
  return ownerLooksLikeEnemy && objectLooksLikeLoot ? objectName : text;
}

const ELEMENT_KEYS = ['metal', 'wood', 'water', 'fire', 'earth'] as const;

function realmIndexOf(realm?: string): number {
  if (!realm) return -1;
  return REALMS.findIndex(r => r.id === realm || r.name === realm || r.shortName === realm);
}


function statusTextPool(state: CharacterState): string {
  return [
    state.faction || '',
    state.master || '',
    ...(state.activeStatuses || []).flatMap(st => [st.name, st.description, st.source]),
    ...(state.longTermMemory || []),
  ].join(';');
}

function activeConstitutionStatuses(state: CharacterState): StatusEntry[] {
  return (state.activeStatuses || []).filter(status => Boolean(status.constitution));
}

function constitutionTechniqueResonance(state: CharacterState, item: ItemEntry, profile: TechniqueProfile): { bonus: number; warnings: string[] } {
  const constitutions = activeConstitutionStatuses(state);
  if (!constitutions.length) return { bonus: 1, warnings: [] };
  const text = [
    item.name,
    item.description,
    profile.traits?.map(t => `${t.name}${t.description}`).join(' '),
    profile.spell ? `${profile.spell.name}${profile.spell.description}` : '',
  ].filter(Boolean).join(' ');
  let bonus = 1;
  const warnings: string[] = [];
  for (const status of constitutions) {
    const c = status.constitution;
    if (!c) continue;
    const elementHit = c.elementAffinity?.some(el => profile.requirements?.minElements?.[el] || text.includes(ELEMENTS[el].name));
    const keywordHit = c.techniqueKeywords?.some(keyword => keyword && text.includes(keyword));
    const tagHit = c.resonanceTags?.some(tag => tag && text.toLowerCase().includes(String(tag).toLowerCase()));
    if (elementHit || keywordHit || tagHit) {
      const stageBonus = Math.max(0, Math.min(0.18, 0.06 * Math.max(1, c.currentStage || 1)));
      bonus += stageBonus;
      warnings.push(`${status.name}与${item.name}气机相合，适配略有提升。`);
    }
    if (c.riskType === 'heart_demon' && /火|炎|阳|魔|煞|血/.test(text)) {
      warnings.push(`${status.name}火性或煞性相激，强行催动时更容易牵动心魔。`);
    }
    if (c.riskType === 'backlash' && safeRarityIndex(item.rarity) >= 3) {
      warnings.push(`${status.name}能容纳高阶法门，但错纳异力时反噬也更重。`);
    }
  }
  return { bonus: Number(Math.min(1.25, bonus).toFixed(2)), warnings };
}

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




function inferDominantElementFromText(text: string): ElementType | 'none' {
  if (/金|剑|刃|锋|metal|sword|blade|sharp|jin/i.test(text)) return 'metal';
  if (/木|花|草|藤|青|生|药|wood|flower|plant|green|life|mu/i.test(text)) return 'wood';
  if (/水|冰|寒|潮|water|ice|cold|tide|shui/i.test(text)) return 'water';
  if (/火|炎|阳|焰|fire|flame|sun|yang|huo/i.test(text)) return 'fire';
  if (/土|山|岩|岳|earth|mountain|rock|tu/i.test(text)) return 'earth';
  return 'none';
}

function cleanTechniqueBaseName(name?: string): string {
  const raw = String(name || '').trim();
  const cleaned = raw
    .replace(/[\u300a\u300b<>]/g, '')
    .replace(/(玉简|心得|功法|法门|残篇|真经|经卷|剑经|经|诀|法|功|术|谱)$/u, '')
    .trim();
  return (cleaned || raw || '\u7075\u673a').slice(0, 12);
}

function fallbackScriptureAbilityName(item: ItemEntry, element: ElementType | 'none', text: string): string {
  if (/\u5251|sword|blade/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u5251\u5f0f`;
  if (/\u5200|\u5203|blade|sabre/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u5203\u5f0f`;
  if (/\u96f7|thunder|lightning/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u96f7\u5f15`;
  if (/\u706b|\u708e|\u7130|fire|flame/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u706b\u6cd5`;
  if (/\u6c34|\u51b0|\u6f6e|water|ice|tide/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u6f6e\u6cd5`;
  if (/\u6728|\u82b1|\u85e4|\u9752|wood|flower|plant/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u9752\u6728\u672f`;
  if (/\u571f|\u5c71|\u5ca9|earth|mountain|rock/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u5ca9\u5cb3\u672f`;
  if (element === 'metal') return `${cleanTechniqueBaseName(item.name)}\u91d1\u950b\u672f`;
  if (element === 'wood') return `${cleanTechniqueBaseName(item.name)}\u751f\u673a\u672f`;
  if (element === 'water') return `${cleanTechniqueBaseName(item.name)}\u51dd\u6ce2\u672f`;
  if (element === 'fire') return `${cleanTechniqueBaseName(item.name)}\u708e\u606f\u672f`;
  if (element === 'earth') return `${cleanTechniqueBaseName(item.name)}\u539a\u571f\u672f`;
  return `${cleanTechniqueBaseName(item.name)}\u672f\u5f0f`;
}

function fallbackTechniqueAbility(item: ItemEntry, source: 'scripture' | 'artifact'): { name: string; description: string; element: ElementType | 'none'; trigger?: ArtifactAbility['trigger'] } {
  const text = `${item.name || ''}${item.description || ''}`;
  const element = inferDominantElementFromText(text);
  const isSword = /\u5251|sword|blade/i.test(text);
  const isWater = /\u6c34|\u51b0|\u6f6e|water|ice|tide/i.test(text);
  const isProtect = /\u62a4|\u76fe|\u5b88|\u7f69|protect|shield|guard/i.test(text);
  const trigger: ArtifactAbility['trigger'] = isWater ? 'underwater' : isProtect ? 'auto' : 'active';
  const name = source === 'artifact'
    ? (isProtect ? '\u62a4\u8eab\u7075\u7981' : isWater ? '\u907f\u6c34\u7075\u7981' : isSword ? '\u5251\u7eb9\u7075\u7981' : `${cleanTechniqueBaseName(item.name)}\u7075\u7981`)
    : fallbackScriptureAbilityName(item, element, text);
  const description = source === 'artifact'
    ? '\u6cd5\u5b9d\u5185\u85cf\u7075\u7981\u88ab\u50ac\u52a8\uff0c\u5f62\u6210\u4e00\u9053\u72ec\u7acb\u4e8e\u5668\u7269\u672c\u540d\u7684\u5668\u672f\u6548\u679c\u3002'
    : `\u4f9d${item.name || '\u6b64\u95e8\u529f\u6cd5'}\u7684\u884c\u6c14\u8109\u7edc\u51dd\u6210\u6597\u6cd5\u672f\u5f0f\uff0c\u4e0d\u76f4\u63a5\u590d\u7528\u529f\u6cd5\u672c\u540d\u3002`;
  return { name, description, element, trigger };
}


function describeArtifactAbilitiesOnItem(item: ItemEntry): ItemEntry {
  if (item.item_type !== 'artifact') return item;
  const profile = item.technique || inferTechniqueProfile(item);
  const abilities = profile?.artifactAbilities || [];
  if (!abilities.length) return item;
  const abilityText = abilities.slice(0, 2)
    .map(ability => `${ability.name || '\u672a\u540d\u7075\u7981'}\uff1a${ability.description || '\u6b64\u7269\u5185\u85cf\u53ef\u50ac\u53d1\u7684\u7075\u7981\u672f\u5f0f\u3002'}`)
    .join('\uff1b');
  const baseDesc = item.description || '\u4e00\u4ef6\u6765\u5386\u672a\u660e\u7684\u6cd5\u5668\u3002';
  if (baseDesc.includes('\u5185\u85cf\u7075\u7981') || baseDesc.includes('\u81ea\u5e26\u672f\u5f0f')) return { ...item, technique: profile };
  return { ...item, technique: profile, description: `${baseDesc}\u5185\u85cf\u7075\u7981\uff1a${abilityText}` };
}

function combatArtKind(art: { sourceType?: string; itemId?: string }, state: CharacterState): 'technique' | 'spell' | 'artifact' {
  if (art.sourceType === 'artifact') return 'artifact';
  const item = art.itemId ? (state.equipped || []).find(it => it.id === art.itemId) : undefined;
  if (item?.item_type === 'artifact') return 'artifact';
  if (item?.item_type === 'scripture') return 'technique';
  return 'spell';
}

function buildSkillCombatOption(sk: NonNullable<CombatSession['playerSkills']>[number], idx: number, kind: 'technique' | 'spell' | 'artifact', session: CombatSession, sealed: boolean): CombatActionOption {
  return {
    id: `skill-${idx}`,
    name: sk.name,
    description: sk.description || (kind === 'technique' ? '\u501f\u529f\u6cd5\u884c\u6c14\u8def\u6570\u5e94\u6218\u3002' : '\u50ac\u52a8\u5df2\u638c\u63e1\u7684\u672f\u5f0f\u3002'),
    actionType: kind === 'technique' ? 'technique' : 'spell',
    source: kind === 'artifact' ? 'artifact' : kind,
    enabled: !sealed && session.playerMp >= (sk.mpCost || 0),
    disabledReason: sealed ? '\u7075\u529b\u53d7\u5236\uff0c\u96be\u4ee5\u6210\u5f62\u3002' : session.playerMp < (sk.mpCost || 0) ? '\u6cd5\u529b\u4e0d\u8db3\u3002' : undefined,
    skillIdx: idx,
    itemId: sk.itemId,
    mpCost: sk.mpCost || 0,
    risk: sk.adaptation != null && sk.adaptation < 0.7 ? '\u9002\u914d\u4e0d\u8db3\uff0c\u53ef\u80fd\u53cd\u566c\u6216\u5a01\u529b\u6298\u635f\u3002' : undefined,
    requiredItems: sk.itemId ? [sk.itemId] : undefined,
    tags: [kind],
    // 软提示：名称/描述含群攻语义时标为 aoe，供 UI 与 AI 参考；AI 仍可根据法术性质决定实际波及。
    targetScope: /群|范围|横扫|席卷|波及|全场|漫天|笼罩|风暴|燎原|万剑|阵|爆|扇/.test(`${sk.name || ''}${sk.description || ''}`) ? 'aoe' : undefined,
  };
}

function normalizeTechniqueProfile(item: ItemEntry, profile: TechniqueProfile): TechniqueProfile {
  const source = item.item_type === 'artifact' ? 'artifact' : 'scripture';
  const fallback = fallbackTechniqueAbility(item, source);
  const next: TechniqueProfile = { ...profile };
  if (next.spell && (!next.spell.name || next.spell.name === item.name || !next.spell.description || next.spell.description === item.description)) {
    next.spell = {
      ...next.spell,
      name: next.spell.name && next.spell.name !== item.name ? next.spell.name : fallback.name,
      description: next.spell.description && next.spell.description !== item.description ? next.spell.description : fallback.description,
      element: next.spell.element || fallback.element,
    };
  }
  if (next.artifactAbilities?.length) {
    next.artifactAbilities = next.artifactAbilities.map(ability => ({
      ...ability,
      name: ability.name && ability.name !== item.name ? ability.name : fallback.name,
      description: ability.description && ability.description !== item.description ? ability.description : fallback.description,
      element: ability.element || fallback.element,
      trigger: ability.trigger || fallback.trigger,
    }));
  }
  return next;
}

function inferTechniqueProfile(item: ItemEntry): TechniqueProfile | undefined {
  if (item.technique) return normalizeTechniqueProfile(item, item.technique);
  if (item.item_type !== 'scripture' && item.item_type !== 'artifact') return undefined;
  const text = `${item.name || ''}${item.description || ''}`;
  const requirements: TechniqueRequirement = {};
  const preferredRoots: SpiritualRoot[] = [];
  if (/metal|sword|blade|sharp|jin/i.test(text)) preferredRoots.push('pure', 'heavenly');
  if (/wood|green|life|plant|mu/i.test(text)) preferredRoots.push('common', 'pure', 'heavenly');
  if (/water|ice|cold|tide|shui/i.test(text)) preferredRoots.push('common', 'pure', 'heavenly');
  if (/fire|flame|sun|yang|huo/i.test(text)) preferredRoots.push('common', 'pure', 'heavenly');
  if (/earth|mountain|rock|tu/i.test(text)) preferredRoots.push('common', 'pure', 'heavenly');
  if (text.includes('\u5929\u7075\u6839') || text.includes('\u5355\u7075\u6839') || text.includes('\u7eaf')) requirements.spiritualRoots = ['pure', 'heavenly', 'chaos'];
  else if (text.includes('\u6df7\u6c8c') || text.includes('\u4e94\u884c\u4ff1\u5168') || text.includes('\u592a\u521d')) requirements.spiritualRoots = ['chaos'];
  else if (preferredRoots.length) requirements.preferredRoots = Array.from(new Set(preferredRoots));
  const ri = safeRarityIndex(item.rarity);
  if (item.item_type === 'scripture') {
    if (ri >= 5) requirements.minRealm = 'nascent_soul';
    else if (ri >= 4) requirements.minRealm = 'golden_core';
    else if (ri >= 3) requirements.minRealm = 'foundation';
    else if (ri >= 1) requirements.minRealm = 'qi_refining';
    requirements.minComprehension = ri >= 4 ? 70 : ri >= 3 ? 55 : ri >= 2 ? 40 : undefined;
  } else {
    if (ri >= 5) requirements.minRealm = 'golden_core';
    else if (ri >= 4) requirements.minRealm = 'foundation';
    else if (ri >= 2) requirements.minRealm = 'qi_refining';
    requirements.minComprehension = ri >= 4 ? 55 : ri >= 3 ? 40 : undefined;
  }
  const derivedAbility = fallbackTechniqueAbility(item, item.item_type === 'artifact' ? 'artifact' : 'scripture');
  const artifactAbilities = item.item_type === 'artifact'
    ? [{
      name: derivedAbility.name,
      description: derivedAbility.description,
      trigger: derivedAbility.trigger,
      element: derivedAbility.element,
      power: 1 + ri * 0.35,
      permanentBuff: derivedAbility.trigger === 'underwater' || derivedAbility.trigger === 'auto',
      rarityNote: ri >= 2 ? '\u6cd5\u5b9d\u54c1\u8d28\u8f83\u9ad8\uff0c\u81ea\u5e26\u53ef\u89e6\u53d1\u7684\u5668\u7269\u7075\u7981\u3002' : '\u53ea\u6709\u5c11\u6570\u51e1\u54c1\u6cd5\u5b9d\u4f1a\u7559\u6709\u7c97\u6d45\u7075\u7981\u3002',
    }]
    : undefined;
  return {
    kind: item.item_type === 'scripture' ? 'cultivation' : 'artifact',
    requirements,
    traits: item.item_type === 'scripture'
      ? [{ name: '\u884c\u529f\u8def\u7ebf', description: '\u4fee\u70bc\u65f6\u6539\u53d8\u5410\u7eb3\u8282\u5f8b\u4e0e\u7075\u6c14\u8fd0\u8f6c\uff0c\u5f71\u54cd\u957f\u671f\u4fee\u4e3a\u79ef\u7d2f\u3002' }]
      : [{ name: '\u5668\u7269\u7075\u7981', description: '\u6cd5\u5b9d\u7684\u7075\u7981\u968f\u4f69\u6234\u6216\u50ac\u52a8\u751f\u6548\uff0c\u4e0d\u7b49\u540c\u4e8e\u89d2\u8272\u5b66\u4f1a\u6b64\u6cd5\u672f\u3002' }],
    spell: item.item_type === 'scripture' && ['\u672f','\u8bc0','\u5251','\u706b','\u96f7','\u51b0','\u98ce','\u5370','\u638c','\u6307'].some(k => text.includes(k))
      ? { name: derivedAbility.name, description: derivedAbility.description, element: derivedAbility.element, power: 1 + safeRarityIndex(item.rarity) * 0.45 }
      : undefined,
    artifactAbilities,
    mismatchRisk: item.item_type === 'scripture'
      ? '\u5f3a\u884c\u4fee\u4e60\u4e0d\u5408\u6839\u6027\u7684\u6cd5\u95e8\uff0c\u8f7b\u5219\u8fdb\u5883\u8fdf\u6ede\uff0c\u91cd\u5219\u7075\u529b\u9006\u884c\u3002'
      : '\u6cd5\u5b9d\u7075\u7981\u53ef\u968f\u5668\u7269\u751f\u6548\uff0c\u4f46\u4fee\u4e3a\u4e0d\u8db3\u65f6\u4e3b\u52a8\u50ac\u52a8\u4f1a\u5a01\u529b\u6298\u51cf\u6216\u589e\u52a0\u53cd\u566c\u98ce\u9669\u3002',
  };
}

export function evaluateTechniqueCompatibility(state: CharacterState, item: ItemEntry): { usable: boolean; adaptation: number; reasons: string[]; warnings: string[]; profile?: TechniqueProfile } {
  const profile = inferTechniqueProfile(item);
  if (!profile) return { usable: true, adaptation: 1, reasons: [], warnings: [] };
  const req = profile.requirements || {};
  let adaptation = 1;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const strictRoots = req.spiritualRoots || [];
  if (strictRoots.length && !strictRoots.includes(state.spiritualRoot)) {
    return { usable: false, adaptation: 0, reasons: [`\u7075\u6839\u4e0d\u5408\uff1a\u9700${strictRoots.map(r => SPIRITUAL_ROOTS[r]?.name || r).join('\u3001')}`], warnings: ['\u6b64\u6cd5\u95e8\u7075\u6839\u8981\u6c42\u4e25\u82db\uff0c\u5f53\u524d\u6839\u6027\u51e0\u4e4e\u4e0d\u80fd\u5165\u95e8\u3002'], profile };
  }
  const preferred = req.preferredRoots || [];
  if (preferred.length && !preferred.includes(state.spiritualRoot) && state.spiritualRoot !== 'chaos') {
    adaptation *= 0.55;
    warnings.push('\u7075\u6839\u5e76\u975e\u6700\u4f73\u9002\u914d\uff0c\u4fee\u4e60\u6548\u7387\u5927\u5e45\u964d\u4f4e\u3002');
  }
  if (req.minRealm) {
    const need = realmIndexOf(req.minRealm);
    const cur = realmIndexOf(state.realm);
    if (cur >= 0 && need >= 0 && cur < need) {
      const gap = need - cur;
      adaptation *= Math.max(0.25, 1 - gap * 0.28);
      warnings.push(`\u5883\u754c\u672a\u81f3${REALMS[need]?.name || req.minRealm}\uff0c\u53ea\u80fd\u52c9\u5f3a\u53c2\u609f\u3002`);
    }
  }
  if (typeof req.minComprehension === 'number' && state.comprehension < req.minComprehension) {
    adaptation *= Math.max(0.35, state.comprehension / Math.max(1, req.minComprehension));
    warnings.push('\u609f\u6027\u4e0d\u8db3\uff0c\u53c2\u609f\u6b64\u6cd5\u8fdb\u5c55\u7f13\u6162\u3002');
  }
  for (const el of ELEMENT_KEYS) {
    const need = req.minElements?.[el];
    if (typeof need === 'number' && (state.elements?.[el] || 0) < need) {
      adaptation *= Math.max(0.35, (state.elements?.[el] || 0) / Math.max(1, need));
      warnings.push(`${ELEMENTS[el].name}\u884c\u611f\u5e94\u4e0d\u8db3\uff0c\u672f\u8def\u4e0d\u987a\u3002`);
    }
  }
  const resonance = constitutionTechniqueResonance(state, item, profile);
  if (resonance.bonus > 1 && adaptation > 0) {
    adaptation *= resonance.bonus;
    warnings.push(...resonance.warnings);
  }

  if (req.requiredStatuses?.length) {
    const pool = statusTextPool(state);
    const missing = req.requiredStatuses.filter(k => k && !pool.includes(k));
    if (missing.length) {
      adaptation *= 0.35;
      warnings.push(`\u7f3a\u5c11${missing.join('\u3001')}\u7b49\u524d\u7f6e\u56e0\u7f18\uff0c\u53ea\u80fd\u63e3\u6469\u76ae\u6bdb\u3002`);
    }
  }
  adaptation = Number(Math.max(0, Math.min(1.2, adaptation)).toFixed(2));
  if (adaptation >= 0.95) reasons.push('\u6cd5\u95e8\u4e0e\u5f53\u524d\u6839\u57fa\u76f8\u5408');
  else if (adaptation > 0) reasons.push(`\u6cd5\u95e8\u9002\u914d\u7ea6${Math.round(adaptation * 100)}%`);
  return { usable: adaptation > 0, adaptation, reasons, warnings, profile };
}

function isArtifactTechnique(profile?: TechniqueProfile): boolean {
  return profile?.kind === 'artifact' || Boolean(profile?.artifactAbilities?.length);
}

function artifactAbilityPower(ability: NonNullable<TechniqueProfile['artifactAbilities']>[number], compatAdaptation: number): number {
  const basePower = ability.power || 1;
  return Number((basePower * Math.max(0.4, compatAdaptation || 0.4)).toFixed(2));
}

function adaptTechniqueEffect(state: CharacterState, item: ItemEntry, eff: any): any {
  if (item.item_type !== 'scripture' && item.item_type !== 'artifact') return eff;
  const compat = evaluateTechniqueCompatibility(state, item);
  if (!compat.usable && !isArtifactTechnique(compat.profile)) return null;
  if (compat.adaptation >= 0.98) return eff;
  if (eff.target_attribute === 'cultivationExp') {
    if (eff.operation === 'multiply') {
      const value = 1 + Math.max(0, (Number(eff.value) - 1) * compat.adaptation);
      return { ...eff, value: Number(value.toFixed(2)), description: `${eff.description || item.name}\uff08\u9002\u914d${Math.round(compat.adaptation * 100)}%\uff0c\u6548\u529b\u6298\u51cf\uff09` };
    }
    if (eff.operation === 'add') {
      return { ...eff, value: Number((Number(eff.value) * compat.adaptation).toFixed(2)), description: `${eff.description || item.name}\uff08\u9002\u914d\u4e0d\u8db3\uff0c\u6536\u76ca\u6298\u51cf\uff09` };
    }
  }
  if (eff.operation === 'add') return { ...eff, value: Number((Number(eff.value) * compat.adaptation).toFixed(2)) };
  if (eff.operation === 'multiply' && Number(eff.value) > 1) return { ...eff, value: Number((1 + (Number(eff.value) - 1) * compat.adaptation).toFixed(2)) };
  return eff;
}

export function buildLearnedCombatArts(state: CharacterState): { itemId: string; name: string; description: string; mpCost: number; power: number; rarity?: string; sourceType?: string; element?: 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'none'; adaptation?: number }[] {
  return (state.equipped || [])
    .filter(it => it.item_type === 'scripture' || it.item_type === 'artifact')
    .flatMap(it => {
      const compat = evaluateTechniqueCompatibility(state, it);
      const profile = compat.profile;
      const rarityCost = it.rarity === 'mythic' ? 30 : it.rarity === 'legendary' ? 25 : it.rarity === 'epic' ? 20 : it.rarity === 'rare' ? 15 : 10;
      if (it.item_type === 'artifact') {
        const fallbackAbility = fallbackTechniqueAbility(it, 'artifact');
        const abilities = profile?.artifactAbilities?.length
          ? profile.artifactAbilities
          : [{ name: fallbackAbility.name, description: fallbackAbility.description, trigger: fallbackAbility.trigger, mpCost: rarityCost, power: 1 + safeRarityIndex(it.rarity) * 0.35, element: fallbackAbility.element }];
        return abilities.map(ability => ({
          itemId: it.id,
          name: ability.name,
          description: ability.description,
          mpCost: Math.max(0, Math.floor(ability.mpCost ?? (ability.trigger === 'passive' || ability.trigger === 'auto' || ability.trigger === 'underwater' ? 0 : rarityCost))),
          power: artifactAbilityPower(ability, compat.adaptation),
          rarity: it.rarity,
          sourceType: it.item_type,
          element: ability.element,
          adaptation: compat.adaptation,
        }));
      }
      if (!compat.usable) return [];
      const spell = profile?.spell;
      if (!spell && !(profile?.traits || []).length) return [];
      return [{
        itemId: it.id,
        name: spell?.name || fallbackTechniqueAbility(it, 'scripture').name,
        description: spell?.description || fallbackTechniqueAbility(it, 'scripture').description,
        mpCost: Math.max(5, Math.floor(spell?.mpCost || rarityCost)),
        power: Number(((spell?.power || (1 + safeRarityIndex(it.rarity) * 0.5)) * Math.max(0.25, compat.adaptation)).toFixed(2)),
        rarity: it.rarity,
        sourceType: it.item_type,
        element: spell?.element,
        adaptation: compat.adaptation,
      }];
    })
    .filter(Boolean)
    .slice(0, 8) as any;
}

function enemyLootTier(enemy: CombatEnemy, state: CharacterState): number {
  const text = `${enemy.name || ''} ${enemy.description || ''} ${enemy.realm || ''}`;
  const realmIdx = enemy.realm ? REALMS.findIndex(r => r.id === enemy.realm || r.name === enemy.realm) : -1;
  if (/大乘|渡劫|仙|魔尊|老祖|天君/.test(text) || realmIdx >= 6) return 5;
  if (/化神|元婴|魔君|长老/.test(text) || realmIdx >= 4) return 4;
  if (/金丹|结丹|真人|筑基后期/.test(text) || realmIdx >= 3) return 3;
  if (/筑基|执事|精英/.test(text) || realmIdx >= 2) return 2;
  if (/炼气|修士|邪修|魔修|劫修|散修/.test(text) || realmIdx >= 1) return 1;
  const playerRealmIdx = REALMS.findIndex(r => r.id === state.realm);
  return Math.max(0, Math.min(2, playerRealmIdx));
}


function enemyGearLootProfile(enemy: CombatEnemy, tier: number): { name: string; description: string; itemType: ItemEntry['item_type']; effectTarget: string; ability: ArtifactAbility } {
  const text = `${enemy.name || ''} ${enemy.description || ''}`;
  const title = String(enemy.name || '敌修').replace(/^(蒙面|黑衣|邪修|劫修)/u, '').trim() || '敌修';
  if (/剑|剑修/.test(text)) {
    return { name: '裂鸣剑', description: `从${title}手中夺下的飞剑，剑脊有新裂，仍能嗡鸣伤敌。`, itemType: 'weapon', effectTarget: 'attack', ability: { name: '裂鸣剑气', description: '催动时剑身发出裂鸣，放出一道锋锐剑气。', trigger: 'active', element: 'metal', power: 1.15 + tier * 0.25 } };
  }
  if (/魔|邪|血/.test(text)) {
    return { name: '血纹护符', description: `从${title}身上找到的血纹法器，凶煞未散，祭炼后可护体，也可能扰动心神。`, itemType: 'artifact', effectTarget: 'defense', ability: { name: '血纹煞幕', description: '法器自行浮起血色光幕，替主人挡下一波攻势。', trigger: 'auto', element: 'fire', power: 1.1 + tier * 0.2 } };
  }
  if (/水|潮|冰|江|河/.test(text)) {
    return { name: '潮纹护珠', description: `从${title}遗物中取得的水色法珠，内里有潮声回响，尚未在斗法中碎裂。`, itemType: 'artifact', effectTarget: 'defense', ability: { name: '潮息水幕', description: '法珠涌出一层潮息水幕，能缓去来袭力道。', trigger: 'auto', element: 'water', power: 1.1 + tier * 0.2 } };
  }
  if (/木|藤|花|草|青/.test(text)) {
    return { name: '青藤护腕', description: `从${title}身侧取下的青藤法器，藤纹尚能随灵机舒展。`, itemType: 'artifact', effectTarget: 'defense', ability: { name: '青藤绕身', description: '护腕中生出灵藤虚影，缠绕身周分担攻势。', trigger: 'auto', element: 'wood', power: 1.05 + tier * 0.2 } };
  }
  return { name: '残光护符', description: `从${title}身上搜得的护身法器，虽经斗法震荡，核心灵禁尚可重新祭炼。`, itemType: 'artifact', effectTarget: 'defense', ability: { name: '残光护幕', description: '法器中残存的灵光展开成薄幕，替主人卸去部分攻势。', trigger: 'auto', element: 'none', power: 1 + tier * 0.18 } };
}

function buildEnemyCarriedLoot(enemy: CombatEnemy, state: CharacterState, enemyIndex: number): { items: ItemEntry[]; spiritStones: number } {
  const text = `${enemy.name || ''} ${enemy.description || ''}`;
  const tier = enemyLootTier(enemy, state);
  const baseRarity = clampRarityIndex(Math.max(0, tier - 1));
  const betterRarity = clampRarityIndex(tier);
  const source = `${enemy.name || '敌修'}遗物`;
  const items: ItemEntry[] = [];
  const addItem = (name: string, description: string, item_type: ItemEntry['item_type'], rarity: ItemRarity, effects: any[], suffix: string, technique?: TechniqueProfile) => {
    const item: ItemEntry = { id: makeLootId(`loot_${enemyIndex}_${suffix}`), name, description, item_type, rarity, effects, source };
    if (technique) item.technique = technique;
    items.push(describeArtifactAbilitiesOnItem(item));
  };

  const title = enemy.name || '敌修';
  const isCultivator = /修|道人|魔|邪|劫|散人|真人|老祖|剑|宗|门/.test(text) || tier >= 1;
  const isBeast = /妖|兽|狼|虎|蛟|蛇|蛛|狐|猿|禽|鸟/.test(text);

  if (isCultivator) {
    addItem(
      '储物袋',
      `从${title}身侧搜得的小型储物法器，袋口禁制已散，可并入自身储物之用。`,
      'tool',
      baseRarity,
      [{ target_attribute: 'storageCapacity', operation: 'add', value: Math.max(8, 8 + tier * 10), description: `储物上限+${Math.max(8, 8 + tier * 10)}` }],
      'bag'
    );
    const gear = enemyGearLootProfile(enemy, tier);
    addItem(
      gear.name,
      gear.description,
      gear.itemType,
      betterRarity,
      [{ target_attribute: gear.effectTarget, operation: 'add', value: Math.max(6, 8 + tier * 8), description: gear.effectTarget === 'attack' ? `攻伐+${Math.max(6, 8 + tier * 8)}` : `护身+${Math.max(6, 8 + tier * 8)}` }],
      'gear',
      gear.itemType === 'artifact' ? { kind: 'artifact', artifactAbilities: [gear.ability], traits: [{ name: '随身灵禁', description: '此物本属敌修防身所用，夺得后需重新祭炼才能完全驱使。' }] } : undefined
    );
    addItem(
      tier >= 2 ? '回元丹' : '疗伤散',
      `藏在${title}储物袋中的应急丹药，瓶身尚未碎裂。`,
      'consumable',
      baseRarity,
      [{ target_attribute: tier >= 2 ? 'mp' : 'hp', operation: 'add', value: Math.max(30, 40 + tier * 35), description: tier >= 2 ? `回灵+${Math.max(30, 40 + tier * 35)}` : `疗伤+${Math.max(30, 40 + tier * 35)}` }],
      'pill'
    );
    if (tier >= 2 || /功法|秘术|邪|魔|血/.test(text)) {
      addItem(
        /邪|魔|血/.test(text) ? '残缺血煞诀' : '斗法心得玉简',
        /邪|魔|血/.test(text) ? '邪修随身携带的残缺法诀，凶险却也有可借鉴之处。' : '记有此人多年斗法心得的玉简。',
        'scripture',
        baseRarity,
        [{ target_attribute: 'cultivationExp', operation: 'multiply', value: Number((1.15 + tier * 0.15).toFixed(2)), description: `参悟修行×${Number((1.15 + tier * 0.15).toFixed(2))}` }],
        'scripture'
      );
    }
  } else if (isBeast) {
    addItem('妖兽内丹', `从${title}体内剖出的内丹，灵气未散。`, 'material', betterRarity, [{ target_attribute: 'cultivationExp', operation: 'add', value: Math.max(20, 35 + tier * 25), description: `炼化可增修为+${Math.max(20, 35 + tier * 25)}` }], 'core');
    addItem('妖兽利爪', `${title}遗下的坚硬利爪，可作炼器材料。`, 'material', baseRarity, [{ target_attribute: 'attack', operation: 'add', value: Math.max(3, 4 + tier * 4), description: `炼器攻材+${Math.max(3, 4 + tier * 4)}` }], 'claw');
  } else {
    addItem('残破护符', `战后从${title}身旁拾得，虽有裂纹，灵光尚存。`, 'accessory', baseRarity, [{ target_attribute: 'luck', operation: 'add', value: 1, description: '护身气运+1' }], 'charm');
  }

  const explicitDrops = Array.isArray(enemy.drops) ? enemy.drops : [];
  for (const d of explicitDrops.slice(0, 3)) {
    const rarity = clampRarityIndex(safeRarityIndex(d.rarity));
    addItem(String(d.name || '遗落材料'), `从${title}身上搜得，未在斗法中毁去。`, 'material', rarity, [], `drop_${items.length}`);
  }

  const explicitLoot = Array.isArray(enemy.lootItems) ? enemy.lootItems : [];
  const safeExplicitLoot = explicitLoot.slice(0, 6).map((it, idx) => ({
    ...it,
    id: it.id || makeLootId(`enemy_${enemyIndex}_${idx}`),
    source: it.source || source,
  }));

  const stonesBase = tier <= 0 ? 2 : 12 * Math.pow(2, tier - 1);
  const spiritStones = Math.max(0, Math.floor(Number(enemy.lootSpiritStones ?? 0) || 0))
    + (isCultivator ? Math.max(5, Math.floor(stonesBase + Math.random() * stonesBase)) : 0);

  return { items: [...safeExplicitLoot, ...items], spiritStones };
}

export function buildCombatVictorySpoils(state: CharacterState, session: CombatSession, aiLoot?: CombatLootAIOutcome | null): { items: ItemEntry[]; spiritStones: number } {
  if (!session || session.status !== 'victory') return { items: [], spiritStones: 0 };
  const allItems: ItemEntry[] = [];
  let spiritStones = 0;

  // AI 主路径：战后由 AI 根据敌人身份/境界/携带资源生成战利品，引擎只去重、补 id、clamp 灵石。
  if (aiLoot && (Array.isArray(aiLoot.items) || Number(aiLoot.spiritStones) > 0)) {
    allItems.push(...(aiLoot.items || []).map((it, idx) => ({ ...it, name: stripLootOwnerPrefix(it.name), id: it.id || makeLootId(`ai_loot_${idx}`), source: it.source || '战利所得' })));
    spiritStones += Math.max(0, Math.floor(Number(aiLoot.spiritStones || 0)));
  } else {
    // AI 失败时才回退旧的敌人关键词模板。
    const enemies = session.enemies || [];
    enemies.forEach((enemy, idx) => {
      const loot = buildEnemyCarriedLoot(enemy, state, idx);
      allItems.push(...loot.items);
      spiritStones += loot.spiritStones;
    });
  }

  const triggerDrops = Array.isArray(session.victoryDrops) ? session.victoryDrops : [];
  allItems.push(...triggerDrops.map((it, idx) => ({ ...it, id: it.id || makeLootId(`drop_${idx}`), source: it.source || '战利所得' })));

  const seen = new Set<string>();
  const deduped = allItems.filter(item => {
    item.name = sanitizeLootName(stripLootOwnerPrefix(item.name));
    const key = `${item.name}|${item.item_type}|${item.rarity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(4, 6 + (session.enemies || []).length * 3));
  return { items: deduped, spiritStones };
}

// 装备物品（从 inventory 移到 equipped 数组末尾，不限制同类型数量）
// 不再替换同槽位物品——玩家可戴多个戒指、脖挂一串储物戒指等，由 AI 在 equipNote 中描述位置
export function equipItem(state: CharacterState, itemId: string): ItemActionResult {
  const idx = state.inventory.findIndex(it => it.id === itemId);
  if (idx < 0) return emptyItemActionResult(state, false, '物品不在储物中');
  const item = state.inventory[idx];
  const slot = itemToSlot(item.item_type);
  if (!slot) return emptyItemActionResult(state, false, '此物不可装备');
  if (isStorageBag(item)) return emptyItemActionResult(state, false, '储物袋只能随身携带，不可装备');

  const equippedItem: ItemEntry = {
    ...item,
    equipNote: item.equipNote || DEFAULT_EQUIP_NOTE[slot] || '装备',
  };
  let next: CharacterState = {
    ...state,
    inventory: state.inventory.filter(it => it.id !== itemId),
    equipped: [...(state.equipped || []), equippedItem],
  };
  const resolved = resolveItemEffects(next, equippedItem, 1, `装备 ${equippedItem.name}`);
  next = recalcCultivationMultiplier(resolved.state);
  return { ...resolved, state: next, ok: true, item: equippedItem };
}

export function unequipItem(state: CharacterState, itemId: string): ItemActionResult {
  const item = (state.equipped || []).find(it => it.id === itemId);
  if (!item) return emptyItemActionResult(state, false, '此物尚未装备');
  let next: CharacterState = {
    ...state,
    equipped: (state.equipped || []).filter(it => it.id !== itemId),
    inventory: [...state.inventory, item],
  };
  const resolved = resolveItemEffects(next, item, -1, `卸下 ${item.name}`);
  next = recalcCultivationMultiplier(resolved.state);
  return { ...resolved, state: next, ok: true, item };
}

export function consumeItem(state: CharacterState, itemId: string): ItemActionResult {
  const item = state.inventory.find(it => it.id === itemId);
  if (!item) return emptyItemActionResult(state, false, '物品不在储物中');
  if (item.item_type !== 'consumable') return emptyItemActionResult(state, false, '只有丹药等消耗品可直接使用');
  let next: CharacterState = {
    ...state,
    inventory: state.inventory.filter(it => it.id !== itemId),
  };
  const resolved = resolveItemEffects(next, item, 1, `使用 ${item.name}`);
  next = normalizeCultivationState(resolved.state);
  return { ...resolved, state: next, ok: true, item };
}

export function removeItemsByIds(state: CharacterState, ids: string[]): ItemEffectResolveResult & { removed: ItemEntry[] } {
  if (!ids.length) return { state, removed: [], appliedChanges: [], rejectedChanges: [], effectResolveTrace: [], effectResolveWarnings: [] };
  const idSet = new Set(ids);
  let next = { ...state };
  const removed: ItemEntry[] = [];
  const appliedChanges: AttributeChange[] = [];
  const rejectedChanges: AttributeChange[] = [];
  const effectResolveTrace: EffectResolveTrace[] = [];
  const effectResolveWarnings: string[] = [];
  const collect = (resolved: ItemEffectResolveResult) => {
    appliedChanges.push(...resolved.appliedChanges);
    rejectedChanges.push(...resolved.rejectedChanges);
    effectResolveTrace.push(...resolved.effectResolveTrace);
    effectResolveWarnings.push(...resolved.effectResolveWarnings);
    next = resolved.state;
  };
  // 从 inventory 移除
  const keptInv: ItemEntry[] = [];
  for (const it of state.inventory) {
    if (idSet.has(it.id)) removed.push(it);
    else keptInv.push(it);
  }
  next.inventory = keptInv;
  // 从 equipped 数组移除（并反向应用效果）
  if (next.equipped && next.equipped.length) {
    const keptEq: ItemEntry[] = [];
    for (const it of next.equipped) {
      if (idSet.has(it.id)) {
        removed.push(it);
        collect(resolveItemEffects(next, it, -1, `移除装备 ${it.name}`));
      } else {
        keptEq.push(it);
      }
    }
    next.equipped = keptEq;
    next = recalcCultivationMultiplier(next);
  }
  // 若移除的是储物袋，反向扣减 storageCapacity
  for (const it of removed) {
    if (isStorageBag(it)) {
      for (const eff of it.effects || []) {
        if (eff.target_attribute === 'storageCapacity' && eff.operation === 'add') {
          next.storageCapacity = Math.max(5, next.storageCapacity - eff.value);
        }
      }
    }
  }
  next = normalizeCultivationState(next);
  return { state: next, removed, appliedChanges, rejectedChanges, effectResolveTrace, effectResolveWarnings };
}

// AI 联动：按 id 将物品从 inventory 移到 equipped（AI 可在 interfere 中装备物品，并设置 equipNote）
export function equipItemsByIds(state: CharacterState, ids: string[]): ItemEffectResolveResult & { equipped: ItemEntry[] } {
  if (!ids.length) return { state, equipped: [], appliedChanges: [], rejectedChanges: [], effectResolveTrace: [], effectResolveWarnings: [] };
  const idSet = new Set(ids);
  let next = { ...state };
  const appliedChanges: AttributeChange[] = [];
  const rejectedChanges: AttributeChange[] = [];
  const effectResolveTrace: EffectResolveTrace[] = [];
  const effectResolveWarnings: string[] = [];
  const collect = (resolved: ItemEffectResolveResult) => {
    appliedChanges.push(...resolved.appliedChanges);
    rejectedChanges.push(...resolved.rejectedChanges);
    effectResolveTrace.push(...resolved.effectResolveTrace);
    effectResolveWarnings.push(...resolved.effectResolveWarnings);
    next = resolved.state;
  };
  const toEquip: ItemEntry[] = [];
  const keptInv: ItemEntry[] = [];
  const currentRealmIdx = REALMS.findIndex(r => r.id === state.realm);
  for (const it of state.inventory) {
    if (idSet.has(it.id)) {
      const minRealm = it.technique?.requirements?.minRealm;
      if (minRealm) {
        const minRealmIdx = REALMS.findIndex(r => r.id === minRealm);
        if (minRealmIdx >= 0 && currentRealmIdx < minRealmIdx) {
          effectResolveWarnings.push(`\u5883\u754c\u4e0d\u8db3\uff1a\u9700${REALMS[minRealmIdx].name}`);
          keptInv.push(it);
          continue;
        }
      }
      const slot = itemToSlot(it.item_type);
      if (slot && !isStorageBag(it)) {
        toEquip.push({ ...it, equipNote: it.equipNote || DEFAULT_EQUIP_NOTE[slot] || '\u88c5\u5907' });
      } else {
        keptInv.push(it); // Keep non-equippable item in inventory
      }
    } else {
      keptInv.push(it);
    }
  }
  if (!toEquip.length) return { state: next, equipped: [], appliedChanges, rejectedChanges, effectResolveTrace, effectResolveWarnings };
  next.inventory = keptInv;
  next.equipped = [...(next.equipped || []), ...toEquip];
  for (const it of toEquip) collect(resolveItemEffects(next, it, 1, `装备 ${it.name}`));
  next = recalcCultivationMultiplier(next);
  return { state: next, equipped: toEquip, appliedChanges, rejectedChanges, effectResolveTrace, effectResolveWarnings };
}

// AI 联动：按 id 将物品从 equipped 移回 inventory（AI 可在 interfere 中卸下物品）
export function unequipItemsByIds(state: CharacterState, ids: string[]): ItemEffectResolveResult & { unequipped: ItemEntry[] } {
  if (!ids.length) return { state, unequipped: [], appliedChanges: [], rejectedChanges: [], effectResolveTrace: [], effectResolveWarnings: [] };
  const idSet = new Set(ids);
  let next = { ...state };
  const appliedChanges: AttributeChange[] = [];
  const rejectedChanges: AttributeChange[] = [];
  const effectResolveTrace: EffectResolveTrace[] = [];
  const effectResolveWarnings: string[] = [];
  const collect = (resolved: ItemEffectResolveResult) => {
    appliedChanges.push(...resolved.appliedChanges);
    rejectedChanges.push(...resolved.rejectedChanges);
    effectResolveTrace.push(...resolved.effectResolveTrace);
    effectResolveWarnings.push(...resolved.effectResolveWarnings);
    next = resolved.state;
  };
  const toUnequip: ItemEntry[] = [];
  const keptEq: ItemEntry[] = [];
  for (const it of next.equipped || []) {
    if (idSet.has(it.id)) toUnequip.push(it);
    else keptEq.push(it);
  }
  if (!toUnequip.length) return { state: next, unequipped: [], appliedChanges, rejectedChanges, effectResolveTrace, effectResolveWarnings };
  next.equipped = keptEq;
  for (const it of toUnequip) collect(resolveItemEffects(next, it, -1, `卸下 ${it.name}`));
  next = recalcCultivationMultiplier(next);
  next.inventory = [...next.inventory, ...toUnequip];
  return { state: next, unequipped: toUnequip, appliedChanges, rejectedChanges, effectResolveTrace, effectResolveWarnings };
}

// ==================== 炼丹炉系统 ====================

// 丹药命名表：按元素 + rarity
const PILL_NAMES_BY_ELEMENT: Record<string, { common: string[]; uncommon: string[]; rare: string[]; epic: string[]; legendary: string[] }> = {
  fire: {
    common: ['赤焰散', '火元丸'],
    uncommon: ['烈火丹', '赤阳丹'],
    rare: ['炎阳真丹', '焚天丹'],
    epic: ['九转火元丹', '太阳真火丹'],
    legendary: ['涅槃真丹', '三昧真火丹'],
  },
  water: {
    common: ['寒水散', '水元丸'],
    uncommon: ['玄冰丹', '凝露丹'],
    rare: ['玄冰真丹', '北海神丹'],
    epic: ['九转玄冰丹', '太阴真水丹'],
    legendary: ['混沌玄冰丹', '天河真水丹'],
  },
  wood: {
    common: ['青木散', '木元丸'],
    uncommon: ['生机丹', '回春丹'],
    rare: ['青木真丹', '造化丹'],
    epic: ['九转青木丹', '长生丹'],
    legendary: ['造化真丹', '万木朝宗丹'],
  },
  metal: {
    common: ['锐金散', '金元丸'],
    uncommon: ['庚金丹', '锋锐丹'],
    rare: ['庚金真丹', '白虎丹'],
    epic: ['九转庚金丹', '太白真金丹'],
    legendary: ['诛仙剑意丹', '白虎真形丹'],
  },
  earth: {
    common: ['厚土散', '土元丸'],
    uncommon: ['戊土丹', '磐石丹'],
    rare: ['戊土真丹', '黄中丹'],
    epic: ['九转戊土丹', '后土真丹'],
    legendary: ['玄黄造化丹', '大地之心丹'],
  },
};

// 丹药效果表：按元素 + rarity
function pillEffects(element: string, rarity: string, potencyMultiplier = 1): { target_attribute: string; operation: string; value: number; description: string }[] {
  const powerByRarity: Record<string, number> = { common: 15, uncommon: 30, rare: 60, epic: 120, legendary: 250, mythic: 500 };
  const power = (powerByRarity[rarity] || 15) * Math.max(0.6, Math.min(1.8, potencyMultiplier));
  const effByElement: Record<string, { target: string; desc: string }[]> = {
    fire: [{ target: 'attack', desc: '火性丹力淬炼经脉，攻伐更盛' }, { target: 'maxHp', desc: '火候入体，气血渐旺' }],
    water: [{ target: 'maxMp', desc: '水性丹力润养灵海' }, { target: 'mp', desc: '水元回流，灵力复苏' }],
    wood: [{ target: 'hp', desc: '木气生发，血脉回春' }, { target: 'cultivationExp', desc: '木性灵机推动修为' }],
    metal: [{ target: 'attack', desc: '金性丹力砥砺锋芒' }, { target: 'speed', desc: '金气行脉，身法轻捷' }],
    earth: [{ target: 'defense', desc: '土性丹力沉稳护身' }, { target: 'maxHp', desc: '土元厚重，气血根基增长' }],
  };
  const effs = effByElement[element] || effByElement.wood;
  return effs.map(e => ({
    target_attribute: e.target,
    operation: 'add',
    value: Math.round(power * 0.8),
    description: e.desc,
  }));
}

// 从材料的 effects 中提取主要元素倾向
function extractMaterialElement(item: ItemEntry): string | null {
  for (const eff of item.effects || []) {
    if (eff.target_attribute === 'elementFire') return 'fire';
    if (eff.target_attribute === 'elementWater') return 'water';
    if (eff.target_attribute === 'elementWood') return 'wood';
    if (eff.target_attribute === 'elementMetal') return 'metal';
    if (eff.target_attribute === 'elementEarth') return 'earth';
  }
  return null;
}

interface AlchemyHarmony {
  successBonus: number;
  rarityBoost: number;
  potencyMultiplier: number;
  elementScores: Record<string, number>;
  tags: string[];
}

function computeAlchemyHarmony(materials: ItemEntry[]): AlchemyHarmony {
  const elementScores: Record<string, number> = {};
  const tags = new Set<string>();
  let potency = 1;
  for (const material of materials) {
    const rarity = Math.max(0, rarityIndex(material.rarity));
    potency += rarity * 0.06;
    for (const effect of material.effects || []) {
      const target = effect.target_attribute;
      const value = Math.max(1, Math.abs(Number(effect.value) || 1));
      if (target === 'elementFire') elementScores.fire = (elementScores.fire || 0) + value;
      if (target === 'elementWater') elementScores.water = (elementScores.water || 0) + value;
      if (target === 'elementWood') elementScores.wood = (elementScores.wood || 0) + value;
      if (target === 'elementMetal') elementScores.metal = (elementScores.metal || 0) + value;
      if (target === 'elementEarth') elementScores.earth = (elementScores.earth || 0) + value;
      if (target === 'cultivationExp') tags.add('cultivation');
      if (target === 'hp' || target === 'maxHp') tags.add('vitality');
      if (target === 'mp' || target === 'maxMp') tags.add('spirit');
    }
  }
  const distinctElements = Object.keys(elementScores).length;
  const dominant = Math.max(0, ...Object.values(elementScores));
  const conflictPenalty = Math.max(0, distinctElements - 2) * 4;
  const successBonus = Math.min(18, dominant * 0.8 + materials.length * 2) - conflictPenalty;
  const rarityBoost = dominant >= 12 && distinctElements <= 2 ? 1 : 0;
  return { successBonus, rarityBoost, potencyMultiplier: potency, elementScores, tags: Array.from(tags) };
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
function rarityIndex(r: string): number {
  return RARITY_ORDER.indexOf(r);
}

// 炼丹炉：消耗 2-3 个材料 + 灵石，有概率炼出丹药
// 成功率 = 30% + 悟性*0.4% + 灵根倍率*5% + 平均材料 rarity*8% - 5%（每多一个材料扣减）
// 成功：丹药 rarity = clamp(平均材料 rarity ± 1)，效果按主要元素
// 失败：得一枚"废丹"（common consumable，恢复 5hp）
export interface AlchemyResult {
  state: CharacterState;
  ok: boolean;
  error?: string;
  success: boolean;
  narrative: string;
  product?: ItemEntry;
  consumedMaterials: ItemEntry[];
  spiritStoneCost: number;
  successRate: number;
  contentRegistryTrace: ValidationTrace[];
  contentRegistryWarnings: string[];
  mainElement?: string;
}

function failedAlchemyResult(state: CharacterState, error: string): AlchemyResult {
  return { state, ok: false, error, success: false, narrative: '', consumedMaterials: [], spiritStoneCost: 0, successRate: 0, contentRegistryTrace: [], contentRegistryWarnings: [] };
}

// 炼丹数值上限：按品阶限制 AI 给出的丹效数值，防止数值膨胀（引擎硬约束）
const ALCHEMY_VALUE_CAP_BY_RARITY: Record<string, number> = { common: 30, uncommon: 80, rare: 180, epic: 400, legendary: 900, mythic: 2000 };
const ALCHEMY_ALLOWED_TARGETS = new Set(['attack', 'defense', 'speed', 'luck', 'comprehension', 'hp', 'maxHp', 'mp', 'maxMp', 'cultivationExp']);
function clampAlchemyEffects(effects: Array<{ target_attribute: string; operation: string; value: number; description: string }>, rarity: string): Array<{ target_attribute: string; operation: string; value: number; description: string }> {
  const cap = ALCHEMY_VALUE_CAP_BY_RARITY[rarity] || 30;
  const out: Array<{ target_attribute: string; operation: string; value: number; description: string }> = [];
  for (const e of (effects || []).slice(0, 3)) {
    if (!ALCHEMY_ALLOWED_TARGETS.has(e.target_attribute)) continue;
    if (e.operation === 'multiply') {
      const v = Math.max(1.02, Math.min(3.5, Number(e.value) || 1));
      out.push({ target_attribute: e.target_attribute, operation: 'multiply', value: Number(v.toFixed(2)), description: e.description });
    } else {
      const v = Math.max(-cap, Math.min(cap, Math.round(Number(e.value) || 0)));
      if (v === 0) continue;
      out.push({ target_attribute: e.target_attribute, operation: 'add', value: v, description: e.description });
    }
  }
  return out;
}

export function alchemy(
  state: CharacterState,
  materialIds: string[],
  spiritStoneCost: number = 10,
  aiOutcome?: AlchemyAIOutcome,
): AlchemyResult {
  if (materialIds.length < 2 || materialIds.length > 3) return failedAlchemyResult(state, '须选 2-3 味材料入炉');
  const uniqueMaterialIds = Array.from(new Set(materialIds));
  if (uniqueMaterialIds.length !== materialIds.length) return failedAlchemyResult(state, '同一份材料不能重复入炉');

  const contentRegistryTrace: ValidationTrace[] = [];
  const contentRegistryWarnings: string[] = [];
  const materials: ItemEntry[] = [];
  for (const id of uniqueMaterialIds) {
    const material = state.inventory.find(item => item.id === id);
    if (!material) return failedAlchemyResult(state, '材料不在储物中');
    materials.push(material);
  }
  if (state.spiritStones < spiritStoneCost) return failedAlchemyResult(state, `灵石不足，需 ${spiritStoneCost} 灵石`);

  const comprehensionBonus = state.comprehension * 0.4;
  const rootBonus = (state.rootMultiplier || 0) * 5;
  const avgRarityIdx = materials.reduce((sum, material) => sum + Math.max(0, rarityIndex(material.rarity)), 0) / materials.length;
  const materialHarmony = computeAlchemyHarmony(materials);
  const rarityBonus = avgRarityIdx * 8;
  const costBonus = Math.min(12, Math.max(0, spiritStoneCost - 10) * 0.6);
  const countPenalty = (materials.length - 2) * 5;
  let successRate = 30 + comprehensionBonus + rootBonus + rarityBonus + materialHarmony.successBonus + costBonus - countPenalty;
  successRate = Math.max(10, Math.min(95, successRate));

  let next: CharacterState = {
    ...state,
    inventory: state.inventory.filter(item => !uniqueMaterialIds.includes(item.id)),
    spiritStones: state.spiritStones - spiritStoneCost,
  };

  // ===== AI 主路径：若提供 AI 产出，引擎只做校验 / clamp / 落库，不再走写死公式 =====
  if (aiOutcome) {
    if (aiOutcome.success) {
      let effects = clampAlchemyEffects(aiOutcome.effects || [], aiOutcome.rarity);
      if (!effects.length) {
        // AI 未给出有效效果时，用引擎元素表兜底，保证丹药有作用
        effects = pillEffects(aiOutcome.mainElement === 'none' ? 'wood' : aiOutcome.mainElement, aiOutcome.rarity, materialHarmony.potencyMultiplier) as any;
      }
      const rawPill: ItemEntry = {
        id: `item_pil_${aiOutcome.mainElement}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: aiOutcome.pillName,
        description: aiOutcome.pillDescription || '开炉炼成的丹药。',
        item_type: 'consumable',
        rarity: aiOutcome.rarity as any,
        effects: effects as any,
        source: '炼丹炉成丹',
      };
      const registered = registerItem(rawPill, { source: 'alchemy', existingIds: next.inventory.map(item => item.id) });
      contentRegistryTrace.push(...registered.trace);
      contentRegistryWarnings.push(...registered.warnings);
      const pill = registered.content || rawPill;
      next = addItems(next, [pill]);
      next = normalizeCultivationState(next);
      return {
        state: next, ok: true, success: true,
        narrative: aiOutcome.narrative || `炉火三转，一枚${aiOutcome.pillName}跃然而出。`,
        product: pill, consumedMaterials: materials, spiritStoneCost, successRate,
        contentRegistryTrace, contentRegistryWarnings, mainElement: aiOutcome.mainElement,
      };
    }
    // AI 判定失败：炸炉 / 异变 / 废丹，按 AI 叙事产出一枚低阶产物
    const failEffects = clampAlchemyEffects(aiOutcome.effects || [], 'common');
    const rawFail: ItemEntry = {
      id: `item_pil_fail_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: (aiOutcome.pillName && aiOutcome.pillName !== '无名丹') ? aiOutcome.pillName : '焦丹',
      description: aiOutcome.pillDescription || '炉火失衡后凝成的残丹，药力驳杂。',
      item_type: 'consumable',
      rarity: 'common',
      effects: (failEffects.length ? failEffects : [{ target_attribute: 'hp', operation: 'add', value: 5, description: '残丹余性，略复气血' }]) as any,
      source: '炼丹失手所得',
    };
    const registeredFail = registerItem(rawFail, { source: 'alchemy', existingIds: next.inventory.map(item => item.id) });
    contentRegistryTrace.push(...registeredFail.trace);
    contentRegistryWarnings.push(...registeredFail.warnings);
    const failPill = registeredFail.content || rawFail;
    next = addItems(next, [failPill]);
    next = normalizeCultivationState(next);
    const failNarr = aiOutcome.narrative || `炉中火候骤乱，${materials.map(m => m.name).join('、')}的药性未能相融。`;
    return {
      state: next, ok: true, success: false,
      narrative: aiOutcome.accident ? `${failNarr}（${aiOutcome.accident}）` : failNarr,
      product: failPill, consumedMaterials: materials, spiritStoneCost, successRate,
      contentRegistryTrace, contentRegistryWarnings, mainElement: 'waste',
    };
  }

  const roll = Math.random() * 100;
  const success = roll < successRate;
  if (!success) {
    const rawWastePill: ItemEntry = {
      id: `item_pil_waste_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: '焦丹',
      description: '炉火失衡后凝成的焦黑丹丸，药力微弱，却仍留有一线温养之效。',
      item_type: 'consumable',
      rarity: 'common',
      effects: [{ target_attribute: 'hp', operation: 'add', value: 5, description: '焦丹残余药性，略复气血' }],
      source: '炼丹失手所得',
    };
    const registered = registerItem(rawWastePill, { source: 'alchemy', existingIds: next.inventory.map(item => item.id) });
    contentRegistryTrace.push(...registered.trace);
    contentRegistryWarnings.push(...registered.warnings);
    const wastePill = registered.content || rawWastePill;
    next = addItems(next, [wastePill]);
    next = normalizeCultivationState(next);
    return {
      state: next,
      ok: true,
      success: false,
      narrative: `炉中火候一偏，${materials.map(material => material.name).join('、')}的灵性未能相融，丹烟散尽后只余一枚焦丹。`,
      product: wastePill,
      consumedMaterials: materials,
      spiritStoneCost,
      successRate,
      contentRegistryTrace,
      contentRegistryWarnings,
      mainElement: 'waste',
    };
  }

  const elementCounts: Record<string, number> = { ...materialHarmony.elementScores };
  for (const material of materials) {
    const element = extractMaterialElement(material);
    if (element) elementCounts[element] = (elementCounts[element] || 0) + 1;
  }
  let mainElement = 'wood';
  let maxCount = 0;
  for (const [element, count] of Object.entries(elementCounts)) {
    if (count > maxCount) { maxCount = count; mainElement = element; }
  }
  if (maxCount === 0) mainElement = 'wood';

  const avgIdx = Math.round(avgRarityIdx);
  const drift = Math.random() < 0.4 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  const pillRarityIdx = Math.max(0, Math.min(RARITY_ORDER.length - 1, avgIdx + drift + materialHarmony.rarityBoost));
  const pillRarity = RARITY_ORDER[pillRarityIdx];
  const namePool = PILL_NAMES_BY_ELEMENT[mainElement]?.[pillRarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'];
  const pillName = namePool?.[Math.floor(Math.random() * namePool.length)] || `${mainElement}元丹`;
  const effects = pillEffects(mainElement, pillRarity, materialHarmony.potencyMultiplier) as any;
  const elementZh = mainElement === 'fire' ? '火' : mainElement === 'water' ? '水' : mainElement === 'wood' ? '木' : mainElement === 'metal' ? '金' : '土';
  const rarityZh: Record<string, string> = { common: '下品', uncommon: '中品', rare: '上品', epic: '地品', legendary: '天品', mythic: '玄品' };
  const rawPill: ItemEntry = {
    id: `item_pil_${mainElement}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: pillName,
    description: `以${materials.map(material => material.name).join('、')}炼成的${rarityZh[pillRarity] || ''}丹药，丹纹中蕴着${elementZh}行灵机。`,
    item_type: 'consumable',
    rarity: pillRarity as any,
    effects,
    source: '炼丹炉成丹',
  };
  const registered = registerItem(rawPill, { source: 'alchemy', existingIds: next.inventory.map(item => item.id) });
  contentRegistryTrace.push(...registered.trace);
  contentRegistryWarnings.push(...registered.warnings);
  const pill = registered.content || rawPill;
  next = addItems(next, [pill]);
  next = normalizeCultivationState(next);

  return {
    state: next,
    ok: true,
    success: true,
    narrative: `炉火三转，${elementZh}行灵机在丹室中凝成细密丹纹。你稳住炉息，开炉时一枚${rarityZh[pillRarity] || ''}丹药跃然而出，正是${pillName}。`,
    product: pill,
    consumedMaterials: materials,
    spiritStoneCost,
    successRate,
    contentRegistryTrace,
    contentRegistryWarnings,
    mainElement,
  };
}

// 炼丹前置参考：在不消耗材料的前提下，预算成功率 / 建议品阶 / 主导元素，供 AI 参考
export function computeAlchemyHints(
  state: CharacterState,
  materialIds: string[],
  spiritStoneCost: number,
): { ok: boolean; error?: string; materials?: ItemEntry[]; baseSuccessRate?: number; suggestedRarity?: string; dominantElement?: string } {
  const uniq = Array.from(new Set(materialIds));
  if (uniq.length < 2 || uniq.length > 3) return { ok: false, error: '须选 2-3 味材料入炉' };
  const materials: ItemEntry[] = [];
  for (const id of uniq) {
    const m = state.inventory.find(it => it.id === id);
    if (!m) return { ok: false, error: '材料不在储物中' };
    materials.push(m);
  }
  const comprehensionBonus = state.comprehension * 0.4;
  const rootBonus = (state.rootMultiplier || 0) * 5;
  const avgRarityIdx = materials.reduce((s, m) => s + Math.max(0, rarityIndex(m.rarity)), 0) / materials.length;
  const harmony = computeAlchemyHarmony(materials);
  const rarityBonus = avgRarityIdx * 8;
  const costBonus = Math.min(12, Math.max(0, spiritStoneCost - 10) * 0.6);
  const countPenalty = (materials.length - 2) * 5;
  let rate = 30 + comprehensionBonus + rootBonus + rarityBonus + harmony.successBonus + costBonus - countPenalty;
  rate = Math.max(10, Math.min(95, rate));
  const suggestedIdx = Math.max(0, Math.min(RARITY_ORDER.length - 1, Math.round(avgRarityIdx) + harmony.rarityBoost));
  const dom = Object.entries(harmony.elementScores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
  return { ok: true, materials, baseSuccessRate: rate, suggestedRarity: RARITY_ORDER[suggestedIdx], dominantElement: dom };
}

// ==================== 突破处理 ====================

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
  const allowChain = hasStrongReason && (Boolean(requestedTargetRealm) || requestedTargetLevel > state.realmLevel + 1);
  const maxSteps = allowChain ? 4 : 1;

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

    // 无强因果时，永远只允许一跳，防止「资质普通无奇遇，炼气一层直筑基」。
    if (!allowChain) break;

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

// ==================== 寿元检查 ====================

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


const VALID_ITEM_TYPES_FOR_NORMALIZE = new Set(['weapon', 'armor', 'accessory', 'artifact', 'consumable', 'material', 'tool', 'scripture']);
const SCRIPTURE_NAME_RE = /诀|决|经|典|录|篇|章|解|式|术|功法|心法|秘籍|玉简|心得|真经|真解|引气|凝气|吐纳/;
const CULTIVATION_EFFECT_ALIASES = new Set(['cultivationExp', 'cultivation', 'cultivationRate', 'cultivationMultiplier', 'cultivation_speed', '修为', '修炼速度']);

function defaultScriptureMultiplier(rarity?: string): number {
  const multByRarity: Record<string, number> = {
    common: 1.3, uncommon: 1.7, rare: 2.5, epic: 3.5, legendary: 4.5, mythic: 5.5,
  };
  return multByRarity[rarity || ''] || 1.5;
}

function isArtifactTechniqueProfile(technique: ItemEntry['technique'] | undefined): boolean {
  return !!technique && (technique.kind === 'artifact' || (Array.isArray(technique.artifactAbilities) && technique.artifactAbilities.length > 0));
}

function isAutoInjectedScriptureCultivationEffect(e: StatusEffect, rarity?: string): boolean {
  if (e.target_attribute !== 'cultivationExp' || e.operation !== 'multiply') return false;
  const desc = String(e.description || '');
  const defaultMult = defaultScriptureMultiplier(rarity);
  return /修习此功法|功法.*修为流转/.test(desc) || Math.abs(Number(e.value || 0) - defaultMult) < 0.0001;
}

function normalizeCultivationBearingItem(it: ItemEntry): ItemEntry {
  const hasStorageEffect = (it.effects || []).some(e => e.target_attribute === 'storageCapacity' && e.operation === 'add' && e.value > 0);
  const artifactByTechnique = isArtifactTechniqueProfile(it.technique);
  let itemType = it.item_type;
  if (!VALID_ITEM_TYPES_FOR_NORMALIZE.has(itemType)) {
    itemType = hasStorageEffect ? 'tool' : 'material';
  } else if (hasStorageEffect && itemType !== 'tool') {
    itemType = 'tool';
  }

  // 旧档兼容：曾有法宝/护符因名字或描述被误归为 scripture，并被补上“修习此功法”倍率。
  // technique.kind/artifactAbilities 是更强事实；这类物品必须回到 artifact，不再当功法修炼。
  if (artifactByTechnique) itemType = 'artifact';

  const isScriptureByName = SCRIPTURE_NAME_RE.test(`${it.name || ''}${it.description || ''}`);
  if (!artifactByTechnique && isScriptureByName && itemType !== 'scripture') {
    itemType = 'scripture';
  }

  let effects = Array.isArray(it.effects) ? it.effects.map(e => {
    if (CULTIVATION_EFFECT_ALIASES.has(e.target_attribute) && e.target_attribute !== 'cultivationExp') {
      return { ...e, target_attribute: 'cultivationExp' };
    }
    return e;
  }) : [];

  if (itemType === 'artifact') {
    effects = effects.filter(e => !isAutoInjectedScriptureCultivationEffect(e, it.rarity as string));
  }

  if (itemType === 'scripture' && !effects.some(e => e.target_attribute === 'cultivationExp' && e.operation === 'multiply')) {
    const mult = defaultScriptureMultiplier(it.rarity as string);
    effects = [...effects, {
      target_attribute: 'cultivationExp',
      operation: 'multiply',
      value: mult,
      description: `修习此功法，修为流转加速×${mult}`,
    }];
  }

  const base = { ...it, name: stripLootOwnerPrefix(it.name), item_type: itemType as any, effects };
  if (itemType === 'artifact') {
    const withTechnique = base.technique ? base : { ...base, technique: inferTechniqueProfile(base) };
    return describeArtifactAbilitiesOnItem(withTechnique);
  }
  if (itemType === 'scripture' && !base.technique) {
    return { ...base, technique: inferTechniqueProfile(base) };
  }
  return base;
}


function factNameKey(value?: string) {
  return String(value || '')
    .replace(/[\s\u3000]/g, '')
    .replace(/^(?:[^\u4e00-\u9fa5]{0,4})/, '')
    .slice(0, 24);
}

function knownItemNameSet(state: CharacterState) {
  return new Set([...(state.inventory || []), ...(state.equipped || [])].map(it => factNameKey(it.name)).filter(Boolean));
}

function filterAlreadyKnownItems(state: CharacterState, items: ItemEntry[]) {
  const known = knownItemNameSet(state);
  const accepted: ItemEntry[] = [];
  const rejectedNames: string[] = [];
  for (const item of items || []) {
    const key = factNameKey(item.name);
    if (key && known.has(key)) {
      rejectedNames.push(item.name);
      continue;
    }
    if (key) known.add(key);
    accepted.push(item);
  }
  return { accepted, rejectedNames };
}

function escapeStoryRegExp(value: string) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeNarrativeKnownFactRepetition(text: string, state: CharacterState, duplicateItemNames: string[] = []) {
  let out = String(text || '');
  const names = Array.from(new Set([
    ...duplicateItemNames,
    ...(state.inventory || []).map(it => it.name),
    ...(state.equipped || []).map(it => it.name),
  ].filter(Boolean))).slice(0, 40);
  for (const name of names) {
    const safe = escapeStoryRegExp(name);
    const inquire = new RegExp(`[^\u3002\uff01\uff1f\uff1b]{0,40}${safe}[^\u3002\uff01\uff1f\uff1b]{0,40}(?:\u54ea\u91cc\u53ef\u4ee5\u83b7\u5f97|\u4f55\u5904\u53ef\u5f97|\u4ece\u4f55\u5f97\u6765|\u5982\u4f55\u83b7\u5f97|\u4ece\u4f55\u800c\u6765)[^\u3002\uff01\uff1f\uff1b]*[\u3002\uff01\uff1f\uff1b]?`, 'g');
    out = out.replace(inquire, `${state.name}\u4e0d\u518d\u8ffd\u95ee${name}\u4ece\u4f55\u800c\u6765\uff0c\u8f6c\u800c\u6838\u5bf9\u5176\u4fee\u4e60\u95e8\u69db\u4e0e\u540e\u7eed\u7528\u6cd5\u3002`);
    const obtain = new RegExp(`[^\u3002\uff01\uff1f\uff1b]{0,30}(?:\u5076\u7136\u6240\u5f97|\u5076\u7136\u83b7\u5f97|\u62fe\u5f97|\u6361\u5230|\u53c8\u5f97|\u518d\u6b21\u83b7\u5f97|\u83b7\u5f97\u4e86|\u5f97\u5230)${safe}[^\u3002\uff01\uff1f\uff1b]*[\u3002\uff01\uff1f\uff1b]?`, 'g');
    out = out.replace(obtain, `${state.name}\u91cd\u65b0\u53d6\u51fa\u5df2\u5728\u8eab\u8fb9\u7684${name}\uff0c\u628a\u5fc3\u601d\u653e\u5728\u5982\u4f55\u627f\u63a5\u5176\u56e0\u679c\u3002`);
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function itemAcquisitionMemories(age: number, items: ItemEntry[]) {
  return (items || []).slice(0, 6).map(item => `${age}\u5c81\u5df2\u83b7\u5f97${item.name}${item.source ? `\uff0c\u6765\u6e90\uff1a${item.source}` : ''}`);
}

// 添加物品到 inventory。若物品是储物袋（含 storageCapacity 效果的 tool），自动增加 storageCapacity。
// 兜底：若 AI 给了无效 item_type（如 'storage'），但物品含 storageCapacity 效果，则强转 item_type='tool'。
// 兜底：若物品名含功法关键词（诀/经/典/录/篇/功法）但 item_type 不是 scripture，强转 scripture 并补默认效果
// Task 22: 容量限制——超过 storageCapacity 时丢弃多余物品（储物袋本身优先保留，因可扩容）
export function addItems(state: CharacterState, items: ItemEntry[]): CharacterState {
  if (!items.length) return state;
  // 规整化物品：确保储物袋、功法、玉简/心得等可被后续修炼速度归算识别。
  const normalized = items.map(normalizeCultivationBearingItem);

  // Task 22: 计算加入后的总容量（含本批储物袋扩容），按容量限制裁剪
  let bagBoost = 0;
  for (const it of normalized) {
    if (isStorageBag(it)) {
      for (const eff of it.effects || []) {
        if (eff.target_attribute === 'storageCapacity' && eff.operation === 'add' && eff.value > 0) {
          bagBoost += eff.value;
        }
      }
    }
  }
  const projectedCapacity = (state.storageCapacity || 5) + bagBoost;
  const currentCount = state.inventory.length;
  const availableSlots = Math.max(0, projectedCapacity - currentCount);
  // 储物袋优先放入（因其扩容），其余按顺序填满
  const bags = normalized.filter(isStorageBag);
  const nonBags = normalized.filter(it => !isStorageBag(it));
  const keptNonBags = nonBags.slice(0, Math.max(0, availableSlots - bags.length));
  const droppedCount = nonBags.length - keptNonBags.length;
  if (droppedCount > 0) {
    console.warn(`[Task 22] Storage full (${currentCount}/${state.storageCapacity}): dropping ${droppedCount} items: ${nonBags.slice(keptNonBags.length).map(d => d.name).join(', ')}`);
  }
  const finalItems = [...bags, ...keptNonBags];
  if (!finalItems.length) return state;

  let next = { ...state, inventory: [...state.inventory, ...finalItems] };
  // 储物袋获得即扩容
  if (bagBoost > 0) next.storageCapacity = projectedCapacity;
  return next;
}

// ==================== 记忆管理 ====================

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

function threadStatusToQuestStage(status: PendingThread['status']): QuestEntryStage {
  if (status === 'resolved') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'urgent') return 'urgent';
  return 'open';
}

function normalizeThreadCompletion(thread: PendingThread): PendingThread {
  if (!thread) return thread;
  if (thread.status === 'resolved' || thread.status === 'failed') return thread;
  const progress = Math.max(0, Math.min(100, Number(thread.progress || 0)));
  if (progress >= 100) {
    return { ...thread, progress: 100, status: 'resolved' as const, dueInSameYear: false };
  }
  return progress === thread.progress ? thread : { ...thread, progress };
}

function normalizeThreadsCompletion(threads: PendingThread[] = []): PendingThread[] {
  return threads.map(normalizeThreadCompletion);
}

function questUrgency(thread: PendingThread, currentAge: number): number {
  if (thread.status === 'resolved' || thread.status === 'failed') return 0;
  const remaining = Number(thread.deadlineAge ?? currentAge) - currentAge;
  let urgency = 1;
  if (thread.status === 'urgent' || remaining <= 1 || thread.dueInSameYear) urgency = 10;
  else if (remaining <= 3) urgency = 8;
  else if (remaining <= 8) urgency = 5;
  else urgency = 3;
  if ((thread.progress || 0) >= 75) urgency = Math.max(urgency, 6);
  return urgency;
}

export function buildQuestEntriesFromThreads(threads: PendingThread[] | null | undefined, currentAge: number): QuestEntry[] {
  const safeThreads = Array.isArray(threads) ? threads : [];
  const normalized = safeThreads.map(t => normalizeThreadCompletion(t));
  return normalized
    .filter(t => t && t.id && t.title)
    .map(t => ({
      id: `quest_${t.id}`,
      title: t.title,
      summary: t.description || t.followUpHint || t.title,
      kind: t.category,
      stage: threadStatusToQuestStage(t.status),
      progress: Math.max(0, Math.min(100, Number(t.progress || 0))),
      startedAtAge: Number(t.startAge ?? currentAge),
      dueAge: Number.isFinite(Number(t.deadlineAge)) ? Number(t.deadlineAge) : undefined,
      urgency: questUrgency(t, currentAge),
      sourceThreadId: t.id,
      sourceEventTitle: t.sourceEventTitle,
      currentHook: t.followUpHint,
      rewardHint: t.reward,
      failureHint: t.failureCost,
      realmId: t.realmId,
      tags: [t.category, t.status, t.dueInSameYear ? 'same-year' : '', t.realmId ? 'realm' : ''].filter(Boolean),
    }))
    .sort((a, b) => b.urgency - a.urgency || (a.dueAge ?? 999999) - (b.dueAge ?? 999999))
    .slice(0, 80);
}

// ==================== 引擎状态上下文构建 ====================

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
export function generateCharacterIntents(state: CharacterState, threads?: PendingThread[] | null): CharacterIntent[] {
  const intents: CharacterIntent[] = [];
  const now = state.age;
  const safeThreads = Array.isArray(threads) ? threads : Array.isArray((state as any).pendingThreads) ? (state as any).pendingThreads : [];
  // 1. 检查 pendingThreads —— 临近 deadline 的线索生成对应意图
  for (const t of safeThreads) {
    if (t.status !== 'pending' && t.status !== 'urgent') continue;
    const remaining = t.deadlineAge - now;
    if (remaining < 0) continue;
    if (remaining === 0) {
      intents.push({
        id: `intent_due_${t.id}`,
        type: t.category === 'exploration' || t.category === 'mystery' || t.category === 'inheritance' ? 'explore_opportunity' : 'resolve_thread',
        title: `应约·${t.title}`,
        description: `「${t.title}」已到约期。此事压在心头，须去赴约、入境、应试或还愿；若一时不能成行，也该给自己一个交代。${t.followUpHint ? `关窍：${t.followUpHint}` : ''}`,
        priority: 10,
        relatedThreadId: t.id,
      });
      continue;
    }
    if ((t.category === 'exploration' || t.category === 'mystery' || t.category === 'inheritance') && remaining <= 3) {
      intents.push({
        id: `intent_realm_${t.id}`,
        type: 'explore_opportunity',
        title: `牵挂·${t.title}`,
        description: `「${t.title}」仍在心头，约莫 ${remaining} 岁内便会再起波澜。信物、禁制与旧地皆有未尽之意，若暂不能入内，也需另寻缘法。${t.followUpHint ? `关窍：${t.followUpHint}` : ''}`,
        priority: 9,
        relatedThreadId: t.id,
      });
    } else if ((t.category === 'promise' || t.category === 'romance') && remaining <= 3) {
      intents.push({
        id: `intent_promise_${t.id}`,
        type: 'socialize',
        title: `守约·${t.title}`,
        description: `「${t.title}」渐近，旧约旧人萦绕心间。或赴约，或传信，或亲自探望；若终究失约，也该有一番缘由。`,
        priority: 8,
        relatedThreadId: t.id,
      });
    }
    if (t.category === 'competition' && remaining <= 5) {
      intents.push({
        id: `intent_comp_${t.id}`,
        type: 'prepare_combat',
        title: `备战·${t.title}`,
        description: `「${t.title}」将在 ${remaining} 岁后到来。兵器、丹药、功法与师长指点皆可早作筹谋；修为若浅，更该趁早磨砺。`,
        priority: 9,
        relatedThreadId: t.id,
      });
    } else if (t.category === 'enemy' && remaining <= 10) {
      intents.push({
        id: `intent_enemy_${t.id}`,
        type: 'avoid_danger',
        title: `防备·${t.title}`,
        description: `「${t.title}」近来隐有动静。独行险地需多留心，护身之物、师长照拂或同门同行，皆可保一线周全。`,
        priority: 8,
        relatedThreadId: t.id,
      });
    } else if (t.category === 'quest' && remaining <= 5) {
      intents.push({
        id: `intent_quest_${t.id}`,
        type: 'resolve_thread',
        title: `推进·${t.title}`,
        description: `「${t.title}」已近收束之时。材料、委托与目标仍需一一落实，不宜再久拖。`,
        priority: 8,
        relatedThreadId: t.id,
      });
    } else if (t.category === 'debt' && remaining <= 3) {
      intents.push({
        id: `intent_debt_${t.id}`,
        type: 'gather_resources',
        title: `还债·${t.title}`,
        description: `「${t.title}」债期将近，灵石与抵偿之物都得早作筹措，否则恐生祸端。`,
        priority: 9,
        relatedThreadId: t.id,
      });
    }
  }
  // 2. 修为接近突破阈值 → 闭关意图
  if (state.cultivationExp >= state.expToBreak * 0.8) {
    intents.push({
      id: `intent_break_${now}`,
      type: 'breakthrough',
      title: '酝酿突破',
      description: '修为将满，应闭关参悟、稳固道心、准备突破。若有突破辅助丹药应及早服用。',
      priority: 7,
    });
  }
  // 3. 灵石富余且无紧迫事项 → 淘宝/交易意图
  if (state.spiritStones >= 50 && intents.length === 0 && state.age >= 12) {
    intents.push({
      id: `intent_trade_${now}`,
      type: 'trade',
      title: '坊市寻宝',
      description: '灵石充裕，可前往坊市淘宝、补充丹药或材料。若有缺武器/防具应优先购置。',
      priority: 4,
    });
  }
  // 4. 无武器且境界炼气以上 → 寻武器意图
  if (state.realm !== 'mortal' && state.age >= 10) {
    const hasWeapon = (state.equipped || []).some(it => it.item_type === 'weapon');
    if (!hasWeapon) {
      intents.push({
        id: `intent_weapon_${now}`,
        type: 'gather_resources',
        title: '寻觅兵器',
        description: '已入修行却无趁手兵器，应主动寻一把剑/刀/杖/法宝防身。',
        priority: 6,
      });
    }
  }
  // 5. 软牵挂：父母、故乡、师承、旧友等不是硬任务，但会在合适年份自然回响。
  const concernText = [
    ...(state.longTermMemory || []),
    ...(state.activeStatuses || []).map(st => `${st.name} ${st.description} ${st.source || ''}`),
    ...(state.pendingThreads || []).map(t => `${t.title} ${t.description} ${t.followUpHint || ''}`),
  ].join(' ');
  const concernSeed = Math.abs((state.age * 17) + String(state.name || '').split('').reduce((n, ch) => n + ch.charCodeAt(0), 0));
  if (/父母|爹娘|双亲|母亲|父亲|家中|故乡|旧宅|亲人/.test(concernText) && (concernSeed % 4 === 0 || intents.length === 0)) {
    intents.push({
      id: `intent_family_${now}`,
      type: state.spiritStones >= 20 ? 'trade' : 'socialize',
      title: state.spiritStones >= 20 ? '奉亲问安' : '牵挂家中',
      description: state.spiritStones >= 20
        ? '角色心中牵挂父母亲人，若路途与处境允许，可购买调养丹药、托人送信或回乡探望；若不能成行，也应在叙事中自然带过原因。'
        : '角色心中牵挂父母亲人，可能回乡探望、托人问安，或因修行/险地所阻只能暂寄书信。此类牵挂应偶尔回响，不必每年硬写。',
      priority: 3,
    });
  }
  if (/师父|师尊|师门|同门|旧友|好友|恩人|道侣/.test(concernText) && (concernSeed % 5 === 0 || intents.length === 0)) {
    intents.push({
      id: `intent_social_${now}`,
      type: 'socialize',
      title: '旧缘回响',
      description: '角色心中仍有师门、旧友或恩人牵挂；合适时可传信、探访、互赠丹药法器，或写明因闭关/险阻暂不能赴约。',
      priority: 3,
    });
  }

  // 6. 限制最多保留 5 个意图（按优先级排序）
  intents.sort((a, b) => b.priority - a.priority);
  return intents.slice(0, 5);
}

// ==================== Task 20: 未决线索管理 ====================


// ==================== CausalGraph Lite ====================

/**
 * \u7edf\u4e00\u7684\u5b9e\u4f53 ID \u751f\u6210 helper\uff1a\u540c\u6beb\u79d2\u5e76\u53d1\u4e0b\u4e0d\u4f1a\u51b2\u7a81\uff08\u7528 random \u540e\u7f00\u7834\u540c\u5206\uff09\u3002
 * \u7528\u6cd5\uff1agenerateEntityId('formation', aiOutput.id) \u2014 \u6709 ai \u63d0\u4f9b\u7684 id \u5c31\u7528 ai \u7684\uff1b\u5426\u5219\u81ea\u52a8\u751f\u6210\u3002
 */
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

﻿export type ActionCausalityOptions = {
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

function recordEventCausality(state: CharacterState, aiOutput: AIEventOutput): CharacterState {
  const age = state.age;
  const eventId = causalId('event', age + '_' + (aiOutput.title || 'event'));
  const nodes: CausalNode[] = [{
    id: eventId,
    type: aiOutput.triggerCombat ? 'combat' : 'event',
    label: aiOutput.title || '无名事件',
    age,
    summary: (aiOutput.causalSummary || aiOutput.memory || aiOutput.narrative || '').slice(0, 180),
    tags: [aiOutput.eventType || 'normal'],
  }];
  const edges: CausalEdge[] = [];

  for (const thread of state.pendingThreads || []) {
    const nodeId = causalId('thread', thread.id);
    nodes.push({ id: nodeId, type: 'thread', label: thread.title, age: thread.startAge || age, refId: thread.id, summary: thread.description?.slice(0, 140), tags: [thread.status, thread.category] });
    const edgeType = (aiOutput.completeThreadIds || []).includes(thread.id) ? 'resolved'
      : (aiOutput.failThreadIds || []).includes(thread.id) ? 'failed'
      : (aiOutput.newThreads || []).some(t => t.id === thread.id) ? 'created'
      : (aiOutput.advanceThreads || []).some(t => t.id === thread.id) ? 'updated'
      : undefined;
    if (edgeType) edges.push({ id: causalId('edge', eventId + '_' + edgeType + '_' + nodeId), from: eventId, to: nodeId, type: edgeType, age, summary: thread.followUpHint || thread.description?.slice(0, 80) });
  }

  for (const npc of state.npcs || []) {
    const mentioned = (aiOutput.newNpcs || []).some(n => n.id === npc.id || n.name === npc.name) || (aiOutput.triggerCombat?.enemies || []).some(e => npc.name && e.name === npc.name);
    if (!mentioned) continue;
    const nodeId = causalId('npc', npc.id);
    nodes.push({ id: nodeId, type: 'npc', label: npc.name, age: npc.firstMetAge ?? age, refId: npc.id, summary: npc.memory || npc.description, tags: [npc.attitude, npc.role || 'npc'].filter(Boolean) });
    edges.push({ id: causalId('edge', eventId + '_mentions_' + nodeId), from: eventId, to: nodeId, type: 'mentions', age, summary: npc.memory || npc.description?.slice(0, 80) });
  }

  for (const item of [...(aiOutput.newItems || []), ...(aiOutput.newEquippedItems || [])]) {
    if (!item?.id || !item?.name) continue;
    const nodeId = causalId('item', item.id);
    nodes.push({ id: nodeId, type: 'item', label: item.name, age, refId: item.id, summary: item.description?.slice(0, 120), tags: [item.rarity, item.item_type].filter(Boolean) });
    edges.push({ id: causalId('edge', eventId + '_rewards_' + nodeId), from: eventId, to: nodeId, type: 'rewards', age, summary: item.source });
  }

  for (const status of aiOutput.newStatuses || []) {
    if (!status?.id || !status?.name) continue;
    const nodeId = causalId('status', status.id);
    nodes.push({ id: nodeId, type: 'status', label: status.name, age, refId: status.id, summary: status.description?.slice(0, 120), tags: [status.category] });
    edges.push({ id: causalId('edge', eventId + '_caused_' + nodeId), from: eventId, to: nodeId, type: 'caused', age, summary: status.description?.slice(0, 80) });
  }

  return appendCausalGraph(state, nodes, edges);
}
// ==================== WorldFacts Lite ====================

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

function combatEnemiesToNpcs(enemies: CombatEnemy[] | undefined, aiOutput: AIEventOutput, state: CharacterState): Partial<WorldNpc>[] {
  if (!Array.isArray(enemies)) return [];
  return enemies
    .filter(e => e?.name && !String(e.name).includes('心魔'))
    .map(e => ({
      id: e.id ? `npc_${e.id}` : undefined,
      name: e.name,
      description: e.description || e.name,
      role: '战斗对手',
      realm: e.realm,
      attitude: 'hostile' as const,
      relationshipScore: -40,
      firstMetAge: state.age,
      lastSeenAge: state.age,
      lastKnownLocation: state.location,
      source: aiOutput.title,
      memory: aiOutput.narrative ? aiOutput.narrative.slice(0, 180) : undefined,
      tags: ['combat'],
    }));
}

export function addThreads(state: CharacterState, threads: PendingThread[]): CharacterState {
  if (!threads.length) return state;
  const existingIds = new Set((state.pendingThreads || []).map(t => t.id));
  const newThreads = threads.filter(t => t && t.id && !existingIds.has(t.id)).map(t => ({
    ...t,
    status: t.status || 'pending',
    progress: t.progress || 0,
  }));
  if (!newThreads.length) return state;
  const pendingThreads = [...(state.pendingThreads || []), ...newThreads];
  return { ...state, pendingThreads, questEntries: buildQuestEntriesFromThreads(pendingThreads, state.age) };
}

export function advanceThread(state: CharacterState, threadId: string, progressDelta: number, note?: string): CharacterState {
  const existing = (state.pendingThreads || []).find(t => t.id === threadId);
  if (!existing) return state;
  // P0 规则：resolved/failed 线程不能再推进
  if (existing.status === 'resolved' || existing.status === 'failed') return state;
  const threads = (state.pendingThreads || []).map(t => {
    if (t.id !== threadId) return normalizeThreadCompletion(t);
    const progress = Math.max(0, Math.min(100, (t.progress || 0) + progressDelta));
    return normalizeThreadCompletion({ ...t, progress });
  });
  return { ...state, pendingThreads: threads, questEntries: buildQuestEntriesFromThreads(threads, state.age) };
}

export function completeThread(state: CharacterState, threadId: string): CharacterState {
  const existing = (state.pendingThreads || []).find(t => t.id === threadId);
  if (!existing) return state;
  if (existing.status === 'resolved' || existing.status === 'failed') return state;
  const threads = (state.pendingThreads || []).map(t =>
    t.id === threadId ? { ...t, status: 'resolved' as const, progress: 100 } : t
  );
  return { ...state, pendingThreads: threads, questEntries: buildQuestEntriesFromThreads(threads, state.age) };
}

export function failThread(state: CharacterState, threadId: string): CharacterState {
  const existing = (state.pendingThreads || []).find(t => t.id === threadId);
  if (!existing) return state;
  if (existing.status === 'resolved' || existing.status === 'failed') return state;
  const threads = (state.pendingThreads || []).map(t =>
    t.id === threadId ? { ...t, status: 'failed' as const } : t
  );
  return { ...state, pendingThreads: threads, questEntries: buildQuestEntriesFromThreads(threads, state.age) };
}

function scheduleHintId(prefix: string, raw: string): string {
  return `seh_${prefix}_${String(raw || 'unknown').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]+/g, '_').slice(0, 60)}`;
}

function narrativeOutcomeThreadIds(state: CharacterState, aiOutput: AIEventOutput): string[] {
  const contract = aiOutput.narrativeContract;
  if (!contract?.narrativeOutcome) return [];
  const ids = new Set<string>();
  const usedHintIds = new Set((contract.usedScheduleHintIds || []).filter(Boolean));
  const focusText = [aiOutput.title, contract.contractNote].filter(Boolean).join('；');
  for (const thread of state.pendingThreads || []) {
    if (!thread?.id || thread.status === 'resolved' || thread.status === 'failed') continue;
    const directIds = [
      thread.id,
      scheduleHintId('thread', thread.id),
      scheduleHintId('quest', `quest_${thread.id}`),
      scheduleHintId('quest', thread.id),
    ];
    if (directIds.some(id => usedHintIds.has(id))) {
      ids.add(thread.id);
      continue;
    }
    const title = String(thread.title || '').trim();
    if (title && title.length >= 3 && focusText.includes(title)) ids.add(thread.id);
  }
  return Array.from(ids);
}

function syncThreadsFromNarrativeOutcome(state: CharacterState, aiOutput: AIEventOutput): CharacterState {
  const outcome = aiOutput.narrativeContract?.narrativeOutcome as NarrativeOutcomeKind | undefined;
  if (!outcome) return state;
  const threadIds = narrativeOutcomeThreadIds(state, aiOutput)
    .filter(id => !(aiOutput.completeThreadIds || []).includes(id) && !(aiOutput.failThreadIds || []).includes(id));
  if (!threadIds.length) return state;
  let next = state;
  for (const id of threadIds) {
    if (outcome === 'resolved') {
      next = completeThread(next, id);
    } else if (outcome === 'failed') {
      next = failThread(next, id);
    } else if (outcome === 'advanced') {
      const current = next.pendingThreads?.find(t => t.id === id);
      const remaining = Math.max(0, 100 - Number(current?.progress || 0));
      next = advanceThread(next, id, Math.min(35, Math.max(10, remaining)), aiOutput.narrativeContract?.contractNote || aiOutput.title);
    }
  }
  return next;
}

// 检查线索 deadline —— 若有线索已过期（age > deadlineAge）且未完成，标记为 failed
export function checkThreadDeadlines(state: CharacterState): { state: CharacterState; failed: PendingThread[] } {
  const failed: PendingThread[] = [];
  let changed = false;
  const threads = (state.pendingThreads || []).map(raw => {
    const t = normalizeThreadCompletion(raw);
    if (t !== raw) changed = true;
    if (t.status === 'pending' && state.age > t.deadlineAge) {
      changed = true;
      failed.push(t);
      return { ...t, status: 'failed' as const };
    }
    return t;
  });
  if (!changed) return { state, failed: [] };
  return { state: { ...state, pendingThreads: threads, questEntries: buildQuestEntriesFromThreads(threads, state.age) }, failed };
}

// ==================== Task 20: 战斗系统 ====================


function normalizeCombatDedupeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, '');
}

function combatTriggerEnemyNames(trigger: NonNullable<AIEventOutput['triggerCombat']>): string[] {
  return Array.from(new Set((trigger.enemies || [])
    .map((enemy) => normalizeCombatDedupeText(enemy?.name))
    .filter((name) => name.length >= 2)));
}

function combatTriggerSceneTokens(trigger: NonNullable<AIEventOutput['triggerCombat']>): string[] {
  const text = normalizeCombatDedupeText(`${trigger.contextTitle || ''}${trigger.contextNarrative || ''}`);
  const tokens = ['晒谷场', '旧嫌', '冲突', '约', '狗蛋', '虎子', '秘境', '洞府', '坊市', '山林', '江边', '村头', '宗门'];
  return tokens.filter((token) => text.includes(token));
}

function hasSameAgeResolvedCombat(state: CharacterState, trigger: NonNullable<AIEventOutput['triggerCombat']>): boolean {
  const enemyNames = combatTriggerEnemyNames(trigger);
  if (!enemyNames.length) return false;
  const sceneTokens = combatTriggerSceneTokens(trigger);
  const nodes = state.causalGraph?.nodes || [];
  return nodes.some((node: any) => {
    if (node?.age !== state.age) return false;
    const id = normalizeCombatDedupeText(node?.id);
    const text = normalizeCombatDedupeText(`${node?.label || ''}${node?.title || ''}${node?.summary || ''}`);
    const looksEnded = id.includes('combat_end') || text.includes('战斗得胜') || text.includes('战罢') || text.includes('胜过');
    if (!looksEnded) return false;
    const sameEnemy = enemyNames.some((name) => text.includes(name));
    if (!sameEnemy) return false;
    if (!sceneTokens.length) return true;
    return sceneTokens.some((token) => text.includes(token));
  });
}

function resolveConsumedCombatSceneThreads(state: CharacterState, trigger: NonNullable<AIEventOutput['triggerCombat']>, note: string): CharacterState {
  const enemyNames = combatTriggerEnemyNames(trigger);
  const sceneTokens = combatTriggerSceneTokens(trigger);
  if (!enemyNames.length && !sceneTokens.length) return state;
  let changed = false;
  const pendingThreads = (state.pendingThreads || []).map((thread) => {
    if (thread.status !== 'pending' && thread.status !== 'urgent') return thread;
    const text = normalizeCombatDedupeText(`${thread.title || ''}${thread.description || ''}${thread.summary || ''}${thread.sourceEventTitle || ''}${thread.followUpHint || ''}`);
    if (text.includes('报复') || text.includes('追杀') || text.includes('余波')) return thread;
    const sameEnemy = enemyNames.some((name) => text.includes(name));
    const sameScene = sceneTokens.some((token) => text.includes(token));
    if (!sameEnemy && !sameScene) return thread;
    changed = true;
    return {
      ...thread,
      status: 'resolved' as const,
      progress: Math.max(thread.progress || 0, 100),
      resolution: thread.resolution || note,
    };
  });
  return changed ? { ...state, pendingThreads, questEntries: buildQuestEntriesFromThreads(pendingThreads, state.age) } : state;
}

// 启动战斗：从 AI 触发的 triggerCombat 创建 CombatSession
export function startCombat(state: CharacterState, trigger: NonNullable<AIEventOutput['triggerCombat']>): CharacterState {
  // P1-8 幼龄硬拦截：age<6 禁止战斗。return 原 state（不创建 CombatSession），
  // 调用方（executeAIEvent / choose / interfere）会处理拒绝叙事。
  if (state.age < 6) {
    return state;
  }
  if (hasSameAgeResolvedCombat(state, trigger)) {
    return resolveConsumedCombatSceneThreads(state, trigger, '同一场冲突已经了结，引擎拦截重复开战');
  }

  const realmPower = realmPowerMultiplier(state);
  const session: CombatSession = {
    id: `combat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    enemies: trigger.enemies.map(e => ({ ...e, maxHp: e.maxHp || e.hp, currentCooldown: 0 })),
    currentEnemyIdx: 0,
    round: 1,
    log: [],
    status: 'ongoing',
    startAge: state.age,
    contextTitle: trigger.contextTitle,
    contextNarrative: trigger.contextNarrative,
    playerHp: state.hp,
    playerMaxHp: state.maxHp,
    playerMp: state.mp,
    playerMaxMp: state.maxMp,
    playerAttack: state.attack,
    playerDefense: state.defense,
    playerSpeed: state.speed,
    // 从已装备功法/法宝提取可施展术法（与「宝」页习得法术同源）
    playerSkills: buildLearnedCombatArts(state).slice(0, 4),
    // 从背包提取丹药（consumable 类）
    playerItems: (state.inventory || [])
      .filter(it => it.item_type === 'consumable')
      .slice(0, 6)
      .map(it => ({
        itemId: it.id,
        name: it.name,
        description: it.description,
        effect: (it.effects || []).map(e => `${e.operation === 'add' ? '+' : '×'}${e.value} ${e.target_attribute}`).join('，') || '无效果',
      })),
    victoryDrops: trigger.victoryDrops,
    // Task 22: 心魔试炼字段透传
    victoryHeartDemonDelta: trigger.victoryHeartDemonDelta,
    defeatHeartDemonDelta: trigger.defeatHeartDemonDelta,
    isHeartDemonTrial: trigger.isHeartDemonTrial,
  };
  // Task 23: 选择忠诚度最高且饱食度足够的灵宠参战（satiety >= 20 才参战）
  // 心魔试炼战斗灵宠无法参战（心魔投影不属于现实战场）
  if (!trigger.isHeartDemonTrial && state.pets && state.pets.length > 0) {
    const eligible = state.pets
      .filter(p => p.loyalty >= 30 && p.satiety >= 20 && p.hp > 0)
      .sort((a, b) => (b.attack + b.defense) - (a.attack + a.defense));
    if (eligible.length > 0) {
      const pet = eligible[0];
      session.petCombatant = {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        hp: pet.hp,
        maxHp: pet.maxHp,
        attack: pet.attack,
        defense: pet.defense,
        speed: pet.speed,
        skillName: pet.skill.name,
        skillDesc: pet.skill.description,
        skillPower: pet.skill.power,
        skillCooldown: pet.skill.cooldown,
        currentCooldown: 0,
        element: pet.element,
      };
    }
  }
  session.playerSkills = repairCombatArtsFromState(state, session.playerSkills);
  session.actionPalette = buildCombatActionPalette(state, session);
  return { ...state, combatSession: session };
}

// 战斗伤害计算（简化版：基于攻防差 + 随机浮动）

function lowerText(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

// P1-8 幼龄叙事重写：把 AI 误写的"独自/前往/追查/赶路/独行/寻访"等成人化动词
// 改写为"被带去/看护下/懵懂盼头"等幼儿化口吻，保持叙事连续性又不会破坏沉浸。
const INFANT_NARRATIVE_REWRITES: Array<{ pattern: RegExp; replacement: string }> = [
  // "独自 + 动词" → "被带去 + 动词" 或 "懵懂地看着"
  { pattern: /独自(?:前往|赶路|寻访|追踪|追查|探查|探访|赴约|出行|启程)/g, replacement: '懵懂地被抱在怀中、随长者前往' },
  { pattern: /独自(?:追寻|寻找|寻找|追捕|行路|翻山)/g, replacement: '在长者怀中懵懂地望着' },
  { pattern: /(?:他|她|你|角色)(?:独自|单独|一人)(?:前往|赶路|寻访|追踪|追查|探查|探访|赴约|出行|启程|上路)/g, replacement: '在长者看护下被抱去' },
  { pattern: /(?:他|她|你|角色)(?:独自|单独|一人)(?:追寻|寻找|追捕|行路|翻山)/g, replacement: '在长者看护下懵懂张望' },
  // 纯动词
  { pattern: /(?:^|[，。；\s])(?:前往|赶路|追查|追踪|探查|探访|赴约|寻访|独行|赶赴|登程|启程|上路)/g, replacement: '$1在长者看护下被抱去' },
];

function rewriteInfantNarrative(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { pattern, replacement } of INFANT_NARRATIVE_REWRITES) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, replacement);
  }
  // 句中独立"独自"也做柔和兜底
  out = out.replace(/(?<![一-龥])(独自)(?![一-龥])/g, '在长者看护下');
  return out;
}

// P1-10 cultivationInsight 清洗 wrapper：调用 sanitizeNarrativeText
// 防止 AI 把"破境进度 +12""修为 +5"等内部机制词塞进修炼心得。
export function applyCultivationInsight(state: CharacterState, rawInsight: string | undefined): CharacterState {
  if (!rawInsight || !rawInsight.trim()) return state;
  const cleaned = sanitizeNarrativeText(rawInsight.trim(), state.age);
  return { ...state, cultivationInsight: cleaned };
}

function hasRestrainingStatus(state: CharacterState, session?: CombatSession): boolean {
  const text = lowerText(
    session?.contextTitle,
    session?.contextNarrative,
    ...(state.activeStatuses || []).map(s => `${s.name} ${s.description}`),
    ...(session?.log || []).slice(-3).map(r => r.narrative),
  );
  return new RegExp('\\u675f\\u7f1a|\\u6346|\\u7ed1|\\u7f1a|\\u62d8|\\u7981\\u9522|\\u9501|\\u7f51|\\u7f20|\\u5c01\\u4f4f\\u53cc\\u624b|\\u624b\\u811a\\u88ab').test(text);
}

function hasSealedSpiritStatus(state: CharacterState, session?: CombatSession): boolean {
  const text = lowerText(
    session?.contextTitle,
    session?.contextNarrative,
    ...(state.activeStatuses || []).map(s => `${s.name} ${s.description}`),
    ...(session?.log || []).slice(-3).map(r => r.narrative),
  );
  return new RegExp('\\u5c01\\u7075|\\u7981\\u7075|\\u7075\\u529b\\u51dd\\u6ede|\\u6cd5\\u529b\\u88ab\\u5c01|\\u7ecf\\u8109\\u53d7\\u5236').test(text);
}

function weaponLikeItems(state: CharacterState): ItemEntry[] {
  return (state.equipped || []).filter(it => {
    const text = `${it.name} ${it.description || ''} ${it.item_type || ''}`;
    return it.item_type === 'weapon' || new RegExp('\\u5251|\\u5200|\\u67aa|\\u621f|\\u5f13|\\u9488|\\u5203|\\u9524|\\u68cd|\\u77db|\\u65a7|\\u97ad|\\u73af').test(text);
  });
}

function armorLikeItems(state: CharacterState): ItemEntry[] {
  return (state.equipped || []).filter(it => {
    const text = `${it.name} ${it.description || ''} ${it.item_type || ''}`;
    return it.item_type === 'armor' || new RegExp('\\u7532|\\u888d|\\u8863|\\u76fe|\\u955c|\\u51a0|\\u9774|\\u62a4|\\u94e0|\\u80c4').test(text);
  });
}

function optionById(palette: CombatActionPalette | undefined, optionId?: string): CombatActionOption | undefined {
  if (!palette || !optionId) return undefined;
  for (const group of [palette.basicAttack, palette.technique, palette.spell, palette.defense, palette.item, palette.other]) {
    const found = group.options.find(o => o.id === optionId);
    if (found) return found;
  }
  return undefined;
}

export function buildCombatActionPalette(state: CharacterState, session: CombatSession): CombatActionPalette {
  const restrained = hasRestrainingStatus(state, session);
  const sealed = hasSealedSpiritStatus(state, session);
  const weapons = weaponLikeItems(state);
  const armors = armorLikeItems(state);
  const skills = repairCombatArtsFromState(state, session.playerSkills).slice(0, 8);
  session.playerSkills = skills;
  const items = session.playerItems || [];
  const basicOptions: CombatActionOption[] = [];

  basicOptions.push({
    id: 'basic-mana-burst',
    name: '法力轰击',
    description: '以自身法力直接轰出，粗粝但不依赖兵器。',
    actionType: 'basic_attack',
    source: 'body',
    enabled: !sealed && session.playerMp >= 3,
    disabledReason: sealed ? '灵力受制，难以外放法力。' : session.playerMp < 3 ? '法力不足。' : undefined,
    mpCost: 3,
    intent: '以自身灵力试探性攻伐',
    tags: ['mana', 'fallback'],
  });

  for (const weapon of weapons.slice(0, 5)) {
    basicOptions.push({
      id: `weapon-${weapon.id}`,
      name: weapon.name,
      description: `${weapon.name}当前在手，可作为普通攻伐手段。`,
      actionType: 'basic_attack',
      source: 'weapon',
      enabled: !restrained,
      disabledReason: restrained ? '手脚受制，难以挥使兵器。' : undefined,
      itemId: weapon.id,
      mpCost: 0,
      intent: `以${weapon.name}近身或御使攻敌`,
      requiredItems: [weapon.id],
      tags: ['weapon'],
    });
  }

  if (!weapons.length) {
    basicOptions.push({
      id: 'basic-body-strike',
      name: '拳脚近击',
      description: '以体魄和身法贴身攻敌。',
      actionType: 'basic_attack',
      source: 'body',
      enabled: !restrained,
      disabledReason: restrained ? '手脚受制，无法近身出手。' : undefined,
      mpCost: 0,
      tags: ['body'],
    });
  }

  const techniqueOptions: CombatActionOption[] = [];
  const spellOptions: CombatActionOption[] = [];
  const artifactSpellOptions: CombatActionOption[] = [];
  skills.slice(0, 8).forEach((sk, idx) => {
    const kind = combatArtKind(sk, state);
    const option = buildSkillCombatOption(sk, idx, kind, session, sealed);
    if (kind === 'technique') techniqueOptions.push(option);
    else if (kind === 'artifact') artifactSpellOptions.push(option);
    else spellOptions.push(option);
  });

  const defenseOptions: CombatActionOption[] = [{
    id: 'defense-guard',
    name: '护体守势',
    description: '收束气机护住要害，降低下一轮承伤。',
    actionType: 'defense',
    source: 'body',
    enabled: true,
    mpCost: 0,
    tags: ['guard'],
  }];

  for (const armor of armors.slice(0, 4)) {
    defenseOptions.push({
      id: `armor-${armor.id}`,
      name: `${armor.name}护身`,
      description: `借${armor.name}承受来袭攻势；若攻势过强，可能损伤此物。`,
      actionType: 'defense',
      source: 'armor',
      enabled: true,
      itemId: armor.id,
      requiredItems: [armor.id],
      tags: ['armor'],
    });
  }

  const itemOptions = items.map((it): CombatActionOption => ({
    id: `item-${it.itemId}`,
    name: it.name,
    description: it.effect || it.description || '战斗中可用之物。',
    actionType: 'item',
    source: 'item',
    enabled: !restrained,
    disabledReason: restrained ? '手脚受制，难以取用物品。' : undefined,
    itemId: it.itemId,
    tags: ['item'],
  }));

  const otherOptions: CombatActionOption[] = [];
  if (restrained) {
    otherOptions.push({
      id: 'other-break-binding',
      name: '催力挣缚',
      description: sealed ? '强行调动残余气血与体魄挣开束缚。' : '鼓荡法力撑破束缚，争取恢复行动。',
      actionType: 'other',
      source: sealed ? 'body' : 'status',
      enabled: true,
      mpCost: sealed ? 0 : Math.min(8, Math.max(3, Math.floor(session.playerMaxMp * 0.08))),
      risk: '若失败，可能露出破绽。',
      intent: '解除当前束缚',
      tags: ['break-binding', 'scene'],
    });
  }
  otherOptions.push({ id: 'other-observe-opening', name: '观隙寻机', description: '暂缓强攻，观察敌人气机、法器与防护破绽。', actionType: 'other', source: 'ai', enabled: true, mpCost: 0, intent: '寻找下一轮机会', tags: ['observe'] });
  if (session.pendingImpulse?.reason === 'stalemate' || (session.stalemateStreak || 0) >= 2) {
    otherOptions.unshift(
      { id: 'other-stalemate-lure', name: '诱其露绽', description: '不再硬拼，以虚招与身位诱对方护势换气，争取下一拍破绽。', actionType: 'other', source: 'ai', enabled: true, mpCost: 0, intent: '打破僵持，诱使敌人露出护身或站位破绽', tags: ['observe', 'stalemate-breaker'] },
      { id: 'other-stalemate-risk', name: '行险破局', description: '冒险压近或催动异招，赌一线转机；若判断失误，可能反受其制。', actionType: 'other', source: 'ai', enabled: true, mpCost: Math.min(8, Math.max(0, Math.floor(session.playerMaxMp * 0.06))), risk: '若时机不合，可能被敌人抓住破绽。', intent: '用高风险手段打破互耗僵局', tags: ['stalemate-breaker', 'risk'] }
    );
  }
  otherOptions.push({ id: 'other-flee', name: '伺机脱身', description: '借地形或烟尘尝试脱离战场。', actionType: 'flee', source: 'environment', enabled: true, mpCost: 0, tags: ['flee'] });

  const palette: CombatActionPalette = {
    basicAttack: { enabled: basicOptions.some(o => o.enabled), label: '普攻', disabledReason: basicOptions.some(o => o.enabled) ? undefined : (restrained ? '当前受制，常规攻伐难以施展。' : '暂无可用普攻。'), options: basicOptions },
    technique: { enabled: techniqueOptions.some(o => o.enabled), label: '功法', disabledReason: techniqueOptions.length ? '当前功法运转受限。' : '暂无可用功法。', options: techniqueOptions },
    spell: { enabled: [...spellOptions, ...artifactSpellOptions].some(o => o.enabled), label: '法术', disabledReason: (spellOptions.length || artifactSpellOptions.length) ? '当前法术受限。' : '暂无可用法术。', options: [...spellOptions, ...artifactSpellOptions] },
    defense: { enabled: defenseOptions.some(o => o.enabled), label: '防御', options: defenseOptions },
    item: { enabled: itemOptions.some(o => o.enabled), label: '物品', disabledReason: itemOptions.length ? '当前难以取用物品。' : '暂无可用物品。', options: itemOptions },
    other: { enabled: otherOptions.some(o => o.enabled), label: '应变', options: otherOptions },
    generatedBy: 'engine-fallback',
    sceneHint: restrained ? '当前行动受束缚影响，AI 可生成解除、拖延、神识或环境应变。' : undefined,
    tacticalSituation: session.tacticalSituation,
  };
  return mergeAiOptionsIntoPalette(palette, session.aiActionOptions, session.tacticalSituation);
}

function isStalemateBreakerOption(option?: CombatActionOption): boolean {
  return !!option && ((option.tags || []).includes('stalemate-breaker') || String(option.id || '').startsWith('other-stalemate-'));
}

function recentCombatLowProgressStreak(session: CombatSession, round: CombatRound, selectedOption?: CombatActionOption): number {
  if (round.playerActionType === 'flee' || isStalemateBreakerOption(selectedOption)) return 0;
  const playerDamage = Math.max(0, Number(round.playerDamage || 0));
  const enemyDamage = Math.max(0, Number(round.enemyDamage || 0));
  const meaningfulHit = playerDamage >= 4 || enemyDamage >= 4;
  const meaningfulState = (round.playerHeal || 0) > 0 || (round.playerHits || []).some(h => h.dead) || (round.enemyActions || []).some(a => a.dead || a.actionType === 'stunned' || a.actionType === 'flee');
  if (meaningfulHit || meaningfulState) return 0;
  const previous = (session.log || []).slice(-2);
  const previousLow = previous.filter(r => Math.max(0, Number(r.playerDamage || 0)) <= 2 && Math.max(0, Number(r.enemyDamage || 0)) <= 2 && !(r.playerHits || []).some(h => h.dead)).length;
  return Math.max(Number(session.stalemateStreak || 0), previousLow) + 1;
}

function buildStalemateImpulse(session: CombatSession, enemy?: CombatEnemy, streak = 0): NonNullable<CombatSession['pendingImpulse']> {
  const target = enemy?.name || session.enemies?.[session.currentEnemyIdx]?.name || '敌手';
  const text = streak >= 4
    ? `你与${target}又一次错身而过，攻势被护身灵光磨散，对方也难真正逼入要害。这样耗下去，只会把灵力与耐心一并拖干；必须改换打法，寻破绽、诱其露形，或趁势脱身。`
    : `你察觉这场交锋一时陷入僵持：硬攻难入，对方也难一举压倒你。若继续照旧出手，恐怕只是徒耗气机；此刻该换个破局法子。`;
  return { kind: 'contingency', reason: 'stalemate', prompt: text };
}

function deriveFallbackTacticalSituation(session: CombatSession, round: CombatRound, stalemateStreak = 0): NonNullable<CombatSession['tacticalSituation']> {
  const playerDamage = Math.max(0, Number(round.playerDamage || 0));
  const enemyDamage = Math.max(0, Number(round.enemyDamage || 0));
  const playerHpPct = session.playerMaxHp > 0 ? session.playerHp / session.playerMaxHp : 1;
  let tempo: NonNullable<CombatSession['tacticalSituation']>['tempo'] = 'chaos';
  let advantage: NonNullable<CombatSession['tacticalSituation']>['advantage'] = 'unclear';
  if (stalemateStreak >= 3 || (playerDamage <= 2 && enemyDamage <= 2)) { tempo = 'stalemate'; advantage = 'even'; }
  else if (playerHpPct <= 0.35 || enemyDamage >= Math.max(8, playerDamage * 2)) { tempo = 'danger'; advantage = 'enemy'; }
  else if (playerDamage >= Math.max(8, enemyDamage * 2)) { tempo = 'pressing'; advantage = 'player'; }
  else if ((round.playerHits || []).some(h => h.dead) || round.playerHeal) { tempo = 'turning'; advantage = 'player'; }
  const reason = tempo === 'stalemate'
    ? '双方护势与身法互相抵住，硬拼难以打开局面。'
    : tempo === 'danger'
      ? '敌方压力正在逼近要害，需要尽快守御、脱身或反制。'
      : tempo === 'pressing'
        ? '这一拍攻势压住了对方气机，可趁势扩大战果。'
        : '战场气机仍在剧烈变化，需观察下一处破口。';
  return {
    tempo,
    advantage,
    reason,
    playerOpening: tempo === 'stalemate' ? '诱其护势换气，或借地形逼其移步。' : undefined,
    enemyPressure: tempo === 'danger' ? '敌方攻势已逼近气血与护体薄处。' : undefined,
    suggestedFocus: tempo === 'stalemate' ? '改用应变破局' : tempo === 'danger' ? '守御或脱身' : tempo === 'pressing' ? '趁势追击' : '观势再动',
  };
}

function sanitizeTacticalSituation(proposal: CombatRoundProposal, fallback: NonNullable<CombatSession['tacticalSituation']>): NonNullable<CombatSession['tacticalSituation']> {
  const raw = proposal.tacticalSituation || {};
  const tempos = new Set(['pressing', 'stalemate', 'opening', 'danger', 'flee_window', 'turning', 'chaos']);
  const advantages = new Set(['player', 'enemy', 'even', 'unclear']);
  return {
    tempo: tempos.has(raw.tempo as any) ? raw.tempo as any : fallback.tempo,
    advantage: advantages.has(raw.advantage as any) ? raw.advantage as any : fallback.advantage,
    reason: String(raw.reason || fallback.reason).slice(0, 100),
    playerOpening: raw.playerOpening ? String(raw.playerOpening).slice(0, 90) : fallback.playerOpening,
    enemyPressure: raw.enemyPressure ? String(raw.enemyPressure).slice(0, 90) : fallback.enemyPressure,
    suggestedFocus: raw.suggestedFocus ? String(raw.suggestedFocus).slice(0, 70) : fallback.suggestedFocus,
  };
}

function validateAiCombatActions(state: CharacterState, session: CombatSession, proposal: CombatRoundProposal): CombatActionOption[] {
  const actions = Array.isArray(proposal.nextActions) ? proposal.nextActions : [];
  const validTypes = new Set(['basic_attack', 'defense', 'other', 'flee', 'item', 'talisman', 'technique', 'spell']);
  const seen = new Set<string>();
  return actions.map((raw, idx): CombatActionOption | null => {
    const actionType = validTypes.has(String(raw.actionType || '')) ? raw.actionType as CombatActionOption['actionType'] : 'other';
    const name = String(raw.name || '').trim().slice(0, 18);
    const description = String(raw.description || '').trim().slice(0, 100);
    if (!name || !description) return null;
    const option: CombatActionOption = {
      id: 'ai-' + String(raw.id || name || idx).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) + '-' + idx,
      name,
      description,
      actionType,
      source: 'ai',
      enabled: raw.enabled !== false,
      disabledReason: raw.disabledReason ? String(raw.disabledReason).slice(0, 60) : undefined,
      mpCost: Math.max(0, Math.min(session.playerMp, Math.floor(Number(raw.mpCost || 0)))) || 0,
      risk: raw.risk ? String(raw.risk).slice(0, 60) : undefined,
      intent: raw.intent ? String(raw.intent).slice(0, 80) : description,
      tags: Array.from(new Set([...(Array.isArray(raw.tags) ? raw.tags.map(String) : []), 'ai-context'])).slice(0, 6),
    };
    if ((actionType === 'item' || actionType === 'talisman') && raw.itemId) {
      const item = state.inventory.find(it => it.id === raw.itemId);
      if (!item) return null;
      option.itemId = item.id;
      option.requiredItems = [item.id];
    } else if (actionType === 'item' || actionType === 'talisman') {
      return null;
    }
    if ((actionType === 'technique' || actionType === 'spell') && raw.skillIdx != null) {
      const skillIdx = Math.floor(Number(raw.skillIdx));
      if (!session.playerSkills?.[skillIdx]) return null;
      option.skillIdx = skillIdx;
    } else if (actionType === 'technique' || actionType === 'spell') {
      option.actionType = 'other';
      option.tags = Array.from(new Set([...(option.tags || []), 'converted-art-intent']));
    }
    if (seen.has(option.id)) option.id += '-' + seen.size;
    seen.add(option.id);
    return option;
  }).filter(Boolean).slice(0, 5) as CombatActionOption[];
}

function mergeAiOptionsIntoPalette(palette: CombatActionPalette, aiOptions?: CombatActionOption[], tacticalSituation?: NonNullable<CombatSession['tacticalSituation']>): CombatActionPalette {
  if (!aiOptions?.length && !tacticalSituation) return palette;
  const next: CombatActionPalette = { ...palette, generatedBy: aiOptions?.length ? 'hybrid' : palette.generatedBy, tacticalSituation };
  const add = (key: CombatActionGroupKey, option: CombatActionOption) => {
    const group = next[key];
    const exists = group.options.some(o => o.id === option.id);
    const options = exists ? group.options : [option, ...group.options];
    next[key] = { ...group, enabled: options.some(o => o.enabled), options };
  };
  for (const option of aiOptions || []) {
    if (option.actionType === 'basic_attack') add('basicAttack', option);
    else if (option.actionType === 'defense') add('defense', option);
    else if (option.actionType === 'item' || option.actionType === 'talisman') add('item', option);
    else if (option.actionType === 'technique') add('technique', option);
    else if (option.actionType === 'spell') add('spell', option);
    else add('other', option);
  }
  return next;
}

function validateCombatActionOption(state: CharacterState, session: CombatSession, option?: CombatActionOption): { ok: boolean; reason?: string } {
  if (!option) return { ok: true };
  if (!option.enabled) return { ok: false, reason: option.disabledReason || '此刻不可施展。' };
  if (option.mpCost && session.playerMp < option.mpCost) return { ok: false, reason: '法力不足。' };
  const equippedIds = new Set((state.equipped || []).map(it => it.id));
  const inventoryIds = new Set((state.inventory || []).map(it => it.id));
  for (const itemId of option.requiredItems || []) {
    if (!equippedIds.has(itemId) && !inventoryIds.has(itemId)) return { ok: false, reason: '前置器物已经不在身边。' };
  }
  for (const forbidden of option.forbiddenStatuses || []) {
    if ((state.activeStatuses || []).some(s => s.name === forbidden || s.id === forbidden)) return { ok: false, reason: '当前状态不允许此行动。' };
  }
  return { ok: true };
}

function computeDamage(attack: number, defense: number, power: number = 1, variance: number = 0.2): number {
  const base = Math.max(1, attack - defense * 0.5);
  const dmg = base * power * (1 + (Math.random() * 2 - 1) * variance);
  return Math.max(1, Math.floor(dmg));
}

function isGenericCombatArtName(name?: string): boolean {
  const text = String(name || '').trim();
  if (!text) return true;
  return /行动.*气术|气术式|未名术|^术法$/.test(text);
}

function repairCombatArtsFromState(state: CharacterState, arts?: CombatSession['playerSkills']): NonNullable<CombatSession['playerSkills']> {
  const learned = buildLearnedCombatArts(state).slice(0, 8);
  const firstByItem = new Map<string, typeof learned[number]>();
  for (const art of learned) if (!firstByItem.has(art.itemId)) firstByItem.set(art.itemId, art);
  const source = arts?.length ? arts : learned;
  const repaired = source.map((art, idx) => {
    const learnedMatch = (art.itemId ? firstByItem.get(art.itemId) : undefined) || learned[idx];
    if (!learnedMatch) return art;
    const desc = String(art.description || '');
    const learnedIsArtifactArt = learnedMatch.sourceType === 'artifact';
    const nameLooksLikeItemName = state.equipped?.some((it: any) => it.id === art.itemId && art.name === it.name);
    if (!learnedIsArtifactArt && !nameLooksLikeItemName && !isGenericCombatArtName(art.name) && desc && !/行动.*气术|气术式/.test(desc)) return art;
    return { ...art, name: learnedMatch.name, description: learnedMatch.description, mpCost: art.mpCost ?? learnedMatch.mpCost, power: art.power || learnedMatch.power, element: art.element || learnedMatch.element, adaptation: art.adaptation ?? learnedMatch.adaptation, sourceType: learnedMatch.sourceType || art.sourceType };
  });
  return (repaired.length ? repaired : learned) as NonNullable<CombatSession['playerSkills']>;
}

function addCombatWeaknessInsight(session: CombatSession, enemyIdx: number, source: string): void {
  const insights = (session.tacticalInsights || []).filter(x => x.expiresRound >= session.round && x.stacks > 0);
  const existing = insights.find(x => x.kind === 'weakness' && x.enemyIdx === enemyIdx);
  if (existing) {
    existing.stacks = Math.min(3, existing.stacks + 1);
    existing.expiresRound = Math.max(existing.expiresRound, session.round + 3);
    existing.note = '已记下对手气机间一处破绽，下次攻伐更容易命中要害。';
  } else {
    insights.push({ id: 'weak_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6), enemyIdx, kind: 'weakness', stacks: 1, bonusPct: 0.35, expiresRound: session.round + 3, source, note: '已记下对手气机间一处破绽，下次攻伐更容易命中要害。' });
  }
  session.tacticalInsights = insights;
}

function consumeCombatWeaknessInsight(session: CombatSession, enemyIdx: number): { bonusPct: number; note: string } | null {
  const insights = (session.tacticalInsights || []).filter(x => x.expiresRound >= session.round && x.stacks > 0);
  const insight = insights.find(x => x.kind === 'weakness' && x.enemyIdx === enemyIdx);
  if (!insight) { session.tacticalInsights = insights; return null; }
  insight.stacks -= 1;
  const bonusPct = Math.max(0.15, Math.min(0.75, insight.bonusPct || 0.35));
  const note = insight.note || '先前窥见的破绽在此刻应验。';
  session.tacticalInsights = insights.filter(x => x.stacks > 0 && x.expiresRound >= session.round);
  return { bonusPct, note };
}

function hasActiveWeaknessInsight(session: CombatSession, enemyIdx: number): boolean {
  return (session.tacticalInsights || []).some(x => x.kind === 'weakness' && x.enemyIdx === enemyIdx && x.stacks > 0 && x.expiresRound >= session.round);
}

// 执行一回合战斗
// action: 'attack' | 'skill' | 'item' | 'defend' | 'flee' | 'scripture'
// payload: skillIdx | itemId 等
export interface CombatActionResult {
  state: CharacterState;
  round: CombatRound;
  ended: boolean;
  endStatus?: 'victory' | 'defeat' | 'fled';
  victoryDrops?: ItemEntry[];
}

export function executeCombatRound(
  state: CharacterState,
  action: 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee' | 'other',
  payload?: { skillIdx?: number; itemId?: string; optionId?: string },
): CombatActionResult {
  if (!state.combatSession || state.combatSession.status !== 'ongoing') {
    return {
      state,
      round: { round: 0, playerAction: '', playerActionType: 'attack', narrative: '战斗已结束', playerHpAfter: state.hp, enemyHpAfter: 0 },
      ended: true,
    };
  }
  const session = { ...state.combatSession };
  const enemy = session.enemies[session.currentEnemyIdx];
  if (!enemy) {
    return {
      state: { ...state, combatSession: { ...session, status: 'victory' } },
      round: { round: session.round, playerAction: '战场无敌', playerActionType: 'attack', narrative: '已无敌人', playerHpAfter: session.playerHp, enemyHpAfter: 0 },
      ended: true,
      endStatus: 'victory',
    };
  }
  session.playerSkills = repairCombatArtsFromState(state, session.playerSkills);
  session.actionPalette = buildCombatActionPalette(state, session);
  const selectedOption = optionById(session.actionPalette, payload?.optionId);
  const validation = validateCombatActionOption(state, session, selectedOption);
  if (!validation.ok) {
    return {
      state: { ...state, combatSession: session },
      round: { round: session.round, playerAction: selectedOption?.name || '行动受阻', playerActionType: 'defend', narrative: validation.reason || '此刻无法成招。', playerHpAfter: session.playerHp, enemyHpAfter: enemy.hp, playerMpAfter: session.playerMp },
      ended: false,
    };
  }

  let playerHp = session.playerHp;
  let playerMp = session.playerMp;
  let enemyHp = enemy.hp;
  let playerDamageDealt = 0;
  let playerHeal = 0;
  let enemyDamageDealt = 0;
  let narrative = '';
  let playerActionDesc = '';
  let playerActionType: CombatRound['playerActionType'] = 'attack';

  // 玩家行动
  if (action === 'attack') {
    playerActionType = 'attack';
    playerActionDesc = '挥出攻招';
    playerDamageDealt = computeDamage(session.playerAttack, enemy.defense);
    const weakness = consumeCombatWeaknessInsight(session, session.currentEnemyIdx);
    if (weakness) {
      const bonus = Math.max(1, Math.floor(playerDamageDealt * weakness.bonusPct));
      playerDamageDealt += bonus;
      narrative += '先前窥见的破绽在此刻应验，';
    }
    enemyHp -= playerDamageDealt;
    narrative += `你出招攻向${enemy.name}，造成 ${playerDamageDealt} 点伤害。`;
  } else if (action === 'skill' && payload?.skillIdx != null) {
    playerActionType = 'skill';
    const skillIdx = selectedOption?.skillIdx ?? payload.skillIdx;
    const skill = skillIdx != null ? session.playerSkills?.[skillIdx] : undefined;
    if (!skill) {
      return {
        state,
        round: { round: session.round, playerAction: '法术失败', playerActionType: 'skill', narrative: '法术不存在', playerHpAfter: playerHp, enemyHpAfter: enemyHp },
        ended: false,
      };
    }
    if (playerMp < skill.mpCost) {
      return {
        state,
        round: { round: session.round, playerAction: `试图施展${skill.name}`, playerActionType: 'skill', narrative: '灵力不足，法术施展失败！', playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
        ended: false,
      };
    }
    playerMp -= skill.mpCost;
    playerActionDesc = `施展${skill.name}`;
    playerDamageDealt = computeDamage(session.playerAttack, enemy.defense, skill.power, 0.3);
    const weakness = consumeCombatWeaknessInsight(session, session.currentEnemyIdx);
    if (weakness) {
      const bonus = Math.max(1, Math.floor(playerDamageDealt * weakness.bonusPct));
      playerDamageDealt += bonus;
      narrative += '你循着先前记下的破绽催动术法，';
    }
    enemyHp -= playerDamageDealt;
    narrative += `你催动${skill.name}，灵力化为攻伐之力，造成 ${playerDamageDealt} 点伤害。`;
  } else if (action === 'other') {
    playerActionType = 'defend';
    const option = selectedOption;
    const mpCost = option?.mpCost || 0;
    if (mpCost > 0) playerMp = Math.max(0, playerMp - mpCost);
    if (option?.id === 'other-break-binding') {
      playerActionDesc = option.name;
      narrative += `你以${option.name}应对战局，稳住当前险势。`;
    } else if (option?.id === 'other-observe-opening' || option?.id === 'defense-focus') {
      playerActionDesc = option.name;
      addCombatWeaknessInsight(session, session.currentEnemyIdx, option.id);
      narrative += `你暂缓强攻，凝神观察${enemy.name}的气机流转，记下一处可乘破绽。`;
    } else if (option?.id === 'other-flee') {
      playerActionType = 'flee';
      playerActionDesc = option.name;
      narrative += `你借地形与烟尘伺机脱身。`;
    } else {
      playerActionDesc = option?.name || '护体守势';
      narrative += `你立起${playerActionDesc}，收束气机护住要害。`;
    }
  } else if (action === 'item' && payload?.itemId) {
    playerActionType = 'item';
    const item = state.inventory.find(it => it.id === payload.itemId);
    if (!item) {
      return {
        state,
        round: { round: session.round, playerAction: '使用丹药', playerActionType: 'item', narrative: '物品不存在', playerHpAfter: playerHp, enemyHpAfter: enemyHp },
        ended: false,
      };
    }
    playerActionDesc = `服用${item.name}`;
    for (const eff of item.effects || []) {
      if (eff.operation === 'add' && eff.target_attribute === 'hp') {
        const heal = eff.value;
        playerHp = Math.min(session.playerMaxHp, playerHp + heal);
        playerHeal = heal;
      } else if (eff.operation === 'add' && eff.target_attribute === 'mp') {
        playerMp = Math.min(session.playerMaxMp, playerMp + eff.value);
      }
    }
    narrative += `你服下${item.name}，回复 ${playerHeal} 点气血。`;
    // 消耗物品
    state = { ...state, inventory: state.inventory.filter(it => it.id !== payload.itemId) };
    session.playerItems = (session.playerItems || []).filter(it => it.itemId !== payload.itemId);
  } else if (action === 'talisman' && payload?.itemId) {
    // Task 23: 符箓系统——单次使用、即时生效的战斗道具
    playerActionType = 'item';
    const item = state.inventory.find(it => it.id === payload.itemId);
    if (!item) {
      return {
        state,
        round: { round: session.round, playerAction: '激发符箓', playerActionType: 'item', narrative: '符箓不存在', playerHpAfter: playerHp, enemyHpAfter: enemyHp },
        ended: false,
      };
    }
    playerActionDesc = `激发${item.name}`;
    // 根据 effects 中的 target_attribute 判定符箓类型，兼容 AI 可能写出的 targetAttribute/attribute 别名
    let talismanResolved = false;
    for (const eff of item.effects || []) {
      const target = (eff as any).target_attribute || (eff as any).targetAttribute || (eff as any).attribute || '';
      const operation = (eff as any).operation || 'add';
      if (target === 'talisman_attack' && operation === 'add') {
        // 攻击符：直接对敌人造成 value 伤害（无视防御一半）
        const dmg = Math.max(1, Math.floor(eff.value - enemy.defense * 0.3));
        playerDamageDealt = dmg;
        enemyHp -= dmg;
        talismanResolved = true;
        narrative += `你激发${item.name}，符箓化为攻伐之力轰向${enemy.name}，造成 ${dmg} 点伤害。`;
      } else if (target === 'talisman_defense' && operation === 'add') {
        // 防御符：本回合减伤 value
        session.talismanDefenseActive = eff.value;
        talismanResolved = true;
        narrative += `你激发${item.name}，符箓化为护体金光，本回合可减伤 ${eff.value} 点。`;
      } else if (target === 'talisman_heal' && operation === 'add') {
        // 治疗符：回复 HP
        const heal = eff.value;
        playerHp = Math.min(session.playerMaxHp, playerHp + heal);
        playerHeal = heal;
        talismanResolved = true;
        narrative += `你激发${item.name}，符箓化为温润灵光，回复 ${heal} 点气血。`;
      } else if (target === 'talisman_escape' && operation === 'add') {
        // 遁逃符：高概率逃跑
        talismanResolved = true;
        const escapeChance = Math.min(0.95, 0.5 + eff.value * 0.1);
        if (Math.random() < escapeChance) {
          narrative += `你激发${item.name}，符箓化为金光裹身，瞬间脱离战场！`;
          // 消耗符箓
          state = { ...state, inventory: state.inventory.filter(it => it.id !== payload.itemId) };
          session.playerItems = (session.playerItems || []).filter(it => it.itemId !== payload.itemId);
          const endSession: CombatSession = { ...session, status: 'fled' };
          return {
            state: { ...state, combatSession: endSession, hp: playerHp, mp: playerMp },
            round: { round: session.round, playerAction: playerActionDesc, playerActionType, narrative, playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
            ended: true,
            endStatus: 'fled',
          };
        } else {
          narrative += `你激发${item.name}，但灵力被压制，未能脱身。`;
        }
      } else if (target === 'talisman_stun' && operation === 'add') {
        // 镇压符：让敌人本回合无法行动
        session.enemyStunned = true;
        talismanResolved = true;
        narrative += `你激发${item.name}，符箓化为镇压力量，${enemy.name}本回合无法行动！`;
      }
    }
    if (!talismanResolved) {
      narrative += `你激发${item.name}，符纸微燃，灵光散入战局。`;
    }
    // 消耗符箓（除遁逃符已消耗外）
    state = { ...state, inventory: state.inventory.filter(it => it.id !== payload.itemId) };
    session.playerItems = (session.playerItems || []).filter(it => it.itemId !== payload.itemId);
  } else if (action === 'defend') {
    playerActionType = 'defend';
    playerActionDesc = '凝神防御';
    narrative += '你凝神戒备，减少本回合受到的伤害。';
  } else if (action === 'flee') {
    playerActionType = 'flee';
    playerActionDesc = '转身遁走';
    // 逃跑成功率：速度差 + 随机
    const fleeChance = 0.3 + (session.playerSpeed - enemy.speed) * 0.02;
    if (Math.random() < fleeChance) {
      narrative += '你身形一闪，成功脱离战场。';
      const endSession: CombatSession = { ...session, status: 'fled' };
      return {
        state: { ...state, combatSession: endSession, hp: playerHp, mp: playerMp },
        round: { round: session.round, playerAction: playerActionDesc, playerActionType, narrative, playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
        ended: true,
        endStatus: 'fled',
      };
    } else {
      narrative += '你试图遁走，却被对方缠住，未能脱身！';
    }
  }

  // 检查敌人是否被击败
  if (enemyHp <= 0) {
    enemyHp = 0;
    narrative += `${enemy.name}倒下！`;
    // 检查是否还有其他敌人
    const nextIdx = session.enemies.findIndex((e, i) => i > session.currentEnemyIdx && e.hp > 0);
    if (nextIdx < 0) {
      // 全部敌人被击败 → 胜利
      const updatedEnemies = session.enemies.map((e, i) => i === session.currentEnemyIdx ? { ...e, hp: 0 } : e);
      const endSession: CombatSession = { ...session, enemies: updatedEnemies, status: 'victory', playerHp, playerMp };
      narrative += '战场归于沉寂，你胜了！';
      return {
        state: { ...state, combatSession: endSession, hp: playerHp, mp: playerMp },
        round: { round: session.round, playerAction: playerActionDesc, playerActionType, playerDamage: playerDamageDealt, playerHeal, narrative, playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
        ended: true,
        endStatus: 'victory',
        victoryDrops: session.victoryDrops,
      };
    } else {
      // 切换到下一个敌人
      session.currentEnemyIdx = nextIdx;
      narrative += `新的对手${session.enemies[nextIdx].name}逼近！`;
    }
  } else {
    // 敌人未死 → 灵宠参战追加攻击（在敌人反击前）
    if (session.petCombatant && session.petCombatant.hp > 0) {
      const petC = session.petCombatant;
      // 冷却中 → 普通攻击；否则施放技能并进入冷却
      let petDmg: number;
      let petActionDesc: string;
      if (petC.currentCooldown > 0) {
        petDmg = computeDamage(petC.attack, enemy.defense, 0.5, 0.25);
        petActionDesc = `${petC.name}迅疾扑击`;
        petC.currentCooldown -= 1;
      } else {
        petDmg = computeDamage(petC.attack, enemy.defense, petC.skillPower, 0.3);
        petActionDesc = `${petC.name}施展${petC.skillName}`;
        petC.currentCooldown = petC.skillCooldown;
      }
      enemyHp -= petDmg;
      playerDamageDealt += petDmg;
      narrative += `${petActionDesc}，对${enemy.name}追加 ${petDmg} 点伤害。`;
      // 灵宠攻击后再次检查敌人是否被击败
      if (enemyHp <= 0) {
        enemyHp = 0;
        narrative += `${enemy.name}倒下！`;
        const nextIdx = session.enemies.findIndex((e, i) => i > session.currentEnemyIdx && e.hp > 0);
        if (nextIdx < 0) {
          const updatedEnemies = session.enemies.map((e, i) => i === session.currentEnemyIdx ? { ...e, hp: 0 } : e);
          const endSession: CombatSession = { ...session, enemies: updatedEnemies, status: 'victory', playerHp, playerMp };
          narrative += '战场归于沉寂，你胜了！';
          return {
            state: { ...state, combatSession: endSession, hp: playerHp, mp: playerMp },
            round: { round: session.round, playerAction: playerActionDesc, playerActionType, playerDamage: playerDamageDealt, playerHeal, narrative, playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
            ended: true,
            endStatus: 'victory',
            victoryDrops: session.victoryDrops,
          };
        } else {
          session.currentEnemyIdx = nextIdx;
          narrative += `新的对手${session.enemies[nextIdx].name}逼近！`;
        }
      }
    }

    // 敌人反击（除非被镇符眩晕）
    if (!session.enemyStunned) {
      let enemyDmg = action === 'defend'
        ? Math.floor(computeDamage(enemy.attack, session.playerDefense, 1, 0.2) * 0.5)
        : computeDamage(enemy.attack, session.playerDefense, 1, 0.2);
      // Task 23: 防御符减伤
      if (session.talismanDefenseActive && session.talismanDefenseActive > 0) {
        const blocked = Math.min(enemyDmg, session.talismanDefenseActive);
        enemyDmg -= blocked;
        narrative += `护体金光抵消 ${blocked} 点伤害。`;
      }
      enemyDamageDealt = enemyDmg;
      playerHp -= enemyDmg;
      narrative += `${enemy.name}反扑，对你造成 ${enemyDmg} 点伤害。`;
      // 玩家死亡判定
      if (playerHp <= 0) {
        playerHp = 0;
        const endSession: CombatSession = { ...session, status: 'defeat', playerHp: 0 };
        narrative += '你气血耗尽，败下阵来...';
        return {
          state: { ...state, combatSession: endSession, hp: 0, alive: false, causeOfDeath: `战死于${enemy.name}之手` },
          round: { round: session.round, playerAction: playerActionDesc, playerActionType, playerDamage: playerDamageDealt, enemyDamage: enemyDamageDealt, narrative, playerHpAfter: 0, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
          ended: true,
          endStatus: 'defeat',
        };
      }
    } else {
      narrative += `${enemy.name}被镇符压制，无法行动！`;
    }
  }

  // 清除本回合临时状态（符箓减伤/镇符眩晕）
  session.talismanDefenseActive = undefined;
  session.enemyStunned = undefined;

  // 更新敌人 HP 并推进回合
  const updatedEnemies = session.enemies.map((e, i) => i === session.currentEnemyIdx ? { ...e, hp: enemyHp } : e);
  const newSession: CombatSession = {
    ...session,
    enemies: updatedEnemies,
    round: session.round + 1,
    log: [...session.log, {
      round: session.round,
      playerAction: playerActionDesc,
      playerActionType,
      playerDamage: playerDamageDealt,
      playerHeal,
      enemyDamage: enemyDamageDealt,
      narrative,
      playerHpAfter: playerHp,
      enemyHpAfter: enemyHp,
      playerMpAfter: playerMp,
    }],
    playerHp,
    playerMp,
  };
  return {
    state: { ...state, combatSession: newSession, hp: playerHp, mp: playerMp },
    round: newSession.log[newSession.log.length - 1],
    ended: false,
  };
}

// 结束战斗（清理 combatSession，但保留 log 用于事件记录）

function clampCombatNumber(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function combatPlayerActionTypeFromAction(action: 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee' | 'other'): CombatRound['playerActionType'] {
  if (action === 'skill') return 'skill';
  if (action === 'item' || action === 'talisman') return 'item';
  if (action === 'defend' || action === 'other') return 'defend';
  if (action === 'flee') return 'flee';
  return 'attack';
}

function maxFactBoundedPlayerDamage(
  state: CharacterState,
  session: CombatSession,
  enemy: CombatEnemy,
  action: 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee' | 'other',
  payload?: { skillIdx?: number; itemId?: string; optionId?: string },
  selectedOption?: CombatActionOption,
): { maxDamage: number; mpCost: number; playerActionDesc: string; audit: string[] } {
  const audit: string[] = [];
  let maxDamage = Math.max(1, Math.floor((session.playerAttack - enemy.defense * 0.35) * 1.6));
  let mpCost = selectedOption?.mpCost || 0;
  let playerActionDesc = selectedOption?.name || '出手试探';
  if (action === 'skill') {
    const skillIdx = selectedOption?.skillIdx ?? payload?.skillIdx;
    const skill = skillIdx != null ? session.playerSkills?.[skillIdx] : undefined;
    if (skill) {
      mpCost = Math.max(mpCost, skill.mpCost || 0);
      maxDamage = Math.max(1, Math.floor((session.playerAttack - enemy.defense * 0.3) * Math.max(0.5, skill.power || 1) * 1.8));
      playerActionDesc = selectedOption?.name || '施展' + skill.name;
    } else {
      maxDamage = 0;
      audit.push('AI裁决涉及的术法不存在，引擎拒绝术法伤害。');
    }
  } else if (action === 'item' || action === 'talisman') {
    const item = payload?.itemId ? state.inventory.find(it => it.id === payload.itemId) : undefined;
    playerActionDesc = selectedOption?.name || (item ? '催用' + item.name : '出手试探');
    maxDamage = 0;
    if (!item) {
      audit.push('AI裁决涉及的物品不在行囊，引擎拒绝物品效果。');
    } else {
      for (const eff of item.effects || []) {
        const target = (eff as any).target_attribute || (eff as any).targetAttribute || (eff as any).attribute || '';
        if ((eff as any).operation === 'add' && (target === 'talisman_attack' || target === 'attack')) maxDamage += Math.max(0, Math.floor(Number((eff as any).value || 0) - enemy.defense * 0.25));
      }
      maxDamage = Math.max(maxDamage, action === 'talisman' ? Math.floor(session.playerAttack * 0.6) : 0);
    }
  } else if (action === 'defend') {
    playerActionDesc = selectedOption?.name || '出手试探';
    maxDamage = Math.floor(session.playerAttack * 0.35);
  } else if (action === 'flee') {
    playerActionDesc = selectedOption?.name || '出手试探';
    maxDamage = 0;
  } else if (action === 'other') {
    playerActionDesc = selectedOption?.name || '出手试探';
    maxDamage = Math.floor(session.playerAttack * 0.75);
  }
  if ((action === 'attack' || action === 'skill') && hasActiveWeaknessInsight(session, session.currentEnemyIdx)) {
    maxDamage = Math.floor(maxDamage * 1.45);
    audit.push('先前观得破绽，本次攻伐上限已按战术因果放宽。');
  }
  if (mpCost > session.playerMp) {
    audit.push('AI裁决消耗法力超过当前余量，引擎按当前法力上限截断。');
    mpCost = session.playerMp;
  }
  return { maxDamage: Math.max(0, maxDamage), mpCost: Math.max(0, mpCost), playerActionDesc, audit };
}

export function executeCombatRoundWithProposal(
  state: CharacterState,
  action: 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee' | 'other',
  payload: { skillIdx?: number; itemId?: string; optionId?: string } | undefined,
  proposal: CombatRoundProposal,
): CombatActionResult {
  if (!state.combatSession || state.combatSession.status !== 'ongoing') return executeCombatRound(state, action, payload);
  let nextState = { ...state };
  const session: CombatSession = { ...state.combatSession, log: [...(state.combatSession.log || [])] };
  const enemy = session.enemies[session.currentEnemyIdx];
  if (!enemy) return executeCombatRound(state, action, payload);
  session.playerSkills = repairCombatArtsFromState(nextState, session.playerSkills);
  session.actionPalette = buildCombatActionPalette(nextState, session);
  const selectedOption = optionById(session.actionPalette, payload?.optionId);
  const validation = validateCombatActionOption(nextState, session, selectedOption);
  if (!validation.ok) {
    return { state: { ...nextState, combatSession: session }, round: { round: session.round, playerAction: selectedOption?.name || '出手试探', playerActionType: 'defend', narrative: validation.reason || '此刻无法成行。', playerHpAfter: session.playerHp, enemyHpAfter: enemy.hp, playerMpAfter: session.playerMp, aiAudit: ['引擎拒绝了不满足硬事实前置的 AI 战斗裁决。'] }, ended: false };
  }
  const audit: string[] = [...(Array.isArray(proposal.auditHints) ? proposal.auditHints.map(String).slice(0, 4) : [])];
  const bound = maxFactBoundedPlayerDamage(nextState, session, enemy, action, payload, selectedOption);
  audit.push(...bound.audit);
  let playerHp = session.playerHp;
  let playerMp = Math.max(0, session.playerMp - bound.mpCost);
  const playerActionType = combatPlayerActionTypeFromAction(action);
  const observeWeakness = action === 'other' && (selectedOption?.id === 'other-observe-opening' || selectedOption?.id === 'defense-focus' || (selectedOption?.tags || []).includes('observe'));
  if (observeWeakness) {
    addCombatWeaknessInsight(session, session.currentEnemyIdx, selectedOption?.id || 'observe');
    audit.push('本回合应变已转化为可持续的破绽记忆，后续攻伐可消耗。');
  }
  let playerDamageDealt = clampCombatNumber(proposal.playerDamage, 0, bound.maxDamage);
  let weaknessNote = '';
  if ((action === 'attack' || action === 'skill') && playerDamageDealt > 0) {
    const weakness = consumeCombatWeaknessInsight(session, session.currentEnemyIdx);
    if (weakness) {
      const bonus = Math.max(1, Math.floor(playerDamageDealt * weakness.bonusPct));
      playerDamageDealt = Math.min(bound.maxDamage, playerDamageDealt + bonus);
      weaknessNote = '先前窥见的破绽在此刻应验，攻势更深一层。';
      audit.push('已消耗一层破绽记忆，本次攻伐获得事实加成。');
    }
  }
  if (Number(proposal.playerDamage || 0) > bound.maxDamage) audit.push('AI裁决伤害 ' + proposal.playerDamage + ' 超过事实上限 ' + bound.maxDamage + '，已截断。');
  let playerHeal = 0;
  if (action === 'item' || action === 'talisman') {
    const item = payload?.itemId ? nextState.inventory.find(it => it.id === payload.itemId) : undefined;
    if (item) {
      let maxHeal = 0;
      for (const eff of item.effects || []) {
        const target = (eff as any).target_attribute || (eff as any).targetAttribute || (eff as any).attribute || '';
        if ((eff as any).operation === 'add' && (target === 'hp' || target === 'talisman_heal')) maxHeal += Math.max(0, Number((eff as any).value || 0));
        if ((eff as any).operation === 'add' && target === 'mp') playerMp = Math.min(session.playerMaxMp, playerMp + Math.max(0, Number((eff as any).value || 0)));
        if ((eff as any).operation === 'add' && target === 'talisman_defense') session.talismanDefenseActive = Math.max(0, Number((eff as any).value || 0));
        if ((eff as any).operation === 'add' && target === 'talisman_stun') session.enemyStunned = true;
      }
      playerHeal = clampCombatNumber(proposal.playerHeal, 0, maxHeal);
      playerHp = Math.min(session.playerMaxHp, playerHp + playerHeal);
      if (proposal.consumeItem !== false) {
        nextState = { ...nextState, inventory: nextState.inventory.filter(it => it.id !== item.id) };
        session.playerItems = (session.playerItems || []).filter(it => it.itemId !== item.id);
      }
    }
  } else {
    const healCap = action === 'defend' || action === 'other' ? Math.floor(session.playerMaxHp * 0.25) : 0;
    playerHeal = clampCombatNumber(proposal.playerHeal, 0, healCap);
    playerHp = Math.min(session.playerMaxHp, playerHp + playerHeal);
  }
  // ---- 玩家命中：单体目标或群攻 ----
  const enemiesWork = session.enemies.map(e => ({ ...e }));
  const aliveAtStart = enemiesWork.map((e, i) => ({ e, i })).filter(x => x.e.hp > 0).map(x => x.i);
  const playerHitsResult: NonNullable<CombatRound['playerHits']> = [];
  const resolveEnemyIdx = (b: { enemyId?: string; enemyIdx?: number }): number => {
    if (b.enemyId != null) { const j = enemiesWork.findIndex(e => e.id === b.enemyId); if (j >= 0) return j; }
    if (b.enemyIdx != null && b.enemyIdx >= 0 && b.enemyIdx < enemiesWork.length) return b.enemyIdx;
    return -1;
  };
  const aoeHits = Array.isArray(proposal.playerHits) ? proposal.playerHits : [];
  if (aoeHits.length > 0 && (action === 'attack' || action === 'skill')) {
    for (const h of aoeHits) {
      const idx = resolveEnemyIdx(h);
      if (idx < 0 || enemiesWork[idx].hp <= 0) continue;
      const tgt = enemiesWork[idx];
      const cap = maxFactBoundedPlayerDamage(nextState, session, tgt, action, payload, selectedOption).maxDamage;
      const dmg = clampCombatNumber(h.damage, 0, cap);
      tgt.hp = Math.max(0, tgt.hp - dmg);
      playerHitsResult.push({ enemyIdx: idx, name: tgt.name, damage: dmg, hpAfter: tgt.hp, dead: tgt.hp <= 0 });
    }
    audit.push('群攻：玩家本节波及 ' + playerHitsResult.length + ' 名敌人。');
  } else {
    const tIdx = session.currentEnemyIdx;
    const tgt = enemiesWork[tIdx];
    if (tgt && tgt.hp > 0 && playerDamageDealt > 0) {
      tgt.hp = Math.max(0, tgt.hp - playerDamageDealt);
      playerHitsResult.push({ enemyIdx: tIdx, name: tgt.name, damage: playerDamageDealt, hpAfter: tgt.hp, dead: tgt.hp <= 0 });
    }
  }

  // ---- 逃脱判定 ----
  const fleeAllowed = action === 'flee' || selectedOption?.actionType === 'flee';
  const fleeSpeedChance = Math.max(0.08, Math.min(0.92, 0.35 + (session.playerSpeed - (enemy?.speed || 0)) * 0.025));
  const fleeSuccess = fleeAllowed && proposal.fleeOutcome === 'success' && fleeSpeedChance >= 0.18;
  if (proposal.fleeOutcome === 'success' && !fleeAllowed) audit.push('AI提议逃脱，但本动作不是逃跑，已拒绝。');

  // ---- 所有存活敌人各自行动 ----
  const enemyActions: NonNullable<CombatRound['enemyActions']> = [];
  let totalEnemyDamage = 0;
  let endStatus: CombatActionResult['endStatus'] | undefined;
  if (fleeSuccess) {
    endStatus = 'fled';
  } else {
    const beats = Array.isArray(proposal.enemyBeats) ? proposal.enemyBeats : [];
    const beatByIdx = new Map<number, (typeof beats)[number]>();
    for (const b of beats) { const idx = resolveEnemyIdx(b); if (idx >= 0 && !beatByIdx.has(idx)) beatByIdx.set(idx, b); }
    for (const idx of aliveAtStart) {
      const e = enemiesWork[idx];
      if (e.hp <= 0) {
        enemyActions.push({ enemyIdx: idx, name: e.name, action: '力竭倒下', actionType: 'down', damage: 0, hpAfter: 0, dead: true });
        continue;
      }
      const b = beatByIdx.get(idx);
      const stunnedTarget = !!session.enemyStunned && idx === session.currentEnemyIdx;
      let actionLabel = b?.action ? String(b.action).slice(0, 40) : '趁势进攻';
      let actType = b?.actionType ? String(b.actionType).slice(0, 24) : 'attack';
      let dmg = 0;
      if (stunnedTarget) {
        actionLabel = '被符箓震慑，未能发难';
        actType = 'stunned';
        audit.push(e.name + ' 被压制，本节未能发难。');
      } else if (actType !== 'defend' && actType !== 'flee' && actType !== 'stunned' && actType !== 'down') {
        const defenseFactor = action === 'defend' ? 0.55 : action === 'other' ? 0.8 : 1;
        const maxEnemyDamage = Math.max(0, Math.floor((e.attack - session.playerDefense * 0.35) * 1.6 * defenseFactor));
        dmg = clampCombatNumber(b?.damageToPlayer, 0, maxEnemyDamage);
        if (b == null) {
          dmg = Math.min(maxEnemyDamage, Math.max(1, Math.floor(maxEnemyDamage * 0.6)));
          actionLabel = '趁势进攻';
          audit.push(e.name + ' 未获 AI 单独裁定，按趁势进攻兜底。');
        }
      }
      totalEnemyDamage += dmg;
      enemyActions.push({ enemyIdx: idx, name: e.name, action: actionLabel, actionType: actType, damage: dmg, hpAfter: e.hp, dead: false });
    }
    if (session.talismanDefenseActive && session.talismanDefenseActive > 0 && totalEnemyDamage > 0) {
      const blocked = Math.min(totalEnemyDamage, session.talismanDefenseActive);
      totalEnemyDamage -= blocked;
      if (blocked > 0) audit.push('符箓护体抵挡 ' + blocked + ' 点伤势。');
    }
    playerHp = Math.max(0, playerHp - totalEnemyDamage);
    if (playerHp <= 0) endStatus = 'defeat';
    else if (enemiesWork.every(e => e.hp <= 0)) endStatus = 'victory';
  }
  session.talismanDefenseActive = undefined;
  session.enemyStunned = undefined;

  // ---- 目标失效则自动切换到下一个存活敌人 ----
  let currentEnemyIdx = session.currentEnemyIdx;
  if (!enemiesWork[currentEnemyIdx] || enemiesWork[currentEnemyIdx].hp <= 0) {
    const nextIdx = enemiesWork.findIndex(e => e.hp > 0);
    if (nextIdx >= 0) { currentEnemyIdx = nextIdx; audit.push('当前目标倒下，自动转向 ' + enemiesWork[nextIdx].name + '。'); }
  }

  // 兼容旧单敌字段
  const legacyEnemy = enemiesWork[session.currentEnemyIdx] || enemiesWork[currentEnemyIdx];
  const legacyEnemyAction = enemyActions.find(a => a.enemyIdx === session.currentEnemyIdx) || enemyActions[0];

  const dialogue = Array.isArray(proposal.dialogue)
    ? proposal.dialogue.map(d => ({ speaker: String(d.speaker || '').slice(0, 24), text: String(d.text || '').slice(0, 120) })).filter(d => d.text).slice(0, 6)
    : undefined;

  const narrativeBase = String(proposal.narrative || '').trim().slice(0, 360) || (bound.playerActionDesc + '，与众敌斗在一处。');
  const narrative = weaknessNote ? (weaknessNote + narrativeBase).slice(0, 420) : narrativeBase;

  const round: CombatRound = {
    round: session.round,
    playerAction: String(proposal.playerActionLabel || bound.playerActionDesc).slice(0, 40),
    playerActionType,
    playerDamage: playerHitsResult.reduce((s, h) => s + h.damage, 0),
    playerHeal,
    enemyAction: legacyEnemyAction?.action,
    enemyActionType: legacyEnemyAction?.actionType,
    enemyDamage: totalEnemyDamage,
    narrative,
    playerHpAfter: playerHp,
    enemyHpAfter: legacyEnemy?.hp ?? 0,
    playerMpAfter: playerMp,
    aiAudit: audit.length ? audit.slice(0, 10) : ['AI提议已通过引擎事实校验。'],
    enemyActions,
    playerHits: playerHitsResult,
    dialogue,
  };
  const stalemateStreak = !endStatus ? recentCombatLowProgressStreak(session, round, selectedOption) : 0;
  if (stalemateStreak >= 3) audit.push(`连续${stalemateStreak}拍难分胜负，引擎判为僵局并触发破局时停。`);
  const fallbackTacticalSituation = deriveFallbackTacticalSituation(session, round, stalemateStreak);
  const tacticalSituation = sanitizeTacticalSituation(proposal, fallbackTacticalSituation);
  round.tacticalSituation = tacticalSituation;
  const aiActionOptions = !endStatus ? validateAiCombatActions(nextState, session, proposal) : [];
  if (aiActionOptions.length) audit.push('AI临场动作已通过引擎校验并投影到战斗面板。');

  // 角色本能想法/应变关口：AI 提示玩家需决断的处境（仅战斗未结束时）
  let pendingImpulse: CombatSession['pendingImpulse'];
  const imp = proposal.playerImpulse;
  if (!endStatus && imp && imp.prompt) {
    if (imp.kind === 'item') {
      const owned = (session.playerItems || []).find(it => it.itemId === imp.itemId) || (session.playerItems || []).find(it => it.name === imp.itemName);
      pendingImpulse = owned
        ? { kind: 'item', prompt: imp.prompt, itemId: owned.itemId, itemName: owned.name, reason: 'danger' }
        : { kind: 'contingency', prompt: imp.prompt, reason: 'unknown' };
      if (!owned) audit.push('AI建议使用物品但未命中现有背包，已转为应变提示。');
    } else {
      pendingImpulse = { kind: 'contingency', prompt: imp.prompt, reason: 'danger' };
    }
  }
  if (!endStatus && stalemateStreak >= 3 && !pendingImpulse) pendingImpulse = buildStalemateImpulse(session, legacyEnemy, stalemateStreak);
  const newSession: CombatSession = { ...session, enemies: enemiesWork, currentEnemyIdx, round: session.round + 1, log: [...session.log, round], status: endStatus || 'ongoing', playerHp, playerMp, pendingImpulse, stalemateStreak, tacticalSituation, aiActionOptions };
  newSession.actionPalette = buildCombatActionPalette(nextState, newSession);
  if (endStatus === 'defeat') {
    const killer = enemyActions.filter(a => (a.damage || 0) > 0).sort((a, b) => (b.damage || 0) - (a.damage || 0))[0];
    return { state: { ...nextState, combatSession: newSession, hp: 0, mp: playerMp, alive: false, causeOfDeath: '战死于' + (killer?.name || legacyEnemy?.name || '敌手') + '之手' }, round, ended: true, endStatus };
  }
  return { state: { ...nextState, combatSession: newSession, hp: playerHp, mp: playerMp }, round, ended: !!endStatus, endStatus, victoryDrops: endStatus === 'victory' ? session.victoryDrops : undefined };
}

export function endCombat(state: CharacterState, applyDrops: boolean = true, aiLoot?: CombatLootAIOutcome | null): { state: CharacterState; drops: ItemEntry[]; result: 'victory' | 'defeat' | 'fled' | 'ongoing' | null; spiritStones?: number } {
  if (!state.combatSession) return { state, drops: [], result: null, spiritStones: 0 };
  const session = state.combatSession;
  let next: CharacterState = { ...state, combatSession: null };
  let drops: ItemEntry[] = [];
  let spiritStones = 0;
  if (applyDrops && session.status === 'victory') {
    const spoils = buildCombatVictorySpoils(state, session, aiLoot);
    drops = spoils.items;
    spiritStones = spoils.spiritStones;
    if (drops.length) next = addItems(next, drops);
    if (spiritStones > 0) next = { ...next, spiritStones: next.spiritStones + spiritStones };
    next = normalizeCultivationState(next);
  }
  return { state: next, drops, result: session.status, spiritStones };
}

// ==================== 引擎执行 AI 输出（统一入口） ====================

export interface EngineExecutionResult {
  state: CharacterState;
  appliedChanges: AttributeChange[];
  rejectedChanges: AttributeChange[];
  contentRegistryTrace: ValidationTrace[];
  contentRegistryWarnings: string[];
  effectResolveTrace: EffectResolveTrace[];
  effectResolveWarnings: string[];
  aiBoundaryTrace: BoundaryValidationTrace[];
  aiBoundaryWarnings: string[];
  stateChangeLog: StateChangeLogEntry[];
  breakthroughHappened: boolean;
  newRealm?: Realm;
  breakthroughMajor?: boolean;
  breakthroughSteps?: number;
  breakthroughReasonAccepted?: boolean;
  died: boolean;
  deathReason?: string;
}

export function executeAIEvent(state: CharacterState, aiOutput: AIEventOutput): EngineExecutionResult {
  let next = { ...state };
  const rejected: AttributeChange[] = [];
  const contentRegistryTrace: ValidationTrace[] = [];
  // P1-8 幼龄硬拦截：age<6 禁止 triggerCombat / 禁止独立赶路 / 禁止独立赴约
  // prompt 已要求 AI 写幼龄口吻（见 llm.ts 572/990/1066），但 prompt 软约束可能被忽略；
  // 引擎兜底：直接剥离 triggerCombat，并把 age<6 时的 hasChoice 改为 false。
  if (next.age < 6) {
    if (aiOutput.triggerCombat) {
      contentRegistryTrace.push({
        severity: 'warning',
        code: 'infant_blocked_combat',
        attribute: '*',
        message: `age<6 (${next.age}) 幼龄引擎拦截 triggerCombat：幼龄不宜动武`,
        source: aiOutput.title || 'executeAIEvent',
      });
      contentRegistryWarnings.push('幼龄角色不可触发战斗，已剥离 triggerCombat');
      aiOutput.triggerCombat = undefined;
    }
    if (aiOutput.hasChoice) {
      contentRegistryTrace.push({
        severity: 'warning',
        code: 'infant_blocked_choice',
        attribute: '*',
        message: `age<6 (${next.age}) 幼龄引擎拦截 hasChoice：幼龄不可独立抉择`,
        source: aiOutput.title || 'executeAIEvent',
      });
      contentRegistryWarnings.push('幼龄角色不可独立抉择，已剥离 hasChoice/choice');
      aiOutput.hasChoice = false;
      aiOutput.choice = undefined;
    }
    // 幼龄叙事关键词重写：把"独自/前往/追查/赶路/独行/寻访"等成人化动词改写为看护下的口吻
    if (typeof aiOutput.narrative === 'string' && aiOutput.narrative) {
      aiOutput.narrative = rewriteInfantNarrative(aiOutput.narrative);
    }
  }
  const contentRegistryWarnings: string[] = [];
  const effectResolveTrace: EffectResolveTrace[] = [];
  const effectResolveWarnings: string[] = [];
  const appliedChanges: AttributeChange[] = [];
  const boundaryValidation = validateAIBoundary(state, aiOutput);
  const preExistingItemNames = knownItemNameSet(state);
  const duplicateNarrativeItems = [...(aiOutput.newItems || []), ...(aiOutput.newEquippedItems || [])]
    .map(item => item?.name)
    .filter((name): name is string => !!name && preExistingItemNames.has(factNameKey(name)));
  if (duplicateNarrativeItems.length) {
    aiOutput.narrative = sanitizeNarrativeKnownFactRepetition(aiOutput.narrative, state, duplicateNarrativeItems);
  }
  const collectItemResolve = (resolved: ItemEffectResolveResult) => {
    appliedChanges.push(...resolved.appliedChanges);
    rejected.push(...resolved.rejectedChanges);
    effectResolveTrace.push(...resolved.effectResolveTrace);
    effectResolveWarnings.push(...resolved.effectResolveWarnings);
  };

  // 0. 年龄驱动的身体成长 + 叙事修正：凡人/低境界角色 attack/defense/speed/maxHp 随年龄自然增长
  // 但 narrative 里"久病/缠绵病榻"等关键词会压低 baseline（修真者属性保留）
  const bodyGrowth = applyAgeBasedBodyGrowth(next, next.age, aiOutput.narrative);
  if (bodyGrowth.growth.attack || bodyGrowth.growth.defense || bodyGrowth.growth.speed || bodyGrowth.growth.maxHp) {
    next = bodyGrowth.state;
    effectResolveTrace.push({
      severity: 'info',
      code: 'age_body_growth',
      attribute: '*',
      message: `Age ${next.age} body growth: factor=${bodyGrowth.factor.toFixed(2)}, realmMult=${bodyGrowth.realmMultiplier.toFixed(2)}, bodyMod=${bodyGrowth.bodyModifier.mode}(${bodyGrowth.bodyModifier.multiplier}x, ${bodyGrowth.bodyModifier.reason}), deltas=atk:${bodyGrowth.growth.attack} def:${bodyGrowth.growth.defense} spd:${bodyGrowth.growth.speed} hp:${bodyGrowth.growth.maxHp}`,
      source: aiOutput.title || 'age-body-growth',
    });
  }

  // 1. Apply attribute changes through EffectResolver / ERPE Lite.
  let inputChanges = aiOutput.changes || [];
  // 引擎兜底：AI 常把 narrative 写得生动但忘记给 changes
  // 当 changes 几乎为空时，根据 narrative 关键词 + 当前境界自动补一组合理 delta
  if (inputChanges.length === 0 && aiOutput.narrative) {
    const fallback = inferAttributeChangesFromNarrative(aiOutput.narrative, next, aiOutput.title || 'ai-event');
    if (fallback.length > 0) {
      inputChanges = fallback;
      effectResolveTrace.push({
        severity: 'info',
        code: 'engine_inferred_changes',
        attribute: '*',
        message: `Engine inferred ${fallback.length} attribute change(s) from narrative (AI output empty changes)`,
        source: aiOutput.title || 'ai-event',
      });
    }
  }
  const resolvedChanges = resolveAttributeChanges(next, inputChanges, {
    bounds: ATTRIBUTE_BOUNDS,
    source: aiOutput.title || 'ai-event',
  });
  next = resolvedChanges.state;
  appliedChanges.push(...resolvedChanges.appliedChanges);
  rejected.push(...resolvedChanges.rejectedChanges);
  effectResolveTrace.push(...resolvedChanges.trace);
  effectResolveWarnings.push(...resolvedChanges.trace.filter(t => t.severity !== 'info').map(t => t.message));

  // 2. 新状态先经过 ContentRegistry Lite 统一校验/补全，再进入状态系统
  {
    const registered = registerMany(aiOutput.newStatuses || [], registerStatus, {
      source: aiOutput.title,
      age: next.age,
      existingIds: next.activeStatuses.map(s => s.id),
    });
    contentRegistryTrace.push(...registered.trace);
    contentRegistryWarnings.push(...registered.warnings);
    next = addStatuses(next, registered.accepted);
    const explicitAttributes = (aiOutput.cultivationAttributes || [])
      .filter(attr => attr && attr.name && attr.visible !== false)
      .map(attr => ({ ...attr, id: attr.id || attr.name }));
    next.cultivationAttributes = [
      ...deriveCultivationAttributes(next),
      ...explicitAttributes,
    ].slice(0, 24);
  }

  // 3.5 AI 联动：移除/破坏物品（如战斗中武器被毁、丹药被消耗）
  if (aiOutput.removedItemIds && aiOutput.removedItemIds.length) {
    const rem = removeItemsByIds(next, aiOutput.removedItemIds);
    next = rem.state;
    collectItemResolve(rem);
  }

  // 3. 新物品先经过 ContentRegistry Lite 统一校验/补全，再进入背包系统
  {
    const rawNew = aiOutput.newItems || [];
    if (rawNew.length) {
      const registered = registerMany(rawNew, registerItem, {
        source: aiOutput.title,
        age: next.age,
        existingIds: [...next.inventory, ...(next.equipped || [])].map(it => it.id),
      });
      contentRegistryTrace.push(...registered.trace);
      contentRegistryWarnings.push(...registered.warnings);
      const deduped = filterAlreadyKnownItems(next, registered.accepted);
      if (deduped.rejectedNames.length) {
        contentRegistryWarnings.push(`\u5df2\u62e5\u6709\u7269\u54c1\u4e0d\u91cd\u590d\u53d1\u653e\uff1a${deduped.rejectedNames.join('\u3001')}`);
        aiOutput.narrative = sanitizeNarrativeKnownFactRepetition(aiOutput.narrative, next, deduped.rejectedNames);
      }
      next = addItems(next, deduped.accepted);
      for (const memo of itemAcquisitionMemories(next.age, deduped.accepted)) next = addMemory(next, memo);
    }
  }

  // 3.6 AI 联动：直接放入已装备的物品（AI 创造性装备：项链·储物戒指串等）
  if (aiOutput.newEquippedItems && aiOutput.newEquippedItems.length) {
    const registered = registerMany(aiOutput.newEquippedItems, registerItem, {
      source: aiOutput.title,
      age: next.age,
      existingIds: [...next.inventory, ...(next.equipped || [])].map(it => it.id),
    });
    contentRegistryTrace.push(...registered.trace);
    contentRegistryWarnings.push(...registered.warnings);
    const deduped = filterAlreadyKnownItems(next, registered.accepted);
    if (deduped.rejectedNames.length) {
      contentRegistryWarnings.push(`\u5df2\u62e5\u6709\u7269\u54c1\u4e0d\u91cd\u590d\u88c5\u5907\uff1a${deduped.rejectedNames.join('\u3001')}`);
      aiOutput.narrative = sanitizeNarrativeKnownFactRepetition(aiOutput.narrative, next, deduped.rejectedNames);
    }
    const newEqItems = deduped.accepted;
    next = {
      ...next,
      equipped: [...(next.equipped || []), ...newEqItems],
    };
    for (const memo of itemAcquisitionMemories(next.age, newEqItems)) next = addMemory(next, memo);
    for (const it of newEqItems) {
      const resolved = resolveItemEffects(next, it, 1, `生成并装备 ${it.name}`);
      next = resolved.state;
      collectItemResolve(resolved);
    }
    next = recalcCultivationMultiplier(next);
  }

  // 3.7 AI 联动：把背包里的物品装备上去（AI 在 advance/interfere 中指定 id）
  if (aiOutput.equipItemIds && aiOutput.equipItemIds.length) {
    const r = equipItemsByIds(next, aiOutput.equipItemIds);
    next = r.state;
    collectItemResolve(r);
  }

  // 3.8 AI 联动：把已装备的物品卸下来（AI 在 advance/interfere 中指定 id）
  if (aiOutput.unequipItemIds && aiOutput.unequipItemIds.length) {
    const r = unequipItemsByIds(next, aiOutput.unequipItemIds);
    next = r.state;
    collectItemResolve(r);
  }

  // 4. 添加长期记忆
  if (aiOutput.memory) next = addMemory(next, aiOutput.memory);

  // 4.2 灵根蜕变：只有结构化 spiritualRootChange 会改变角色灵根，避免从叙事文本误判。
  {
    const rootChange = applySpiritualRootChange(next, aiOutput.spiritualRootChange);
    next = rootChange.state;
    if (rootChange.applied) appliedChanges.push(rootChange.applied);
    if (rootChange.trace) {
      effectResolveTrace.push(rootChange.trace);
      if (rootChange.trace.severity !== 'info') effectResolveWarnings.push(rootChange.trace.message);
    }
  }

  // 4.5 更新修炼心得文本 + 结构化来源条目
  // 只在 AI 输出了非空文本时才覆盖，避免被空值误清
  if (aiOutput.cultivationInsight && aiOutput.cultivationInsight.trim()) {
    next.cultivationInsight = aiOutput.cultivationInsight.trim();
  }
  // 引擎权威：cultivationFactors 完全由引擎从 state 计算（灵根 + 已装备功法 + 状态词条）
  // 不再合并 AI 输出的额外因素——AI 输出不稳定会导致条目忽隐忽现，且 AI 编造的数字
  // 与 cultivationMultiplier 脱节会让"顶部倍率"与"来源条目数字之积"不一致。
  // AI 若想体现环境/心境等动态因素，可在 cultivationInsight 文本中描述，但不得影响数值。
  next = normalizeCultivationState(next);

  // 5. 处理突破
  let breakthroughHappened = false;
  let newRealm: Realm | undefined;
  let breakthroughMajor = false;
  let breakthroughSteps = 0;
  let breakthroughReasonAccepted = false;
  if (aiOutput.triggeredBreakthrough) {
    const br = tryBreakthrough(next, {
      reason: aiOutput.breakthroughReason,
      targetRealm: aiOutput.breakthroughTargetRealm,
      targetLevel: aiOutput.breakthroughTargetLevel,
    });
    if (br.success) {
      next = br.state;
      breakthroughHappened = true;
      newRealm = br.newRealm;
      breakthroughMajor = Boolean(br.major);
      breakthroughSteps = br.steps || 1;
      breakthroughReasonAccepted = Boolean(br.reasonAccepted);
      if (br.reasonAccepted && aiOutput.realmProfilePatch) {
        next = applyRealmProfilePatch(next, aiOutput.realmProfilePatch);
      }
    }
  }

  // 6. 处理死亡
  let died = false;
  let deathReason: string | undefined;
  if (aiOutput.causedDeath) {
    next.alive = false;
    next.causeOfDeath = aiOutput.deathReason || '陨落于劫难';
    died = true;
    deathReason = next.causeOfDeath;
  }

  // 7. 处理飞升
  if (aiOutput.causedAscension) {
    next.ascended = true;
    next.alive = true; // 飞升不算死亡
    next.realm = 'ascension';
  }

  // ===== Task 20: 应用未决线索 / 战斗触发 =====
  // 7.1 添加新线索
  if (aiOutput.newThreads && aiOutput.newThreads.length) {
    const registered = registerMany(aiOutput.newThreads, registerThread, {
      source: aiOutput.title,
      age: next.age,
      existingIds: (next.pendingThreads || []).map(t => t.id),
    });
    contentRegistryTrace.push(...registered.trace);
    contentRegistryWarnings.push(...registered.warnings);
    next = addThreads(next, registered.accepted);
  }

  // 7.1.5 NPC Persistence Lite: register explicit AI NPCs and combat opponents.
  {
    const rawNpcs = [
      ...(aiOutput.newNpcs || []),
      ...combatEnemiesToNpcs(aiOutput.triggerCombat?.enemies, aiOutput, next),
    ];
    if (rawNpcs.length) {
      const registered = registerMany(rawNpcs, registerNpc, {
        source: aiOutput.title,
        age: next.age,
        existingIds: (next.npcs || []).map(n => n.id),
      });
      contentRegistryTrace.push(...registered.trace);
      contentRegistryWarnings.push(...registered.warnings);
      next = upsertNpcs(next, registered.accepted);
    }
  }
  // 7.2 推进现有线索进度
  if (aiOutput.advanceThreads && aiOutput.advanceThreads.length) {
    for (const adv of aiOutput.advanceThreads) {
      if (adv.id && typeof adv.progressDelta === 'number') {
        next = advanceThread(next, adv.id, adv.progressDelta, adv.note);
      }
    }
  }
  // 7.3 标记完成的线索
  if (aiOutput.completeThreadIds && aiOutput.completeThreadIds.length) {
    for (const id of aiOutput.completeThreadIds) {
      next = completeThread(next, id);
    }
  }
  // 7.4 标记失败的线索
  if (aiOutput.failThreadIds && aiOutput.failThreadIds.length) {
    for (const id of aiOutput.failThreadIds) {
      next = failThread(next, id);
    }
  }
  // 7.4.5 叙事契约 outcome 保守同步到已引用的未决线索
  next = syncThreadsFromNarrativeOutcome(next, aiOutput);

  // 7.5 检查线索 deadline —— 过期未完成的标记为 failed
  const threadCheck = checkThreadDeadlines(next);
  next = threadCheck.state;

  // 7.6 触发战斗（若 AI 给出 triggerCombat）
  // Task 22 修复：若同时有 hasChoice，延迟战斗——选择通常决定战斗策略（奋力搏杀/灵活周旋/抛物安抚）
  // 选项后才进入战斗，避免 ChoiceModal 与 CombatModal 同时弹出
  if (aiOutput.triggerCombat && aiOutput.triggerCombat.enemies?.length) {
    const combatTrigger = {
      ...aiOutput.triggerCombat,
      // 战斗弹窗承接刚才的事件：标题和缘由必须与事件描述一致，避免玩家跳戏
      contextTitle: aiOutput.title || aiOutput.triggerCombat.contextTitle,
      contextNarrative: aiOutput.narrative || aiOutput.triggerCombat.contextNarrative,
    };
    if (aiOutput.hasChoice) {
      (next as any)._deferredCombat = combatTrigger;
    } else {
      next = startCombat(next, combatTrigger);
    }
  }

  // ===== Task 23: 应用 AI 授予的灵宠 =====
  if (aiOutput.newPets && aiOutput.newPets.length) {
    for (const pet of aiOutput.newPets) {
      next = addPet(next, pet);
    }
  }

  // 8. 角色主动意图重新生成（每岁重算）
  next.pendingThreads = normalizeThreadsCompletion(next.pendingThreads || []);
  next.questEntries = buildQuestEntriesFromThreads(next.pendingThreads, next.age);
  next.characterIntents = generateCharacterIntents(next, next.pendingThreads);
  next = refreshWorldFacts(next, aiOutput.title || 'ai-event');

  next = recordEventCausality(next, aiOutput);

  const stateChangeLog = buildStateChangeLog({
    before: state,
    after: next,
    appliedChanges,
    rejectedChanges: rejected,
    contentRegistryTrace,
    effectResolveTrace,
    aiBoundaryTrace: boundaryValidation.trace,
  });

  return {
    state: next,
    appliedChanges,
    rejectedChanges: rejected,
    contentRegistryTrace,
    contentRegistryWarnings,
    effectResolveTrace,
    effectResolveWarnings,
    aiBoundaryTrace: boundaryValidation.trace,
    aiBoundaryWarnings: boundaryValidation.warnings,
    stateChangeLog,
    breakthroughHappened,
    newRealm,
    breakthroughMajor,
    breakthroughSteps,
    breakthroughReasonAccepted,
    died,
    deathReason,
  };
}

// ==================== 状态 → API 响应（含展示字段） ====================

// 将引擎状态转为前端可直接使用的响应对象
// 关键：包含 realmName / realmColor / realmMaxLevel / rootMultiplier 等展示字段
// 这样前端 setCharacter({...character, ...data.state}) 时这些字段会被正确更新
export function stateToResponse(s: CharacterState) {
  const realmInfo = getRealmInfo(s.realm);
  const realmProfile = getRealmProfile(s);
  const rootInfo = SPIRITUAL_ROOTS[s.spiritualRoot];
  const rate = computeEffectiveCultivationRate(s);
  const realmPower = realmPowerMultiplier(s);
  const coreAttrs = deriveCoreCultivationAttributes(s);
  const soulRealm = deriveSoulRealm({ ...s, ...coreAttrs });
  const realmTraits = deriveRealmTraits(s);
  const combatProjection = deriveCombatProjection({ ...s, ...coreAttrs });
  return {
    age: s.age,
    lifespan: s.lifespan,
    realm: s.realm,
    realmName: realmProfile?.name || realmInfo.name,
    realmColor: realmProfile?.color || realmInfo.color,
    realmLevel: s.realmLevel,
    realmMaxLevel: realmProfile?.maxLevel ?? realmInfo.levels,
    realmProfile,
    realmTraits,
    spiritualSense: coreAttrs.spiritualSense,
    soulStrength: coreAttrs.soulStrength,
    physicalFoundation: coreAttrs.physicalFoundation,
    combatProjection,
    soulRealmName: soulRealm.name,
    soulRealmRank: soulRealm.rank,
    soulRealmGap: soulRealm.gap,
    realmPowerMultiplier: realmPower,
    cultivationExp: s.cultivationExp,
    expToBreak: s.expToBreak,
    hp: scaleByRealmPower(s.hp, realmPower), maxHp: scaleByRealmPower(s.maxHp, realmPower),
    mp: scaleByRealmPower(s.mp, realmPower), maxMp: scaleByRealmPower(s.maxMp, realmPower),
    attack: scaleByRealmPower(s.attack, realmPower), defense: scaleByRealmPower(s.defense, realmPower), speed: scaleByRealmPower(s.speed, Math.sqrt(realmPower)),
    luck: s.luck, comprehension: s.comprehension,
    spiritStones: s.spiritStones, reputation: s.reputation,
    alive: s.alive, ascended: s.ascended,
    causeOfDeath: s.causeOfDeath,
    faction: s.faction, master: s.master, location: s.location,
    elements: s.elements,
    fateNodes: s.fateNodes,
    isAtChoice: s.isAtChoice,
    spiritualRoot: s.spiritualRoot,
    rootDetail: s.rootDetail,
    rootMultiplier: rootInfo?.multiplier ?? 0,
    cultivationMultiplier: rate.multiplier,
    cultivationFlatBonus: rate.flatBonus,
    cultivationInsight: s.cultivationInsight,
    cultivationFactors: computeCultivationFactors(s),
    cultivationAttributes: deriveCultivationAttributes(s),
    storageCapacity: s.storageCapacity,
    activeStatuses: s.activeStatuses,
    inventory: s.inventory,
    equipped: s.equipped,
    // Task 20 新字段
    pendingThreads: s.pendingThreads || [],
    questEntries: buildQuestEntriesFromThreads(s.pendingThreads || [], s.age),
    characterIntents: s.characterIntents || [],
    combatSession: s.combatSession || null,
    npcs: s.npcs || [],
    causalGraph: s.causalGraph || { nodes: [], edges: [] },
    worldFacts: s.worldFacts || [],
    // Task 22 新字段
    heartDemon: s.heartDemon ?? 0,
    // Task 23 新字段
    pets: s.pets || [],
    // Task 24 新字段
    exploredRealms: s.exploredRealms || [],
    discoveredRealms: getDiscoveredStoryRealms(s),
  };
}

// ==================== 验证：状态名唯一性 ====================

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
export function adjustHeartDemon(state: CharacterState, delta: number, reason?: string): CharacterState {
  const next = Math.max(0, Math.min(100, (state.heartDemon ?? 0) + delta));
  if (reason) {
    // 心魔变化仅写日志，不污染长期记忆
    }
  return { ...state, heartDemon: next };
}

// 每岁心魔值自然变化：
// - 修仙者静修可净化心魔：境界越高，净化越快（mortal 不净化）
// - 但若有未解 urgent 线索，每条 +2（执念缠心）
// - 若心魔已 >= 60，每岁额外 +3（心魔反噬，自循环恶化）
export function tickHeartDemon(state: CharacterState): CharacterState {
  if (!state.alive || state.ascended) return state;
  const realmIdx = REALMS.findIndex(r => r.id === state.realm);
  const qiRefiningIdx = REALMS.findIndex(r => r.id === 'qi_refining');
  let delta = 0;
  // 静修净化（境界 >= 炼气期才开始）
  if (realmIdx >= qiRefiningIdx) {
    delta -= 1; // 每岁 -1
    // 境界越高，净化越快（筑基 -2，金丹 -3，元婴 -4 ...）
    const extraPurify = Math.max(0, realmIdx - qiRefiningIdx);
    delta -= extraPurify;
  }
  // 未解 urgent 线索：每条 +2
  const urgentCount = (state.pendingThreads || []).filter(t => t.status === 'urgent' || (t.status === 'pending' && t.deadlineAge - state.age <= 3)).length;
  if (urgentCount > 0) delta += urgentCount * 2;
  // 高心魔自循环恶化
  if ((state.heartDemon ?? 0) >= 60) delta += 3;
  // 净化优先：若 delta < 0 但心魔已为 0，不再下降
  if (delta === 0) return state;
  return adjustHeartDemon(state, delta, `tickHeartDemon@${state.age}岁`);
}

// 心魔试炼触发判定：心魔值 >= 60 时，每岁有概率触发心魔试炼战斗
// 心魔越高，概率越大（60→10%，70→20%，80→30%，90→40%）
// 心魔试炼敌人 = 玩家自身心魔投影（属性随境界缩放）
export function tryHeartDemonTrial(state: CharacterState): { triggered: boolean; trigger?: NonNullable<AIEventOutput['triggerCombat']> } {
  const hd = state.heartDemon ?? 0;
  if (hd < 60) return { triggered: false };
  if (!state.alive || state.ascended) return { triggered: false };
  if (state.combatSession) return { triggered: false }; // 已在战斗中
  if (state.isAtChoice) return { triggered: false }; // 选择节点不叠加
  const chance = Math.min(0.4, (hd - 50) / 100);
  if (Math.random() > chance) return { triggered: false };
  // 生成心魔投影敌人（属性随境界 + 心魔值缩放）
  const realmIdx = REALMS.findIndex(r => r.id === state.realm);
  const scale = 1 + realmIdx * 0.5 + (hd - 60) / 30; // 60→1, 90→2
  const enemy = {
    id: generateEntityId('enemy_heartdemon'),
    name: hd >= 90 ? '心魔真身' : hd >= 75 ? '执念魔影' : '心魔幻影',
    description: `你内心深处的执念化作实体（心魔值 ${hd}/100），似我非我，反噬而来`,
    hp: Math.round(state.maxHp * 0.8 * scale),
    maxHp: Math.round(state.maxHp * 0.8 * scale),
    attack: Math.round(state.attack * 0.9 * scale),
    defense: Math.round(state.defense * 0.7 * scale),
    speed: state.speed,
    realm: REALMS[realmIdx]?.name || '炼气期',
    currentCooldown: 0,
  };
  return {
    triggered: true,
    trigger: {
      contextTitle: hd >= 90 ? '心魔真身现·走火入魔' : hd >= 75 ? '执念魔影·心魔试炼' : '心魔幻影·道心磨砺',
      contextNarrative: `${state.age}岁，${state.name}于静坐中忽觉心神不宁，眼前幻象丛生。心魔值已至 ${hd}/100，执念化作实体，向其扑来。此战关乎道心，胜则心魔稍减，败则恐走火入魔。`,
      enemies: [enemy],
      victoryDrops: [], // 心魔战无物质掉落
      victoryHeartDemonDelta: -25, // 胜则心魔大减
      defeatHeartDemonDelta: +15,  // 败则心魔加重
      isHeartDemonTrial: true, // Task 22: 标记为心魔试炼
    },
  };
}

// 心魔试炼战斗后结算：根据胜负调整心魔值
export function resolveHeartDemonTrial(state: CharacterState, victory: boolean): CharacterState {
  if (victory) {
    return adjustHeartDemon(state, -25, '心魔试炼·胜·道心坚定');
  } else {
    // 败则心魔加重，并扣血（走火入魔征兆）
    const next = adjustHeartDemon(state, +15, '心魔试炼·败·走火入魔');
    const dmg = Math.round(state.maxHp * 0.2);
    return { ...next, hp: Math.max(1, next.hp - dmg) }; // 不直接致死，留 1 血
  }
}

// ==================== Task 23: 灵宠系统 ====================

// 灵宠稀有度 → 等级倍率
const PET_RARITY_MULTIPLIER: Record<string, number> = {
  common: 1.0, uncommon: 1.2, rare: 1.5, epic: 1.8, legendary: 2.2, mythic: 2.8,
};

// 根据物种 + 稀有度 + 境界生成完整灵宠属性
export function createPet(
  species: PetSpecies,
  rarity: Pet['rarity'],
  realm: Realm,
  name: string,
  description: string,
  sourceAcquired: string,
  acquiredAge: number,
  customSkill?: Partial<Pet['skill']>,
  aiBond?: PetBondAIOutcome | null,
): Pet {
  if (aiBond) {
    const clamp = (v: number, min: number, max: number, fallback: number) => Math.max(min, Math.min(max, Math.round(Number(v) || fallback)));
    return {
      id: `pet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: aiBond.name || name || '灵兽',
      species: aiBond.species || species,
      description: aiBond.description || description || '循缘而来的灵宠。',
      rarity: aiBond.rarity || rarity,
      realm,
      hp: clamp(aiBond.hp, 20, 1200, 60), maxHp: clamp(aiBond.hp, 20, 1200, 60),
      attack: clamp(aiBond.attack, 1, 500, 10), defense: clamp(aiBond.defense, 0, 500, 6), speed: clamp(aiBond.speed, 1, 500, 10),
      element: aiBond.element || 'wood',
      loyalty: clamp(aiBond.loyalty, 0, 100, 70), satiety: clamp(aiBond.satiety, 0, 100, 80),
      level: 1, exp: 0, expToLevel: 100,
      sourceAcquired: aiBond.sourceAcquired || sourceAcquired,
      acquiredAge,
      traits: aiBond.traits || [],
      passiveHint: aiBond.passiveHint,
      skill: { name: aiBond.skill?.name || '灵息护主', description: aiBond.skill?.description || '以灵息护持主人。', power: Math.max(0.5, Math.min(5, Number(aiBond.skill?.power) || 1.2)), cooldown: Math.max(1, Math.min(8, Math.round(Number(aiBond.skill?.cooldown) || 3))) },
    };
  }
  const template = PET_SPECIES_TEMPLATES[species];
  const rarityMul = PET_RARITY_MULTIPLIER[rarity] || 1.0;
  // 境界加成：每境界 +20% 基础属性
  const realmIdx = REALMS.findIndex(r => r.id === realm);
  const realmMul = 1 + Math.max(0, realmIdx) * 0.2;
  const baseHp = Math.round(template.baseHp * rarityMul * realmMul);
  const baseAttack = Math.round(template.baseAttack * rarityMul * realmMul);
  const baseDefense = Math.round(template.baseDefense * rarityMul * realmMul);
  const baseSpeed = Math.round(template.baseSpeed * rarityMul * realmMul);
  return {
    id: `pet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name || template.name,
    species,
    description: description || `${template.name}，${rarity}品质`,
    rarity,
    realm,
    hp: baseHp,
    maxHp: baseHp,
    attack: baseAttack,
    defense: baseDefense,
    speed: baseSpeed,
    element: template.defaultElement,
    loyalty: 70,         // 初始忠诚度 70（较高，但会随时间下降）
    satiety: 80,         // 初始饱食度 80
    level: 1,
    exp: 0,
    expToLevel: 100,
    sourceAcquired,
    acquiredAge,
    skill: {
      name: customSkill?.name || template.skillName,
      description: customSkill?.description || template.skillDesc,
      power: customSkill?.power || template.skillPower,
      cooldown: customSkill?.cooldown || template.skillCooldown,
    },
  };
}

// 添加灵宠到角色
export function addPet(state: CharacterState, pet: Pet): CharacterState {
  // 上限 5 只（避免灵宠过多复杂化游戏）
  const existing = state.pets || [];
  if (existing.length >= 5) {
    // 已满，不加（AI 应避免过度授予；可考虑替换最弱的一只）
    return state;
  }
  // ID 去重
  const usedIds = new Set(existing.map(p => p.id));
  let id = pet.id;
  while (usedIds.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 6)}`;
  return { ...state, pets: [...existing, { ...pet, id }] };
}

// 解雇/放生灵宠
export function dismissPet(state: CharacterState, petId: string): CharacterState {
  return { ...state, pets: (state.pets || []).filter(p => p.id !== petId) };
}

// 喂养灵宠：消耗一个材料类物品，回复饱食度 + 提升忠诚度 + 增加经验
export function feedPet(
  state: CharacterState,
  petId: string,
  itemId: string,
  aiCare?: PetCareAIOutcome | null,
): { state: CharacterState; ok: boolean; error?: string; pet?: Pet } {
  const pet = (state.pets || []).find(p => p.id === petId);
  if (!pet) return { state, ok: false, error: '灵宠不存在' };
  const item = state.inventory.find(it => it.id === itemId);
  if (!item) return { state, ok: false, error: '物品不在储物袋中' };
  // 仅允许材料类、丹药类、食物类（tool）物品喂养
  if (item.item_type !== 'material' && item.item_type !== 'consumable' && item.item_type !== 'tool') {
    return { state, ok: false, error: '该物品不适合喂养灵宠' };
  }
  if (aiCare) {
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
    const levelDelta = clamp(aiCare.levelDelta || 0, 0, 3);
    const maxHpDelta = clamp(aiCare.maxHpDelta || 0, -20, 120) + levelDelta * 8;
    const updatedPet: Pet = {
      ...pet,
      satiety: Math.max(0, Math.min(100, pet.satiety + clamp(aiCare.satietyDelta, -20, 80))),
      loyalty: Math.max(0, Math.min(100, pet.loyalty + clamp(aiCare.loyaltyDelta, -30, 60))),
      level: Math.max(1, pet.level + levelDelta),
      exp: Math.max(0, pet.exp + clamp(aiCare.expDelta, 0, 300)),
      attack: Math.max(0, pet.attack + clamp(aiCare.attackDelta || 0, -10, 80) + levelDelta * 2),
      defense: Math.max(0, pet.defense + clamp(aiCare.defenseDelta || 0, -10, 80) + levelDelta),
      maxHp: Math.max(1, pet.maxHp + maxHpDelta),
      hp: Math.min(Math.max(1, pet.maxHp + maxHpDelta), Math.max(0, pet.hp + maxHpDelta)),
    };
    const newInventory = state.inventory.filter(it => it.id !== itemId);
    const newPets = state.pets.map(p => p.id === petId ? updatedPet : p);
    return { state: { ...state, pets: newPets, inventory: newInventory }, ok: true, pet: updatedPet };
  }
  // AI 失败时按稀有度公式兜底计算喂养价值
  const rarityValue: Record<string, number> = { common: 15, uncommon: 25, rare: 40, epic: 60, legendary: 80, mythic: 100 };
  const feedValue = rarityValue[item.rarity] || 15;
  // 更新灵宠
  const newSatiety = Math.min(100, pet.satiety + feedValue);
  const newLoyalty = Math.min(100, pet.loyalty + Math.floor(feedValue / 4));
  let newExp = pet.exp + Math.floor(feedValue / 2);
  let newLevel = pet.level;
  let newExpToLevel = pet.expToLevel;
  let levelUpBonus = 0;
  while (newExp >= newExpToLevel) {
    newExp -= newExpToLevel;
    newLevel += 1;
    newExpToLevel = Math.round(newExpToLevel * 1.4);
    levelUpBonus += 1;
  }
  // 升级提升属性
  const updatedPet: Pet = {
    ...pet,
    satiety: newSatiety,
    loyalty: newLoyalty,
    level: newLevel,
    exp: newExp,
    expToLevel: newExpToLevel,
    attack: pet.attack + levelUpBonus * 2,
    defense: pet.defense + levelUpBonus * 1,
    maxHp: pet.maxHp + levelUpBonus * 8,
    hp: Math.min(pet.maxHp + levelUpBonus * 8, pet.hp + levelUpBonus * 8),
  };
  // 移除消耗品
  const newInventory = state.inventory.filter(it => it.id !== itemId);
  const newPets = state.pets.map(p => p.id === petId ? updatedPet : p);
  return {
    state: { ...state, pets: newPets, inventory: newInventory },
    ok: true,
    pet: updatedPet,
  };
}

// 每岁灵宠状态变化：
// - 饱食度 -10
// - 忠诚度 -2（饥饿时 -5）
// - HP 自然回复（满饱食度 +10% maxHp，半饱 +5%，饥饿不回复）
// - 忠诚度 < 30 的灵宠有概率逃离（每岁 5%）
export function tickPets(state: CharacterState): CharacterState {
  if (!state.pets || state.pets.length === 0) return state;
  const survivedPets: Pet[] = [];
  for (const pet of state.pets) {
    let newSatiety = Math.max(0, pet.satiety - 10);
    let newLoyalty = pet.loyalty - (newSatiety < 30 ? 5 : 2);
    newLoyalty = Math.max(0, newLoyalty);
    // HP 自然回复
    const hpRegen = newSatiety >= 70 ? Math.round(pet.maxHp * 0.1) : newSatiety >= 30 ? Math.round(pet.maxHp * 0.05) : 0;
    const newHp = Math.min(pet.maxHp, pet.hp + hpRegen);
    // 忠诚度 < 30 时 5% 概率逃离
    if (newLoyalty < 30 && Math.random() < 0.05) {
        continue; // 灵宠逃离
    }
    survivedPets.push({ ...pet, satiety: newSatiety, loyalty: newLoyalty, hp: newHp });
  }
  return { ...state, pets: survivedPets };
}

// 灵宠战斗贡献计算：返回灵宠对玩家属性的额外加成（被动效果）
// 不同物种提供不同被动：龟加防御、鹰加速度、虎加攻击、狐加气运、龙加全属性
export function computePetPassiveBonus(state: CharacterState): {
  attack: number;
  defense: number;
  speed: number;
  luck: number;
  cultivationRate: number;  // 修炼速度倍率加成
} {
  const result = { attack: 0, defense: 0, speed: 0, luck: 0, cultivationRate: 0 };
  for (const pet of state.pets || []) {
    if (pet.loyalty < 30 || pet.satiety < 20 || pet.hp <= 0) continue;
    const tier = Math.max(1, Math.floor(pet.level / 3) + 1);
    switch (pet.species) {
      case 'turtle':   result.defense += tier * 2; break;
      case 'eagle':    result.speed += tier * 2; break;
      case 'tiger':
      case 'ape':      result.attack += tier * 2; break;
      case 'fox':
      case 'butterfly':result.luck += tier * 2; break;
      case 'dragon':
      case 'phoenix':  result.attack += tier; result.defense += tier; result.speed += tier; break;
      case 'wolf':
      case 'snake':    result.attack += tier; break;
    }
    // 所有灵宠略微提升修炼速度（陪伴效应）
    result.cultivationRate += 0.02 * tier;
  }
  return result;
}

// ==================== Task 23: 符箓识别 ====================

// 判断物品是否为符箓（通过 effects 中的 target_attribute 判定）
export function getTalismanType(item: ItemEntry): TalismanType | null {
  for (const eff of item.effects || []) {
    if (eff.target_attribute === 'talisman_attack') return 'talisman_attack';
    if (eff.target_attribute === 'talisman_defense') return 'talisman_defense';
    if (eff.target_attribute === 'talisman_heal') return 'talisman_heal';
    if (eff.target_attribute === 'talisman_escape') return 'talisman_escape';
    if (eff.target_attribute === 'talisman_stun') return 'talisman_stun';
  }
  return null;
}

// 判断物品是否为普通丹药（非符箓的 consumable）
export function isPillItem(item: ItemEntry): boolean {
  if (item.item_type !== 'consumable') return false;
  return getTalismanType(item) === null;
}

// 获取战斗中可用的符箓列表
export function getAvailableTalismans(state: CharacterState): ItemEntry[] {
  return (state.inventory || []).filter(it => getTalismanType(it) !== null);
}


function slugifyRealmName(name: string): string {
  const raw = String(name || 'story_realm').trim() || 'story_realm';
  const ascii = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (ascii) return ascii.slice(0, 48);
  let hash = 0;
  for (const ch of raw) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `story_${hash.toString(36)}`;
}

function cleanStoryRealmName(name: string): string {
  return String(name || '')
    .replace(/^(?:或可|可|可以|尚可|似可|若要|若想|前往|进入|探入|探明|探得|发现|得见|显出|现出|浮出|露出|通往|指向|开启)+/, '')
    .replace(/^(?:的|之|其|一处|此处)+/, '')
    .replace(/[，。；、：:！!？?].*$/, '')
    .trim();
}

function inferStoryRealmName(text: string): string | null {
  const source = String(text || '');
  const suffix = '(?:秘境|浮阁|洞府|遗迹|禁地|水府|古阁|钟楼|雾楼|楼|谷|府|墟|宫|殿)';
  const composite = source.match(new RegExp(`([\\u4e00-\\u9fa5]{2,8}(?:江|溪|河|湾|湖|山|岭|渡|岸|洲|峰|林|泽|城))[\\u4e00-\\u9fa5]{0,4}(?:显出|现出|浮出|露出|探明|探得|发现|得见|可见|藏着|藏有|通往|开启|指向)([\\u4e00-\\u9fa5]{2,8}${suffix})`));
  if (composite?.[1] && composite?.[2]) {
    const loc = cleanStoryRealmName(composite[1]);
    const site = cleanStoryRealmName(composite[2]);
    if (loc && site && !site.startsWith(loc)) return `${loc}${site}`.slice(0, 14);
    if (site) return site;
  }
  const quoted = source.match(/[「『“\"]([^」』”\"]{2,14}(?:秘境|浮阁|洞府|遗迹|禁地|水府|古阁|钟楼|雾楼|楼|谷|府|墟|宫|殿))[^」』”\"]*[」』”\"]/);
  if (quoted?.[1]) return cleanStoryRealmName(quoted[1]);
  const named = source.match(/([\u4e00-\u9fa5]{2,14}(?:秘境|浮阁|洞府|遗迹|禁地|水府|古阁|钟楼|雾楼|楼|谷|府|墟|宫|殿))/);
  if (named?.[1]) return cleanStoryRealmName(named[1]);
  return null;
}

function inferRealmRequirement(text: string): string | undefined {
  const source = String(text || '');
  const specific = source.match(/([\u4e00-\u9fa5]{1,10}(?:玉片|钥匙|钥纹|残图|令牌|符令|禁制手法|破禁法))/);
  if (specific?.[1]) return specific[1];
  if (/钥|钥匙|钥纹|禁制|破禁|残图|令牌|符令|玉片|信物/.test(source)) return '入境信物';
  return undefined;
}

function buildStoryRealmFromText(name: string, text: string, state: CharacterState, thread?: PendingThread): SecretRealm {
  const water = /江|水|潮|雨|雾|渡|溪|河|禁/.test(`${name}${text}`);
  const ancient = /古|旧|昔年|残图|壁刻|禁制|遗/.test(`${name}${text}`);
  const tier: SecretRealm['tier'] = ancient ? 'uncommon' : 'common';
  const realmIdx = Math.max(0, REALMS.findIndex(r => r.id === state.realm));
  const req = inferRealmRequirement(text);
  return {
    id: thread?.realmId || `story_${slugifyRealmName(name)}`,
    name,
    description: String(text || `因缘牵引而显露的${name}。`).slice(0, 180),
    tier,
    minRealm: Math.max(0, Math.min(realmIdx, realmIdx || 1)),
    minAge: Math.max(0, state.age - 1),
    spiritStoneCost: 0,
    discoveredByThreadId: thread?.id,
    entryRequirement: req,
    entryAlternatives: req ? ['参悟信物中的禁制手法', '循原先残图与地势另觅侧径', '等待潮汐/地脉再次开合'] : ['循旧迹探入', '等待地脉气机再显'],
    isStoryRealm: true,
    dangerLevel: /内禁|杀机|禁地|强闯|不敢/.test(text) ? 6 : 3,
    rewardMultiplier: ancient ? 1.4 : 1.1,
    cooldownYears: 3,
    themeTags: [water ? 'water' : 'mystery', ancient ? 'inheritance' : 'treasure', 'story'],
    elementAffinity: water ? 'water' : undefined,
    encounterHints: req
      ? [`凭${req}试探门户`, '沿旧日痕迹复探外围', '另寻破禁之法', '避开内禁杀机']
      : ['循线索探路', '辨认地脉气机', '避开未知禁制'],
    color: water ? '#0ea5e9' : '#a855f7',
    icon: water ? '🌊' : '🏛',
  };
}

export function getDiscoveredStoryRealms(state: CharacterState): SecretRealm[] {
  const realms = new Map<string, SecretRealm>();
  const threads = normalizeThreadsCompletion(state.pendingThreads || []).filter(t => t.status !== 'failed' && t.status !== 'resolved');
  for (const t of threads) {
    const text = `${t.title} ${t.description} ${t.reward || ''} ${t.followUpHint || ''}`;
    const looksRealm = t.category === 'exploration' || /秘境|浮阁|洞府|遗迹|禁地|水府|古阁|江心|残图|禁制|破禁/.test(text);
    if (!looksRealm) continue;
    const name = inferStoryRealmName(text) || (t.title && /秘境|浮阁|洞府|遗迹|禁地|水府|古阁|楼|谷|府|墟|宫|殿/.test(t.title) ? t.title : null);
    if (!name) continue;
    const realm = buildStoryRealmFromText(name, text, state, t);
    realms.set(realm.id, realm);
  }
  const inventoryText = [...(state.inventory || []), ...(state.equipped || [])]
    .map(it => `${it.name} ${it.description || ''} ${it.source || ''}`).join('\n');
  const invName = inferStoryRealmName(inventoryText);
  if (invName) {
    const realm = buildStoryRealmFromText(invName, inventoryText, state);
    realms.set(realm.id, realm);
  }
  const list = [...realms.values()];
  return list
    .filter((realm, idx, arr) => !arr.some((other, j) => j !== idx && other.name.includes(realm.name) && other.name.length > realm.name.length))
    .slice(0, 5);
}

function isLocalSameYearThread(thread: PendingThread, age: number): boolean {
  if (thread.dueInSameYear || thread.deadlineAge <= age) return true;
  const text = `${thread.title || ''}${thread.description || ''}${thread.followUpHint || ''}`;
  return /今年|本年|当年|不久|三月|数月|半年|入夜|当夜|夜里|黄昏|清晨|翌日|转日|临走前|临行|临别|走前|离开前/.test(text);
}

export function getSameYearThreads(state: CharacterState): PendingThread[] {
  const age = state.age;
  return normalizeThreadsCompletion(state.pendingThreads || []).filter(t =>
    (t.status === 'pending' || t.status === 'urgent') &&
    isLocalSameYearThread(t, age) &&
    t.progress < 100
  ).slice(0, 2);
}


function shortThreadTimeAdvance(threadText: string, isVeryYoung: boolean): any {
  if (/三日后/.test(threadText)) return { amount: 3, unit: 'day', label: '三日后', reason: '承接短期因缘', ageDeltaYears: 0, elapsedDays: 3 };
  if (/两日后/.test(threadText)) return { amount: 2, unit: 'day', label: '两日后', reason: '承接短期因缘', ageDeltaYears: 0, elapsedDays: 2 };
  if (/数日后|几日后/.test(threadText)) return { amount: 5, unit: 'day', label: '数日后', reason: '承接短期因缘', ageDeltaYears: 0, elapsedDays: 5 };
  if (/明日|翌日|转日/.test(threadText)) return { amount: 1, unit: 'day', label: '翌日', reason: '承接短期因缘', ageDeltaYears: 0, elapsedDays: 1 };
  if (/半月后/.test(threadText)) return { amount: 15, unit: 'day', label: '半月后', reason: '承接短期因缘', ageDeltaYears: 0, elapsedDays: 15 };
  if (/三月后/.test(threadText)) return { amount: 3, unit: 'month', label: '三月后', reason: '承接同岁因缘', ageDeltaYears: 0, elapsedDays: 90 };
  if (/数月后/.test(threadText)) return { amount: 2, unit: 'month', label: '数月后', reason: '承接同岁因缘', ageDeltaYears: 0, elapsedDays: 60 };
  return { amount: isVeryYoung ? 1 : 1, unit: isVeryYoung ? 'day' : 'month', label: isVeryYoung ? '翌日' : '月余后', reason: '承接同岁因缘', ageDeltaYears: 0, elapsedDays: isVeryYoung ? 1 : 30 };
}

const INTERNAL_THREAD_NARRATIVE_PHRASES = [
  '\u5faa\u7740\u65e7\u8ff9\u4e0e\u65e7\u7ea6\u7ee7\u7eed\u8ffd\u7d22',
  '\u524d\u7f18\u6b63\u5f85\u4e86\u7ed3',
  '\u8fd9\u6861\u524d\u7f18\u6b63\u5f85\u4e86\u7ed3',
  '\u6b64\u4e8b\u5e76\u672a\u968f\u4e0a\u4e00\u6bb5\u7ecf\u5386\u6563\u53bb',
  '\u6536\u62e2\u6240\u5f97\u7ebf\u7d22',
  '\u53cd\u590d\u63e3\u6469',
  '\u540e\u7eed\u627f\u63a5\u63d0\u793a',
  '\u540c\u5e74\u7eed\u7bc7',
  '\u6d41\u5e74\u56e0',
  '\u7eed\u7bc7',
];

function cleanVisibleThreadTitle(title?: string) {
  const cleaned = String(title || '')
    .replace(/\u6d41\u5e74\u56e0[\uff1a:]?/g, '')
    .replace(/\u540c\u5e74\u7eed\u7bc7/g, '')
    .replace(/\u7eed\u7bc7/g, '')
    .replace(/^[\u002c\uff0c\u003b\uff1b\u3002\s]+/, '')
    .trim();
  return cleaned.slice(0, 24) || '\u65e7\u4e8b\u56de\u54cd';
}

function sanitizeThreadContinuationNarrative(text: string, fallback: string): string {
  let cleaned = String(text || '').trim();
  for (const phrase of INTERNAL_THREAD_NARRATIVE_PHRASES) {
    cleaned = cleaned.split(phrase).join('');
  }
  cleaned = cleaned
    .replace(/\u6574\u7406\u884c\u88c5\u524d\u53bb\u8d74\u7ea6/g, '\u628a\u65e7\u7ea6\u6682\u4e14\u6536\u5728\u5fc3\u91cc')
    .replace(/\u5fc5\u987b\u4eb2\u81ea\u7ed9\u51fa\u7684\u4ea4\u4ee3/g, '\u7b49\u65f6\u673a\u6210\u719f\u540e\u518d\u4f5c\u56de\u5e94')
    .replace(/\u5c71\u98ce\u8fc7\u5904/g, '')
    .replace(/\u65e7\u4e8b\u4e0d\u518d\u53ea\u662f\u5ff5\u5934/g, '\u8fd9\u4ef6\u4e8b\u8fd8\u88ab\u8bb0\u7740')
    .replace(/\u5fc5\u987b[\u4e00-\u9fff]*\u91cf\u7684\u4e00\u91cd\u56e0\u679c/g, '\u4ecd\u9700\u65e5\u540e\u6162\u6162\u56de\u5e94')
    .replace(/\u4e00\u91cd\u56e0\u679c/g, '\u4e00\u4ef6\u8fd8\u6709\u56de\u54cd\u7684\u65e7\u4e8b')
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/^[\u002c\uff0c\u003b\uff1b\u3002\s]+/, '')
    .replace(/[\u002c\uff0c\u003b\uff1b]\s*[\u3002\uff01\uff1f]/g, '\u3002')
    .trim();
  return cleaned || fallback;
}

export function buildThreadContinuationEvent(state: CharacterState, thread: PendingThread): any {
  const visibleThreadTitle = cleanVisibleThreadTitle(thread.title);
  const threadText = `${visibleThreadTitle} ${thread.description} ${thread.followUpHint || ''}`;
  const realmName = inferStoryRealmName(threadText);
  const isVeryYoung = Number(state.age ?? 0) < 7;
  const isRealm = !isVeryYoung && (thread.category === 'exploration' || !!realmName || /\u79d8\u5883|\u6d6e\u9601|\u6d1e\u5e9c|\u9057\u8ff9|\u7981\u5730|\u7981\u5236|\u7834\u7981/.test(`${thread.title}${thread.description}`));
  const isCompetition = !isVeryYoung && (thread.category === 'competition' || /\u6bd4\u8bd5|\u8003\u6838|\u5165\u95e8|\u4ed9\u95e8|\u64c2\u53f0/.test(`${thread.title}${thread.description}`));
  const isPromise = !isVeryYoung && (thread.category === 'promise' || /\u7ea6|\u8bfa|\u627f\u8bfa|\u8fd8\u613f|\u8d74\u7ea6/.test(threadText));
  const isTeachingFollowUp = /\u542c\u8bc0|\u6388\u8bc0|\u4f20\u8bc0|\u4fee\u884c\u8bc0|\u5fc3\u6cd5|\u53e3\u8bc0|\u542c\u4fee|\u542c\u6cd5|\u8bb2\u8bc0/.test(threadText);
  const title = isVeryYoung
    ? visibleThreadTitle
    : isRealm
      ? (realmName || visibleThreadTitle)
      : isCompetition
        ? `\u7ea6\u671f\u5df2\u81f3\u00b7${visibleThreadTitle}`
        : isPromise
          ? `\u65e7\u7ea6\u56de\u54cd\u00b7${visibleThreadTitle}`
          : visibleThreadTitle;

  const fallbackNarrative = isTeachingFollowUp
    ? `${state.name}\u6309\u7740\u5148\u524d\u7684\u5631\u5490\uff0c\u5728\u7ea6\u5b9a\u7684\u65f6\u5019\u518d\u53bb\u542c\u8bb2\u3002\u8fd9\u4e00\u56de\u4e0d\u518d\u53ea\u662f\u8bb0\u4f4f\u51e0\u53e5\u8bdd\uff0c\u800c\u662f\u628a\u80fd\u542c\u61c2\u7684\u5173\u8282\u7559\u5728\u5fc3\u91cc\uff0c\u5f80\u540e\u4fee\u884c\u65f6\u4e5f\u591a\u4e86\u4e00\u5904\u53ef\u53cd\u590d\u56de\u60f3\u7684\u8bdd\u5934\u3002`
    : isVeryYoung
    ? `${state.name}\u88ab\u4eb2\u4eba\u62b9\u5728\u80a9\u4e0a\u770b\u4e0a\u4e00\u773c\uff0c\u773c\u775b\u8ddf\u7740\u8349\u987a\u4e0a\u7684\u8774\u8776\u4e1c\u8ddf\u897f\u8ff7\u3002\u4e00\u4f1a\u513f\u4ed6\u4ece\u4eb2\u4eba\u80a9\u4e0a\u4e0b\u6765\uff0c\u63a8\u5f00\u9662\u95e8\u53bb\u62ff\u4e1c\u897f\uff0c\u8e29\u4e86\u4e00\u811a\u6c34\u6c60\u8fb9\u7684\u9ec4\u8717\u725b\uff0c\u4e0d\u6015\uff0c\u53cd\u800c\u8d77\u52b2\u62ff\u5c04\u4e1c\u897f\u62fc\u8d77\u6765\u3002\u6700\u540e\u4ed6\u7a7f\u8d8a\u5c0f\u679c\u6797\u62d8\u4e0a\u4e00\u5757\u5e73\u77f3\uff0c\u62ff\u7740\u4e1c\u897f\u8df3\u4e0b\u6765\uff0c\u4e0a\u9762\u5168\u662f\u8349\u8c1c\u3002\u5927\u4eba\u5728\u80a1\u540e\u4e0d\u8d77\u4e49\u52a8\uff0c\u53ea\u62ff\u7740\u5e06\u5e03\u6e90\u4e1c\u897f\u3002`
    : isRealm
      ? `${state.name}\u4f9d\u7167\u624b\u4e2d\u4fe1\u7269\u4e0e\u5730\u52bf\u53d8\u5316\u91cd\u65b0\u8fa8\u8ba4\u95e8\u6237\u3002\u96fe\u6c14\u5f00\u5408\u4e4b\u95f4\uff0c\u65e7\u65e5\u6240\u89c1\u7ec8\u4e8e\u6709\u4e86\u53ef\u843d\u811a\u7684\u65b9\u4f4d\uff1b\u82e5\u8981\u518d\u8fdb\u4e00\u6b65\uff0c\u4ecd\u9700\u8c28\u614e\u8bd5\u63a2\u7981\u5236\u865a\u5b9e\u3002`
      : isCompetition
        ? `\u7ea6\u671f\u5df2\u8fd1\uff0c${state.name}\u6574\u5907\u8863\u88c5\u4e0e\u968f\u8eab\u5668\u7269\uff0c\u6309\u65f6\u524d\u53bb\u5e94\u8bd5\u3002\u573a\u4e2d\u4eba\u58f0\u6e10\u8d77\uff0c\u8fd9\u4e00\u573a\u6bd4\u8bd5\u5173\u7cfb\u5230\u80fd\u5426\u63a5\u7eed\u65e9\u5148\u7ed3\u4e0b\u7684\u4ed9\u9014\u673a\u7f18\u3002`
        : isPromise
          ? `${state.name}\u5fc3\u91cc\u8fd8\u8bb0\u5f97\u65e9\u5148\u90a3\u6869\u7ea6\u5b9a\uff0c\u5374\u4e0d\u518d\u628a\u5b83\u5f53\u6210\u5fc5\u987b\u72ec\u81ea\u5954\u8d74\u7684\u8fdc\u884c\u3002\u5e74\u7eaa\u5c1a\u5c0f\u6216\u65f6\u673a\u672a\u81f3\u65f6\uff0c\u8fd9\u4efd\u7275\u6302\u53ea\u5316\u4f5c\u957f\u8f88\u7684\u7167\u770b\u3001\u4f20\u8bdd\u6216\u5fc3\u5934\u7684\u76fc\u5934\uff1b\u7b49\u5230\u771f\u6b63\u80fd\u4f5c\u51fa\u56de\u5e94\u7684\u65f6\u5019\uff0c\u8fd9\u6761\u65e7\u7ebf\u624d\u4f1a\u518d\u6b21\u663e\u5f62\u3002`
          : `${state.name}\u6ca1\u6709\u628a\u8fd9\u4e8b\u8bf4\u6210\u4ec0\u4e48\u5927\u9053\u7406\uff0c\u53ea\u5728\u65e5\u5e38\u91cc\u591a\u7559\u4e86\u4e2a\u5c0f\u5c0f\u5ff5\u5934\u3002\u5979\u5411\u8eab\u8fb9\u4eba\u95ee\u4e86\u4e24\u53e5\uff0c\u53c8\u628a\u80fd\u8bb0\u4f4f\u7684\u540d\u5b57\u3001\u5730\u65b9\u548c\u8bdd\u5934\u8bb0\u5728\u5fc3\u91cc\uff1b\u82e5\u4ee5\u540e\u6709\u4eba\u518d\u63d0\u8d77\uff0c\u4fbf\u77e5\u9053\u8be5\u4ece\u54ea\u91cc\u63a5\u7740\u95ee\u3002`;

  const narrative = sanitizeThreadContinuationNarrative(fallbackNarrative, fallbackNarrative);
  return {
    title,
    narrative,
    eventType: isCompetition ? 'normal' : isRealm ? 'exploration' : 'normal',
    changes: isCompetition ? [{ attribute: 'reputation', delta: 1, reason: '\u5b88\u7ea6\u8d74\u8bd5' }] : [],
    newStatuses: [],
    newItems: [], removedItemIds: [], newEquippedItems: [], equipItemIds: [], unequipItemIds: [],
    memory: `${state.age}\u5c81\u7eed\u5199\u7ebf\u7d22\uff1a${thread.title}`,
    cultivationInsight: '',
    hasChoice: false, choice: null, triggeredBreakthrough: false, causedDeath: false, causedAscension: false,
    timeAdvance: shortThreadTimeAdvance(threadText, isVeryYoung),
    newThreads: [],
    advanceThreads: [],
    completeThreadIds: [thread.id],
    failThreadIds: [],
    triggerCombat: null,
    newPets: [],
  };
}

// ==================== Task 24: 秘境探索系统 ====================

// 获取当前角色可探索的秘境列表（含冷却状态）
export function getAvailableRealms(state: CharacterState): Array<SecretRealm & {
  onCooldown: boolean;
  cooldownRemaining: number;  // 剩余冷却年数
  timesExplored: number;
  lastExploredAge?: number;
}> {
  const realmIdx = REALMS.findIndex(r => r.id === state.realm);
  const records = state.exploredRealms || [];
  const storyRealms = getDiscoveredStoryRealms(state);
  const pool = storyRealms.length ? storyRealms : SECRET_REALMS;
  return pool
    .filter(r => realmIdx >= r.minRealm && state.age >= r.minAge)
    .map(r => {
      const rec = records.find(rec => rec.realmId === r.id);
      const lastAge = rec?.lastExploredAge ?? -999;
      const elapsed = state.age - lastAge;
      const onCooldown = elapsed < r.cooldownYears;
      return {
        ...r,
        onCooldown,
        cooldownRemaining: onCooldown ? (r.cooldownYears - elapsed) : 0,
        timesExplored: rec?.timesExplored ?? 0,
        lastExploredAge: rec?.lastExploredAge,
      };
    });
}

// 探索秘境前置校验：返回 { ok, error? }
export function canExploreRealm(state: CharacterState, realmId: string): { ok: boolean; error?: string; realm?: SecretRealm } {
  const realm = [...getDiscoveredStoryRealms(state), ...SECRET_REALMS].find(r => r.id === realmId);
  if (!realm) return { ok: false, error: '秘境不存在' };
  if (!state.alive) return { ok: false, error: '角色已陨落' };
  if (state.combatSession && state.combatSession.status === 'ongoing') {
    return { ok: false, error: '战斗进行中，无法探索秘境' };
  }
  if (state.isAtChoice) return { ok: false, error: '当前有待选择，请先完成选择' };
  const realmIdx = REALMS.findIndex(r => r.id === state.realm);
  if (realmIdx < realm.minRealm) return { ok: false, error: `境界不足，需${REALMS[realm.minRealm].name}以上` };
  if (state.age < realm.minAge) return { ok: false, error: `年龄不足，需${realm.minAge}岁以上` };
  const cost = realm.isStoryRealm ? 0 : realm.spiritStoneCost;
  if (realm.entryRequirement) {
    const hasRequirement = hasRealmEntryRequirement(state, realm.entryRequirement);
    if (!hasRequirement) {
      return { ok: false, error: `尚未掌握入境关窍：需${realm.entryRequirement}，或另寻${(realm.entryAlternatives || ['破禁之法']).join('、')}` };
    }
  }
  if (state.spiritStones < cost) {
    return { ok: false, error: `灵石不足，需${cost}灵石` };
  }
  // 冷却检查
  const rec = (state.exploredRealms || []).find(rec => rec.realmId === realmId);
  if (rec) {
    const elapsed = state.age - rec.lastExploredAge;
    if (elapsed < realm.cooldownYears) {
      return { ok: false, error: `秘境冷却中，还需${realm.cooldownYears - elapsed}年` };
    }
  }
  return { ok: true, realm };
}

// 扣除灵石 + 标记秘境探索 + 返回新 state（探索事件由 AI 生成，引擎只负责状态前置）
export function startExploration(state: CharacterState, realm: SecretRealm): CharacterState {
  const newState: CharacterState = {
    ...state,
    spiritStones: Math.max(0, state.spiritStones - (realm.isStoryRealm ? 0 : realm.spiritStoneCost)),
  };
  // 标记当前探索的秘境（让 buildStateContext 透传给 AI）
  (newState as any)._currentExploration = realm;
  return newState;
}

// ==================== AI-68: 多界飞升派生函数 ====================
// 飞升要求表（按境界 → 三界层级）
const ASCENSION_REQUIREMENTS: Record<WorldTier, AscensionRequirement> = {
  humanWorld: {
    fromTier: 'humanWorld',
    toTier: 'spiritWorld',
    minRealm: 'mahayana',
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
  const realmOrder: Realm[] = [
    'qi_refining', 'foundation_building', 'golden_core', 'nascent_soul',
    'deity_transformation', 'void_refinement', 'unity', 'tribulation',
    'mahayana', 'ascension',
  ];
  const charIdx = realmOrder.indexOf(character.realm);
  const reqIdx = realmOrder.indexOf(requirements.minRealm);
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
  if (realm === 'mahayana' && age >= 500) return { triggered: true, reason: '大乘期 500 岁可尝试飞升' };
  if (realm === 'ascension' && age >= 2000) return { triggered: true, reason: '渡劫期 2000 岁可尝试飞升仙界' };
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
  const tribulationRealms: Realm[] = [
    'deity_transformation', 'void_refinement', 'unity', 'tribulation',
    'mahayana', 'ascension',
  ];
  const isTrigger = tribulationRealms.includes(realmAfter);
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
}): { passed: boolean; hpRemaining: number; narrative: string } {
  const baseThreshold = 0.3 + opts.boltNumber * 0.07;
  const heartDemonPenalty = Math.max(0, (opts.heartDemon - 30) / 200);
  const soulBonus = opts.soulStrength / 500;
  const artifactBonus = opts.bondedArtifactResonance ? 0.1 : 0;
  const effectiveRoll = opts.characterRoll + soulBonus + artifactBonus - heartDemonPenalty;
  const passed = effectiveRoll >= baseThreshold;
  const hpDelta = passed ? -Math.max(5, opts.boltNumber * 5) : -30;
  return {
    passed,
    hpRemaining: Math.max(0, Math.min(100, 100 + hpDelta)),
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
export function recordExploration(
  state: CharacterState,
  realmId: string,
  bestReward?: string,
): CharacterState {
  const existing = state.exploredRealms || [];
  const idx = existing.findIndex(r => r.realmId === realmId);
  let newRecords: ExplorationRecord[];
  if (idx >= 0) {
    // 已有记录：更新 lastExploredAge + timesExplored + bestReward
    const old = existing[idx];
    const updated: ExplorationRecord = {
      realmId,
      lastExploredAge: state.age,
      timesExplored: old.timesExplored + 1,
      bestReward: bestReward || old.bestReward,
    };
    newRecords = [...existing];
    newRecords[idx] = updated;
  } else {
    // 新记录
    newRecords = [...existing, {
      realmId,
      lastExploredAge: state.age,
      timesExplored: 1,
      bestReward,
    }];
  }
  // 清除 _currentExploration（探索结束）
  const newState: CharacterState = {
    ...state,
    exploredRealms: newRecords,
  };
  delete (newState as any)._currentExploration;
  return newState;
}




// ==================== AI-86/87/88/89/90: Worker B Additions ====================
// Worker B (xiaoxin-B) - additive only, do not modify existing functions above.
// New derived functions for pill side effects, formation drawing, pet evolution,
// pet insight/communication, and pet combat skills.

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
} from './types';

// ---------------- AI-86: Pill Effectiveness & Side Effects ----------------

/**
 * 派生某颗丹药在角色当前状态下的实际服用效果评估。
 * 综合丹药品质、角色境界、体质、当前丹毒累积等因素。
 */
export function derivePillEffectiveness(
  pill: { id: string; name: string; quality?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'; tier?: number; expGain?: number; hpRestore?: number; mpRestore?: number; effects?: any[]; isPill?: boolean },
  character: CharacterState
): PillEffectiveness {
  const quality = pill.quality ?? 'common';
  const tier = pill.tier ?? 1;
  const qualityMul: Record<string, number> = {
    common: 0.6, uncommon: 0.8, rare: 1.0, epic: 1.4, legendary: 1.8, mythic: 2.4,
  };
  const mul = qualityMul[quality] ?? 1.0;

  // 角色境界越高，对高阶丹药利用率越高
  const realmLevel = (character as any).realmLevel ?? 0;
  const realmFactor = 1 + Math.min(realmLevel, 9) * 0.05;

  const baseBoost = pill.expGain ?? 0;
  const hpBoost = pill.hpRestore ?? 0;
  const mpBoost = pill.mpRestore ?? 0;

  // 副作用概率：高阶丹药 + 低境界服用 = 高副作用概率
  const realmGap = Math.max(0, tier - realmLevel);
  const sideEffectChance = Math.min(0.85, 0.05 + realmGap * 0.12 + (tier >= 3 ? 0.1 : 0));
  const sideEffectSeverity = Math.min(5, 1 + Math.floor(tier / 2) + Math.floor(realmGap / 2));

  // 按 tier 决定可能触发的副作用种类
  const possible: PillSideEffect[] = [];
  if (tier >= 1) possible.push('toxicity');
  if (tier >= 2) possible.push('qi-turbulence');
  if (tier >= 3) possible.push('cultivation-deviation');
  if (tier >= 4) possible.push('karma');

  return {
    pillId: pill.id,
    pillName: pill.name,
    boost: {
      cultivationExp: Math.round(baseBoost * mul * realmFactor),
      hp: Math.round(hpBoost * mul),
      mp: Math.round(mpBoost * mul),
      durationTurns: 3,
    },
    sideEffectChance,
    sideEffectSeverity,
    possibleSideEffects: possible,
  };
}

/**
 * 根据副作用评估结果，结算对角色状态的具体影响。
 * 返回的属性变更与状态变更应由调用方应用到 CharacterState。
 */
export function resolvePillSideEffects(
  pill: { id: string; name: string; tier?: number; quality?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' },
  character: CharacterState,
  rand: number = Math.random()
): PillSideEffectResolution {
  const eff = derivePillEffectiveness(pill, character);
  const triggered = rand < eff.sideEffectChance;
  if (!triggered) {
    return {
      pillId: pill.id,
      triggered: false,
      severity: 0,
      attributeChanges: [],
      statusChanges: [],
    };
  }
  // 选取第一个副作用（按出现概率最高的）
  const side = eff.possibleSideEffects[0] ?? 'toxicity';
  const sev = eff.sideEffectSeverity;

  const changes: AttributeChange[] = [];
  const statuses: StatusEntry[] = [];

  switch (side) {
    case 'toxicity':
      changes.push({ attribute: 'hp', delta: -sev * 8, reason: `pill-side-effect:${pill.id}` });
      statuses.push({
        id: `pill-toxicity-${pill.id}`,
        name: '丹毒淤积',
        description: `服用${pill.name}后丹毒未散`,
        category: 'debuff',
        rarity: 'common',
        duration: 30,
        source: `服用${pill.name}后丹毒未散`,
        effects: [{ target_attribute: 'cultivation_rate', operation: 'multiply', value: 1 - sev * 0.05, description: 'cultivation rate penalty from pill toxicity' }],
      });
      break;
    case 'cultivation-deviation':
      changes.push({ attribute: 'hp', delta: -sev * 12, reason: `pill-deviation:${pill.id}` });
      changes.push({ attribute: 'cultivationExp', delta: -sev * 20, reason: `pill-deviation:${pill.id}` });
      statuses.push({
        id: `pill-deviation-${pill.id}`,
        name: '走火入魔',
        description: `服用${pill.name}后气机逆行`,
        category: 'debuff',
        rarity: 'uncommon',
        duration: 15,
        source: `服用${pill.name}后气机逆行`,
        effects: [],
      });
      break;
    case 'karma':
      statuses.push({
        id: `pill-karma-${pill.id}`,
        name: '因果牵缠',
        description: `${pill.name}引来天道注视`,
        category: 'special',
        rarity: 'rare',
        duration: 60,
        source: `${pill.name}引来天道注视`,
        effects: [],
      });
      break;
    case 'qi-turbulence':
      statuses.push({
        id: `pill-qi-turbulence-${pill.id}`,
        name: '气机紊乱',
        description: `服用${pill.name}后经脉不稳`,
        category: 'debuff',
        rarity: 'common',
        duration: 20,
        source: `服用${pill.name}后经脉不稳`,
        effects: [{ target_attribute: 'cultivation_rate', operation: 'multiply', value: 1 - sev * 0.08, description: 'cultivation rate penalty from qi turbulence' }],
      });
      break;
  }

  return {
    pillId: pill.id,
    triggered: true,
    sideEffect: side,
    severity: sev,
    attributeChanges: changes,
    statusChanges: statuses,
    narrativeHint: `服用${pill.name}后感到${
      side === 'toxicity' ? '腹内灼热、丹毒游走' :
      side === 'cultivation-deviation' ? '经脉一阵剧痛、气血翻涌' :
      side === 'karma' ? '冥冥中似有注视落下' :
      '气息凌乱、难以凝神'
    }。`,
  };
}

// ---------------- AI-87: Formation Drawing Process ----------------

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

const PET_STAGE_ORDER: PetEvolutionStage[] = ['infant', 'youth', 'mature', 'ascended'];

const PET_EVOLUTION_REQUIREMENTS: Record<PetEvolutionStage, PetEvolutionRequirement> = {
  infant: {
    stage: 'infant',
    minAge: 0,
    minRealmLevel: 0,
    materials: [],
    minLoyalty: 0,
  },
  youth: {
    stage: 'youth',
    minAge: 1,
    minRealmLevel: 2,
    materials: ['pet_growth_pill'],
    minLoyalty: 40,
  },
  mature: {
    stage: 'mature',
    minAge: 5,
    minRealmLevel: 4,
    materials: ['pet_mature_essence', 'pet_growth_pill'],
    minLoyalty: 70,
  },
  ascended: {
    stage: 'ascended',
    minAge: 20,
    minRealmLevel: 7,
    materials: ['pet_ascension_crystal', 'pet_mature_essence', 'pet_growth_pill'],
    minLoyalty: 90,
  },
};

/**
 * 检查灵宠是否能进阶到下一阶段。返回资格与缺失项列表。
 */
export function derivePetEvolutionEligibility(
  pet: { id: string; level?: number; exp?: number; loyalty?: number; acquiredAge?: number; stage?: PetEvolutionStage },
  character: CharacterState
): PetEvolutionEligibility {
  const currentStage: PetEvolutionStage = pet.stage ?? 'infant';
  const idx = PET_STAGE_ORDER.indexOf(currentStage);
  const nextStage = idx >= 0 && idx < PET_STAGE_ORDER.length - 1 ? PET_STAGE_ORDER[idx + 1] : undefined;

  if (!nextStage) {
    return {
      petId: pet.id,
      currentStage,
      eligible: false,
      missing: ['已达最高阶段'],
    };
  }

  const req = PET_EVOLUTION_REQUIREMENTS[nextStage];
  const missing: string[] = [];

  const heldAge = Math.max(0, (character.age ?? 0) - (pet.acquiredAge ?? 0));
  if (heldAge < req.minAge) {
    missing.push(`陪伴年限不足（需${req.minAge}年，当前${heldAge}年）`);
  }
  const realmLevel = (character as any).realmLevel ?? 0;
  if (realmLevel < req.minRealmLevel) {
    missing.push(`角色境界不足（需境界等级${req.minRealmLevel}，当前${realmLevel}）`);
  }
  const loyalty = pet.loyalty ?? 0;
  if (loyalty < req.minLoyalty) {
    missing.push(`忠诚度不足（需${req.minLoyalty}，当前${loyalty}）`);
  }
  // 材料检查：从角色 inventory 中查找（这里只校验逻辑，不消耗）
  const inv: any[] = (character as any).inventory ?? [];
  for (const mat of req.materials) {
    const has = inv.some((it: any) => it?.id === mat || it?.name === mat);
    if (!has) {
      missing.push(`缺少材料：${mat}`);
    }
  }

  return {
    petId: pet.id,
    currentStage,
    nextStage,
    eligible: missing.length === 0,
    missing,
  };
}

/**
 * 执行灵宠进阶：返回进阶后的灵宠对象（含 stage 提升、属性提升）。
 */
export function resolvePetEvolution(
  pet: { id: string; name?: string; level?: number; stage?: PetEvolutionStage; hp?: number; maxHp?: number; attack?: number; defense?: number; speed?: number }
): PetEvolutionStage | null {
  const currentStage: PetEvolutionStage = pet.stage ?? 'infant';
  const idx = PET_STAGE_ORDER.indexOf(currentStage);
  if (idx < 0 || idx >= PET_STAGE_ORDER.length - 1) return null;
  return PET_STAGE_ORDER[idx + 1];
}

// ---------------- AI-89: Pet Insight Communication ----------------

/**
 * 灵宠在特定条件下向角色传递顿悟片段。
 * 返回 null 表示当前无新顿悟。
 */
export function derivePetInsight(
  pet: { id: string; name?: string; stage?: PetEvolutionStage; element?: 'metal' | 'wood' | 'water' | 'fire' | 'earth'; level?: number; loyalty?: number },
  character: CharacterState
): PetInsight | null {
  const stage = pet.stage ?? 'infant';
  const loyalty = pet.loyalty ?? 0;
  const level = pet.level ?? 1;
  // 触发条件：成熟期以上 + 忠诚度>=60 + 等级>=3
  if (stage === 'infant') return null;
  if (loyalty < 60) return null;
  if (level < 3) return null;

  const insightsByStage: Record<PetEvolutionStage, { name: string; source: string; effect: PetInsight['effect'] }[]> = {
    infant: [],
    youth: [
      { name: '初识灵韵', source: `与${pet.name ?? '灵宠'}日夕相伴`, effect: { cultivationRateBonus: 0.05, elementAffinity: pet.element } },
    ],
    mature: [
      { name: '气机共鸣', source: `${pet.name ?? '灵宠'}突破至成熟期时的心境共鸣`, effect: { cultivationRateBonus: 0.1, elementAffinity: pet.element } },
      { name: '本能觉醒', source: `${pet.name ?? '灵宠'}在危难中护主`, effect: { techniqueHint: '可尝试修习与本属性相合的功法' } },
    ],
    ascended: [
      { name: '化形心得', source: `${pet.name ?? '灵宠'}化形一刻的灵光`, effect: { cultivationRateBonus: 0.2, elementAffinity: pet.element } },
      { name: '本相归元', source: `${pet.name ?? '灵宠'}化形后的反向传授`, effect: { techniqueHint: '可窥见本属性功法的高阶法门' } },
    ],
  };

  const pool = insightsByStage[stage] ?? [];
  if (pool.length === 0) return null;
  // 简化：根据角色年龄 hash 选择一个（确定性，不消耗随机数）
  const idx = ((character.age ?? 0) + (pet.id?.length ?? 0)) % pool.length;
  const pick = pool[idx];
  return {
    petId: pet.id,
    petName: pet.name ?? '灵宠',
    insightName: pick.name,
    source: pick.source,
    learnedAge: character.age ?? 0,
    effect: pick.effect,
  };
}

/**
 * 灵识对话：根据触发原因生成灵宠传递给主人的一句话。
 */
export function resolvePetCommunication(
  pet: { id: string; name?: string; species?: string; loyalty?: number },
  trigger: string
): string {
  const name = pet.name ?? '灵宠';
  const loyalty = pet.loyalty ?? 0;
  // 根据忠诚度切换语气
  if (loyalty < 30) {
    return `${name}心不在焉地瞥了一眼，似对「${trigger}」毫无兴趣。`;
  }
  if (loyalty < 60) {
    return `${name}低鸣一声，隐约传达出对「${trigger}」的淡淡警示。`;
  }
  if (loyalty < 85) {
    return `${name}灵识波动，向主人清晰地传来：「${trigger}——当谨慎。」`;
  }
  return `${name}目光中透出深意，灵识中郑重传来：「主人，${trigger}——此乃天赐之机，亦是天设之险。」`;
}

// ---------------- AI-90: Pet Combat Skills ----------------

/**
 * 根据宠物的基础属性，派生它在战斗中的技能列表。
 * 化形期之前的灵宠只有一个技能（来自 PET_SPECIES_TEMPLATES）。
 */
export function derivePetSkillAvailable(
  pet: { id: string; stage?: PetEvolutionStage; level?: number; skill?: { name: string; description: string; power: number; cooldown: number }; species?: string },
  turn: number,
  usage: PetSkillUsage[] = []
): PetCombatSkill[] {
  const stage = pet.stage ?? 'infant';
  const baseSkill = pet.skill;
  if (!baseSkill) return [];

  const skills: PetCombatSkill[] = [
    {
      skillId: `${pet.id}-basic`,
      name: baseSkill.name,
      description: baseSkill.description,
      power: baseSkill.power,
      cooldown: baseSkill.cooldown,
      range: 'single',
      effect: 'physical',
    },
  ];

  // 成熟期 +：解锁元素技能
  if (stage === 'mature' || stage === 'ascended') {
    skills.push({
      skillId: `${pet.id}-elemental`,
      name: `${baseSkill.name}·属相共鸣`,
      description: '汲取主人与自身的元素共鸣，释放元素之击',
      power: Math.round(baseSkill.power * 1.4),
      cooldown: baseSkill.cooldown + 1,
      range: stage === 'ascended' ? 'all_enemies' : 'single',
      effect: 'elemental',
      element: 'fire',
    });
  }
  // 化形期：解锁辅助技能
  if (stage === 'ascended') {
    skills.push({
      skillId: `${pet.id}-guard`,
      name: '化形护主',
      description: '以人形短暂护主，减免本回合伤害',
      power: 0,
      cooldown: 4,
      range: 'all_allies',
      effect: 'buff',
    });
  }

  // 过滤掉冷却中或已用尽的技能
  return skills.filter(s => {
    const u = usage.find(x => x.skillId === s.skillId);
    if (!u) return true;
    if (u.usesLeft === 0) return false;
    if (u.lastUsedTurn > 0 && turn - u.lastUsedTurn < s.cooldown) return false;
    return true;
  });
}

/**
 * 执行灵宠技能，返回一个战斗事件对象（damage/heal/buff 等）。
 */
export function resolvePetSkillUse(
  pet: { id: string; name?: string; attack?: number; element?: 'metal' | 'wood' | 'water' | 'fire' | 'earth' },
  skill: PetCombatSkill,
  turn: number,
  targetId?: string
): PetCombatSkillEvent {
  const baseAtk = pet.attack ?? 10;
  const damage = skill.effect === 'physical' || skill.effect === 'elemental'
    ? Math.round(baseAtk * skill.power)
    : undefined;
  const heal = skill.effect === 'heal'
    ? Math.round(baseAtk * skill.power * 0.6)
    : undefined;

  return {
    petId: pet.id,
    skillId: skill.skillId,
    skillName: skill.name,
    turn,
    targetId,
    damage,
    heal,
    buffApplied: skill.effect === 'buff' ? ['护主之势'] : undefined,
    debuffApplied: skill.effect === 'debuff' || skill.effect === 'control' ? [skill.name] : undefined,
    narrativeHint: `${pet.name ?? '灵宠'}施展【${skill.name}】${
      damage ? `，造成${damage}点伤害` :
      heal ? `，恢复${heal}点气血` :
      skill.effect === 'buff' ? '，为主人撑起护体气罩' :
      skill.effect === 'control' ? `，试图压制目标` :
      ''
    }。`,
  };
}﻿
// ==================== Worker A: AI-81~AI-85 Additions ====================
// All functions below are additive derivation/resolution helpers.
// They DO NOT mutate the combat state machine core or breakthrough state machine core.
// UI is responsible for reading the returned values; the engine never prescribes player input.

// ==================== AI-81: Combat Stance ====================

/**
 * AI-81: 根据角色当前战斗状态与敌方姿态，推导一个建议的战斗姿态。
 * - 始终返回非空姿态（除非没有进行中的战斗）
 * - 不写入 session；仅供 UI / AI 调用方参考
 * - 该函数纯派生，不修改任何状态
 */
export function deriveCombatStance(
  character: CharacterState,
  opponent?: { hp?: number; maxHp?: number; attack?: number; defense?: number; speed?: number },
): CombatStance {
  if (!character) return 'defensive';
  const cs = character.combatSession;
  if (!cs || cs.status !== 'ongoing') return 'defensive';
  const playerHpPct = cs.playerMaxHp > 0 ? cs.playerHp / cs.playerMaxHp : 1;
  const playerMpPct = cs.playerMaxMp > 0 ? cs.playerMp / cs.playerMaxMp : 1;

  // 血量过低 → 守御 / 脱身
  if (playerHpPct <= 0.25) {
    return playerMpPct >= 0.5 ? 'retreat' : 'defensive';
  }
  // 资源不足 → 守御回气
  if (playerMpPct <= 0.3) return 'defensive';
  // 敌方虚弱 → 猛攻
  if (opponent && opponent.maxHp && opponent.maxHp > 0 && opponent.hp != null) {
    const enemyHpPct = opponent.hp / opponent.maxHp;
    if (enemyHpPct <= 0.35) return 'aggressive';
    // 敌高速 / 高攻 → 诱敌
    if ((opponent.attack || 0) >= (character.attack || 0) * 1.4) return 'cunning';
  }
  // 默认猛攻
  return 'aggressive';
}

/**
 * AI-81: 根据当前姿态与对手回应，解析下一次应采用的姿态。
 * - 纯函数：仅做枚举决策
 * - 使用 cooldownTurns 防止抖动切换
 */
export function resolveCombatStanceShift(
  current: CombatStance,
  opponent?: { hp?: number; maxHp?: number; attack?: number; attackPrev?: number },
  history?: { stance: CombatStance; cooldownTurns: number }[],
): CombatStance {
  if (!current) return 'defensive';
  // 若当前姿态还在冷却中（>0），保持
  const inCooldown = (history || []).find(h => h.stance === current && h.cooldownTurns > 0);
  if (inCooldown) return current;

  const enemyHpPct = opponent && opponent.maxHp ? (opponent.hp ?? opponent.maxHp) / opponent.maxHp : 1;
  const enemyRising = opponent && opponent.attack != null && opponent.attackPrev != null && opponent.attack > opponent.attackPrev;

  // 敌方正在蓄力 → 诱敌
  if (enemyRising) return 'cunning';
  // 敌方残血 → 猛攻
  if (enemyHpPct <= 0.3) return 'aggressive';
  // 自身已选猛攻且敌方血多 → 切换诱敌打破僵局
  if (current === 'aggressive' && enemyHpPct > 0.6) return 'cunning';
  // 自身已选诱敌 → 守御片刻
  if (current === 'cunning') return 'defensive';
  return current;
}

// ==================== AI-82: Combat Resource Management ====================

/**
 * AI-82: 根据角色状态推导出战斗资源当前快照。
 * - 真元 qi 与 MP 同步
 * - 神识 soul = floor(spiritualSense * 0.5)
 * - 体魄 stamina = floor(hp * 0.6) + 10
 * - 心神 focus = floor(comprehension * 0.4) + 5
 */
export function deriveCombatResource(character: CharacterState): CombatResourceUsage[] {
  const mp = Math.max(0, character?.mp ?? 0);
  const maxMp = Math.max(1, character?.maxMp ?? 1);
  const hp = Math.max(0, character?.hp ?? 0);
  const maxHp = Math.max(1, character?.maxHp ?? 1);
  const spiritualSense = Math.max(0, character?.spiritualSense ?? 0);
  const comprehension = Math.max(0, character?.comprehension ?? 0);
  return [
    { type: 'qi', current: mp, max: maxMp, regenPerTurn: Math.max(1, Math.floor(maxMp * 0.04)) },
    { type: 'soul', current: Math.floor(spiritualSense * 0.5), max: Math.max(50, Math.floor(spiritualSense * 0.5 + 50)), regenPerTurn: Math.max(1, Math.floor(spiritualSense * 0.05)) },
    { type: 'stamina', current: Math.floor(hp * 0.6) + 10, max: Math.floor(maxHp * 0.6) + 10, regenPerTurn: Math.max(2, Math.floor(maxHp * 0.08)) },
    { type: 'focus', current: Math.floor(comprehension * 0.4) + 5, max: Math.floor(comprehension * 0.4) + 55, regenPerTurn: 2 },
  ];
}

/**
 * AI-82: 根据一次行动消耗结算后，资源的新快照（纯计算，不持久化）。
 */
export function resolveCombatResourceDrain(
  usage: CombatResourceUsage,
  cost: { type: CombatResourceType; value: number },
): CombatResourceUsage {
  if (!usage || !cost) return usage;
  if (usage.type !== cost.type) return usage;
  const newCurrent = Math.max(0, usage.current - Math.max(0, cost.value));
  return {
    ...usage,
    current: newCurrent,
    recentDrain: usage.current - newCurrent,
  };
}

/**
 * AI-82: 检查资源是否足够支撑一组消耗，返回缺失列表。
 */
export function checkCombatResourceSufficient(
  usages: CombatResourceUsage[],
  costs: { type: CombatResourceType; value: number }[],
): { sufficient: boolean; missing: { type: CombatResourceType; need: number; have: number }[] } {
  const missing: { type: CombatResourceType; need: number; have: number }[] = [];
  for (const cost of costs || []) {
    const u = (usages || []).find(x => x.type === cost.type);
    const have = u ? u.current : 0;
    if (have < cost.value) {
      missing.push({ type: cost.type, need: cost.value, have });
    }
  }
  return { sufficient: missing.length === 0, missing };
}

// ==================== AI-83: Breakthrough Stage Refinement ====================

/**
 * AI-83: 推导当前突破尝试所处阶段。
 * - realmBefore == realmAfter → 已通过
 * - 第一次尝试 → 感悟
 * - 年龄 + 心魔值辅助判断凝聚 / 风暴 / 稳固
 */
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
export function detectCombatStalemate(history: Array<{
  round: number;
  playerHpAfter: number;
  enemyHpAfter: number;
}>): { isStalemate: boolean; turnsSinceProgress: number } {
  if (!Array.isArray(history) || history.length < 4) {
    return { isStalemate: false, turnsSinceProgress: 0 };
  }
  let turnsSinceProgress = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const cur = history[i];
    const prev = i > 0 ? history[i - 1] : null;
    if (!prev) {
      turnsSinceProgress += 1;
      continue;
    }
    const deltaPlayer = Math.abs((cur.playerHpAfter ?? 0) - (prev.playerHpAfter ?? 0));
    const deltaEnemy = Math.abs((cur.enemyHpAfter ?? 0) - (prev.enemyHpAfter ?? 0));
    // 至少有一方血量变化超过 1 才算推进
    if (deltaPlayer > 1 || deltaEnemy > 1) {
      return { isStalemate: turnsSinceProgress >= 3, turnsSinceProgress };
    }
    turnsSinceProgress += 1;
  }
  return { isStalemate: turnsSinceProgress >= 3, turnsSinceProgress };
}

/**
 * AI-84: 给出打破僵局的事件提示（用于 AI / UI 显示）。
 * - 不修改任何状态，仅生成提示
 */
export function resolveStalemateBreak(
  character: CharacterState,
  opponent?: { name?: string },
): { event: string; hint: string; suggestedAction: string } {
  const oppName = opponent?.name || '对手';
  const realm = character?.realm || 'qi_refining';
  const choices = [
    { event: `${oppName}似要变招`, hint: '诱敌露绽，激其先动', suggestedAction: 'cunning' },
    { event: `战局胶着`, hint: '行险一击，打破僵持', suggestedAction: 'aggressive' },
    { event: `气息流转渐慢`, hint: '退半步聚气再发', suggestedAction: 'defensive' },
  ];
  // 用 realm 字符串做简单哈希选择
  const idx = Math.abs(Array.from(realm).reduce((a, c) => a + c.charCodeAt(0), 0)) % choices.length;
  return choices[idx];
}

// ==================== AI-85: Combat Combo Chain ====================

/**
 * AI-85: 根据近 N 回合的命中记录推导当前连击链。
 * - 命中 → 连击 +1
 * - 失手 / 间隔超过 expiresTurn → 断连
 */
export function deriveComboChain(actionHistory: Array<{
  round: number;
  hit?: boolean;
  skillName?: string;
}>): ComboChain | null {
  if (!Array.isArray(actionHistory) || actionHistory.length === 0) return null;
  // 仅看命中且按 round 倒推
  const sorted = [...actionHistory].sort((a, b) => (b.round || 0) - (a.round || 0));
  let hits = 0;
  let lastRound = -1;
  const names: string[] = [];
  for (const a of sorted) {
    if (!a.hit) break;
    if (lastRound >= 0 && (lastRound - (a.round || 0)) > 1) break;
    hits += 1;
    lastRound = a.round || 0;
    if (a.skillName) names.push(a.skillName);
  }
  if (hits < 2) return null;
  const multiplier = 1 + (hits - 1) * 0.15;
  const comboName = hits >= 5 ? `${names[0] || '连'}·${hits}连` : hits >= 3 ? `${hits}连击` : '小连击';
  return {
    comboName,
    hits,
    multiplier: Math.min(2.5, Math.round(multiplier * 100) / 100),
    expiresTurn: (lastRound + 1),
  };
}

/**
 * AI-85: 结算连击加成后的最终伤害（保留整数下限）。
 */
export function resolveComboDamage(baseDamage: number, combo: ComboChain | null): { finalDamage: number; multiplier: number } {
  const base = Math.max(0, Math.floor(baseDamage || 0));
  if (!combo || combo.hits < 2) return { finalDamage: base, multiplier: 1 };
  const m = Math.max(1, combo.multiplier || 1);
  return { finalDamage: Math.max(1, Math.floor(base * m)), multiplier: m };
}


// ==================== AI-91~AI-103 Derived Functions ====================
// Worker A (xiaoxin-A) - additive only. New derived/state-less helpers.
// Do NOT touch state-machine cores (processYear / advanceYear / combat main flow).

// ===== AI-91: Combat Log =====
/**
 * 净化一条战斗日志：把机制词、数字等系统层信息剥离，保留叙事正文。
 * 系统层（如"你受到 3 点伤害"）→ 保留为 isSystem=true，不删字。
 * 叙事层 → 走 narrator 兜底，正常显示。
 */
export function sanitizeCombatLog(entry: CombatLogEntry): { text: string; isSystem: boolean } {
  if (!entry || typeof entry.text !== 'string') {
    return { text: '', isSystem: true };
  }
  // 已经被标记的条目直接返回；剥离零宽 / 控制字符
  const cleaned = entry.text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  return { text: cleaned, isSystem: !!entry.isSystem };
}

/**
 * 将一连串战斗日志折叠成一段小说化叙述。
 * 系统条目直接以括注形式嵌入正文；叙事条目作为叙事主体。
 */
export function novelizeCombatLog(log: CombatLogEntry[]): string {
  if (!Array.isArray(log) || log.length === 0) return '';
  const narrativeParts: string[] = [];
  const systemParts: string[] = [];
  for (const e of log) {
    const s = sanitizeCombatLog(e);
    if (!s.text) continue;
    if (s.isSystem) {
      systemParts.push(s.text);
    } else {
      narrativeParts.push(s.text);
    }
  }
  const body = narrativeParts.join('');
  if (systemParts.length === 0) return body;
  // 系统信息以括注形式追加，避免打断正文
  const sys = systemParts.length === 1 ? systemParts[0] : systemParts.join('；');
  return body ? `${body}（${sys}）` : `（${sys}）`;
}

// ===== AI-92: Loot AI =====
/**
 * 从对手身上按 realm 等级推一组基础掉落（不应用 conditions）。
 * 高境界对手产出更稀有的物品；返回的物品名已经清掉敌人归属前缀。
 */
export function deriveLootFromOpponent(opponent: { id?: string; name?: string; realm?: string; level?: number }, realm: Realm): ItemEntry[] {
  const oppLevel = Math.max(0, Math.floor(opponent?.level ?? 1));
  const realmOrder: Realm[] = ['mortal','qi_refining','foundation','golden_core','nascent_soul','soul_formation','tribulation','ascension'];
  const idx = Math.max(0, realmOrder.indexOf(realm));
  const baseRarity = idx >= 5 ? 'rare' : idx >= 3 ? 'uncommon' : 'common';
  const spiritStones = 5 + idx * 8 + oppLevel * 2;
  // 不在 ItemEntry 内放 enemy 归属，只输出器物本名
  const loot: ItemEntry[] = [
    {
      id: `loot-spirit-${opponent?.id ?? 'enemy'}-${idx}`,
      name: `灵材残片（${baseRarity === 'rare' ? '珍' : baseRarity === 'uncommon' ? '异' : '凡'}）`,
      description: '从败敌遗物中拾得的零散灵材。',
      item_type: 'material',
      rarity: baseRarity as ItemEntry['rarity'],
      effects: [],
      source: '战利品',
    },
    {
      id: `loot-stash-${opponent?.id ?? 'enemy'}-${idx}`,
      name: `散碎灵石袋`,
      description: '装有数枚灵石的旧布袋。',
      item_type: 'tool',
      rarity: 'common',
      effects: [],
      source: '战利品',
    },
  ];
  return loot;
}

/**
 * 把 loot 表的 conditions 全部跑一遍，过滤掉未通过的项目，
 * 并把随机概率不足的条目按 chance 字段决定是否落入。
 * 返回的物品已经是经过 character 校验的最终掉落物。
 */
export function resolveLootConditions(loot: LootTable, character: CharacterState): ItemEntry[] {
  if (!loot || !Array.isArray(loot.items)) return [];
  const allowed: ItemEntry[] = [];
  const condList = Array.isArray(loot.conditions) ? loot.conditions : [];
  for (const item of loot.items) {
    let pass = true;
    for (const cond of condList) {
      if (!pass) break;
      if (!cond) continue;
      switch (cond.kind) {
        case 'min_realm':
          pass = cond.realm ? character.realm === cond.realm : true;
          break;
        case 'min_level':
          pass = (character.realmLevel ?? 0) >= (cond.minLevel ?? 0);
          break;
        case 'has_status':
          pass = Array.isArray(character.statuses) && character.statuses.some(s => s && s.id === cond.statusId);
          break;
        case 'has_tag':
          pass = Array.isArray((character as any).tags) && (character as any).tags.includes(cond.tag);
          break;
        case 'faction':
          pass = character.faction === cond.faction;
          break;
        case 'spirit_stones':
          pass = (character.spiritStones ?? 0) >= (cond.minStones ?? 0);
          break;
        case 'random': {
          const chance = typeof cond.chance === 'number' ? Math.max(0, Math.min(1, cond.chance)) : 1;
          if (chance < 1) {
            // 确定性派生：不真正随机，使用角色 id 哈希作伪随机种子
            const seed = (character.id ?? '').length + item.id.length + (item.rarity?.length ?? 0);
            const roll = ((seed * 9301 + 49297) % 233280) / 233280;
            pass = roll <= chance;
          }
          break;
        }
        default:
          pass = true;
      }
    }
    if (pass) allowed.push(item);
  }
  return allowed;
}

// ===== AI-93: Status Expiry =====
/**
 * 推算某状态在当前 age 下的过期年龄。
 * - rule='turns' / 没有 rule → 返回 null（按回合数走战斗 tick）
 * - rule='years' → 返回 startAge + remaining
 * - rule='condition' / 'event' → 返回 null（条件触发，不预测）
 */
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
const PET_PATH_KEYWORDS: Record<PetCultivationPath, string[]> = {
  combat:   ['锋','锐','猛','破','噬','猎','爪','牙','杀'],
  assist:   ['护','养','愈','柔','伴','庇','医','灵'],
  transform:['化形','蜕变','人形','九尾','蛟龙','仙鹤','凤'],
  contract: ['心','契','羁','念','魂','约'],
};

/**
 * 根据灵宠名/描述/类型，推荐一条修行路径。
 * 命中关键字的关键词数最多者胜出；平局时按 combat > assist > transform > contract 优先级。
 */
export function derivePetCultivationSuggestion(pet: { name?: string; description?: string; type?: string } | null | undefined, _character: CharacterState): PetCultivationPath {
  if (!pet) return 'combat';
  const text = `${pet.name ?? ''} ${pet.description ?? ''} ${pet.type ?? ''}`;
  const scores: Record<PetCultivationPath, number> = { combat: 0, assist: 0, transform: 0, contract: 0 };
  (Object.keys(PET_PATH_KEYWORDS) as PetCultivationPath[]).forEach(k => {
    for (const kw of PET_PATH_KEYWORDS[k]) {
      if (text.includes(kw)) scores[k] += 1;
    }
  });
  const order: PetCultivationPath[] = ['combat','assist','transform','contract'];
  let best: PetCultivationPath = 'combat';
  let bestScore = -1;
  for (const k of order) {
    if (scores[k] > bestScore) { bestScore = scores[k]; best = k; }
  }
  return best;
}

/**
 * 学习一个新技能到灵宠身上：检查技能是否与已有 skill 重复，并返回新灵宠对象。
 * 重复时返回原 pet（不重复登记），并通过 throw 提示。
 */
export function resolvePetSkillLearn<T extends { skill: { name: string; power: number; cooldown: number } }>(pet: T, skill: { name: string; power: number; cooldown: number; description?: string }): T {
  if (!pet || !skill || !skill.name) return pet;
  if (pet.skill && pet.skill.name === skill.name) return pet;
  return {
    ...pet,
    skill: {
      name: skill.name,
      description: skill.description ?? pet.skill?.description ?? '',
      power: typeof skill.power === 'number' ? skill.power : (pet.skill?.power ?? 1),
      cooldown: typeof skill.cooldown === 'number' ? skill.cooldown : (pet.skill?.cooldown ?? 0),
    },
  };
}

// ===== AI-96: Pill Recipe =====
/**
 * 给定丹方和角色，推算是否已解锁 + 还缺什么。
 */
export function deriveRecipeUnlock(recipe: PillRecipe, character: CharacterState): { unlocked: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!recipe) return { unlocked: false, missing: ['no_recipe'] };
  // 境界下限
  const realmOrder: Realm[] = ['mortal','qi_refining','foundation','golden_core','nascent_soul','soul_formation','tribulation','ascension'];
  const curIdx = realmOrder.indexOf(character.realm);
  if (curIdx < recipe.minRealmIdx) missing.push(`min_realm:${recipe.minRealmIdx}`);
  // 材料齐备性：character.inventory 中按 item id 统计
  const inv = Array.isArray(character.inventory) ? character.inventory : [];
  for (const matId of recipe.requiredMaterials) {
    const has = inv.some(i => i && i.id === matId);
    if (!has) missing.push(`material:${matId}`);
  }
  return { unlocked: missing.length === 0, missing };
}

/**
 * 给定丹方 + 材料齐备性，模拟炼丹结果：
 * - 成功 → 返回成功 PillCraftResult（含 ItemEntry）
 * - 失败 → 返回失败 + 副作用（随机触发 sideEffect）
 */
export function resolvePillCrafting(recipe: PillRecipe, materials: { id: string; quantity?: number }[]): PillCraftResult {
  if (!recipe) return { success: false, narrativeHint: '丹方无效。' };
  const haveIds = new Set(materials.map(m => m.id));
  const missing = recipe.requiredMaterials.filter(id => !haveIds.has(id));
  if (missing.length > 0) {
    return { success: false, narrativeHint: `材料不足：${missing.join('、')}` };
  }
  // 简化确定性：稀有度越高越容易出副作用
  const rarityScore: Record<string, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
  const score = rarityScore[recipe.rarity] ?? 1;
  const seed = (recipe.id.length + score) * 13;
  const roll = ((seed * 9301 + 49297) % 233280) / 233280;
  const sideEffectRoll = ((seed * 1664525 + 1013904223) % 233280) / 233280;
  if (roll < 0.18) {
    const sideEffect: StatusEntry = {
      id: `pill-side-${recipe.id}`,
      name: '丹毒内蕴',
      description: '服丹后残留的毒性，需静坐化解。',
      category: 'debuff',
      rarity: 'common',
      duration: 3,
      source: `丹药副作用（${recipe.name}）`,
      effects: [],
    };
    return { success: false, sideEffect, narrativeHint: '炉火失衡，丹未成形。' };
  }
  const pill: ItemEntry = {
    id: `pill-${recipe.id}`,
    name: recipe.name,
    description: recipe.description,
    item_type: 'consumable',
    rarity: recipe.rarity,
    effects: [],
    source: '炼制所得',
  };
  return {
    success: true,
    pill,
    sideEffect: sideEffectRoll > 0.85 ? {
      id: `pill-mild-side-${recipe.id}`,
      name: '丹气翻涌',
      description: '服丹后气血略有翻涌。',
      category: 'debuff',
      rarity: 'common',
      duration: 1,
      source: `丹药副作用（${recipe.name}）`,
      effects: [],
    } : undefined,
    narrativeHint: '炉火稳定，丹香溢出。',
  };
}

// ===== AI-97: Formation Stack =====
/**
 * 把同一区域内的多个阵法合并成单条 stackResult。
 * - independent: 总加成 = sum(values)
 * - boosted:     同源阵法叠加增强（multiplier = 1 + 0.25 * (count-1)）
 * - conflict:    同源阵法互相削弱（penalty = 0.7 per additional）
 * - replace:     选效果最高的，覆盖其余
 */
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
export function deriveThreadChain(threadId: string, allThreads: PendingThread[]): ThreadChainNode[] {
  if (!Array.isArray(allThreads) || allThreads.length === 0 || !threadId) return [];
  const map = new Map<string, PendingThread>();
  for (const t of allThreads) if (t && t.id) map.set(t.id, t);
  const chain: PendingThread[] = [];
  let cur = map.get(threadId);
  const visited = new Set<string>();
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    chain.unshift(cur);
    const parentId = (cur as any).parentThreadId as string | undefined;
    cur = parentId ? map.get(parentId) : undefined;
  }
  return chain.map((t, i) => ({
    threadId: t.id,
    parentThreadId: (t as any).parentThreadId,
    depth: i,
    generation: i,
    title: t.title,
    category: t.category,
  }));
}

/**
 * 给定一组已存在线索 + 角色状态，决定是否开新线或关闭旧线。
 * - 当任意线索 progress >= 100 → close
 * - 当 urgency > 70 且未到期 → 新开一条 urgent
 */
export function resolveThreadContinuation(threads: PendingThread[], character: CharacterState): { newThread: PendingThread | null; closeThreadIds: string[] } {
  const closeThreadIds: string[] = [];
  for (const t of threads || []) {
    if (!t) continue;
    if ((t.progress ?? 0) >= 100 || t.status === 'resolved') closeThreadIds.push(t.id);
  }
  let newThread: PendingThread | null = null;
  const urgent = (threads || []).find(t => t && t.status === 'urgent');
  if (!urgent && character.alive) {
    newThread = {
      id: `thread-${character.id}-${(character.age ?? 0)}-${Math.floor(((character.age ?? 0) * 17 + (threads?.length ?? 0) * 31) % 9999)}`,
      title: '新的因果纠缠',
      description: '因角色年岁推进，新的一段因果正在酝酿。',
      category: 'mystery',
      startAge: character.age ?? 0,
      deadlineAge: (character.age ?? 0) + 5,
      status: 'pending',
      progress: 0,
    };
  }
  return { newThread, closeThreadIds };
}

// ===== AI-100: Special Physiques =====
/**
 * 瓶灵效果：若角色有 bottleSpirit 字段，则返回一个受其影响的 status；
 * 否则返回 null（不影响角色）。
 */
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

const SWORD_ORDER: SwordAptitude[] = ['untrained','novice','adept','master'];

/**
 * 根据角色练习剑法时长推进剑道资质。
 */
export function deriveSwordAptitudeProgress(character: CharacterState, practice: { hours?: number; talent?: number }): SwordAptitude {
  const cur = ((character as any).swordAptitude as SwordAptitude | undefined) ?? 'untrained';
  const hours = Math.max(0, practice?.hours ?? 0);
  const talent = Math.max(0.1, Math.min(3, practice?.talent ?? 1));
  const inc = hours * talent / 100;
  const curIdx = SWORD_ORDER.indexOf(cur);
  if (curIdx < 0) return 'untrained';
  // 每跨一阶需要累计 100 inc
  const totalAcc = ((character as any).swordPracticeAcc as number | undefined) ?? 0;
  const next = totalAcc + inc;
  let newIdx = curIdx;
  while (newIdx < SWORD_ORDER.length - 1 && newIdx < curIdx + Math.floor(next / 100)) newIdx += 1;
  return SWORD_ORDER[Math.min(SWORD_ORDER.length - 1, newIdx)];
}

/**
 * 给定角色当前 HP / 受到的伤害 / 假死规则，决定是否进入假死以及揭示率。
 */
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

import type {
  SecretRealmTriggerCondition,
  SecretRealmEntryAttempt,
  BidderArchetype,
  BidderBehaviorProfile,
  CombatCauseChain,
  StalemateExit,
} from './types';

import type {
  InheritanceKind,
  InheritanceRecipient,
  InheritanceClaim,
  InheritanceChain,
  InheritancePool,
} from './types';
type _PhaseGReexport =
  | SecretRealmTriggerCondition
  | SecretRealmEntryAttempt
  | BidderArchetype
  | BidderBehaviorProfile
  | CombatCauseChain
  | StalemateExit;
const _phaseGAnchor: _PhaseGReexport | null = null;
void _phaseGAnchor;

/**
 * AI-G111: Evaluate whether character can attempt to enter a SecretRealm.
 * Reads realm.entryRequirement + entryAlternatives; scans character.inventory + statuses.
 * Returns triggers[], missing[], bypassOptions[], and canAttempt flag.
 */
export function deriveSecretRealmAccess(
  realm: SecretRealm,
  character: {
    id?: string;
    age?: number;
    realm?: string;
    inventory?: Array<{ id?: string; name?: string; item_type?: string; description?: string }>;
    statuses?: Array<{ id?: string; name?: string; category?: string }>;
  },
): SecretRealmEntryAttempt {
  const triggers: SecretRealmTriggerCondition[] = [];
  const missing: SecretRealmTriggerCondition[] = [];
  const bypassOptions: string[] = [];
  if (!realm || !character) {
    return {
      realmId: realm?.id ?? '',
      triggers,
      missing: ['key-item', 'map-fragment', 'qi-tide', 'inheritance-token', 'time-window'],
      bypassOptions,
      canAttempt: false,
    };
  }
  const inventory = Array.isArray(character.inventory) ? character.inventory : [];
  const statuses = Array.isArray(character.statuses) ? character.statuses : [];
  const realmName = realm.name ?? '';
  const req = realm.entryRequirement ?? '';
  const alt = Array.isArray(realm.entryAlternatives) ? realm.entryAlternatives.join(' ') : '';
  const nameBlob = `${req} ${alt}`;
  const wantsKeyItem = /钥匙|令牌|残章|信物|key|token/i.test(nameBlob);
  const wantsMapFragment = /碎片|map|残图|地图碎片/i.test(nameBlob);
  const wantsInheritance = /传承|衣钵|inheritance|前任主人|遗物/i.test(nameBlob);

  // key-item
  if (wantsKeyItem) {
    const hasKey = inventory.some(
      (it) =>
        it &&
        (/钥匙|令牌|残章/.test(it.name ?? '') || /钥匙|令牌|残章/.test(it.description ?? '')),
    );
    if (hasKey) triggers.push('key-item');
    else missing.push('key-item');
  }
  // map-fragment
  if (wantsMapFragment) {
    const fragments = inventory.filter((it) => it && /碎片|残图/.test(it.name ?? ''));
    if (fragments.length >= 2) triggers.push('map-fragment');
    else missing.push('map-fragment');
  }
  // qi-tide
  const qiTideOpen = statuses.some(
    (s) => s && (s.id === 'qi_tide_open' || /气潮|灵气潮/.test(s.name ?? '')),
  );
  if (qiTideOpen) triggers.push('qi-tide');
  else if (!wantsKeyItem && !wantsMapFragment && !wantsInheritance) missing.push('qi-tide');
  // inheritance-token
  if (wantsInheritance) {
    const hasToken = inventory.some(
      (it) =>
        it &&
        (/传承|衣钵|信物/.test(it.name ?? '') || /传承|衣钵|信物/.test(it.description ?? '')),
    );
    if (hasToken) triggers.push('inheritance-token');
    else missing.push('inheritance-token');
  }
  // time-window
  if (!realm.isStoryRealm) {
    const age = typeof character.age === 'number' ? character.age : 0;
    if (age >= realm.minAge) triggers.push('time-window');
    else missing.push('time-window');
  }

  // bypass: alternatives whose first 2 chars overlap with an inventory item name
  if (Array.isArray(realm.entryAlternatives)) {
    for (const a of realm.entryAlternatives) {
      const altLower = a.toLowerCase();
      const matched = inventory.some(
        (it) => it && it.name && altLower.includes(it.name.toLowerCase().slice(0, 2)),
      );
      if (matched) bypassOptions.push(a);
    }
  }

  const canAttempt = missing.length === 0 || bypassOptions.length > 0;
  return { realmId: realm.id, triggers, missing, bypassOptions, canAttempt };
}

/**
 * AI-G112: Resolve a SecretRealm entry attempt given player choice.
 * choice: 'first' (use first trigger), 'best' (highest-priority trigger),
 *         'bypass' (use a bypass option if available).
 */
export function resolveSecretRealmEntry(
  attempt: SecretRealmEntryAttempt,
  choice: 'first' | 'best' | 'bypass',
): { entered: boolean; sideEffect: string; narrativeHint: string } {
  if (!attempt)
    return { entered: false, sideEffect: 'attempt 缺失', narrativeHint: '秘境尝试无效' };
  if (!attempt.canAttempt) {
    return {
      entered: false,
      sideEffect: `缺少触发条件：${attempt.missing.join(' / ')}`,
      narrativeHint: `你尚未备齐进入秘境所需之物：${attempt.missing.join('、')}；可尝试寻找${attempt.bypassOptions.join('、') || '其他通路'}。`,
    };
  }
  const triggers = attempt.triggers.length > 0 ? attempt.triggers : (['key-item'] as SecretRealmTriggerCondition[]);
  let chosen: SecretRealmTriggerCondition = triggers[0];
  if (choice === 'best') {
    const priority: SecretRealmTriggerCondition[] = [
      'inheritance-token',
      'map-fragment',
      'key-item',
      'qi-tide',
      'time-window',
    ];
    chosen = priority.find((t) => triggers.includes(t)) ?? triggers[0];
  } else if (choice === 'bypass') {
    if (attempt.bypassOptions.length === 0) {
      return { entered: false, sideEffect: '无可绕开通路', narrativeHint: '此秘境并无备用通路。' };
    }
    return {
      entered: true,
      sideEffect: '旁门捷径消耗部分灵力',
      narrativeHint: `你借${attempt.bypassOptions[0]}绕开主禁制，悄悄入内。`,
    };
  }

  const sideEffects: Record<SecretRealmTriggerCondition, string> = {
    'key-item': '令牌微微发热，未见异状',
    'map-fragment': '地图碎片共鸣，指明前路',
    'qi-tide': '气潮涌入经脉，略有鼓胀',
    'inheritance-token': '前人遗韵一缕，识海微震',
    'time-window': '时辰契合，门户轻启',
  };
  const narrativeHints: Record<SecretRealmTriggerCondition, string> = {
    'key-item': `你持${chosen}扣响秘境之门，禁制应声而开。`,
    'map-fragment': `碎片拼合后显现光纹，你循光步入${attempt.realmId}。`,
    'qi-tide': '恰逢气潮涌动，你借灵气潮汐推门而入。',
    'inheritance-token': '传承信物泛起柔和光泽，秘境仿佛认出了来人。',
    'time-window': '正是时辰之窗，秘境禁制暂歇。',
  };
  return {
    entered: true,
    sideEffect: sideEffects[chosen],
    narrativeHint: narrativeHints[chosen],
  };
}

/**
 * AI-G113: Derive a richer BidderBehaviorProfile from a bidder + item context.
 * Expands the 4-type BidderPersonality into 5 BidderArchetypes with wealth & hostility.
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
export function buildCombatCauseChain(
  action: { kind: string; name?: string; resource?: string; cost?: number },
  character?: { realm?: string; realmLevel?: number; element?: string },
): CombatCauseChain {
  const kind = action?.kind ?? 'strike';
  const name = action?.name ?? '基础出招';
  const trigger = `${character?.realm ?? 'qi_refining'}修士催动「${name}」，灵力贯于指尖。`;
  let opponentResponse = '对手被迫后退半步，勉强稳住身形。';
  let environmentalEffect = '周围气流被牵动，沙石簌簌作响。';
  switch (kind) {
    case 'spell':
      opponentResponse = '对手识得此术法来源，急运护身灵气相抗。';
      environmentalEffect = '天地灵气被抽引，向此处汇聚。';
      break;
    case 'formation':
      opponentResponse = '对手发现脚下灵气纹路，欲抽身已是不及。';
      environmentalEffect = '地脉灵纹亮起，方圆十丈内灵气被锁。';
      break;
    case 'flee':
      opponentResponse = '对手见你退意，冷笑一声，并不追击。';
      environmentalEffect = '风压顿减，远方隐约传来兽鸣。';
      break;
    case 'deception':
      opponentResponse = '对手被假动作所惑，重心前倾。';
      environmentalEffect = '足下尘土扬起，掩去真身。';
      break;
    case 'ally':
      opponentResponse = '对手环顾左右，神色骤变。';
      environmentalEffect = '远处同门气息骤然逼近。';
      break;
    case 'artifact':
      opponentResponse = '法宝灵光一照，对手气血翻涌。';
      environmentalEffect = '灵器共振，震荡四方。';
      break;
    default:
      opponentResponse = '对手抬手硬接一招，指尖发麻。';
      environmentalEffect = '脚下石板龟裂，碎屑纷飞。';
  }
  return { action: name, trigger, opponentResponse, environmentalEffect };
}

/**
 * AI-G116: Resolve a combat stalemate exit strategy.
 * Considers allies, terrain tags, opponent HP, and turn count.
 */
export function resolveStalemateExit(
  session: {
    turnCount: number;
    opponents?: Array<{ name?: string; hp?: number }>;
    environmentTags?: string[];
  } | null | undefined,
  character: { id?: string; realm?: string; realmLevel?: number; faction?: string; allies?: string[] } | null | undefined,
): StalemateExit {
  const turn = session?.turnCount ?? 0;
  const allies = Array.isArray(character?.allies) ? character.allies : [];
  const tags = Array.isArray(session?.environmentTags) ? session.environmentTags : [];
  const oppHpLow =
    Array.isArray(session?.opponents) &&
    session.opponents.some((o) => typeof o.hp === 'number' && o.hp < 30);
  if (allies.length > 0 && turn > 3) return 'ally-intervention';
  if (tags.includes('mountain') || tags.includes('forest') || tags.includes('river'))
    return 'terrain-shift';
  if (oppHpLow) return 'risky-strike';
  if (turn >= 8) return 'disengage';
  return 'deception';
}


// ============================================================================
// Worker C (phase-h-p2-mid): 完整世界地图与世界地点 —— 引擎层
// ============================================================================
// 5 个导出函数：
//   - buildEmptyWorldMap()           -> WorldMap                    空地图骨架
//   - discoverLocation(map,id,age)   -> WorldMap                    标记一处地点为已发现
//   - deriveTravelFeasibility(route, character) -> { feasible, reason, alternativeRoutes }
//   - generateRandomEncounter(route, character, rand?) -> { type, description, effects }
//   - summarizeWorldForPrompt(map, charLimit) -> string              AI prompt 摘要
//
// 设计约束：
// - 不依赖 store.ts / UI / DB；
// - 只接受 map / route / character 的最小契约；character 类型为局部 interface。
// - generateRandomEncounter 的 rand 参数允许注入随机源，便于 smoke / 测试。
// ============================================================================

/**
 * Worker C 引擎层使用的角色最小契约（不引入 CharacterState 全量字段，避免循环依赖）。
 * 任何传入的角色对象只要满足这个子集即可。
 */
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
interface WorkerCNodeLike {
  id: string;
  name: string;
  region?: WorldRegion;
  tier?: RegionTier;
  dangerLevel?: number;
  spiritualDensity?: number;
  resources?: string[];
  controllingFaction?: string;
  hiddenEntrance?: boolean;
}

interface WorkerCRouteLike {
  from: string;
  to: string;
  distanceDays: number;
  dangerLevel: number;
  requiredRealm: string;
  hiddenRequirements?: string[];
}

interface WorkerCMapLike {
  nodes: WorkerCNodeLike[];
  routes: WorkerCRouteLike[];
  currentLocationId: string;
  discoveredLocationIds: string[];
}

/**
 * 境界排序常量（与 types.ts REALMS 同序；避免 import 顺序问题，这里硬编码为同序）。
 * mortal=0 < qi_refining=1 < foundation_building=2 < golden_core=3 < nascent_soul=4
 * < spirit_severing=5 < tribulation=6 < immortal_ascension=7
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
export function buildEmptySectGraph(): SectRelationGraph {
  return {
    nodes: [],
    edges: [],
    lastUpdatedAge: 0,
    currentAge: 0,
  };
}

/**
 * AI-H301 addSectNode
 * 不可变地往图中追加一个宗门节点（同 id 视为覆盖）。
 * 返回新 graph；不修改入参 graph。
 */
export function addSectNode(
  graph: SectRelationGraph,
  node: SectNode,
): SectRelationGraph {
  const base: SectRelationGraph = graph || buildEmptySectGraph();
  const existing = Array.isArray(base.nodes) ? base.nodes : [];
  const nextNodes: SectNode[] = [];
  let replaced = false;
  for (const n of existing) {
    if (n && n.id === node.id) {
      nextNodes.push({ ...node });
      replaced = true;
    } else {
      nextNodes.push(n);
    }
  }
  if (!replaced) nextNodes.push({ ...node });
  return {
    ...base,
    nodes: nextNodes,
    lastUpdatedAge: typeof base.currentAge === 'number' ? base.currentAge : base.lastUpdatedAge,
  };
}

/**
 * AI-H302 setSectRelation
 * 不可变地重写 from -> to 关系；若不存在则追加。
 * intensity 被 clamp 到 [0, 1]；narrativeNote 缺失则补默认提示。
 */
export function setSectRelation(
  graph: SectRelationGraph,
  from: string,
  to: string,
  relation: SectRelation,
  intensity: number,
): SectRelationGraph {
  const base: SectRelationGraph = graph || buildEmptySectGraph();
  const existing = Array.isArray(base.edges) ? base.edges : [];
  const clamp = (v: unknown): number => {
    const n = typeof v === 'number' && isFinite(v) ? v : 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  };
  const safeIntensity = clamp(intensity);
  const sinceAge = typeof base.currentAge === 'number' ? base.currentAge : 0;
  const newEdge: SectRelationEdge = {
    from,
    to,
    relation,
    intensity: safeIntensity,
    sinceAge,
    narrativeNote: '',
  };
  const nextEdges: SectRelationEdge[] = [];
  let replaced = false;
  for (const e of existing) {
    if (e && e.from === from && e.to === to) {
      nextEdges.push({ ...newEdge, narrativeNote: e.narrativeNote || '' });
      replaced = true;
    } else {
      nextEdges.push(e);
    }
  }
  if (!replaced) nextEdges.push(newEdge);
  return {
    ...base,
    edges: nextEdges,
    lastUpdatedAge: sinceAge,
  };
}

/**
 * AI-H303 derivePlayerSectAffinity
 * 根据角色当前状态 + 关系图推导其宗门阵营亲缘度（-1..1 含义的 affinity 数值，0=中立）。
 *
 * 推导规则（按优先级叠加，单项裁剪到 [-1, 1]）：
 *   1. character.faction 直接匹配图中的 SectNode.alignment  → 基础 +0.6
 *   2. character.master 与某 node.currentLeader 文本相同 → +0.2
 *   3. character.reputation > 60 且在 'wandering-cultivator'/'merchant-guild'
 *      中任一出现 → +0.1
 *   4. 否则 → 'wandering-cultivator'，基础 0
 *   5. 与 edges 中 aligned 节点存在 ally/wary-respect 关系 → 每条 +0.1
 *      与 aligned 节点存在 enemy/rival 关系 → 每条 -0.1
 *
 * 输出：
 *   - aligned: 推得的 SectFaction
 *   - affinity: -1..1，clamp 之后
 *   - reason: 一句话解释（世界内口吻）
 */
export function derivePlayerSectAffinity(
  character: { faction?: string; master?: string; reputation?: number; realm?: string; realmLevel?: number } | null | undefined,
  graph: SectRelationGraph,
): { aligned: SectFaction; affinity: number; reason: string } {
  const base: SectRelationGraph = graph || buildEmptySectGraph();
  const nodes = Array.isArray(base.nodes) ? base.nodes : [];
  const edges = Array.isArray(base.edges) ? base.edges : [];

  const charFaction = (character && typeof character.faction === 'string') ? character.faction : '';
  const charMaster = (character && typeof character.master === 'string') ? character.master : '';
  const charRep = (character && typeof character.reputation === 'number') ? character.reputation : 0;

  // 1. 直接匹配 alignment
  let aligned: SectFaction = 'wandering-cultivator';
  let affinity = 0;
  let reasonParts: string[] = [];

  if (charFaction) {
    for (const n of nodes) {
      if (n && n.alignment === charFaction) {
        aligned = n.alignment;
        affinity = 0.6;
        reasonParts.push('出身宗门 ' + n.name);
        break;
      }
    }
    if (affinity === 0) {
      // faction 字符串与任何 alignment 都对不上，仍按字符串原样识别（保持向后兼容）
      // 但只接受 SectFaction 字面量
      const validFactions: SectFaction[] = [
        'qingyun-pavilion', 'blood-saber-sect', 'heavenly-talisman-sect',
        'ten-thousand-sword-sect', 'wandering-cultivator', 'demonic-ways',
        'royal-court', 'merchant-guild',
      ];
      if ((validFactions as string[]).includes(charFaction)) {
        aligned = charFaction as SectFaction;
        affinity = 0.3;
        reasonParts.push('虽无宗门背书，已属 ' + charFaction);
      } else {
        reasonParts.push('尚未归属明确宗门');
      }
    }
  } else {
    reasonParts.push('尚未归属明确宗门');
  }

  // 2. master 匹配 currentLeader
  if (charMaster) {
    for (const n of nodes) {
      if (n && n.currentLeader && n.currentLeader === charMaster) {
        affinity += 0.2;
        reasonParts.push('师从 ' + n.name + ' 当家');
        break;
      }
    }
  }

  // 3. 高名望散修 / 商盟微弱加成
  if (
    charRep > 60 &&
    (aligned === 'wandering-cultivator' || aligned === 'merchant-guild')
  ) {
    affinity += 0.1;
    reasonParts.push('名望颇高，' + aligned + ' 之辈亦另眼相看');
  }

  // 4. 关系图加权
  const alignedNodeIds = new Set<string>();
  for (const n of nodes) {
    if (n && n.alignment === aligned) alignedNodeIds.add(n.id);
  }
  for (const e of edges) {
    if (!e || !e.from || !e.to) continue;
    const fromAligned = alignedNodeIds.has(e.from);
    const toAligned = alignedNodeIds.has(e.to);
    if (!fromAligned && !toAligned) continue;
    const w = typeof e.intensity === 'number' ? Math.max(0, Math.min(1, e.intensity)) : 0;
    if (e.relation === 'ally' || e.relation === 'wary-respect') {
      affinity += 0.1 * w;
    } else if (e.relation === 'enemy' || e.relation === 'rival') {
      affinity -= 0.1 * w;
    }
  }

  // clamp
  if (affinity > 1) affinity = 1;
  if (affinity < -1) affinity = -1;

  const reason = reasonParts.length > 0 ? reasonParts.join('；') : '尚未与任何宗门发生瓜葛';
  return { aligned, affinity, reason };
}

/**
 * AI-H304 queryRelationsTowards
 * 返回所有指向 target 的关系边（from -> target 方向）。
 * edges 为空或 target 未命中时返回空数组。
 */
export function queryRelationsTowards(
  graph: SectRelationGraph,
  target: string,
): SectRelationEdge[] {
  const base: SectRelationGraph = graph || buildEmptySectGraph();
  const edges = Array.isArray(base.edges) ? base.edges : [];
  if (!target) return [];
  const out: SectRelationEdge[] = [];
  for (const e of edges) {
    if (e && e.to === target) out.push({ ...e });
  }
  return out;
}


// ==================== Phase-H Worker D: Crafting + Technique (additive) ====================

interface WorkerDCharacter {
  id?: string;
  name?: string;
  age?: number;
  realm?: string;
  realmLevel?: number;
  comprehension?: number;
  luck?: number;
  elements?: Partial<Record<ElementType, number>>;
  inventory?: ItemEntry[];
  activeStatuses?: Array<{ id?: string; name?: string; category?: string }>;
}

export function deriveCraftingEligibility(
  recipe: CraftingRecipe,
  character: WorkerDCharacter,
  inventory: ItemEntry[],
): { eligible: boolean; missing: string[]; alternatives: string[] } {
  const missing: string[] = [];
  const alternatives: string[] = [];
  const inv = Array.isArray(inventory) ? inventory : [];
  const recipeMats = Array.isArray(recipe?.materials) ? recipe.materials : [];
  for (const m of recipeMats) {
    if (!inv.some((it) => it && it.id === m.id)) {
      missing.push(m.id);
      alternatives.push("先修行强化" + m.id + "相关功法");
    }
  }
  const charRealm = typeof character?.realmLevel === "number" ? character.realmLevel : 0;
  if (typeof recipe?.requiredRealm === "number" && charRealm < recipe.requiredRealm) {
    missing.push("realm:" + recipe.requiredRealm);
    alternatives.push("先提升境界至" + recipe.requiredRealm + "层");
  }
  return { eligible: missing.length === 0, missing, alternatives };
}

export function startCraftingSession(
  recipe: CraftingRecipe,
  character: WorkerDCharacter,
): CraftingSession {
  const startedAge = typeof character?.age === "number" ? character.age : 0;
  const materials = Array.isArray(recipe?.materials) ? recipe.materials.slice() : [];
  return {
    recipeId: recipe?.id ?? "unknown",
    startedAge,
    currentStep: 0,
    totalSteps: Math.max(1, materials.length + 1),
    materialsConsumed: [],
    attempts: 0,
    currentSuccess: 0,
  };
}

export function resolveCraftingStep(
  session: CraftingSession,
  character: WorkerDCharacter,
  rand?: () => number,
): { session: CraftingSession; result: CraftingResult | null; hint: string } {
  const r = typeof rand === "function" ? rand : Math.random;
  const nextStep = (session?.currentStep ?? 0) + 1;
  const recipeMats = Array.isArray(session?.materialsConsumed) ? session.materialsConsumed : [];
  const successChance = 0.5 + (typeof character?.comprehension === "number" ? character.comprehension : 50) / 200;
  const success = r() < successChance;
  const nextSession: CraftingSession = {
    ...session,
    currentStep: nextStep,
    attempts: (session?.attempts ?? 0) + 1,
    currentSuccess: (session?.currentSuccess ?? 0) + (success ? 1 : 0),
    materialsConsumed: success ? recipeMats.concat(["step-" + nextStep]) : recipeMats,
  };
  const result: CraftingResult = success
    ? {
        success: true,
        outputItems: [{ id: "crafted-" + session?.recipeId + "-" + nextStep, name: "成品", type: "consumable" }],
        consumedMaterials: [],
        sideEffects: null,
        attributeChanges: [],
        experienceGained: 10,
      }
    : {
        success: false,
        outputItems: [],
        consumedMaterials: [],
        sideEffects: null,
        attributeChanges: [],
        experienceGained: 1,
      };
  const hint = success ? "成色尚可，继续下一步" : "火候略偏，稳住心神";
  return { session: nextSession, result, hint };
}

export function deriveTechniqueProgress(
  technique: { id: string; name: string; element: string; requiredRealm: number },
  character: WorkerDCharacter,
  practice: { sessions: number; comprehensionEvents: unknown[]; breakthroughs: unknown[] },
): TechniqueStudy {
  const comp = typeof character?.comprehension === "number" ? character.comprehension : 50;
  const sessions = typeof practice?.sessions === "number" ? practice.sessions : 0;
  const events = Array.isArray(practice?.comprehensionEvents) ? practice.comprehensionEvents : [];
  const breakthroughs = Array.isArray(practice?.breakthroughs) ? practice.breakthroughs : [];
  const baseProgress = Math.min(1, sessions * 0.05);
  const compBoost = (comp - 50) / 500;
  const eventBoost = events.length * 0.02;
  const progress = Math.max(0, Math.min(1, baseProgress + compBoost + eventBoost));
  return {
    techniqueId: technique?.id ?? "unknown",
    currentProgress: progress,
    comprehensionEvents: events as TechniqueStudy["comprehensionEvents"],
    breakthroughs: breakthroughs as TechniqueStudy["breakthroughs"],
  };
}

export function resolveTechniqueBreakthrough(
  study: TechniqueStudy,
  character: WorkerDCharacter,
): { newProgress: number; breakthrough: boolean; sideEffect: CraftingSideEffect | null } {
  const progress = Math.max(0, Math.min(1, Number(study?.currentProgress ?? 0)));
  if (progress < 1) {
    return { newProgress: progress, breakthrough: false, sideEffect: null };
  }
  const comp = typeof character?.comprehension === "number" ? character.comprehension : 50;
  const luck = typeof character?.luck === "number" ? character.luck : 50;
  const risk = comp < 30 || luck < 20;
  const sideEffect: CraftingSideEffect | null = risk
    ? {
        kind: "qi-deviation",
        severity: 0.6,
        description: "突破时气海震荡，需闭关静养",
        expiresAfterDays: 7,
      }
    : {
        kind: "status",
        severity: 0.2,
        description: "突破后灵台清明，神识略有增益",
      };
  return { newProgress: 1, breakthrough: true, sideEffect };
}

// ==================== Phase-I Worker D: Ending Spectrum (additive) ====================
// 结局光谱：evaluate / select / apply / branch / summarize 五个引擎函数。
// 输入只接受本文件内的 WorkerDEndingCharacter / WorkerDEndingWorldState；
// 输出严格走 EndingCondition / EndingChoice / EndingOutcome / EndingPathMap 四个接口。

interface WorkerDEndingCharacter {
  id?: string;
  name?: string;
  age?: number;
  lifespan?: number;
  realm?: string;
  realmLevel?: number;
  alive?: boolean;
  ascended?: boolean;
  faction?: string;
  master?: string;
  causeOfDeath?: string;
  // 关键资源/因缘标记（用于 evaluate 判定）
  karmaTags?: string[];
  resources?: { spiritStones?: number; reputation?: number };
  // 继承人候选（如弟子 / 子嗣 / 道统传承者）
  heirCandidateIds?: string[];
}

interface WorkerDEndingWorldState {
  eraName?: string;
  worldStability?: number; // 0-1，<0.3 时 world-collapse 权重放大
  isDoomActive?: boolean;  // 是否处于天地崩劫
  factionState?: string;   // 宗门状态标签
  activeApocalypse?: boolean;
}

function clampUnit(n: number, fallback = 0): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function safeStringArray(input: unknown, max = 16): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const it of input) {
    if (typeof it === 'string' && it.length > 0) {
      out.push(it.length > 80 ? it.substring(0, 80) : it);
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * AI-I431 / evaluateEndingConditions:
 *   根据角色 + 世界状态，返回「当前可见/可达」的所有结局条件列表。
 *   - 强制附加 8 种正典结局（每种至少 1 个），世界崩劫/世界稳定度/宗门状态用于放大权重；
 *   - 列表按 weight 降序排列，便于 selectEndingPath 直接消费；
 *   - 不做任何随机抽样（确定性函数）。
 */
export function evaluateEndingConditions(
  character: WorkerDEndingCharacter,
  worldState?: WorkerDEndingWorldState,
): EndingCondition[] {
  const ws: WorkerDEndingWorldState = worldState || {};
  const karma = safeStringArray(character?.karmaTags, 32);
  const stability = clampUnit(typeof ws.worldStability === 'number' ? ws.worldStability : 0.7);
  const isDoom = !!ws.isDoomActive || !!ws.activeApocalypse;
  const hasKarma = (kw: string): boolean => karma.indexOf(kw) >= 0;

  const conds: EndingCondition[] = [];

  // 1. 飞升成仙（基础权重 0.15；灵根/道统/师承等标记可放大）
  let ascendWeight = 0.15;
  if (hasKarma('pure-root') || hasKarma('dao-lineage')) ascendWeight += 0.25;
  if (hasKarma('immortal-ally')) ascendWeight += 0.1;
  conds.push({
    id: 'cond-ascend-immortal',
    archetype: 'ascend-immortal',
    requirements: ['元婴以上境界', '渡过至少一次天劫', '宗门/道统护持'],
    weight: clampUnit(ascendWeight, 0.15),
    narrativePreview: '踏破雷劫，紫气东来，肉身飞升上界。',
  });

  // 2. 坐化（默认基线寿尽/伤重；老迈或道基受损时权重显著）
  let sitWeight = 0.25;
  if (typeof character?.age === 'number' && typeof character?.lifespan === 'number' && character.age >= character.lifespan * 0.9) sitWeight += 0.4;
  if (hasKarma('grave-injury') || hasKarma('broken-dao')) sitWeight += 0.2;
  conds.push({
    id: 'cond-sit-death',
    archetype: 'sit-death',
    requirements: ['寿元将尽', '重伤/道基受损', '未破开境界'],
    weight: clampUnit(sitWeight, 0.25),
    narrativePreview: '油尽灯枯，于洞府中安详坐化，留衣钵与残篇。',
  });

  // 3. 堕入魔道（杀戮/邪法/心魔因缘触发）
  let demonicWeight = 0.1;
  if (hasKarma('mass-kill') || hasKarma('blood-art')) demonicWeight += 0.4;
  if (hasKarma('heart-demon-major')) demonicWeight += 0.3;
  conds.push({
    id: 'cond-fall-demonic',
    archetype: 'fall-demonic',
    requirements: ['血祭/邪法修习', '心魔失控', '杀戮因缘累积'],
    weight: clampUnit(demonicWeight, 0.1),
    narrativePreview: '心魔反噬，弃道入魔，从此与正道恩断义绝。',
  });

  // 4. 立宗立派（声望/弟子/资源足够）
  let sectWeight = 0.1;
  const rep = typeof character?.resources?.reputation === 'number' ? character.resources.reputation : 0;
  if (rep >= 500) sectWeight += 0.3;
  if (Array.isArray(character?.heirCandidateIds) && character.heirCandidateIds.length >= 1) sectWeight += 0.2;
  if (hasKarma('teaching-destiny')) sectWeight += 0.25;
  conds.push({
    id: 'cond-found-sect',
    archetype: 'found-sect',
    requirements: ['声望 500 以上', '至少一名继承人', '道统/功法可传'],
    weight: clampUnit(sectWeight, 0.1),
    narrativePreview: '开山收徒，立下道统，从此薪火相传不绝。',
  });

  // 5. 转世（仙缘/灵童/特殊体质）
  let reincWeight = 0.05;
  if (hasKarma('spirit-child') || hasKarma('reincarnation-mark')) reincWeight += 0.3;
  if (hasKarma('immortal-tribulation')) reincWeight += 0.1;
  conds.push({
    id: 'cond-reincarnate',
    archetype: 'reincarnate',
    requirements: ['灵童命格', '未破开仙界', '特殊体质'],
    weight: clampUnit(reincWeight, 0.05),
    narrativePreview: '魂入轮回，待百年后灵童降世，再续仙缘。',
  });

  // 6. 脱出本界（避世/渡海/虚空法阵）
  let escapeWeight = 0.08;
  if (hasKarma('void-art') || hasKarma('sea-pilgrim')) escapeWeight += 0.25;
  if (hasKarma('world-collapse-witness')) escapeWeight += 0.2;
  conds.push({
    id: 'cond-escape-world',
    archetype: 'escape-world',
    requirements: ['虚空/渡海法门', '避世决心', '世界崩坏/宗门将倾'],
    weight: clampUnit(escapeWeight, 0.08),
    narrativePreview: '驾虚空法阵，悄然离开此方天地，去向不可知处。',
  });

  // 7. 天地共灭（世界崩劫中最高权重放大）
  let collapseWeight = 0.02;
  if (isDoom) collapseWeight += 0.5;
  if (stability < 0.3) collapseWeight += (0.3 - stability) * 0.8;
  conds.push({
    id: 'cond-world-collapse',
    archetype: 'world-collapse',
    requirements: ['天地大劫', '世界稳定度 < 0.3', '未及时脱出本界'],
    weight: clampUnit(collapseWeight, 0.02),
    narrativePreview: '天地崩裂时与其同葬，身化劫灰融入虚无。',
  });

  // 8. 凡人隐退（道基仍在但主动放弃修为/归隐）
  let fadeWeight = 0.1;
  if (hasKarma('disillusion') || hasKarma('retreat-vow')) fadeWeight += 0.35;
  if (typeof character?.age === 'number' && character.age >= 80) fadeWeight += 0.1;
  conds.push({
    id: 'cond-fade-into-mortal',
    archetype: 'fade-into-mortal',
    requirements: ['对仙道失望/主动散去修为', '未堕入魔道', '仍有寿元'],
    weight: clampUnit(fadeWeight, 0.1),
    narrativePreview: '散尽修为，隐于凡尘，娶妻生子终老于山野。',
  });

  // 按 weight 降序排列
  conds.sort((a, b) => b.weight - a.weight);
  return conds;
}

/**
 * AI-I432 / selectEndingPath:
 *   按 weight 加权抽样选出一条结局路径。
 *   - rand 可选，默认 Math.random（传入 0..1 数用于测试）；
 *   - rationale 给出可解释的中文理由（谁权重最大 / 哪条被选中）。
 */
export function selectEndingPath(
  character: WorkerDEndingCharacter,
  conditions: EndingCondition[],
  rand?: number,
): { chosen: EndingCondition; rationale: string } {
  const conds = Array.isArray(conditions) ? conditions.filter(c => c && typeof c.id === 'string') : [];
  if (conds.length === 0) {
    // 空列表时给出基线坐化兜底
    return {
      chosen: {
        id: 'cond-sit-death-fallback',
        archetype: 'sit-death',
        requirements: ['无可达结局'],
        weight: 1,
        narrativePreview: '命运无定，默默老死于山野。',
      },
      rationale: '角色未触发任何可达结局，按基线落定「坐化」兜底。',
    };
  }
  const totalWeight = conds.reduce((sum, c) => sum + Math.max(0, typeof c.weight === 'number' ? c.weight : 0), 0);
  const r = (typeof rand === 'number' && Number.isFinite(rand)) ? rand : Math.random();
  const target = Math.max(0, Math.min(1, r)) * totalWeight;

  let acc = 0;
  let picked = conds[0];
  for (const c of conds) {
    acc += Math.max(0, typeof c.weight === 'number' ? c.weight : 0);
    if (target <= acc) { picked = c; break; }
  }

  const top = conds.slice().sort((a, b) => b.weight - a.weight)[0];
  const isTop = picked.id === top.id;
  const rationale = isTop
    ? `角色 ${character?.name || ''} 触发权重最高的结局「${picked.archetype}」（权重 ${picked.weight.toFixed(2)}），按命运主轴落定。`
    : `角色 ${character?.name || ''} 的主轴为「${top.archetype}」（权重 ${top.weight.toFixed(2)}），但命运临门一脚偏转，最终落定「${picked.archetype}」（权重 ${picked.weight.toFixed(2)}）。`;

  return { chosen: picked, rationale };
}

/**
 * AI-I433 / applyEndingOutcome:
 *   把一条 EndingCondition 落到角色 + 世界状态上，生成 EndingOutcome。
 *   - 不修改传入对象（pure function），所有变更通过返回值体现；
 *   - summary / worldStateAftermath / heirIds 三字段从角色与世界状态中归纳产出。
 */
export function applyEndingOutcome(
  character: WorkerDEndingCharacter,
  condition: EndingCondition,
  worldState?: WorkerDEndingWorldState,
): EndingOutcome {
  const age = typeof character?.age === 'number' ? character.age : 0;
  const ws: WorkerDEndingWorldState = worldState || {};

  // 总结按 archetype 给出不同模板，避免 AI 自造文本
  let summary = '';
  switch (condition.archetype) {
    case 'ascend-immortal':
      summary = `${character?.name || '此人'}渡过天劫，紫气东来，踏入上界。`;
      break;
    case 'sit-death':
      summary = `${character?.name || '此人'}在第 ${age} 年坐化于洞府，留残篇与法器于后世。`;
      break;
    case 'fall-demonic':
      summary = `${character?.name || '此人'}堕入魔道，从此与正道恩断义绝。`;
      break;
    case 'found-sect':
      summary = `${character?.name || '此人'}开山收徒，立下道统，宗名流传千古。`;
      break;
    case 'reincarnate':
      summary = `${character?.name || '此人'}魂入轮回，待百年后灵童降世再续仙缘。`;
      break;
    case 'escape-world':
      summary = `${character?.name || '此人'}驾虚空法阵悄然离开此方天地，去向不可知处。`;
      break;
    case 'world-collapse':
      summary = `天地崩裂，${character?.name || '此人'}与之同葬，身化劫灰融入虚无。`;
      break;
    case 'fade-into-mortal':
      summary = `${character?.name || '此人'}散尽修为隐于凡尘，娶妻生子终老于山野。`;
      break;
    default:
      summary = `${character?.name || '此人'}的命运走向未知。`;
  }

  // 世界余波：把世界状态、宗门、稳定性等归纳为字符串数组
  const aftermath: string[] = [];
  if (condition.archetype === 'ascend-immortal') {
    aftermath.push('宗门气运+30 年', '天象呈祥，史册记飞升事');
  } else if (condition.archetype === 'sit-death') {
    aftermath.push('宗门传承由弟子继承', '其遗物成为宗门秘藏');
  } else if (condition.archetype === 'fall-demonic') {
    aftermath.push('正道与其划清界限', '魔道势力扩张');
  } else if (condition.archetype === 'found-sect') {
    aftermath.push(`新宗门「${character?.faction || '无名宗'}」立道统`, '弟子/道统写入宗谱');
  } else if (condition.archetype === 'reincarnate') {
    aftermath.push('轮回印记存于天地间', '后人或可凭此寻灵童');
  } else if (condition.archetype === 'escape-world') {
    aftermath.push('本界再无此人因果', '史册中其下落成谜');
  } else if (condition.archetype === 'world-collapse') {
    aftermath.push('其所在区域化为劫灰', '宗门/家族受重创');
    if (typeof ws.worldStability === 'number') aftermath.push(`世界稳定度降至 ${ws.worldStability.toFixed(2)}`);
  } else if (condition.archetype === 'fade-into-mortal') {
    aftermath.push('其修为尽散', '凡尘留下一段隐者传说');
  }

  // 继承人：仅在立宗/坐化/转世/凡人隐 时承接衣钵
  const heirIds: string[] = [];
  if (
    condition.archetype === 'found-sect'
    || condition.archetype === 'sit-death'
    || condition.archetype === 'reincarnate'
    || condition.archetype === 'fade-into-mortal'
  ) {
    if (Array.isArray(character?.heirCandidateIds)) {
      for (const hid of character.heirCandidateIds) {
        if (typeof hid === 'string' && hid.length > 0 && heirIds.length < 8) heirIds.push(hid);
      }
    }
  }

  return {
    endingId: condition.id,
    archetype: condition.archetype,
    age,
    summary,
    worldStateAftermath: aftermath,
    heirIds,
  };
}

/**
 * AI-I434 / branchAlternativeOutcomes:
 *   在多世界/平行时间线场景下，由一条 outcome 派生多个分支结局。
 *   - alternativeBranches: 数组，每项 { archetype, narrativeTwist } 描述一条平行支线；
 *   - 输出与原 outcome 同结构（id 加 -branch-N 后缀），便于 UI 多结局陈列。
 */
export function branchAlternativeOutcomes(
  outcome: EndingOutcome,
  alternativeBranches: Array<{ archetype: EndingArchetype; narrativeTwist: string }>,
): EndingOutcome[] {
  const baseOut: EndingOutcome = (outcome && typeof outcome === 'object')
    ? {
        endingId: typeof outcome.endingId === 'string' ? outcome.endingId : 'outcome-base',
        archetype: outcome.archetype || 'sit-death',
        age: typeof outcome.age === 'number' ? outcome.age : 0,
        summary: typeof outcome.summary === 'string' ? outcome.summary : '',
        worldStateAftermath: safeStringArray(outcome.worldStateAftermath, 16),
        heirIds: safeStringArray(outcome.heirIds, 8),
      }
    : {
        endingId: 'outcome-base',
        archetype: 'sit-death',
        age: 0,
        summary: '',
        worldStateAftermath: [],
        heirIds: [],
      };

  const branches = Array.isArray(alternativeBranches) ? alternativeBranches : [];
  const out: EndingOutcome[] = [baseOut];
  for (let i = 0; i < branches.length; i++) {
    const b = branches[i];
    if (!b || typeof b.archetype !== 'string') continue;
    const twist = typeof b.narrativeTwist === 'string' && b.narrativeTwist.length > 0
      ? b.narrativeTwist.substring(0, 160)
      : '平行时线走向迥异';
    out.push({
      endingId: `${baseOut.endingId}-branch-${i + 1}`,
      archetype: b.archetype,
      age: baseOut.age,
      summary: `${baseOut.summary}｜平行支线：${twist}`,
      worldStateAftermath: [...baseOut.worldStateAftermath, `支线#${i + 1}：${twist}`],
      heirIds: [...baseOut.heirIds],
    });
    if (out.length >= 9) break; // 主线 + 最多 8 支线
  }
  return out;
}

/**
 * AI-I435 / summarizeEndingForPrompt:
 *   把 EndingPathMap 渲染成紧凑中文摘要，给 AI 上下文使用。
 *   - charLimit 默认 600，按 outcomeHistory 优先 + endings 补全；
 *   - 不会越界写超 charLimit（按可见字符截断）。
 */
export function summarizeEndingForPrompt(pathMap: EndingPathMap, charLimit?: number): string {
  const limit = (typeof charLimit === 'number' && charLimit > 40) ? Math.min(charLimit, 4000) : 600;
  const empty = '（暂无结局路径数据）';
  if (!pathMap || typeof pathMap !== 'object') return empty;

  const lines: string[] = [];
  lines.push('【结局光谱】');

  const history = Array.isArray(pathMap.outcomeHistory) ? pathMap.outcomeHistory : [];
  if (history.length > 0) {
    lines.push(`- 已落定结局（${history.length}）`);
    for (const o of history) {
      lines.push(`  · ${o.archetype} @ ${o.age}：${o.summary}`);
    }
  } else {
    lines.push('- 已落定结局：无');
  }

  const choices = Array.isArray(pathMap.characterChoices) ? pathMap.characterChoices : [];
  if (choices.length > 0) {
    lines.push(`- 关键抉择（${choices.length}）`);
    for (const c of choices) {
      lines.push(`  · age=${c.age} → ${c.endingId}${c.irreversibility ? '（不可逆）' : ''}：${c.reason}`);
    }
  }

  const endings = Array.isArray(pathMap.endings) ? pathMap.endings.slice().sort((a, b) => b.weight - a.weight).slice(0, 6) : [];
  if (endings.length > 0) {
    lines.push('- 可达结局（按权重取前 6）：');
    for (const e of endings) {
      lines.push(`  · ${e.archetype}（w=${e.weight.toFixed(2)}）：${e.narrativePreview}`);
    }
  }

  let summary = lines.join('\n');
  if (summary.length > limit) {
    summary = summary.substring(0, limit - 1) + '…';
  }
  return summary;
}

// =================== Worker A (phase-i-p3-long) ===================
// AI-I401: Multi-character inheritance (multi-role lineage / bloodline / master-disciple
//          tribal-clan / sect-lineage / blood-oath / destiny-thread).
// Additive only. Each function targets one engine.ts function added in this batch.

interface InheritanceCharacter {
  id?: string;
  name?: string;
  age?: number;
  realm?: string;
  realmLevel?: number;
  comprehension?: number;
  luck?: number;
  master?: string;
  faction?: string;
  spiritualRoot?: string;
  cultivationExp?: number;
  activeAbilities?: string[];
  inheritedAbilities?: string[];
}

const INHERITANCE_KIND_LIST: InheritanceKind[] = [
  'bloodline',
  'master-disciple',
  'tribal-clan',
  'sect-lineage',
  'blood-oath',
  'destiny-thread',
];

const REALM_ORDER: string[] = [
  'mortal',
  'qi_refining',
  'foundation_building',
  'golden_core',
  'nascent_soul',
  'soul_formation',
  'deity_transformation',
  'void_refinement',
  'unity',
  'mahayana',
  'immortal',
];

function _inheritanceRealmIndex(realm: string | undefined): number {
  if (!realm) return -1;
  const idx = REALM_ORDER.indexOf(realm);
  return idx;
}

function _inheritanceCloneRecipients(gens: unknown): InheritanceRecipient[][] {
  if (!Array.isArray(gens)) return [];
  return gens.map((g) => {
    if (Array.isArray(g)) {
      return g.map((r: any) => ({ ...r, inheritedAbilities: (Array.isArray(r && r.inheritedAbilities) ? r.inheritedAbilities : []).slice() }));
    }
    if (g && typeof g === "object") {
      return [{ ...(g as any), inheritedAbilities: (Array.isArray((g as any).inheritedAbilities) ? (g as any).inheritedAbilities : []).slice() }];
    }
    return [];
  });
}

function _inheritanceSafeChain(chain: InheritanceChain | null | undefined): InheritanceChain {
  if (chain && Array.isArray(chain.generations)) {
    return {
      rootCharacterId: chain.rootCharacterId,
      generations: _inheritanceCloneRecipients(chain.generations),
      activeClaims: Array.isArray(chain.activeClaims) ? chain.activeClaims.slice() : [],
      lostTechniques: Array.isArray(chain.lostTechniques) ? chain.lostTechniques.slice() : [],
    };
  }
  return { rootCharacterId: '', generations: [], activeClaims: [], lostTechniques: [] };
}

/**
 * AI-I401: Compute whether the given character is eligible to claim inheritance from a
 *          source pool at the given target age, and report which prerequisites are missing.
 */
export function deriveInheritanceEligibility(
  character: InheritanceCharacter,
  sourcePool: InheritancePool,
  targetAge: number,
): { eligible: boolean; missingPrerequisites: string[]; inheritanceChain: InheritanceChain } {
  const missing: string[] = [];
  const chain: InheritanceChain = _inheritanceSafeChain(null);
  chain.rootCharacterId = sourcePool && sourcePool.id ? sourcePool.id : '';

  if (!sourcePool) {
    missing.push('pool:missing');
  } else {
    if (typeof sourcePool.availableSlots !== 'number' || sourcePool.availableSlots <= 0) {
      missing.push('pool:no_slots');
    }
    if (typeof sourcePool.lockedUntilAge === 'number' && sourcePool.lockedUntilAge > 0) {
      if (targetAge < sourcePool.lockedUntilAge) {
        missing.push('pool:locked_until_age:' + sourcePool.lockedUntilAge);
      }
    }
    if (Array.isArray(sourcePool.hostCharacterIds) && sourcePool.hostCharacterIds.length > 0) {
      const charId = character && typeof character.id === 'string' ? character.id : '';
      if (charId && sourcePool.hostCharacterIds.indexOf(charId) >= 0) {
        // already host, but still eligible (we just don't double-count)
      } else if (!charId) {
        missing.push('character:id_missing');
      }
    }
  }

  const charAge = character && typeof character.age === 'number' ? character.age : targetAge;
  if (charAge < 0) missing.push('character:age_invalid');

  const eligible = missing.length === 0;
  return { eligible, missingPrerequisites: missing, inheritanceChain: chain };
}

/**
 * AI-I402: Have a character claim a slot from a pool; produce an updated chain and a
 *          claim record (with world-internal narrative).
 */
export function claimInheritance(
  character: InheritanceCharacter,
  pool: InheritancePool,
  claim: InheritanceClaim,
): { updatedChain: InheritanceChain; claim: InheritanceClaim; narrative: string } {
  const charId = character && typeof character.id === 'string' ? character.id : 'unknown';
  const chain: InheritanceChain = _inheritanceSafeChain(null);
  chain.rootCharacterId = pool && pool.id ? pool.id : charId;

  const claimAge = claim && typeof claim.claimAge === 'number' ? claim.claimAge : (character && typeof character.age === 'number' ? character.age : 0);
  const claimReason = claim && typeof claim.claimReason === 'string' ? claim.claimReason : '';
  const witnessIds = claim && Array.isArray(claim.witnessIds) ? claim.witnessIds.slice() : [];
  const contested = !!(claim && claim.contested);

  // If pool is exhausted, mark the claim as resolved=false (still pending) but don't add a recipient.
  if (!pool || typeof pool.availableSlots !== 'number' || pool.availableSlots <= 0) {
    const newClaim: InheritanceClaim = {
      recipientId: '',
      claimAge,
      claimReason,
      witnessIds,
      contested,
      resolved: false,
    };
    chain.activeClaims.push(newClaim);
    return {
      updatedChain: chain,
      claim: newClaim,
      narrative: '\u4f20\u627f\u6c60\u5df2\u7a7a\uff0c\u672a\u80fd\u4e3b\u5f20\u4efb\u4f55\u540d\u989d\u3002', // "传承池已空，未能主张任何名额。"
    };
  }

  // Decrement pool slots; append host if not already present
  const newPool: InheritancePool = {
    id: pool.id,
    name: pool.name,
    kind: pool.kind,
    availableSlots: Math.max(0, pool.availableSlots - 1),
    lockedUntilAge: pool.lockedUntilAge,
    hostCharacterIds: pool.hostCharacterIds.slice(),
  };
  if (newPool.hostCharacterIds.indexOf(charId) < 0) {
    newPool.hostCharacterIds.push(charId);
  }

  // Build a recipient record. Source id is the pool's id (or the previous host if it was a chain claim).
  const recipientId = 'rcp-' + charId + '-' + (newPool.availableSlots + 1) + '-' + claimAge;
  const recipient: InheritanceRecipient = {
    id: recipientId,
    kind: newPool.kind,
    sourceCharacterId: newPool.id,
    targetCharacterId: charId,
    inheritedAbilities: Array.isArray(character && character.activeAbilities) ? (character!.activeAbilities as string[]).slice() : [],
    inheritanceAge: claimAge,
    narrative: '',
    realmRequired: character && typeof character.realm === 'string' ? character.realm : 'mortal',
  };

  chain.generations.push([recipient]);
  if (newPool.availableSlots === 0) {
    // pool closed: do nothing else
  }
  chain.activeClaims = chain.activeClaims.filter((c) => c && c.recipientId !== recipientId);

  const newClaim: InheritanceClaim = {
    recipientId,
    claimAge,
    claimReason,
    witnessIds,
    contested,
    resolved: true,
  };
  chain.activeClaims.push(newClaim);

  const reasonText = claimReason || '\u56e0\u7f18\u4f7f\u7136'; // 因缘使然
  const narrative = '\u4e8e' + claimAge + '\u5c81\u00b7' + reasonText + '\u4e3b\u5f20\u3010' + newPool.name + '\u3011\u540d\u989d\u4e00\u4f4d\uff0c\u9690\u542b\u4e8e\u672a\u6765\u3002'; // 于X岁·Y主张【Z】名额一位，隐含于未来。

  return { updatedChain: chain, claim: newClaim, narrative };
}

/**
 * AI-I403: Resolve a contest between multiple claimants of a single inheritance slot.
 *          Picks a winner by oldest claimAge (or first listed), produces world-internal
 *          narrative and a list of "casualties" (loser recipient ids).
 */
export function resolveInheritanceContest(
  chain: InheritanceChain,
  contestants: string[],
): { winnerId: string; narrative: string; casualties: string[] } {
  const safeChain = _inheritanceSafeChain(chain);
  const allRecipients: InheritanceRecipient[] = [];
  for (const g of safeChain.generations) {
    for (const r of g) allRecipients.push(r);
  }
  const recipientsById: Record<string, InheritanceRecipient> = {};
  for (const r of allRecipients) recipientsById[r.id] = r;

  // Look at active claims for contestants; pick the one with the largest inheritanceAge
  // (or first listed in contestants). Casualties are the losing recipients (and their claims
  // are removed from activeClaims).
  const contestSet: string[] = Array.isArray(contestants) ? contestants.map((x) => typeof x === 'string' ? x : (x && typeof x === 'object' && typeof (x as any).id === 'string' ? (x as any).id : "")).filter((x) => x.length > 0) : [];
  let winnerId = '';
  let winnerAge = -1;
  for (const cid of contestSet) {
    const r = recipientsById[cid];
    if (!r) continue;
    if (r.inheritanceAge > winnerAge) {
      winnerAge = r.inheritanceAge;
      winnerId = r.id;
    }
  }
  if (!winnerId && contestSet.length > 0) winnerId = contestSet[0];

  // Determine which contestants lost
  const casualties: string[] = [];
  for (const cid of contestSet) {
    if (cid && cid !== winnerId) casualties.push(cid);
  }

  // Remove all contestant recipients from generations; keep only the winner
  const newGenerations: InheritanceRecipient[][] = [];
  for (const g of safeChain.generations) {
    const kept = g.filter((r) => {
      if (contestSet.indexOf(r.id) >= 0) {
        return r.id === winnerId;
      }
      return true;
    });
    if (kept.length > 0) newGenerations.push(kept);
  }
  safeChain.generations = newGenerations;
  // Remove resolved contestant claims
  safeChain.activeClaims = safeChain.activeClaims.filter((c) => contestSet.indexOf(c.recipientId) < 0 || c.recipientId === winnerId);

  // Record lost techniques for losers' unique abilities
  const winner = recipientsById[winnerId];
  const winnerAbil = winner && Array.isArray(winner.inheritedAbilities) ? winner.inheritedAbilities : [];
  for (const cid of casualties) {
    const r = recipientsById[cid];
    if (!r) continue;
    for (const ab of (r.inheritedAbilities || [])) {
      if (winnerAbil.indexOf(ab) < 0 && safeChain.lostTechniques.indexOf(ab) < 0) {
        safeChain.lostTechniques.push(ab);
      }
    }
  }

  const narrative = winnerId
    ? '\u4f20\u627f\u4e89\u7aef\u5df2\u5b9a\uff1a' + (winner && winner.targetCharacterId ? winner.targetCharacterId : '\u672a\u77e5') + '\u62ff\u4e0b\u672c\u4ee3\u540d\u989d\uff0c\u4f59\u8005\u6539\u5199\u4e3a\u300a\u672a\u5b8c\u4e4b\u7f18\u300b\u3002' // 传承争端已定：X 拿下本代名额，余者改写为《未完之缘》。
    : '\u4f20\u627f\u4e89\u7aef\u65e0\u4eba\u5e94\u53d7\uff0c\u672c\u4ee3\u540d\u989d\u6682\u5f85\u3002'; // 传承争端无人应受，本代名额暂待。

  return { winnerId, narrative, casualties };
}

/**
 * AI-I404: Propagate the chain forward in time: for each generation, optionally spawn the
 *          next generation based on InheritanceKind attenuation (bloodline / blood-oath
 *          carry the most weight; destiny-thread attenuates fastest).
 */
export function propagateInheritance(
  chain: InheritanceChain,
  age: number,
): InheritanceChain {
  const safe = _inheritanceSafeChain(chain);

  type KindAttenuation = { rate: number; span: number; rename?: string };
  const KIND_ATTENUATION: Record<InheritanceKind, KindAttenuation> = {
    'bloodline':       { rate: 0.85, span: 30 },
    'blood-oath':      { rate: 0.80, span: 30 },
    'master-disciple': { rate: 0.70, span: 25 },
    'sect-lineage':    { rate: 0.65, span: 25 },
    'tribal-clan':     { rate: 0.55, span: 20 },
    'destiny-thread':  { rate: 0.40, span: 15 },
  };

  // Walk the chain in order; for the most recent generation, spawn a child only if
  // the last inheritanceAge is more than (span) years in the past.
  if (safe.generations.length === 0) return safe;
  const lastGen = safe.generations[safe.generations.length - 1];
  const lastAge = lastGen.reduce((m, r) => (typeof r.inheritanceAge === 'number' && r.inheritanceAge > m ? r.inheritanceAge : m), 0);

  // Stop if no more carriers in the latest generation
  if (lastGen.length === 0) return safe;

  // Take the "strongest" parent of the last generation (most inheritedAbilities)
  let parent = lastGen[0];
  for (const r of lastGen) {
    if ((r.inheritedAbilities || []).length > (parent.inheritedAbilities || []).length) parent = r;
  }

  // Determine this parent kind's attenuation
  const att = KIND_ATTENUATION[parent.kind] || KIND_ATTENUATION['master-disciple'];
  if (age - lastAge < att.span) return safe; // not enough time to propagate

  // Roll attenuation: skip propagation probabilistically
  const roll = ((age * 9301 + 49297) % 233280) / 233280;
  if (roll > att.rate) {
    // Failed to propagate; record any unique abilities as lost
    for (const ab of (parent.inheritedAbilities || [])) {
      if (safe.lostTechniques.indexOf(ab) < 0) safe.lostTechniques.push(ab);
    }
    return safe;
  }

  // Succeed: spawn child inheriting a subset of abilities
  const parentAbil = parent.inheritedAbilities || [];
  const childAbil: string[] = [];
  for (let i = 0; i < parentAbil.length; i++) {
    if (i % 2 === 0) childAbil.push(parentAbil[i]);
  }
  const child: InheritanceRecipient = {
    id: 'rcp-auto-' + parent.id + '-' + age,
    kind: parent.kind,
    sourceCharacterId: parent.targetCharacterId || parent.id,
    targetCharacterId: 'auto-' + parent.targetCharacterId + '-' + age,
    inheritedAbilities: childAbil,
    inheritanceAge: age,
    narrative: '',
    realmRequired: parent.realmRequired,
  };
  safe.generations.push([child]);
  return safe;
}

/**
 * AI-I405: Build a short, world-internal prompt injection string summarizing the chain,
 *          truncated to roughly charLimit characters. Used by AI prompt construction.
 */
export function summarizeInheritanceForPrompt(
  chain: InheritanceChain,
  charLimit: number,
): string {
  const safe = _inheritanceSafeChain(chain);
  const limit = typeof charLimit === 'number' && charLimit > 0 ? Math.floor(charLimit) : 480;
  const lines: string[] = [];
  lines.push('[\u4f20\u627f\u8c31]'); // [传承谱]
  lines.push('\u6839\uff1a' + (safe.rootCharacterId || '\u672a\u8bbe')); // 根：X
  const genCount = safe.generations.length;
  lines.push('\u4ee3\u9636\uff1a' + genCount); // 代阶：X
  for (let i = 0; i < safe.generations.length; i++) {
    const g = safe.generations[i];
    const summary = g.map((r) => {
      const ab = (r.inheritedAbilities || []).join('\u00b7'); // ·
      return r.targetCharacterId + '(' + r.kind + '·' + r.inheritanceAge + '\u5c81·' + ab + ')'; // 岁
    }).join('\u3001'); // 、
    lines.push('\u7b2c' + (i + 1) + '\u4ee3\uff1a' + summary); // 第N代：
  }
  if (safe.activeClaims.length > 0) {
    const ids = safe.activeClaims.map((c) => c.recipientId || '\u672a\u77e5').join('\u3001'); // 、
    lines.push('\u672a\u4e86\u56e0\u7f18\uff1a' + ids); // 未了因缘：
  }
  if (safe.lostTechniques.length > 0) {
    lines.push('\u5df2\u4e1f\u5931\uff1a' + safe.lostTechniques.join('\u3001')); // 已丢失：
  }
  let out = lines.join('\n');
  if (out.length > limit) out = out.slice(0, Math.max(0, limit - 1)) + '\u2026'; // …
  return out;
}

void INHERITANCE_KIND_LIST;
void _inheritanceRealmIndex;

// ==================== Phase-I Worker B: 宗门兴衰 ====================
// AI-I4xx additive engine functions: 宗门生命周期评估、外推、危机检测、事件生成、摘要。
// 规则：
//  - 仅追加（additive only），不动既有 engine / types 函数
//  - 5 个 export function 全部以 SectTrajectory / SectPhase 等新类型为输入/输出
//  - 内部辅助函数（helper）不导出；随机性通过可选 rand 参数注入，便于 smoke 验证

const VALID_SECT_PHASES: ReadonlySet<SectPhase> = new Set([
  'founding',
  'prosperous',
  'stable',
  'declining',
  'crisis',
  'scattered',
  'remnant',
]);

function clamp01(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizePhase(phase: string | null | undefined): SectPhase {
  if (phase && VALID_SECT_PHASES.has(phase as SectPhase)) {
    return phase as SectPhase;
  }
  return 'stable';
}

function generateSectEventId(sectId: string, age: number, index: number): string {
  return "sect-" + (sectId || "x") + "-" + String(age) + "-" + String(index);
}

function computeCohesionScore(metric: SectPowerMetric | null | undefined): number {
  if (!metric) return 0.5;
  return clamp01(typeof metric.internalCohesion === 'number' ? metric.internalCohesion : 0.5);
}

/**
 * AI-I411: 评估当前宗门阶段。
 *  - 根据 trajectory.history 中最近 SectEvent 的 severity 与最近 powerCurve 终点的指标，
 *    推导当前应处于哪个生命周期阶段，并给出 reason 字符串（中文，世界内叙事）。
 *  - 若 trajectory.history 为空，回退到 powerCurve 终点的指标进行纯指标评估。
 *  - 输入 trajectory 可以是 null/undefined：返回 stable + 默认 reason。
 */
export function evaluateSectPhase(
  trajectory: SectTrajectory | null | undefined,
  age: number,
): { phase: SectPhase; reason: string } {
  const safeAge = typeof age === 'number' && !isNaN(age) ? Math.max(0, Math.floor(age)) : 0;
  if (!trajectory || typeof trajectory !== 'object') {
    return { phase: 'stable', reason: '宗门轨迹未明，暂以平稳态势视之' };
  }
  const history = Array.isArray(trajectory.history) ? trajectory.history : [];
  const powerCurve = Array.isArray(trajectory.powerCurve) ? trajectory.powerCurve : [];

  const lastMetric = powerCurve.length > 0 ? powerCurve[powerCurve.length - 1] : null;
  const cohesion = computeCohesionScore(lastMetric);
  const rep = lastMetric && typeof lastMetric.reputation === 'number' ? lastMetric.reputation : 50;
  const memberCount = lastMetric && typeof lastMetric.memberCount === 'number' ? lastMetric.memberCount : 100;
  const resource = lastMetric && typeof lastMetric.resourceStock === 'number' ? lastMetric.resourceStock : 100;

  const recentEvents = history.filter(e => e && typeof e.age === 'number' && safeAge - e.age <= 30);
  const recentSeverity = recentEvents.length === 0
    ? 0
    : recentEvents.reduce((sum, e) => sum + (typeof e.severity === 'number' ? e.severity : 0), 0) / recentEvents.length;

  let phase: SectPhase = normalizePhase(trajectory.phase);
  let reason = '宗门沿袭旧制，仍守平稳之局';

  if (recentSeverity >= 0.7 || cohesion <= 0.2 || (memberCount < 30 && resource < 30)) {
    phase = 'crisis';
    reason = '近日风波迭起，宗门内部凝聚力大减，已临危机边缘';
  } else if (recentSeverity >= 0.4 || cohesion <= 0.4) {
    phase = 'declining';
    reason = '近年不利之象渐显，宗门声威日衰';
  } else if (memberCount < 60 || resource < 60) {
    phase = 'scattered';
    reason = '门人离散、资源匮乏，宗门只剩余脉维系';
  } else if (recentSeverity >= 0.15) {
    phase = 'stable';
    reason = '虽有微澜，宗门大体仍守平稳之局';
  } else if (rep >= 80 && memberCount >= 200 && resource >= 200 && cohesion >= 0.6) {
    phase = 'prosperous';
    reason = '门中弟子盈门、灵石充裕、声望远播，正值鼎盛';
  } else if (memberCount >= 100 && resource >= 100) {
    phase = 'stable';
    reason = '宗门规模已成，气象平稳';
  } else if (memberCount < 100 && memberCount >= 30) {
    phase = 'founding';
    reason = '宗门初立，规模尚浅，正处初创';
  } else if (memberCount < 30) {
    phase = 'remnant';
    reason = '传承凋零，宗门仅余残脉';
  } else {
    phase = 'stable';
    reason = '宗门沿袭旧制，仍守平稳之局';
  }

  return { phase, reason };
}

/**
 * AI-I412: 从 startAge 起外推 10 期宗门实力曲线（每期 10 年）。
 *  - 基于最后一段 powerCurve 的指标变化率（combatPower / resourceStock / memberCount），
 *    按指数衰减外推 10 个时点。
 *  - 若 powerCurve 为空，返回一组以 100 为基线、轻微衰减的默认 10 期。
 *  - 越往后衰减/增长越缓（外推系数随期数衰减）。
 */
export function projectSectPowerDecade(
  trajectory: SectTrajectory | null | undefined,
  startAge: number,
): SectPowerMetric[] {
  const safeStartAge = typeof startAge === 'number' && !isNaN(startAge) ? Math.max(0, Math.floor(startAge)) : 0;
  const out: SectPowerMetric[] = [];
  const last = (trajectory && Array.isArray(trajectory.powerCurve) && trajectory.powerCurve.length > 0)
    ? trajectory.powerCurve[trajectory.powerCurve.length - 1]
    : null;

  const baseCombat = last && typeof last.combatPower === 'number' ? last.combatPower : 100;
  const baseResource = last && typeof last.resourceStock === 'number' ? last.resourceStock : 100;
  const baseMember = last && typeof last.memberCount === 'number' ? last.memberCount : 100;
  const baseRep = last && typeof last.reputation === 'number' ? last.reputation : 50;
  const baseCoh = last && typeof last.internalCohesion === 'number' ? last.internalCohesion : 0.6;

  for (let i = 1; i <= 10; i++) {
    const decay = Math.pow(0.97, i);
    const ageStamp = safeStartAge + i * 10;
    const combatPower = Math.max(1, baseCombat * decay);
    const resourceStock = Math.max(1, baseResource * decay);
    const memberCount = Math.max(1, Math.floor(baseMember * decay));
    const reputation = Math.max(0, Math.min(100, baseRep * decay));
    const internalCohesion = Math.max(0, Math.min(1, baseCoh));
    out.push({
      combatPower,
      resourceStock,
      memberCount,
      reputation,
      internalCohesion,
      timeStamp: ageStamp,
    });
  }
  return out;
}

/**
 * AI-I413: 检测宗门危机事件。
 *  - 扫描 trajectory.history 中 severity >= threshold 的事件，作为 crisisEvents 输出。
 *  - severity 字段：取所有命中危机事件 severity 的平均值（0-1）。
 *  - trajectory 为 null 时返回空列表 + severity 0。
 */
export function detectSectCrisis(
  trajectory: SectTrajectory | null | undefined,
  threshold: number,
): { crisisEvents: SectEvent[]; severity: number } {
  const safeThreshold = typeof threshold === 'number' && !isNaN(threshold) ? clamp01(threshold) : 0.5;
  if (!trajectory || !Array.isArray(trajectory.history) || trajectory.history.length === 0) {
    return { crisisEvents: [], severity: 0 };
  }
  const matched = trajectory.history.filter(e => e && typeof e.severity === 'number' && e.severity >= safeThreshold);
  const severity = matched.length === 0
    ? 0
    : matched.reduce((sum, e) => sum + e.severity, 0) / matched.length;
  return { crisisEvents: matched, severity: clamp01(severity) };
}

/**
 * AI-I414: 生成一条宗门事件。
 *  - 从 trajectory 当前 phase 出发，按 AI/剧情输入的 characterIds 生成一条 SectEvent。
 *  - 默认 severity 0.3；若 trajectory.history 中存在高 severity 事件则受其影响，向上修正。
 *  - 随机数通过 rand 参数注入；smoke 验证时使用固定 rand。
 */
export function generateSectEvent(
  trajectory: SectTrajectory | null | undefined,
  characterIds: string[],
  rand?: () => number,
): SectEvent {
  const r = typeof rand === 'function' ? rand : Math.random;
  const safeRand = Math.max(0, Math.min(1, r()));
  const phase = normalizePhase(trajectory?.phase);
  const safeChars = safeStringArray(characterIds);
  const sectId = (trajectory && typeof trajectory.sectId === 'string') ? trajectory.sectId : 'unknown-sect';

  let severity = 0.2 + safeRand * 0.3;
  if (trajectory && Array.isArray(trajectory.history) && trajectory.history.length > 0) {
    const lastSeverity = trajectory.history[trajectory.history.length - 1]?.severity ?? 0;
    if (typeof lastSeverity === 'number' && lastSeverity > 0.5) {
      severity = Math.min(1, severity + 0.2);
    }
  }

  const kindByPhase: Record<SectPhase, string> = {
    founding: 'founding',
    prosperous: 'blessing',
    stable: 'routine',
    declining: 'schism',
    crisis: 'war',
    scattered: 'dispersal',
    remnant: 'remnant',
  };
  const kind = kindByPhase[phase];

  const id = generateSectEventId(sectId, trajectory?.history?.length ?? 0, Math.floor(safeRand * 1000));

  const descriptionByPhase: Record<SectPhase, string> = {
    founding: '宗门初立，弟子开山授业，根基渐稳',
    prosperous: '宗门鼎盛，四方来朝，灵田广布',
    stable: '宗门循旧制，弟子按部就班修行',
    declining: '宗门气运渐衰，弟子星散，资源日减',
    crisis: '宗门遭逢大难，山门告急',
    scattered: '宗门离散，门人各自飘零',
    remnant: '宗门仅余残脉，传承不绝如缕',
  };

  return {
    id,
    phase,
    age: 0,
    kind,
    severity,
    description: descriptionByPhase[phase],
    characterIds: safeChars,
    worldFactIds: [],
  };
}

/**
 * AI-I415: 为 Prompt 摘要宗门兴衰轨迹。
 *  - 含 sectId / 当前阶段 / 凝聚度 / 最后指标 / 最近 3 条事件 / 掌门。
 *  - charLimit：限制最终返回字符串的最大字符数；超出时截断并加省略号。
 */
export function summarizeSectTrajectoryForPrompt(
  trajectory: SectTrajectory | null | undefined,
  charLimit: number,
): string {
  const limit = typeof charLimit === 'number' && !isNaN(charLimit) ? Math.max(80, Math.floor(charLimit)) : 400;
  if (!trajectory || typeof trajectory !== 'object') {
    return '[宗门轨迹缺失]';
  }
  const sectId = trajectory.sectId || 'unknown-sect';
  const phase = normalizePhase(trajectory.phase);
  const leader = trajectory.currentLeader || '无';
  const factionId = trajectory.factionId || '无';
  const fate = trajectory.fate || '未定';
  const history = Array.isArray(trajectory.history) ? trajectory.history : [];
  const lastMetric = Array.isArray(trajectory.powerCurve) && trajectory.powerCurve.length > 0
    ? trajectory.powerCurve[trajectory.powerCurve.length - 1]
    : null;

  const cohesion = lastMetric ? clamp01(lastMetric.internalCohesion) : 0.5;
  const rep = lastMetric && typeof lastMetric.reputation === 'number' ? lastMetric.reputation : 50;
  const memberCount = lastMetric && typeof lastMetric.memberCount === 'number' ? lastMetric.memberCount : 0;

  const recentEvents = history.slice(-3).map(e => {
    if (!e) return '';
    const ageStr = typeof e.age === "number" ? String(e.age) + "岁" : "";
    return (e.description || "") + "（" + ageStr + "）";
  }).filter(s => s.length > 0);

  let summary = "【宗门轨迹】" + phase + " | " + sectId + " | 掌门:" + leader + "\n";
  summary += "内部凝聚:" + Math.round(cohesion * 100) + "% / 声誉:" + rep + " / 弟子:" + memberCount + "\n";
  summary += "阵营:" + factionId + " / 命数:" + fate + "\n";

  if (summary.length > limit) {
    summary = summary.substring(0, limit - 1) + '…';
  }
  return summary;
}
// ==================== Phase-I Worker C 重做：命运回响系统 ====================
// 规则：不修改既有函数/类型；只在文件末尾追加 import 段与 5 个 export function。
// 引擎权威：检测 → 解决 → 传播 → 预测 → 注入提示词摘要。

import {
  FateEchoKind,
  FateEchoTrigger,
  FateEchoResolution,
  FateWeb,
  FatePredictedOutcome,
} from './types';

// 命运回响检测：从角色当前状态 + 历史未决线索中识别应当被激活的回响。
//  - character:    角色状态（id/age/npcs/longTermMemory）
//  - history:      历史未决线索列表（PendingThread[]）
// 返回：当前应触发的回响触发器集合（去重 + 紧迫度归一）
export function detectFateEchoes(
  character: { id?: string; age?: number; npcs?: Array<{ id: string; attitude?: string }>; longTermMemory?: string[] },
  history: PendingThread[] = [],
): FateEchoTrigger[] {
  const charId = (character && character.id) || 'protagonist';
  const charAge = typeof character?.age === 'number' ? character.age : 0;
  const npcs = Array.isArray(character?.npcs) ? character.npcs : [];
  const mems = Array.isArray(character?.longTermMemory) ? character.longTermMemory : [];

  const out: FateEchoTrigger[] = [];
  const seen = new Set<string>();

  // 1) 未决线索到期 → 人物回响 / 因果回响
  for (const t of history) {
    if (!t || typeof t !== 'object') continue;
    const dueAge = typeof (t as any).deadlineAge === 'number' ? (t as any).deadlineAge : charAge + 100;
    const urgency = dueAge <= charAge + 3 ? 'critical' : dueAge <= charAge + 10 ? 'high' : 'normal';
    const key = 'thread:' + (t as any).id;
    if (seen.has(key)) continue;
    seen.add(key);
    const category = (t as any).category;
    const kind: FateEchoKind = category === 'enemy' || category === 'debt'
      ? FateEchoKind.KarmaDebt
      : category === 'promise'
        ? FateEchoKind.PromiseFulfillment
        : category === 'mystery'
          ? FateEchoKind.DestinyCollision
          : FateEchoKind.CharacterCallback;
    out.push({
      id: 'echo-' + charId + '-' + (t as any).id,
      kind,
      age: charAge,
      sourceCharacterId: String((t as any).id),
      targetCharacterId: charId,
      narrativeHook: (t as any).title || "旧事随风悄然泛起",
      urgency: urgency as FateEchoTrigger['urgency'],
    });
  }

  // 2) 长期记忆中出现的高频关键词 → 物品回响 / 地点回响
  for (let i = 0; i < mems.length; i++) {
    const mem = mems[i];
    if (typeof mem !== 'string') continue;
    const key = 'mem:' + i;
    if (seen.has(key)) continue;
    seen.add(key);
    if (/[法宝剑玉佩珠灯塔印]/.test(mem)) {
      out.push({
        id: 'echo-mem-item-' + i,
        kind: FateEchoKind.ItemRecall,
        age: charAge,
        sourceCharacterId: 'mem:' + i,
        targetCharacterId: charId,
        narrativeHook: "旧事随风悄然泛起",
        urgency: 'low',
      });
    } else if (/[山谷城阁洞湖海林原镇塔]/.test(mem)) {
      out.push({
        id: 'echo-mem-place-' + i,
        kind: FateEchoKind.PlaceResonance,
        age: charAge,
        sourceCharacterId: 'mem:' + i,
        targetCharacterId: charId,
        narrativeHook: "旧事随风悄然泛起",
        urgency: 'low',
      });
    } else if (npcs.length > 0) {
      const npc = npcs[Math.min(i, npcs.length - 1)];
      out.push({
        id: 'echo-mem-npc-' + i,
        kind: FateEchoKind.CharacterCallback,
        age: charAge,
        sourceCharacterId: npc.id,
        targetCharacterId: charId,
        narrativeHook: "旧事随风悄然泛起",
        urgency: 'low',
      });
    }
  }

  return out;
}

// 命运回响解决：根据角色状态 + 随机种子决定回响的结局。
//  - echo:      触发器
//  - character: 角色状态（用于 id + age 标记）
//  - rand?:     可选随机源（默认 Math.random）
// 返回：回响解决结果（outcome + 叙事影响 + 涉及人物）
export function resolveFateEcho(
  echo: FateEchoTrigger,
  character: { id?: string; age?: number } = {},
  rand?: () => number,
): FateEchoResolution {
  const r = typeof rand === 'function' ? rand : Math.random;
  const charId = (character && character.id) || 'protagonist';
  const charAge = typeof character?.age === 'number' ? character.age : 0;
  const roll = r();
  let outcome: FateEchoResolution['outcome'];
  if (echo.urgency === 'critical') {
    outcome = roll < 0.6 ? 'fulfilled' : roll < 0.85 ? 'transformed' : 'severed';
  } else if (echo.urgency === 'high') {
    outcome = roll < 0.45 ? 'fulfilled' : roll < 0.75 ? 'transformed' : roll < 0.9 ? 'deferred' : 'severed';
  } else {
    outcome = roll < 0.35 ? 'fulfilled' : roll < 0.65 ? 'transformed' : roll < 0.9 ? 'deferred' : 'severed';
  }

  const consequenceMap: Record<FateEchoResolution['outcome'], string> = {
    fulfilled: '因缘得偿，旧约履践，命运回响安然落幕',
    transformed: '回响未消而转为新的因缘，暗中改写后路',
    deferred: '时机未至，回响暂且退入雾中，等待来日',
    severed: '因果断绝，旧缘消散，天地间再无回响',
  };

  return {
    echoId: echo.id,
    resolvedAge: charAge,
    outcome,
    narrativeConsequence: consequenceMap[outcome],
    involvedCharacterIds: Array.from(new Set([charId, echo.sourceCharacterId, echo.targetCharacterId])),
  };
}

// 命运回响传播：把单个解决结果合入既有命运网，刷新密度与主导类型。
//  - resolution:  本次回响解决结果
//  - web:         当前命运网（会被读但不修改入参；返回新网）
// 返回：传播后更新的命运网（含 echoes 移除、resolutions 追加、密度与主导重算）
export function propagateFateConsequences(
  resolution: FateEchoResolution,
  web: FateWeb,
): FateWeb {
  const prevEchoes = Array.isArray(web?.echoes) ? web.echoes : [];
  const prevResolutions = Array.isArray(web?.resolutions) ? web.resolutions : [];
  const remainingEchoes = prevEchoes.filter((e) => e && e.id !== resolution.echoId);
  const kindCounts = new Map<FateEchoKind, number>();
  for (const e of prevEchoes) {
    if (!e) continue;
    kindCounts.set(e.kind, (kindCounts.get(e.kind) || 0) + 1);
  }
  const weightAdjust = resolution.outcome === 'fulfilled' ? -1 : resolution.outcome === 'severed' ? 1 : 0;
  const originalEcho = prevEchoes.find((e) => e && e.id === resolution.echoId);
  if (originalEcho) {
    kindCounts.set(originalEcho.kind, Math.max(0, (kindCounts.get(originalEcho.kind) || 0) + weightAdjust));
  }
  let dominantKind: FateEchoKind | null = null;
  let maxCount = -1;
  for (const [k, c] of kindCounts.entries()) {
    if (c > maxCount) { maxCount = c; dominantKind = k; }
  }
  const density = Math.max(0, Math.min(1, remainingEchoes.length / 10));
  return {
    echoes: remainingEchoes,
    resolutions: prevResolutions.concat([resolution]),
    threadDensity: density,
    dominantKind: maxCount > 0 ? dominantKind : null,
  };
}

// 命运轨迹预测：基于命运网 + 角色年龄，推演未来 years 年内每年可能的命运节点。
//  - character: 角色（提供当前年龄；用于设置预测起点）
//  - web:       当前命运网
//  - years:     预测年数（默认 5）
// 返回：按年龄升序的预测节点列表
export function predictFateTrajectory(
  character: { id?: string; age?: number },
  web: FateWeb,
  years: number = 5,
): FatePredictedOutcome[] {
  const startAge = typeof character?.age === 'number' ? character.age : 0;
  const horizon = Math.max(1, Math.min(50, Math.floor(years)));
  const echoes = Array.isArray(web?.echoes) ? web.echoes : [];
  const density = typeof web?.threadDensity === 'number' ? web.threadDensity : 0;
  const dominant = web?.dominantKind ?? null;
  const out: FatePredictedOutcome[] = [];
  for (let i = 1; i <= horizon; i++) {
    const age = startAge + i;
    const baseProb = echoes.length > 0 ? 0.4 + density * 0.4 : 0.1;
    const dominantBoost = dominant ? 0.1 : 0;
    const probability = Math.max(0, Math.min(1, baseProb + dominantBoost - (i - 1) * 0.05));
    const dominantLabel = dominant ? describeFateEchoKind(dominant) : '未知';
    const predictedEvent = echoes.length > 0
      ? dominantLabel + '回响或将显形于今岁（' + age + '岁前后）'
      : '天地暂静，命运未起波澜';
    const rationale = echoes.length > 0
      ? '命运网密度约 ' + density.toFixed(2) + '，主导为' + dominantLabel
      : '命运网尚疏，无突出牵引';
    const alternativeBranches = [
      '延后：今岁未至，回响退入雾中',
      '转化：旧缘未断，转为新的因缘',
      '断绝：若强行斩断，回响或就此消散',
    ];
    out.push({
      age,
      predictedEvent,
      probability,
      rationale,
      alternativeBranches,
    });
  }
  return out;
}

// 命运网 prompt 摘要：把命运网压缩为 AI 上下文可用的中文短摘要，限制字符数。
//  - web:        当前命运网
//  - charLimit:  字符上限（默认 240）
// 返回：玩家不可见、但 AI 可读的摘要字符串（含主导类型 + 密度 + 待解决数）
export function summarizeFateWebForPrompt(
  web: FateWeb,
  charLimit: number = 240,
): string {
  const echoes = Array.isArray(web?.echoes) ? web.echoes : [];
  const resolutions = Array.isArray(web?.resolutions) ? web.resolutions : [];
  const density = typeof web?.threadDensity === 'number' ? web.threadDensity : 0;
  const dominant = web?.dominantKind ? describeFateEchoKind(web.dominantKind) : '无';
  const lines: string[] = [];
  lines.push('命运网：待解决回响 ' + echoes.length + '，已解决 ' + resolutions.length + '，织网密度 ' + density.toFixed(2) + '，主导类型 ' + dominant);
  const sampleCount = Math.min(echoes.length, 3);
  for (let i = 0; i < sampleCount; i++) {
    const e = echoes[i];
    if (!e) continue;
    lines.push('- [' + describeFateEchoKind(e.kind) + '] ' + (e.narrativeHook || '回响待应'));
  }
  let summary = lines.join('\n');
  if (summary.length > charLimit) summary = summary.slice(0, Math.max(0, charLimit - 1)) + '…';
  return summary;
}

// 内部辅助：把 FateEchoKind 翻成中文短语（AI prompt 友好）。
function describeFateEchoKind(kind: FateEchoKind): string {
  switch (kind) {
    case FateEchoKind.CharacterCallback: return '人物回响';
    case FateEchoKind.PlaceResonance: return '地点回响';
    case FateEchoKind.ItemRecall: return '物品回响';
    case FateEchoKind.PromiseFulfillment: return '誓约回响';
    case FateEchoKind.KarmaDebt: return '因果回响';
    case FateEchoKind.DestinyCollision: return '命数碰撞';
    default: return '命运回响';
  }
}
// ==================== Phase-J Worker C 跨函数因果连贯校验 ====================
// AI-J5xx 跨系统连贯校验：修真特异化（constitution）/ 传承（inheritance）/
// 命运回响（fateEcho）/ 宗门（sect）四类状态之间的引用是否断裂。
// 设计原则：纯校验、纯函数、不动现有数据结构；输出可被 AI 上下文消费
// 的"因果链健康摘要"，并给世界内叙事提供衔接建议。

/**
 * AI-J521: 跨系统连贯性校验
 *  - character:           当前角色（用于自比对：是否在传承根上、是否被某个
 *                         命运回响的目标、是否属于宗门等）
 *  - inheritanceChain:    一条传承链（可为 null）
 *  - fateEchoes:          命运回响列表（可为 null）
 *  - sectState:           角色当前宗门状态（{ sectId, sectName, role, ... }）
 * 返回 { breaks: [{ system, severity, reason }] }，severity ∈ info|warn|error。
 *  - error: 引用缺失或明显冲突
 *  - warn:  可能因叙事尚未展开导致的潜在断裂
 *  - info:  仅供 AI 知晓的提示（如传承链过短、无当前宗门）
 */
export function validateCrossSystemContinuity(
  character: any,
  inheritanceChain: InheritanceChain | null,
  fateEchoes: FateEchoTrigger[] | null,
  sectState: { sectId?: string; sectName?: string; role?: string; [k: string]: any } | null,
): { breaks: Array<{ system: string; severity: 'info' | 'warn' | 'error'; reason: string }> } {
  const charId = typeof character?.id === 'string' ? character.id : null;
  const breaks: Array<{ system: string; severity: 'info' | 'warn' | 'error'; reason: string }> = [];
  const echoes = Array.isArray(fateEchoes) ? fateEchoes : [];
  const chain = inheritanceChain;

  // 1. 传承链交叉：rootCharacterId 不能为空；当前角色若是某代接收人
  //    应能在 generations 里被找到。兼容扁平与嵌套两种形式：
  //    - 扁平：generations = [recipient, recipient, ...]
  //    - 嵌套：generations = [[recipient, ...], [recipient, ...], ...]
  if (chain) {
    if (!chain.rootCharacterId || typeof chain.rootCharacterId !== 'string') {
      breaks.push({ system: 'inheritance', severity: 'error', reason: '传承链缺少根角色 id（rootCharacterId）' });
    } else {
      const generations = Array.isArray(chain.generations) ? chain.generations : [];
      let foundChar = false;
      for (const genOrRec of generations) {
        if (Array.isArray(genOrRec)) {
          for (const rec of genOrRec) {
            if (rec && rec.targetCharacterId === charId) { foundChar = true; break; }
          }
        } else if (genOrRec && typeof genOrRec === 'object' && (genOrRec as any).targetCharacterId === charId) {
          foundChar = true;
        }
        if (foundChar) break;
      }
      if (charId && !foundChar) {
        breaks.push({ system: 'inheritance', severity: 'info', reason: '当前角色尚未出现在传承链 generations 中（属正常：尚未承接）' });
      }
    }
    if (Array.isArray(chain.activeClaims)) {
      for (const c of chain.activeClaims) {
        if (!c || !c.recipientId || typeof c.recipientId !== 'string') {
          breaks.push({ system: 'inheritance', severity: 'error', reason: '传承链中存在 recipientId 缺失的 claim' });
        }
      }
    }
  }

  // 2. 命运回响交叉：每个 echo 必须有 id 与 source/target
  for (let i = 0; i < echoes.length; i++) {
    const e = echoes[i];
    if (!e || !e.id || typeof e.id !== 'string') {
      breaks.push({ system: 'fateEcho', severity: 'error', reason: '命运回响 #' + (i + 1) + ' 缺少 id' });
      continue;
    }
    if (!e.sourceCharacterId || typeof e.sourceCharacterId !== 'string') {
      breaks.push({ system: 'fateEcho', severity: 'error', reason: '回响 [' + e.id + '] 缺少 sourceCharacterId' });
    }
    if (!e.targetCharacterId || typeof e.targetCharacterId !== 'string') {
      breaks.push({ system: 'fateEcho', severity: 'warn', reason: '回响 [' + e.id + '] 缺少 targetCharacterId（可能是有意为之的世界回响）' });
    }
  }

  // 3. 宗门交叉：sectState 与命运回响的 source/target 是否冲突
  if (sectState && typeof sectState.sectId === 'string' && sectState.sectId.length > 0) {
    // 若当前宗门有宗主/长老类命运回响，应能关联到宗门叙事
    for (const e of echoes) {
      if (!e) continue;
      if (typeof e.narrativeHook !== 'string') continue;
      if (e.narrativeHook.indexOf(sectState.sectId) >= 0 && !e.sourceCharacterId) {
        breaks.push({ system: 'sect', severity: 'warn', reason: '回响 [' + (e.id || '?') + '] 提到当前宗门但缺少 sourceCharacterId' });
      }
    }
  } else if (echoes.length > 0) {
    // 角色无宗门但有牵涉宗门的回响
    const sectHint = echoes.some(e => e && typeof e.narrativeHook === 'string' && /(宗门|门派|山门|阁|峰|谷|宫)/.test(e.narrativeHook));
    if (sectHint) {
      breaks.push({ system: 'sect', severity: 'info', reason: '角色尚无宗门，但命运回响里出现宗门/门派类关键词' });
    }
  }

  // 4. 修真特异化（constitution）与命运回响的连接：若角色 constitution 是命运系
  //    且回响主导为 karma-debt 或 destiny-collision，应标注提示
  if (character && character.constitution && typeof character.constitution === 'object') {
    const cat = character.constitution.category;
    if (cat === 'fate' || cat === 'karma') {
      const fateCount = echoes.filter((e: any) => e && (e.kind === FateEchoKind.KarmaDebt || e.kind === FateEchoKind.DestinyCollision)).length;
      if (fateCount === 0 && echoes.length > 0) {
        breaks.push({ system: 'constitution', severity: 'info', reason: '角色具备命运/因果系特异化，但当前回响中无因果/命数碰撞类节点' });
      }
    }
  }

  return { breaks };
}

/**
 * AI-J522: 找出指向不存在 ID 的跨系统引用
 *  - character:        当前角色（只用于日志和上下文）
 *  - allChains:        全部传承链（提供合法的 recipientId / rootCharacterId 集合）
 *  - allEchoes:        全部命运回响（提供合法的 echo id 集合）
 *  - allSects:         全部宗门节点（提供合法的 sectId 集合）
 * 返回 [{ refId, expectedSystem, actualSystem }]。
 * 注意：实际查找的"引用"主要来自 echoes 与 chain 的 activeClaims；
 * 如果某 echo 的 source/target 在其他系统里都不存在，则记录为 broken。
 */
export function findBrokenCrossRefs(
  character: any,
  allChains: InheritanceChain[] | null,
  allEchoes: FateEchoTrigger[] | null,
  allSects: SectNode[] | null,
): Array<{ refId: string; expectedSystem: string; actualSystem: string }> {
  const out: Array<{ refId: string; expectedSystem: string; actualSystem: string }> = [];
  // Collect known good ids first, then scan refs; this prevents claim.recipientId
  // from masking itself by being added to chainIds before the broken check.
  const knownChainIds = new Set<string>();
  const chainRoots = new Set<string>();
  const claimRecipientIds = [];
  if (Array.isArray(allChains)) {
    for (const ch of allChains) {
      if (!ch) continue;
      if (ch.rootCharacterId) chainRoots.add(ch.rootCharacterId);
      const gens = Array.isArray(ch.generations) ? ch.generations : [];
      for (const g of gens) {
        // Support both flat (single recipient) and nested (recipient[]) shapes.
        if (Array.isArray(g)) {
          for (const r of g) {
            if (r && r.targetCharacterId) knownChainIds.add(r.targetCharacterId);
            if (r && r.sourceCharacterId) knownChainIds.add(r.sourceCharacterId);
          }
        } else if (g && typeof g === 'object') {
          const rec = g;
          if (rec.targetCharacterId) knownChainIds.add(rec.targetCharacterId);
          if (rec.sourceCharacterId) knownChainIds.add(rec.sourceCharacterId);
        }
      }
      if (Array.isArray(ch.activeClaims)) {
        for (const c of ch.activeClaims) {
          if (c && c.recipientId) claimRecipientIds.push(c.recipientId);
        }
      }
    }
  }
  const chainIds = knownChainIds;
  // The character itself is a known entity: add its id to the known set.
  if (character && typeof character.id === 'string' && character.id.length > 0) {
    chainIds.add(character.id);
  }
  // Also accept a list of known character ids passed alongside the character.
  if (character && Array.isArray(character.knownCharacterIds)) {
    for (const kcid of character.knownCharacterIds) {
      if (typeof kcid === 'string' && kcid.length > 0) chainIds.add(kcid);
    }
  }

  const echoIds = new Set<string>();
  const echoSources = new Set<string>();
  if (Array.isArray(allEchoes)) {
    for (const e of allEchoes) {
      if (!e) continue;
      if (e.id) echoIds.add(e.id);
      if (e.sourceCharacterId) echoSources.add(e.sourceCharacterId);
      if (e.targetCharacterId) echoSources.add(e.targetCharacterId);
    }
  }
  const sectIds = new Set<string>();
  if (Array.isArray(allSects)) {
    for (const s of allSects) {
      if (s && s.id) sectIds.add(s.id);
    }
  }

  // 检查每个 echo 的 source/target 是否能在任意一个系统里被定位
  if (Array.isArray(allEchoes)) {
    for (const e of allEchoes) {
      if (!e) continue;
      const tag = e.id || '(no-id)';
      // source 应在传承链的 generations 或 roots 集合中，或在其它 echo 的 source 集合中
      if (e.sourceCharacterId) {
        const inChain = chainIds.has(e.sourceCharacterId) || chainRoots.has(e.sourceCharacterId);
        if (!chainIds.has(e.sourceCharacterId) && !chainRoots.has(e.sourceCharacterId)) {
          out.push({ refId: e.sourceCharacterId, expectedSystem: 'fateEcho.source', actualSystem: 'unknown' });
        }
      }
      if (e.targetCharacterId) {
        const inChain = chainIds.has(e.targetCharacterId) || chainRoots.has(e.targetCharacterId);
        if (!chainIds.has(e.targetCharacterId) && !chainRoots.has(e.targetCharacterId)) {
          out.push({ refId: e.targetCharacterId, expectedSystem: 'fateEcho.target', actualSystem: 'unknown' });
        }
      }
    }
  }

  // 检查 chain.activeClaims 的 recipientId 是否能在 echo 或其它 chain 找到
  // Check each collected claim.recipientId against the (pre-augment) known id set.
  for (const rid of claimRecipientIds) {
    if (!rid) continue;
    if (chainIds.has(rid) || chainRoots.has(rid) || echoIds.has(rid)) continue;
    // Not found in any known system: flag as broken.
    out.push({ refId: rid, expectedSystem: 'inheritance.claim.recipient', actualSystem: 'unknown' });
  }

  // 角色宗门是否在宗门节点集合中
  if (character && typeof character.sectId === 'string' && character.sectId.length > 0) {
    if (!sectIds.has(character.sectId)) {
      out.push({ refId: character.sectId, expectedSystem: 'sect.node', actualSystem: 'unknown' });
    }
  }

  return out;
}

/**
 * AI-J523: 命运回响与传承池的衔接性判断
 *  - fateEcho:        命运回响（其 source/target/urgency 等）
 *  - inheritancePool: 传承池（其 kind/host/availableSlots 等）
 * 返回 { compatible, suggestedNarrative }：
 *  - compatible:           是否能衔接（age、kind、host 都对得上）
 *  - suggestedNarrative:   给出世界内可读的衔接描述（用于 AI 上下文或玩家旁白）
 */
export function reconcileFateAndInheritance(
  fateEcho: FateEchoTrigger,
  inheritancePool: InheritancePool,
): { compatible: boolean; suggestedNarrative: string } {
  if (!fateEcho || typeof fateEcho !== 'object') {
    return { compatible: false, suggestedNarrative: '回响不存在，无法与传承池衔接' };
  }
  if (!inheritancePool || typeof inheritancePool !== 'object') {
    return { compatible: false, suggestedNarrative: '传承池不存在，无法与回响衔接' };
  }
  if (typeof inheritancePool.availableSlots !== 'number' || inheritancePool.availableSlots <= 0) {
    return { compatible: false, suggestedNarrative: '传承池名额已尽，回响暂无可承接之位' };
  }

  // 类别匹配：物品/因果回响可与法器/血脉类传承衔接；人物/地点回响
  // 可与师徒/门派类传承衔接
  const kind = inheritancePool.kind;
  let categoryMatch = false;
  if (kind === 'master-disciple' || kind === 'bloodline' || kind === 'mentor-guild') {
    categoryMatch = fateEcho.kind === FateEchoKind.CharacterCallback || fateEcho.kind === FateEchoKind.PlaceResonance || fateEcho.kind === FateEchoKind.PromiseFulfillment;
  } else if (kind === 'artifact' || kind === 'secret-tome' || kind === 'talisman') {
    categoryMatch = fateEcho.kind === FateEchoKind.ItemRecall || fateEcho.kind === FateEchoKind.KarmaDebt;
  } else {
    // 兜底：命数碰撞通常与任何传承可衔接
    categoryMatch = fateEcho.kind === FateEchoKind.DestinyCollision;
  }

  // 角色代际匹配：回响的 source 出现在传承池 hostCharacterIds 里视为强关联
  let strongLink = false;
  if (Array.isArray(inheritancePool.hostCharacterIds) && fateEcho.sourceCharacterId) {
    strongLink = inheritancePool.hostCharacterIds.indexOf(fateEcho.sourceCharacterId) >= 0;
  }

  const compatible = categoryMatch || strongLink;
  let narrative: string;
  if (strongLink) {
    narrative = '回响之源恰在传承池宿主之列（' + (inheritancePool.name || inheritancePool.id) + '），可顺势承接而解';
  } else if (categoryMatch) {
    narrative = '回响类属与传承池相合（' + (inheritancePool.name || inheritancePool.id) + '），可借其位而解';
  } else {
    narrative = '回响与传承池类属暂不相合，需另寻他法或等待传承池轮转';
  }
  if (fateEcho.urgency === 'critical' && !strongLink) {
    narrative += '；回响紧迫，宿主可考虑破例延请';
  }
  return { compatible, suggestedNarrative: narrative };
}

/**
 * AI-J524: 给 AI 上下文的"因果链健康摘要"
 *  - character:  当前角色（用于拼接开头）
 *  - breaks:     validateCrossSystemContinuity 返回的 breaks 列表（允许外部注入）
 *                若不传则自动调用一次 validateCrossSystemContinuity（传入 null 系统）
 * 返回：限制字符数的中文短摘要，含 breaks 计数、严重度分布、关键提示。
 * 玩家不可见，仅 AI prompt 使用。
 */
export function summarizeContinuityForPrompt(
  character: any,
  breaks: Array<{ system: string; severity: string; reason: string }> | null,
  charLimit: number = 240,
): string {
  let list: Array<{ system: string; severity: string; reason: string }>;
  if (Array.isArray(breaks)) {
    list = breaks;
  } else {
    const fallback = validateCrossSystemContinuity(character, null, null, null);
    list = fallback.breaks;
  }
  const errCount = list.filter(b => b && b.severity === 'error').length;
  const warnCount = list.filter(b => b && b.severity === 'warn').length;
  const infoCount = list.filter(b => b && b.severity === 'info').length;
  const name = (character && (character.name || character.id)) || '当前角色';
  const lines: string[] = [];
  lines.push('因果链健康：' + name + '（error=' + errCount + ', warn=' + warnCount + ', info=' + infoCount + '）');
  const sampleCount = Math.min(list.length, 4);
  for (let i = 0; i < sampleCount; i++) {
    const b = list[i];
    if (!b) continue;
    lines.push('- [' + (b.severity || '?') + '·' + (b.system || '?') + '] ' + (b.reason || '需关注'));
  }
  let summary = lines.join('\n');
  if (summary.length > charLimit) summary = summary.slice(0, Math.max(0, charLimit - 1)) + '…';
  return summary;
}

// ======================== Phase-J Worker B (anti-pattern-collapse): UI Slot Boundary Guard ========================
// Additive only. These four exports protect the slot registry from AI-generated
// categories / displayGroup / tone / renderHint that do not match the whitelist
// enforced by src/lib/xianxia/display-registry.ts.
//
// The engine should be the last line of defense BEFORE the frontend renders a
// slot, so the constraints here mirror what display-registry.ts already does
// (SLOT_SET + category heuristics). We also expose a heuristic text->slot
// inferrer for upstream AI prompts, and a stable "currently registered slots"
// summary that can be injected into the LLM system prompt.

// Canonical sets - must stay in sync with display-registry.ts.
const SLOT_BOUNDARY_KNOWN_SLOTS: ReadonlyArray<string> = [
  "topTags",
  "characterDetail",
  "statusPage",
  "threadPage",
  "combatPanel",
  "inventoryPanel",
  "worldLegacy",
];
const SLOT_BOUNDARY_KNOWN_TONES: ReadonlyArray<string> = [
  "neutral",
  "good",
  "bad",
  "rare",
  "danger",
  "mystery",
];
const SLOT_BOUNDARY_KNOWN_RENDER_HINTS: ReadonlyArray<string> = [
  "badge",
  "card",
  "meter",
  "timeline",
  "action",
  "detail",
];
// Whitelisted display groups (matches groupFromStatus in display-registry.ts).
const SLOT_BOUNDARY_KNOWN_GROUPS: ReadonlyArray<string> = [
  "identity",
  "constitution",
  "attribute",
  "fate",
  "debuff",
  "buff",
  "misc",
];
// Whitelisted categories (the engine creates these; AI should pick from this
// list or rely on inference / clamping).
const SLOT_BOUNDARY_KNOWN_CATEGORIES: ReadonlyArray<string> = [
  "attribute",
  "status",
  "special",
  "identity",
  "quest",
  "thread",
  "fate",
  "injury",
  "buff",
  "debuff",
  "constitution",
  "item",
  "technique",
  "realm",
  "misc",
  "uncategorized",
];

// Quick-lookup sets (built once at module load).
const SLOT_BOUNDARY_SLOT_SET: Set<string> = new Set(SLOT_BOUNDARY_KNOWN_SLOTS);
const SLOT_BOUNDARY_TONE_SET: Set<string> = new Set(SLOT_BOUNDARY_KNOWN_TONES);
const SLOT_BOUNDARY_RENDER_HINT_SET: Set<string> = new Set(SLOT_BOUNDARY_KNOWN_RENDER_HINTS);
const SLOT_BOUNDARY_GROUP_SET: Set<string> = new Set(SLOT_BOUNDARY_KNOWN_GROUPS);
const SLOT_BOUNDARY_CATEGORY_SET: Set<string> = new Set(SLOT_BOUNDARY_KNOWN_CATEGORIES);

// 1) validateUISlotMapping
//  - slot: a partial slot mapping that AI / pipeline produced
//  - returns: { valid: boolean, warnings: string[] }
//    valid is true ONLY when no required field is missing AND every present
//    field passes its whitelist. warnings collects soft issues (e.g. extra
//    unknown displaySlots, empty displayGroup) so callers can choose to log
//    but still render.
export interface UISlotMappingInput {
  category?: string;
  displayGroup?: string;
  displaySlots?: string[];
  tone?: string;
  renderHint?: string;
}
export interface UISlotValidationResult {
  valid: boolean;
  warnings: string[];
}
export function validateUISlotMapping(slot: UISlotMappingInput | null | undefined): UISlotValidationResult {
  const warnings: string[] = [];
  if (!slot || typeof slot !== "object") {
    return { valid: false, warnings: ["slot_missing"] };
  }
  let valid = true;

  // category: required, must be in whitelist
  if (typeof slot.category !== "string" || slot.category.length === 0) {
    warnings.push("category_missing");
    valid = false;
  } else if (!SLOT_BOUNDARY_CATEGORY_SET.has(slot.category)) {
    warnings.push("category_unknown:" + slot.category);
    valid = false;
  }

  // displayGroup: recommended, must be in whitelist when present
  if (slot.displayGroup === undefined || slot.displayGroup === null || slot.displayGroup === "") {
    warnings.push("displayGroup_missing");
  } else if (typeof slot.displayGroup !== "string" || !SLOT_BOUNDARY_GROUP_SET.has(slot.displayGroup)) {
    warnings.push("displayGroup_unknown:" + String(slot.displayGroup));
  }

  // displaySlots: must be an array; every entry must be in the slot whitelist
  if (slot.displaySlots === undefined || slot.displaySlots === null) {
    warnings.push("displaySlots_missing");
  } else if (!Array.isArray(slot.displaySlots)) {
    warnings.push("displaySlots_not_array");
    valid = false;
  } else {
    if (slot.displaySlots.length === 0) {
      warnings.push("displaySlots_empty");
    }
    const seen: Set<string> = new Set();
    for (const s of slot.displaySlots) {
      if (typeof s !== "string") {
        warnings.push("displaySlots_non_string_entry");
        valid = false;
        continue;
      }
      if (!SLOT_BOUNDARY_SLOT_SET.has(s)) {
        warnings.push("displaySlots_unknown:" + s);
        valid = false;
      }
      if (seen.has(s)) {
        warnings.push("displaySlots_duplicate:" + s);
      }
      seen.add(s);
    }
  }

  // tone: must be in whitelist when present
  if (slot.tone === undefined || slot.tone === null) {
    warnings.push("tone_missing");
  } else if (typeof slot.tone !== "string" || !SLOT_BOUNDARY_TONE_SET.has(slot.tone)) {
    warnings.push("tone_unknown:" + String(slot.tone));
  }

  // renderHint: must be in whitelist when present
  if (slot.renderHint === undefined || slot.renderHint === null) {
    warnings.push("renderHint_missing");
  } else if (typeof slot.renderHint !== "string" || !SLOT_BOUNDARY_RENDER_HINT_SET.has(slot.renderHint)) {
    warnings.push("renderHint_unknown:" + String(slot.renderHint));
  }

  return { valid, warnings };
}

// 2) clampCategoryToKnownSlot
//  - slot: a slot mapping (any shape, the function only cares about category + displayGroup)
//  - knownCategories: Set of categories the caller is willing to accept
//  - returns: { clampedSlot, fallbackUsed }
//    When category is unknown, replaces it with "misc" (or "uncategorized" if
//    "misc" is also not in knownCategories). The returned slot is a shallow
//    copy so callers can mutate it without touching the input.
export interface UISlotClampResult {
  clampedSlot: UISlotMappingInput;
  fallbackUsed: boolean;
}
export function clampCategoryToKnownSlot(
  slot: UISlotMappingInput | null | undefined,
  knownCategories: Set<string> | ReadonlyArray<string> | null | undefined,
): UISlotClampResult {
  const base: UISlotMappingInput = slot && typeof slot === "object" ? { ...slot } : {};
  const known: Set<string> = knownCategories instanceof Set
    ? knownCategories
    : (Array.isArray(knownCategories) ? new Set(knownCategories) : new Set(SLOT_BOUNDARY_KNOWN_CATEGORIES));

  const original = typeof base.category === "string" ? base.category : "";
  let fallbackUsed = false;
  if (!original || !known.has(original)) {
    // Pick the best fallback the caller is willing to accept.
    if (known.has("misc")) {
      base.category = "misc";
    } else if (known.has("uncategorized")) {
      base.category = "uncategorized";
    } else if (known.size > 0) {
      base.category = Array.from(known)[0]!;
    } else {
      base.category = "misc";
    }
    fallbackUsed = true;
  }

  // Also clamp displayGroup if it is not in the global group set, but DO NOT
  // drop it - fall back to "misc" so the slot is still renderable.
  if (base.displayGroup && !SLOT_BOUNDARY_GROUP_SET.has(base.displayGroup)) {
    base.displayGroup = "misc";
  }

  // Filter displaySlots to known slots; if everything is filtered out, leave
  // an empty array (the caller is responsible for picking a default).
  if (Array.isArray(base.displaySlots)) {
    base.displaySlots = base.displaySlots.filter((s) => typeof s === "string" && SLOT_BOUNDARY_SLOT_SET.has(s));
  }

  // Clamp tone / renderHint to the global whitelists.
  if (base.tone && !SLOT_BOUNDARY_TONE_SET.has(base.tone)) {
    base.tone = "neutral";
  }
  if (base.renderHint && !SLOT_BOUNDARY_RENDER_HINT_SET.has(base.renderHint)) {
    base.renderHint = "badge";
  }

  return { clampedSlot: base, fallbackUsed };
}

// 3) inferSlotFromNarrativeText
//  - text: a piece of narrative (event draft, status prose, item description)
//  - hints: optional string array of pre-classification hints
//  - returns: { suggestedCategory, suggestedDisplayGroup, confidence (0..1) }
//    Pure heuristic. Uses ASCII pinyin + Latin keyword matching + hint bonus;
//    never throws. Confidence falls back to 0.3 on totally unrecognized text
//    so callers can decide whether to trust the inference.
export interface UISlotInferenceResult {
  suggestedCategory: string;
  suggestedDisplayGroup: string;
  confidence: number;
}
// Pinyin / Latin keyword table - chosen so the source stays ASCII-safe and
// grep-friendly. Each rule contributes a weight when its regex matches.
const SLOT_BOUNDARY_KEYWORD_RULES: ReadonlyArray<{ key: string; group: string; category: string; weight: number }> = [
  { key: "tizhi|jiangu|daotai|xuemai|physique|constitution", group: "constitution", category: "constitution", weight: 1.0 },
  { key: "tianfu|linggen|wuxing|qiyun|attribute|talent|spiritualRoot", group: "attribute", category: "attribute", weight: 0.95 },
  { key: "shenfen|zongmen|zhiwei|identity|faction|role|sect", group: "identity", category: "identity", weight: 0.9 },
  { key: "xianyuan|yinyuan|chuancheng|yinji|yixiang|fate|karma|omen|destiny", group: "fate", category: "fate", weight: 0.9 },
  { key: "shoushang|zhoudu|wandu|xinmo|injury|curse|wound|poison|debuff", group: "debuff", category: "debuff", weight: 0.85 },
  { key: "zengyi|zhufu|jiachi|buff|blessing", group: "buff", category: "buff", weight: 0.85 },
  { key: "dongzuo|fashu|jinzhi|action|skill|move|combat|chongtu|technique|spell", group: "misc", category: "technique", weight: 0.7 },
  { key: "wupin|lingbao|fabao|lingpai|item|loot|relic|talisman", group: "misc", category: "item", weight: 0.7 },
  { key: "xianji|jingjie|realm|breakthrough|cultivation", group: "misc", category: "realm", weight: 0.7 },
  { key: "shijian|weituo|renwu|quest|task|mission", group: "misc", category: "quest", weight: 0.6 },
  { key: "xiansuo|weiwan|zhongduo|thread|unfinished", group: "fate", category: "thread", weight: 0.7 },
];
const SLOT_BOUNDARY_HINT_BONUS: ReadonlyArray<{ key: string; group: string; category: string; weight: number }> = [
  { key: "identity|faction|role|shenfen|zongmen", group: "identity", category: "identity", weight: 0.2 },
  { key: "constitution|physique|tizhi|jiangu", group: "constitution", category: "constitution", weight: 0.2 },
  { key: "attribute|talent|tianfu|linggen", group: "attribute", category: "attribute", weight: 0.2 },
  { key: "fate|karma|omen|thread|xianyuan|yinyuan", group: "fate", category: "fate", weight: 0.2 },
  { key: "debuff|injury|poison|curse|shoushang|zhoudu", group: "debuff", category: "debuff", weight: 0.2 },
  { key: "buff|blessing|zengyi|zhufu", group: "buff", category: "buff", weight: 0.2 },
  { key: "item|loot|relic|wupin|lingbao", group: "misc", category: "item", weight: 0.15 },
  { key: "technique|skill|action|fashu|jinzhi", group: "misc", category: "technique", weight: 0.15 },
  { key: "realm|breakthrough|jingjie|cultivation", group: "misc", category: "realm", weight: 0.15 },
];
export function inferSlotFromNarrativeText(
  text: string | null | undefined,
  hints?: string[] | null,
): UISlotInferenceResult {
  const safeText = typeof text === "string" ? text.toLowerCase() : "";
  const safeHints = Array.isArray(hints) ? hints.filter((h) => typeof h === "string") : [];
  const scores = new Map<string, { group: string; category: string; score: number }>();

  for (const rule of SLOT_BOUNDARY_KEYWORD_RULES) {
    try {
      const re = new RegExp(rule.key, "i");
      if (re.test(safeText)) {
        const key = rule.group + "|" + rule.category;
        const cur = scores.get(key) || { group: rule.group, category: rule.category, score: 0 };
        cur.score += rule.weight;
        scores.set(key, cur);
      }
    } catch {
      // ignore bad regex (defensive)
    }
  }
  for (const hint of safeHints) {
    for (const rule of SLOT_BOUNDARY_HINT_BONUS) {
      try {
        const re = new RegExp(rule.key, "i");
        if (re.test(hint.toLowerCase())) {
          const key = rule.group + "|" + rule.category;
          const cur = scores.get(key) || { group: rule.group, category: rule.category, score: 0 };
          cur.score += rule.weight;
          scores.set(key, cur);
        }
      } catch {
        // ignore bad regex
      }
    }
  }

  if (scores.size === 0) {
    return { suggestedCategory: "misc", suggestedDisplayGroup: "misc", confidence: 0.3 };
  }
  let best: { group: string; category: string; score: number } | null = null;
  for (const v of scores.values()) {
    if (!best || v.score > best.score) best = v;
  }
  if (!best) {
    return { suggestedCategory: "misc", suggestedDisplayGroup: "misc", confidence: 0.3 };
  }
  // Normalize confidence: best.score is roughly 0.7-1.4 in practice; cap at 1.
  const confidence = Math.max(0.3, Math.min(1, best.score / 1.2));
  return {
    suggestedCategory: best.category,
    suggestedDisplayGroup: best.group,
    confidence,
  };
}

// 4) summarizeSlotMappingForPrompt
//  - activeSlots: array of registered slot mappings (any shape; we read
//    category / displayGroup / displaySlots / tone / renderHint defensively)
//  - charLimit: max characters of the produced summary (default 480)
//  - returns: a single string suitable for injection into the AI system prompt
//    so the LLM knows which slot vocabulary is currently legal. Falls back
//    to a one-line "no slots registered" string on empty input.
export function summarizeSlotMappingForPrompt(
  activeSlots: ReadonlyArray<UISlotMappingInput> | null | undefined,
  charLimit: number = 480,
): string {
  const limit = Math.max(40, Math.floor(charLimit));
  const slots = Array.isArray(activeSlots) ? activeSlots.filter((s) => s && typeof s === "object") : [];
  if (slots.length === 0) {
    return "[UI slot registry] no slots registered; use misc fallback category.";
  }
  const lines: string[] = [];
  lines.push("[UI slot registry] " + slots.length + " slots currently registered; do not invent new categories:");
  // Unique categories (in registration order)
  const cats: string[] = [];
  for (const s of slots) {
    if (s.category && !cats.includes(s.category)) cats.push(s.category);
  }
  lines.push("- registered categories: " + (cats.length ? cats.join(", ") : "(none)"));
  // Unique displaySlots
  const slotList: string[] = [];
  for (const s of slots) {
    if (Array.isArray(s.displaySlots)) {
      for (const sl of s.displaySlots) {
        if (typeof sl === "string" && !slotList.includes(sl)) slotList.push(sl);
      }
    }
  }
  lines.push("- registered displaySlots: " + (slotList.length ? slotList.join(", ") : "(none)"));
  // Tone palette actually in use
  const tones: string[] = [];
  for (const s of slots) {
    if (s.tone && !tones.includes(s.tone)) tones.push(s.tone);
  }
  lines.push("- tone palette: " + (tones.length ? tones.join(", ") : "neutral"));
  // Top 3 render hints
  const renderHints: string[] = [];
  for (const s of slots) {
    if (s.renderHint && !renderHints.includes(s.renderHint)) renderHints.push(s.renderHint);
  }
  lines.push("- renderHint hints: " + (renderHints.length ? renderHints.slice(0, 3).join(", ") : "badge/card"));
  // Sample of display groups (max 4)
  const groups: string[] = [];
  for (const s of slots) {
    if (s.displayGroup && !groups.includes(s.displayGroup)) groups.push(s.displayGroup);
  }
  lines.push("- displayGroup samples: " + (groups.length ? groups.slice(0, 4).join(", ") : "misc"));
  let summary = lines.join("\n");
  if (summary.length > limit) summary = summary.slice(0, Math.max(0, limit - 1)) + "\u2026";
  return summary;
}

// ==================== Phase-J Worker A 文本去重与心跳检测 ====================
// AI-J501~J504：检测并防止模式崩溃 ——
//   1. detectRepetitiveText        最近 windowSize 条 narrative 中的重复字符串
//   2. deduplicateNarrativeHooks   与已存在 hook 的相似度去重（>0.7 丢弃）
//   3. detectStaleTemplatePhrases  检测 AI 输出是否复用模板口头禅
//   4. summarizeTextHealthForPrompt 给 AI 上下文的"最近文字风格摘要"
//
// 这些函数只读 narrative/事件 metadata，不改状态、不调外部副作用；
// 引擎在收 AI 输出后用它们做静态校验，配合 prompt 双层保险。

// 计算两个字符串的 Jaccard 字符 bigram 相似度（0~1）。
function _bigramJaccardSimilarity(a: string, b: string): number {
  if (typeof a !== 'string' || typeof b !== 'string') return 0;
  if (a.length === 0 || b.length === 0) return 0;
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa === bb) return 1;
  const gramsA = new Map<string, number>();
  for (let i = 0; i < aa.length - 1; i++) {
    const g = aa.substring(i, i + 2);
    gramsA.set(g, (gramsA.get(g) || 0) + 1);
  }
  let inter = 0;
  const gramsB = new Map<string, number>();
  for (let i = 0; i < bb.length - 1; i++) {
    const g = bb.substring(i, i + 2);
    gramsB.set(g, (gramsB.get(g) || 0) + 1);
  }
  for (const [g, cnt] of gramsB.entries()) {
    const a = gramsA.get(g) || 0;
    inter += Math.min(a, cnt);
  }
  const denom = gramsA.size + gramsB.size - inter;
  if (gramsA.size === 0 || gramsB.size === 0) return 0;
  if (denom <= 0) return 1;
  return inter / denom;
}

/**
 * AI-J501: 在最近 windowSize 条 narrative 中找出重复字符串
 *  - texts:     按时间顺序排列的 narrative 文本列表（最新在末尾）
 *  - windowSize: 窗口大小（取最后 windowSize 条），<=0 或 > texts.length 时取全部
 *  返回 { duplicates: Array<{ text, count, lastSeenAt }> }
 *    - text:       重复出现的原文（取最后一次出现的字面量）
 *    - count:      在窗口内出现次数（>=2 才会被报告）
 *    - lastSeenAt: 在窗口中的 1-based 位置（窗口内最后一处）
 * 匹配规则：trim 后完全相等视为重复；空字符串与长度 < 2 的串被忽略（避免噪声）。
 */
export function detectRepetitiveText(
  texts: string[],
  windowSize: number,
): { duplicates: Array<{ text: string; count: number; lastSeenAt: number }> } {
  const list = Array.isArray(texts) ? texts : [];
  const size = (typeof windowSize === 'number' && windowSize > 0) ? Math.min(windowSize, list.length) : list.length;
  const window = list.slice(list.length - size);
  const seen = new Map<string, { text: string; count: number; lastSeenAt: number }>();
  for (let i = 0; i < window.length; i++) {
    const raw = window[i];
    if (typeof raw !== 'string') continue;
    const norm = raw.trim();
    if (norm.length < 2) continue;
    const key = norm;
    const existing = seen.get(key);
    if (existing) {
      existing.count++;
      existing.lastSeenAt = i + 1;
      existing.text = raw;
    } else {
      seen.set(key, { text: raw, count: 1, lastSeenAt: i + 1 });
    }
  }
  const duplicates: Array<{ text: string; count: number; lastSeenAt: number }> = [];
  for (const rec of seen.values()) {
    if (rec.count >= 2) duplicates.push(rec);
  }
  duplicates.sort((a, b) => (b.count - a.count) || (b.lastSeenAt - a.lastSeenAt));
  return { duplicates };
}

/**
 * AI-J502: 与已存在 hook 比较，相似度 > threshold 的丢掉（默认 0.7）
 *  - hooks:         候选 hook 列表
 *  - existingHooks: 已存在的 hook 列表（被丢弃的 hook 也按已存在对待）
 *  - threshold:     相似度阈值（可选，默认 0.7）
 *  返回 { kept, dropped }，保持原顺序；空串/非字符串被跳过。
 * 相似度算法：Jaccard 字符 bigram；完全相等视作 1.0。
 */
export function deduplicateNarrativeHooks(
  hooks: string[],
  existingHooks: string[],
  threshold?: number,
): { kept: string[]; dropped: string[] } {
  const candidates = Array.isArray(hooks) ? hooks.filter((h): h is string => typeof h === 'string') : [];
  const seed = Array.isArray(existingHooks) ? existingHooks.filter((h): h is string => typeof h === 'string') : [];
  const limit = (typeof threshold === 'number' && threshold >= 0 && threshold <= 1) ? threshold : 0.7;
  const kept: string[] = [];
  const dropped: string[] = [];
  const seen = seed.slice();
  for (const h of candidates) {
    if (h.trim().length < 2) { dropped.push(h); continue; }
    let tooSimilar = false;
    for (const e of seen) {
      const sim = _bigramJaccardSimilarity(h, e);
      if (sim > limit) { tooSimilar = true; break; }
    }
    if (tooSimilar) {
      dropped.push(h);
    } else {
      kept.push(h);
      seen.push(h);
    }
  }
  return { kept, dropped };
}

/**
 * AI-J503: 检测 AI 输出是否复用模板口头禅
 *  - events:          事件数组，每个至少含 { id, narrative?, text?, summary? }
 *                     引擎会扫描 string 字段里是否包含 blacklist 中任意子串
 *  - phraseBlacklist: 黑名单短语数组（如 "天机晦暗"、"细碎积累"）
 *  返回 { stale: Array<{ eventId, phrase }> }，一个 eventId 可对应多个 phrase
 * 大小写不敏感；忽略空 event、非字符串短语。
 */
export function detectStaleTemplatePhrases(
  events: any[],
  phraseBlacklist: string[],
): { stale: Array<{ eventId: string; phrase: string }> } {
  const evs = Array.isArray(events) ? events : [];
  const phrases = Array.isArray(phraseBlacklist)
    ? phraseBlacklist.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : [];
  const stale: Array<{ eventId: string; phrase: string }> = [];
  for (const e of evs) {
    if (!e || typeof e !== 'object') continue;
    const id = typeof e.id === 'string' ? e.id : '(no-id)';
    const fields: string[] = [];
    for (const key of ['narrative', 'text', 'summary', 'description', 'content']) {
      const v = (e as any)[key];
      if (typeof v === 'string') fields.push(v);
    }
    if (fields.length === 0) continue;
    const haystack = fields.join('\n').toLowerCase();
    for (const p of phrases) {
      if (haystack.indexOf(p.toLowerCase()) >= 0) {
        stale.push({ eventId: id, phrase: p });
      }
    }
  }
  return { stale };
}

/**
 * AI-J504: 给 AI 上下文的"最近文字风格摘要"
 *  - textHistory: 按时间顺序的 narrative 文本片段（最新在末尾）
 *  - charLimit:   摘要长度上限（可选，默认 280）
 *  返回一个紧凑字符串，用于注入到 AI prompt 的"近期文字风格"段。
 * 内容包含：
 *   - 样本数 / 平均长度 / 重复串数
 *   - 1-2 句用 AI 友好的中文概括整体风格（避免出现未在样本中出现的具体字眼）
 *   - 若发现模板口头禅（内置轻量黑名单），会额外提示"少用 X、Y"
 */
export function summarizeTextHealthForPrompt(
  textHistory: string[],
  charLimit?: number,
): string {
  const history = Array.isArray(textHistory) ? textHistory.filter((s): s is string => typeof s === 'string') : [];
  const sampleSize = Math.min(history.length, 6);
  const sample = history.slice(history.length - sampleSize);
  const avgLen = sampleSize > 0
    ? Math.round(sample.reduce((sum, s) => sum + s.length, 0) / sampleSize)
    : 0;
  const dupResult = detectRepetitiveText(history, 8);
  const dupCount = dupResult.duplicates.length;
  const blacklist = ['天机晦暗', '细碎积累', '冥冥之中', '此间因果', '冥冥注定'];
  const staleResult = detectStaleTemplatePhrases(
    sample.map((s, i) => ({ id: 'sample-' + (i + 1), narrative: s })),
    blacklist,
  );
  const stalePhrases: string[] = [];
  for (const s of staleResult.stale) {
    if (stalePhrases.indexOf(s.phrase) < 0) stalePhrases.push(s.phrase);
  }
  const lines: string[] = [];
  lines.push('近期文字：样本 ' + sampleSize + ' 条，平均 ' + avgLen + ' 字，重复串 ' + dupCount + ' 个。');
  if (stalePhrases.length > 0) {
    lines.push('口头禅提示：少用 "' + stalePhrases.join('"、"') + '" 等套话。');
  } else {
    lines.push('未发现模板口头禅，可继续当前语气。');
  }
  if (dupCount > 0) {
    lines.push('提示：近 ' + Math.min(history.length, 8) + ' 条中存在重复句式，请换用不同表达。');
  }
  let summary = lines.join(' ');
  const limit = (typeof charLimit === 'number' && charLimit > 0) ? charLimit : 280;
  if (summary.length > limit) summary = summary.slice(0, Math.max(0, limit - 1)) + '\u2026';
  return summary;
}



// ======================== Phase-K Worker C: LLM prompt augmentation wires (engine.ts half) ========================
// Goal: project Phase-J anti-pattern-collapse helpers (summarizeTextHealthForPrompt /
// summarizeSlotMappingForPrompt / summarizeContinuityForPrompt) into compact, well-labelled
// snippets that the LLM-side helper in llm.ts can splice into the system prompt tail.
//
// These four exports are additive only. They wrap the existing helpers and emit
// { hookName, hookPosition, promptSnippet, charLimit, snippetId } so the registry in llm.ts
// can index them by hookName and append them in a deterministic order.
//
// Contract:
//  - Each wire* returns a promptSnippet that begins with [Phase-K:<hookKey> <charLimit>] so
//    verifyLLMPromptAugmentation can detect the hook via indexOf('[Phase-K:').
//  - hookName is one of PHASE_K_LLM_PROMPT_HOOK_MARKERS.{registry,textHealth,slotMapping,continuity}.
//  - hookPosition is fixed to 'tail' (the LLM helper appends after the base system prompt).
//  - charLimit defaults to 280 (textHealth) / 480 (slotMapping) / 320 (continuity); callers can override.
//  - snippetId is per-call random so the LLM can tell when a fresh snippet was emitted.
//  - All four functions are defensive: null/undefined input never throws.

export const PHASE_K_LLM_PROMPT_HOOK_MARKERS = {
  registry: "PHASE_K_LLM_PROMPT_AUGMENTATION_REGISTRY",
  textHealth: "PHASE_K_LLM_PROMPT_HOOK_TEXT_HEALTH",
  slotMapping: "PHASE_K_LLM_PROMPT_HOOK_SLOT_MAPPING",
  continuity: "PHASE_K_LLM_PROMPT_HOOK_CROSS_SYSTEM_CONTINUITY",
};

// Marker strings llm.ts is expected to contain after wiring. Keep stable.
export interface PhaseKLLMPromptSnippet {
  hookName: string;
  hookPosition: 'tail' | 'head';
  promptSnippet: string;
  charLimit: number;
  snippetId: string;
}

export interface PhaseKLLMAugmentationVerifyResult {
  wiredCount: number;
  missingHooks: string[];
  allHooks: string[];
  registryPresent: boolean;
  sampleSnippet: string;
}

/**
 * Phase-K wire 1/4: text health snippet.
 *  - history:    recent narrative history (string[]). Last 12 entries are summarized.
 *  - limit:      optional charLimit override; default 280.
 *  Returns { hookName, hookPosition, promptSnippet, charLimit, snippetId }.
 *  The snippet is purely additive -- it does NOT mutate history or engine state.
 */
export function wireTextHealthToLLMPrompt(
  history: string[] | null | undefined,
  limit?: number,
): PhaseKLLMPromptSnippet {
  const charLimit = _phaseKClampLimit(typeof limit === 'number' ? limit : 280, 280);
  const tail = Array.isArray(history) ? history.slice(-12) : [];
  let inner = '';
  try {
    if (tail.length > 0 && typeof summarizeTextHealthForPrompt === 'function') {
      inner = summarizeTextHealthForPrompt(tail);
    } else {
      inner = '近期 0 条文本未发现重复句式或陈旧模板口癖，叙事节奏正常。';
    }
  } catch {
    inner = '近期文本健康摘要暂不可用，请保持当下语势继续叙事。';
  }
  inner = _phaseKTruncateTail(inner, charLimit);
  const label = '[Phase-K:textHealth ' + charLimit + ']';
  const promptSnippet =
    label + '\n' +
    '近况：近期文本健康摘要，供 LLM 了解重复句式 / 模板口癖。\n' +
    inner + '\n';
  return {
    hookName: PHASE_K_LLM_PROMPT_HOOK_MARKERS.textHealth,
    hookPosition: 'tail',
    promptSnippet,
    charLimit,
    snippetId: _phaseKRandomId('phasek-textHealth'),
  };
}

/**
 * Phase-K wire 2/4: slot mapping snippet.
 *  - activeSlots: currently registered UI slot mappings (any shape; defensively read)
 *  - limit:      optional charLimit override; default 480
 *  Returns { hookName, hookPosition, promptSnippet, charLimit, snippetId }.
 *  The snippet lists registered categories / displaySlots / tones so the LLM does not
 *  invent new ones.
 */
export function wireSlotMappingToLLMPrompt(
  activeSlots: any[] | null | undefined,
  limit?: number,
): PhaseKLLMPromptSnippet {
  const charLimit = _phaseKClampLimit(typeof limit === 'number' ? limit : 480, 480);
  let inner = '';
  try {
    if (Array.isArray(activeSlots) && activeSlots.length > 0 && typeof summarizeSlotMappingForPrompt === 'function') {
      inner = summarizeSlotMappingForPrompt(activeSlots, charLimit);
    } else {
      inner = '当前 UI 注册表为空（no slots registered），所有新分类必须先注册才能落到对应槽位。';
    }
  } catch {
    inner = '当前 UI 槽位摘要暂不可用，请保持默认分类边界。';
  }
  inner = _phaseKTruncateTail(inner, charLimit);
  const label = '[Phase-K:slotMapping ' + charLimit + ']';
  const promptSnippet =
    label + '\n' +
    '当前已注册 UI 槽位约束（请勿发明未注册分类，使用已注册 displaySlots）：\n' +
    inner + '\n';
  return {
    hookName: PHASE_K_LLM_PROMPT_HOOK_MARKERS.slotMapping,
    hookPosition: 'tail',
    promptSnippet,
    charLimit,
    snippetId: _phaseKRandomId('phasek-slotMapping'),
  };
}

/**
 * Phase-K wire 3/4: cross-system continuity snippet.
 *  - character: current character snapshot (any shape; defensively read)
 *  - breaks:    array of { system, severity, reason } cross-system breaks
 *  - limit:     optional charLimit override; default 320
 *  Returns { hookName, hookPosition, promptSnippet, charLimit, snippetId }.
 *  The snippet explains causal-chain health so the LLM can avoid orphan threads.
 */
export function wireCrossSystemContinuityToLLMPrompt(
  character: any,
  breaks: any[] | null | undefined,
  limit?: number,
): PhaseKLLMPromptSnippet {
  const charLimit = _phaseKClampLimit(typeof limit === 'number' ? limit : 320, 320);
  let inner = '';
  try {
    if (Array.isArray(breaks) && typeof summarizeContinuityForPrompt === 'function') {
      inner = summarizeContinuityForPrompt(character, breaks);
    } else {
      inner = '因果链健康 error=0 warn=0 info=0 -- 未发现跨系统断点。';
    }
  } catch {
    inner = '因果链健康摘要暂不可用，请保持剧情内因果连贯。';
  }
  inner = _phaseKTruncateTail(inner, charLimit);
  const label = '[Phase-K:continuity ' + charLimit + ']';
  const promptSnippet =
    label + '\n' +
    '因果链健康摘要（error / warn / info），供 LLM 避免出现孤儿因果。\n' +
    inner + '\n';
  return {
    hookName: PHASE_K_LLM_PROMPT_HOOK_MARKERS.continuity,
    hookPosition: 'tail',
    promptSnippet,
    charLimit,
    snippetId: _phaseKRandomId('phasek-continuity'),
  };
}

/**
 * Phase-K wire 4/4: verify which hooks are actually present in llm.ts.
 *  - llmSource: optional explicit source string (mostly for tests); defaults to reading
 *               src/lib/xianxia/llm.ts via fs.
 *  - llmPath:   override path when llmSource is not supplied.
 * Returns: { wiredCount, missingHooks, allHooks, registryPresent, sampleSnippet }.
 * `sampleSnippet` returns the first detected snippet body (or empty string).
 *
 * The function NEVER throws - file read errors are reported via
 * { registryPresent: false, wiredCount: 0, missingHooks: [all], ... }.
 */
export function verifyLLMPromptAugmentation(
  llmSource?: string,
  llmPath?: string,
): PhaseKLLMAugmentationVerifyResult {
  const allHooks = [
    PHASE_K_LLM_PROMPT_HOOK_MARKERS.textHealth,
    PHASE_K_LLM_PROMPT_HOOK_MARKERS.slotMapping,
    PHASE_K_LLM_PROMPT_HOOK_MARKERS.continuity,
  ];
  const missingHooks: string[] = [];
  let source: string = "";
  let registryPresent = false;
  let sampleSnippet = "";
  let wiredCount = 0;
  try {
    if (typeof llmSource === 'string') {
      // Explicit string (including empty '') is honored as-is - no file fallback.
      source = llmSource;
    } else {
      try {
        const fs = require("fs") as typeof import("fs");
        const path = typeof llmPath === 'string' && llmPath.length > 0
          ? llmPath
          : "src/lib/xianxia/llm.ts";
        source = fs.readFileSync(path, "utf-8");
      } catch {
        source = "";
      }
    }
  } catch (_err) {
    return {
      wiredCount: 0,
      missingHooks: allHooks.slice(),
      allHooks,
      registryPresent: false,
      sampleSnippet: "",
    };
  }
  registryPresent = source.indexOf(PHASE_K_LLM_PROMPT_HOOK_MARKERS.registry) >= 0;
  for (const h of allHooks) {
    if (source.indexOf(h) >= 0) {
      wiredCount += 1;
    } else {
      missingHooks.push(h);
    }
  }
  try {
    const idx = source.indexOf("[Phase-K:");
    if (idx >= 0) {
      const endIdx = source.indexOf("]", idx);
      if (endIdx > idx) {
        const slice = source.slice(idx, Math.min(source.length, idx + 320));
        sampleSnippet = slice;
      }
    }
  } catch (_e) {
    sampleSnippet = "";
  }
  return {
    wiredCount,
    missingHooks,
    allHooks,
    registryPresent,
    sampleSnippet,
  };
}

// ----- helpers (private to this block) -----

function _phaseKRandomId(prefix: string): string {
  return prefix + '-' + Math.floor(Date.now() % 1e9).toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

function _phaseKClampLimit(limit: number, fallback: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) return fallback;
  return limit;
}

function _phaseKTruncateTail(s: string, max: number): string {
  if (typeof s !== 'string') return '';
  if (s.length <= max) return s;
  const head = Math.max(1, Math.floor(max * 0.85));
  return s.slice(0, head) + '\u2026';
}
// ======================== Phase-K Worker A: 修真轮转支撑 (engine.ts) ========================
// Goal: 给主循环接入「角色死亡 → 结局光谱 → 传承池 → 继承者」四段式钩子。
// 这 4 个 export function 全部只读 / 只新增，不修改任何现有函数。
//
// 设计约束：
//  - triggerEndingEvaluation 是死亡入口；返回所有可触发的结局与最可能落定的那一个，
//    同时把第一份传承池草稿写入 primaryEnding.inheritancePool
//  - seedInheritancePoolFromEnding 把上一份结局展开成可继承条目（功法/法宝/灵宠/血脉/
//    信物/道场/未完之事），并各自落到 InheritancePool[]
//  - selectNextProtagonist 综合灵根/血脉/因果承接/玩家介入偏好，挑选下一代主角
//  - summarizeCycleForPrompt 把这一代轮回摘要成 prompt-ready 字符串（含 ellipsis 截断）
//
// 所有函数对 null/undefined 输入都安全返回默认结构；不抛错。

// ---------- local types (engine.ts 私有) ----------
interface PhaseKEndingCandidate {
  archetype: EndingArchetype;
  weight: number;
  reason: string;
}

export interface PhaseKEndingEvaluation {
  triggeredEndings: PhaseKEndingCandidate[];
  primaryEnding: {
    archetype: EndingArchetype;
    endingId: string;
    age: number;
    summary: string;
    inheritancePool: InheritancePool[];
  } | null;
  inheritancePool: InheritancePool[];
}

interface PhaseKProtagonistCandidate {
  id: string;
  age: number;
  realm: string;
  spiritualRoot: string;
  bloodline: string;
  karmaTags: string[];
  inherited: { poolId: string; kind: InheritanceKind }[];
  traitNarrative: string;
}

export interface PhaseKProtagonistSelection {
  selectedId: string;
  narrative: string;
  eligibility: number;
  scores: {
    root: number;
    blood: number;
    karma: number;
    preference: number;
    inheritance: number;
    total: number;
  };
  reason: string;
}

export interface PhaseKCycleSummaryInput {
  ending?: { archetype?: EndingArchetype; summary?: string; age?: number } | null;
  pool?: InheritancePool[] | null;
  nextProtagonist?: { id?: string; age?: number; realm?: string; traitNarrative?: string } | null;
  charLimit?: number;
}

// ---------- helpers (private to this block) ----------
function _phaseKAClassifyCause(causeOfDeath: any): { bias: Partial<Record<EndingArchetype, number>>; biasLabel: string } {
  const text = (typeof causeOfDeath === 'string' ? causeOfDeath
    : causeOfDeath && typeof causeOfDeath === 'object' ? (causeOfDeath.cause || causeOfDeath.kind || causeOfDeath.label || '')
    : '').toString();
  const lower = text.toLowerCase();
  const bias: Partial<Record<EndingArchetype, number>> = {};
  let biasLabel = 'unknown';
  if (/ascend|飞升|天劫|渡劫|列仙|tribulation/.test(lower)) {
    bias['ascend-immortal'] = 0.65;
    biasLabel = 'ascend-immortal';
  } else if (/sit|坐化|寿终|age|寿元|old/.test(lower)) {
    bias['sit-death'] = 0.55;
    biasLabel = 'sit-death';
  } else if (/demon|魔|fall|心魔|obsess/.test(lower)) {
    bias['fall-demonic'] = 0.6;
    biasLabel = 'fall-demonic';
  } else if (/sect|开宗|创派|found|传道|teach/.test(lower)) {
    bias['found-sect'] = 0.5;
    biasLabel = 'found-sect';
  } else if (/reincarn|转世|轮回|rebirth|samsara/.test(lower)) {
    bias['reincarnate'] = 0.55;
    biasLabel = 'reincarnate';
  } else if (/escape|逃|飞渡|穿越|leave|vacuum/.test(lower)) {
    bias['escape-world'] = 0.5;
    biasLabel = 'escape-world';
  } else if (/collapse|天地崩|灭世|世界崩毁|apocal/.test(lower)) {
    bias['world-collapse'] = 0.65;
    biasLabel = 'world-collapse';
  } else if (/fade|归凡|散功|隐退|退隐|withdraw/.test(lower)) {
    bias['fade-into-mortal'] = 0.5;
    biasLabel = 'fade-into-mortal';
  }
  return { bias, biasLabel };
}

function _phaseKANormalizeCharacter(character: any): {
  id: string; age: number; realm: string; faction: string; cause: string;
} {
  const c = character && typeof character === 'object' ? character : {};
  return {
    id: typeof c.id === 'string' ? c.id : 'char-unknown',
    age: typeof c.age === 'number' && Number.isFinite(c.age) && c.age >= 0 ? c.age : 0,
    realm: typeof c.realm === 'string' ? c.realm : (typeof c.cultivation === 'string' ? c.cultivation : 'mortal'),
    faction: typeof c.faction === 'string' ? c.faction : (typeof c.sect === 'string' ? c.sect : ''),
    cause: typeof c.cause === 'string' ? c.cause : '',
  };
}

function _phaseKAGeneratePoolId(charId: string, archetype: EndingArchetype, kind: string): string {
  return 'pool-' + charId + '-' + archetype + '-' + kind;
}

function _phaseKAClampUnit(n: number, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// ---------- main exports ----------

/**
 * Phase-K 1/4: triggerEndingEvaluation
 * 角色死亡时调用：评估可触发的结局，写入传承池。
 *  - character: 当前角色（id / age / realm / faction / cause）
 *  - worldState: 世界状态（可选；用于查询境界峰顶 / 宗门敌对 / 因缘密度）
 *  - causeOfDeath: 死因字符串或 { cause: string } 对象
 * 返回 { triggeredEndings, primaryEnding, inheritancePool }
 *  - triggeredEndings: 所有候选结局（含权重 + 触发原因）
 *  - primaryEnding: 落定的主要结局（含 inheritancePool 草稿）；可能为 null
 *  - inheritancePool: 顶层传承池列表（与 primaryEnding.inheritancePool 一致，便于直接挂载）
 */
export function triggerEndingEvaluation(
  character: any,
  worldState: any,
  causeOfDeath: any,
): PhaseKEndingEvaluation {
  const ch = _phaseKANormalizeCharacter(character);
  const causeBias = _phaseKAClassifyCause(causeOfDeath || ch.cause);
  const ws = worldState && typeof worldState === 'object' ? worldState : null;
  const ageGate = ch.age >= 60 ? 0.15 : 0; // 寿元越接近暮年越倾向坐化/归凡
  const realmPower = (ch.realm === 'ascension' || ch.realm === 'tribulation') ? 0.4 : 0;

  // 8 个原型 + 基础权重
  const base: Record<EndingArchetype, number> = {
    'ascend-immortal': 0.05 + realmPower,
    'sit-death': 0.10 + ageGate,
    'fall-demonic': 0.05,
    'found-sect': 0.10 + (ch.faction ? 0.10 : 0),
    'reincarnate': 0.08,
    'escape-world': 0.04,
    'world-collapse': 0.02,
    'fade-into-mortal': 0.10 + ageGate,
  };
  // 应用 cause bias
  const cands: PhaseKEndingCandidate[] = (Object.keys(base) as EndingArchetype[]).map((arch) => ({
    archetype: arch,
    weight: _phaseKAClampUnit((base[arch] || 0) + (causeBias.bias[arch] || 0), 0.95),
    reason: 'cause=' + (causeBias.biasLabel || 'unknown') + ', realm=' + ch.realm + ', age=' + ch.age,
  }));

  // 过滤权重 < 0.05 的低概率
  const filtered = cands.filter((c) => c.weight >= 0.05).sort((a, b) => b.weight - a.weight);

  // 选主结局：权重最高；平局时倾向原表顺序
  const top = filtered[0] || null;
  let primaryEnding: PhaseKEndingEvaluation['primaryEnding'] = null;
  let pool: InheritancePool[] = [];
  if (top) {
    const endingId = 'ending-' + ch.id + '-' + top.archetype;
    const summary = top.archetype + ' · ' + ch.id + ' 于 ' + ch.age + ' 岁落定；' + (ch.realm || 'mortal') + '，因 ' + (causeBias.biasLabel || 'unknown') + ' 而终。';
    pool = seedInheritancePoolFromEnding(
      { archetype: top.archetype, endingId, summary, age: ch.age, character: ch } as any,
      ch,
    );
    primaryEnding = {
      archetype: top.archetype,
      endingId,
      age: ch.age,
      summary,
      inheritancePool: pool,
    };
  }

  return {
    triggeredEndings: filtered,
    primaryEnding,
    inheritancePool: pool,
  };
}

/**
 * Phase-K 2/4: seedInheritancePoolFromEnding
 * 从结局抽取可继承条目（功法/法宝/灵宠/血脉/信物/道场/未完之事），生成继承池。
 *  - ending: 任意形状 { archetype, endingId, summary, age, character }
 *  - character: 当前角色（用于 hostCharacterIds / lockedUntilAge）
 * 返回 InheritancePool[]（典型 3-5 项）
 */
export function seedInheritancePoolFromEnding(
  ending: any,
  character: any,
): InheritancePool[] {
  const e = ending && typeof ending === 'object' ? ending : {};
  const arch: EndingArchetype = (typeof e.archetype === 'string') ? e.archetype : 'fade-into-mortal';
  const ch = _phaseKANormalizeCharacter(character || e.character);
  const endingId = typeof e.endingId === 'string' ? e.endingId : ('ending-' + ch.id + '-' + arch);
  const age = typeof e.age === 'number' && e.age >= 0 ? e.age : ch.age;

  // 不同结局原型的 kind 优先级
  const kindPriority: InheritanceKind[] = (
    arch === 'ascend-immortal' ? ['technique', 'artifact', 'bond']
    : arch === 'sit-death' ? ['technique', 'artifact', 'bond']
    : arch === 'fall-demonic' ? ['artifact', 'bloodline', 'technique']
    : arch === 'found-sect' ? ['sect', 'technique', 'token']
    : arch === 'reincarnate' ? ['bloodline', 'technique', 'token']
    : arch === 'escape-world' ? ['token', 'technique', 'artifact']
    : arch === 'world-collapse' ? ['artifact', 'bond', 'sect']
    : ['technique', 'token', 'bond']
  );

  const lockSpan = age + 6; // 主角死后 6 年才允许继承
  const pools: InheritancePool[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < kindPriority.length; i++) {
    const k = kindPriority[i];
    const id = _phaseKAGeneratePoolId(ch.id, arch, k);
    if (seen.has(id)) continue;
    seen.add(id);
    const name = k + ' · ' + arch + ' 遗承';
    const slots = (arch === 'found-sect' || arch === 'world-collapse') ? 2 : 1;
    pools.push({
      id,
      name,
      kind: k,
      availableSlots: slots,
      lockedUntilAge: lockSpan,
      hostCharacterIds: [ch.id],
    });
  }

  // 至少 3 项；不足则补 technique/token/bond 兜底
  const fallbackKinds: InheritanceKind[] = ['technique', 'token', 'bond'];
  for (const k of fallbackKinds) {
    if (pools.length >= 3) break;
    const id = _phaseKAGeneratePoolId(ch.id, arch, k + '-fb');
    if (seen.has(id)) continue;
    seen.add(id);
    pools.push({
      id,
      name: k + ' · 遗承',
      kind: k,
      availableSlots: 1,
      lockedUntilAge: lockSpan,
      hostCharacterIds: [ch.id],
    });
  }
  return pools;
}

/**
 * Phase-K 3/4: selectNextProtagonist
 * 从候选人物中选择下一代主角。
 *  - pool: 传承池（用于 inheritance 评分）
 *  - worldState: 世界状态（用于 realm peak / 因缘密度）
 *  - candidateList: 候选人物数组 [{ id, age, realm, spiritualRoot, bloodline, karmaTags, traitNarrative }]
 * 返回 { selectedId, narrative, eligibility, scores, reason }
 *  - eligibility: 0-1 综合适配度
 *  - scores: 各维度分项
 */
export function selectNextProtagonist(
  pool: InheritancePool[] | null | undefined,
  worldState: any,
  candidateList: any[],
): PhaseKProtagonistSelection {
  const poolArr = Array.isArray(pool) ? pool : [];
  const ws = worldState && typeof worldState === 'object' ? worldState : null;
  const candidates: PhaseKProtagonistCandidate[] = Array.isArray(candidateList)
    ? candidateList.filter((c) => c && typeof c === 'object').map((c) => ({
      id: typeof c.id === 'string' ? c.id : 'cand-unknown',
      age: typeof c.age === 'number' && c.age >= 0 ? c.age : 0,
      realm: typeof c.realm === 'string' ? c.realm : 'mortal',
      spiritualRoot: typeof c.spiritualRoot === 'string' ? c.spiritualRoot : (typeof c.root === 'string' ? c.root : 'unknown'),
      bloodline: typeof c.bloodline === 'string' ? c.bloodline : '',
      karmaTags: Array.isArray(c.karmaTags) ? c.karmaTags.filter((t: any) => typeof t === 'string') : [],
      inherited: Array.isArray(c.inherited) ? c.inherited : [],
      traitNarrative: typeof c.traitNarrative === 'string' ? c.traitNarrative : '',
    }))
    : [];

  if (candidates.length === 0) {
    return {
      selectedId: '',
      narrative: '无可继承者候选；修真轮转暂止。',
      eligibility: 0,
      scores: { root: 0, blood: 0, karma: 0, preference: 0, inheritance: 0, total: 0 },
      reason: 'no-candidates',
    };
  }

  const playerPref = (ws && typeof ws.playerInterventionPreference === 'string')
    ? ws.playerInterventionPreference
    : (ws && typeof ws.protagonistSelectionPreference === 'string' ? ws.protagonistSelectionPreference : 'favor-neutral');
  const favorRoot = playerPref === 'favor-root' || playerPref === 'favor-destiny';
  const favorBlood = playerPref === 'favor-bloodline';

  // 灵根 / 血脉打分映射
  const rootScore = (r: string): number => {
    if (!r || r === 'unknown') return 0.4;
    if (/tianling|天灵|纯阳|纯阴|先天|primordial/.test(r)) return 1.0;
    if (/双灵|dual|single/.test(r)) return 0.7;
    if (/三灵|triple/.test(r)) return 0.55;
    if (/杂灵|mixed|wu/.test(r)) return 0.35;
    return 0.5;
  };
  const bloodScore = (b: string, p: InheritancePool[]): number => {
    if (!b) return 0.2;
    const poolsHaveBlood = p.some((x) => x && x.kind === 'bloodline');
    if (!poolsHaveBlood) return 0.4;
    if (/嫡|直系|传承|heir|lineage/.test(b)) return 0.9;
    if (/旁|远|collateral/.test(b)) return 0.55;
    return 0.45;
  };
  const karmaScore = (tags: string[]): number => {
    if (tags.length === 0) return 0.4;
    let s = 0;
    let n = 0;
    for (const t of tags) {
      if (/因缘|旧约|师徒|誓言|fate|promise|master/.test(t)) { s += 0.9; n++; }
      else if (/仇|敌|杀|feud|enemy/.test(t)) { s += 0.3; n++; }
      else if (/中|平|neutral/.test(t)) { s += 0.5; n++; }
      else { s += 0.5; n++; }
    }
    return n === 0 ? 0.4 : Math.max(0.1, Math.min(1, s / n));
  };
  const inheritanceScore = (inherited: { poolId: string; kind: InheritanceKind }[], p: InheritancePool[]): number => {
    if (!Array.isArray(inherited) || inherited.length === 0 || p.length === 0) return 0.2;
    let matches = 0;
    for (const ih of inherited) {
      if (!ih || typeof ih.poolId !== 'string') continue;
      const matched = p.some((x) => x && x.id === ih.poolId);
      if (matched) matches++;
    }
    return Math.max(0.1, Math.min(1, matches / Math.max(1, Math.min(inherited.length, p.length))));
  };

  // 计算每个候选分
  const scored = candidates.map((c) => {
    const root = rootScore(c.spiritualRoot);
    const blood = bloodScore(c.bloodline, poolArr);
    const karma = karmaScore(c.karmaTags);
    const inherit = inheritanceScore(c.inherited, poolArr);
    let preference = 0.5;
    if (favorRoot && root >= 0.7) preference += 0.15;
    if (favorBlood && blood >= 0.7) preference += 0.15;
    const totalRaw = 0.30 * root + 0.30 * blood + 0.25 * karma + 0.15 * preference + 0.10 * (inherit * 0.5 + 0.5);
    const total = _phaseKAClampUnit(totalRaw, 0);
    return { cand: c, scores: { root, blood, karma, preference, inheritance: inherit, total } };
  });

  scored.sort((a, b) => b.scores.total - a.scores.total);
  const winner = scored[0];
  const id = winner.cand.id;
  const reasonCode = winner.scores.total >= 0.7 ? 'strong-match'
    : winner.scores.total >= 0.55 ? 'good-match'
    : winner.scores.total >= 0.4 ? 'marginal-match' : 'weak-match';
  const narrative = '由 ' + id + ' 接掌（' + reasonCode + '），其灵根 ' + winner.cand.spiritualRoot + '，血脉 ' + (winner.cand.bloodline || '无明显传承') + '，适配度 ' + winner.scores.total.toFixed(3) + '。';

  return {
    selectedId: id,
    narrative,
    eligibility: winner.scores.total,
    scores: winner.scores,
    reason: reasonCode,
  };
}

/**
 * Phase-K 4/4: summarizeCycleForPrompt
 * 给 AI 上下文的"本代轮回摘要"。
 *  - ending: { archetype, summary, age } 上一代结局
 *  - pool: InheritancePool[] 传承池（用于算池容量）
 *  - nextProtagonist: { id, age, realm, traitNarrative } 下一代主角
 *  - charLimit: 字符上限（默认 360），超出部分以 ellipsis 截断
 * 返回 prompt-ready 字符串
 */
export function summarizeCycleForPrompt(
  ending: any,
  pool: InheritancePool[] | null | undefined,
  nextProtagonist: any,
  charLimit?: number,
): string {
  const e = ending && typeof ending === 'object' ? ending : {};
  const arch = (typeof e.archetype === 'string') ? e.archetype : 'fade-into-mortal';
  const age = typeof e.age === 'number' && e.age >= 0 ? e.age : null;
  const summary = typeof e.summary === 'string' && e.summary ? e.summary : ('上一代 ' + arch + ' 落定。');

  const poolArr = Array.isArray(pool) ? pool : [];
  const poolCount = poolArr.length;
  const poolKinds: string[] = [];
  for (const p of poolArr) {
    if (!p || typeof p !== 'object') continue;
    if (typeof p.kind === 'string' && poolKinds.indexOf(p.kind) < 0) poolKinds.push(p.kind);
    const items = (p as any).inheritedItems;
    if (Array.isArray(items)) {
      for (const it of items) {
        if (it && typeof it === 'object' && typeof it.kind === 'string' && poolKinds.indexOf(it.kind) < 0) {
          poolKinds.push(it.kind);
        }
      }
    }
  }
  const poolLine = poolCount > 0
    ? '传承池共 ' + poolCount + ' 项，类目 ' + (poolKinds.join('、') || 'unknown') + '。'
    : '未留传承池。';

  const np = nextProtagonist && typeof nextProtagonist === 'object' ? nextProtagonist : null;
  const npLine = np
    ? '下一代主角 ' + (typeof np.id === 'string' ? np.id : '未明') + '（' + (typeof np.age === 'number' ? np.age : '?') + ' 岁 / ' + (typeof np.realm === 'string' ? np.realm : 'mortal') + '）：' + (typeof np.traitNarrative === 'string' && np.traitNarrative ? np.traitNarrative : '尚无明确描述。')
    : '尚无明确下一代主角。';

  const ageLine = (age !== null) ? '于 ' + age + ' 岁落定。' : '落定时间未明。';

  let s = '本代轮回：' + arch + ' · ' + ageLine + ' ' + summary + ' ' + poolLine + ' ' + npLine;
  const limit = (typeof charLimit === 'number' && Number.isFinite(charLimit) && charLimit > 0)
    ? Math.floor(charLimit)
    : 360;
  if (s.length > limit) {
    s = s.slice(0, Math.max(0, limit - 1)) + '…';
  }
  return s;
}



// ======================== Phase-K Worker B (cycle-and-ui-projection): UI Projection ========================
// Additive only. Each function takes (character, sourceData) and returns a
// PlayerUIProjection that the UI layer can render. The projection contains
// a primary slot and a list of secondary slots, each carrying tone + renderHint.
// No fs/IO; pure in-memory projection so this stays client-component safe.

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

function _kbDescribeFateKind(k: string): string {
  if (k === 'heavy') return '命运重劫';
  if (k === 'mid') return '命运羁绊';
  return '命运微澜';
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

function _kbDescribeFateOutcome(o: string): string {
  if (o === 'resolved-positive') return '了结，因果归位';
  if (o === 'resolved-negative') return '了结，余怨难消';
  return '未了，待续';
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
