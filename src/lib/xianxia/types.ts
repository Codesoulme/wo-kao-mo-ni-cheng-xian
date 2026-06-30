// 修仙模拟器 - 核心引擎类型定义
// 基于"引擎权威 + AI 提议"混合架构
// Task 20: 事件蓝图 / 角色意图 / 未决线索 / 战斗系统

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

// 境界画像：默认境界体系之上的显示/强度覆盖层。
// 底层 realm 仍用于系统兼容；AI 可在重大因果下通过特殊状态或突破输出改写此画像。
export interface RealmProfile {
  name?: string;         // 显示名称，如「练气四十二层」「九转金丹」「完美筑基」
  shortName?: string;    // 境界球单字/短名
  color?: string;
  maxLevel?: number;     // 当前境界的显示层数上限，允许如练气999层
  powerMultiplier?: number; // 强度倍率，仅在合理范围内影响战斗/属性展示
  expMultiplier?: number;   // 突破/升层修为需求倍率
  reason?: string;       // 叙事因果
  traits?: Partial<RealmTraits>; // 衍生境界特性（与 REALM_TRAITS 默认合并）
}

export interface RealmTraits {
  cultivationMode: string;
  bottleneck: string;
  breakthroughTrial: string;
  capabilities: string[];
  limitations: string[];
  worldAccess: string[];
  socialWeight: string;
  combatStyle: string[];
  resourceNeeds: string[];
  riskTags: string[];
}

export interface CombatProjectionTraits {
  force: number;
  guard: number;
  agility: number;
  spiritualAwareness: number;
  soulStability: number;
  bodyTenacity: number;
  forceLabel: string;
  guardLabel: string;
  agilityLabel: string;
  summary: string;
  advantages: string[];
  vulnerabilities: string[];
}

export interface CultivationAttributeEntry {
  id: string;
  name: string;
  value?: number | string;
  description: string;
  source?: string;
  category?: 'body' | 'spirit' | 'dao' | 'combat' | 'fate' | 'custom';
  visible?: boolean;
}

export const REALM_TRAITS: Record<Realm, RealmTraits> = {
  mortal: {
    cultivationMode: '尚未引气，以生计、根骨打磨和寻觅仙缘为主',
    bottleneck: '不识灵机，难辨仙物真价，受凡俗病痛与生计所困',
    breakthroughTrial: '需得灵根显化、引路之人或真正入道机缘',
    capabilities: ['凡俗谋生', '江湖武艺', '辨识粗浅仙缘'],
    limitations: ['不能自主驱使法器', '难以辨识高阶灵物', '寿元与疾病束缚明显'],
    worldAccess: ['凡俗村镇', '江湖门派', '低频仙缘传闻'],
    socialWeight: '在修士眼中近乎凡尘，但奇根骨或奇物可引来关注',
    combatStyle: ['体力搏杀', '借物脱身', '依靠他人庇护'],
    resourceNeeds: ['入道功法', '启灵之物', '安身之所'],
    riskTags: ['疾病', '饥寒', '被修士注及'],
  },
  qi_refining: {
    cultivationMode: '引气入体，稳定法力循环，以低阶功法、灵石、符箓和丹药为要',
    bottleneck: '法力浅薄，神识初萌且难长时间外放',
    breakthroughTrial: '需打通周天、得合适功法后续与筑基机缘',
    capabilities: ['使用低阶符箓', '短时驱使低阶法器', '辨识常见灵物'],
    limitations: ['不宜长途御器横行', '难破高阶禁制', '易受筑基以上神识压制'],
    worldAccess: ['低阶坊市', '宗门外门', '小型灵地', '凡俗与修行边界'],
    socialWeight: '初入修行者，凡人眼中已有仙家威仪，高阶修士眼中仍属后辈',
    combatStyle: ['符箓试探', '低阶法器护身', '借地形退避'],
    resourceNeeds: ['灵石', '聚气丹', '入门功法后续', '筑基丹线索'],
    riskTags: ['灵力枯竭', '功法不合', '被高阶神识锁定'],
  },
  foundation: {
    cultivationMode: '道基初成，法力凝实，以稳固道基、神识初放和洞府经营为要',
    bottleneck: '道基稳固度、功法后续与结丹资源缺口',
    breakthroughTrial: '需结丹因缘、丹药、心性与道基成色相合',
    capabilities: ['稳定御器远行', '神识探查周身', '开辟或经营洞府'],
    limitations: ['难驾驭本命法宝', '金丹禁制仍难硬破', '长途斗法耗损明显'],
    worldAccess: ['宗门核心外围', '洞府经营', '秘境外层', '筑基坊市'],
    socialWeight: '已算低阶骨干，烬气修士多有忌惮，小宗门开始重视',
    combatStyle: ['御器斗法', '神识预判', '护体灵光维持'],
    resourceNeeds: ['结丹灵物', '高阶功法后续', '洞府灵脉', '稳固道基的丹药'],
    riskTags: ['道基受损', '神识反噬', '结丹失败'],
  },
  golden_core: {
    cultivationMode: '金丹成就，以丹火、本命法宝雏形和金丹品阶为核心',
    bottleneck: '金丹成色、本命法宝祭炼与结婴机缘',
    breakthroughTrial: '需破丹成婴，资源、心魔、神魂成色缺一不可',
    capabilities: ['祭炼本命法宝雏形', '以丹火炼物或对效', '神识压制低阶修士'],
    limitations: ['元婴秘术尚不可轻用', '高阶大能仍可碾压', '金丹受损代价极大'],
    worldAccess: ['高阶拍卖会', '宗门镇守之位', '金丹秘境', '小宗门权力层'],
    socialWeight: '可镇一方、被拉拢或忌惮，也更容易被围杀夺宝',
    combatStyle: ['本命法宝雏形', '丹火焚炼', '阵法与法宝联动'],
    resourceNeeds: ['本命法宝材料', '结婴灵物', '神魂温养之物'],
    riskTags: ['丹毁道消', '心魔劫', '被高阶修士猎杀'],
  },
  nascent_soul: {
    cultivationMode: '元婴凝成，神魂与法力相合，以元婴秘术、神识远游和肉身安否为要',
    bottleneck: '元婴稳固、肉身与神魂的互相承载，以及化神契机',
    breakthroughTrial: '需神魂足以承受天地元气压力，否则易被反噬或封禁',
    capabilities: ['元婴出窍或遥感', '肉身毁坏后有机会遁逃', '高阶神识秘术'],
    limitations: ['元婴离体风险极高', '夺舍或转修必须有强因果', '界面压力已开始显化'],
    worldAccess: ['大能交易会', '空间禁制', '宗门兴衰之争', '元婴秘府'],
    socialWeight: '已是大能之列，一举一动足以改变小势力格局',
    combatStyle: ['神识重压', '元婴秘术', '肉身与元婴双层风险'],
    resourceNeeds: ['温养元婴之物', '空间灵材', '化神契机'],
    riskTags: ['元婴被封', '夺舍失败', '肉身毁损'],
  },
  spirit_severing: {
    cultivationMode: '神意与天地元气相应，以法则雏形、因果压力和神魂稳固为要',
    bottleneck: '神魂承压、天地元气契合与界面排斥',
    breakthroughTrial: '需稳住元神与法则雏形，不可将法则之力当作随手技艺',
    capabilities: ['感应法则雏形', '长距离神念探查', '改变局部天地元气流势'],
    limitations: ['不可随意改写天地法则', '高阶出手会留下明显因果', '低阶地界难承长时间威压'],
    worldAccess: ['高阶秘市', '法则遗迹', '界面裂隙', '大能同盟或猎杀'],
    socialWeight: '行走一方即会被大势力记录，非常人能忽视',
    combatStyle: ['天地元气压制', '神念锁敌', '法则雏形余波'],
    resourceNeeds: ['法则感悟', '界面线索', '稳魂之物'],
    riskTags: ['界面排斥', '因果反噬', '神魂裂痕'],
  },
  great_vehicle: {
    cultivationMode: '道行近圆，以界面压力、飞升通道和道统承负为主',
    bottleneck: '界面容纳、飞升契机与一身因果清算',
    breakthroughTrial: '需应对界面牵引与天地因果，不宜再用低阶事件模式推进',
    capabilities: ['牵动天地气机', '开辟或寻觅飞升通道', '布置长期道统后手'],
    limitations: ['出手代价极大', '不应频繁滋扰低阶尘世', '受天劫与界面监视'],
    worldAccess: ['飞升通道', '大能道统争夺', '界面边缘', '天劫布置'],
    socialWeight: '已越出寻常势力格局，一念可成传说或大祸',
    combatStyle: ['道统后手', '界面气机牵制', '天劫风险参与斗法'],
    resourceNeeds: ['飞升信物', '界面节点', '清算因果的契机'],
    riskTags: ['天劫', '界面压力', '道统反噬'],
  },
  tribulation: {
    cultivationMode: '身处劫数，一切修行都围绕渡劫、因果清算与飞升准备',
    bottleneck: '天劫强度、肉身承载、神魂稳固和一生因果',
    breakthroughTrial: '渡劫即为核心试炼，成则飞升，败则身死道消或留下余波',
    capabilities: ['调动毕生道行应劫', '留下传承后手', '以劫数改写世界记忆'],
    limitations: ['难以逃避核心劫数', '出手会牵动天劫提前', '不宜再局限于低阶争斗'],
    worldAccess: ['天劫之地', '飞升前的道统清算', '世界遗响'],
    socialWeight: '举世瞩目，成败都会成为后世传说或禁地根源',
    combatStyle: ['应劫护道', '天雷余波', '临终或飞升之战'],
    resourceNeeds: ['渡劫大阵', '护道之物', '一生因果了结'],
    riskTags: ['天劫降临', '身死道消', '遗响反噬'],
  },
  ascension: {
    cultivationMode: '已超脱此界常规修行，以仙路遗响、道统传承和后世回响为主',
    bottleneck: '不再以此界小境界衡量',
    breakthroughTrial: '此境不应再生成常规突破',
    capabilities: ['成为世界传说', '遗留道统种子', '影响后世仙缘'],
    limitations: ['不应以凡界常规事件追演', '不再以普通背包或坊市资源作为核心'],
    worldAccess: ['仙路传说', '后世遗迹', '传承池'],
    socialWeight: '在此界已是传说与遗响',
    combatStyle: ['不以常规斗法记录'],
    resourceNeeds: ['传承落点', '世界遗响承接'],
    riskTags: ['遗响被曲解', '道统失传'],
  },
};

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

// ==================== 器灵觉醒阶段 (Phase-α α-5) ====================
// 三阶段：sleeping(未启 0-33) → awakened(初醒 34-66) → sentient(启智 67-100)
// 阶段名由 AI 在 narrative 自然叙出；UI 仅展示；不存在"指定器灵名"输入表单
export type AwakeningStage = 'sleeping' | 'awakened' | 'sentient';

export const AWAKENING_STAGE_LABEL: Record<AwakeningStage, string> = {
  sleeping: '未启',
  awakened: '初醒',
  sentient: '启智',
};

// 阶段阈值（闭区间右开；与 engine.computeAwakening 保持一致）
export const AWAKENING_THRESHOLDS = {
  sleeping: { min: 0,  max: 33 },
  awakened: { min: 34, max: 66 },
  sentient: { min: 67, max: 100 },
} as const;

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
  // ===== Phase-α α-5: 法宝养灵 / 器灵觉醒 =====
  // 养灵进度 0..100（引擎累加；AI 提议 delta 由引擎限幅 [0..10]/事件）
  nurtureProgress?: number;
  // 觉醒阶段（由 nurtureProgress 自动判定；首次跨 stage 由引擎落回 state）
  awakeningStage?: AwakeningStage;
  // 器灵名（AI 在 narrative 自然起名；UI 不提供输入；首次跨 sentient 阶段时落定）
  sentientName?: string;
  // ===== Phase-α α-4: 功法三段（经/诀/神通）=====
  // 阶段：practiced(初习 0-33) / awakened(觉意 34-66) / transcendent(神通/大成 67-100)
  // 旧存档无字段视为初习 + 0 exp；不报错；UI 按色阶 chip 投影（不暴露机制词）
  scriptureStage?: 'practiced' | 'awakened' | 'transcendent';
  // 功法熟练度累计 0..100；引擎权威累计，AI 的 scriptureProgress.delta 仅作建议（被限幅 [0..30]/事件）
  scriptureExp?: number;
  // 跨段觉醒时 AI 留下的中文叙事钩子（如「血海悟剑」「与《吞日真经》融合」），用于 detail 弹窗
  scriptureAwakeningHook?: string;
}

// ==================== 事件蓝图系统 (Task 20 - 解决事件单一化) ====================

// 事件主题分类——每岁由引擎从蓝图池中按权重抽取一个主题，AI 必须围绕此主题生成事件
// 解决"除了修炼就是修炼"的问题：强制 AI 多样化事件类型
export type BlueprintCategory =
  | 'cultivation'    // 修炼类（基础修炼、突破前夜、功法参悟）
  | 'encounter'      // 奇遇类（秘境、传承、灵物现世）
  | 'social'         // 人际类（师门、同门、结识、争风）
  | 'combat'         // 争斗类（妖兽、邪修、夺宝、擂台）
  | 'trade'          // 商业类（坊市、淘宝、典当、交易）
  | 'exploration'    // 探索类（秘境、洞府、遗迹、地脉）
  | 'heritage'       // 传承类（前辈指点、玉简、心法传承）
  | 'trial'          // 试炼类（宗门任务、心魔试炼、雷劫前夕）
  | 'emotion'        // 情感类（尘缘、故人、恩怨、亲情）
  | 'inner_demon'    // 心魔类（心魔侵扰、道心动摇、执念）
  | 'thread_resolve' // 未决线索推进（必须触发，引擎专用）
  | 'daily';         // 凡俗日常（童年、家事、市井）

export interface EventBlueprint {
  category: BlueprintCategory;
  name: string;           // 主题名称（如"坊市淘宝""妖兽搏杀""心魔试炼"）
  description: string;    // 主题描述（指导 AI 应围绕什么展开）
  weight: number;         // 抽取权重
  minRealm: number;       // 最低境界 idx（0=mortal, 1=qi_refining...）
  maxRealm: number;       // 最高境界 idx
  minAge: number;         // 最低年龄
  maxAge: number;         // 最高年龄
  requireFaction?: boolean; // 是否需要宗门
  examples: string[];     // 该主题下的事件灵感样例（AI 可参考但不可照抄）
}

// 事件蓝图池——参考《凡人修仙传》修仙世界，覆盖各境界各阶段
export const EVENT_BLUEPRINTS: EventBlueprint[] = [
  // ===== 凡人阶段（0-12岁）=====
  { category: 'daily', name: '童年趣事', description: '凡人童年日常，家人互动、邻里趣事、初识世界', weight: 30, minRealm: 0, maxRealm: 1, minAge: 0, maxAge: 12, examples: ['与邻家孩童嬉闹', '帮父母做家务', '第一次见到行脚商', '夜里听爷爷讲修仙传说'] },
  { category: 'encounter', name: '灵气初触', description: '凡人阶段偶然感知天地灵气，为日后修仙埋下伏笔', weight: 15, minRealm: 0, maxRealm: 1, minAge: 4, maxAge: 14, examples: ['梦见云中仙人', '山间偶遇采药老者', '夜里听到奇怪声响', '触碰到祖传玉佩发热'] },
  { category: 'social', name: '家族变故', description: '家世相关变故，磨砺心性、影响性格', weight: 10, minRealm: 0, maxRealm: 2, minAge: 5, maxAge: 20, examples: ['父亲染病', '家中遭贼', '兄长离家闯荡', '母亲传授家传手艺'] },
  { category: 'inner_demon', name: '幼年执念', description: '童年时期埋下执念，影响日后道心', weight: 8, minRealm: 0, maxRealm: 1, minAge: 6, maxAge: 14, examples: ['目睹不公立誓强大', '亲人离世立志长生', '受人欺辱暗下决心'] },

  // ===== 炼气期 =====
  { category: 'cultivation', name: '引气入体', description: '炼气期修炼日常，感知灵气、运转功法、洗筋伐髓', weight: 18, minRealm: 1, maxRealm: 2, minAge: 8, maxAge: 60, examples: ['首次引气入体成功', '打通某条经脉', '功法参悟有新得', '灵气汇聚丹田'] },
  { category: 'trade', name: '坊市淘宝', description: '前往坊市购买/出售物品，可能有意外收获', weight: 15, minRealm: 1, maxRealm: 6, minAge: 12, maxAge: 9999, examples: ['坊市捡漏得灵草', '典当旧物换灵石', '与商贩讨价还价', '黑市淘宝遇险'] },
  { category: 'social', name: '同门切磋', description: '与同门师兄弟切磋斗法、增进情谊或结怨', weight: 12, minRealm: 1, maxRealm: 5, minAge: 12, maxAge: 9999, requireFaction: true, examples: ['与师兄切磋法术', '与师妹论道', '与同门争夺资源', '帮师弟解惑'] },
  { category: 'exploration', name: '宗门历练', description: '宗门安排的历练任务，外出执行', weight: 12, minRealm: 1, maxRealm: 5, minAge: 12, maxAge: 9999, requireFaction: true, examples: ['清理山门附近妖兽', '采药任务', '护送商队', '巡查边境'] },
  { category: 'combat', name: '妖兽搏杀', description: '遭遇妖兽，进入战斗或巧妙避开', weight: 14, minRealm: 1, maxRealm: 7, minAge: 12, maxAge: 9999, examples: ['山林遇狼妖', '洞府惊现蛇妖', '溪边逢蟹怪', '高空遇鹰妖'] },
  { category: 'combat', name: '邪修截杀', description: '遭遇邪修、魔修，劫财或夺宝', weight: 10, minRealm: 1, maxRealm: 7, minAge: 14, maxAge: 9999, examples: ['夜行遇蒙面人', '林中遇血修', '客栈遇魔修', '路上遇劫匪'] },

  // ===== 筑基-金丹 =====
  { category: 'encounter', name: '秘境现世', description: '秘境、洞府、遗迹开启，机缘与危险并存', weight: 12, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['古修洞府出世', '秘境百年一开', '海底遗迹浮现', '空中楼阁显形'] },
  { category: 'heritage', name: '前辈传承', description: '得到前辈高人指点或传承玉简', weight: 10, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['梦中得前辈传法', '洞府拾得玉简', '前辈残魂指点', '观壁画悟道'] },
  { category: 'trade', name: '拍卖大会', description: '大型拍卖会、交易会，珍品云集', weight: 8, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['宗门联合拍卖', '坊市年度大拍', '散修私下交易会'] },
  { category: 'combat', name: '擂台比武', description: '宗门擂台、修仙界比武大会', weight: 10, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['宗门年度比武', '跨宗门友谊赛', '修仙界新秀赛'] },
  { category: 'exploration', name: '采灵寻宝', description: '深入险地采集灵草、寻找灵矿', weight: 12, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['深入毒雾谷采药', '海底寻珊瑚', '火山口取火晶', '冰原采雪莲'] },
  { category: 'social', name: '尘缘纠葛', description: '情感纠葛、故人重逢、恩怨清算', weight: 8, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['故人来访', '旧爱重逢', '恩人求助', '仇人现身'] },
  { category: 'inner_demon', name: '道心试炼', description: '道心动摇、心魔侵扰、执念爆发', weight: 8, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['修炼走火入魔', '心魔幻境', '执念难破', '道心拷问'] },

  // ===== 元婴以上 =====
  { category: 'combat', name: '夺宝大战', description: '高阶修士争夺天材地宝，混战爆发', weight: 10, minRealm: 3, maxRealm: 7, minAge: 100, maxAge: 9999, examples: ['灵宝出世群雄逐鹿', '秘境中争夺宝物', '拍卖会后遭截杀'] },
  { category: 'heritage', name: '大能遗府', description: '探索大能前辈留下的洞府，机缘与考验', weight: 8, minRealm: 3, maxRealm: 7, minAge: 100, maxAge: 9999, examples: ['元婴前辈遗府', '化神老怪坐化之地', '上古仙人遗迹'] },
  { category: 'trial', name: '雷劫前夕', description: '渡劫前的准备与天象异变', weight: 8, minRealm: 3, maxRealm: 7, minAge: 100, maxAge: 9999, examples: ['天象异变', '道友提醒渡劫', '闭关备战雷劫'] },
  { category: 'social', name: '收徒传道', description: '高境界收徒、传承道统', weight: 6, minRealm: 3, maxRealm: 7, minAge: 100, maxAge: 9999, examples: ['偶遇良材收为徒', '宗门委托授业', '点化有缘人'] },

  // ===== 通用 =====
  { category: 'cultivation', name: '闭关参悟', description: '闭关参悟功法、磨砺境界', weight: 14, minRealm: 1, maxRealm: 7, minAge: 12, maxAge: 9999, examples: ['闭关参悟功法', '观天地悟道', '磨砺心境', '参悟阵法'] },
  { category: 'cultivation', name: '突破前夜', description: '修为将满，酝酿突破的关键时刻', weight: 10, minRealm: 1, maxRealm: 7, minAge: 12, maxAge: 9999, examples: ['修为圆满待破', '心魔试炼前夕', '突破前兆'] },
  { category: 'trade', name: '炼器寻材', description: '为炼器、炼丹寻找材料', weight: 8, minRealm: 1, maxRealm: 7, minAge: 12, maxAge: 9999, examples: ['寻炼器灵材', '求炼丹辅药', '找阵法材料'] },
  { category: 'social', name: '师门任务', description: '宗门指派的任务，完成可获贡献', weight: 10, minRealm: 1, maxRealm: 6, minAge: 12, maxAge: 9999, requireFaction: true, examples: ['宗门指派任务', '师门差遣', '代师传讯'] },
];

// ==================== 角色主动意图系统 (Task 20 - 解决角色太蠢) ====================

// 角色根据自身处境生成的"主动意图"——AI 必须在事件中体现这些意图的执行
// 例：即将宗门比赛 → "备战比赛"意图 → AI 应让角色主动准备武器、炼丹、请教
export interface CharacterIntent {
  id: string;
  type: 'prepare_combat' | 'gather_resources' | 'seek_mentor' | 'avoid_danger' | 'resolve_thread'
        | 'cultivate_diligently' | 'explore_opportunity' | 'socialize' | 'trade' | 'breakthrough';
  title: string;          // 意图标题（如"备战宗门比武"）
  description: string;    // 意图描述（指导 AI 如何在事件中体现）
  priority: number;       // 优先级 1-10（10 最高）
  relatedThreadId?: string; // 关联的未决线索 id（若有）
}

// ==================== 未决线索系统 (Task 20 - 解决 AI 记忆丢失) ====================

// 持久化的"未决线索"——重要剧情线索会被记录并在后续推进/到期触发
// 例："三个月后宗门比武"、"仇敌王某誓要报复"、"师门委托炼丹"
export interface PendingThread {
  id: string;
  title: string;             // 线索标题
  description: string;       // 线索描述（人/事/时/地/因）
  category: 'competition' | 'enemy' | 'quest' | 'promise' | 'mystery' | 'romance' | 'debt' | 'inheritance' | 'exploration';
  startAge: number;          // 触发年龄
  deadlineAge: number;       // 截止年龄（到期必须触发对应事件）
  status: 'pending' | 'urgent' | 'resolved' | 'failed';
  progress: number;          // 0-100 进度
  relatedMemoryIds?: string[]; // 关联的长期记忆
  reward?: string;           // 完成奖励描述
  failureCost?: string;      // 失败代价描述
  dueInSameYear?: boolean;   // 同年内后续：如“三月后”“不久后”“今年比试”，advance 后应追加同岁续写
  followUpHint?: string;     // 后续应如何承接，例如“入仙门比试”“持潮湿玉片再探潮隙浮阁”
  sourceEventTitle?: string; // 来源事件标题，帮助 AI/引擎保持因果
  realmId?: string;          // 若该线索指向秘境，填秘境 id
}

// ==================== 战斗系统 (Task 20) ====================

export interface CombatEnemy {
  id: string;
  name: string;             // 敌人名称
  description: string;       // 敌人描述
  hp: number; maxHp: number;
  attack: number; defense: number; speed: number;
  realm?: string;            // 敌人境界（用于战力参考）
  skills?: { name: string; description: string; cooldown: number; currentCooldown: number }[];
  // 敌人当前意图（AI 生成）：'attack' | 'skill' | 'defend' | 'flee'
  nextAction?: string;
  nextActionDesc?: string;
  drops?: { name: string; chance: number; rarity: string }[];
  // 敌方随身财物：被击败后，未毁掉者会作为战利品结算。
  lootItems?: ItemEntry[];
  lootSpiritStones?: number;
}

export interface CombatRound {
  round: number;
  playerAction: string;       // 玩家行动描述
  playerActionType: 'attack' | 'skill' | 'item' | 'defend' | 'flee' | 'scripture';
  playerDamage?: number;      // 玩家造成的伤害
  playerHeal?: number;        // 玩家回复
  enemyAction?: string;       // 敌人行动描述（可能为空，如玩家逃跑成功）
  enemyActionType?: string;
  enemyDamage?: number;       // 敌人造成的伤害
  narrative: string;          // 本回合叙事
  playerHpAfter: number;
  enemyHpAfter: number;
  playerMpAfter?: number;
}

export interface CombatSession {
  id: string;
  enemies: CombatEnemy[];     // 敌人列表（支持多敌）
  currentEnemyIdx: number;    // 当前攻击的敌人索引
  round: number;              // 当前回合数
  log: CombatRound[];         // 战斗日志
  status: 'ongoing' | 'victory' | 'defeat' | 'fled';
  startAge: number;           // 战斗开始时的年龄
  contextTitle?: string;      // 战斗背景标题
  contextNarrative?: string;  // 战斗背景叙事
  // 玩家战斗属性快照（含装备加成）
  playerHp: number; playerMaxHp: number;
  playerMp: number; playerMaxMp: number;
  playerAttack: number; playerDefense: number; playerSpeed: number;
  // 修真三宝·身神 8 维快照（开打时定下，战斗内不变）—— 让 8 维真正进战斗公式
  playerForce?: number;        // 破势 = attack + spiritualSense*0.12 + comprehension*0.08
  playerGuard?: number;        // 护持 = defense + physicalFoundation*0.16 + soulStrength*0.06
  playerAgility?: number;      // 机变 = speed + spiritualSense*0.10 + luck*0.04
  playerSpiritualSense?: number;
  playerSoulStrength?: number;
  playerPhysicalFoundation?: number;
  playerLuck?: number;
  playerComprehension?: number;
  // 玩家可用的法术/法宝（从 equipped 提取）
  playerSkills?: { name: string; description: string; mpCost: number; power: number }[];
  // 玩家可用的丹药（从 inventory 的 consumable 提取）
  playerItems?: { itemId: string; name: string; description: string; effect: string }[];
  // 战斗胜利后掉落（由 AI 在结束叙事中给出，引擎在 endCombat 中应用）
  victoryDrops?: ItemEntry[];
  // Task 22: 心魔试炼战斗的胜负心魔值变化（仅心魔战设置）
  victoryHeartDemonDelta?: number;
  defeatHeartDemonDelta?: number;
  // Task 22: 是否为心魔试炼战斗（用于战斗结束后特殊结算）
  isHeartDemonTrial?: boolean;
  // ===== Task 23 新增 =====
  // 参战灵宠快照（含 hp/attack/defense/speed/skill 与当前 cooldown）
  // 战斗中灵宠每回合自动追加一次攻击（伤害为玩家 attack 的 30-50%）
  petCombatant?: {
    id: string;
    name: string;
    species: string;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    skillName: string;
    skillDesc: string;
    skillPower: number;
    skillCooldown: number;
    currentCooldown: number;
    element: string;
  };
  // Task 23: 符箓效果临时状态（本回合减伤、本回合敌人眩晕等）
  talismanDefenseActive?: number;  // 本回合减伤数值
  enemyStunned?: boolean;          // 敌人本回合是否被镇符眩晕
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
  // 注意：来源条目（cultivationFactors）由引擎权威计算，AI 不可输出；
  // AI 只需在 cultivationInsight 文本中引用 prompt 注入的准确数字即可
  cultivationInsight?: string;

  // 是否触发选择节点
  hasChoice: boolean;
  choice?: ChoicePrompt;

  // 是否触发突破。AI 只能提出突破请求，具体突破层数由引擎按因果与数值校验。
  triggeredBreakthrough?: boolean;
  // 连破/大幅突破由头：若 AI 想让角色一次连破多层或跨大境界，必须给出足够具体的原因。
  breakthroughReason?: string;
  // AI 希望突破到的目标小层（1 基显示层数）；引擎会按资质、修为、由头强弱限制。
  breakthroughTargetLevel?: number;
  // AI 希望突破到的目标大境界；没有充分由头时引擎会拒绝跨大境界。
  breakthroughTargetRealm?: Realm;
  // 合理特殊突破时，AI 可提议境界画像覆盖；引擎会校验并限制倍率/层数。
  realmProfilePatch?: RealmProfile;

  // 同一岁内的补充事件文本，用于把复杂年份拆成多段史册记录，避免一段叙事过长或漏写关键过程。
  extraEvents?: { title: string; narrative: string; eventType?: AIEventOutput['eventType'] }[];

  // 是否死亡
  causedDeath?: boolean;
  deathReason?: string;

  // 是否飞升
  causedAscension?: boolean;

  // ===== Task 20 新增 =====
  // AI 添加新的未决线索（如"三个月后宗门比武""仇敌誓要报复"）
  newThreads?: PendingThread[];
  // AI 推进现有线索的进度（id + 进度增量）
  advanceThreads?: { id: string; progressDelta: number; note?: string }[];
  // AI 标记完成的线索 id 列表
  completeThreadIds?: string[];
  // AI 标记失败的线索 id 列表（如错过 deadline）
  failThreadIds?: string[];
  // AI 触发战斗（eventType='combat' 时必须给出）
  triggerCombat?: {
    enemies: CombatEnemy[];
    contextTitle: string;
    contextNarrative: string;
    // 战斗胜利后 AI 给出的掉落物品（endCombat 时应用）
    victoryDrops?: ItemEntry[];
    // 战斗失败的代价（如死亡、重伤、被夺宝）
    defeatCost?: string;
    // Task 22: 心魔试炼战斗的胜负心魔值变化（仅心魔战设置）
    victoryHeartDemonDelta?: number;
    defeatHeartDemonDelta?: number;
    isHeartDemonTrial?: boolean;
  };
  // ===== Task 23 新增 =====
  // AI 授予玩家灵宠（如收服妖兽幼崽、前辈相赠、灵宠店购买）
  newPets?: Pet[];
  // ===== Phase-α 批 1 α-1/α-2 新增（可选） =====
  // AI 可感知角色当前是否处于「首次大境界突破」或「连破失败」语境，给出劫难叙事触发提示
  // 引擎据此在 tryBreakthrough 时联动 computeTribulationOutcome 判定下场
  // 可填 'first_major_breakthrough' | 'consecutive_failed_breakthrough' | null
  tribulationTrigger?: 'first_major_breakthrough' | 'consecutive_failed_breakthrough' | null;
  // AI 在叙事中点出本轮因杀生/屠戮/滥杀等产生的杀业时，可填一句「杀业因由」（引擎不强制解析）
  // 仅用于 engine 在审计时把叙事与 sin 累加对齐
  sinReason?: string;
  // ===== Phase-α 批 2 α-5 新增：法宝养灵 =====
  // AI 在 narrative 自然产生「心血祭炼/神识交流/器灵苏醒」时输出 nurtureOutput；
  // 引擎 addNurtureProgress 自动累加（delta 限幅 [0..10]/事件）并判定跨 stage。
  // itemId 优先；若缺则按 itemName 在 inventory/equipped 中精确匹配。
  // awakenedName 仅在跨越 sentient 阶段（首次启智）时由引擎落定为该次名字。
  nurtureOutput?: Array<{
    itemId?: string;
    itemName: string;
    delta: number;
    reason: string;
    awakenedName?: string;
  }>;
  // ===== Phase-α 批 1 α-4 功法三段（经/诀/神通）=====
  // AI 在 narrative 自然产生「精熟运转 / 参悟法意 / 推演下一阶 / 与另一经融合」时输出 scriptureProgress；
  // 引擎 addScriptureProgress 自动累加（delta 限幅 [0..30]/条 / 事件），跨段自动落 stage + awakeningHook。
  // itemId 优先；若缺则按 itemName 在 inventory/equipped 中精确匹配 scripture。
  // reason 用于跨段时落 scriptureAwakeningHook（≤80 字），便于 detail 弹窗展示因由。
  scriptureProgress?: Array<{
    itemId?: string;
    itemName: string;
    expDelta: number;
    reason: string;
  }>;
  // ===== Phase-α 批 2 α-7 新增：灵田 / 灵植 / 物候 =====
  // AI 在 narrative 自然产生「翻土/抽薹/采收/落霜」事件时按 schema 给出 gardenOutput
  // 引擎 addGardenZone / harvestZone / atmosphere 微调，由 advanceGarden 兜底到期采收
  // - action: 'plant'(播种/翻土新一块) / 'tend'(照料既有 zone，仅追加 atmosphere 注释) / 'harvest'(采收)
  // - zoneId: 仅 tend/harvest 用；plant 不需要；harvest 缺省时自动采首个到期 zone
  // - seed: 仅 plant 用；中文种子名（凝元草/玉髓芝/九幽兰/血藤等）
  // - quality: 仅 plant 用；灵土品质 0..100（默认 50）
  // - note: 自然叙出"翻土时节气 + 气机 + 物候"短描述（≤80 字；引擎自动落 atmosphere）
  gardenOutput?: Array<{
    action: 'plant' | 'harvest' | 'tend';
    zoneId?: string;
    seed?: string;
    quality?: number;
    note: string;
  }>;
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
  // 选择结果后若仍需玩家继续决定（如拍卖会出价），可继续挂起下一段抉择。
  nextChoice?: ChoicePrompt;
  removedItemIds?: string[];
  newEquippedItems?: ItemEntry[];
  equipItemIds?: string[];
  unequipItemIds?: string[];
  memory: string;
  // 修炼心得（同 AIEventOutput；引擎权威计算来源条目，AI 只输出文本）
  cultivationInsight?: string;
  causedDeath?: boolean;
  deathReason?: string;
  // ===== Task 20 新增 =====
  newThreads?: PendingThread[];
  advanceThreads?: { id: string; progressDelta: number; note?: string }[];
  completeThreadIds?: string[];
  failThreadIds?: string[];
  triggerCombat?: {
    enemies: CombatEnemy[];
    contextTitle: string;
    contextNarrative: string;
    victoryDrops?: ItemEntry[];
    defeatCost?: string;
  };
  // ===== Task 23 新增 =====
  newPets?: Pet[];
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
  // 修炼心得（同 AIEventOutput；accepted=false 时可留空，引擎将保留旧文本；引擎权威计算来源条目）
  cultivationInsight?: string;
  // 干扰可能延迟年龄推进
  ageAdvance?: number;            // 干扰消耗的时间（岁），默认 0
  // ===== Task 20 新增 =====
  newThreads?: PendingThread[];
  advanceThreads?: { id: string; progressDelta: number; note?: string }[];
  completeThreadIds?: string[];
  failThreadIds?: string[];
  // 干扰可能触发战斗（如玩家主动攻击某人、闯入妖兽领地）
  triggerCombat?: {
    enemies: CombatEnemy[];
    contextTitle: string;
    contextNarrative: string;
    victoryDrops?: ItemEntry[];
    defeatCost?: string;
  };
  // ===== Task 23 新增 =====
  newPets?: Pet[];
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
    // 修真三宝（引擎派生：神识/魂魄/体魄——境界提升与时间累积自然增长）
    spiritualSense: number;
    soulStrength: number;
    physicalFoundation: number;
    // 神魂境界（未凝神 / 灵感初萌 / 神识初成 / 神魂稳固 / 元神出窍 / 元神显化 / 神意通玄）
    soulRealmName: string;
    soulRealmRank: number;
    soulRealmGap: string;
    // 战斗投影（破势/护持/机变）—— 由 attack/defense/speed + 三宝派生
    combatProjection?: {
      force: number;
      guard: number;
      agility: number;
      spiritualAwareness: number;
      soulStability: number;
      bodyTenacity: number;
      summary: string;
      advantages: string[];
      vulnerabilities: string[];
    };
    spiritStones: number; reputation: number;
    faction: string; master: string; location: string;
    alive: boolean; ascended: boolean;
    // Task 22: 心魔值（0-100）——AI 可读取，可用 changes 中 attribute='heartDemon' 调整
    heartDemon: number;
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
  recentEvents: { age: number; title: string; narrative: string; eventType: string }[];
  longTermMemory: string[];
  completedFateNodes: number[];
  // 引擎能力告知
  availableAttributes: string[];   // AI 可改的属性列表
  nextFateNode?: { index: number; name: string; realm: string };
  // ===== Task 20 新增 =====
  // 本轮事件蓝图主题（引擎抽取，AI 必须围绕此主题生成事件）
  blueprint?: EventBlueprint;
  // 未决线索列表（AI 必须保持连续性；deadlineAge 临近的标记为 urgent）
  pendingThreads: PendingThread[];
  // 角色主动意图（AI 应在事件中体现意图的执行）
  characterIntents: CharacterIntent[];
  // 最近 5 次事件类型（用于避免重复，AI 不得连续生成同类事件）
  recentEventTypes: string[];
  // 最近 3 次蓝图分类（避免连续同类主题）
  recentBlueprintCategories: string[];
  // ===== Task 23 新增 =====
  // 灵宠列表（AI 可读取玩家拥有的灵宠，并据此生成事件/触发灵宠技能）
  pets: Pet[];
  // ===== Task 24 新增 =====
  // 秘境探索记录（AI 可读取玩家已探秘境 + 冷却状态，避免重复推荐）
  exploredRealms: ExplorationRecord[];
  // 当前正在探索的秘境（仅 explore route 调用时设置，让 AI 围绕此秘境生成探索事件）
  currentExploration?: SecretRealm;
  discoveredRealms?: SecretRealm[];
  // ===== Phase-α 批 2 α-7：灵田 / 节气（AI 可在 narrative 自然产出翻土/抽薹/采收事件） =====
  spiritGarden: { zones: SpiritGardenZone[] };
  // 当前节气（中文：立春/惊蛰/.../大寒）—— 与 age % 24 对应；让 AI 按时序推进
  solarTerm: string;
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
  // 境界画像：默认境界体系基础上的 AI/奇遇覆盖显示与强度信息
  realmProfile?: RealmProfile;
  // ===== Phase-Y 八维神魂派生字段（来自 publish） =====
  // 修炼属性条目（神识/魂魄/体魄等）
  cultivationAttributes?: CultivationAttributeEntry[];
  // 神识 / 魂魄 / 体魄 三宝
  spiritualSense?: number;
  soulStrength?: number;
  physicalFoundation?: number;
  // 神魂境界元数据
  soulRealmName?: string;
  soulRealmRank?: number;
  soulRealmGap?: string;
  // 境界特性（与 REALM_TRAITS 默认合并后）
  realmTraits?: RealmTraits;
  // 战斗投影（破势/护持/机变 + 神识/魂魄/体魄）
  combatProjection?: CombatProjectionTraits;
  longTermMemory: string[];
  // ===== Task 20 新增 =====
  // 未决线索列表（重要剧情线索，会在后续推进/到期触发）
  pendingThreads: PendingThread[];
  // 角色主动意图（引擎根据处境生成，AI 必须在事件中体现）
  characterIntents: CharacterIntent[];
  // 进行中的战斗（若有；持久化以支持页面刷新恢复）
  combatSession: CombatSession | null;
  // ===== Task 22 新增 =====
  // 心魔值 0-100：杀生/邪修/未解执念会增加；静修/净化物品/岁月流逝会减少
  // 30+ 修炼速度 -10%；60+ 偶发心魔试炼战斗；90+ 走火入魔风险（突死/重伤）
  heartDemon: number;
  // ===== Task 23 新增 =====
  // 灵宠列表（Pet[]）—— 玩家收服的灵宠
  pets: Pet[];
  // ===== Task 24 新增 =====
  // 秘境探索记录（ExplorationRecord[]）—— 玩家探索过的秘境 + 冷却追踪
  exploredRealms: ExplorationRecord[];
  discoveredRealms?: SecretRealm[]; // 从未决线索/物品/事件中解析出的剧情秘境

  // ===== Phase-α 批 1 α-1/α-2 新增 =====
  // 天劫档案：每个大境界的劫难史 + 最近一次结果
  tribulationProfile: TribulationProfile;
  // 因果业力：善恶连续值（-1..+1），默认 0；极端值影响部分天劫判定与 AI 反馈
  karma: number;
  // 功德累计（救/渡/济等正向业）
  merit: number;
  // 杀业累计（杀生/屠戮等负向业）
  sin: number;

  // ===== Phase-α 批 2 α-7 新增：灵田 / 灵植 / 物候 =====
  // 角色灵田：zones[] —— AI 在 narrative 自然产出"翻土/抽薹/采收/落霜"事件时注册
  // 引擎按节气推进，到期自动采收入 addItems 入口（统一物品清单）
  // 旧角色没 spiritGarden 字段 → 默认 { zones: [] }
  spiritGarden: { zones: SpiritGardenZone[] };
}

// ==================== Phase-α 批 2 α-7：灵田 / 24 节气 / 物候 ====================

// 游戏时间投影（用于灵田节气绑定）
// 当前游戏是整数岁推进（age 是整数），节气与岁对应：age % 24 映射到 1..24 节气
// 用 GameTime 把"何时播种/何时可收"以节气名锚定，避免暴露机制词（"cron/YYYY-MM-DD"）
// eraName/calendarYear 来自 advance-preload 的 worldTime stamp 投影；缺省时不阻塞，仅记 age
export interface GameTime {
  age: number;                  // 游戏内年龄（岁，整数推进）
  solarTerm?: string;           // 当前节气（中文：立春/惊蛰/.../大寒）；缺省时引擎按 age % 24 推算
  eraName?: string;             // 仙历名（如"青岚仙历"），用于"青岚仙历 5005 年惊蛰"叙事投影
  calendarYear?: number;        // 仙历年号
}

// 24 节气（中文修仙物候用词）—— 顺序按春夏秋冬；1=立春, ..., 24=大寒
// 修真叙事中以"节气"作为"天地气机节点"，灵植成熟/翻土/落霜皆与之对应
export const TWENTY_FOUR_SOLAR_TERMS: readonly string[] = [
  '立春',   // 1
  '雨水',   // 2
  '惊蛰',   // 3
  '春分',   // 4
  '清明',   // 5
  '谷雨',   // 6
  '立夏',   // 7
  '小满',   // 8
  '芒种',   // 9
  '夏至',   // 10
  '小暑',   // 11
  '大暑',   // 12
  '立秋',   // 13
  '处暑',   // 14
  '白露',   // 15
  '秋分',   // 16
  '寒露',   // 17
  '霜降',   // 18
  '立冬',   // 19
  '小雪',   // 20
  '大雪',   // 21
  '冬至',   // 22
  '小寒',   // 23
  '大寒',   // 24
];

// 节气名 → 序号 1..24；用于节气排序与"距收获节气数"计算
export const SOLAR_TERM_INDEX: Record<string, number> = Object.fromEntries(
  TWENTY_FOUR_SOLAR_TERMS.map((name, idx) => [name, idx + 1])
);

// 节气季节（春夏秋冬）—— 用于灵田物候叙事（"正值暮春/盛夏/深秋"）
export const SOLAR_TERM_SEASON: Record<string, 'spring' | 'summer' | 'autumn' | 'winter'> = {
  '立春': 'spring', '雨水': 'spring', '惊蛰': 'spring', '春分': 'spring', '清明': 'spring', '谷雨': 'spring',
  '立夏': 'summer', '小满': 'summer', '芒种': 'summer', '夏至': 'summer', '小暑': 'summer', '大暑': 'summer',
  '立秋': 'autumn', '处暑': 'autumn', '白露': 'autumn', '秋分': 'autumn', '寒露': 'autumn', '霜降': 'autumn',
  '立冬': 'winter', '小雪': 'winter', '大雪': 'winter', '冬至': 'winter', '小寒': 'winter', '大寒': 'winter',
};

// 灵田中的一块地 —— AI 自然产出"翻土/播种"时由引擎注册；到期自动采收
export interface SpiritGardenZone {
  id: string;                              // 唯一 id（zone_<随机6位>）
  seed: string;                            // 种子名（中文：凝元草/玉髓芝/九幽兰/血藤等，AI 在 narrative 自然给出）
  seededAt: GameTime;                      // 播种时的游戏时间（节气锚定）
  expectedHarvestAt: GameTime;             // 预计可采收的游戏时间（节气锚定）
  quality: number;                         // 灵土品质 0..100（影响产出物品 rarity 与数量；AI 在 narrative 自然给出）
  atmosphere: string;                      // 灵田气机描述（自由文本："灵气充沛/伴妖兽残息/灵脉上游"等，AI 在 narrative 自然给出）
}

// 天劫档案（α-1）
export interface TribulationProfile {
  // 最近一次渡劫时的年龄
  lastTribulationAge?: number;
  // 最近一次渡劫的目标境界
  lastTribulationTargetRealm?: Realm;
  // 最近一次渡劫的结果描述
  lastTribulationResult?: string;
  // 历次渡劫史（成功淬体 / 失败跌境 / 陨落 / 跳过……）
  tribulationHistory: TribulationHistoryEntry[];
}

export interface TribulationHistoryEntry {
  age: number;
  targetRealm: Realm;
  result: 'passed_with_refinement' | 'passed_barely' | 'failed_fall_realm' | 'failed_fatal' | 'skipped';
  // 引擎侧附加：进入新境界的淬体加成（attack/defense/hp/mp 等）
  refinementBonus?: { maxHp?: number; maxMp?: number; attack?: number; defense?: number; speed?: number };
  // 因果残响：karma 在劫难时的偏移
  karmaShift?: number;
  // 一句因果描述
  reason?: string;
}

// ==================== Task 21: 阵法系统 ====================

export type FormationType =
  | 'spirit_gathering'  // 聚灵阵：增加修炼速度
  | 'protection'        // 护体阵：增加防御
  | 'concealment'       // 迷踪阵：增加气运/避敌
  | 'killing'           // 杀阵：增加攻击（战斗中生效）
  | 'illusion'          // 幻阵：影响敌人命中率
  | 'fire'              // 火阵：火属性加成
  | 'water'             // 水阵：水属性加成
  | 'wood'              // 木阵：木属性加成
  | 'metal'             // 金阵：金属性加成
  | 'earth';            // 土阵：土属性加成

export interface Formation {
  id: string;
  name: string;             // 阵法名（如"小聚灵阵""九宫护体阵"）
  type: FormationType;
  description: string;       // 阵法描述
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  // 阵法效果（激活后应用到角色）
  effects: {
    target_attribute: string;
    operation: 'add' | 'multiply';
    value: number;
    description: string;
  }[];
  // 激活所需条件
  requirements: {
    minRealm?: string;       // 最低境界
    minComprehension?: number; // 最低悟性
    spiritStoneCost?: number;  // 每岁维持灵石消耗
  };
  // 阵盘物品 id（对应的 tool 类物品）
  formationDiskItemId?: string;
  // 是否已激活
  active: boolean;
}

// ==================== Task 23: 灵宠系统 ====================

// 灵宠物种——参考《凡人修仙传》修仙世界常见灵宠
export type PetSpecies =
  | 'fox'          // 灵狐：幻术、敏捷
  | 'wolf'         // 灵狼：攻击、群战
  | 'snake'        // 灵蛇：毒术、阴狠
  | 'turtle'       // 灵龟：防御、长寿
  | 'eagle'        // 灵鹰：飞行、侦察
  | 'ape'          // 灵猿：力量、近战
  | 'spider'       // 灵蛛：织网、陷阱
  | 'butterfly'    // 灵蝶：迷幻、辅助
  | 'fish'         // 灵鱼：水系、灵动
  | 'tiger'        // 灵虎：威压、暴击
  | 'phoenix'      // 火凤：火系、复活
  | 'dragon';      // 幼龙：全能、稀有

export interface Pet {
  id: string;
  name: string;              // 灵宠名（玩家或 AI 起名）
  species: PetSpecies;       // 物种
  description: string;       // 描述
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  realm: Realm;              // 灵宠境界（决定基础属性）
  // 战斗属性
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  // 五行倾向（影响战斗属性与技能）
  element: 'metal' | 'wood' | 'water' | 'fire' | 'earth';
  // 情感状态
  loyalty: number;           // 忠诚度 0-100（低于 30 可能逃离）
  satiety: number;           // 饱食度 0-100（低于 30 忠诚度下降加速）
  // 成长
  level: number;             // 灵宠等级（喂养/战斗可提升）
  exp: number;               // 当前经验
  expToLevel: number;        // 升级所需经验
  // 来源
  sourceAcquired: string;    // 如何获得（"收服于青云山""前辈相赠"等）
  acquiredAge: number;       // 获得时的年龄
  // 主动技能（每只灵宠一个主动技能，参战时使用）
  skill: {
    name: string;            // 技能名（如"幻影分身""毒雾""烈焰冲击"）
    description: string;     // 技能描述
    power: number;           // 技能威力倍率（1.0=普通攻击等价）
    cooldown: number;        // 冷却回合数
  };
}

// 灵宠物种 → 默认属性模板
export const PET_SPECIES_TEMPLATES: Record<PetSpecies, {
  name: string;
  defaultElement: 'metal' | 'wood' | 'water' | 'fire' | 'earth';
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  skillName: string;
  skillDesc: string;
  skillPower: number;
  skillCooldown: number;
}> = {
  fox:      { name: '灵狐',   defaultElement: 'water', baseHp: 60,  baseAttack: 12, baseDefense: 4,  baseSpeed: 18, skillName: '幻影分身', skillDesc: '化出数道幻影迷惑敌人', skillPower: 1.5, skillCooldown: 3 },
  wolf:     { name: '灵狼',   defaultElement: 'metal', baseHp: 80,  baseAttack: 16, baseDefense: 6,  baseSpeed: 14, skillName: '狼群围猎', skillDesc: '召唤同伴围攻敌人', skillPower: 1.8, skillCooldown: 4 },
  snake:    { name: '灵蛇',   defaultElement: 'wood',  baseHp: 50,  baseAttack: 14, baseDefense: 3,  baseSpeed: 12, skillName: '毒雾吐息', skillDesc: '喷吐毒雾持续伤害', skillPower: 1.4, skillCooldown: 3 },
  turtle:   { name: '灵龟',   defaultElement: 'water', baseHp: 120, baseAttack: 8,  baseDefense: 14, baseSpeed: 6,  skillName: '玄甲护主', skillDesc: '为玩家挡下伤害', skillPower: 1.0, skillCooldown: 3 },
  eagle:    { name: '灵鹰',   defaultElement: 'metal', baseHp: 55,  baseAttack: 15, baseDefense: 4,  baseSpeed: 20, skillName: '俯冲利爪', skillDesc: '从空中俯冲攻击要害', skillPower: 1.7, skillCooldown: 3 },
  ape:      { name: '灵猿',   defaultElement: 'earth', baseHp: 100, baseAttack: 18, baseDefense: 8,  baseSpeed: 10, skillName: '巨力猛砸', skillDesc: '巨力猛砸造成重创', skillPower: 2.0, skillCooldown: 4 },
  spider:   { name: '灵蛛',   defaultElement: 'wood',  baseHp: 45,  baseAttack: 11, baseDefense: 5,  baseSpeed: 13, skillName: '蛛网束缚', skillDesc: '吐蛛网束缚敌人减速', skillPower: 1.2, skillCooldown: 3 },
  butterfly:{ name: '灵蝶',   defaultElement: 'wood',  baseHp: 40,  baseAttack: 7,  baseDefense: 3,  baseSpeed: 16, skillName: '迷幻花粉', skillDesc: '散布花粉让敌人迷乱', skillPower: 0.8, skillCooldown: 2 },
  fish:     { name: '灵鱼',   defaultElement: 'water', baseHp: 65,  baseAttack: 10, baseDefense: 5,  baseSpeed: 15, skillName: '水刃冲击', skillDesc: '水刃冲击敌人', skillPower: 1.3, skillCooldown: 2 },
  tiger:    { name: '灵虎',   defaultElement: 'fire',  baseHp: 95,  baseAttack: 17, baseDefense: 7,  baseSpeed: 13, skillName: '虎威震慑', skillDesc: '虎威震慑降低敌人攻击', skillPower: 1.5, skillCooldown: 4 },
  phoenix:  { name: '火凤',   defaultElement: 'fire',  baseHp: 110, baseAttack: 20, baseDefense: 8,  baseSpeed: 17, skillName: '涅槃烈焰', skillDesc: '烈焰焚烧一切', skillPower: 2.2, skillCooldown: 5 },
  dragon:   { name: '幼龙',   defaultElement: 'metal', baseHp: 150, baseAttack: 22, baseDefense: 12, baseSpeed: 16, skillName: '龙息吐息', skillDesc: '龙息横扫战场', skillPower: 2.5, skillCooldown: 5 },
};

// ==================== Task 23: 符箓系统 ====================

// 符箓子类型——单次使用、即时生效的战斗道具
// 复用 item_type='consumable'，通过 effects 中的 target_attribute 区分
export type TalismanType =
  | 'talisman_attack'    // 攻击符：直接对敌人造成伤害
  | 'talisman_defense'   // 防御符：本回合减伤
  | 'talisman_heal'      // 治疗符：回复 HP
  | 'talisman_escape'    // 遁逃符：高概率逃跑
  | 'talisman_stun';     // 镇压符：让敌人本回合无法行动

export const TALISMAN_TYPE_LABEL: Record<TalismanType, string> = {
  talisman_attack: '攻符',
  talisman_defense: '防符',
  talisman_heal: '疗符',
  talisman_escape: '遁符',
  talisman_stun: '镇符',
};

// ==================== Task 24: 秘境探索系统 ====================
// 参考《凡人修仙传》修仙界常见秘境——玩家可主动选择探索，触发独特事件链

export type SecretRealmTier =
  | 'common'      // 凡境秘境：低难度，普通奖励
  | 'uncommon'    // 灵境秘境：中低难度
  | 'rare'        // 玄境秘境：中等难度，稀有奖励
  | 'epic'        // 仙境秘境：高难度，史诗奖励
  | 'legendary'   // 圣境秘境：极高难度，传说奖励
  | 'mythic';     // 混沌秘境：顶级难度，神话奖励

export interface SecretRealm {
  id: string;                  // 唯一 id
  name: string;                // 秘境名（如"万妖谷""幽冥古道"）
  description: string;         // 秘境描述（外观、传说、特性）
  tier: SecretRealmTier;       // 秘境品级
  // 进入条件
  minRealm: number;            // 最低境界 idx（0=mortal, 1=qi_refining...）
  minAge: number;              // 最低年龄
  spiritStoneCost: number;     // 进入所需灵石；剧情秘境通常为 0，普通游历可作路费/护身符
  discoveredByThreadId?: string; // 剧情秘境来源线索；有值时只在对应线索/物品存在时显示
  entryRequirement?: string;     // 入境前置，如“潮湿玉片”“水禁钥纹”“宗门令牌”
  entryAlternatives?: string[];  // 其他可行入境方式，避免只有买钥匙一条路
  isStoryRealm?: boolean;        // 是否为剧情中发现的秘境
  // 探索特性
  dangerLevel: number;         // 危险度 1-10（影响战斗触发率/伤害）
  rewardMultiplier: number;    // 奖励倍率（影响物品稀有度/数量）
  cooldownYears: number;       // 探索冷却（多少年后可再探）
  // 秘境主题/事件类型倾向
  themeTags: string[];         // 主题标签（指导 AI 生成事件）：['beast','inheritance','illusion','lightning','blood','undead','dragon','ancient']
  elementAffinity?: 'metal' | 'wood' | 'water' | 'fire' | 'earth';  // 五行亲和（影响奖励五行倾向）
  // 探索结果倾向（AI 应参考）
  encounterHints: string[];    // 探索可能遭遇的灵感样例
  // 视觉
  color: string;               // 主色调（UI 卡片用）
  icon: string;                // 图标 emoji
}

// 秘境池——参考《凡人修仙传》修仙界地理设定
export const SECRET_REALMS: SecretRealm[] = [
  // ===== 凡人/炼气期可探 =====
  {
    id: 'wan_yao_gu',
    name: '万妖谷外围',
    description: '青云山东麓一处妖兽聚集之地，常有低阶妖兽出没，散修趋之若鹜求取妖丹兽皮。',
    tier: 'common',
    minRealm: 1, minAge: 12, spiritStoneCost: 5,
    dangerLevel: 3, rewardMultiplier: 1.0, cooldownYears: 3,
    themeTags: ['beast', 'combat', 'material'],
    elementAffinity: 'wood',
    encounterHints: ['遭遇独狼妖兽', '发现灵草丛生', '拾得前人遗骨', '听见妖兽吼叫'],
    color: '#84cc16', icon: '🐺',
  },
  {
    id: 'ling_yao_lin',
    name: '灵药密林',
    description: '终年云雾缭绕的密林，传闻有上古灵药遗种，亦有毒虫猛兽守护。',
    tier: 'uncommon',
    minRealm: 1, minAge: 14, spiritStoneCost: 10,
    dangerLevel: 4, rewardMultiplier: 1.3, cooldownYears: 4,
    themeTags: ['material', 'beast', 'herb'],
    elementAffinity: 'wood',
    encounterHints: ['采得百年灵芝', '毒蛇拦路', '迷雾中迷失方向', '遇同行采药人'],
    color: '#16a34a', icon: '🌿',
  },
  // ===== 筑基期可探 =====
  {
    id: 'you_ming_gu_dao',
    name: '幽冥古道',
    description: '一条通往幽冥的废弃古道，阴气森森，鬼修与不死生物游荡其间。',
    tier: 'rare',
    minRealm: 2, minAge: 30, spiritStoneCost: 30,
    dangerLevel: 6, rewardMultiplier: 1.6, cooldownYears: 5,
    themeTags: ['undead', 'inheritance', 'ghost'],
    elementAffinity: 'water',
    encounterHints: ['遭遇鬼修', '拾得阴属性功法', '冥河畔遇故人残魂', '阴煞之气侵体'],
    color: '#0ea5e9', icon: '💀',
  },
  {
    id: 'shang_gu_yi_ji',
    name: '上古修士遗迹',
    description: '上古修士坐化后留下的洞府，机关重重，亦有传承玉简与遗宝。',
    tier: 'rare',
    minRealm: 2, minAge: 35, spiritStoneCost: 50,
    dangerLevel: 6, rewardMultiplier: 1.8, cooldownYears: 6,
    themeTags: ['inheritance', 'trap', 'treasure'],
    encounterHints: ['触发阵法机关', '拾得玉简传承', '前辈残魂指点', '宝物现世引发争抢'],
    color: '#a855f7', icon: '🏛',
  },
  {
    id: 'xue_se_jin_di',
    name: '血色禁地',
    description: '一片血色迷雾笼罩的禁地，传闻为上古大战之地，杀气未散，机缘与杀机并存。',
    tier: 'epic',
    minRealm: 2, minAge: 40, spiritStoneCost: 80,
    dangerLevel: 8, rewardMultiplier: 2.2, cooldownYears: 8,
    themeTags: ['combat', 'blood', 'murderous', 'treasure'],
    elementAffinity: 'fire',
    encounterHints: ['遭遇魔修', '血气入体增心魔', '血池中拾得血魂丹', '与同入禁地者火并'],
    color: '#dc2626', icon: '🩸',
  },
  // ===== 金丹期可探 =====
  {
    id: 'long_mai_mi_jing',
    name: '龙脉秘境',
    description: '一处天地龙脉交汇之地，灵气浓郁至极，传闻有龙族遗宝与龙血草。',
    tier: 'epic',
    minRealm: 3, minAge: 100, spiritStoneCost: 200,
    dangerLevel: 7, rewardMultiplier: 2.5, cooldownYears: 10,
    themeTags: ['dragon', 'inheritance', 'spiritual_energy'],
    elementAffinity: 'earth',
    encounterHints: ['龙脉灵气灌体', '遇龙族后裔', '拾得龙血草', '龙吟震慑心神'],
    color: '#fbbf24', icon: '🐲',
  },
  {
    id: 'tai_xu_huan_jing',
    name: '太虚幻境',
    description: '存在于虚幻与现实夹缝中的奇异空间，进入者会经历心境试炼，亦可能获得心法传承。',
    tier: 'epic',
    minRealm: 3, minAge: 120, spiritStoneCost: 250,
    dangerLevel: 8, rewardMultiplier: 2.4, cooldownYears: 12,
    themeTags: ['illusion', 'heart_demon', 'inheritance'],
    encounterHints: ['幻境中重见故人', '道心拷问', '破幻得心法', '心魔试炼'],
    color: '#c084fc', icon: '🌫',
  },
  // ===== 元婴+ =====
  {
    id: 'lei_chi_jin_di',
    name: '雷池禁地',
    description: '一片终年雷电交加的禁地，雷属性至宝与雷劫残余之力并存，金丹以下入内必死。',
    tier: 'legendary',
    minRealm: 4, minAge: 200, spiritStoneCost: 500,
    dangerLevel: 9, rewardMultiplier: 3.0, cooldownYears: 15,
    themeTags: ['lightning', 'trial', 'treasure'],
    elementAffinity: 'metal',
    encounterHints: ['雷池淬体', '拾得雷属性至宝', '雷劫残余伤体', '雷电中参悟雷法'],
    color: '#facc15', icon: '⚡',
  },
  {
    id: 'xian_mo_gu_zhan_chang',
    name: '仙魔古战场',
    description: '上古仙魔大战之地，残留仙魔气息与未消散的杀机，顶级法宝与传承皆在其中。',
    tier: 'mythic',
    minRealm: 4, minAge: 300, spiritStoneCost: 1000,
    dangerLevel: 10, rewardMultiplier: 4.0, cooldownYears: 20,
    themeTags: ['ancient', 'combat', 'inheritance', 'blood'],
    encounterHints: ['仙魔残魂争夺宝物', '拾得仙器残片', '魔气入体', '仙魔大战重演'],
    color: '#7c3aed', icon: '⚔',
  },
];

// 探索结果记录（用于冷却追踪）
export interface ExplorationRecord {
  realmId: string;
  lastExploredAge: number;     // 上次探索时的角色年龄
  timesExplored: number;       // 累计探索次数
  bestReward?: string;         // 最佳奖励描述（AI 给出）
}

// ==================== Phase-Z: 世界长期事实 / 任务索引 / 事件调度 ====================
// 这些类型由 event-scheduler.ts 等修真感连续性模块共享。
// 设计原则：修真叙事优先，类型字段保持中立（id/title/reason 等），
// 调用方在 reason/summary 中使用中文修仙口吻，禁止暴露"概率/算法/字段名"等机制词。

// WorldFact: 世界中已确认的长期事实（地点/势力/秘境/事件/NPC 关系/物品/传说）
export type WorldFactKind =
  | 'location'   // 地点：坊市/洞府/宗门等
  | 'faction'    // 势力：宗门/家族/商帮/魔门
  | 'realm'      // 秘境：洞府/遗迹/灵脉/险境
  | 'event'      // 大事件：拍卖/比试/劫难等已发生事件余波
  | 'npc'        // 重要人物：非 pendingThread 而已落定的 NPC 印记
  | 'relationship' // 人际关系：师徒/盟友/仇怨等长期关系
  | 'item'       // 重要物品：长期身份标识的物品
  | 'lore';      // 传说/典故/预言

export interface WorldFact {
  id: string;
  kind: WorldFactKind;
  title: string;            // 事实标题（中文：青岚坊市/黑鸦会/旧洞府铜钥）
  summary: string;          // 事实摘要（中文叙事口吻）
  confidence?: number;      // 确认度 0-1（默认 0.6）
  firstSeenAge?: number;    // 首次被记录时的角色年龄
  lastSeenAge?: number;     // 最近被回响的角色年龄
  source?: string;          // 来源：auction/auction-bid/smoke/ai 等
  tags?: string[];          // 标签：market/auction/hostile/danger/realm-hint/event-consequence 等
}

// QuestEntry: 由 pendingThread 规范化而来的"任务索引"，便于调度器排序与投影
export interface QuestEntry {
  id: string;
  title: string;
  summary?: string;
  kind?: 'quest' | 'enemy' | 'mystery' | 'competition' | 'promise' | 'inheritance' | 'exploration' | 'romance' | 'debt';
  stage?: 'open' | 'escalating' | 'cooling' | 'background' | 'resolved' | 'failed';
  progress?: number;        // 0-100
  startedAtAge?: number;
  dueAge?: number;
  urgency?: number;         // 0-100 调度权重
  sourceThreadId?: string;
  currentHook?: string;     // 修真叙事钩子（中文）
  rewardHint?: string;      // 完成可能所得
  failureHint?: string;     // 错失代价
  tags?: string[];
}

// ScheduleHintKind: 调度项分类
export type ScheduleHintKind =
  | 'quest'      // 任务线索
  | 'npc'        // 人物/势力自主倾向
  | 'world'      // 世界事实/地点/秘境
  | 'faction'    // 势力画像
  | 'location'   // 地点画像
  | 'echo'       // 因果回响/旧怨余波
  | 'opportunity'; // 机遇/机缘

// ScheduleHint: 调度器对 AI 的具体承接建议
export interface ScheduleHint {
  id: string;               // 唯一 id（格式 seh_<kind>_<refId>）
  kind: ScheduleHintKind;
  title: string;            // 承接标题（中文）
  reason: string;           // 承接原因（修真叙事口吻；含"余波/记忆潮汐/地点画像/势力画像/追责/承接不足"等关键词）
  priority: number;         // 0-100 调度优先级
  requiredAction?: string;  // AI 应如何承接：advance | resolve | fail | defer | echo | carryover | echo_or_develop
  resolutionStage?: 'open' | 'escalating' | 'cooling' | 'background' | 'resolved' | 'failed';
  resolutionHint?: string;  // 修真叙事结算提示（"完成则……"或"失败则……"）
  sourceThreadId?: string;
  relatedFactIds?: string[];
  relatedNpcIds?: string[];
}

// ScheduleFocus: 调度器最强建议（AI 必须承接或解释为何暂缓）
export interface ScheduleFocus {
  id: string;
  kind: ScheduleHintKind;
  title: string;
  reason: string;
  priority: number;          // 通常 ≥ 60
  requiredAction?: string;
}

// PressureMap: 世界压力与机会舆图
export type PressureEventType = '威胁回响' | '势力施压' | '机缘推进' | '秘境异动' | '日常回响';

export interface PressureMap {
  topThreat: string;          // 当前最大威胁（NPC/势力/事件名）
  topOpportunity: string;      // 当前最大机会（地点/机缘/人物）
  focalLocation: string;       // 焦点地点（坊市/洞府/秘境）
  focalActor: string;          // 焦点人物/势力
  likelyEventTypes: PressureEventType[];  // 事件倾向（修真叙事口吻）
  summary: string;            // 一句话中文修真叙事（"最大威胁：……；最大机会：……；事件倾向：……"）
}

// EventSchedule: 调度器完整输出（注入到 state.eventSchedule 供 AI 与审计使用）
export interface EventSchedule {
  generatedAtAge: number;
  focus: ScheduleFocus | null;
  hints: ScheduleHint[];
  pressureMap: PressureMap | null;
  warnings: string[];          // 修真叙事警告（"承接不足……"等）
}

// EventSchedulerPlan: 调度器对外返回的轻量结构
export interface EventSchedulerPlan {
  focus: ScheduleFocus | null;
  hints: ScheduleHint[];
  pressureMap: PressureMap | null;
  warnings: string[];
}

// NarrativeContractFeedback: AI 上轮的叙事契约自报，调度器用于"记忆潮汐"调整
export interface NarrativeContractFeedback {
  age: number;
  title?: string;
  narrativeFocus?: string;
  narrativeOutcome?: 'advanced' | 'resolved' | 'deferred' | 'complicated' | 'ignored' | string;
  focusHintId?: string;
  focusHintTitle?: string;
  usedNpcIds?: string[];
  usedScheduleHintIds?: string[];
  usedWorldFactIds?: string[];
  topThreat?: string;
  topOpportunity?: string;
  warningCodes?: string[];
}

