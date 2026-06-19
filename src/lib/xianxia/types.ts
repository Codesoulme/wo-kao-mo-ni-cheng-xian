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

export type WorldNpcAttitude = 'ally' | 'friendly' | 'neutral' | 'hostile' | 'enemy' | 'unknown';

export interface WorldNpc {
  id: string;
  name: string;
  description: string;
  role?: string;
  realm?: string;
  faction?: string;
  attitude: WorldNpcAttitude;
  relationshipScore: number;
  firstMetAge: number;
  lastSeenAge: number;
  lastKnownLocation?: string;
  source: string;
  memory?: string;
  relatedThreadIds?: string[];
  tags?: string[];
}

export type CausalNodeType = 'event' | 'thread' | 'npc' | 'item' | 'status' | 'realm' | 'memory' | 'choice' | 'combat' | 'system';
export type CausalEdgeType = 'created' | 'updated' | 'resolved' | 'failed' | 'mentions' | 'caused' | 'rewards' | 'harms' | 'continues' | 'triggers';

export interface CausalNode {
  id: string;
  type: CausalNodeType;
  label: string;
  age: number;
  refId?: string;
  summary?: string;
  tags?: string[];
}

export interface CausalEdge {
  id: string;
  from: string;
  to: string;
  type: CausalEdgeType;
  age: number;
  summary?: string;
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  updatedAtAge?: number;
}

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
  newNpcs?: Partial<WorldNpc>[];
  causalSummary?: string;
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
}

export interface AttributeChange {
  attribute: string;     // 改变哪个属性
  delta: number;         // 变化量（正或负）
  reason: string;        // 变化原因
}

export type EffectResolveSeverity = 'info' | 'warning' | 'error';

export interface EffectResolveTrace {
  severity: EffectResolveSeverity;
  code: string;
  attribute?: string;
  message: string;
  before?: number;
  delta?: number;
  after?: number;
  source?: string;
}

export interface EffectResolveResult {
  state: CharacterState;
  appliedChanges: AttributeChange[];
  rejectedChanges: AttributeChange[];
  trace: EffectResolveTrace[];
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
  newNpcs?: Partial<WorldNpc>[];
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
  newNpcs?: Partial<WorldNpc>[];
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
  npcs: WorldNpc[];
  causalGraph: CausalGraph;
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
  longTermMemory: string[];
  // ===== Task 20 新增 =====
  // 未决线索列表（重要剧情线索，会在后续推进/到期触发）
  npcs: WorldNpc[];
  causalGraph: CausalGraph;
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

