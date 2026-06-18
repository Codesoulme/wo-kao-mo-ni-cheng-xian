// 修仙模拟器 - 引擎核心
// 引擎权威：所有 AI 提议的变更必须经引擎校验与执行
// AI Proposes：AI 输出是"提议"，引擎有权拒绝、修改、钳制

import {
  CharacterState,
  AttributeChange,
  StatusEntry,
  ItemEntry,
  Realm,
  REALMS,
  getRealmInfo,
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
} from './types';

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
  const pendingThreads = safeParse<PendingThread[]>(c.pendingThreadsJson || '[]', []);
  const characterIntents = safeParse<CharacterIntent[]>(c.characterIntentsJson || '[]', []);
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
    activeStatuses: safeParse<StatusEntry[]>(c.statusJson, []),
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
  };
  // 持久化的 recentEventTypes / recentBlueprintCategories 不进 state（仅 ctx 用），但需要保留
  // 这里通过闭包变量传给 buildStateContext（在 advance route 中调用）
  (state as any)._recentEventTypes = recentEventTypes;
  (state as any)._recentBlueprintCategories = recentBlueprintCategories;
  const rate = computeEffectiveCultivationRate(state);
  state.cultivationMultiplier = rate.multiplier;
  state.cultivationFactors = computeCultivationFactors(state);
  return state;
}

function safeParse<T>(s: string, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
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
            note: '修为加成',
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

// 默认 equipNote（玩家点装备时若物品无 equipNote 则按类型生成）
const DEFAULT_EQUIP_NOTE: Record<string, string> = {
  weapon: '手持', armor: '身穿', accessory: '佩戴', artifact: '悬身', scripture: '修习',
};

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

export function tryBreakthrough(state: CharacterState): { state: CharacterState; success: boolean; newRealm?: Realm; major?: boolean } {
  if (state.cultivationExp < state.expToBreak) {
    return { state, success: false };
  }

  const info = getRealmInfo(state.realm);
  // 引擎权威：普通突破优先提升小境界；只有当前大境界已满层，才晋入下一大境界。
  // realmLevel 为 0 基索引，显示层会显示 realmLevel + 1 层。
  if (info.levels > 0 && state.realmLevel < info.levels - 1) {
    const minor = tryMinorBreakthrough(state);
    if (minor.advanced) return { state: minor.state, success: true, newRealm: state.realm, major: false };
  }

  const nextRealm = getNextRealm(state.realm);
  if (!nextRealm) {
    // 已达最高境界（渡劫→飞升由特殊事件处理）
    return { state, success: false };
  }

  const nextInfo = getRealmInfo(nextRealm);
  const remainingExp = Math.max(0, state.cultivationExp - state.expToBreak);
  const newState: CharacterState = {
    ...state,
    realm: nextRealm,
    realmLevel: 0,
    cultivationExp: remainingExp,
    expToBreak: nextInfo.expPerLevel,
    lifespan: Math.max(state.lifespan, nextInfo.baseLifespan),
  };

  // 大境界突破提升基础属性；倍率基于新大境界，但避免早期境界数值爆炸
  const realmIdx = Math.max(1, REALMS.findIndex(r => r.id === nextRealm));
  const boost = 1.15 + realmIdx * 0.12;
  newState.maxHp = Math.floor(state.maxHp * boost);
  newState.hp = newState.maxHp;
  newState.maxMp = Math.floor(state.maxMp * boost);
  newState.mp = newState.maxMp;
  newState.attack = Math.floor(state.attack * boost);
  newState.defense = Math.floor(state.defense * boost);
  newState.speed = Math.floor(state.speed * boost);

  return { state: newState, success: true, newRealm: nextRealm, major: true };
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

// ==================== 状态词条管理 ====================

export function addStatuses(state: CharacterState, statuses: StatusEntry[]): CharacterState {
  if (!statuses.length) return state;
  const existingIds = new Set(state.activeStatuses.map(s => s.id));
  const newStatuses = statuses.filter(s => !existingIds.has(s.id));
  return { ...state, activeStatuses: [...state.activeStatuses, ...newStatuses] };
}

export function tickStatusDurations(state: CharacterState): CharacterState {
  // 每过一岁，持续状态 duration -1
  const ticked = state.activeStatuses.map(s => ({
    ...s,
    duration: s.duration === -1 ? -1 : s.duration - 1,
  }));
  const alive = ticked.filter(s => s.duration === -1 || s.duration > 0);
  return { ...state, activeStatuses: alive };
}

// ==================== 物品管理 ====================

// 添加物品到 inventory。若物品是储物袋（含 storageCapacity 效果的 tool），自动增加 storageCapacity。
// 兜底：若 AI 给了无效 item_type（如 'storage'），但物品含 storageCapacity 效果，则强转 item_type='tool'。
// 兜底：若物品名含功法关键词（诀/经/典/录/篇/功法）但 item_type 不是 scripture，强转 scripture 并补默认效果
// Task 22: 容量限制——超过 storageCapacity 时丢弃多余物品（储物袋本身优先保留，因可扩容）
export function addItems(state: CharacterState, items: ItemEntry[]): CharacterState {
  if (!items.length) return state;
  // 规整化物品：确保 item_type 合法；储物袋 item_type 必为 'tool'；功法名必为 'scripture'
  const VALID_TYPES = new Set(['weapon', 'armor', 'accessory', 'artifact', 'consumable', 'material', 'tool', 'scripture']);
  const SCRIPTURE_NAME_RE = /诀|决|经|典|录|篇|章|解|式|术|功法|心法|秘籍|玉简|真经|真解|引气|凝气|吐纳/;
  const normalized = items.map(it => {
    const hasStorageEffect = (it.effects || []).some(e => e.target_attribute === 'storageCapacity' && e.operation === 'add' && e.value > 0);
    let itemType = it.item_type;
    if (!VALID_TYPES.has(itemType)) {
      // 无效类型兜底：含 storageCapacity 效果 → tool；否则 material
      itemType = hasStorageEffect ? 'tool' : 'material';
    } else if (hasStorageEffect && itemType !== 'tool') {
      itemType = 'tool';
    }
    // 功法名兜底：若名含功法关键词但 item_type 不是 scripture，强转 scripture
    const isScriptureByName = SCRIPTURE_NAME_RE.test(it.name || '');
    if (isScriptureByName && itemType !== 'scripture') {
      itemType = 'scripture';
    }
    let effects = it.effects || [];
    // 若是 scripture 但无 multiply cultivationExp 效果，补一条默认（按 rarity 分档）
    if (itemType === 'scripture' && !effects.some(e => e.target_attribute === 'cultivationExp' && e.operation === 'multiply')) {
      const multByRarity: Record<string, number> = {
        common: 1.3, uncommon: 1.7, rare: 2.5, epic: 3.5, legendary: 4.5, mythic: 5.5,
      };
      const mult = multByRarity[it.rarity as string] || 1.5;
      effects = [...effects, {
        target_attribute: 'cultivationExp',
        operation: 'multiply',
        value: mult,
        description: `修习此功法，修为流转加速×${mult}`,
      }];
    }
    return { ...it, item_type: itemType as any, effects };
  });

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

// ==================== 引擎状态上下文构建 ====================

export function buildStateContext(state: CharacterState, recentEvents: { age: number; title: string; narrative: string; eventType?: string }[]): EngineStateContext {
  const realmInfo = getRealmInfo(state.realm);
  // 找下一个未完成的命节点
  const nextNode = FATE_NODES.find(n => !state.fateNodes.includes(n.index));
  // Task 20: 推进 urgent 线索状态（deadlineAge - age <= 3 视为 urgent）
  const threads = (state.pendingThreads || []).map(t => ({
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
      elements: state.elements,
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
    activeStatuses: state.activeStatuses,
    inventory: state.inventory,
    equipped: state.equipped,
    storageCapacity: state.storageCapacity,
    cultivationMultiplier: state.cultivationMultiplier,
    cultivationInsight: state.cultivationInsight,
    cultivationFactors: state.cultivationFactors,
    recentEvents: recentEvents.slice(-5).map(e => ({ age: e.age, title: e.title, narrative: e.narrative, eventType: e.eventType || 'normal' })),
    longTermMemory: state.longTermMemory.slice(-10),
    completedFateNodes: state.fateNodes,
    availableAttributes: Object.keys(ATTRIBUTE_BOUNDS),
    nextFateNode: nextNode ? { index: nextNode.index, name: nextNode.name, realm: nextNode.realm } : undefined,
    // Task 20 新字段
    pendingThreads: threads,
    characterIntents: intents,
    recentEventTypes,
    recentBlueprintCategories,
    // Task 23 新字段
    pets: state.pets || [],
    // Task 24 新字段
    exploredRealms: state.exploredRealms || [],
    currentExploration: (state as any)._currentExploration,
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
export function generateCharacterIntents(state: CharacterState, threads: PendingThread[]): CharacterIntent[] {
  const intents: CharacterIntent[] = [];
  const now = state.age;
  // 1. 检查 pendingThreads —— 临近 deadline 的线索生成对应意图
  for (const t of threads) {
    if (t.status !== 'pending' && t.status !== 'urgent') continue;
    const remaining = t.deadlineAge - now;
    if (remaining <= 0) continue;
    if (t.category === 'competition' && remaining <= 5) {
      intents.push({
        id: `intent_comp_${t.id}`,
        type: 'prepare_combat',
        title: `备战·${t.title}`,
        description: `「${t.title}」将在 ${remaining} 岁后到来。角色应主动准备战斗装备、炼制或购买丹药、磨砺功法、请教前辈。若无武器应设法获取，若修为不足应闭关苦修。`,
        priority: 9,
        relatedThreadId: t.id,
      });
    } else if (t.category === 'enemy' && remaining <= 10) {
      intents.push({
        id: `intent_enemy_${t.id}`,
        type: 'avoid_danger',
        title: `防备·${t.title}`,
        description: `「${t.title}」可能近期发作。角色应主动防备：随身携带防身法器、避免独行险地、寻求师长庇护或同门结伴。`,
        priority: 8,
        relatedThreadId: t.id,
      });
    } else if (t.category === 'quest' && remaining <= 5) {
      intents.push({
        id: `intent_quest_${t.id}`,
        type: 'resolve_thread',
        title: `推进·${t.title}`,
        description: `「${t.title}」deadline 临近，角色应主动推进任务进度，采集材料、完成委托、寻觅目标等。`,
        priority: 8,
        relatedThreadId: t.id,
      });
    } else if (t.category === 'debt' && remaining <= 3) {
      intents.push({
        id: `intent_debt_${t.id}`,
        type: 'gather_resources',
        title: `还债·${t.title}`,
        description: `「${t.title}」即将到期，角色应主动筹措灵石或物品偿债，否则将有严重后果。`,
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
  // 5. 限制最多保留 5 个意图（按优先级排序）
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
    // 从已装备提取法术（scripture 类）
    playerSkills: (state.equipped || [])
      .filter(it => it.item_type === 'scripture' || it.item_type === 'artifact')
      .map(it => ({
        name: it.name,
        description: it.description,
        mpCost: Math.max(5, Math.floor((it.rarity === 'mythic' ? 30 : it.rarity === 'legendary' ? 25 : it.rarity === 'epic' ? 20 : it.rarity === 'rare' ? 15 : 10))),
        power: 1 + (['common','uncommon','rare','epic','legendary','mythic'].indexOf(it.rarity) * 0.5),
      }))
      .slice(0, 4),
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
export function endCombat(state: CharacterState, applyDrops: boolean = true): { state: CharacterState; drops: ItemEntry[]; result: 'victory' | 'defeat' | 'fled' | 'ongoing' | null } {
  if (!state.combatSession) return { state, drops: [], result: null };
  const session = state.combatSession;
  let next: CharacterState = { ...state, combatSession: null };
  let drops: ItemEntry[] = [];
  if (applyDrops && session.status === 'victory' && session.victoryDrops?.length) {
    drops = session.victoryDrops;
    next = addItems(next, drops);
  }
  return { state: next, drops, result: session.status };
}

// ==================== 引擎执行 AI 输出（统一入口） ====================

export interface EngineExecutionResult {
  state: CharacterState;
  appliedChanges: AttributeChange[];
  rejectedChanges: AttributeChange[];
  breakthroughHappened: boolean;
  newRealm?: Realm;
  breakthroughMajor?: boolean;
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
  next.cultivationFactors = computeCultivationFactors(next);

  // 5. 处理突破
  let breakthroughHappened = false;
  let newRealm: Realm | undefined;
  let breakthroughMajor = false;
  if (aiOutput.triggeredBreakthrough) {
    const br = tryBreakthrough(next);
    if (br.success) {
      next = br.state;
      breakthroughHappened = true;
      newRealm = br.newRealm;
      breakthroughMajor = Boolean(br.major);
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

  // 8. 角色主动意图重新生成（每岁重算）
  next.characterIntents = generateCharacterIntents(next, next.pendingThreads);

  const appliedChanges = (aiOutput.changes || []).filter(ch => ATTRIBUTE_BOUNDS[ch.attribute]);

  return {
    state: next,
    appliedChanges,
    rejectedChanges: rejected,
    breakthroughHappened,
    newRealm,
    breakthroughMajor,
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
  const rootInfo = SPIRITUAL_ROOTS[s.spiritualRoot];
  const rate = computeEffectiveCultivationRate(s);
  return {
    age: s.age,
    lifespan: s.lifespan,
    realm: s.realm,
    realmName: realmInfo.name,
    realmColor: realmInfo.color,
    realmLevel: s.realmLevel,
    realmMaxLevel: realmInfo.levels,
    cultivationExp: s.cultivationExp,
    expToBreak: s.expToBreak,
    hp: s.hp, maxHp: s.maxHp,
    mp: s.mp, maxMp: s.maxMp,
    attack: s.attack, defense: s.defense, speed: s.speed,
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
    cultivationFactors: s.cultivationFactors,
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
  return SECRET_REALMS
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
  const realm = SECRET_REALMS.find(r => r.id === realmId);
  if (!realm) return { ok: false, error: '秘境不存在' };
  if (!state.alive) return { ok: false, error: '角色已陨落' };
  if (state.combatSession && state.combatSession.status === 'ongoing') {
    return { ok: false, error: '战斗进行中，无法探索秘境' };
  }
  if (state.isAtChoice) return { ok: false, error: '当前有待选择，请先完成选择' };
  const realmIdx = REALMS.findIndex(r => r.id === state.realm);
  if (realmIdx < realm.minRealm) return { ok: false, error: `境界不足，需${REALMS[realm.minRealm].name}以上` };
  if (state.age < realm.minAge) return { ok: false, error: `年龄不足，需${realm.minAge}岁以上` };
  if (state.spiritStones < realm.spiritStoneCost) {
    return { ok: false, error: `灵石不足，需${realm.spiritStoneCost}灵石（路费+护身符）` };
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
    spiritStones: Math.max(0, state.spiritStones - realm.spiritStoneCost),
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

