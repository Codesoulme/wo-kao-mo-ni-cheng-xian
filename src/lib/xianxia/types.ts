// 修仙模拟器 - 核心引擎类型定义
// 基于"引擎权威 + AI 提议"混合架构

// ==================== 境界系统 ====================

export type Realm =
  | 'mortal'           // 凡人
  | 'qi_refining'      // 炼气
  | 'foundation'       // 筑基
  | 'golden_core'      // 金丹
  | 'nascent_soul'     // 元婴
  | 'spirit_severing'  // 化神
  | 'great_vehicle'    // 大乘
  | 'tribulation'      // 渡劫
  | 'ascension';       // 飞升

export interface RealmInfo {
  id: Realm;
  name: string;
  shortName: string;
  levels: number;        // 小境界数量
  baseLifespan: number;  // 该境界基础寿元
  expPerLevel: number;   // 每级所需修为基础
  color: string;         // 境界代表色
  description: string;
}

export const REALMS: RealmInfo[] = [
  {
    id: 'mortal',
    name: '凡人',
    shortName: '凡',
    levels: 0,
    baseLifespan: 80,
    expPerLevel: 100,
    color: '#6b7280',
    description: '尚未踏上修行之路的凡人，寿元有限。',
  },
  {
    id: 'qi_refining',
    name: '炼气期',
    shortName: '气',
    levels: 9,
    baseLifespan: 120,
    expPerLevel: 200,
    color: '#84cc16',
    description: '感应天地灵气，引气入体，洗筋伐髓。',
  },
  {
    id: 'foundation',
    name: '筑基期',
    shortName: '基',
    levels: 9,
    baseLifespan: 200,
    expPerLevel: 600,
    color: '#22c55e',
    description: '凝聚灵根，奠定道基，可御器飞行。',
  },
  {
    id: 'golden_core',
    name: '金丹期',
    shortName: '丹',
    levels: 9,
    baseLifespan: 500,
    expPerLevel: 1800,
    color: '#eab308',
    description: '金丹大成，寿元大增，神通初显。',
  },
  {
    id: 'nascent_soul',
    name: '元婴期',
    shortName: '婴',
    levels: 9,
    baseLifespan: 1000,
    expPerLevel: 5400,
    color: '#f97316',
    description: '元婴出窍，神通大成，移山填海。',
  },
  {
    id: 'spirit_severing',
    name: '化神期',
    shortName: '化',
    levels: 9,
    baseLifespan: 2000,
    expPerLevel: 16200,
    color: '#ef4444',
    description: '化神入道，可局部修改法则，寿元绵长。',
  },
  {
    id: 'great_vehicle',
    name: '大乘期',
    shortName: '乘',
    levels: 9,
    baseLifespan: 5000,
    expPerLevel: 48600,
    color: '#a855f7',
    description: '大乘圆满，可修改时间速率，俯瞰众生。',
  },
  {
    id: 'tribulation',
    name: '渡劫期',
    shortName: '劫',
    levels: 1,
    baseLifespan: 10000,
    expPerLevel: 100000,
    color: '#ec4899',
    description: '天劫降临，生死考验，过则飞升。',
  },
  {
    id: 'ascension',
    name: '飞升',
    shortName: '仙',
    levels: 0,
    baseLifespan: 99999,
    expPerLevel: 999999,
    color: '#fbbf24',
    description: '超脱凡俗，飞升仙界，与天地同寿。',
  },
];

export function getRealmInfo(realm: Realm): RealmInfo {
  return REALMS.find(r => r.id === realm) || REALMS[0];
}

export function getNextRealm(realm: Realm): Realm | null {
  const idx = REALMS.findIndex(r => r.id === realm);
  if (idx < 0 || idx >= REALMS.length - 1) return null;
  return REALMS[idx + 1].id;
}

// ==================== 灵根系统 ====================

export type SpiritualRoot =
  | 'none'         // 无灵根
  | 'mixed'        // 杂灵根（5种）
  | 'common'       // 普通灵根（2-3种）
  | 'pure'         // 单灵根
  | 'heavenly'     // 天灵根
  | 'chaos';       // 混沌灵根

export interface SpiritualRootInfo {
  id: SpiritualRoot;
  name: string;
  multiplier: number;  // 修炼速度倍率
  rarity: number;      // 出现概率权重
  description: string;
}

export const SPIRITUAL_ROOTS: Record<SpiritualRoot, SpiritualRootInfo> = {
  none:     { id: 'none',     name: '无灵根',     multiplier: 0,    rarity: 30, description: '与修行无缘，寿终正寝。' },
  mixed:    { id: 'mixed',    name: '杂灵根',     multiplier: 0.3,  rarity: 25, description: '五行皆有，修炼极慢。' },
  common:   { id: 'common',   name: '凡灵根',     multiplier: 0.8,  rarity: 20, description: '两三种属性，可入修行。' },
  pure:     { id: 'pure',     name: '真灵根',     multiplier: 1.5,  rarity: 15, description: '单属性灵根，修炼神速。' },
  heavenly: { id: 'heavenly', name: '天灵根',     multiplier: 3.0,  rarity: 8,  description: '天赐灵根，万中无一。' },
  chaos:    { id: 'chaos',    name: '混沌灵根',   multiplier: 5.0,  rarity: 2,  description: '混沌之体，亘古难寻。' },
};

// ==================== 五行属性 ====================

export type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth';

export const ELEMENTS: Record<Element, { name: string; color: string; icon: string }> = {
  metal: { name: '金', color: '#d4af37', icon: '⚔' },
  wood:  { name: '木', color: '#22c55e', icon: '🌿' },
  water: { name: '水', color: '#3b82f6', icon: '🌊' },
  fire:  { name: '火', color: '#ef4444', icon: '🔥' },
  earth: { name: '土', color: '#a16207', icon: '⛰' },
};

// ==================== 状态词条 ====================

export type StatusCategory =
  | 'attribute' | 'skill' | 'buff' | 'debuff'
  | 'special' | 'identity' | 'quest' | 'environment';

export interface StatusEntry {
  id: string;
  name: string;
  description: string;
  category: StatusCategory;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  duration: number;  // -1 = 永久, >0 = 剩余年龄数
  source: string;    // 来源描述
  effects: StatusEffect[];
}

export type EffectOperation = 'add' | 'multiply' | 'override' | 'cap' | 'floor' | 'trigger';

export interface StatusEffect {
  target_attribute: string;
  operation: EffectOperation;
  value: number;
  description: string;
}

// ==================== 物品 ====================

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'artifact' | 'consumable' | 'material' | 'tool' | 'scripture';

// 可装备的类型（用于判定 itemToSlot —— 仅用于「是否可装备」布尔判断；不再限制每种类型数量上限）
export type EquipSlot = 'weapon' | 'armor' | 'accessory' | 'artifact' | 'scripture';

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  weapon: '兵器', armor: '防具', accessory: '饰物', artifact: '法宝',
  consumable: '丹药', material: '材料', tool: '器具', scripture: '功法',
};

export const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: '兵器', armor: '防具', accessory: '饰物', artifact: '法宝', scripture: '功法',
};

// 物品类型 → 是否可装备（不再返回固定槽位；装备数量上限由 AI 判断）
export function itemToSlot(type: ItemType): EquipSlot | null {
  if (type === 'weapon' || type === 'armor' || type === 'accessory' || type === 'artifact' || type === 'scripture') {
    return type;
  }
  return null;
}

// 修炼速度来源结构化条目：AI 输出 + 前端按 rarity 上色显示来源名称与具体倍率数字
export interface CultivationFactor {
  name: string;                  // 来源名称（如「土天灵根」「《引气诀》」「聚灵佩」）
  value: number;                  // 数值（如 3.0、1.5、0.2）
  operation: 'multiply' | 'add';  // 倍率 or 加成
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  note?: string;                  // 简短说明（如「修为流转加速」「灵气汇聚」）
}

export interface ItemEntry {
  id: string;
  name: string;
  description: string;
  item_type: ItemType;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  effects: StatusEffect[];
  source: string;
  // 装备位置备注（自由文本，由 AI 给出或玩家装备时按类型默认生成）
  // 例：「左手」「右手中指」「项链·储物戒指×5」「腰悬」「头戴」
  // 不再限制每种类型装备数量上限——玩家可戴十个戒指、脖挂一串储物戒指等
  equipNote?: string;
}

// ==================== AI 输出结构 (EngineCommand) ====================

export type InputClass = 'action' | 'dialogue' | 'overreach' | 'rule_manipulation';

// AI 生成的叙事事件
export interface AIEventOutput {
  // 叙事
  title: string;              // 事件标题（≤16字）
  narrative: string;          // 叙事正文（100-300字）
  eventType: 'normal' | 'fate_node' | 'choice' | 'combat' | 'breakthrough' | 'death' | 'ascension';

  // 状态变更（AI 提议，引擎校验）
  changes: AttributeChange[];

  // 新增状态词条
  newStatuses: StatusEntry[];

  // 新增物品
  newItems: ItemEntry[];

  // 移除/消耗的物品 id 列表（AI 联动：战斗中武器被破坏、丹药被消耗等）
  removedItemIds?: string[];

  // AI 直接放入已装备的物品（含 equipNote 自由文本，如「项链·储物戒指串」）
  // 用于 AI 创造性装备场景：玩家说「把储物戒指串成项链戴脖子上」→ AI 用此字段放置
  newEquippedItems?: ItemEntry[];

  // AI 想把背包里已有的物品装备上去的 id 列表（引擎自动移动 inventory→equipped）
  equipItemIds?: string[];

  // AI 想卸下已装备物品的 id 列表（引擎自动移动 equipped→inventory）
  unequipItemIds?: string[];

  // 长期记忆（写入长期记忆库）
  memory: string;

  // 修炼心得：AI 根据当前角色全状态生成的修炼速度说明文本（影响修炼速度的种种因素）
  // 显示规则见 prompt：60-150字，修仙口吻，融入角色处境，末尾给出综合倍率数值
  cultivationInsight?: string;

  // 修炼速度来源结构化列表（前端按 rarity 给来源名称上色 + 显示具体倍率数字）
  cultivationFactors?: CultivationFactor[];

  // 是否触发选择节点
  hasChoice: boolean;
  choice?: ChoicePrompt;

  // 是否触发突破
  triggeredBreakthrough?: boolean;

  // 是否死亡
  causedDeath?: boolean;
  deathReason?: string;

  // 是否飞升
  causedAscension?: boolean;
}

export interface AttributeChange {
  attribute: string;     // 改变哪个属性
  delta: number;         // 变化量（正或负）
  reason: string;        // 变化原因
}

export interface ChoicePrompt {
  prompt: string;         // 选择提示
  options: ChoiceOption[];
}

export interface ChoiceOption {
  text: string;           // 选项文本
  hint?: string;          // 提示
  // 选择后由 AI 生成结果
}

// 玩家选择结果
export interface ChoiceResultOutput {
  narrative: string;
  changes: AttributeChange[];
  newStatuses: StatusEntry[];
  newItems: ItemEntry[];
  removedItemIds?: string[];
  newEquippedItems?: ItemEntry[];
  equipItemIds?: string[];
  unequipItemIds?: string[];
  memory: string;
  // 修炼心得（同 AIEventOutput）
  cultivationInsight?: string;
  cultivationFactors?: CultivationFactor[];
  causedDeath?: boolean;
  deathReason?: string;
}

// 干扰模拟输出
export interface InterfereOutput {
  classification: InputClass;     // 输入分类
  accepted: boolean;              // 是否接受（false=静默拒绝）
  narrative: string;              // 回应叙事
  changes: AttributeChange[];     // 状态变更
  newStatuses: StatusEntry[];
  newItems: ItemEntry[];
  removedItemIds?: string[];
  newEquippedItems?: ItemEntry[];
  equipItemIds?: string[];
  unequipItemIds?: string[];
  memory: string;
  // 修炼心得（同 AIEventOutput；accepted=false 时可留空，引擎将保留旧文本）
  cultivationInsight?: string;
  cultivationFactors?: CultivationFactor[];
  // 干扰可能延迟年龄推进
  ageAdvance?: number;            // 干扰消耗的时间（岁），默认 0
}

// ==================== 引擎状态上下文 (注入给 AI) ====================

export interface EngineStateContext {
  character: {
    name: string;
    age: number;
    lifespan: number;
    gender: string;
    spiritualRoot: string;
    rootDetail: string;
    realm: string;
    realmName: string;
    realmLevel: number;
    cultivationExp: number;
    expToBreak: number;
    elements: { metal: number; wood: number; water: number; fire: number; earth: number };
    hp: number; maxHp: number;
    mp: number; maxMp: number;
    attack: number; defense: number; speed: number;
    luck: number; comprehension: number;
    spiritStones: number; reputation: number;
    faction: string; master: string; location: string;
    alive: boolean; ascended: boolean;
  };
  // 修炼心得（当前已存的修炼速度说明文本，AI 可读取参考并决定是否更新）
  cultivationInsight: string;
  // 修炼速度来源结构化列表（AI 可读取上一轮的来源条目，本轮可调整）
  cultivationFactors: CultivationFactor[];
  activeStatuses: StatusEntry[];
  inventory: ItemEntry[];
  // 已装备物品数组（无槽位上限，AI 可创造性装备：项链·储物戒指串、十指皆戴戒指等）
  equipped: ItemEntry[];
  // 储物袋容量上限（无袋 5；获得储物袋后增加）
  storageCapacity: number;
  // 修炼速度倍率（灵根 × 功法 × 其他装备的乘法效果之和）
  cultivationMultiplier: number;
  recentEvents: { age: number; title: string; narrative: string }[];
  longTermMemory: string[];
  completedFateNodes: number[];
  // 引擎能力告知
  availableAttributes: string[];   // AI 可改的属性列表
  nextFateNode?: { index: number; name: string; realm: string };
}

// ==================== 命节点 ====================

export interface FateNode {
  index: number;
  name: string;
  realm: Realm;
  triggerAge: { min: number; max: number };
  theme: string;
  coreConflict: string;
  narrativeGoal: string;
}

export const FATE_NODES: FateNode[] = [
  { index: 1, name: '灵根觉醒', realm: 'qi_refining',    triggerAge: { min: 6,  max: 16 },  theme: '天赋觉醒',    coreConflict: '凡人与修仙者的界限',         narrativeGoal: '确立主角修仙动机' },
  { index: 2, name: '初入宗门', realm: 'foundation',     triggerAge: { min: 14, max: 22 },  theme: '归属与认同',  coreConflict: '宗门选择与师承',             narrativeGoal: '确立主角的修仙路径' },
  { index: 3, name: '金丹大成', realm: 'golden_core',    triggerAge: { min: 50, max: 120 }, theme: '自我突破',    coreConflict: '内丹与外道的抉择',           narrativeGoal: '确立主角的道心' },
  { index: 4, name: '元婴出窍', realm: 'nascent_soul',   triggerAge: { min: 120,max: 300 }, theme: '神通与责任',  coreConflict: '力量使用的边界',             narrativeGoal: '确立主角的价值观' },
  { index: 5, name: '化神入道', realm: 'spirit_severing',triggerAge: { min: 300,max: 800 }, theme: '法则理解',    coreConflict: '个人与天道的关系',           narrativeGoal: '确立主角的世界观' },
  { index: 6, name: '大乘圆满', realm: 'great_vehicle',  triggerAge: { min: 800,max: 2000}, theme: '尘缘了断',    coreConflict: '情感与修行的冲突',           narrativeGoal: '确立主角的情感归属' },
  { index: 7, name: '渡劫考验', realm: 'tribulation',    triggerAge: { min: 2000,max:5000},theme: '生死考验',    coreConflict: '天劫与自我超越',             narrativeGoal: '确立主角的最终形态' },
  { index: 8, name: '飞升仙界', realm: 'ascension',      triggerAge: { min: 5000,max:9999},theme: '超脱与传承',  coreConflict: '留恋与放下的抉择',           narrativeGoal: '完成主角的修仙之路' },
];

// ==================== 角色状态（运行时） ====================

// 兼容旧存档：旧格式为 Partial<Record<EquipSlot, ItemEntry>>（slot-map），新格式为 ItemEntry[]（数组）
// dbToState 会在加载时把旧 slot-map 自动转换为数组
export type EquippedMap = Partial<Record<EquipSlot, ItemEntry>>;

export interface CharacterState {
  id: string;
  name: string;
  age: number;
  lifespan: number;
  gender: string;
  spiritualRoot: SpiritualRoot;
  rootDetail: string;
  rootMultiplier: number;
  realm: Realm;
  realmLevel: number;
  cultivationExp: number;
  expToBreak: number;
  elements: { metal: number; wood: number; water: number; fire: number; earth: number };
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  attack: number; defense: number; speed: number;
  luck: number; comprehension: number;
  spiritStones: number; reputation: number;
  alive: boolean; ascended: boolean;
  causeOfDeath: string;
  faction: string; master: string; location: string;
  fateNodes: number[];
  isAtChoice: boolean;
  lastEventAge: number;
  activeStatuses: StatusEntry[];
  inventory: ItemEntry[];
  // 已装备物品数组（不再有 5 槽位上限——AI 可创造性放置，玩家也可戴多枚戒指等）
  equipped: ItemEntry[];
  // 储物袋容量上限（无袋 5；获得储物袋物品后增加；储物袋物品本身不占容量）
  storageCapacity: number;
  // 修炼速度倍率（灵根倍率 × 所有已装备物品的 multiply cultivationExp 效果之积）
  cultivationMultiplier: number;
  // 修炼心得：AI 生成的修炼速度说明文本（描述当前影响修炼速度的因素）
  cultivationInsight: string;
  // 修炼速度来源结构化条目（前端按 rarity 给来源上色 + 显示具体倍率数字）
  cultivationFactors: CultivationFactor[];
  longTermMemory: string[];
}
