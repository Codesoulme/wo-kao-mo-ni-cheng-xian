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
};

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
export type ElementType = Element;

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
  | 'special' | 'constitution' | 'identity' | 'quest' | 'environment';

export type ConstitutionCategory = 'element' | 'combat' | 'social' | 'fate' | 'body' | 'dao';
export type ConstitutionRiskType = 'none' | 'heart_demon' | 'backlash' | 'attention' | 'conflict';

export interface ConstitutionAwakeningStage {
  stage: number;
  name: string;
  minRealm?: Realm;
  minAge?: number;
  triggerHint: string;
  description: string;
  effects?: StatusEffect[];
}

export interface ConstitutionProfile {
  id: string;
  category: ConstitutionCategory;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  elementAffinity?: Element[];
  techniqueKeywords?: string[];
  resonanceTags?: string[];
  currentStage: number;
  maxStage: number;
  awakening?: ConstitutionAwakeningStage[];
  riskType?: ConstitutionRiskType;
  riskHint?: string;
  narrativeHooks?: string[];
}

export interface StatusEntry {
  id: string;
  name: string;
  description: string;
  category: StatusCategory;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  duration: number;  // -1 = 永久, >0 = 剩余年龄数
  source: string;    // 来源描述
  effects: StatusEffect[];
  constitution?: ConstitutionProfile;
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

export interface PetBondAIOutcome {
  name: string;
  species: PetSpecies;
  description: string;
  rarity: Pet['rarity'];
  element: Pet['element'];
  hp: number; attack: number; defense: number; speed: number;
  loyalty: number; satiety: number;
  sourceAcquired: string;
  skill: Pet['skill'];
  traits?: string[];
  passiveHint?: string;
  narrative: string;
}

export interface PetCareAIOutcome {
  satietyDelta: number;
  loyaltyDelta: number;
  expDelta: number;
  levelDelta?: number;
  attackDelta?: number;
  defenseDelta?: number;
  maxHpDelta?: number;
  narrative: string;
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
  sourceEventTitle?: string; // 源事件标题，帮助 AI/引擎保持因果
  summary?: string;            // 线索摘要，用于战斗去重匹配
  resolution?: string;         // 解决方式记录
  realmId?: string;          // 若该线索指向秘境，填秘境 id
}

export type QuestEntryStage = 'open' | 'urgent' | 'completed' | 'failed';
export type QuestEntryKind = PendingThread['category'];

// QuestEntry Lite: normalized internal quest index derived from pendingThreads.
// It is a trace/context layer, not a new player-facing UI yet.
export interface QuestEntry {
  id: string;
  title: string;
  summary: string;
  kind: QuestEntryKind;
  stage: QuestEntryStage;
  progress: number;
  startedAtAge: number;
  dueAge?: number;
  urgency: number;
  sourceThreadId: string;
  sourceEventTitle?: string;
  currentHook?: string;
  rewardHint?: string;
  failureHint?: string;
  realmId?: string;
  tags: string[];
}

// ==================== 战斗系统 (Task 20) ====================


export type CombatActionGroupKey = 'basicAttack' | 'technique' | 'spell' | 'defense' | 'item' | 'other';
export type CombatTempo = 'pressing' | 'stalemate' | 'opening' | 'danger' | 'flee_window' | 'turning' | 'chaos';
export type CombatActionOptionType = 'basic_attack' | 'technique' | 'spell' | 'defense' | 'item' | 'talisman' | 'other' | 'flee';
export type CombatActionOptionSource = 'body' | 'weapon' | 'technique' | 'spell' | 'artifact' | 'armor' | 'item' | 'environment' | 'social' | 'pet' | 'status' | 'ai';

// AI action palette: the combat UI is a projection of AI/world-state affordances.
// The engine validates hard facts (owned items, costs, statuses) instead of hard-coding all creative choices.
export interface CombatActionOption {
  id: string;
  name: string;
  description: string;
  actionType: CombatActionOptionType;
  source?: CombatActionOptionSource;
  enabled: boolean;
  disabledReason?: string;
  itemId?: string;
  skillIdx?: number;
  mpCost?: number;
  hpCost?: number;
  risk?: string;
  intent?: string;
  requiredItems?: string[];
  requiredStatuses?: string[];
  forbiddenStatuses?: string[];
  tags?: string[];
  // 意图作用范围：AI/引擎用于提示该动作是单体还是群攻；AI 仍可根据法术性质决定实际波及范围。
  targetScope?: 'single' | 'aoe';
}

export interface CombatActionGroup {
  enabled: boolean;
  label: string;
  disabledReason?: string;
  options: CombatActionOption[];
}

export interface CombatTacticalSituation {
  tempo: CombatTempo;
  advantage: 'player' | 'enemy' | 'even' | 'unclear';
  reason: string;
  playerOpening?: string;
  enemyPressure?: string;
  suggestedFocus?: string;
}

export interface CombatActionPalette {
  basicAttack: CombatActionGroup;
  technique: CombatActionGroup;
  spell: CombatActionGroup;
  defense: CombatActionGroup;
  item: CombatActionGroup;
  other: CombatActionGroup;
  generatedBy: 'engine-fallback' | 'ai' | 'hybrid';
  sceneHint?: string;
  tacticalSituation?: CombatTacticalSituation;
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
  playerAction: string;       // Player action label
  playerActionType: 'attack' | 'skill' | 'item' | 'defend' | 'flee' | 'scripture';
  playerDamage?: number;      // Damage dealt by player side
  playerHeal?: number;        // Healing received by player side
  enemyAction?: string;       // Enemy action label
  enemyActionType?: string;
  enemyDamage?: number;       // Damage dealt by enemy side
  narrative: string;          // In-world round narrative
  playerHpAfter: number;
  enemyHpAfter: number;
  playerMpAfter?: number;
  aiAudit?: string[];         // Engine audit trace for AI combat adjudication
  // 本节拍中所有参战敷人各自的行动（AI 推演、引擎 clamp 后落库）
  enemyActions?: {
    enemyIdx: number;
    name: string;
    action: string;
    actionType?: string;
    damage?: number;        // 对玩家造成的伤害
    hpAfter: number;        // 该敌本节结束后血量
    dead?: boolean;
  }[];
  // 玩家本节命中的敌人（可多个=群攻）
  playerHits?: { enemyIdx: number; name: string; damage: number; hpAfter: number; dead?: boolean }[];
  // 战斗对话（丰富叙事感，可选）
  dialogue?: { speaker: string; text: string }[];
  tacticalSituation?: CombatTacticalSituation;
}

// AI proposes a structured combat adjudication; the engine clamps and persists the authoritative result.
export interface CombatRoundProposal {
  playerActionLabel?: string;
  playerActionType?: CombatRound['playerActionType'];
  enemyAction?: string;
  enemyActionType?: string;
  playerDamage?: number;
  playerHeal?: number;
  enemyDamage?: number;
  mpCost?: number;
  consumeItem?: boolean;
  fleeOutcome?: 'success' | 'failed';
  narrative?: string;
  auditHints?: string[];
  // AI 推演：本节所有存活敌人各自的行动（多敌同台）
  enemyBeats?: {
    enemyId?: string;
    enemyIdx?: number;
    action?: string;
    actionType?: string;
    damageToPlayer?: number;
  }[];
  // AI 推演：玩家这一手命中的敌人与各自伤害（群攻/波及）
  playerHits?: { enemyId?: string; enemyIdx?: number; damage?: number }[];
  // AI 生成的战斗对话
  dialogue?: { speaker?: string; text?: string }[];
  // AI 推演：本节过后角色陷入需玩家决策的处境/本能想用某物的冲动
  playerImpulse?: { kind?: 'item' | 'contingency'; prompt?: string; itemId?: string; itemName?: string };
  tacticalSituation?: Partial<CombatTacticalSituation>;
  nextActions?: Partial<CombatActionOption>[];
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
  playerSkills?: { itemId?: string; name: string; description: string; mpCost: number; power: number; element?: ElementType | 'none'; adaptation?: number; sourceType?: string }[];
  // AI/engine current action palette: UI renders available interactions from this, not fixed combat assumptions.
  actionPalette?: CombatActionPalette;
  // AI/engine validated current battlefield read; UI displays it as world-state, not debug info.
  tacticalSituation?: CombatTacticalSituation;
  // AI proposed, engine-validated临场动作。面板只是投影这些可行动作。
  aiActionOptions?: CombatActionOption[];
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
  tacticalInsights?: {
    id: string;
    enemyIdx: number;
    kind: 'weakness';
    stacks: number;
    bonusPct: number;
    expiresRound: number;
    source: string;
    note: string;
  }[];
  // 角色本能想法/应变关口：AI 判定玩家陷入需决策的处境（如中迷幻/被控/濒危）时产出；
  // kind='item' 时附上一件玩家现有、可对症的道具，UI 弹窗让玩家决定是否使用；kind='contingency' 为应变提示横幅。
  pendingImpulse?: { kind: 'item' | 'contingency'; prompt: string; itemId?: string; itemName?: string; reason?: 'danger' | 'stalemate' | 'control' | 'unknown' };
  // 连续低进展交锋计数；用于识别互相破不了防、日志重复、只剩机械消耗的僵局，并触发 AI/玩家破局时停。
  stalemateStreak?: number;
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
  // AI-64: 道侣系统
  spouseOf?: string | null;             // 若为某角色道侣，存 characterId
  dualCultivationProgress?: number;     // 双修进度 0-100
  // AI-69: 三界 NPC + 跨域通道
  worldTier?: WorldTier;                // NPC 所属三界层级
  crossRealmAccess?: boolean;           // 是否持有跨域通行权
}

// AI-64: 道侣引用（NpcRef — 简单引用结构）
export interface NpcRef {
  npcId: string;
  npcName: string;
  intimacy: number;                     // 0-100
  sinceAge: number;                     // 结缘年龄
}

export type CausalNodeType = 'event' | 'thread' | 'npc' | 'item' | 'status' | 'realm' | 'memory' | 'choice' | 'combat' | 'pet' | 'system';
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

export type WorldFactKind = 'location' | 'faction' | 'realm' | 'npc' | 'relationship' | 'rule' | 'lore' | 'resource' | 'event';

export interface WorldFact {
  id: string;
  kind: WorldFactKind;
  title: string;
  summary: string;
  confidence: number;
  firstSeenAge: number;
  lastSeenAge: number;
  source: string;
  refIds?: string[];
  tags?: string[];
}

export type ScheduledEventKind = 'quest' | 'deadline' | 'realm' | 'npc' | 'world' | 'downtime';
export type ScheduledEventAction = 'advance' | 'advance_or_resolve' | 'resolve_or_fail' | 'echo_or_develop' | 'background';
export type ScheduledEventResolutionStage = 'open' | 'escalating' | 'cooling' | 'background' | 'resolved' | 'failed';

export interface ScheduledEventHint {
  id: string;
  kind: ScheduledEventKind;
  priority: number;
  title: string;
  reason: string;
  sourceThreadId?: string;
  dueAge?: number;
  relatedFactIds?: string[];
  requiredAction: ScheduledEventAction;
  resolutionStage?: ScheduledEventResolutionStage;
  resolutionHint?: string;
}

export interface WorldPressureOpportunityMap {
  topThreat?: string;
  topOpportunity?: string;
  focalLocation?: string;
  focalActor?: string;
  likelyEventTypes: string[];
  summary: string;
}

export interface EventSchedulerPlan {
  generatedAtAge: number;
  focus?: ScheduledEventHint;
  hints: ScheduledEventHint[];
  pressureMap?: WorldPressureOpportunityMap;
  warnings: string[];
}

export type InputClass = 'action' | 'dialogue' | 'overreach' | 'rule_manipulation';

export type NarrativeFocusKind = 'threat' | 'opportunity' | 'location' | 'npc' | 'faction' | 'realm' | 'daily';
export type NarrativeOutcomeKind = 'advanced' | 'resolved' | 'failed' | 'deferred' | 'echoed' | 'ignored';

export interface NarrativeContract {
  narrativeFocus?: NarrativeFocusKind;
  narrativeOutcome?: NarrativeOutcomeKind;
  usedScheduleHintIds?: string[];
  usedWorldFactIds?: string[];
  usedNpcIds?: string[];
  contractNote?: string;
}

export interface NarrativeContractFeedbackEntry {
  age: number;
  title: string;
  narrativeFocus?: NarrativeFocusKind;
  narrativeOutcome?: NarrativeOutcomeKind;
  contractNote?: string;
  focusHintId?: string;
  focusHintTitle?: string;
  topThreat?: string;
  topOpportunity?: string;
  usedScheduleHintIds: string[];
  usedWorldFactIds: string[];
  usedNpcIds: string[];
  warningCodes: string[];
}

// AI 生成的叙事事件
export interface TimeAdvance {
  amount: number;
  unit: 'moment' | 'hour' | 'day' | 'month' | 'season' | 'year' | 'decade' | 'century';
  label: string;
  reason: string;
  ageDeltaYears: number;
  elapsedDays: number;
}

export interface ActionProjection {
  id: string;
  kind: 'advance' | 'market' | 'exploration' | 'thread' | 'cultivate' | 'trade' | 'rest' | 'combat' | 'choice' | 'custom';
  label: string;
  description?: string;
  sourceEventId?: string;
  sourceThreadId?: string;
  requirements?: string[];
  risk?: 'safe' | 'low' | 'medium' | 'high' | 'deadly';
  expiresAtAge?: number;
  expiresAtWorldDay?: number;
  payload?: Record<string, any>;
}

export interface AIEventOutput {
  // 叙事
  title: string;              // 事件标题（≤16字）
  narrative: string;          // 叙事正文（100-300字）
  eventType: 'normal' | 'fate_node' | 'choice' | 'combat' | 'breakthrough' | 'death' | 'ascension';

  // 状态变更（AI 提议，引擎校验）
  changes: AttributeChange[];

  // 灵根蜕变（结构化字段；引擎校验 spiritualRoot 后才会改写角色灵根与修炼倍率）
  spiritualRootChange?: SpiritualRootChange;

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

  // AI/事件生成的非常规属性投影（引擎校验后展示；持久化仍建议通过 newStatuses category='attribute' 落库）
  cultivationAttributes?: CultivationAttributeEntry[];

  // AI 可输出本段时日与行动投影；引擎负责裁剪、校验并落库。
  timeAdvance?: TimeAdvance;
  // 面板只展示 AI/引擎注册的可交互内容，不靠正文正则猜入口。
  actionProjections?: ActionProjection[];

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
  extraEvents?: { title: string; narrative: string; eventType?: AIEventOutput['eventType']; timeAdvance?: TimeAdvance; actionProjections?: ActionProjection[] }[];

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
  // ===== Narrative Contract Lite =====
  // AI 声明本轮承接的调度/世界事实/NPC/叙事焦点，仅用于审计与连续性校验，不直接改变世界。
  narrativeContract?: NarrativeContract;

  // ===== Task 23 新增 =====
  // AI 授予玩家灵宠（如收服妖兽幼崽、前辈相赠、灵宠店购买）
  newPets?: Pet[];
}

export interface AttributeChange {
  attribute: string;     // 改变哪个属性
  delta: number;         // 变化量（正或负）
  reason: string;        // 变化原因
}

export interface SpiritualRootChange {
  spiritualRoot: SpiritualRoot;
  rootDetail?: string;
  reason: string;
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
  spiritualRootChange?: SpiritualRootChange;
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
  cultivationAttributes?: CultivationAttributeEntry[];
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
  spiritualRootChange?: SpiritualRootChange;
  newStatuses: StatusEntry[];
  newItems: ItemEntry[];
  removedItemIds?: string[];
  newEquippedItems?: ItemEntry[];
  equipItemIds?: string[];
  unequipItemIds?: string[];
  memory: string;
  // 修炼心得（同 AIEventOutput；accepted=false 时可留空，引擎将保留旧文本；引擎权威计算来源条目）
  cultivationInsight?: string;
  cultivationAttributes?: CultivationAttributeEntry[];
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
    realmMaxLevel: number;
    cultivationExp: number;
    expToBreak: number;
    elements: { metal: number; wood: number; water: number; fire: number; earth: number };
    hp: number; maxHp: number;
    mp: number; maxMp: number;
    attack: number; defense: number; speed: number;
    cultivationAttributes?: CultivationAttributeEntry[];
    spiritualSense: number; soulStrength: number; physicalFoundation: number;
    combatProjection?: CombatProjectionTraits;
    soulRealmName: string; soulRealmRank: number; soulRealmGap: string;
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
  constitutionProfiles?: { name: string; category: string; stage: number; maxStage: number; resonance: string[]; riskHint?: string; hooks: string[] }[];
  inventory: ItemEntry[];
  // 已装备物品数组（无槽位上限，AI 可创造性装备：项链·储物戒指串、十指皆戴戒指等）
  equipped: ItemEntry[];
  // 储物袋容量上限（无袋 5；获得储物袋后增加）
  storageCapacity: number;
  // 修炼速度倍率（灵根 × 功法 × 其他装备的乘法效果之和）
  cultivationMultiplier: number;
  recentEvents: { age: number; title: string; narrative: string; eventType: string; timeLabel?: string; worldTimeLabel?: string }[];
  worldCalendar?: { eraName: string; calendarYear: number; elapsedDays: number; label?: string };
  previousWorldLegacies?: { characterName: string; status: string; summary: string; relicSeeds?: string[]; legendSeeds?: string[] }[];
  suggestedTimeAdvance?: TimeAdvance;
  narrativeContractFeedback: NarrativeContractFeedbackEntry[];
  longTermMemory: string[];
  completedFateNodes: number[];
  // 引擎能力告知
  availableAttributes: string[];   // AI 可改的属性列表
  nextFateNode?: { index: number; name: string; realm: string };
  realmTraits?: RealmTraits;
  // ===== Task 20 新增 =====
  // 本轮事件蓝图主题（引擎抽取，AI 必须围绕此主题生成事件）
  npcs: WorldNpc[];
  causalGraph: CausalGraph;
  worldFacts: WorldFact[];
  eventSchedule: EventSchedulerPlan;
  blueprint?: EventBlueprint;
  // 未决线索列表（AI 必须保持连续性；deadlineAge 临近的标记为 urgent）
  pendingThreads: PendingThread[];
  questEntries: QuestEntry[];
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
  // Legacy numeric fields remain stored as attack/defense/speed; visible projection is force/guard/agility.
  combatProjection?: CombatProjectionTraits;
  // Core cultivation attributes may grow asynchronously from mana realm.
  spiritualSense?: number;
  soulStrength?: number;
  physicalFoundation?: number;
  soulRealmName?: string;
  soulRealmRank?: number;
  soulRealmGap?: string;
  realmTraits?: RealmTraits;
  // 当前战斗动作面板：由 AI/引擎生成，UI 只负责展示可交互内容
  cultivationAttributes?: CultivationAttributeEntry[];
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
  worldFacts: WorldFact[];
  // 最近叙事契约审计反馈，仅用于调度/提示词的短期记忆潮汐，不持久化到角色状态。
  narrativeContractFeedback?: NarrativeContractFeedbackEntry[];
  pendingThreads: PendingThread[];
  questEntries: QuestEntry[];
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
  // ===== AI-64: 道侣系统 =====
  spouse?: NpcRef | null;                  // 道侣（若已婚配）
  cultivationHarmonyBonus?: number;        // 修炼和谐加成 0-50（双修带来的速度加成）
  // ===== AI-66: 门籍/师徒链 =====
  sectHistory?: SectHistoryEntry[];        // 宗门历史（加入/离开/原因）
  teacherRef?: NpcRef | null;              // 师父
  apprentices?: NpcRef[];                  // 徒弟列表
  // ===== AI-72: L3 modals 接入 =====
  ascensionPending?: AscensionSession | null;   // 待结算飞升会话
  restrictionPending?: Restriction | null;      // 待交互禁制
  // ===== AI-74: Tribulation session 持久化 =====
  tribulationPending?: TribulationSession | null;   // 待渡劫会话
  tribulationResult?: { passed: boolean; narrative: string } | null;  // 最近渡劫结果
}

// ==================== AI-66: 宗门历史条目 ====================
export interface SectHistoryEntry {
  sectId: string;
  sectName: string;
  joinedAge: number;
  leftAge?: number;            // 未离开则为 undefined
  reason: 'joined' | 'left' | 'banished' | 'ascended' | 'retired' | 'martyred';
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

// AI-62: 炼丹火候等级（5 级：微/弱/中/强/极）—— 不动已有 enum，仅新增
export type AlchemyHeatLevel = 'micro' | 'weak' | 'moderate' | 'strong' | 'extreme';

// AI-62: 阵法分类（6 类：困/杀/幻/防/辅/陷）—— 已有 FormationType 不动，此为细分类
export type FormationCategory = 'binding' | 'slaughter' | 'illusion' | 'defense' | 'support' | 'trap';

// ==================== AI-67: 天劫系统 ====================
// 天劫阶段：开劫 → 9 道雷 → 渡/败
export type TribulationStage =
  | 'opening'         // 开劫（天象异变）
  | 'bolt1' | 'bolt2' | 'bolt3' | 'bolt4' | 'bolt5'
  | 'bolt6' | 'bolt7' | 'bolt8' | 'bolt9'
  | 'passed'          // 渡过
  | 'failed';         // 失败

// 心魔类型（5 种：执/恨/爱/惧/悔）
export type HeartDemonType = 'obsession' | 'hatred' | 'love' | 'fear' | 'regret';

// ==================== AI-68: 飞升系统 ====================
// 三界层级：凡间 → 灵界 → 仙界
export type WorldTier = 'humanWorld' | 'spiritWorld' | 'immortalWorld';

// 飞升要求（按 WorldTier 组合）
export interface AscensionRequirement {
  fromTier: WorldTier;
  toTier: WorldTier;
  minRealm: Realm;
  tribulationPassed: boolean;
  lifespanMin: number;       // 最低寿命要求
  reputationMin: number;     // 最低声望
  cultivationExpMin: number; // 最低修为
  daoHeartMin: number;       // 道心强度 0-100
}

// 飞升会话
export interface AscensionSession {
  id: string;
  characterId: string;
  fromTier: WorldTier;
  toTier: WorldTier;
  requirements: AscensionRequirement;
  startedAge: number;
  passed: boolean;
  outcome: 'ascended' | 'failed' | 'ongoing' | 'abandoned';
  narrative: string;
}

// ==================== AI-70: 禁制系统 ====================
// 禁制类型（6 种）：门/困/传送/封/卫/障
export type RestrictionType = 'door' | 'trap' | 'transport' | 'seal' | 'ward' | 'barrier';

// 禁制开启方式（6 种）：令牌/口令/身份/钥匙/时机/战斗
export type RestrictionAccessMethod = 'token' | 'password' | 'identity' | 'key' | 'timing' | 'combat';

// 禁制定义
export interface Restriction {
  id: string;
  name: string;
  type: RestrictionType;
  accessMethod: RestrictionAccessMethod;
  requiredItemId?: string;        // 钥匙/令牌时填
  requiredPassword?: string;      // 口令时填
  requiredIdentity?: string;      // 身份要求（如"宗门弟子""渡劫期"）
  combatPower?: number;           // 战斗要求（仅 combat）
  timingWindows?: string[];       // 时机要求（如"月圆之夜""正午"）
  description: string;
  difficulty: number;             // 0-100
}

// 天劫会话
export interface TribulationSession {
  id: string;
  characterId: string;
  startedAge: number;
  fromRealm: Realm;
  toRealm: Realm;
  currentStage: TribulationStage;
  boltsCompleted: number;          // 已渡雷数
  hpRemaining: number;            // 当前气血百分比 0-100
  heartDemonActive: HeartDemonType | null;  // 当前触发的心魔
  heartDemonResolved: boolean;
  narrative: string;              // 渡劫叙事
  passed: boolean;                // 是否渡过
  outcome: 'ascended' | 'failed' | 'ongoing' | 'abandoned';
}

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
  // AI 生成的个体特性 / 被动倾向（仅作叙事与轻量加成参考，具体数值仍由引擎 clamp）
  traits?: string[];
  passiveHint?: string;
  // 主动技能（每只灵宠一个主动技能，参战时使用）
  skill: {
    name: string;            // 技能名（如"幻影分身""毒雾""烈焰冲击"）
    description: string;     // 技能描述
    power: number;           // 技能威力倍率（1.0=普通攻击等价）
    cooldown: number;        // 冷却回合数
  };
  // AI-65: 灵宠/灵虫区分
  type?: 'pet' | 'insect' | 'swarm' | 'beast';  // 默认 pet；灵虫=insect；群=swarm；神兽=beast
  swarmCount?: number;        // 灵虫群数量（仅 type=swarm/insect）
  combatSkillIds?: string[];  // 战斗技能 id 列表（用于多技能灵兽）
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


// ==================== AI-86: Pill Side Effect System ====================
// Worker B (xiaoxin-B) - additive only, do not modify existing enums/interfaces above.

// 丹药副作用分类（仅指玩家服用丹药后可能产生的负面效果）
export type PillSideEffect =
  | 'toxicity'              // 丹毒累积，损耗根骨/寿元
  | 'cultivation-deviation' // 走火入魔，损伤经脉/修为
  | 'karma'                 // 因果牵缠，招来敌意或天道注视
  | 'qi-turbulence';        // 气机紊乱，下一段时间修炼效率下降

// 丹药服用效果评估（结合丹药品质 + 角色当前状态）
export interface PillEffectiveness {
  pillId: string;
  pillName: string;
  // 增益效果：服用后实际生效的修炼/属性加成
  boost: {
    cultivationExp?: number;       // 修为加成
    hp?: number;                   // 生命回复
    mp?: number;                   // 灵力回复
    attack?: number;               // 临时攻击
    defense?: number;              // 临时防御
    durationTurns?: number;        // 增益持续回合数（战斗/修炼）
  };
  // 副作用概率 0..1
  sideEffectChance: number;
  // 副作用严重程度 1..5（1=轻微，5=危及修行）
  sideEffectSeverity: number;
  // 可能触发的副作用类型列表（按概率排序）
  possibleSideEffects: PillSideEffect[];
}

// 服用丹药后的状态变更摘要（用于审计与 UI 展示）
export interface PillSideEffectResolution {
  pillId: string;
  triggered: boolean;             // 本次是否触发副作用
  sideEffect?: PillSideEffect;    // 触发的具体副作用
  severity: number;               // 1..5
  attributeChanges: AttributeChange[]; // 由副作用导致的属性变化
  statusChanges: StatusEntry[];   // 附带的状态变更（如"丹毒淤积"）
  narrativeHint?: string;         // 给 AI 渲染的剧情提示
}

// ==================== AI-87: Formation Drawing Process ====================
// Worker B (xiaoxin-B) - additive only.

// 阵法绘制的连续步骤（必须按顺序完成才能激活阵法）
export type FormationDrawingStep =
  | 'meditate'    // 入定：心神沉入阵眼所在位置
  | 'trace'       // 走线：以灵力勾勒阵纹走向
  | 'infuse'      // 注灵：将材料灵气注入阵纹节点
  | 'anchor'      // 定锚：锁定阵法根基，防止走线崩溃
  | 'activate';   // 启阵：阵法生效

// 单次阵法绘制会话（玩家在战斗中或闭关中尝试刻画一道阵法）
export interface FormationDrawingSession {
  id: string;
  formationId: string;
  formationName: string;
  characterId: string;
  startedAge: number;             // 开始的角色年龄
  currentStep: FormationDrawingStep;
  completedSteps: FormationDrawingStep[];
  // 已消耗的材料 item id 列表（防止重复消耗）
  materialsUsed: string[];
  // 每一步的成功率 0..1，由引擎派生
  stepSuccessChance: number;
  // 累计失败次数（达到阈值则绘制失败，需从头开始）
  failureStreak: number;
  // 是否已完成（成功/失败）
  finished: boolean;
  success?: boolean;
  // 已消耗回合数（用于战斗内节奏控制）
  turnsSpent: number;
}

// 绘制进度推进结果
export interface FormationDrawingProgress {
  session: FormationDrawingSession;
  advanced: boolean;              // 是否推进到下一步
  failed: boolean;                // 本步是否失败
  finished: boolean;              // 整个会话是否结束
  attributeChanges: AttributeChange[];
  narrativeHint?: string;
}

// ==================== AI-88: Pet Evolution ====================
// Worker B (xiaoxin-B) - additive only.

// 灵宠进阶阶段（不同阶段解锁不同技能/属性上限）
export type PetEvolutionStage =
  | 'infant'    // 幼生期：初始捕获阶段
  | 'youth'     // 成长期：基础技能解锁
  | 'mature'    // 成熟期：属性大幅提升
  | 'ascended'; // 化形期：解锁化形与高阶技能

// 单阶段进阶条件
export interface PetEvolutionRequirement {
  stage: PetEvolutionStage;
  // 最低年龄（角色持有该宠物的年限）
  minAge: number;
  // 最低境界（角色境界等级）
  minRealmLevel: number;
  // 必备材料 item id 列表
  materials: string[];
  // 最低忠诚度要求 0..100
  minLoyalty: number;
}

// 进阶资格校验结果
export interface PetEvolutionEligibility {
  petId: string;
  currentStage: PetEvolutionStage;
  nextStage?: PetEvolutionStage;
  eligible: boolean;
  missing: string[]; // 缺少的条件（如材料名/属性不足原因）
}

// ==================== AI-89: Pet Insight Communication ====================
// Worker B (xiaoxin-B) - additive only.

// 灵宠通过灵识传递给主人的顿悟片段
export interface PetInsight {
  petId: string;
  petName: string;
  insightName: string;     // 顿悟名称（如"风之呼吸""潮汐律动"）
  source: string;           // 顿悟来源（如"观海七日""与主人共同闭关"）
  learnedAge: number;       // 角色学习时的年龄
  // 顿悟可解锁的能力描述
  effect: {
    cultivationRateBonus?: number;   // 修炼速率加成（倍率）
    elementAffinity?: 'metal' | 'wood' | 'water' | 'fire' | 'earth';
    techniqueHint?: string;          // 提示可修习的功法
  };
}

// 灵识对话的请求与响应
export interface PetCommunication {
  petId: string;
  messageType: 'idle' | 'combat' | 'mood' | 'discovery' | 'danger';
  trigger: string;          // 触发原因（世界内事件）
  response: string;         // 灵识传递的内容（角色可感知的一句话）
  learnedAge: number;
  // 可能附带的顿悟片段（不一定每次都有）
  insight?: PetInsight;
}

// ==================== AI-90: Pet Combat Skills ====================
// Worker B (xiaoxin-B) - additive only.

// 灵宠在战斗中可使用的技能定义
export interface PetCombatSkill {
  skillId: string;
  name: string;
  description: string;
  // 技能威力系数（相对基础攻击）
  power: number;
  // 冷却回合数
  cooldown: number;
  // 作用范围（单体/群体）
  range: 'single' | 'all_enemies' | 'all_allies' | 'self';
  // 技能效果类型
  effect: 'physical' | 'elemental' | 'heal' | 'buff' | 'debuff' | 'control';
  // 关联元素（用于元素克制计算）
  element?: 'metal' | 'wood' | 'water' | 'fire' | 'earth';
}

// 技能在战斗中的使用记录（用于冷却与次数控制）
export interface PetSkillUsage {
  skillId: string;
  lastUsedTurn: number;     // 上次使用的回合序号
  usesLeft: number;         // 剩余可用次数（-1 表示无限制）
}

// 单次技能使用产生的战斗事件
export interface PetCombatSkillEvent {
  petId: string;
  skillId: string;
  skillName: string;
  turn: number;
  targetId?: string;
  damage?: number;
  heal?: number;
  buffApplied?: string[];
  debuffApplied?: string[];
  narrativeHint: string;
}// ==================== AI-81: Combat Action Stance ====================
// Worker A (xiaoxin-A) - additive only, do not modify existing enums/interfaces.

// 战斗姿态枚举（角色在战斗中选择的主攻/防守/诱敌/脱身态度）
export type CombatStance =
  | 'aggressive'  // 猛攻：连打连击，放手抢攻
  | 'defensive'   // 守御：缩紧防圈，等待破绽
  | 'cunning'     // 诱敌：佯攻露绽，诱敌深入
  | 'retreat';    // 脱身：保留撤退余力

// 单次战斗姿态的使用记录（剩余回合 + 冷却）
export interface CombatStanceUsage {
  stance: CombatStance;
  // 当前姿态剩余回合数（0 = 已失效）
  usesLeft: number;
  // 切换到其他姿态后，本姿态的冷却回合
  cooldownTurns: number;
  // 该姿态在战斗中已经生效的回合
  turnsActive: number;
}

// ==================== AI-82: Combat Resource Management ====================
// Worker A (xiaoxin-A) - additive only.

// 战斗资源类型（行动消耗的不同维度）
export type CombatResourceType =
  | 'qi'        // 真元：功法/法术消耗
  | 'soul'      // 神识：神识类技能消耗
  | 'stamina'   // 体魄：硬功/体力消耗
  | 'focus';    // 心神：读心/识破/走神消耗

// 战斗资源当前快照（供 UI 显示与引擎决策使用）
export interface CombatResourceUsage {
  type: CombatResourceType;
  current: number;
  max: number;
  // 每回合自然回复（休整/调息等可临时调整）
  regenPerTurn: number;
  // 该资源在上一回合的消耗峰值（用于告警）
  recentDrain?: number;
}

// ==================== AI-83: Breakthrough Stage Refinement ====================
// Worker A (xiaoxin-A) - additive only.

// 突破阶段（一次大境界突破内部可拆分的微观步骤）
export type BreakthroughStage =
  | 'perception'  // 感悟：感知境界门槛
  | 'condense'    // 凝聚：凝聚真元冲击关隘
  | 'storm'       // 风暴：内景风雷动
  | 'stabilize'   // 稳固：稳定新境界
  | 'passed';     // 已通过

// 单次突破尝试的状态（多次尝试/外援/时间累计）
export interface BreakthroughAttempt {
  realmBefore: Realm;
  realmAfter: Realm;
  stage: BreakthroughStage;
  attemptNumber: number;       // 第几次尝试（>=1）
  helperCount: number;         // 护法/外援人数
  startedAge: number;          // 开始时的角色年龄
  // 当前阶段已消耗的回合/天数
  elapsedTurns: number;
}

// ==================== AI-85: Combat Combo Chain ====================
// Worker A (xiaoxin-A) - additive only.

// 连击记录（一串连续命中/连招产生的连击链）
export interface ComboChain {
  comboName: string;     // 连击名（如"三连刺""寒霜七击"）
  hits: number;          // 当前连击段数
  multiplier: number;    // 连击伤害乘数（>=1.0）
  expiresTurn: number;   // 在哪个回合号之后失效（不接续则断连）
}

// ==================== AI-81/AI-82/AI-83/AI-85 Helpers ====================

// 战斗姿态的中文标签（UI 显示用；引擎只关心枚举值）
export const COMBAT_STANCE_LABEL: Record<CombatStance, string> = {
  aggressive: '猛攻',
  defensive: '守御',
  cunning: '诱敌',
  retreat: '脱身',
};

// 战斗资源的中文标签
export const COMBAT_RESOURCE_LABEL: Record<CombatResourceType, string> = {
  qi: '真元',
  soul: '神识',
  stamina: '体魄',
  focus: '心神',
};

// 突破阶段的中文标签
export const BREAKTHROUGH_STAGE_LABEL: Record<BreakthroughStage, string> = {
  perception: '感悟',
  condense: '凝聚',
  storm: '风暴',
  stabilize: '稳固',
  passed: '已过',
};



// ==================== AI-91/AI-92/AI-93/AI-95/AI-96/AI-97/AI-98/AI-99/AI-100/AI-101/AI-103 Types ====================
// Worker A (xiaoxin-A) - additive only. Do not modify existing enums/interfaces.

// ===== AI-91: Combat Log System =====
export interface CombatLogEntry {
  text: string;
  isSystem: boolean;
  round?: number;
  speaker?: string;
  timestamp?: number;
}

// ===== AI-92: Loot AI System =====
export interface LootTable {
  id: string;
  items: ItemEntry[];
  conditions: LootCondition[];
}

export interface LootCondition {
  kind: 'min_realm' | 'min_level' | 'has_status' | 'has_tag' | 'random' | 'faction' | 'spirit_stones';
  realm?: Realm;
  minLevel?: number;
  statusId?: string;
  tag?: string;
  chance?: number;
  faction?: string;
  minStones?: number;
}

// ===== AI-93: Status Expiry =====
export type StatusExpireRule =
  | 'turns'
  | 'years'
  | 'condition'
  | 'event';

export interface StatusExpiryMeta {
  rule: StatusExpireRule;
  remaining?: number;
  trigger?: string;
}

// ===== AI-95: Pet Cultivation Path =====
export type PetCultivationPath =
  | 'combat'
  | 'assist'
  | 'transform'
  | 'contract';

// ===== AI-96: Pill Recipe Unlock =====
export type PillRecipeUnlockCondition =
  | 'manual'
  | 'discover'
  | 'inherit'
  | 'buy';

export interface PillRecipe {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  unlockCondition: PillRecipeUnlockCondition;
  requiredMaterials: string[];
  minRealmIdx: number;
  requiredCauldronTier?: number;
  mainElement: 'fire' | 'water' | 'wood' | 'metal' | 'earth' | 'none';
}

export interface PillCraftResult {
  success: boolean;
  pill?: ItemEntry;
  sideEffect?: StatusEntry;
  narrativeHint?: string;
}

// ===== AI-97: Formation Stack =====
export type FormationStackRule =
  | 'independent'
  | 'boosted'
  | 'conflict'
  | 'replace';

export interface FormationStackResult {
  totalEffect: number;
  warnings: string[];
  appliedRule: FormationStackRule;
  winners: string[];
}

// ===== AI-98: Auction AI =====
export type BidderPersonality =
  | 'cautious'
  | 'aggressive'
  | 'random'
  | 'hostile';

export interface BidderAction {
  bidderId: string;
  kind: 'bid' | 'pass' | 'hostile';
  newBid?: number;
  reason?: string;
}

// ===== AI-99: Thread Chain =====
export interface ThreadChainNode {
  threadId: string;
  parentThreadId?: string;
  depth: number;
  generation: number;
  title?: string;
  category?: PendingThread['category'];
}

// ===== AI-100: Special Physiques (6 kinds) =====
export interface BottleSpirit {
  spiritId: string;
  sourceName: string;
  visibleEffect: string;
  hiddenEffect: string;
  revealed: boolean;
  awakenedAge: number;
}

export type SwordAptitude =
  | 'untrained'
  | 'novice'
  | 'adept'
  | 'master';

export type InnatePhysique =
  | 'waste_body'
  | 'spirit_vein'
  | 'frozen_blood'
  | 'flame_heart'
  | 'dao_bone'
  | 'chaos_eye';

export interface FakeDeathRule {
  trigger: string;
  fakeDurationTurns: number;
  revealChance: number;
  freezeActions: boolean;
}

// ===== AI-101: NPC Memory =====
export interface NPCMemoryEntry {
  npcId: string;
  eventSummary: string;
  importance: number;
  age: number;
  kind: 'witness' | 'rumor' | 'interaction' | 'betrayal' | 'kindness';
}

// ===== AI-103: World Rumor =====
export interface WorldRumor {
  rumorId: string;
  source: string;
  content: string;
  reliability: number;
  originAge: number;
  regionScope?: string;
  truthHint?: string;
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

/**
 * AI-G113: 竞拍出价者的人格原型，用于决定竞价模式、最大出价与敌意倾向。
 * - wealthy-elder: 财雄势大的长老
 * - hot-blooded-young: 热血青年
 * - scheming-cultivator: 算计深沉的同阶修士
 * - casual-pilgrim: 随性游历者
 * - shadow-bidder: 暗中出价的影子买家
 */
export type BidderArchetype =
  | 'wealthy-elder'
  | 'hot-blooded-young'
  | 'scheming-cultivator'
  | 'casual-pilgrim'
  | 'shadow-bidder';

export interface BidderBehaviorProfile {
  archetype: BidderArchetype;
  wealth: number;        // 现有灵石
  maxBid: number;        // 本轮最大可承受出价
  aggressive: boolean;   // 是否主动加价
  hostile: boolean;      // 是否对角色有敌意
}

/**
 * AI-G115: 战斗因果链。一拍战斗由「动作 → 触发 → 对手反应 → 环境效果」组成。
 * engine 用其校准 AI 出招的内在因果是否合理。
 */
export interface CombatCauseChain {
  action: string;             // 玩家/AI 当前动作描述
  trigger: string;            // 触发该动作的原因
  opponentResponse: string;   // 对手可能的回应
  environmentalEffect: string; // 环境/天地灵气等产生的次生效果
}

/**
 * AI-G116: 战斗陷入僵局时的破局选项。
 * engine 在 detectCombatStalemate=true 时根据角色与局势选其一作为下一步引导。
 */
export type StalemateExit =
  | 'deception'         // 诈退诱敌
  | 'risky-strike'      // 行险一击
  | 'disengage'         // 抽身脱离
  | 'ally-intervention' // 同门/盟友介入
  | 'terrain-shift';    // 地利变化（地形/灵气潮）

// ==================== Phase-H Worker B: NPC Long-Term Memory ====================
// AI-H3xx: Structured NPC memory layer with tiered importance, emotional valence,
// involved characters/facts/threads, decay rules, and prompt summarization.
// Distinct from AI-101 NPCMemoryEntry (raw witness list) — this layer stores
// normalized memories suitable for AI prompt injection and behavior derivation.

export type NPCMemoryTier = 'trivial' | 'notable' | 'significant' | 'core' | 'defining';

export interface NPCMemory {
  id: string;
  npcId: string;
  age: number;
  summary: string;
  tier: NPCMemoryTier;
  // -1 = hostile, 0 = neutral, +1 = warm. Validated/clamped to [-1, 1].
  emotionalValence: number;
  involvedCharacterIds: string[];
  worldFactIds: string[];
  evidenceThreadIds: string[];
}

export interface NPCMemoryCluster {
  npcId: string;
  memories: NPCMemory[];
  dominantTier: NPCMemoryTier;
  definingTrait: string;
  lastInteractionAge: number;
}

/**
 * AI-H313b: tunables for decayNPCMemories.
 * - trivialDecayYears: age gap after which 	rivial memories are dropped (default 8).
 * - downgradeYears: age gap after which 
otable / significant memories are downgraded one tier (default 20).
 */
export interface NPCMemoryDecayConfig {
  trivialDecayYears?: number;
  downgradeYears?: number;
}

export interface NPCBehaviorInfluence {
  friendlyWeight: number;
  hostileWeight: number;
  neutralWeight: number;
  actionHint: string;
}


// ==================== Worker C (phase-h-p2-mid): 完整世界地图与世界地点 ====================
// 说明：
// - 这些类型是 phase-h-p2-mid 第 3 期世界地点扩展的类型与最小可落库契约；
// - 不动既有 engine / types 任何函数；只在文件末尾追加。
// - 命名沿用英文 id + 中文注释，便于 AI 在生成世界/剧情时直接复用现有 import。
// ============================================================================

/**
 * AI-H321 世界八大区域。
 * - central-plains:    中原腹地（人族与正统仙门核心）
 * - eastern-sea:       东海仙岛（散修、海族、海外宗门）
 * - northern-waste:    北境荒原（妖兽、苦寒散修）
 * - southern-jungle:   南疆密林（蛊修、毒瘴、异族）
 * - western-desert:    西域大漠（佛门、佛修、沙海秘传）
 * - sky-citadel:       天外仙宫（飞升者、上界投影）
 * - underworld-court:  幽冥地府（鬼修、轮回、残魂）
 * - outer-realm-rift:  域外裂隙（魔修、虚空、上古遗种）
 */
export type WorldRegion =
  | 'central-plains'
  | 'eastern-sea'
  | 'northern-waste'
  | 'southern-jungle'
  | 'western-desert'
  | 'sky-citadel'
  | 'underworld-court'
  | 'outer-realm-rift';

/**
 * AI-H322 地点层级 / 危险度大致划分。
 * - mortal-village:    凡尘村镇（凡人聚居、低灵气）
 * - cultivation-town:  修行坊市（散修与商会汇聚）
 * - immortal-city:     仙门大城（宗门外门、内门分坛）
 * - sacred-ground:     灵山福地（宗门外景、师长道场）
 * - forbidden-zone:    禁地秘境（高危险度、高回报）
 * - outer-realm:       域外之境（跨界或飞升者所至）
 */
export type RegionTier =
  | 'mortal-village'
  | 'cultivation-town'
  | 'immortal-city'
  | 'sacred-ground'
  | 'forbidden-zone'
  | 'outer-realm';

/**
 * AI-H323 单个世界地点。
 * - id:                 唯一 id（建议用拼音或中文 hash，如 "luoyu-village"）
 * - name:               玩家可见的世界内地点名（如"落羽村""流云坊"）
 * - region:             所属八大区域
 * - tier:               地点层级（村镇/坊市/大城/灵山/禁地/域外）
 * - dangerLevel:        危险度 0-100；>70 时应有相关因缘提示
 * - spiritualDensity:   灵气浓度 0-100；与修炼速度、产出品质相关
 * - resources:          主要特产标签（如 "灵石矿""灵草""妖兽材料"）
 * - controllingFaction: 掌控宗门/家族（无则空串）
 * - hiddenEntrance:     是否存在隐藏入口（用于支线、秘境、隐藏 NPC）
 */
export interface LocationNode {
  id: string;
  name: string;
  region: WorldRegion;
  tier: RegionTier;
  dangerLevel: number;
  spiritualDensity: number;
  resources: string[];
  controllingFaction: string;
  hiddenEntrance: boolean;
}

/**
 * AI-H324 两个地点之间的可通行路径。
 * - from / to:            起点 / 终点 LocationNode.id
 * - distanceDays:         凡人脚程所需天数（修士可缩短）
 * - dangerLevel:          路上危险度 0-100
 * - requiredRealm:        最低境界（Realm id 字符串，如 "mortal"/"qi_refining"）
 * - hiddenRequirements:   其它隐藏条件（如"需持某宗门令牌""需通过某任务"），可空数组
 */
export interface TravelRoute {
  from: string;
  to: string;
  distanceDays: number;
  dangerLevel: number;
  requiredRealm: string;
  hiddenRequirements: string[];
}

/**
 * AI-H325 当前世界地图。
 * - nodes:                已注册的全部地点（含未发现的）
 * - routes:               全部可通行路径
 * - currentLocationId:    角色当前所在地点 id
 * - discoveredLocationIds: 玩家已发现/已踏足过的地点 id 集合
 */
export interface WorldMap {
  nodes: LocationNode[];
  routes: TravelRoute[];
  currentLocationId: string;
  discoveredLocationIds: string[];
}

// ==================== Phase-H Worker A: Sect Relation Graph Types ====================
// AI-H301~H304: Sect faction relations and player affinity (additive only).
// ----------------------------------------------------------------------------

/**
 * AI-H301 宗门阵营。
 * 修仙界主要阵营/势力分类；用于 SectNode.alignment 与玩家宗门亲缘。
 */
export type SectFaction =
  | 'qingyun-pavilion'      // 青云阁：正道剑修名门
  | 'blood-saber-sect'      // 血刀宗：魔道刀修
  | 'heavenly-talisman-sect'// 天符宗：符箓正宗
  | 'ten-thousand-sword-sect' // 万剑宗：剑道圣地
  | 'wandering-cultivator'  // 散修：自由人
  | 'demonic-ways'          // 魔道：旁门左道
  | 'royal-court'           // 王庭：世俗王朝与皇族
  | 'merchant-guild';       // 商盟：修士商贾

/**
 * AI-H302 宗门关系类型。
 * 描述两个宗门阵营之间的关系性质，强度由 SectRelationEdge.intensity 决定。
 */
export type SectRelation =
  | 'ally'         // 同盟
  | 'rival'        // 竞争/宿敌但未全面开战
  | 'enemy'        // 死敌
  | 'neutral'      // 中立
  | 'vassal'       // 附庸
  | 'subordinate'  // 下属/支脉
  | 'wary-respect';// 警惕中互敬

/**
 * AI-H303 宗门节点。
 * 一个宗门或势力的具体画像。
 */
export interface SectNode {
  id: string;
  name: string;
  /** 阵营归属：与 SectFaction 对齐，用于关系图与玩家亲缘推导 */
  alignment: SectFaction;
  /** 阵营最低境界 tier（0=mortal, 1=qi_refining ...） */
  realmTierMin: number;
  /** 阵营最高境界 tier */
  realmTierMax: number;
  /** 综合实力排名（数字越小越强） */
  powerRank: number;
  /** 当代掌门/领袖名号（世界内可读名） */
  currentLeader: string;
  /** 山门/总部所在地理位置（世界内文本） */
  seatLocation: string;
  /** 对外公开立场摘要（一句话） */
  publicStance: string;
}

/**
 * AI-H304 宗门关系有向边。
 * 表达 from -> to 的关系性质与强度；强度 0-1。
 */
export interface SectRelationEdge {
  from: string;        // 源 SectNode.id
  to: string;          // 目标 SectNode.id
  relation: SectRelation;
  /** 关系强度 0..1（数字越大关系越紧密/激烈） */
  intensity: number;
  /** 该关系自角色哪一年龄起生效（用于时间线） */
  sinceAge: number;
  /** 世界内叙事注解（AI 生成） */
  narrativeNote: string;
}

/**
 * AI-H304 宗门关系图（不可变快照）。
 * - nodes: 图中所有宗门节点
 * - edges: 全部有向关系边
 * - lastUpdatedAge: 上次更新时间（角色年龄）
 * - currentAge: 当前角色年龄快照
 */
export interface SectRelationGraph {
  nodes: SectNode[];
  edges: SectRelationEdge[];
  lastUpdatedAge: number;
  currentAge: number;
}

// ==================== Phase-H Worker D: Crafting / Cultivation Study Skeleton ====================
// AI-H3xx additive types: 鐗╁搧鍚堟垚/鐐煎埗/淇範绯荤粺鐨勬渶灏忛鏋躲€?// 瑙勫垯锛?//  - 浠呰拷鍔狅紙additive only锛夛紝涓嶅姩鏃㈡湁 type/interface/function銆?//  - engine.ts 閰嶅 5 涓?engine 鍑芥暟浼氭秷璐硅繖浜涚被鍨嬨€?//  - CraftingSideEffect 鐢ㄤ綔 CraftingResult.sideEffects 鐨勫厓绱犵被鍨嬶紝閬垮厤 any銆?
/**
 * AI-H311: 鐐煎埗/鍚堟垚/淇範鐨勭绫绘灇涓俱€? *  - pill-refining:            鐐间腹
 *  - weapon-forging:           鐐煎櫒/閾稿叺
 *  - formation-drawing:        缁樺埗闃垫硶
 *  - technique-comprehension:  淇範鍔熸硶/鏈硶
 *  - item-synthesis:           鐗╁搧鍚堟垚锛堣嵂鏉愭嫾鍚堛€佺鏂欓厤姣旂瓑锛? *  - talisman-making:          绗︾畵鍒朵綔
 */
export type CraftingKind =
  | 'pill-refining'
  | 'weapon-forging'
  | 'formation-drawing'
  | 'technique-comprehension'
  | 'item-synthesis'
  | 'talisman-making';

/**
 * AI-H312: 鐐煎埗/鍚堟垚閰嶆柟瀹氫箟銆? *  - requiredRealm:    鏈€浣庡鐣岋紙Realm id 瀛楃涓诧紝濡?"mortal" / "qi_refining"锛夈€? *  - requiredElements: 鑷冲皯闇€瑕佸摢鍑犻」鍏冪礌浜插拰锛圥artial<Record<ElementType, number>>锛夈€? *  - materials:        鎵€闇€鏉愭枡鏉＄洰锛堟寜 id 鍛戒腑搴撳瓨锛夈€? *  - toolIds:          闇€瑕佺殑宸ュ叿/涓圭倝/绗︾瑪绛?id 鍒楄〃锛堜换涓€缂哄け鍗充笉鍙偧锛夈€? *  - successRate:      鍩虹鎴愬姛鐜?0-1銆? *  - sideEffectChance: 鍓綔鐢ㄨЕ鍙戞鐜?0-1銆? */
export interface CraftingRecipe {
  id: string;
  name: string;
  kind: CraftingKind;
  requiredRealm: string;
  requiredElements: Partial<Record<ElementType, number>>;
  materials: ItemEntry[];
  toolIds: string[];
  successRate: number;        // 0-1
  sideEffectChance: number;   // 0-1
}

/**
 * AI-H313: 涓€娆＄偧鍒?鍚堟垚浼氳瘽鐨勭姸鎬併€? *  - recipeId:          寮曠敤鐨勯厤鏂?id銆? *  - startedAge:        浼氳瘽寮€濮嬫椂鐨勮鑹插勾榫勩€? *  - currentStep/totalSteps: 澶氭鐐煎埗杩涘害銆? *  - materialsConsumed: 宸叉秷鑰楃殑鏉愭枡 id 鍒楄〃銆? *  - attempts:          褰撳墠浼氳瘽鍐呭皾璇曟鏁帮紙鐐煎簾閲嶅紑锛夈€? *  - currentSuccess:    褰撳墠绱鎴愬姛鐜囷紙鍙?realm/comprehension/elements 褰卞搷锛夈€? */
export interface CraftingSession {
  recipeId: string;
  startedAge: number;
  currentStep: number;
  totalSteps: number;
  materialsConsumed: string[];
  attempts: number;
  currentSuccess: number;   // 0-1
}

/**
 * AI-H314: 鐐煎埗/鍚堟垚鍓綔鐢ㄦ潯鐩紙閬垮厤 CraftingResult 鐩存帴鍚?any锛夈€? *  - kind:              鍓綔鐢ㄧ被鍨嬶紙鐘舵€?灞炴€?鍙椾激/璧扮伀鍏ラ瓟锛夈€? *  - severity:          涓ラ噸绋嬪害 0-1銆? *  - description:       鐜╁鍙鎻忚堪锛堜繚鎸佷慨浠欎笘鐣屽唴鍙欎簨锛夈€? *  - expiresAfterDays:  鍙€夛紝鑷姩娑堝け澶╂暟銆? */
export interface CraftingSideEffect {
  kind: 'status' | 'attribute' | 'injury' | 'qi-deviation';
  severity: number;             // 0-1
  description: string;
  expiresAfterDays?: number;
}

/**
 * AI-H315: 涓€娆＄偧鍒?鍚堟垚姝ラ鐨勭粨鏋溿€? *  - success:            鏈鏄惁鎴愬姛銆? *  - outputItems:        浜у嚭鐗╁搧锛堝彲鑳戒负绌鸿〃绀烘湭鎴愪腹/鐐煎簾锛夈€? *  - consumedMaterials:  鏈娑堣€楃殑鏉愭枡 id 鍒楄〃銆? *  - sideEffects:        鏈瑙﹀彂鐨勫壇浣滅敤銆? *  - attributeChanges:   鏈瀵硅鑹插睘鎬х殑褰卞搷锛堜笌 AttributeChange 瀵归綈锛夈€? *  - experienceGained:   鏈鑾峰緱鐨勭粡楠?鐔熺粌搴︺€? */
export interface CraftingResult {
  success: boolean;
  outputItems: ItemEntry[];
  consumedMaterials: string[];
  sideEffects: CraftingSideEffect[];
  attributeChanges: AttributeChange[];
  experienceGained: number;
}

/**
 * AI-H316: 鍔熸硶/鏈硶淇範杩涘害銆? *  - techniqueId:          鐩爣鍔熸硶 id銆? *  - currentProgress:      0-1 鐨勮繘搴︺€? *  - comprehensionEvents:  绱鐨勯】鎮?鐞嗚В浜嬩欢瀛楃涓插垪琛紙鎸夋椂闂撮『搴忚拷鍔狅級銆? *  - breakthroughs:        绱鐨勭獊鐮翠簨浠讹紙age/杩涘害璺冲彉/insight锛夈€? */
export interface TechniqueStudy {
  techniqueId: string;
  currentProgress: number;                  // 0-1
  comprehensionEvents: string[];
  breakthroughs: Array<{
    age: number;
    fromProgress: number;
    toProgress: number;
    insight: string;
  }>;
}