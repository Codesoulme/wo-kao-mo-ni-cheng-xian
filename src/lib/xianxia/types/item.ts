import type { Realm } from './realm';
import type { SpiritualRoot, ElementType } from './spiritual-root';
import type { StatusEffect } from './status';




// ==================== 物品 ====================



export type ItemType = 'weapon' | 'armor' | 'accessory' | 'artifact' | 'consumable' | 'material' | 'tool' | 'scripture';




// 可装备的类型（用于判定 itemToSlot —— 仅用于「是否可装备」布尔判断；不再限制每种类型数量上限）

export type EquipSlot = 'weapon' | 'armor' | 'accessory' | 'artifact' | 'scripture';




export const ITEM_TYPE_LABEL: Record<ItemType, string> = {

  weapon: '兵器', armor: '防具', accessory: '饰物', artifact: '法宝',

  consumable: '\u4e39\u98df', material: '材料', tool: '器具', scripture: '功法',

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




export interface TechniqueRequirement {

  spiritualRoots?: SpiritualRoot[];      // strict root requirement

  preferredRoots?: SpiritualRoot[];      // preferred root affinity

  minRealm?: Realm;                      // minimum realm

  minComprehension?: number;             // comprehension threshold

  minElements?: Partial<Record<ElementType, number>>; // element affinity thresholds

  requiredStatuses?: string[];           // required status keywords

}




export interface TechniqueTrait {

  name: string;

  description: string;

  effect?: StatusEffect;

  risk?: string;

}




export interface ArtifactAbility {

  name: string;

  description: string;

  trigger?: 'passive' | 'active' | 'auto' | 'onHit' | 'onDamaged' | 'underwater' | 'cultivation';

  mpCost?: number;

  power?: number;

  element?: ElementType | 'none';

  effect?: StatusEffect;

  permanentBuff?: boolean;

  rarityNote?: string;

}




export interface TechniqueProfile {

  kind?: 'cultivation' | 'combat' | 'body' | 'movement' | 'support' | 'forbidden' | 'artifact';

  requirements?: TechniqueRequirement;

  traits?: TechniqueTrait[];

  spell?: { name: string; description: string; mpCost?: number; power?: number; element?: ElementType | 'none' };

  artifactAbilities?: ArtifactAbility[];

  mismatchRisk?: string;

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

  technique?: TechniqueProfile;

  // 装备位置备注（自由文本，由 AI 给出或玩家装备时按类型默认生成）

  // 例：「左手」「右手中指」「项链·储物戒指×5」「腰悬」「头戴」

  // 不再限制每种类型装备数量上限——玩家可戴十个戒指、脖挂一串储物戒指等

  equipNote?: string;

  // AI-63: 本命 vs 外用法宝

  bonded?: boolean;            // 是否本命（仅能一件，渡劫时共鸣）

  soulLink?: number;           // 神识共鸣度 0-100

  spirit?: string | null;      // 器灵名（已觉醒则记）

  gestationDays?: number;      // 孕育天数（法宝未成形前）

  // α-4 功法三段：scripture 类型物品累计修炼值与阶段

  scriptureExp?: number;                    // 0-100 累计修炼值

  scriptureStage?: 'practiced' | 'awakened' | 'transcendent';  // 当前阶段

  scriptureAwakeningHook?: string;          // 跨段时记录的因由

}




// ==================== 炼丹 AI 产出（AI 主路径，引擎校验落库） ====================

// AI 根据材料药性、相性、角色丹道造诣与世界因果产出炼丹结果；

// 引擎只做材料/灵石校验、稀有度与数值 clamp、registerItem 落库，不再写死成功率与丹效公式。

export interface AlchemyAIOutcome {

  success: boolean;                  // 是否成丹（false=炸炉/异变/废丹）

  pillName: string;                  // 自拟丹名（禁止照搬材料名）

  pillDescription: string;           // 丹药说明（沉浸式）

  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

  mainElement: 'fire' | 'water' | 'wood' | 'metal' | 'earth' | 'none';

  effects: StatusEffect[];           // 丹药效果（引擎按品阶 clamp 数值、过滤非法属性）

  narrative: string;                 // 开炉叙事

  accident?: string;                 // 可选：炸炉/异变/反噬说明

}




// ==================== AI 生成子系统内容（AI 主路径，引擎校验落库） ====================

export interface MarketAIItem extends ItemEntry { price: number; reason?: string }


export interface MarketAIOutcome { items: MarketAIItem[]; marketName?: string; atmosphere?: string }




export interface AuctionAIOutcome {

  title: string;

  invitation: string;

  lots: { item: ItemEntry; startingPrice: number; seller: string; desireTags: string[] }[];

  bidders: { name: string; realm: string; assets: number; desireTags: string[]; temperament: 'calm' | 'proud' | 'greedy' | 'secretive' | 'reckless' }[];

}




export interface CombatLootAIOutcome { items: ItemEntry[]; spiritStones: number; narrativeHint?: string }
