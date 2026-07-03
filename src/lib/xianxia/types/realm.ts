// 修仙模拟器 - 核心引擎类型定义

// 基于"引擎权威 + AI 提议"混合架构

// Task 20: 事件蓝图 / 角色意图 / 未决线索 / 战斗系统



// ==================== 境界系统 ====================



export type Realm =

  | 'mortal'           // 凡人

  | 'qi_refining'      // 炼气

  | 'foundation'       // 筑基

  | 'foundation_building' // 筑基(旧)

  | 'soul_formation'   // 结丹(旧)

  | 'golden_core'      // 金丹

  | 'nascent_soul'     // 元婴

  | 'spirit_severing'  // 化神

  | 'great_vehicle'    // 大乘

  | 'mahayana'         // 大乘(旧)

  | 'deity_transformation' // 神化(旧)

  | 'void_refinement'  // 虚炼(旧)

  | 'unity'            // 合一(旧)

  | 'tribulation'      // 渡劫

  | 'ascension';       // 飞升




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




export interface RealmInfo {

  id: Realm;

  name: string;

  shortName: string;

  levels: number;

  baseLifespan: number;

  expPerLevel: number;

  color: string;

  description: string;

}




// Realm profile override for special cultivation paths.

export interface RealmProfile {

  name?: string;         // 显示名称，如「练气四十二层」「九转金丹」「完美筑基」

  shortName?: string;    // 境界球单字/短名

  color?: string;

  maxLevel?: number;     // 当前境界的显示层数上限，允许如练气999层

  powerMultiplier?: number; // 强度倍率，仅在合理范围内影响战斗/属性展示

  expMultiplier?: number;   // 突破/升层修为需求倍率

  reason?: string;       // 叙事因果

  traits?: Partial<RealmTraits>;

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

    description: '感应天地灵气，引气入体，迈入修仙门槛。寿元一百二十载，可习低阶功法和简单术式。',

  },

  {

    id: 'foundation',

    name: '筑基期',

    shortName: '基',

    levels: 9,

    baseLifespan: 200,

    expPerLevel: 600,

    color: '#22c55e',

    description: '凝聚道基，可御器飞行，可用古宝、丹药、阵法辅助修行。寿元二百载，筑基修士在修仙界已算一方势力。',

  },

  {

    id: 'golden_core',

    name: '金丹期',

    shortName: '丹',

    levels: 9,

    baseLifespan: 500,

    expPerLevel: 1800,

    color: '#eab308',

    description: '金丹大成，寿元五百载，神通初显，可开辟洞府、收徒立派。金丹修士是各大势力的骨干。',

  },

  {

    id: 'nascent_soul',

    name: '元婴期',

    shortName: '婴',

    levels: 9,

    baseLifespan: 1000,

    expPerLevel: 5400,

    color: '#f97316',

    description: '元婴出窍，神通大成，寿元千载，可移山填海、炼制傀儡、布置大阵。元婴修士已是世人眼中的神仙人物。',

  },

  {

    id: 'spirit_severing',

    name: '化神期',

    shortName: '化',

    levels: 9,

    baseLifespan: 2000,

    expPerLevel: 16200,

    color: '#ef4444',

    description: '化神入道，寿元两千载，可局部操控天地法则，举手投足可灭一方修士。化神修士已是传说。',

  },

  {

    id: 'great_vehicle',

    name: '大乘期',

    shortName: '乘',

    levels: 9,

    baseLifespan: 5000,

    expPerLevel: 48600,

    color: '#a855f7',

    description: '大乘圆满，寿元五千载，可操控时间流速，一念可定凡间兴亡。此境距渡劫仅一步之遥。',

  },

  {

    id: 'tribulation',

    name: '渡劫期',

    shortName: '劫',

    levels: 1,

    baseLifespan: 10000,

    expPerLevel: 100000,

    color: '#ec4899',

    description: '天劫降临，生死考验，过则飞升成仙，败则形神俱灭。渡劫是修仙路上最凶险的一关，十不存一。',

  },

  {

    id: 'ascension',

    name: '飞升',

    shortName: '仙',

    levels: 0,

    baseLifespan: 99999,

    expPerLevel: 999999,

    color: '#fbbf24',

    description: '超脱凡俗，飞升仙界，与天地同寿，与日月同辉。仙界之事，非下界修士所能揣测。',

  },

];






export const REALM_TRAITS: Record<Realm, RealmTraits> = {

  mortal: {

    cultivationMode: '\u5c1a\u672a\u5f15\u6c14\uff0c\u4ee5\u751f\u8ba1\u3001\u6839\u9aa8\u6253\u78e8\u548c\u5bfb\u89c5\u4ed9\u7f18\u4e3a\u4e3b',

    bottleneck: '\u4e0d\u8bc6\u7075\u673a\uff0c\u96be\u8fa8\u4ed9\u7269\u771f\u4ef7\uff0c\u53d7\u51e1\u4fd7\u75c5\u75db\u4e0e\u751f\u8ba1\u6240\u56f0',

    breakthroughTrial: '\u9700\u5f97\u7075\u6839\u663e\u5316\u3001\u5f15\u8def\u4e4b\u4eba\u6216\u771f\u6b63\u5165\u9053\u673a\u7f18',

    capabilities: ['\u51e1\u4fd7\u8c0b\u751f', '\u6c5f\u6e56\u6b66\u827a', '\u8fa8\u8bc6\u7c97\u6d45\u4ed9\u7f18'],

    limitations: ['\u4e0d\u80fd\u81ea\u4e3b\u9a71\u4f7f\u6cd5\u5668', '\u96be\u4ee5\u8fa8\u8bc6\u9ad8\u9636\u7075\u7269', '\u5bff\u5143\u4e0e\u75be\u75c5\u675f\u7f1a\u660e\u663e'],

    worldAccess: ['\u51e1\u4fd7\u6751\u9547', '\u6c5f\u6e56\u95e8\u6d3e', '\u4f4e\u9891\u4ed9\u7f18\u4f20\u95fb'],

    socialWeight: '\u5728\u4fee\u58eb\u773c\u4e2d\u8fd1\u4e4e\u51e1\u5c18\uff0c\u4f46\u5947\u6839\u9aa8\u6216\u5947\u7269\u53ef\u5f15\u6765\u5173\u6ce8',

    combatStyle: ['\u4f53\u529b\u640f\u6740', '\u501f\u7269\u8131\u8eab', '\u4f9d\u9760\u4ed6\u4eba\u5e87\u62a4'],

    resourceNeeds: ['\u5165\u9053\u529f\u6cd5', '\u542f\u7075\u4e4b\u7269', '\u5b89\u8eab\u4e4b\u6240'],

    riskTags: ['\u75be\u75c5', '\u9965\u5bd2', '\u88ab\u4fee\u58eb\u6ce2\u53ca'],

  },

  qi_refining: {

    cultivationMode: '\u5f15\u6c14\u5165\u4f53\uff0c\u7a33\u5b9a\u6cd5\u529b\u5faa\u73af\uff0c\u4ee5\u4f4e\u9636\u529f\u6cd5\u3001\u7075\u77f3\u3001\u7b26\u7b93\u548c\u4e39\u836f\u4e3a\u8981',

    bottleneck: '\u6cd5\u529b\u6d45\u8584\uff0c\u795e\u8bc6\u521d\u840c\u4e14\u96be\u957f\u65f6\u95f4\u5916\u653e',

    breakthroughTrial: '\u9700\u6253\u901a\u5468\u5929\u3001\u5f97\u5408\u9002\u529f\u6cd5\u540e\u7eed\u4e0e\u7b51\u57fa\u673a\u7f18',

    capabilities: ['\u4f7f\u7528\u4f4e\u9636\u7b26\u7b93', '\u77ed\u65f6\u9a71\u4f7f\u4f4e\u9636\u6cd5\u5668', '\u8fa8\u8bc6\u5e38\u89c1\u7075\u7269'],

    limitations: ['\u4e0d\u5b9c\u957f\u9014\u5fa1\u5668\u6a2a\u884c', '\u96be\u7834\u9ad8\u9636\u7981\u5236', '\u6613\u53d7\u7b51\u57fa\u4ee5\u4e0a\u795e\u8bc6\u538b\u5236'],

    worldAccess: ['\u4f4e\u9636\u574a\u5e02', '\u5b97\u95e8\u5916\u95e8', '\u5c0f\u578b\u7075\u5730', '\u51e1\u4fd7\u4e0e\u4fee\u884c\u8fb9\u754c'],

    socialWeight: '\u521d\u5165\u4fee\u884c\u8005\uff0c\u51e1\u4eba\u773c\u4e2d\u5df2\u6709\u4ed9\u5bb6\u5a01\u4eea\uff0c\u9ad8\u9636\u4fee\u58eb\u773c\u4e2d\u4ecd\u5c5e\u540e\u8f88',

    combatStyle: ['\u7b26\u7b93\u8bd5\u63a2', '\u4f4e\u9636\u6cd5\u5668\u62a4\u8eab', '\u501f\u5730\u5f62\u9000\u907f'],

    resourceNeeds: ['\u7075\u77f3', '\u805a\u6c14\u4e39', '\u5165\u95e8\u529f\u6cd5\u540e\u7eed', '\u7b51\u57fa\u4e39\u7ebf\u7d22'],

    riskTags: ['\u7075\u529b\u67af\u7aed', '\u529f\u6cd5\u4e0d\u5408', '\u88ab\u9ad8\u9636\u795e\u8bc6\u9501\u5b9a'],

  },

  foundation: {

    cultivationMode: '\u9053\u57fa\u521d\u6210\uff0c\u6cd5\u529b\u51dd\u5b9e\uff0c\u4ee5\u7a33\u56fa\u9053\u57fa\u3001\u795e\u8bc6\u521d\u653e\u548c\u6d1e\u5e9c\u7ecf\u8425\u4e3a\u8981',

    bottleneck: '\u9053\u57fa\u7a33\u56fa\u5ea6\u3001\u529f\u6cd5\u540e\u7eed\u4e0e\u7ed3\u4e39\u8d44\u6e90\u7f3a\u53e3',

    breakthroughTrial: '\u9700\u7ed3\u4e39\u56e0\u7f18\u3001\u4e39\u836f\u3001\u5fc3\u6027\u4e0e\u9053\u57fa\u6210\u8272\u76f8\u5408',

    capabilities: ['\u7a33\u5b9a\u5fa1\u5668\u8fdc\u884c', '\u795e\u8bc6\u63a2\u67e5\u5468\u8eab', '\u5f00\u8f9f\u6216\u7ecf\u8425\u6d1e\u5e9c'],

    limitations: ['\u96be\u9a7e\u9a6d\u672c\u547d\u6cd5\u5b9d', '\u91d1\u4e39\u7981\u5236\u4ecd\u96be\u786c\u7834', '\u957f\u9014\u6597\u6cd5\u8017\u635f\u660e\u663e'],

    worldAccess: ['\u5b97\u95e8\u6838\u5fc3\u5916\u56f4', '\u6d1e\u5e9c\u7ecf\u8425', '\u79d8\u5883\u5916\u5c42', '\u7b51\u57fa\u574a\u5e02'],

    socialWeight: '\u5df2\u7b97\u4f4e\u9636\u9aa8\u5e72\uff0c\u70bc\u6c14\u4fee\u58eb\u591a\u6709\u5fcc\u60ee\uff0c\u5c0f\u5b97\u95e8\u5f00\u59cb\u91cd\u89c6',

    combatStyle: ['\u5fa1\u5668\u6597\u6cd5', '\u795e\u8bc6\u9884\u5224', '\u62a4\u4f53\u7075\u5149\u7ef4\u6301'],

    resourceNeeds: ['\u7ed3\u4e39\u7075\u7269', '\u9ad8\u9636\u529f\u6cd5\u540e\u7eed', '\u6d1e\u5e9c\u7075\u8109', '\u7a33\u56fa\u9053\u57fa\u7684\u4e39\u836f'],

    riskTags: ['\u9053\u57fa\u53d7\u635f', '\u795e\u8bc6\u53cd\u566c', '\u7ed3\u4e39\u5931\u8d25'],

  },

  golden_core: {

    cultivationMode: '\u91d1\u4e39\u6210\u5c31\uff0c\u4ee5\u4e39\u706b\u3001\u672c\u547d\u6cd5\u5b9d\u96cf\u5f62\u548c\u91d1\u4e39\u54c1\u9636\u4e3a\u6838\u5fc3',

    bottleneck: '\u91d1\u4e39\u6210\u8272\u3001\u672c\u547d\u6cd5\u5b9d\u796d\u70bc\u4e0e\u7ed3\u5a74\u673a\u7f18',

    breakthroughTrial: '\u9700\u7834\u4e39\u6210\u5a74\uff0c\u8d44\u6e90\u3001\u5fc3\u9b54\u3001\u795e\u9b42\u6210\u8272\u7f3a\u4e00\u4e0d\u53ef',

    capabilities: ['\u796d\u70bc\u672c\u547d\u6cd5\u5b9d\u96cf\u5f62', '\u4ee5\u4e39\u706b\u70bc\u7269\u6216\u5bf9\u654c', '\u795e\u8bc6\u538b\u5236\u4f4e\u9636\u4fee\u58eb'],

    limitations: ['\u5143\u5a74\u79d8\u672f\u5c1a\u4e0d\u53ef\u8f7b\u7528', '\u9ad8\u9636\u5927\u80fd\u4ecd\u53ef\u78be\u538b', '\u91d1\u4e39\u53d7\u635f\u4ee3\u4ef7\u6781\u5927'],

    worldAccess: ['\u9ad8\u9636\u62cd\u5356\u4f1a', '\u5b97\u95e8\u9547\u5b88\u4e4b\u4f4d', '\u91d1\u4e39\u79d8\u5883', '\u5c0f\u5b97\u95e8\u6743\u529b\u5c42'],

    socialWeight: '\u53ef\u9547\u4e00\u65b9\u3001\u88ab\u62c9\u62e2\u6216\u5fcc\u60ee\uff0c\u4e5f\u66f4\u5bb9\u6613\u88ab\u56f4\u6740\u593a\u5b9d',

    combatStyle: ['\u672c\u547d\u6cd5\u5b9d\u96cf\u5f62', '\u4e39\u706b\u711a\u70bc', '\u9635\u6cd5\u4e0e\u6cd5\u5b9d\u8054\u52a8'],

    resourceNeeds: ['\u672c\u547d\u6cd5\u5b9d\u6750\u6599', '\u7ed3\u5a74\u7075\u7269', '\u795e\u9b42\u6e29\u517b\u4e4b\u7269'],

    riskTags: ['\u4e39\u6bc1\u9053\u6d88', '\u5fc3\u9b54\u52ab', '\u88ab\u9ad8\u9636\u4fee\u58eb\u730e\u6740'],

  },

  nascent_soul: {

    cultivationMode: '\u5143\u5a74\u51dd\u6210\uff0c\u795e\u9b42\u4e0e\u6cd5\u529b\u76f8\u5408\uff0c\u4ee5\u5143\u5a74\u79d8\u672f\u3001\u795e\u8bc6\u8fdc\u6e38\u548c\u8089\u8eab\u5b89\u5426\u4e3a\u8981',

    bottleneck: '\u5143\u5a74\u7a33\u56fa\u3001\u8089\u8eab\u4e0e\u795e\u9b42\u7684\u4e92\u76f8\u627f\u8f7d\uff0c\u4ee5\u53ca\u5316\u795e\u5951\u673a',

    breakthroughTrial: '\u9700\u795e\u9b42\u8db3\u4ee5\u627f\u53d7\u5929\u5730\u5143\u6c14\u538b\u529b\uff0c\u5426\u5219\u6613\u88ab\u53cd\u566c\u6216\u5c01\u7981',

    capabilities: ['\u5143\u5a74\u51fa\u7a8d\u6216\u9065\u611f', '\u8089\u8eab\u6bc1\u574f\u540e\u6709\u673a\u4f1a\u9041\u9003', '\u9ad8\u9636\u795e\u8bc6\u79d8\u672f'],

    limitations: ['\u5143\u5a74\u79bb\u4f53\u98ce\u9669\u6781\u9ad8', '\u593a\u820d\u6216\u8f6c\u4fee\u5fc5\u987b\u6709\u5f3a\u56e0\u679c', '\u754c\u9762\u538b\u529b\u5df2\u5f00\u59cb\u663e\u5316'],

    worldAccess: ['\u5927\u80fd\u4ea4\u6613\u4f1a', '\u7a7a\u95f4\u7981\u5236', '\u5b97\u95e8\u5174\u8870\u4e4b\u4e89', '\u5143\u5a74\u79d8\u5e9c'],

    socialWeight: '\u5df2\u662f\u5927\u80fd\u4e4b\u5217\uff0c\u4e00\u4e3e\u4e00\u52a8\u8db3\u4ee5\u6539\u53d8\u5c0f\u52bf\u529b\u683c\u5c40',

    combatStyle: ['\u795e\u8bc6\u91cd\u538b', '\u5143\u5a74\u79d8\u672f', '\u8089\u8eab\u4e0e\u5143\u5a74\u53cc\u5c42\u98ce\u9669'],

    resourceNeeds: ['\u6e29\u517b\u5143\u5a74\u4e4b\u7269', '\u7a7a\u95f4\u7075\u6750', '\u5316\u795e\u5951\u673a'],

    riskTags: ['\u5143\u5a74\u88ab\u5c01', '\u593a\u820d\u5931\u8d25', '\u8089\u8eab\u6bc1\u635f'],

  },

  spirit_severing: {

    cultivationMode: '\u795e\u610f\u4e0e\u5929\u5730\u5143\u6c14\u76f8\u5e94\uff0c\u4ee5\u6cd5\u5219\u96cf\u5f62\u3001\u56e0\u679c\u538b\u529b\u548c\u795e\u9b42\u7a33\u56fa\u4e3a\u8981',

    bottleneck: '\u795e\u9b42\u627f\u538b\u3001\u5929\u5730\u5143\u6c14\u5951\u5408\u4e0e\u754c\u9762\u6392\u65a5',

    breakthroughTrial: '\u9700\u7a33\u4f4f\u5143\u795e\u4e0e\u6cd5\u5219\u96cf\u5f62\uff0c\u4e0d\u53ef\u5c06\u6cd5\u5219\u4e4b\u529b\u5f53\u4f5c\u968f\u624b\u6280\u827a',

    capabilities: ['\u611f\u5e94\u6cd5\u5219\u96cf\u5f62', '\u957f\u8ddd\u79bb\u795e\u5ff5\u63a2\u67e5', '\u6539\u53d8\u5c40\u90e8\u5929\u5730\u5143\u6c14\u6d41\u52bf'],

    limitations: ['\u4e0d\u53ef\u968f\u610f\u6539\u5199\u5929\u5730\u6cd5\u5219', '\u9ad8\u9636\u51fa\u624b\u4f1a\u7559\u4e0b\u660e\u663e\u56e0\u679c', '\u4f4e\u9636\u5730\u754c\u96be\u627f\u957f\u65f6\u95f4\u5a01\u538b'],

    worldAccess: ['\u9ad8\u9636\u79d8\u5e02', '\u6cd5\u5219\u9057\u8ff9', '\u754c\u9762\u88c2\u9699', '\u5927\u80fd\u540c\u76df\u6216\u730e\u6740'],

    socialWeight: '\u884c\u8d70\u4e00\u65b9\u5373\u4f1a\u88ab\u5927\u52bf\u529b\u8bb0\u5f55\uff0c\u975e\u5e38\u4eba\u80fd\u5ffd\u89c6',

    combatStyle: ['\u5929\u5730\u5143\u6c14\u538b\u5236', '\u795e\u5ff5\u9501\u654c', '\u6cd5\u5219\u96cf\u5f62\u4f59\u6ce2'],

    resourceNeeds: ['\u6cd5\u5219\u611f\u609f', '\u754c\u9762\u7ebf\u7d22', '\u7a33\u9b42\u4e4b\u7269'],

    riskTags: ['\u754c\u9762\u6392\u65a5', '\u56e0\u679c\u53cd\u566c', '\u795e\u9b42\u88c2\u75d5'],

  },

  great_vehicle: {

    cultivationMode: '\u9053\u884c\u8fd1\u5706\uff0c\u4ee5\u754c\u9762\u538b\u529b\u3001\u98de\u5347\u901a\u9053\u548c\u9053\u7edf\u627f\u8d1f\u4e3a\u4e3b',

    bottleneck: '\u754c\u9762\u5bb9\u7eb3\u3001\u98de\u5347\u5951\u673a\u4e0e\u4e00\u8eab\u56e0\u679c\u6e05\u7b97',

    breakthroughTrial: '\u9700\u5e94\u5bf9\u754c\u9762\u7275\u5f15\u4e0e\u5929\u5730\u56e0\u679c\uff0c\u4e0d\u5b9c\u518d\u7528\u4f4e\u9636\u4e8b\u4ef6\u6a21\u5f0f\u63a8\u8fdb',

    capabilities: ['\u7275\u52a8\u5929\u5730\u6c14\u673a', '\u5f00\u8f9f\u6216\u5bfb\u89c5\u98de\u5347\u901a\u9053', '\u5e03\u7f6e\u957f\u671f\u9053\u7edf\u540e\u624b'],

    limitations: ['\u51fa\u624b\u4ee3\u4ef7\u6781\u5927', '\u4e0d\u5e94\u9891\u7e41\u6ecb\u6270\u4f4e\u9636\u5c18\u4e16', '\u53d7\u5929\u52ab\u4e0e\u754c\u9762\u76d1\u89c6'],

    worldAccess: ['\u98de\u5347\u901a\u9053', '\u5927\u80fd\u9053\u7edf\u4e89\u593a', '\u754c\u9762\u8fb9\u7f18', '\u5929\u52ab\u5e03\u7f6e'],

    socialWeight: '\u5df2\u8d8a\u51fa\u5bfb\u5e38\u52bf\u529b\u683c\u5c40\uff0c\u4e00\u5ff5\u53ef\u6210\u4f20\u8bf4\u6216\u5927\u7978',

    combatStyle: ['\u9053\u7edf\u540e\u624b', '\u754c\u9762\u6c14\u673a\u7275\u5236', '\u5929\u52ab\u98ce\u9669\u53c2\u4e0e\u6597\u6cd5'],

    resourceNeeds: ['\u98de\u5347\u4fe1\u7269', '\u754c\u9762\u8282\u70b9', '\u6e05\u7b97\u56e0\u679c\u7684\u5951\u673a'],

    riskTags: ['\u5929\u52ab', '\u754c\u9762\u538b\u529b', '\u9053\u7edf\u53cd\u566c'],

  },

  tribulation: {

    cultivationMode: '\u8eab\u5904\u52ab\u6570\uff0c\u4e00\u5207\u4fee\u884c\u90fd\u56f4\u7ed5\u6e21\u52ab\u3001\u56e0\u679c\u6e05\u7b97\u4e0e\u98de\u5347\u51c6\u5907',

    bottleneck: '\u5929\u52ab\u5f3a\u5ea6\u3001\u8089\u8eab\u627f\u8f7d\u3001\u795e\u9b42\u7a33\u56fa\u548c\u4e00\u751f\u56e0\u679c',

    breakthroughTrial: '\u6e21\u52ab\u5373\u4e3a\u6838\u5fc3\u8bd5\u70bc\uff0c\u6210\u5219\u98de\u5347\uff0c\u8d25\u5219\u8eab\u6b7b\u9053\u6d88\u6216\u7559\u4e0b\u4f59\u6ce2',

    capabilities: ['\u8c03\u52a8\u6bd5\u751f\u9053\u884c\u5e94\u52ab', '\u7559\u4e0b\u4f20\u627f\u540e\u624b', '\u4ee5\u52ab\u6570\u6539\u5199\u4e16\u754c\u8bb0\u5fc6'],

    limitations: ['\u96be\u4ee5\u9003\u907f\u6838\u5fc3\u52ab\u6570', '\u51fa\u624b\u4f1a\u7275\u52a8\u5929\u52ab\u63d0\u524d', '\u4e0d\u5b9c\u518d\u5c40\u9650\u4e8e\u4f4e\u9636\u4e89\u6597'],

    worldAccess: ['\u5929\u52ab\u4e4b\u5730', '\u98de\u5347\u524d\u7684\u9053\u7edf\u6e05\u7b97', '\u4e16\u754c\u9057\u54cd'],

    socialWeight: '\u4e3e\u4e16\u77a9\u76ee\uff0c\u6210\u8d25\u90fd\u4f1a\u6210\u4e3a\u540e\u4e16\u4f20\u8bf4\u6216\u7981\u5730\u6839\u6e90',

    combatStyle: ['\u5e94\u52ab\u62a4\u9053', '\u5929\u96f7\u4f59\u6ce2', '\u4e34\u7ec8\u6216\u98de\u5347\u4e4b\u6218'],

    resourceNeeds: ['\u6e21\u52ab\u5927\u9635', '\u62a4\u9053\u4e4b\u7269', '\u4e00\u751f\u56e0\u679c\u4e86\u7ed3'],

    riskTags: ['\u5929\u52ab\u964d\u4e34', '\u8eab\u6b7b\u9053\u6d88', '\u9057\u54cd\u53cd\u566c'],

  },

  ascension: {

    cultivationMode: '\u5df2\u8d85\u8131\u6b64\u754c\u5e38\u89c4\u4fee\u884c\uff0c\u4ee5\u4ed9\u8def\u9057\u54cd\u3001\u9053\u7edf\u4f20\u627f\u548c\u540e\u4e16\u56de\u54cd\u4e3a\u4e3b',

    bottleneck: '\u4e0d\u518d\u4ee5\u6b64\u754c\u5c0f\u5883\u754c\u8861\u91cf',

    breakthroughTrial: '\u6b64\u5883\u4e0d\u5e94\u518d\u751f\u6210\u5e38\u89c4\u7a81\u7834',

    capabilities: ['\u6210\u4e3a\u4e16\u754c\u4f20\u8bf4', '\u9057\u7559\u9053\u7edf\u79cd\u5b50', '\u5f71\u54cd\u540e\u4e16\u4ed9\u7f18'],

    limitations: ['\u4e0d\u5e94\u4ee5\u51e1\u754c\u5e38\u89c4\u4e8b\u4ef6\u8ffd\u6f14', '\u4e0d\u518d\u4ee5\u666e\u901a\u80cc\u5305\u6216\u574a\u5e02\u8d44\u6e90\u4f5c\u4e3a\u6838\u5fc3'],

    worldAccess: ['\u4ed9\u8def\u4f20\u8bf4', '\u540e\u4e16\u9057\u8ff9', '\u4f20\u627f\u6c60'],

    socialWeight: '\u5728\u6b64\u754c\u5df2\u662f\u4f20\u8bf4\u4e0e\u9057\u54cd',

    combatStyle: ['\u4e0d\u4ee5\u5e38\u89c4\u6597\u6cd5\u8bb0\u5f55'],

    resourceNeeds: ['\u4f20\u627f\u843d\u70b9', '\u4e16\u754c\u9057\u54cd\u627f\u63a5'],

    riskTags: ['\u9057\u54cd\u88ab\u66f2\u89e3', '\u9053\u7edf\u5931\u4f20'],

  },

  // ===== Phase-M\uff1a\u4ee5\u4e0b\u4e3a\u522b\u540d/\u65e7\u79f0\uff08\u4fdd\u6301 REALM_TRAITS \u8986\u76d6 Realm union \u5168\u96c6\uff09 =====

  foundation_building: {

    cultivationMode: '\u4e0e foundation \u540c\u4e49\u65e7\u79f0',

    bottleneck: '\u540c foundation',

    breakthroughTrial: '\u540c foundation',

    capabilities: [], limitations: [], worldAccess: [], socialWeight: '', combatStyle: [], resourceNeeds: [], riskTags: [],

  },

  soul_formation: {

    cultivationMode: '\u4e0e golden_core \u540c\u4e49\u65e7\u79f0',

    bottleneck: '\u540c golden_core',

    breakthroughTrial: '\u540c golden_core',

    capabilities: [], limitations: [], worldAccess: [], socialWeight: '', combatStyle: [], resourceNeeds: [], riskTags: [],

  },

  mahayana: {

    cultivationMode: '\u4e0e great_vehicle \u540c\u4e49\u65e7\u79f0',

    bottleneck: '\u540c great_vehicle',

    breakthroughTrial: '\u540c great_vehicle',

    capabilities: [], limitations: [], worldAccess: [], socialWeight: '', combatStyle: [], resourceNeeds: [], riskTags: [],

  },

  deity_transformation: {

    cultivationMode: '\u5316\u795e\u4e4b\u4e0a\u7684\u795e\u8f6c\u4e4b\u5883',

    bottleneck: '\u795e\u8f6c\u540e\u9700\u91cd\u5851\u9053\u679c',

    breakthroughTrial: '\u5929\u9053\u53cd\u54fa\u4e0e\u795e\u6027\u955c\u8bd5',

    capabilities: [], limitations: [], worldAccess: [], socialWeight: '', combatStyle: [], resourceNeeds: [], riskTags: [],

  },

  void_refinement: {

    cultivationMode: '\u865a\u7a7a\u4e2d\u7ec3\u9b42\u4e0e\u9053\u679c',

    bottleneck: '\u865a\u7a7a\u5fc3\u9b42\u754c\u9650',

    breakthroughTrial: '\u865a\u7a7a\u98ce\u9769\u4e0e\u5fc3\u9b42\u91cd\u5851',

    capabilities: [], limitations: [], worldAccess: [], socialWeight: '', combatStyle: [], resourceNeeds: [], riskTags: [],

  },

  unity: {

    cultivationMode: '\u4e0e\u9053\u5408\u4e00\u4e4b\u5883',

    bottleneck: '\u4e0e\u9053\u5408\u4e00\u540e\u9700\u786e\u8ba4\u672c\u4f53',

    breakthroughTrial: '\u9053\u6212\u53cd\u54fa',

    capabilities: [], limitations: [], worldAccess: [], socialWeight: '', combatStyle: [], resourceNeeds: [], riskTags: [],

  },

};




export function getRealmInfo(realm: Realm): RealmInfo {

  return REALMS.find(r => r.id === realm) || REALMS[0];

}




export function getNextRealm(realm: Realm): Realm | null {

  const idx = REALMS.findIndex(r => r.id === realm);

  if (idx < 0 || idx >= REALMS.length - 1) return null;

  return REALMS[idx + 1].id;

}
