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
  // cultivationMultiplier 始终根据灵根 + 已装备物品（所有 multiply cultivationExp 效果之积）实时重算
  // 这样无论数据库里存的是什么，加载到内存后的倍率都是当前正确的
  let mult = rootInfo?.multiplier ?? 0;
  for (const it of equipped) {
    for (const eff of it.effects || []) {
      if (eff.target_attribute === 'cultivationExp' && eff.operation === 'multiply' && eff.value > 0) {
        mult *= eff.value;
      }
    }
  }
  const cultivationFactors = safeParse<CultivationFactor[]>(c.cultivationFactorsJson || '[]', []);
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
    cultivationMultiplier: mult,
    cultivationInsight: c.cultivationInsight || '',
    cultivationFactors,
    longTermMemory: safeParse<string[]>(c.memoryJson, []),
  };
  // 兜底：若旧存档无 cultivationFactors 或 factors 为空，按当前 state 实时计算
  if (!cultivationFactors.length) {
    state.cultivationFactors = computeCultivationFactors(state);
  }
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

// 重算修炼倍率 = 灵根倍率 × 所有已装备物品的 multiply cultivationExp 效果之积
export function recalcCultivationMultiplier(state: CharacterState): CharacterState {
  const rootInfo = SPIRITUAL_ROOTS[state.spiritualRoot];
  let mult = rootInfo?.multiplier ?? 0;
  for (const it of state.equipped || []) {
    for (const eff of it.effects || []) {
      if (eff.target_attribute === 'cultivationExp' && eff.operation === 'multiply' && eff.value > 0) {
        mult *= eff.value;
      }
    }
  }
  return { ...state, cultivationMultiplier: mult };
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
  return factors;
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
  const effects = pillEffects(mainElement, pillRarity);

  const pill: ItemEntry = {
    id: `item_pil_${mainElement}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: pillName,
    description: `以${materials.map(m => m.name).join('、')}炼制而成的${pillRarity === 'common' ? '凡品' : pillRarity === 'legendary' ? '传说' : ''}丹药，蕴含${mainElement === 'fire' ? '火' : mainElement === 'water' ? '水' : mainElement === 'wood' ? '木' : mainElement === 'metal' ? '金' : '土'}属性之力`,
    item_type: 'consumable',
    rarity: pillRarity,
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

export function tryBreakthrough(state: CharacterState): { state: CharacterState; success: boolean; newRealm?: Realm } {
  if (state.cultivationExp < state.expToBreak) {
    return { state, success: false };
  }
  const nextRealm = getNextRealm(state.realm);
  if (!nextRealm) {
    // 已达最高境界（渡劫→飞升由特殊事件处理）
    return { state, success: false };
  }

  const nextInfo = getRealmInfo(nextRealm);
  const newState: CharacterState = {
    ...state,
    realm: nextRealm,
    realmLevel: 0,
    cultivationExp: 0,
    expToBreak: nextInfo.expPerLevel,
    lifespan: Math.max(state.lifespan, nextInfo.baseLifespan),
  };

  // 突破提升基础属性
  const realmIdx = REALMS.findIndex(r => r.id === nextRealm);
  const boost = 1 + realmIdx * 0.5;
  newState.maxHp = Math.floor(state.maxHp * boost);
  newState.hp = newState.maxHp;
  newState.maxMp = Math.floor(state.maxMp * boost);
  newState.mp = newState.maxMp;
  newState.attack = Math.floor(state.attack * boost);
  newState.defense = Math.floor(state.defense * boost);
  newState.speed = Math.floor(state.speed * boost);

  return { state: newState, success: true, newRealm: nextRealm };
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
  let next = { ...state, inventory: [...state.inventory, ...normalized] };
  // 储物袋获得即扩容
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
  if (bagBoost > 0) next.storageCapacity = (next.storageCapacity || 5) + bagBoost;
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

export function buildStateContext(state: CharacterState, recentEvents: { age: number; title: string; narrative: string }[]): EngineStateContext {
  const realmInfo = getRealmInfo(state.realm);
  // 找下一个未完成的命节点
  const nextNode = FATE_NODES.find(n => !state.fateNodes.includes(n.index));
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
    },
    activeStatuses: state.activeStatuses,
    inventory: state.inventory,
    equipped: state.equipped,
    storageCapacity: state.storageCapacity,
    cultivationMultiplier: state.cultivationMultiplier,
    cultivationInsight: state.cultivationInsight,
    cultivationFactors: state.cultivationFactors,
    recentEvents: recentEvents.slice(-5),
    longTermMemory: state.longTermMemory.slice(-10),
    completedFateNodes: state.fateNodes,
    availableAttributes: Object.keys(ATTRIBUTE_BOUNDS),
    nextFateNode: nextNode ? { index: nextNode.index, name: nextNode.name, realm: nextNode.realm } : undefined,
  };
}

// ==================== 引擎执行 AI 输出（统一入口） ====================

export interface EngineExecutionResult {
  state: CharacterState;
  appliedChanges: AttributeChange[];
  rejectedChanges: AttributeChange[];
  breakthroughHappened: boolean;
  newRealm?: Realm;
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
  next = addItems(next, aiOutput.newItems || []);

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
  // 引擎权威：cultivationFactors 由引擎从 state 计算（保证数值准确）
  // AI 输出的 cultivationFactors 仅作为补充（环境/心境等引擎不跟踪的因素），
  // 与引擎计算的基础来源去重后合并
  if (aiOutput.cultivationFactors && Array.isArray(aiOutput.cultivationFactors) && aiOutput.cultivationFactors.length) {
    const engineFactors = computeCultivationFactors(next);
    const engineNames = new Set(engineFactors.map(f => f.name));
    const aiExtras = aiOutput.cultivationFactors
      .filter(f => f && f.name && typeof f.value === 'number' && !engineNames.has(String(f.name)))
      .slice(0, 6)
      .map(f => ({
        name: String(f.name).slice(0, 24),
        value: Number(f.value) || 0,
        operation: f.operation === 'add' ? 'add' : 'multiply',
        rarity: ['common','uncommon','rare','epic','legendary','mythic'].includes(f.rarity as any) ? f.rarity as any : undefined,
        note: f.note ? String(f.note).slice(0, 40) : undefined,
      }));
    next.cultivationFactors = [...engineFactors, ...aiExtras];
  } else {
    // AI 没输出 factors，纯用引擎计算
    next.cultivationFactors = computeCultivationFactors(next);
  }

  // 5. 处理突破
  let breakthroughHappened = false;
  let newRealm: Realm | undefined;
  if (aiOutput.triggeredBreakthrough) {
    const br = tryBreakthrough(next);
    if (br.success) {
      next = br.state;
      breakthroughHappened = true;
      newRealm = br.newRealm;
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

  const appliedChanges = (aiOutput.changes || []).filter(ch => ATTRIBUTE_BOUNDS[ch.attribute]);

  return {
    state: next,
    appliedChanges,
    rejectedChanges: rejected,
    breakthroughHappened,
    newRealm,
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
    cultivationMultiplier: s.cultivationMultiplier,
    cultivationInsight: s.cultivationInsight,
    cultivationFactors: s.cultivationFactors,
    storageCapacity: s.storageCapacity,
    activeStatuses: s.activeStatuses,
    inventory: s.inventory,
    equipped: s.equipped,
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
