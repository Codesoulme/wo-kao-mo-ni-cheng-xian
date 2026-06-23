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
} from './types';
import { hasRealmEntryRequirement } from './secret-realm-utils';
import { resolveAttributeChanges } from './effect-resolver';
import { inferAttributeChangesFromNarrative } from './narrative-inference';
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
  if (category === 'body' || category === 'spirit' || category === 'dao' || category === 'combat' || category === 'fate' || category === 'custom') return category;
  return 'custom';
}

export function deriveCultivationAttributes(state: CharacterState): CultivationAttributeEntry[] {
  const byId = new Map<string, CultivationAttributeEntry>();
  for (const attr of state.cultivationAttributes || []) {
    if (!attr || !attr.name || attr.visible === false) continue;
    byId.set(attr.id || attr.name, { ...attr, id: attr.id || attr.name });
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
    forceLabel: '\u7834\u52bf',
    guardLabel: '\u62a4\u6301',
    agilityLabel: '\u673a\u53d8',
    summary: `${realmTraits.combatStyle?.[0] || '\u5faa\u52bf\u6597\u6cd5'}\uff1a\u7834\u52bf${force}\u3001\u62a4\u6301${guard}\u3001\u673a\u53d8${agility}`,
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
    item.name = stripLootOwnerPrefix(item.name);
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

export function causalId(prefix: string, seed: string): string {
  const safe = String(seed || '').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_').slice(0, 48);
  return prefix + '_' + (safe || Date.now().toString(36));
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

  // 1. Apply attribute changes through EffectResolver / ERPE Lite.
  let inputChanges = aiOutput.changes || [];
  // 引擎兜底：AI 常把 narrative 写得生动但忘记给 changes
  // 当 changes 几乎为空时，根据 narrative 关键词 + 当前境界自动补一组合理 delta
  if (inputChanges.length === 0 && aiOutput.narrative) {
    const fallback = inferAttributeChangesFromNarrative(aiOutput.narrative, next, aiOutput.title || 'ai-event');
    if (fallback.length > 0) {
      inputChanges = fallback;
      trace.push({
        severity: 'info',
        code: 'engine_inferred_changes',
        attribute: '*',
        message: `Engine inferred ${fallback.length} attribute change(s) from narrative (AI output empty changes)`,
        source: aiOutput.title || 'ai-event',
      } as any);
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
    id: `enemy_heartdemon_${Date.now()}`,
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



