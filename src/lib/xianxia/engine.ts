// 修仙模拟器 - 引擎核心
// 引擎权威：所有 AI 提议的变更必须经引擎校验与执行
// AI Proposes：AI 输出是"提议"，引擎有权拒绝、修改、钳制

import {
  CharacterState,
  AttributeChange,
  StatusEntry,
  ItemEntry,
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
  EngineStateContext,
  EquipSlot,
  EquippedMap,
  ITEM_TYPE_LABEL,
  SLOT_LABEL,
  itemToSlot,
  CultivationFactor,
  EventBlueprint,
  EVENT_BLUEPRINTS,
  BlueprintCategory,
  CharacterIntent,
  PendingThread,
  CombatEnemy,
  CombatRound,
  CombatSession,
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
  // ===== Phase-α 批 1 α-1/α-2 新增
  TribulationProfile,
  TribulationHistoryEntry,
  // ===== Phase-α 批 2 α-5 新增：器灵觉醒
  AwakeningStage,
  AWAKENING_STAGE_LABEL,
  AWAKENING_THRESHOLDS,
  // ===== Phase-α 批 2 α-7 新增：灵田 / 24 节气
  SpiritGardenZone,
  GameTime,
  TWENTY_FOUR_SOLAR_TERMS,
  SOLAR_TERM_INDEX,
  SOLAR_TERM_SEASON,
  CultivationAttributeEntry,
  RealmTraits,
} from './types';
import { COMBAT_PROJECTION_LABELS } from './display';
import { hasRealmEntryRequirement } from './secret-realm-utils';

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
  // ===== Phase-α 批 1 α-1/α-2 新增 =====
  tribulationProfileJson?: string;
  karma?: number;
  merit?: number;
  sin?: number;
  // ===== Phase-α 批 2 α-7 新增：灵田（zones[] JSON） =====
  spiritGardenJson?: string;
}

// 旧存档 equippedJson 可能是 slot-map（{weapon: {...}}）或已是数组（[{...}]）
// 本函数将其统一转为数组；旧 slot-map 会带上默认 equipNote（如「兵器」「功法」）
// 同时对每个 item 兜底补全 α-5 器灵觉醒三字段（缺失 → 0 / sleeping / 无名），
// 确保旧装备加载不报错，UI 也能正常展示"未启"图标
function parseEquippedJson(raw: string): ItemEntry[] {
  if (!raw) return [];
  const parsed = safeParse<any>(raw, []);
  if (Array.isArray(parsed)) return parsed.map(normalizeItemNurture);
  // 旧 slot-map 格式：转换为数组
  if (typeof parsed === 'object' && parsed !== null) {
    const out: ItemEntry[] = [];
    for (const slot of Object.keys(parsed) as EquipSlot[]) {
      const it = (parsed as EquippedMap)[slot];
      if (it) {
        out.push(normalizeItemNurture({ ...it, equipNote: it.equipNote || SLOT_LABEL[slot] }));
      }
    }
    return out;
  }
  return [];
}

// 给单个 item 兜底 α-5 nurture 三字段；旧装备没 nurture 字段视作 0 + sleeping
function normalizeItemNurture(it: ItemEntry): ItemEntry {
  const progress = Math.max(0, Math.min(100, Number(it.nurtureProgress) || 0));
  return {
    ...it,
    nurtureProgress: progress,
    awakeningStage: it.awakeningStage || computeAwakening(progress),
    // 已有 sentientName 保留；否则 undefined（UI 仅在 sentient 阶段显示）
  };
}

// 判定一个物品是否是「储物袋」（含 storageCapacity 效果的 tool）
export function isStorageBag(item: ItemEntry): boolean {
  if (!item) return false;
  if (item.item_type !== 'tool') return false;
  return (item.effects || []).some(e => e.target_attribute === 'storageCapacity' && e.operation === 'add' && e.value > 0);
}

// ==================== Phase-α α-5 法宝养灵 / 器灵觉醒 ====================

// 单次事件养灵增量上限（防 AI 提议过大溢出）
export const NURTURE_DELTA_CAP_PER_EVENT = 10;

// 计算当前养灵进度对应的觉醒阶段（纯函数）
// 阈值与 AWAKENING_THRESHOLDS 保持一致：0-33 sleeping / 34-66 awakened / 67-100 sentient
export function computeAwakening(progress: number): AwakeningStage {
  const p = Math.max(0, Math.min(100, Number(progress) || 0));
  if (p >= AWAKENING_THRESHOLDS.sentient.min) return 'sentient';
  if (p >= AWAKENING_THRESHOLDS.awakened.min) return 'awakened';
  return 'sleeping';
}

// 在指定物品上累计养灵进度，引擎权威：
// - delta 限幅 [0..NURTURE_DELTA_CAP_PER_EVENT]（仅接受非负；防负数洗白）
// - 自动钳制 progress 到 [0..100]
// - 跨 stage 触发：首次跨 awakening / sentient 时，落回 awakeningStage；sentient 时记录 awakenedName
// - 若 AI 同一次事件中给出 awakenedName，统一落定为该次的 sentientName（仅首次 sentient 时生效）
// - 物品若不在 inventory/equipped 中，直接返回原 state（无效输入静默丢弃）
export function addNurtureProgress(
  state: CharacterState,
  itemId: string,
  delta: number,
  reason?: string,
  awakenedName?: string
): { state: CharacterState; item: ItemEntry; stageAdvanced: boolean } {
  const clampedDelta = Math.max(0, Math.min(NURTURE_DELTA_CAP_PER_EVENT, Number(delta) || 0));
  let stageAdvanced = false;
  let next = { ...state };

  const targetList: Array<'inventory' | 'equipped'> = ['inventory', 'equipped'];
  let updatedItem: ItemEntry | null = null;

  for (const listKey of targetList) {
    const list = (next as any)[listKey] as ItemEntry[] | undefined;
    if (!Array.isArray(list)) continue;
    const idx = list.findIndex(it => it && it.id === itemId);
    if (idx < 0) continue;
    const before = list[idx];
    const beforeProgress = Math.max(0, Math.min(100, Number(before.nurtureProgress) || 0));
    const beforeStage = before.awakeningStage || computeAwakening(beforeProgress);
    const afterProgress = Math.max(0, Math.min(100, beforeProgress + clampedDelta));
    const afterStage = computeAwakening(afterProgress);
    const crossedStage = afterStage !== beforeStage;
    const reachedSentient = afterStage === 'sentient' && beforeStage !== 'sentient';
    if (crossedStage) stageAdvanced = true;

    // 器灵名只在首次进入 sentient 时落定（避免后续每岁被覆盖）
    let nextSentientName = before.sentientName;
    if (reachedSentient) {
      // 优先采用 AI 提议的 awakenedName；否则保留旧名（极少出现）；都无则不写
      if (typeof awakenedName === 'string' && awakenedName.trim()) {
        nextSentientName = awakenedName.trim().slice(0, 24);
      }
    }

    const updated: ItemEntry = {
      ...before,
      nurtureProgress: afterProgress,
      awakeningStage: afterStage,
      sentientName: nextSentientName,
    };

    const newList = [...list];
    newList[idx] = updated;
    (next as any)[listKey] = newList;
    updatedItem = updated;
    break;
  }

  if (!updatedItem) {
    // 物品不在背包/已装备——返回原 state；不抛错以免破坏 advance 流程
    return { state, item: { id: itemId, name: '', description: '', item_type: 'tool', rarity: 'common', effects: [], source: '' } as ItemEntry, stageAdvanced: false };
  }

  // 把跨 stage 的剧情落点同时写入长期记忆，便于后续 AI 承接（"宝剑初显灵性"等）
  if (stageAdvanced) {
    const stageLabel = AWAKENING_STAGE_LABEL[updatedItem.awakeningStage!];
    const namePart = updatedItem.sentientName ? `，自名「${updatedItem.sentientName}」` : '';
    const reasonPart = reason ? `（${String(reason).slice(0, 60)}）` : '';
    const mem = `器灵进阶：${updatedItem.name} 养灵至${stageLabel}${namePart}${reasonPart}`;
    next = addMemory(next, mem);
  }

  return { state: next, item: updatedItem, stageAdvanced };
}

export function dbToState(c: DBCharacter): CharacterState {
  const rootInfo = SPIRITUAL_ROOTS[c.spiritualRoot as SpiritualRoot];
  const equippedRaw = parseEquippedJson(c.equippedJson || '[]');
  const rawInventory = safeParse<ItemEntry[]>(c.inventoryJson, []);
  // α-4 兜底：旧物品无 scripture 三段字段也按 practiced+0 加载；normalizeCultivationBearingItem 同时含 scripture 三段默认 + α-5 nurture 无关
  const equipped = Array.isArray(equippedRaw) ? equippedRaw.map(normalizeCultivationBearingItem) : [];
  // α-5 兜底：旧物品无 nurture 字段也按 0/sleeping 加载，不报错
  const inventory = Array.isArray(rawInventory) ? rawInventory.map(normalizeCultivationBearingItem).map(normalizeItemNurture) : [];
  const storageCapacity = c.storageCapacity ?? 5;
  // Task 20: 解析新字段
  const parsedPendingThreads = safeParse<PendingThread[]>(c.pendingThreadsJson || '[]', []);
  const pendingThreads = Array.isArray(parsedPendingThreads) ? parsedPendingThreads : [];
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
    characterIntents,
    combatSession,
    // Task 22 新字段
    heartDemon: (c as any).heartDemon ?? 0,
    // Task 23 新字段
    pets: safeParse<Pet[]>((c as any).petsJson || '[]', []),
    // Task 24 新字段
    exploredRealms: safeParse<ExplorationRecord[]>((c as any).exploredRealmsJson || '[]', []),
    // ===== Phase-α 批 1 α-1/α-2 兜底 =====
    // 旧档缺省 tribulationProfile/karma/merit/sin → 兜底为空档案 + 0；不破坏既有存档
    tribulationProfile: safeParse<TribulationProfile>((c as any).tribulationProfileJson || '{}', {
      tribulationHistory: [],
    } as TribulationProfile),
    karma: typeof (c as any).karma === 'number' ? (c as any).karma : 0,
    merit: typeof (c as any).merit === 'number' ? (c as any).merit : 0,
    sin: typeof (c as any).sin === 'number' ? (c as any).sin : 0,
    // ===== Phase-α 批 2 α-7 兜底：灵田 =====
    // 旧档无 spiritGardenJson → 默认空 zones[]；不破坏既有存档
    spiritGarden: (() => {
      const parsed = safeParse<{ zones?: SpiritGardenZone[] }>((c as any).spiritGardenJson || '', { zones: [] });
      return { zones: Array.isArray(parsed?.zones) ? parsed.zones : [] };
    })(),
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
  if (raw.name) profile.name = String(raw.name).slice(0, 16);
  if (raw.shortName) profile.shortName = String(raw.shortName).slice(0, 3);
  if (/^#[0-9a-fA-F]{6}$/.test(String(raw.color || ''))) profile.color = String(raw.color);
  if (raw.maxLevel !== undefined) profile.maxLevel = Math.round(clampProfileNumber(raw.maxLevel, 0, 999, 9));
  if (raw.powerMultiplier !== undefined) profile.powerMultiplier = clampProfileNumber(raw.powerMultiplier, 0.5, 9, 1);
  if (raw.expMultiplier !== undefined) profile.expMultiplier = clampProfileNumber(raw.expMultiplier, 0.2, 20, 1);
  if (raw.reason) profile.reason = String(raw.reason).slice(0, 120);
  return Object.keys(profile).length ? profile : undefined;
}

export function getRealmProfile(state: CharacterState): RealmProfile | undefined {
  const explicit = sanitizeRealmProfile((state as any).realmProfile);
  if (explicit) return explicit;

  const status = (state.activeStatuses || []).find(st =>
    (st.category === 'special' || st.category === 'identity') &&
    /境界|道基|金丹|筑基|炼气|練氣|元婴|元嬰|化神|大乘|渡劫|飞升|飛升|九转|完美|叠层|道果/.test(`${st.name} ${st.description}`)
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

// ==================== 八维神魂派生（来自 publish）====================

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
    '身体': 'body',
    '神魂': 'spirit',
    '道德': 'dao',
    '战斗': 'combat',
    '天运': 'fate',
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
    name: '神识',
    value: core.spiritualSense,
    description: '感知、探查、神念压制与高阶禁制判断的基础。',
    source: '境界与神魂派生',
    category: 'spirit',
    visible: true,
  });
  byId.set('soulStrength', {
    id: 'soulStrength',
    name: '魂魄',
    value: core.soulStrength,
    description: `当前神魂境界：${soul.name}（${soul.gap}），影响元婴出窍、夺舍风险、心魔承受和神识秘术。`,
    source: '境界与心性派生',
    category: 'spirit',
    visible: true,
  });
  byId.set('physicalFoundation', {
    id: 'physicalFoundation',
    name: '体魄',
    value: core.physicalFoundation,
    description: '肉身根基与承载力，影响重伤承受、炼体机缘和大境界突破稳定度。',
    source: '肉身与境界派生',
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
    attributeNumber(state, ['spiritualSense', '神识']),
    5 + realmIdx * 24 + levelRatio * 18 + (state.comprehension || 0) * 0.45 + (state.maxMp || 0) * 0.04,
  )! * profilePower);
  const soulStrength = Math.round(firstNumber(
    (state as any).soulStrength,
    attributeNumber(state, ['soulStrength', '魂魄', '神魂', '元神']),
    8 + realmIdx * 22 + levelRatio * 16 + (state.comprehension || 0) * 0.35 - (state.heartDemon || 0) * 0.15,
  )! * profilePower);
  const physicalFoundation = Math.round(firstNumber(
    (state as any).physicalFoundation,
    attributeNumber(state, ['physicalFoundation', '体魄', '肉身', '根骨']),
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
    { name: '未凝神', rank: 0, min: 0 },
    { name: '灵感初萌', rank: 1, min: 45 },
    { name: '神识初成', rank: 2, min: 85 },
    { name: '神魂稳固', rank: 3, min: 150 },
    { name: '元神出窍', rank: 4, min: 260 },
    { name: '元神显化', rank: 5, min: 420 },
    { name: '神意通玄', rank: 6, min: 680 },
  ];
  const tier = [...tiers].reverse().find(t => score >= t.min) || tiers[0];
  const bodyRank = Math.max(0, REALMS.findIndex(r => r.id === state.realm));
  const gap = tier.rank > bodyRank + 1
    ? '神魂超前'
    : tier.rank + 1 < bodyRank
      ? '神魂落后'
      : '身神相称';
  return { ...tier, gap, score: Math.round(score), ...core };
}

export function deriveRealmTraits(state: CharacterState): RealmTraits {
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

export function deriveCombatProjection(state: CharacterState): CombatProjectionTraits {
  const core = deriveCoreCultivationAttributes(state);
  const realmTraits = deriveRealmTraits(state);
  const force = Math.max(0, Math.round((state.attack || 0) + core.spiritualSense * 0.12 + (state.comprehension || 0) * 0.08));
  const guard = Math.max(0, Math.round((state.defense || 0) + core.physicalFoundation * 0.16 + core.soulStrength * 0.06));
  const agility = Math.max(0, Math.round((state.speed || 0) + core.spiritualSense * 0.10 + (state.luck || 0) * 0.04));
  const advantages = [
    force >= guard && force >= agility ? '破势偏盛' : '',
    guard >= force && guard >= agility ? '护持稳厚' : '',
    agility >= force && agility >= guard ? '机变灵动' : '',
    core.spiritualSense >= core.physicalFoundation + 30 ? '神识超前' : '',
    core.physicalFoundation >= core.spiritualSense + 30 ? '体魄承压强' : '',
  ].filter(Boolean).slice(0, 4);
  const vulnerabilities = [
    core.soulStrength + 25 < core.spiritualSense ? '神识锐而魂魄承载不足' : '',
    guard + 20 < force ? '攻锋过盛，护持偏薄' : '',
    agility + 20 < guard ? '承压有余，转挪偏慢' : '',
    (state.heartDemon || 0) >= 60 ? '心魔牵动神魂' : '',
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

// ==================== 属性变更应用 (引擎权威) ====================

// AI 可影响的属性白名单 + 钳制范围
// 注意：age（年龄）不在白名单内——年龄推进是引擎独占职责
//   - advance 流程：引擎 state.age += 1
//   - interfere 流程：引擎根据 AI 的 ageAdvance 字段推进
//   AI 不得通过 changes 直接修改 age，否则会与引擎推进叠加导致跳岁
const ATTRIBUTE_BOUNDS: Record<string, { min: number; max: number }> = {
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
  spiritStones:    { min: 0,    max: 99999999 },
  reputation:      { min: -9999,max: 99999 },
  elementMetal:    { min: 0,    max: 100 },
  elementWood:     { min: 0,    max: 100 },
  elementWater:    { min: 0,    max: 100 },
  elementFire:     { min: 0,    max: 100 },
  elementEarth:    { min: 0,    max: 100 },
  // Task 22: 心魔值（0-100）
  heartDemon:      { min: 0,    max: 100 },
  spiritualSense:  { min: 0,    max: 9999 },
  soulStrength:    { min: 0,    max: 9999 },
  physicalFoundation: { min: 0, max: 9999 },
};

export function applyChanges(state: CharacterState, changes: AttributeChange[]): CharacterState {
  const next = { ...state };
  for (const change of changes) {
    const attr = change.attribute;
    const bounds = ATTRIBUTE_BOUNDS[attr];
    if (!bounds) continue; // 引擎拒绝未知属性

    // 修炼速度倍率：cultivationExp 的增量乘以 (灵根×功法) 倍率
    // 这样 AI 给 +10 修为时，装备了引气决(×1.5)+真灵根(×1.5) 的角色实际得 +22.5→22
    let delta = change.delta;
    if (attr === 'cultivationExp' && next.cultivationMultiplier > 0 && delta > 0) {
      delta = Math.round(delta * next.cultivationMultiplier);
    }

    const current = (next as any)[attr] ?? 0;
    let newVal = current + delta;

    // 引擎钳制：不可超出范围
    newVal = Math.max(bounds.min, Math.min(bounds.max, newVal));
    (next as any)[attr] = newVal;

    // 派生约束
    if (attr === 'hp' && newVal <= 0) {
      next.hp = 0;
      next.alive = false;
      if (!next.causeOfDeath) next.causeOfDeath = '气血耗尽，陨落';
    }
    if (attr === 'lifespan' && next.age >= next.lifespan) {
      // 寿元检查由 age 推进时触发
    }
    if (attr === 'maxHp' && next.hp > next.maxHp) next.hp = next.maxHp;
    if (attr === 'maxMp' && next.mp > next.maxMp) next.mp = next.maxMp;
  }
  return next;
}

// ==================== 装备管理 (引擎权威) ====================

// 把物品的 add 效果应用到角色属性（装备时 +delta，卸下时 -delta）
export function applyItemEffects(state: CharacterState, item: ItemEntry, sign: 1 | -1): CharacterState {
  let next = { ...state };
  const changes: AttributeChange[] = [];
  for (const eff of item.effects || []) {
    if (eff.operation === 'add' && ATTRIBUTE_BOUNDS[eff.target_attribute]) {
      changes.push({
        attribute: eff.target_attribute,
        delta: sign * eff.value,
        reason: sign > 0 ? `装备 ${item.name}` : `卸下 ${item.name}`,
      });
    }
  }
  if (changes.length) next = applyChanges(next, changes);
  return next;
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
  // 2. 已装备物品中所有影响 cultivationExp 的效果
  for (const it of state.equipped || []) {
    for (const eff of it.effects || []) {
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
  // 3. 状态词条中影响 cultivationExp 的（如九阳之体等奇缘）
  for (const s of state.activeStatuses || []) {
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
  // 4. Task 22: 心魔值惩罚（仅当 >= 30 显示）
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
  // 5. Task 23: 灵宠陪伴效应
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
  for (const it of state.equipped || []) {
    for (const eff of it.effects || []) {
      if (eff.target_attribute !== 'cultivationExp') continue;
      if (eff.operation === 'multiply' && eff.value > 0) multiplier *= eff.value;
      else if (eff.operation === 'add') flatBonus += eff.value;
    }
  }
  for (const s of state.activeStatuses || []) {
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
    inventory: (state.inventory || []).map(normalizeCultivationBearingItem),
    equipped: (state.equipped || []).map(normalizeCultivationBearingItem),
  };
  const rate = computeEffectiveCultivationRate(normalizedState);
  return {
    ...normalizedState,
    cultivationMultiplier: rate.multiplier,
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

export function buildLearnedCombatArts(state: CharacterState): { itemId: string; name: string; description: string; mpCost: number; power: number; rarity?: string; sourceType?: string }[] {
  return (state.equipped || [])
    .filter(it => it.item_type === 'scripture' || it.item_type === 'artifact')
    .map(it => ({
      itemId: it.id,
      name: it.name,
      description: it.description,
      mpCost: Math.max(5, Math.floor((it.rarity === 'mythic' ? 30 : it.rarity === 'legendary' ? 25 : it.rarity === 'epic' ? 20 : it.rarity === 'rare' ? 15 : 10))),
      power: 1 + (safeRarityIndex(it.rarity) * 0.5),
      rarity: it.rarity,
      sourceType: it.item_type,
    }))
    .slice(0, 8);
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

function buildEnemyCarriedLoot(enemy: CombatEnemy, state: CharacterState, enemyIndex: number): { items: ItemEntry[]; spiritStones: number } {
  const text = `${enemy.name || ''} ${enemy.description || ''}`;
  const tier = enemyLootTier(enemy, state);
  const baseRarity = clampRarityIndex(Math.max(0, tier - 1));
  const betterRarity = clampRarityIndex(tier);
  const source = `${enemy.name || '敌修'}遗物`;
  const items: ItemEntry[] = [];
  const addItem = (name: string, description: string, item_type: ItemEntry['item_type'], rarity: ItemRarity, effects: any[], suffix: string) => {
    items.push({ id: makeLootId(`loot_${enemyIndex}_${suffix}`), name, description, item_type, rarity, effects, source });
  };

  const title = enemy.name || '敌修';
  const isCultivator = /修|道人|魔|邪|劫|散人|真人|老祖|剑|宗|门/.test(text) || tier >= 1;
  const isBeast = /妖|兽|狼|虎|蛟|蛇|蛛|狐|猿|禽|鸟/.test(text);

  if (isCultivator) {
    addItem(
      `${title.replace(/^(蒙面|黑衣)/, '')}的储物袋`,
      `从${title}身侧搜得的小型储物法器，袋口禁制已散，可并入自身储物之用。`,
      'tool',
      baseRarity,
      [{ target_attribute: 'storageCapacity', operation: 'add', value: Math.max(8, 8 + tier * 10), description: `储物上限+${Math.max(8, 8 + tier * 10)}` }],
      'bag'
    );
    addItem(
      /剑|剑修/.test(text) ? '染血飞剑' : /魔|邪|血/.test(text) ? '血纹短刃' : '夺来的护身法器',
      /魔|邪|血/.test(text) ? '刃上血纹未灭，仍残存几分凶煞灵机。' : '虽经斗法震荡，核心禁制尚未崩坏，可重新祭炼。',
      /剑|刃|刀/.test(text) ? 'weapon' : 'artifact',
      betterRarity,
      [{ target_attribute: /剑|刃|刀/.test(text) ? 'attack' : 'defense', operation: 'add', value: Math.max(6, 8 + tier * 8), description: /剑|刃|刀/.test(text) ? `攻伐+${Math.max(6, 8 + tier * 8)}` : `护身+${Math.max(6, 8 + tier * 8)}` }],
      'gear'
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

export function buildCombatVictorySpoils(state: CharacterState, session: CombatSession): { items: ItemEntry[]; spiritStones: number } {
  if (!session || session.status !== 'victory') return { items: [], spiritStones: 0 };
  const enemies = session.enemies || [];
  const allItems: ItemEntry[] = [];
  let spiritStones = 0;
  enemies.forEach((enemy, idx) => {
    const loot = buildEnemyCarriedLoot(enemy, state, idx);
    allItems.push(...loot.items);
    spiritStones += loot.spiritStones;
  });
  const triggerDrops = Array.isArray(session.victoryDrops) ? session.victoryDrops : [];
  allItems.push(...triggerDrops.map((it, idx) => ({ ...it, id: it.id || makeLootId(`drop_${idx}`), source: it.source || '战利所得' })));

  const seen = new Set<string>();
  const deduped = allItems.filter(item => {
    const key = `${item.name}|${item.item_type}|${item.rarity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(4, 6 + enemies.length * 3));
  return { items: deduped, spiritStones };
}

// 装备物品（从 inventory 移到 equipped 数组末尾，不限制同类型数量）
// 不再替换同槽位物品——玩家可戴多个戒指、脖挂一串储物戒指等，由 AI 在 equipNote 中描述位置
export function equipItem(state: CharacterState, itemId: string): { state: CharacterState; ok: boolean; error?: string; item?: ItemEntry } {
  const idx = state.inventory.findIndex(it => it.id === itemId);
  if (idx < 0) return { state, ok: false, error: '物品不在储物袋中' };
  const item = state.inventory[idx];
  const slot = itemToSlot(item.item_type);
  if (!slot) return { state, ok: false, error: '该物品不可装备' };
  // 储物袋本身不需要装备（获得即生效），装备上去反而会使其属性不生效
  if (isStorageBag(item)) return { state, ok: false, error: '储物袋无需装备，获得即扩容' };

  // 补默认 equipNote（若物品本身没有）
  const equippedItem: ItemEntry = {
    ...item,
    equipNote: item.equipNote || DEFAULT_EQUIP_NOTE[slot] || '装备',
  };
  let next: CharacterState = {
    ...state,
    inventory: state.inventory.filter(it => it.id !== itemId),
    equipped: [...(state.equipped || []), equippedItem],
  };
  next = applyItemEffects(next, equippedItem, 1);
  next = recalcCultivationMultiplier(next);
  return { state: next, ok: true, item: equippedItem };
}

// 卸下指定物品（按 id 从 equipped 数组移除）
export function unequipItem(state: CharacterState, itemId: string): { state: CharacterState; ok: boolean; error?: string; item?: ItemEntry } {
  const item = (state.equipped || []).find(it => it.id === itemId);
  if (!item) return { state, ok: false, error: '该物品未装备' };
  let next: CharacterState = {
    ...state,
    equipped: (state.equipped || []).filter(it => it.id !== itemId),
    inventory: [...state.inventory, item],
  };
  next = applyItemEffects(next, item, -1);
  next = recalcCultivationMultiplier(next);
  return { state: next, ok: true, item };
}

// 使用消耗品（consumable）：应用效果后从 inventory 移除
export function consumeItem(state: CharacterState, itemId: string): { state: CharacterState; ok: boolean; error?: string; item?: ItemEntry } {
  const item = state.inventory.find(it => it.id === itemId);
  if (!item) return { state, ok: false, error: '物品不在储物袋中' };
  if (item.item_type !== 'consumable') return { state, ok: false, error: '仅丹药类物品可使用' };
  let next: CharacterState = {
    ...state,
    inventory: state.inventory.filter(it => it.id !== itemId),
  };
  // 应用 add 效果到属性；trigger 效果暂不处理（可后续扩展为加状态词条）
  next = applyItemEffects(next, item, 1);
  return { state: next, ok: true, item };
}

// AI 联动：按 id 移除物品（破坏/消耗）。可同时存在于 inventory 或 equipped。
export function removeItemsByIds(state: CharacterState, ids: string[]): { state: CharacterState; removed: ItemEntry[] } {
  if (!ids.length) return { state, removed: [] };
  const idSet = new Set(ids);
  let next = { ...state };
  const removed: ItemEntry[] = [];
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
        next = applyItemEffects(next, it, -1);
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
  return { state: next, removed };
}

// AI 联动：按 id 将物品从 inventory 移到 equipped（AI 可在 interfere 中装备物品，并设置 equipNote）
export function equipItemsByIds(state: CharacterState, ids: string[]): { state: CharacterState; equipped: ItemEntry[] } {
  if (!ids.length) return { state, equipped: [] };
  const idSet = new Set(ids);
  let next = { ...state };
  const toEquip: ItemEntry[] = [];
  const keptInv: ItemEntry[] = [];
  for (const it of state.inventory) {
    if (idSet.has(it.id)) {
      const slot = itemToSlot(it.item_type);
      if (slot && !isStorageBag(it)) {
        toEquip.push({ ...it, equipNote: it.equipNote || DEFAULT_EQUIP_NOTE[slot] || '装备' });
      } else {
        keptInv.push(it); // 不可装备的物品留在背包
      }
    } else {
      keptInv.push(it);
    }
  }
  if (!toEquip.length) return { state: next, equipped: [] };
  next.inventory = keptInv;
  next.equipped = [...(next.equipped || []), ...toEquip];
  for (const it of toEquip) next = applyItemEffects(next, it, 1);
  next = recalcCultivationMultiplier(next);
  return { state: next, equipped: toEquip };
}

// AI 联动：按 id 将物品从 equipped 移回 inventory（AI 可在 interfere 中卸下物品）
export function unequipItemsByIds(state: CharacterState, ids: string[]): { state: CharacterState; unequipped: ItemEntry[] } {
  if (!ids.length) return { state, unequipped: [] };
  const idSet = new Set(ids);
  let next = { ...state };
  const toUnequip: ItemEntry[] = [];
  const keptEq: ItemEntry[] = [];
  for (const it of next.equipped || []) {
    if (idSet.has(it.id)) toUnequip.push(it);
    else keptEq.push(it);
  }
  if (!toUnequip.length) return { state: next, unequipped: [] };
  next.equipped = keptEq;
  for (const it of toUnequip) next = applyItemEffects(next, it, -1);
  next = recalcCultivationMultiplier(next);
  next.inventory = [...next.inventory, ...toUnequip];
  return { state: next, unequipped: toUnequip };
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
function pillEffects(element: string, rarity: string): { target_attribute: string; operation: string; value: number; description: string }[] {
  const powerByRarity: Record<string, number> = { common: 15, uncommon: 30, rare: 60, epic: 120, legendary: 250, mythic: 500 };
  const power = powerByRarity[rarity] || 15;
  const effByElement: Record<string, { target: string; desc: string }[]> = {
    fire: [{ target: 'attack', desc: '火力催动，攻伐加成' }, { target: 'maxHp', desc: '阳火淬体，气血略增' }],
    water: [{ target: 'maxMp', desc: '玄水润脉，灵力提升' }, { target: 'mp', desc: '补水培元，灵力恢复' }],
    wood: [{ target: 'hp', desc: '木气生机，气血恢复' }, { target: 'cultivationExp', desc: '木气滋养，修为微增' }],
    metal: [{ target: 'attack', desc: '金锐之气，攻伐提升' }, { target: 'speed', desc: '金气轻灵，身法加快' }],
    earth: [{ target: 'defense', desc: '土气厚重，防御加固' }, { target: 'maxHp', desc: '土气培元，气血上限增' }],
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
}

export function alchemy(
  state: CharacterState,
  materialIds: string[],
  spiritStoneCost: number = 10
): AlchemyResult {
  // 校验材料数量
  if (materialIds.length < 2 || materialIds.length > 3) {
    return { state, ok: false, error: '须选 2-3 件材料入炉', success: false, narrative: '', consumedMaterials: [], spiritStoneCost: 0, successRate: 0 };
  }
  // 校验材料都在储物袋
  const materials: ItemEntry[] = [];
  for (const id of materialIds) {
    const m = state.inventory.find(it => it.id === id);
    if (!m) return { state, ok: false, error: '材料不在储物袋中', success: false, narrative: '', consumedMaterials: [], spiritStoneCost: 0, successRate: 0 };
    materials.push(m);
  }
  // 校验灵石
  if (state.spiritStones < spiritStoneCost) {
    return { state, ok: false, error: `灵石不足，需 ${spiritStoneCost} 灵石`, success: false, narrative: '', consumedMaterials: [], spiritStoneCost: 0, successRate: 0 };
  }

  // 计算成功率
  const comprehensionBonus = state.comprehension * 0.4;
  const rootBonus = (state.rootMultiplier || 0) * 5;
  const avgRarityIdx = materials.reduce((s, m) => s + rarityIndex(m.rarity), 0) / materials.length;
  const rarityBonus = avgRarityIdx * 8;
  const countPenalty = (materials.length - 2) * 5;
  let successRate = 30 + comprehensionBonus + rootBonus + rarityBonus - countPenalty;
  successRate = Math.max(10, Math.min(95, successRate));

  // 消耗材料 + 灵石
  let next: CharacterState = {
    ...state,
    inventory: state.inventory.filter(it => !materialIds.includes(it.id)),
    spiritStones: state.spiritStones - spiritStoneCost,
  };

  // 判定成功
  const roll = Math.random() * 100;
  const success = roll < successRate;

  if (!success) {
    // 失败：得废丹
    const wastePill: ItemEntry = {
      id: `item_pil_waste_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: '废丹',
      description: '炼丹失败所成的焦黑丹药，仅余微薄药力',
      item_type: 'consumable',
      rarity: 'common',
      effects: [{ target_attribute: 'hp', operation: 'add', value: 5, description: '勉强可服，恢复少许气血' }],
      source: '炼丹失败所得',
    };
    next.inventory = [...next.inventory, wastePill];
    return {
      state: next,
      ok: true,
      success: false,
      narrative: `丹炉中骤然炸响，${materials.map(m => m.name).join('、')}化为飞灰。你心有不甘，从残渣中刮得一枚焦黑废丹。`,
      product: wastePill,
      consumedMaterials: materials,
      spiritStoneCost,
      successRate,
    };
  }

  // 成功：判定主要元素（取材料中最常出现的元素）
  const elementCounts: Record<string, number> = {};
  for (const m of materials) {
    const el = extractMaterialElement(m);
    if (el) elementCounts[el] = (elementCounts[el] || 0) + 1;
  }
  let mainElement = 'wood';
  let maxCount = 0;
  for (const [el, cnt] of Object.entries(elementCounts)) {
    if (cnt > maxCount) { maxCount = cnt; mainElement = el; }
  }
  // 若材料无元素倾向，按灵根五行倾向取（简化为木）
  if (maxCount === 0) mainElement = 'wood';

  // 丹药 rarity：平均材料 rarity ± 1（随机浮动）
  const avgIdx = Math.round(avgRarityIdx);
  const drift = Math.random() < 0.4 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  let pillRarityIdx = Math.max(0, Math.min(4, avgIdx + drift)); // 不超过 legendary
  const pillRarity = RARITY_ORDER[pillRarityIdx];

  // 丹药名
  const namePool = PILL_NAMES_BY_ELEMENT[mainElement]?.[pillRarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'];
  const pillName = namePool?.[Math.floor(Math.random() * namePool.length)] || `${mainElement}元丹`;

  // 丹药效果
  const effects = pillEffects(mainElement, pillRarity) as any;

  const pill: ItemEntry = {
    id: `item_pil_${mainElement}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: pillName,
    description: `以${materials.map(m => m.name).join('、')}炼制而成的${pillRarity === 'common' ? '凡品' : pillRarity === 'legendary' ? '传说' : ''}丹药，蕴含${mainElement === 'fire' ? '火' : mainElement === 'water' ? '水' : mainElement === 'wood' ? '木' : mainElement === 'metal' ? '金' : '土'}属性之力`,
    item_type: 'consumable',
    rarity: pillRarity as any,
    effects,
    source: '炼丹炉所炼',
  };

  next.inventory = [...next.inventory, pill];

  const elementZh = mainElement === 'fire' ? '火' : mainElement === 'water' ? '水' : mainElement === 'wood' ? '木' : mainElement === 'metal' ? '金' : '土';
  const rarityZh: Record<string, string> = { common: '凡品', uncommon: '良品', rare: '稀有', epic: '史诗', legendary: '传说' };

  return {
    state: next,
    ok: true,
    success: true,
    narrative: `丹炉中异光乍现，${elementZh}属灵气汇聚成形。你心念一动，扣住炉盖——一颗${rarityZh[pillRarity]}丹药跃然而出：${pillName}。`,
    product: pill,
    consumedMaterials: materials,
    spiritStoneCost,
    successRate,
  };
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

      // ===== Phase-α 批 1 α-1: 首次大境界突破触发天劫判定 =====
      // 仅当跨越大境界（new realmLevel=0 且非 mortal→qi_refining 的凡人首踏仙路，
      // 以及 qi_refining→foundation / foundation→golden_core / golden_core→nascent_soul …）时判定。
      // mortal → qi_refining 视为"开仙路"，跳过天劫（修真小说的常见设定）。
      // 已在该大境界历劫过（lastTribulationTargetRealm === nextRealm）→ skipped，不再触发。
      const isFirstEnterMajorRealm = (
        nextRealm !== 'qi_refining'
        && state.realm !== nextRealm
        && state.realmLevel <= 0
      );
      const alreadyTribulated = next.tribulationProfile?.lastTribulationTargetRealm === nextRealm;
      if (isFirstEnterMajorRealm && !alreadyTribulated && next.alive) {
        const originalRealm = state.realm;
        const outcome = computeTribulationOutcome(next, nextRealm);
        if (outcome.verdict === 'failed_fall_realm') {
          // 提前回滚：保持 state.realm (原境界)，不进入 nextRealm
          next = {
            ...next,
            realm: originalRealm,
            realmLevel: Math.min(state.realmLevel, getRealmInfo(originalRealm).levels - 1),
          };
          outcome.revertedRealm = originalRealm;
        }
        next = applyTribulationResult(next, outcome);
        // 若致命 → 立即停步，不再跳更大境界
        if (!next.alive) break;
      }
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

// ==================== Phase-α 批 1 α-1: 雷劫/天劫 判定与落地 ====================

// 天劫判定档位（修真风味，不可外露为"算法/概率"机制词）
export type TribulationVerdict =
  | 'passed_with_refinement'  // 渡过并获得淬体加成（天降祥瑞、灵台稳固）
  | 'passed_barely'           // 堪堪渡过，身心俱疲，轻伤
  | 'failed_fall_realm'       // 失败跌回原境界，不掉大境界
  | 'failed_fatal'            // 渡劫陨落
  | 'skipped';                // 跳过——已在该大境界历劫过

export interface TribulationOutcome {
  verdict: TribulationVerdict;
  targetRealm: Realm;
  // 失败时的回滚境界（仅 failed_fall_realm 使用）
  revertedRealm?: Realm;
  // 渡劫后的淬体加成（仅 passed_with_refinement 使用）
  refinementBonus?: TribulationHistoryEntry['refinementBonus'];
  // 因果残响（karma 偏移）
  karmaShift: number;
  // 中文叙事因由（渡劫者视角的一句话）
  reason: string;
}

// 计算渡劫下场（不落 state）
// 修真风味的硬约束：
// - 致命陨落 ≤ 30% 上限（owner 关注点）
// - 首次大境界失败：fall-realm 概率占多数，fatal 仅在极低气血/极重业火时触发
// - 高 karma（善）提升 passed_with_refinement 概率；低 karma（恶）提升 failed_fall_realm 概率
// - sin 高叠加会提升致命概率
export function computeTribulationOutcome(state: CharacterState, targetRealm: Realm): TribulationOutcome {
  const karma = Number(state.karma || 0);
  const sin = Number(state.sin || 0);
  const merit = Number(state.merit || 0);
  const hpRatio = state.maxHp > 0 ? state.hp / state.maxHp : 0;

  // 基础判定值（0..1）：修真世界观"天时、地利、人和"用伪随机种子近似模拟
  // 锚点：age + sin - merit + (realm 索引) → 给出稳定可重现的判定
  const seedRaw = Math.abs(Math.floor(state.age)) + sin * 7 - merit * 3 + state.realmLevel * 5;
  const seed = ((seedRaw % 100) + 100) % 100; // 0..99
  const fateRoll = seed / 100; // 0..1

  // karma 在 ±1 之间：正负偏移影响判定
  const karmaDelta = Math.max(-0.15, Math.min(0.15, karma * 0.15));

  // 致命区间宽度：sin 累加会扩展致命区间（每 10 点 +0.02），但上限 0.30
  // 气血极低（< 30%）→ 致命区间再扩 +0.15
  const fatalRange = Math.min(0.30, 0.05 + sin * 0.01) + (hpRatio < 0.3 ? 0.15 : 0);

  // 失败跌境区间：sin + 恶 karma 拉高此区间；最大 0.25
  const fallRange = Math.min(0.25, 0.10 + sin * 0.005 + (karma < 0 ? -karma * 0.05 : 0));

  // 调整值：善者向成功偏移，恶者向失败偏移
  const adjusted = fateRoll - karmaDelta;

  let verdict: TribulationVerdict;
  let refinementBonus: TribulationHistoryEntry['refinementBonus'] | undefined;
  let karmaShift = 0;
  let reason = '';

  if (adjusted < fatalRange) {
    verdict = 'failed_fatal';
    karmaShift = -0.05 - sin * 0.001; // 致命时业火更盛
    reason = sin > 20
      ? '业火缠身，天雷灌顶，道基崩解'
      : hpRatio < 0.3
        ? '气血早已亏虚，天雷之下再无余力'
        : '天雷凶猛，道基难承，魂飞魄散';
  } else if (adjusted < fatalRange + fallRange) {
    verdict = 'failed_fall_realm';
    karmaShift = -0.02;
    reason = karma < -0.3
      ? '杀业深重，天雷反噬，跌回原境界'
      : '雷云之下难以寸进，跌回原境界以图再破';
  } else if (adjusted < 0.50) {
    verdict = 'passed_barely';
    karmaShift = 0;
    reason = '勉强渡过天劫，神魂疲惫，根基尚稳';
  } else {
    verdict = 'passed_with_refinement';
    // 淬体加成：maxHp +20%, maxMp +20%, attack +15%, defense +15%, speed +10%
    refinementBonus = {
      maxHp: 1.2,
      maxMp: 1.2,
      attack: 1.15,
      defense: 1.15,
      speed: 1.1,
    };
    karmaShift = merit > 10 ? 0.02 : 0.01;
    reason = merit > 10
      ? '功德护心，天降祥瑞，雷霆淬体'
      : '天雷淬体，灵台稳固，根基更深一层';
  }

  return {
    verdict,
    targetRealm,
    refinementBonus,
    karmaShift,
    reason,
    revertedRealm: verdict === 'failed_fall_realm' ? state.realm : undefined,
  };
}

// 应用渡劫结果到 state（落库）：
// - passed_with_refinement：进入新境界 + 淬体加成 + 落档案
// - passed_barely：进入新境界，无淬体，hp/mp 扣 30% 表示疲态
// - failed_fall_realm：留在原境界（不进入新境界），hp 扣 40%，expToBreak 略降以备再破
// - failed_fatal：alive=false，causeOfDeath 写入，sin +5（业火归身）
export function applyTribulationResult(state: CharacterState, outcome: TribulationOutcome): CharacterState {
  let next: CharacterState = { ...state };
  // 更新 karma
  next.karma = clampProfileNumber((next.karma || 0) + outcome.karmaShift, -1, 1, 0);

  // 追加历史
  const history = Array.isArray(next.tribulationProfile?.tribulationHistory)
    ? next.tribulationProfile!.tribulationHistory.slice()
    : [];
  const entry: TribulationHistoryEntry = {
    age: next.age,
    targetRealm: outcome.targetRealm,
    result: outcome.verdict,
    refinementBonus: outcome.refinementBonus,
    karmaShift: outcome.karmaShift,
    reason: outcome.reason,
  };
  history.push(entry);
  const newProfile: TribulationProfile = {
    ...(next.tribulationProfile || {}),
    lastTribulationAge: next.age,
    lastTribulationTargetRealm: outcome.targetRealm,
    lastTribulationResult: outcome.reason,
    tribulationHistory: history.slice(-10),
  };
  next.tribulationProfile = newProfile;

  if (outcome.verdict === 'failed_fatal') {
    next.alive = false;
    next.hp = 0;
    next.causeOfDeath = outcome.reason || '陨落于天劫';
    // 致命陨落：杀业归身
    next.sin = Math.max(0, (next.sin || 0) + 5);
    return next;
  }

  if (outcome.verdict === 'failed_fall_realm') {
    // 留在原境界（revertedRealm 若提供则回滚；缺省保持当前）
    if (outcome.revertedRealm && next.realm !== outcome.revertedRealm) {
      next.realm = outcome.revertedRealm;
      next.realmLevel = Math.min(next.realmLevel, getRealmInfo(outcome.revertedRealm).levels - 1);
    }
    // 跌境扣血
    next.hp = Math.max(1, Math.floor(next.maxHp * 0.4));
    next.mp = Math.max(0, Math.floor(next.maxMp * 0.4));
    // expToBreak 略降以备再破
    next.expToBreak = Math.floor(next.expToBreak * 0.7);
    // 失败跌境 sin +2
    next.sin = Math.max(0, (next.sin || 0) + 2);
    return next;
  }

  if (outcome.verdict === 'passed_barely') {
    // 进入新境界（state.realm 已被调用方切换），hp/mp 扣 30%
    next.hp = Math.max(1, Math.floor(next.maxHp * 0.7));
    next.mp = Math.max(0, Math.floor(next.maxMp * 0.7));
    return next;
  }

  // passed_with_refinement
  if (outcome.refinementBonus) {
    const b = outcome.refinementBonus;
    if (b.maxHp) next.maxHp = Math.floor(next.maxHp * b.maxHp);
    if (b.maxMp) next.maxMp = Math.floor(next.maxMp * b.maxMp);
    if (b.attack) next.attack = Math.floor(next.attack * b.attack);
    if (b.defense) next.defense = Math.floor(next.defense * b.defense);
    if (b.speed) next.speed = Math.floor(next.speed * b.speed);
    next.hp = next.maxHp;
    next.mp = next.maxMp;
    // 渡劫成功且功德高 → merit +3
    if ((next.merit || 0) > 10) {
      next.merit = (next.merit || 0) + 3;
    }
  }
  return next;
}

// ==================== Phase-α 批 1 α-2: 因果业力调整 ====================

// 引擎权威的 karma/merit/sin 调整器
// AI 在叙事中点出"杀无辜/救一命/渡亡魂/济世"等行为后，引擎按 aiOutput.changes 标签或显式调用累加
// reason 仅作存档/审计，不入 narrative
export interface KarmaAdjustment {
  deltaMerit: number;
  deltaSin: number;
  // 引擎推断的标签：'rescue' | 'mercy' | 'meridian' | 'massacre' | 'kill_innocent' | 'butcher' | 'slay_demon' | 'general'
  tag?: 'rescue' | 'mercy' | 'meridian' | 'massacre' | 'kill_innocent' | 'butcher' | 'slay_demon' | 'general';
  reason?: string;
}

export function adjustKarma(state: CharacterState, adjustment: KarmaAdjustment): CharacterState {
  const { deltaMerit = 0, deltaSin = 0, tag = 'general', reason } = adjustment;
  if (!deltaMerit && !deltaSin) return state;
  const next: CharacterState = { ...state };
  // merit / sin 累计（最小 0）
  next.merit = Math.max(0, (next.merit || 0) + Math.max(0, deltaMerit));
  next.sin = Math.max(0, (next.sin || 0) + Math.max(0, deltaSin));

  // karma 连续值：merit 高 → 向 + 偏移；sin 高 → 向 - 偏移
  // 步进：每 5 单位的 merit/sin 偏移 karma 0.01，封顶 ±1
  const net = (next.merit || 0) - (next.sin || 0);
  const shift = clampProfileNumber(net / 500, -1, 1, 0); // 500 单位净业 → ±1 karma
  // 若是显式 rescue/massacre 等强标签，再叠加一次性偏移
  let tagShift = 0;
  if (tag === 'rescue' || tag === 'mercy' || tag === 'meridian') tagShift = 0.02;
  if (tag === 'massacre' || tag === 'butcher' || tag === 'kill_innocent') tagShift = -0.03;
  // 平滑到现有 karma（不突变）
  next.karma = clampProfileNumber(((next.karma || 0) + shift * 0.1) + tagShift, -1, 1, 0);

  if (reason && next.longTermMemory && !next.longTermMemory.includes(reason)) {
    next.longTermMemory = [...next.longTermMemory, reason].slice(-50);
  }
  return next;
}

// 根据 aiOutput.changes 的 attribute+reason 文本推断 karma 增量
// attribute 只识别 reason 含特定中文标签的情况（不强制 AI 使用 attribute 字段；这里是软解析）
export function inferKarmaFromChanges(aiOutput: AIEventOutput): KarmaAdjustment {
  let deltaMerit = 0;
  let deltaSin = 0;
  let tag: KarmaAdjustment['tag'] = 'general';
  let reasonAcc = '';

  for (const ch of aiOutput.changes || []) {
    const text = `${ch.reason || ''}`;
    if (/救一命|救下|救出|济世|济困|渡化|渡亡魂|超度|慈悲|舍命相救|布施/.test(text)) {
      deltaMerit += 5;
      tag = 'rescue';
      reasonAcc = `${ch.reason}（功德+5）`;
    } else if (/杀无辜|滥杀|屠戮|屠杀|屠村|灭门|嗜杀|血洗/.test(text)) {
      deltaSin += 5;
      tag = 'butcher';
      reasonAcc = `${ch.reason}（杀业+5）`;
    } else if (/击杀|斩杀|诛杀|伏妖|除魔/.test(text)) {
      // 杀妖魔/邪修：小幅 sin（修真世界的合理杀戮），但有时可加 merit（除魔卫道）
      if (/魔|邪|妖|鬼/.test(text)) {
        deltaSin += 1;
        deltaMerit += 1;
        tag = 'slay_demon';
        reasonAcc = `${ch.reason}（除魔卫道，功德+1 杀业+1）`;
      } else {
        deltaSin += 2;
        reasonAcc = `${ch.reason}（杀业+2）`;
      }
    }
  }

  // sinReason 显式标记强杀业
  if (aiOutput.sinReason && /杀|屠|灭|戮/.test(aiOutput.sinReason)) {
    deltaSin += 3;
    if (tag === 'general') tag = 'massacre';
    reasonAcc = reasonAcc || `${aiOutput.sinReason}（杀业+3）`;
  }

  return { deltaMerit, deltaSin, tag, reason: reasonAcc };
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
  // 修复：扩展 special 含"心境/余韵/感悟"词条的状态——AI prompt (llm.ts:616) 明确要求玩家顶部展示这些，
  // 但旧过滤会把没有数值效果的"旧铜同源之念/旧铜花纹在心"等状态过滤掉，导致 StatusPanel 不显示。
  const category = status.category;
  const text = `${status.name || ''} ${status.description || ''} ${status.source || ''}`;
  if (category === 'identity' || category === 'quest') return true;
  if (category === 'special' && /(身份|师承|宗门|命格|命途|奇缘|传承|血脉|体质|灵体|道体|剑体|骨|体|誓约|因果|线索|印记|称号|灵宠|契约|心境|感悟|余韵|心法|心痕|在心|之念|之悟|之感|之缘|入心|印心|铭心|心相|机|兆|痕|韵|缘|意|念|志|怀|道)/.test(text)) return true;
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

export function addStatuses(state: CharacterState, statuses: StatusEntry[]): CharacterState {
  const meaningful = filterMeaningfulStatuses(statuses || []);
  if (!meaningful.length) return state;
  const existingIds = new Set(state.activeStatuses.map(s => s.id));
  const existingNames = new Set(state.activeStatuses.map(s => s.name));
  const newStatuses = meaningful.filter(s => !existingIds.has(s.id) && !existingNames.has(s.name));
  return { ...state, activeStatuses: [...state.activeStatuses, ...newStatuses] };
}

export function tickStatusDurations(state: CharacterState): CharacterState {
  // 每过一岁，持续状态 duration -1
  const ticked = state.activeStatuses.map(s => ({
    ...s,
    duration: s.duration === -1 ? -1 : s.duration - 1,
  }));
  const alive = ticked.filter(s => s.duration === -1 || s.duration > 0);
  return { ...state, activeStatuses: filterMeaningfulStatuses(alive) };
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

function normalizeCultivationBearingItem(it: ItemEntry): ItemEntry {
  const hasStorageEffect = (it.effects || []).some(e => e.target_attribute === 'storageCapacity' && e.operation === 'add' && e.value > 0);
  let itemType = it.item_type;
  if (!VALID_ITEM_TYPES_FOR_NORMALIZE.has(itemType)) {
    itemType = hasStorageEffect ? 'tool' : 'material';
  } else if (hasStorageEffect && itemType !== 'tool') {
    itemType = 'tool';
  }

  const isScriptureByName = SCRIPTURE_NAME_RE.test(`${it.name || ''}${it.description || ''}`);
  if (isScriptureByName && itemType !== 'scripture') {
    itemType = 'scripture';
  }

  let effects = Array.isArray(it.effects) ? it.effects.map(e => {
    if (CULTIVATION_EFFECT_ALIASES.has(e.target_attribute) && e.target_attribute !== 'cultivationExp') {
      return { ...e, target_attribute: 'cultivationExp' };
    }
    return e;
  }) : [];

  if (itemType === 'scripture' && !effects.some(e => e.target_attribute === 'cultivationExp' && e.operation === 'multiply')) {
    const mult = defaultScriptureMultiplier(it.rarity as string);
    effects = [...effects, {
      target_attribute: 'cultivationExp',
      operation: 'multiply',
      value: mult,
      description: `修习此功法，修为流转加速×${mult}`,
    }];
  }

  // α-4 功法三段：scripture 类型缺省填初习 + 0 进度；旧数据无字段也视为初习
  // 不在此处覆写 AI 已经给出的合法 stage/exp（保留跨 session 累计）
  let scriptureStage: ItemEntry['scriptureStage'] | undefined = it.scriptureStage;
  let scriptureExp: number | undefined = it.scriptureExp;
  let scriptureAwakeningHook: string | undefined = it.scriptureAwakeningHook;
  if (itemType === 'scripture') {
    if (!scriptureStage || !['practiced', 'awakened', 'transcendent'].includes(scriptureStage)) {
      scriptureStage = 'practiced';
    }
    if (typeof scriptureExp !== 'number' || !Number.isFinite(scriptureExp) || scriptureExp < 0) {
      scriptureExp = 0;
    } else if (scriptureExp > 100) {
      scriptureExp = 100;
    }
  } else {
    // 非 scripture 类型强制清掉三段字段——避免被旧数据 / 错误传递污染
    scriptureStage = undefined;
    scriptureExp = undefined;
    scriptureAwakeningHook = undefined;
  }

  return {
    ...it,
    item_type: itemType as any,
    effects,
    scriptureStage,
    scriptureExp,
    scriptureAwakeningHook,
  };
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

// ==================== α-4 功法三段（经/诀/神通）====================

// 阶段阈值表（闭区间右开；与 InventoryPanel chip 颜色映射保持一致）
// 0..33 = practiced(初习) / 34..66 = awakened(觉意) / 67..100 = transcendent(神通 / 大成)
export const SCRIPTURE_STAGE_THRESHOLDS: { stage: 'practiced' | 'awakened' | 'transcendent'; min: number; max: number; label: string; color: string }[] = [
  { stage: 'practiced',     min: 0,  max: 33, label: '初习', color: '#9ca3af' }, // 灰
  { stage: 'awakened',      min: 34, max: 66, label: '觉意', color: '#14b8a6' }, // 青
  { stage: 'transcendent',  min: 67, max: 100, label: '大成', color: '#a855f7' }, // 紫
];

// 给定 exp（0..100）返回当前阶段。exp 越界会被夹紧。
// 兼容旧数据：若 item 无 stage 字段，视作 exp=0 → 'practiced'。
export function computeScriptureStage(expOrItem: number | ItemEntry | null | undefined): 'practiced' | 'awakened' | 'transcendent' {
  let exp: number;
  if (typeof expOrItem === 'number') {
    exp = expOrItem;
  } else if (expOrItem && typeof expOrItem === 'object') {
    exp = typeof expOrItem.scriptureExp === 'number' ? expOrItem.scriptureExp : 0;
  } else {
    exp = 0;
  }
  if (!Number.isFinite(exp)) exp = 0;
  const clamped = Math.max(0, Math.min(100, exp));
  if (clamped <= 33) return 'practiced';
  if (clamped <= 66) return 'awakened';
  return 'transcendent';
}

// 给出 exp 计算阶段标签（中文：初习/觉意/大成）
export function scriptureStageLabel(stage: 'practiced' | 'awakened' | 'transcendent' | null | undefined): string {
  if (stage === 'awakened') return '觉意';
  if (stage === 'transcendent') return '大成';
  return '初习';
}

// 给出 exp 计算阶段色（chip 颜色用）
export function scriptureStageColor(stage: 'practiced' | 'awakened' | 'transcendent' | null | undefined): string {
  const found = SCRIPTURE_STAGE_THRESHOLDS.find(t => t.stage === (stage || 'practiced'));
  return found?.color || '#9ca3af';
}

// 给单个 scripture 物品累计 exp，自动判定阶段并落 scriptureStage。
// expDelta 由调用方钳制（建议 [0..30]/事件 防溢出）；reason 仅用于日志，不修改物品。
// 返回 { state, item, crossedStage, oldStage }：
//   - crossedStage=true 表示本次累计跨段（practiced→awakened 或 awakened→transcendent）
//   - oldStage 用于日志 / 反馈
//   - item 已是新值（写回 inventory / equipped 后视图一致）
// 兼容：旧 scripture 无 stage 字段 → 视作初习 + 0 exp；item 不存在时返回 state 不变。
export function addScriptureProgress(
  state: CharacterState,
  scriptureId: string,
  expDelta: number,
  reason?: string
): { state: CharacterState; item: ItemEntry; crossedStage: boolean; oldStage: 'practiced' | 'awakened' | 'transcendent'; newStage: 'practiced' | 'awakened' | 'transcendent' } {
  const safeDelta = Number.isFinite(expDelta) ? Math.max(0, Math.min(30, Math.floor(expDelta))) : 0;
  // 找 inventory + equipped 两处
  let item: ItemEntry | undefined = state.inventory.find(it => it.id === scriptureId);
  let location: 'inventory' | 'equipped' | null = item ? 'inventory' : null;
  if (!item) {
    item = (state.equipped || []).find(it => it.id === scriptureId);
    if (item) location = 'equipped';
  }
  if (!item || item.item_type !== 'scripture') {
    // 找不到或非 scripture：原状返回 state，构造空 item 以便类型对齐
    return {
      state,
      item: { id: scriptureId, name: '未知功法', description: '', item_type: 'scripture', rarity: 'common', effects: [], source: 'engine' },
      crossedStage: false,
      oldStage: 'practiced',
      newStage: 'practiced',
    };
  }
  const oldExp = typeof item.scriptureExp === 'number' && Number.isFinite(item.scriptureExp) ? item.scriptureExp : 0;
  const oldStage = (item.scriptureStage && ['practiced', 'awakened', 'transcendent'].includes(item.scriptureStage))
    ? item.scriptureStage
    : computeScriptureStage(oldExp);
  const newExp = Math.max(0, Math.min(100, oldExp + safeDelta));
  const newStage = computeScriptureStage(newExp);
  const crossedStage = newStage !== oldStage;
  const awakeningHook = crossedStage
    ? (typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 80) : `${scriptureStageLabel(oldStage)} → ${scriptureStageLabel(newStage)}`)
    : item.scriptureAwakeningHook;
  const updated: ItemEntry = {
    ...item,
    scriptureExp: newExp,
    scriptureStage: newStage,
    scriptureAwakeningHook: awakeningHook,
  };
  // 写回 inventory / equipped（不可变更新）
  let next = state;
  if (location === 'inventory') {
    next = { ...state, inventory: state.inventory.map(it => it.id === scriptureId ? updated : it) };
  } else if (location === 'equipped') {
    next = { ...state, equipped: (state.equipped || []).map(it => it.id === scriptureId ? updated : it) };
  }
  return { state: next, item: updated, crossedStage, oldStage, newStage };
}

// 把 aiOutput.scriptureProgress 列表应用到 state 上（按 id 或 name 匹配）
// 单条 delta 限幅 [0..30]，跨多事件总和单场上限 100（一次 AI 事件整体不会超过整段进度）。
// 返回 { state, applied: [{ id, delta, crossedStage, oldStage, newStage, awakeningHook }], dropped }
//   - applied 顺序与输入一致
//   - dropped 是无效条目（无 itemId/itemName 或非 scripture 或不存在）
export function applyScriptureProgressFromAI(
  state: CharacterState,
  progresses: { itemId?: string; itemName: string; expDelta: number; reason?: string }[] | undefined | null
): { state: CharacterState; applied: { id: string; name: string; delta: number; crossedStage: boolean; oldStage: 'practiced' | 'awakened' | 'transcendent'; newStage: 'practiced' | 'awakened' | 'transcendent'; awakeningHook?: string }[]; dropped: number } {
  if (!Array.isArray(progresses) || progresses.length === 0) {
    return { state, applied: [], dropped: 0 };
  }
  let next = state;
  let applied: { id: string; name: string; delta: number; crossedStage: boolean; oldStage: 'practiced' | 'awakened' | 'transcendent'; newStage: 'practiced' | 'awakened' | 'transcendent'; awakeningHook?: string }[] = [];
  let dropped = 0;
  for (const p of progresses) {
    if (!p || typeof p !== 'object') { dropped++; continue; }
    const targetId = (typeof p.itemId === 'string' && p.itemId) ? p.itemId : '';
    let targetItem: ItemEntry | undefined;
    if (targetId) {
      targetItem = next.inventory.find(it => it.id === targetId) || (next.equipped || []).find(it => it.id === targetId);
    }
    if (!targetItem && p.itemName) {
      targetItem = next.inventory.find(it => it.item_type === 'scripture' && it.name === p.itemName)
        || (next.equipped || []).find(it => it.item_type === 'scripture' && it.name === p.itemName);
    }
    if (!targetItem || targetItem.item_type !== 'scripture') { dropped++; continue; }
    const result = addScriptureProgress(next, targetItem.id, p.expDelta, p.reason);
    next = result.state;
    applied.push({
      id: targetItem.id,
      name: targetItem.name,
      delta: Math.max(0, Math.min(30, Math.floor(Number(p.expDelta) || 0))),
      crossedStage: result.crossedStage,
      oldStage: result.oldStage,
      newStage: result.newStage,
      awakeningHook: result.item.scriptureAwakeningHook,
    });
  }
  return { state: next, applied, dropped };
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

// ==================== 引擎状态上下文构建 ====================

export function buildStateContext(state: CharacterState, recentEvents: { age: number; title: string; narrative: string; eventType?: string }[]): EngineStateContext {
  const realmInfo = getRealmInfo(state.realm);
  const completedFateNodes = Array.isArray(state.fateNodes) ? state.fateNodes : [];
  const safePendingThreads = Array.isArray(state.pendingThreads) ? state.pendingThreads : [];
  const safeRecentEvents = Array.isArray(recentEvents) ? recentEvents : [];
  const safeActiveStatuses = Array.isArray(state.activeStatuses) ? state.activeStatuses : [];
  const safeInventory = Array.isArray(state.inventory) ? state.inventory : [];
  const safeEquipped = Array.isArray(state.equipped) ? state.equipped : [];
  const safeCultivationFactors = Array.isArray(state.cultivationFactors) ? state.cultivationFactors : [];
  const safeLongTermMemory = Array.isArray(state.longTermMemory) ? state.longTermMemory : [];
  // 找下一个未完成的命节点
  const nextNode = FATE_NODES.find(n => !completedFateNodes.includes(n.index));
  // Task 20: 推进 urgent 线索状态（deadlineAge - age <= 3 视为 urgent）
  const threads = safePendingThreads.map(t => ({
    ...t,
    status: (t.status === 'pending' && (t.deadlineAge - state.age) <= 3) ? 'urgent' as const : t.status,
  }));
  // Task 20: 引擎根据当前处境生成角色主动意图（每岁重算）
  const intents = generateCharacterIntents(state, threads);
  state.characterIntents = intents;
  // recentEventTypes / recentBlueprintCategories 来自 dbToState 的临时闭包变量
  const recentEventTypes = (state as any)._recentEventTypes || [];
  const recentBlueprintCategories = (state as any)._recentBlueprintCategories || [];
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
      cultivationExp: state.cultivationExp,
      expToBreak: state.expToBreak,
      elements: state.elements || { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
      hp: state.hp, maxHp: state.maxHp,
      mp: state.mp, maxMp: state.maxMp,
      attack: state.attack, defense: state.defense, speed: state.speed,
      luck: state.luck, comprehension: state.comprehension,
      // 修真三宝——身神分化，引擎在 dbToState 末尾已按公式派生并 Object.assign 到 state
      spiritualSense: (state as any).spiritualSense ?? 0,
      soulStrength: (state as any).soulStrength ?? 0,
      physicalFoundation: (state as any).physicalFoundation ?? 0,
      soulRealmName: (state as any).soulRealmName ?? '未凝神',
      soulRealmRank: (state as any).soulRealmRank ?? 0,
      soulRealmGap: (state as any).soulRealmGap ?? '身神相称',
      combatProjection: (state as any).combatProjection,
      spiritStones: state.spiritStones, reputation: state.reputation,
      faction: state.faction, master: state.master, location: state.location,
      alive: state.alive, ascended: state.ascended,
      // Task 22: 心魔值——AI 可看到，可用 changes 中 attribute='heartDemon' 调整
      heartDemon: state.heartDemon ?? 0,
    },
    activeStatuses: safeActiveStatuses,
    inventory: safeInventory,
    equipped: safeEquipped,
    storageCapacity: state.storageCapacity,
    cultivationMultiplier: state.cultivationMultiplier,
    cultivationInsight: state.cultivationInsight,
    cultivationFactors: safeCultivationFactors,
    recentEvents: safeRecentEvents.slice(-5).map(e => ({ age: e.age, title: e.title, narrative: e.narrative, eventType: e.eventType || 'normal' })),
    longTermMemory: safeLongTermMemory.slice(-10),
    completedFateNodes,
    availableAttributes: Object.keys(ATTRIBUTE_BOUNDS),
    nextFateNode: nextNode ? { index: nextNode.index, name: nextNode.name, realm: nextNode.realm } : undefined,
    // Task 20 新字段
    pendingThreads: threads,
    characterIntents: intents,
    recentEventTypes,
    recentBlueprintCategories,
    // Task 23 新字段
    pets: Array.isArray(state.pets) ? state.pets : [],
    // Task 24 新字段
    exploredRealms: Array.isArray(state.exploredRealms) ? state.exploredRealms : [],
    currentExploration: (state as any)._currentExploration,
    discoveredRealms: getDiscoveredStoryRealms(state),
    // ===== Phase-α 批 2 α-7：灵田 / 节气 =====
    spiritGarden: state.spiritGarden || { zones: [] },
    solarTerm: getSolarTermForAge(state.age),
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

export function addThreads(state: CharacterState, threads: PendingThread[]): CharacterState {
  if (!threads.length) return state;
  const existingIds = new Set((state.pendingThreads || []).map(t => t.id));
  const newThreads = threads.filter(t => t && t.id && !existingIds.has(t.id)).map(t => ({
    ...t,
    status: t.status || 'pending',
    progress: t.progress || 0,
  }));
  if (!newThreads.length) return state;
  return { ...state, pendingThreads: [...(state.pendingThreads || []), ...newThreads] };
}

export function advanceThread(state: CharacterState, threadId: string, progressDelta: number, note?: string): CharacterState {
  const threads = (state.pendingThreads || []).map(t => {
    if (t.id !== threadId) return t;
    const progress = Math.max(0, Math.min(100, (t.progress || 0) + progressDelta));
    return { ...t, progress };
  });
  return { ...state, pendingThreads: threads };
}

export function completeThread(state: CharacterState, threadId: string): CharacterState {
  const threads = (state.pendingThreads || []).map(t =>
    t.id === threadId ? { ...t, status: 'resolved' as const, progress: 100 } : t
  );
  return { ...state, pendingThreads: threads };
}

export function failThread(state: CharacterState, threadId: string): CharacterState {
  const threads = (state.pendingThreads || []).map(t =>
    t.id === threadId ? { ...t, status: 'failed' as const } : t
  );
  return { ...state, pendingThreads: threads };
}

// 检查线索 deadline —— 若有线索已过期（age > deadlineAge）且未完成，标记为 failed
export function checkThreadDeadlines(state: CharacterState): { state: CharacterState; failed: PendingThread[] } {
  const failed: PendingThread[] = [];
  let changed = false;
  const threads = (state.pendingThreads || []).map(t => {
    if (t.status === 'pending' && state.age > t.deadlineAge) {
      changed = true;
      failed.push(t);
      return { ...t, status: 'failed' as const };
    }
    return t;
  });
  if (!changed) return { state, failed: [] };
  return { state: { ...state, pendingThreads: threads }, failed };
}

// ==================== Task 20: 战斗系统 ====================

// 启动战斗：从 AI 触发的 triggerCombat 创建 CombatSession
export function startCombat(state: CharacterState, trigger: NonNullable<AIEventOutput['triggerCombat']>): CharacterState {
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
  return { ...state, combatSession: session };
}

// 战斗伤害计算（简化版：基于攻防差 + 随机浮动）
function computeDamage(attack: number, defense: number, power: number = 1, variance: number = 0.2): number {
  const base = Math.max(1, attack - defense * 0.5);
  const dmg = base * power * (1 + (Math.random() * 2 - 1) * variance);
  return Math.max(1, Math.floor(dmg));
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
  action: 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee',
  payload?: { skillIdx?: number; itemId?: string },
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
    enemyHp -= playerDamageDealt;
    narrative += `你出招攻向${enemy.name}，造成 ${playerDamageDealt} 点伤害。`;
  } else if (action === 'skill' && payload?.skillIdx != null) {
    playerActionType = 'skill';
    const skill = session.playerSkills?.[payload.skillIdx];
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
    enemyHp -= playerDamageDealt;
    narrative += `你催动${skill.name}，灵力化为攻伐之力，造成 ${playerDamageDealt} 点伤害。`;
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
export function endCombat(state: CharacterState, applyDrops: boolean = true): { state: CharacterState; drops: ItemEntry[]; result: 'victory' | 'defeat' | 'fled' | 'ongoing' | null; spiritStones?: number } {
  if (!state.combatSession) return { state, drops: [], result: null, spiritStones: 0 };
  const session = state.combatSession;
  let next: CharacterState = { ...state, combatSession: null };
  let drops: ItemEntry[] = [];
  let spiritStones = 0;
  if (applyDrops && session.status === 'victory') {
    const spoils = buildCombatVictorySpoils(state, session);
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

  // 1. 应用属性变更
  const before = next;
  next = applyChanges(next, aiOutput.changes || []);
  // 识别被拒绝的（属性不在白名单的）
  for (const ch of aiOutput.changes || []) {
    if (!ATTRIBUTE_BOUNDS[ch.attribute]) rejected.push(ch);
  }

  // 2. 添加新状态词条
  next = addStatuses(next, aiOutput.newStatuses || []);

  // 3. 添加新物品
  // Task 22: 修复 AI 生成重复 ID 的问题——确保新物品 ID 与现有 inventory/equipped 不冲突
  {
    const rawNew = aiOutput.newItems || [];
    if (rawNew.length) {
      const existing = new Set<string>();
      for (const it of next.inventory) existing.add(it.id);
      for (const it of (next.equipped || [])) existing.add(it.id);
      const deduped = rawNew.map(it => {
        let id = it.id || `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        while (existing.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 6)}`;
        existing.add(id);
        return { ...it, id };
      });
      next = addItems(next, deduped);
    }
  }

  // 3.5 AI 联动：移除/破坏物品（如战斗中武器被毁、丹药被消耗）
  if (aiOutput.removedItemIds && aiOutput.removedItemIds.length) {
    const rem = removeItemsByIds(next, aiOutput.removedItemIds);
    next = rem.state;
  }

  // 3.6 AI 联动：直接放入已装备的物品（AI 创造性装备：项链·储物戒指串等）
  if (aiOutput.newEquippedItems && aiOutput.newEquippedItems.length) {
    const ensured = ensureUniqueIds([], aiOutput.newEquippedItems);
    const newEqItems = ensured.items;
    next = {
      ...next,
      equipped: [...(next.equipped || []), ...newEqItems],
    };
    // 应用 add 效果
    for (const it of newEqItems) next = applyItemEffects(next, it, 1);
    next = recalcCultivationMultiplier(next);
  }

  // 3.7 AI 联动：把背包里的物品装备上去（AI 在 advance/interfere 中指定 id）
  if (aiOutput.equipItemIds && aiOutput.equipItemIds.length) {
    const r = equipItemsByIds(next, aiOutput.equipItemIds);
    next = r.state;
  }

  // 3.8 AI 联动：把已装备的物品卸下来（AI 在 advance/interfere 中指定 id）
  if (aiOutput.unequipItemIds && aiOutput.unequipItemIds.length) {
    const r = unequipItemsByIds(next, aiOutput.unequipItemIds);
    next = r.state;
  }

  // 4. 添加长期记忆
  if (aiOutput.memory) next = addMemory(next, aiOutput.memory);

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
    next = addThreads(next, aiOutput.newThreads);
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

  // ===== Phase-α 批 1 α-4: 功法三段累计（经/诀/神通）=====
  // 引擎权威累计 scriptureProgress，AI 提议的 delta 限幅 [0..30]/条 防溢出
  // 跨段（practiced→awakened / awakened→transcendent）会自动落 scriptureStage 与 scriptureAwakeningHook
  if (aiOutput.scriptureProgress && aiOutput.scriptureProgress.length) {
    const r = applyScriptureProgressFromAI(next, aiOutput.scriptureProgress);
    next = r.state;
    // 跨段时静默写入一段记忆，便于玩家后续查证（不污染 narrative）
    for (const a of r.applied) {
      if (a.crossedStage) {
        const hook = a.awakeningHook ? `（${a.awakeningHook}）` : '';
        next = addMemory(next, `《${a.name}》功法参悟进入${scriptureStageLabel(a.newStage)}${hook}`);
      }
    }
  }

  // ===== Phase-α 批 2 α-5: 法宝养灵 / 器灵觉醒 =====
  // AI 提议的 nurtureOutput（心血祭炼/神识交流/器灵苏醒）累加到对应 item；
  // 单次事件 delta 由 addNurtureProgress 内部限幅到 [0..10]，防溢出；
  // 跨 stage 时引擎自动落回 awakeningStage + sentientName，无需 AI 在 narrative 重述。
  // itemId 优先；若缺则按 itemName 在 inventory/equipped 中精确匹配
  if (aiOutput.nurtureOutput && aiOutput.nurtureOutput.length) {
    for (const n of aiOutput.nurtureOutput) {
      let targetId = n.itemId;
      if (!targetId && n.itemName) {
        const name = String(n.itemName).trim();
        const inInventory = next.inventory?.find((it: ItemEntry) => it.name === name);
        const inEquipped = next.equipped?.find((it: ItemEntry) => it.name === name);
        targetId = (inInventory || inEquipped)?.id;
      }
      if (!targetId) continue;
      next = addNurtureProgress(next, targetId, n.delta, n.reason, n.awakenedName).state;
    }
  }

  // 8. 角色主动意图重新生成（每岁重算）
  next.characterIntents = generateCharacterIntents(next, next.pendingThreads);

  // ===== Phase-α 批 2 α-7: 灵田事件（AI 自然产出翻土/抽薹/采收/落霜） =====
  // aiOutput.gardenOutput 由 AI 在 narrative 自然产出时按 schema 给出
  // 引擎累计并按节气推进；不动 narrative，不暴露机制词
  if (aiOutput.gardenOutput && aiOutput.gardenOutput.length && next.alive && !next.ascended) {
    const gardenOps = aiOutput.gardenOutput;
    const currentAge = next.age;
    const currentSolarTerm = getSolarTermForAge(currentAge);
    for (const op of gardenOps) {
      if (!op || typeof op !== 'object') continue;
      const action = op.action;
      if (action === 'plant' || action === 'tend') {
        // 翻土/播种/照料：注册新 zone（若指定 seed）；或对现有 zone 做质量微调
        const seed = (op.seed || '').trim();
        if (seed && action === 'plant') {
          next = addGardenZone(next, {
            seed,
            quality: Math.max(0, Math.min(100, Number(op.quality ?? 50))),
            atmosphere: (op.note || '').trim().slice(0, 80) || `${currentSolarTerm}翻土`,
          }, currentAge);
        } else if (action === 'tend' && op.zoneId) {
          // 照料现有 zone —— 仅微调 atmosphere，不修改 quality/atmosphere（避免重复叠加）
          const existing = (next.spiritGarden?.zones || []).find(z => z.id === op.zoneId);
          if (existing) {
            const note = (op.note || '').trim().slice(0, 60);
            if (note) {
              const updatedZones = next.spiritGarden!.zones.map(z => z.id === op.zoneId
                ? { ...z, atmosphere: `${z.atmosphere}｜${currentSolarTerm}：${note}` }
                : z
              );
              next = { ...next, spiritGarden: { zones: updatedZones } };
            }
          }
        }
      } else if (action === 'harvest') {
        // 采收：若指定 zoneId 则采指定；否则采首个到期 zone
        if (op.zoneId) {
          next = harvestZone(next, op.zoneId, currentAge);
        } else {
          const next2 = next.spiritGarden?.zones || [];
          const dueZone = next2.find(z => z.expectedHarvestAt.age <= currentAge);
          if (dueZone) next = harvestZone(next, dueZone.id, currentAge);
        }
      }
    }
  }

  // ===== Phase-α 批 1 α-2: 因果业力调整 =====
  // 从 aiOutput.changes.reason 与 sinReason 推断本轮的功德/杀业增量，由引擎权威落库
  // 只在角色还活着时累加（陨落后不再叠 sin / merit）
  if (next.alive) {
    const karmaAdj = inferKarmaFromChanges(aiOutput);
    if (karmaAdj.deltaMerit || karmaAdj.deltaSin) {
      next = adjustKarma(next, karmaAdj);
    }
  }

  const appliedChanges = (aiOutput.changes || []).filter(ch => ATTRIBUTE_BOUNDS[ch.attribute]);

  return {
    state: next,
    appliedChanges,
    rejectedChanges: rejected,
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
  return {
    age: s.age,
    lifespan: s.lifespan,
    realm: s.realm,
    realmName: realmProfile?.name || realmInfo.name,
    realmColor: realmProfile?.color || realmInfo.color,
    realmLevel: s.realmLevel,
    realmMaxLevel: realmProfile?.maxLevel ?? realmInfo.levels,
    realmProfile,
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
    storageCapacity: s.storageCapacity,
    activeStatuses: s.activeStatuses,
    inventory: s.inventory,
    equipped: s.equipped,
    // Task 20 新字段
    pendingThreads: s.pendingThreads || [],
    characterIntents: s.characterIntents || [],
    combatSession: s.combatSession || null,
    // Task 22 新字段
    heartDemon: s.heartDemon ?? 0,
    // Task 23 新字段
    pets: s.pets || [],
    // Task 24 新字段
    exploredRealms: s.exploredRealms || [],
    discoveredRealms: getDiscoveredStoryRealms(s),
    // ===== Phase-α 批 1 α-1/α-2 透传 =====
    // 前端可选读（如轮回结算、人物志），不在常规面板展示数值调节器
    tribulationProfile: s.tribulationProfile || { tribulationHistory: [] },
    karma: typeof s.karma === 'number' ? s.karma : 0,
    merit: typeof s.merit === 'number' ? s.merit : 0,
    sin: typeof s.sin === 'number' ? s.sin : 0,
    // ===== Phase-α 批 2 α-7：灵田透传 =====
    spiritGarden: s.spiritGarden || { zones: [] },
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
    console.log(`[Task 22] heartDemon ${delta >= 0 ? '+' : ''}${delta} → ${next} (${reason})`);
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
): Pet {
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
    console.log(`[Task 23] 灵宠已满 5 只，拒绝新灵宠 ${pet.name}`);
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
): { state: CharacterState; ok: boolean; error?: string; pet?: Pet } {
  const pet = (state.pets || []).find(p => p.id === petId);
  if (!pet) return { state, ok: false, error: '灵宠不存在' };
  const item = state.inventory.find(it => it.id === itemId);
  if (!item) return { state, ok: false, error: '物品不在储物袋中' };
  // 仅允许材料类、丹药类、食物类（tool）物品喂养
  if (item.item_type !== 'material' && item.item_type !== 'consumable' && item.item_type !== 'tool') {
    return { state, ok: false, error: '该物品不适合喂养灵宠' };
  }
  // 按稀有度计算喂养价值
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
      console.log(`[Task 23] 灵宠 ${pet.name} 忠诚度过低（${newLoyalty}），逃离了！`);
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
  const threads = (state.pendingThreads || []).filter(t => t.status !== 'failed' && t.status !== 'resolved');
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

export function getSameYearThreads(state: CharacterState): PendingThread[] {
  const age = state.age;
  return (state.pendingThreads || []).filter(t =>
    (t.status === 'pending' || t.status === 'urgent') &&
    (t.dueInSameYear || t.deadlineAge <= age) &&
    t.progress < 100
  ).slice(0, 2);
}

export function buildThreadContinuationEvent(state: CharacterState, thread: PendingThread): any {
  const realmName = inferStoryRealmName(`${thread.title} ${thread.description} ${thread.followUpHint || ''}`);
  const isRealm = thread.category === 'exploration' || !!realmName || /秘境|浮阁|洞府|遗迹|禁地|禁制|破禁/.test(`${thread.title}${thread.description}`);
  const isCompetition = thread.category === 'competition' || /比试|考核|入门|仙门|擂台/.test(`${thread.title}${thread.description}`);
  const title = isRealm ? `余波再起·${realmName || thread.title}` : isCompetition ? `约期已至·${thread.title}` : `因果续起·${thread.title}`;
  const narrative = isRealm
    ? `${thread.description}此事并未随上一段经历散去。${state.name}收拢所得线索，反复揣摩${thread.followUpHint || '其中关窍'}；若要真正深入，还需凭信物、地势或另一条破禁之法再寻入口。`
    : isCompetition
      ? `${thread.description}约期已近，${state.name}没有把此事抛在脑后。她整备衣装与随身法器，按约前去应试；这一场比试不只是胜负，更关系到能否接上前文所开的仙途。`
      : `${thread.description}前事余波在这一日重新牵动。${state.name}循着旧约与旧迹继续追索，使这段因果没有半途断线。`;
  return {
    title,
    narrative,
    eventType: isCompetition ? 'normal' : isRealm ? 'exploration' : 'normal',
    changes: isCompetition ? [{ attribute: 'reputation', delta: 1, reason: '守约赴试' }] : [],
    newStatuses: isRealm ? [{
      id: `status_thread_${thread.id}_${Date.now().toString(36)}`,
      name: realmName ? `${realmName}线索` : '秘境线索',
      description: thread.followUpHint || '这段线索仍可引向后续探索。',
      category: 'quest',
      rarity: 'uncommon',
      duration: -1,
      source: thread.title,
      effects: [],
    }] : [],
    newItems: [], removedItemIds: [], newEquippedItems: [], equipItemIds: [], unequipItemIds: [],
    memory: `${state.age}岁续写线索：${thread.title}`,
    cultivationInsight: '',
    hasChoice: false, choice: null, triggeredBreakthrough: false, causedDeath: false, causedAscension: false,
    newThreads: [],
    advanceThreads: [{ id: thread.id, progressDelta: isRealm ? 35 : 50, note: '同年后续已展开' }],
    completeThreadIds: isCompetition ? [thread.id] : [],
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

// ==================== Phase-α 批 2 α-7：灵田 / 灵植 / 物候 ====================

// 节气辅助：根据 age 推算当前节气名（age % 24 映射到 1..24）
// age 为负或非数时返回 '立春'（不会发生，兜底）
export function getSolarTermForAge(age: number): string {
  const a = Math.max(0, Math.floor(Number(age) || 0));
  return TWENTY_FOUR_SOLAR_TERMS[a % 24];
}

// 节气辅助：根据 age 推算当前节气序号 1..24
export function getSolarTermIndexForAge(age: number): number {
  const a = Math.max(0, Math.floor(Number(age) || 0));
  return (a % 24) + 1;
}

// 节气辅助：构造 GameTime（带节气锚定）
export function makeGameTime(age: number, eraName?: string, calendarYear?: number): GameTime {
  return {
    age: Math.max(0, Math.floor(Number(age) || 0)),
    solarTerm: getSolarTermForAge(age),
    eraName: eraName || undefined,
    calendarYear: typeof calendarYear === 'number' ? calendarYear : undefined,
  };
}

// 节气辅助：两个 age 之间的节气跨度（环 24 模；返回 >= 0 整数）
// 用于 UI 显示"距收获节气数"
export function solarTermsBetween(fromAge: number, toAge: number): number {
  const fromIdx = getSolarTermIndexForAge(fromAge);
  const toIdx = getSolarTermIndexForAge(toAge);
  const rawDelta = toAge - fromAge;
  // 总节气跨度 = 年数差 * 24 + 节气差
  const total = rawDelta * 24 + (toIdx - fromIdx);
  return Math.max(0, total);
}

// 灵田辅助：clamp [0..100]
function clamp01to100(n: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}

// 灵田核心：注册一块新 zone
// seed: 中文种子名（AI 在 narrative 自然给出）
// quality: 灵土品质 0..100（AI 在 narrative 自然给出；默认 50）
// atmosphere: 灵田气机描述（AI 在 narrative 自然给出；默认 "${节气}翻土"）
// currentAge: 当前角色年龄，用于锚定 seededAt 与推算 expectedHarvestAt
// 默认成熟周期：4 节气（≈ 4 年）—— 修真叙事中"灵药从播种到可采收"短周期
const SPIRIT_GARDEN_DEFAULT_HARVEST_AGE_GAP = 4;

export function addGardenZone(
  state: CharacterState,
  args: { seed: string; quality?: number; atmosphere?: string },
  currentAge: number
): CharacterState {
  const seed = (args.seed || '').trim();
  if (!seed) return state;
  const age = Math.max(0, Math.floor(Number(currentAge) || state.age || 0));
  const id = `zone_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const seededAt = makeGameTime(age, undefined, undefined);
  const expectedHarvestAt = makeGameTime(age + SPIRIT_GARDEN_DEFAULT_HARVEST_AGE_GAP, undefined, undefined);
  const zone: SpiritGardenZone = {
    id,
    seed,
    seededAt,
    expectedHarvestAt,
    quality: clamp01to100(args.quality ?? 50),
    atmosphere: (args.atmosphere || `${seededAt.solarTerm || getSolarTermForAge(age)}翻土`).slice(0, 120),
  };
  const existing = state.spiritGarden?.zones || [];
  // 同名 seed 已存在且未到期 → 不重复注册（修真生态里"翻土"不会叠 buff）
  const dup = existing.find(z => z.seed === seed && z.expectedHarvestAt.age > age);
  if (dup) return state;
  return { ...state, spiritGarden: { zones: [...existing, zone] } };
}

// 灵田核心：主动采收某 zone（AI narrative 给出"采收"事件时调用；或引擎到期自动调）
// 产出物按 quality + 节气匹配度 → rarity 与数量
// quality >= 80 → legendary；>= 60 → epic；>= 40 → rare；>= 20 → uncommon；其余 common
// 节气与种子"季节属性"匹配 → 同季 +1 级；冬季播种 + 落霜风险可能 -1 级
function pickZoneOutput(zone: SpiritGardenZone): ItemEntry {
  // 基础 rarity 来自 quality
  let rarity: ItemEntry['rarity'] = 'common';
  if (zone.quality >= 80) rarity = 'legendary';
  else if (zone.quality >= 60) rarity = 'epic';
  else if (zone.quality >= 40) rarity = 'rare';
  else if (zone.quality >= 20) rarity = 'uncommon';

  // 节气匹配：solarTerm 与 seed 季节属性
  const harvestTerm = getSolarTermForAge(zone.expectedHarvestAt.age);
  const harvestSeason = SOLAR_TERM_SEASON[harvestTerm];
  // 种子季节（粗略推断：含"夏/阳/烈/火"→夏；含"冬/寒/冰"→冬；含"秋/金/霜"→秋；含"春/生/木"→春；默认春）
  let seedSeason: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring';
  if (/夏|阳|烈|火/.test(zone.seed)) seedSeason = 'summer';
  else if (/冬|寒|冰|雪|霜/.test(zone.seed)) seedSeason = 'winter';
  else if (/秋|金|萧/.test(zone.seed)) seedSeason = 'autumn';
  else if (/春|生|木|灵/.test(zone.seed)) seedSeason = 'spring';

  if (harvestSeason !== seedSeason) {
    // 不匹配：降一级
    const ladder: ItemEntry['rarity'][] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const i = ladder.indexOf(rarity);
    rarity = ladder[Math.max(0, i - 1)];
  }

  // 数量：quality 越高越多（1~3 个）
  const quantity = zone.quality >= 70 ? 3 : zone.quality >= 40 ? 2 : 1;

  // 描述：自然叙出节气与灵田气机
  const desc = `采自灵田（${zone.atmosphere}），时值${harvestTerm}，品质 ${zone.quality}。`;
  return {
    id: `harvest_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: `${zone.seed}×${quantity}`,
    description: desc,
    item_type: 'material',
    rarity,
    effects: [],
    source: `${harvestTerm}灵田采收`,
  };
}

// 灵田核心：采收某 zone → 产出物入 addItems；zone 移除
export function harvestZone(state: CharacterState, zoneId: string, currentAge?: number): CharacterState {
  const zones = state.spiritGarden?.zones || [];
  const zone = zones.find(z => z.id === zoneId);
  if (!zone) return state;
  const harvested = pickZoneOutput(zone);
  const next = addItems(state, [harvested]);
  // 同时从灵田移除该 zone
  const remaining = zones.filter(z => z.id !== zoneId);
  return { ...next, spiritGarden: { zones: remaining } };
}

// 灵田核心：每岁推进
// - 检查所有 zone.expectedHarvestAt.age <= newAge → 自动 harvestZone
// - 不修改 quality/atmosphere（避免每岁悄悄涨分；只有 AI narrative 显式提议才改）
// - 此函数由 advance 流程在主事件 executeAIEvent 之后调用（保证 AI 显式 harvest 优先；此处兜底到期）
export function advanceGarden(state: CharacterState, newAge: number): CharacterState {
  if (!state.spiritGarden || state.spiritGarden.zones.length === 0) return state;
  if (!state.alive || state.ascended) return state;
  let next: CharacterState = state;
  // 反复调用 harvestZone 直到无到期 zone
  let safety = 16;
  while (safety-- > 0) {
    const zones = next.spiritGarden?.zones || [];
    const due = zones.find(z => z.expectedHarvestAt.age <= newAge);
    if (!due) break;
    next = harvestZone(next, due.id, newAge);
  }
  return next;
}

