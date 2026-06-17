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
  equippedJson: string; cultivationMultiplier: number;
}

export function dbToState(c: DBCharacter): CharacterState {
  const rootInfo = SPIRITUAL_ROOTS[c.spiritualRoot as SpiritualRoot];
  const equipped = safeParse<EquippedMap>(c.equippedJson || '{}', {});
  // 旧存档可能没有 cultivationMultiplier 字段，根据灵根 + 已装备功法重算
  let mult = Number(c.cultivationMultiplier);
  if (!mult || Number.isNaN(mult) || mult <= 0) {
    mult = rootInfo?.multiplier ?? 0;
    const scripture = equipped.scripture;
    if (scripture) {
      for (const eff of scripture.effects || []) {
        if (eff.target_attribute === 'cultivationExp' && eff.operation === 'multiply') {
          mult *= eff.value;
        }
      }
    }
  }
  return {
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
    inventory: safeParse<ItemEntry[]>(c.inventoryJson, []),
    equipped,
    cultivationMultiplier: mult,
    longTermMemory: safeParse<string[]>(c.memoryJson, []),
  };
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
function applyItemEffects(state: CharacterState, item: ItemEntry, sign: 1 | -1): CharacterState {
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

// 重算修炼倍率 = 灵根倍率 × 所有已装备功法的 multiply cultivationExp
export function recalcCultivationMultiplier(state: CharacterState): CharacterState {
  const rootInfo = SPIRITUAL_ROOTS[state.spiritualRoot];
  let mult = rootInfo?.multiplier ?? 0;
  const scripture = state.equipped?.scripture;
  if (scripture) {
    for (const eff of scripture.effects || []) {
      if (eff.target_attribute === 'cultivationExp' && eff.operation === 'multiply' && eff.value > 0) {
        mult *= eff.value;
      }
    }
  }
  return { ...state, cultivationMultiplier: mult };
}

// 装备物品到对应槽位（从 inventory 移到 equipped）
export function equipItem(state: CharacterState, itemId: string): { state: CharacterState; ok: boolean; error?: string; slot?: EquipSlot; replaced?: ItemEntry } {
  const idx = state.inventory.findIndex(it => it.id === itemId);
  if (idx < 0) return { state, ok: false, error: '物品不在储物袋中' };
  const item = state.inventory[idx];
  const slot = itemToSlot(item.item_type);
  if (!slot) return { state, ok: false, error: '该物品不可装备' };

  let next: CharacterState = { ...state, inventory: state.inventory.filter(it => it.id !== itemId), equipped: { ...state.equipped } };
  // 若槽位已有物品，先卸下（不应用反向效果，因为下面会整体重算；但需把旧物品放回 inventory）
  const replaced = next.equipped[slot];
  if (replaced) {
    next.equipped = { ...next.equipped, [slot]: undefined };
    next.inventory = [...next.inventory, replaced];
  }
  // 装备新物品
  next.equipped = { ...next.equipped, [slot]: item };
  // 应用 add 效果
  next = applyItemEffects(next, item, 1);
  // 若卸下了旧物品，应用反向效果
  if (replaced) next = applyItemEffects(next, replaced, -1);
  // 重算修炼倍率
  next = recalcCultivationMultiplier(next);
  return { state: next, ok: true, slot, replaced };
}

// 卸下指定槽位的物品
export function unequipSlot(state: CharacterState, slot: EquipSlot): { state: CharacterState; ok: boolean; error?: string; item?: ItemEntry } {
  const item = state.equipped?.[slot];
  if (!item) return { state, ok: false, error: '该槽位无装备' };
  let next: CharacterState = {
    ...state,
    equipped: { ...state.equipped, [slot]: undefined },
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
  // 从 equipped 移除（并反向应用效果）
  if (next.equipped) {
    const newEquipped: EquippedMap = { ...next.equipped };
    (Object.keys(newEquipped) as EquipSlot[]).forEach(slot => {
      const it = newEquipped[slot];
      if (it && idSet.has(it.id)) {
        removed.push(it);
        next = applyItemEffects(next, it, -1);
        delete newEquipped[slot];
      }
    });
    next.equipped = newEquipped;
    next = recalcCultivationMultiplier(next);
  }
  return { state: next, removed };
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

export function addItems(state: CharacterState, items: ItemEntry[]): CharacterState {
  if (!items.length) return state;
  return { ...state, inventory: [...state.inventory, ...items] };
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
    cultivationMultiplier: state.cultivationMultiplier,
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

  // 4. 添加长期记忆
  if (aiOutput.memory) next = addMemory(next, aiOutput.memory);

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
