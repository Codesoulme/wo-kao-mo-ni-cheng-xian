import type { Restriction } from './tribulation-ascension';




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

  // AI-71: 禁制 + 洞府联动

  restrictions?: Restriction[];                 // 秘境入口禁制列表

  requiredRestrictionsPassed?: string[];        // 进入需通过的禁制 id 列表

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


// ==================== Phase-G Worker B: Causal Reinforcement ====================

// AI-G1xx: Secret Realm entry triggers, bidder archetype profiling,

// combat cause chains, and stalemate exit resolution.



/**

 * AI-G111: 进入秘境所需的触发条件类型。

 * 引擎依据角色物品/地图碎片/气潮/传承信物/时间窗等判定是否满足。

 */

export type SecretRealmTriggerCondition =

  | 'key-item'        // 关键物品（如钥匙/令牌/残章）

  | 'map-fragment'    // 地图碎片（多块拼合后可尝试）

  | 'qi-tide'         // 气潮（天地灵气潮汐窗口）

  | 'inheritance-token' // 传承信物（前任主人遗留的印信）

  | 'time-window';    // 时窗（特定季节/时辰才可入）




/**

 * AI-G111: 角色尝试进入某秘境的可行性评估结果。

 * triggers: 已满足的触发条件；missing: 尚未满足的；bypassOptions: 可绕开某些条件的特殊手段。

 */

export interface SecretRealmEntryAttempt {

  realmId: string;

  triggers: SecretRealmTriggerCondition[];

  missing: SecretRealmTriggerCondition[];

  bypassOptions: string[];

  canAttempt: boolean;

}
