// 修仙模拟器 - 引擎核心
// 引擎权威：所有 AI 提议的变更必须经引擎校验与执行
// AI Proposes：AI 输出是"提议"，引擎有权拒绝、修改、钳制

import {
  CharacterState,
  AttributeChange,
  StatusEntry,
  ItemEntry,
  TechniqueProfile,
  TechniqueRequirement,
  ArtifactAbility,
  ConstitutionProfile,
  ElementType,
  Realm,
  RealmProfile,
  REALMS,
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
} from './types';
import { hasRealmEntryRequirement } from './secret-realm-utils';
import { resolveAttributeChanges } from './effect-resolver';
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
  const equipped = parseEquippedJson(c.equippedJson || '[]');
  const inventory = safeParse<ItemEntry[]>(c.inventoryJson, []);
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
    if (!evaluateTechniqueCompatibility(state, it).usable) continue;
    for (const rawEff of it.effects || []) {
      const eff = adaptTechniqueEffect(state, it, rawEff);
      if (!eff || eff.target_attribute !== 'cultivationExp') continue;
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
    hp: Math.max(0, Math.min(Number(state.hp ?? 0), Math.max(1, Number(state.maxHp ?? 1)))),
    mp: Math.max(0, Math.min(Number(state.mp ?? 0), Math.max(0, Number(state.maxMp ?? 0)))),
    inventory: (state.inventory || []).map(normalizeCultivationBearingItem),
    equipped: (state.equipped || []).map(normalizeCultivationBearingItem),
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

function fallbackTechniqueAbility(item: ItemEntry, source: 'scripture' | 'artifact'): { name: string; description: string; element: ElementType | 'none'; trigger?: ArtifactAbility['trigger'] } {
  const text = `${item.name || ''}${item.description || ''}`;
  const element = inferDominantElementFromText(text);
  const isSword = /剑|sword|blade/i.test(text);
  const isWater = /水|冰|潮|water|ice|tide/i.test(text);
  const isProtect = /护|盾|守|罩|protect|shield|guard/i.test(text);
  const trigger: ArtifactAbility['trigger'] = isWater ? 'underwater' : isProtect ? 'auto' : 'active';
  const name = source === 'artifact'
    ? (isProtect ? '护身灵禁' : isWater ? '避水灵禁' : isSword ? '剑纹灵禁' : '器物灵禁')
    : (isSword ? '剑意术式' : '行气术式');
  const description = source === 'artifact'
    ? '法宝内藏灵禁被催动，形成一道独立于器物本名的器术效果。'
    : '依功法行气脉络凝成的基础斗法术式，不等同于功法本名。';
  return { name, description, element, trigger };
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

export function alchemy(
  state: CharacterState,
  materialIds: string[],
  spiritStoneCost: number = 10
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

  const base = { ...it, item_type: itemType as any, effects };
  if ((itemType === 'scripture' || itemType === 'artifact') && !base.technique) {
    return { ...base, technique: inferTechniqueProfile(base) };
  }
  return base;
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
  return safeThreads
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
  const threads = (state.pendingThreads || []).map(t => {
    if (t.id !== threadId) return t;
    const progress = Math.max(0, Math.min(100, (t.progress || 0) + progressDelta));
    return { ...t, progress };
  });
  return { ...state, pendingThreads: threads, questEntries: buildQuestEntriesFromThreads(threads, state.age) };
}

export function completeThread(state: CharacterState, threadId: string): CharacterState {
  const threads = (state.pendingThreads || []).map(t =>
    t.id === threadId ? { ...t, status: 'resolved' as const, progress: 100 } : t
  );
  return { ...state, pendingThreads: threads, questEntries: buildQuestEntriesFromThreads(threads, state.age) };
}

export function failThread(state: CharacterState, threadId: string): CharacterState {
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
  const threads = (state.pendingThreads || []).map(t => {
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
  for (const group of [palette.basicAttack, palette.spell, palette.defense, palette.item, palette.other]) {
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
  const skills = session.playerSkills || buildLearnedCombatArts(state).slice(0, 6);
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

  const spellOptions = skills.slice(0, 8).map((sk, idx): CombatActionOption => ({
    id: `skill-${idx}`,
    name: sk.name,
    description: sk.description || '催动已掌握的术式。',
    actionType: 'spell',
    source: sk.sourceType === 'artifact' ? 'artifact' : 'spell',
    enabled: !sealed && session.playerMp >= (sk.mpCost || 0),
    disabledReason: sealed ? '灵力受制，术式难以成形。' : session.playerMp < (sk.mpCost || 0) ? '法力不足。' : undefined,
    skillIdx: idx,
    itemId: sk.itemId,
    mpCost: sk.mpCost || 0,
    risk: sk.adaptation != null && sk.adaptation < 0.7 ? '适配不足，可能反噬或威力折损。' : undefined,
    requiredItems: sk.itemId ? [sk.itemId] : undefined,
    tags: ['spell'],
  }));

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
  otherOptions.push({ id: 'other-flee', name: '伺机脱身', description: '借地形或烟尘尝试脱离战场。', actionType: 'flee', source: 'environment', enabled: true, mpCost: 0, tags: ['flee'] });

  return {
    basicAttack: { enabled: basicOptions.some(o => o.enabled), label: '普攻', disabledReason: basicOptions.some(o => o.enabled) ? undefined : (restrained ? '当前受制，常规攻伐难以施展。' : '暂无可用普攻。'), options: basicOptions },
    spell: { enabled: spellOptions.some(o => o.enabled), label: '法术', disabledReason: spellOptions.length ? '当前法术受限。' : '暂无可用法术。', options: spellOptions },
    defense: { enabled: defenseOptions.some(o => o.enabled), label: '防御', options: defenseOptions },
    item: { enabled: itemOptions.some(o => o.enabled), label: '物品', disabledReason: itemOptions.length ? '当前难以取用物品。' : '暂无可用物品。', options: itemOptions },
    other: { enabled: otherOptions.some(o => o.enabled), label: '应变', options: otherOptions },
    generatedBy: 'engine-fallback',
    sceneHint: restrained ? '当前行动受束缚影响，AI 可生成解除、拖延、神识或环境应变。' : undefined,
  };
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
    } else if (option?.id === 'other-observe-opening') {
      playerActionDesc = option.name;
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
  let enemyHp = enemy.hp;
  const playerActionType = combatPlayerActionTypeFromAction(action);
  const playerDamageDealt = clampCombatNumber(proposal.playerDamage, 0, bound.maxDamage);
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
  enemyHp = Math.max(0, enemyHp - playerDamageDealt);
  const fleeAllowed = action === 'flee' || selectedOption?.actionType === 'flee';
  const fleeSpeedChance = Math.max(0.08, Math.min(0.92, 0.35 + (session.playerSpeed - enemy.speed) * 0.025));
  const fleeSuccess = fleeAllowed && proposal.fleeOutcome === 'success' && fleeSpeedChance >= 0.18;
  if (proposal.fleeOutcome === 'success' && !fleeAllowed) audit.push('AI裁决提出脱战，但玩家行动不是遁走，引擎拒绝脱战。');
  let enemyDamageDealt = 0;
  let endStatus: CombatActionResult['endStatus'] | undefined;
  if (fleeSuccess) endStatus = 'fled';
  else if (enemyHp <= 0) endStatus = session.enemies.every((e, i) => i === session.currentEnemyIdx || e.hp <= 0) ? 'victory' : undefined;
  else if (session.enemyStunned) audit.push('敌方受压制，本回合未能反击。');
  else {
    const defenseFactor = action === 'defend' ? 0.55 : action === 'other' ? 0.8 : 1;
    const maxEnemyDamage = Math.max(0, Math.floor((enemy.attack - session.playerDefense * 0.35) * 1.6 * defenseFactor));
    enemyDamageDealt = clampCombatNumber(proposal.enemyDamage, 0, maxEnemyDamage);
    if (Number(proposal.enemyDamage || 0) > maxEnemyDamage) audit.push('AI裁决敌方伤害 ' + proposal.enemyDamage + ' 超过事实上限 ' + maxEnemyDamage + '，已截断。');
    if (session.talismanDefenseActive && session.talismanDefenseActive > 0) {
      const blocked = Math.min(enemyDamageDealt, session.talismanDefenseActive);
      enemyDamageDealt -= blocked;
      if (blocked > 0) audit.push('护身符力抵消 ' + blocked + ' 点伤势。');
    }
    playerHp = Math.max(0, playerHp - enemyDamageDealt);
    if (playerHp <= 0) endStatus = 'defeat';
  }
  session.talismanDefenseActive = undefined;
  session.enemyStunned = undefined;
  let currentEnemyIdx = session.currentEnemyIdx;
  const updatedEnemies = session.enemies.map((e, i) => i === session.currentEnemyIdx ? { ...e, hp: enemyHp } : e);
  if (!endStatus && enemyHp <= 0) {
    const nextIdx = updatedEnemies.findIndex((e, i) => i > session.currentEnemyIdx && e.hp > 0);
    if (nextIdx >= 0) { currentEnemyIdx = nextIdx; audit.push('当前敌手倒下，引擎切换到 ' + updatedEnemies[nextIdx].name + '。'); }
    else endStatus = 'victory';
  }
  const narrative = String(proposal.narrative || '').trim().slice(0, 320) || (bound.playerActionDesc + '，与' + enemy.name + '交错一合。');
  const round: CombatRound = { round: session.round, playerAction: String(proposal.playerActionLabel || bound.playerActionDesc).slice(0, 40), playerActionType, playerDamage: playerDamageDealt, playerHeal, enemyAction: proposal.enemyAction ? String(proposal.enemyAction).slice(0, 40) : undefined, enemyActionType: proposal.enemyActionType ? String(proposal.enemyActionType).slice(0, 24) : undefined, enemyDamage: enemyDamageDealt, narrative, playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp, aiAudit: audit.length ? audit.slice(0, 8) : ['AI裁决已通过引擎硬事实审计。'] };
  const newSession: CombatSession = { ...session, enemies: updatedEnemies, currentEnemyIdx, round: session.round + 1, log: [...session.log, round], status: endStatus || 'ongoing', playerHp, playerMp };
  if (endStatus === 'defeat') return { state: { ...nextState, combatSession: newSession, hp: 0, mp: playerMp, alive: false, causeOfDeath: '战斗中为' + enemy.name + '所败' }, round, ended: true, endStatus };
  return { state: { ...nextState, combatSession: newSession, hp: playerHp, mp: playerMp }, round, ended: !!endStatus, endStatus, victoryDrops: endStatus === 'victory' ? session.victoryDrops : undefined };
}

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
  const collectItemResolve = (resolved: ItemEffectResolveResult) => {
    appliedChanges.push(...resolved.appliedChanges);
    rejected.push(...resolved.rejectedChanges);
    effectResolveTrace.push(...resolved.effectResolveTrace);
    effectResolveWarnings.push(...resolved.effectResolveWarnings);
  };

  // 1. Apply attribute changes through EffectResolver / ERPE Lite.
  const resolvedChanges = resolveAttributeChanges(next, aiOutput.changes || [], {
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
      next = addItems(next, registered.accepted);
    }
  }

  // 3.5 AI 联动：移除/破坏物品（如战斗中武器被毁、丹药被消耗）
  if (aiOutput.removedItemIds && aiOutput.removedItemIds.length) {
    const rem = removeItemsByIds(next, aiOutput.removedItemIds);
    next = rem.state;
    collectItemResolve(rem);
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
    const newEqItems = registered.accepted;
    next = {
      ...next,
      equipped: [...(next.equipped || []), ...newEqItems],
    };
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
