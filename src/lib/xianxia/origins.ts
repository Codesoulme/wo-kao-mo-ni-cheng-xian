// 角色出身多样性 roll 系统
// 6 族裔 × 12 出身 × 伴生灵物 × 先天封印 / 命格

export type Ethnicity =
  | 'human'      // 人族
  | 'demon'      // 妖族
  | 'witch'      // 巫族
  | 'winged'     // 羽族
  | 'sea'        // 海族
  | 'spirit';    // 灵族

export type Lineage =
  | 'mortal'              // 凡人
  | 'fallen_cultivator'   // 落魄修士之后
  | 'sect_heir'           // 仙门嫡传
  | 'demon_heir'          // 魔道遗孤
  | 'sealed_child'        // 封印之子
  | 'divine_reincarnation'// 神明转世
  | 'beast_hybrid'        // 妖兽混血
  | 'fisherman'           // 渔家子
  | 'scholar'             // 书香门第
  | 'merchant'            // 商贾之家
  | 'hunter'              // 猎户之子
  | 'royal_blood';        // 王族遗血

export interface CompanionItem {
  id: string;
  name: string;
  category: 'jade' | 'birthmark' | 'spirit_egg' | 'sword_shard' | 'spirit_seal' | 'other';
  description: string;
  origin: string; // 来历：胎里带来 / 出生异象 / 父母遗物 / 天地所赐
}

export interface SealedFate {
  id: string;
  name: string;        // 命格名
  description: string; // 命格描述
  unlockHint: string;  // 解封契机
}

export interface OriginRoll {
  ethnicity: Ethnicity;
  lineage: Lineage;
  companionItems: CompanionItem[];
  sealedFate: SealedFate | null;
}

// ==================== 6 种族裔 ====================

export const ETHNICITIES: Record<Ethnicity, { name: string; traits: string; description: string }> = {
  human: {
    name: '人族',
    traits: '形貌与凡人无异，灵根觉醒后修行潜力中正平和，寿元受天道限制。',
    description: '天地主角，万族之灵长。肉身孱弱却悟性极高，最契大道法则。',
  },
  demon: {
    name: '妖族',
    traits: '可能带有鳞片、狐尾、异瞳、兽耳等妖族特征，血脉越纯越发明显；肉身强横，寿元绵长。',
    description: '山川草木走兽飞禽，汲取日精月华开灵智化形者，统称妖族。',
  },
  witch: {
    name: '巫族',
    traits: '可能带有灵巫纹身、咒纹目瞳、骨器灵伴；能通神鬼、驾蛊驱魂，肉身最坚。',
    description: '上古巫道遗族，与天地神灵并立，能借神鬼之力行事。',
  },
  winged: {
    name: '羽族',
    traits: '背生双翼、骨骼中空、目能视千里；御风最捷，寿元绵长。',
    description: '生于云海之巅的羽翼族群，世代栖于九天之上。',
  },
  sea: {
    name: '海族',
    traits: '腮裂可隐、肤若凝脂或披鳞；水下如履平地，水行术法亲和极高。',
    description: '东海龙宫遗脉与四海鳞甲水族统称，深海为家。',
  },
  spirit: {
    name: '灵族',
    traits: '形如草木金石所化，无父无母，天地灵气孕育而生；根骨非凡。',
    description: '天生灵体，由天地灵气凝聚而成的特殊族群，无肉欲寿限。',
  },
};

const ETHNICITY_WEIGHTS: Record<Ethnicity, number> = {
  human: 80,
  demon: 4,
  witch: 4,
  winged: 4,
  sea: 4,
  spirit: 4,
};

// ==================== 12 种出身 ====================

export const LINEAGES: Record<Lineage, { name: string; description: string }> = {
  mortal: {
    name: '凡人',
    description: '生于普通凡人家庭，无修行背景；可能从未接触修仙界。',
  },
  fallen_cultivator: {
    name: '落魄修士之后',
    description: '祖上曾有修士，后因故家道中落，残留几卷残简。',
  },
  sect_heir: {
    name: '仙门嫡传',
    description: '出身大宗门嫡系或长老血脉，自幼灵根觉醒，资源丰厚。',
  },
  demon_heir: {
    name: '魔道遗孤',
    description: '魔道巨擘血脉，因正邪大战或意外流落凡尘，身负血仇。',
  },
  sealed_child: {
    name: '封印之子',
    description: '出生时被上古大能以秘法封印某种力量或记忆，待缘到自解。',
  },
  divine_reincarnation: {
    name: '神明转世',
    description: '上界神明或大能轮回投胎，觉醒前世记忆前与常人无异。',
  },
  beast_hybrid: {
    name: '妖兽混血',
    description: '人族与妖族通婚后裔，血脉不纯但往往得天独厚。',
  },
  fisherman: {
    name: '渔家子',
    description: '生于江河湖海之滨的渔民家庭，与水行有不解之缘。',
  },
  scholar: {
    name: '书香门第',
    description: '凡间读书世家，家中藏书万卷，文化底蕴深厚。',
  },
  merchant: {
    name: '商贾之家',
    description: '凡间富商之后，资财丰厚，人脉通达。',
  },
  hunter: {
    name: '猎户之子',
    description: '生于山野猎户家庭，与妖兽搏杀为生，胆识过人。',
  },
  royal_blood: {
    name: '王族遗血',
    description: '凡间王室或修仙王朝遗族末裔，身上隐含金印。',
  },
};

// 按族裔允许的出身池
const LINEAGE_BY_ETHNICITY: Record<Ethnicity, Lineage[]> = {
  human: [
    'mortal', 'fallen_cultivator', 'sect_heir', 'demon_heir',
    'sealed_child', 'divine_reincarnation', 'fisherman', 'scholar',
    'merchant', 'hunter', 'royal_blood',
  ],
  demon: [
    'mortal', 'fallen_cultivator', 'demon_heir', 'sealed_child',
    'beast_hybrid',
  ],
  witch: [
    'mortal', 'fallen_cultivator', 'sealed_child', 'divine_reincarnation',
    'hunter',
  ],
  winged: [
    'mortal', 'fallen_cultivator', 'sect_heir', 'royal_blood',
    'divine_reincarnation',
  ],
  sea: [
    'mortal', 'fallen_cultivator', 'royal_blood', 'fisherman',
    'beast_hybrid',
  ],
  spirit: [
    'mortal', 'divine_reincarnation', 'sealed_child', 'sect_heir',
  ],
};

// 哪些出身默认会触发先天封印/命格
const SEALED_FATE_LINEAGES: Lineage[] = [
  'sealed_child',
  'demon_heir',
  'divine_reincarnation',
];

// ==================== 伴生灵物池 ====================

const COMPANION_POOL: CompanionItem[] = [
  {
    id: 'jade_lotus',
    name: '青莲玉佩',
    category: 'jade',
    description: '温润翠绿的玉佩，背面刻有一朵青莲，灵光隐隐流转。',
    origin: '胎里带来',
  },
  {
    id: 'jade_lunar',
    name: '太阴玉玦',
    category: 'jade',
    description: '形如满月残玦的玉器，握之沁凉，疑似远古祭月之器。',
    origin: '出生异象',
  },
  {
    id: 'birthmark_lotus',
    name: '先天莲花胎记',
    category: 'birthmark',
    description: '左肩胛下天生莲花形胎记，遇灵力激荡时微微浮现光泽。',
    origin: '胎里带来',
  },
  {
    id: 'birthmark_dragon',
    name: '龙纹胎记',
    category: 'birthmark',
    description: '脊背处隐有龙鳞状暗纹，浴水时方显。',
    origin: '胎里带来',
  },
  {
    id: 'birthmark_eye',
    name: '重瞳异象',
    category: 'birthmark',
    description: '生而双瞳叠瞳，俗谓重瞳，历代皆非凡人。',
    origin: '出生异象',
  },
  {
    id: 'spirit_egg_fox',
    name: '灵狐胎卵',
    category: 'spirit_egg',
    description: '裹于胎衣中的灵狐卵，尚未孵化却已与主角心神相连。',
    origin: '胎里带来',
  },
  {
    id: 'spirit_egg_qilin',
    name: '麒麟胎卵',
    category: 'spirit_egg',
    description: '通体温润的异兽胎卵，似有麒麟之血。',
    origin: '天地所赐',
  },
  {
    id: 'spirit_egg_serpent',
    name: '虬龙幼卵',
    category: 'spirit_egg',
    description: '黑鳞斑驳的虬龙幼卵，需以灵气温养方可孵化。',
    origin: '出生异象',
  },
  {
    id: 'sword_shard_immortal',
    name: '仙剑残片',
    category: 'sword_shard',
    description: '一截寸许断剑，锋锐内敛，疑似上界仙剑之碎。',
    origin: '父母遗物',
  },
  {
    id: 'sword_shard_demon',
    name: '魔剑残锋',
    category: 'sword_shard',
    description: '漆黑如墨的断剑残锋，时有血光流转，似饮万人之血。',
    origin: '父母遗物',
  },
  {
    id: 'spirit_seal_void',
    name: '先天灵印·虚',
    category: 'spirit_seal',
    description: '丹田深处一缕虚空气息，疑似某位大能留印。',
    origin: '出生异象',
  },
  {
    id: 'spirit_seal_lotus',
    name: '先天灵印·莲',
    category: 'spirit_seal',
    description: '识海深处浮现一朵青莲虚影，灵台自守。',
    origin: '天地所赐',
  },
  {
    id: 'spirit_seal_dragon',
    name: '先天灵印·龙',
    category: 'spirit_seal',
    description: '脊骨深处隐有龙吟之气，遇妖邪时龙吟自鸣。',
    origin: '天地所赐',
  },
  {
    id: 'other_compass',
    name: '天机铜盘',
    category: 'other',
    description: '古旧铜盘，刻满灵纹，能微指天机方位。',
    origin: '父母遗物',
  },
  {
    id: 'other_gourd',
    name: '养灵葫芦',
    category: 'other',
    description: '拇指大小的紫金葫芦，可蓄养灵虫灵草。',
    origin: '父母遗物',
  },
];

// ==================== 先天封印 / 命格池 ====================

const SEALED_FATE_POOL: SealedFate[] = [
  {
    id: 'fate_chaos',
    name: '混沌封印',
    description: '体内封有一缕混沌之气，修为未至化神不敢妄动。',
    unlockHint: '经历生死大劫或得见太初遗迹时，封印可能松动。',
  },
  {
    id: 'fate_demon_eye',
    name: '魔瞳封印',
    description: '右眼深处藏有上古魔瞳，平时沉睡，怒火炽盛时可能自启。',
    unlockHint: '目睹至亲之死或魔道遗迹时，魔瞳可能苏醒。',
  },
  {
    id: 'fate_seal_reincarnation',
    name: '前世封印',
    description: '识海最深处沉睡着前世大能之魂，未达金丹不可触碰。',
    unlockHint: '踏入前世洞府或见到前世故人时，封印可能应缘而解。',
  },
  {
    id: 'fate_sword_immortal',
    name: '仙剑封印',
    description: '丹田处封有一缕仙剑剑意，肉身未成剑骨无法承载。',
    unlockHint: '领悟剑意或与仙剑残片共鸣时，封印可能松动。',
  },
  {
    id: 'fate_lotus_dao',
    name: '青莲命格',
    description: '命数与青莲相系，逢水则盛，逢火则衰。',
    unlockHint: '悟得莲意或得见莲道传承时，莲命逐步显化。',
  },
  {
    id: 'fate_kill_star',
    name: '七杀命格',
    description: '命犯七杀，所过之处必起纷争，杀伐极重。',
    unlockHint: '经历沙场血战或大能斗法时，七杀命格可能更进一步。',
  },
  {
    id: 'fate_dragon_vein',
    name: '龙脉命格',
    description: '脊骨中暗藏一缕龙气，与天地龙脉隐隐相系。',
    unlockHint: '踏入真龙遗迹或承龙族遗泽时，龙脉命格逐步苏醒。',
  },
  {
    id: 'fate_void_body',
    name: '虚空道胎',
    description: '一身脉络自成虚空，可纳万法也需万法填补。',
    unlockHint: '参悟虚空之法或入太虚秘境时，虚空道胎渐显。',
  },
];

// ==================== Roll 函数 ====================

function weightedPick<T extends string>(weights: Record<T, number>): T {
  const total = (Object.values(weights) as number[]).reduce((s, n) => s + n, 0);
  let r = Math.random() * total;
  for (const key of Object.keys(weights) as T[]) {
    r -= weights[key];
    if (r <= 0) return key;
  }
  return Object.keys(weights)[0] as T;
}

export function rollEthnicity(forced?: Ethnicity): Ethnicity {
  if (forced && ETHNICITIES[forced]) return forced;
  return weightedPick(ETHNICITY_WEIGHTS);
}

export function rollLineage(ethnicity: Ethnicity, forced?: Lineage): Lineage {
  const pool = LINEAGE_BY_ETHNICITY[ethnicity] || LINEAGE_BY_ETHNICITY.human;
  if (forced && pool.includes(forced)) return forced;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function rollCompanionItem(
  ethnicity: Ethnicity,
  lineage: Lineage,
  enabled = true,
): CompanionItem[] {
  if (!enabled) return [];
  // 伴生灵物是稀有出生异象，**默认 5-10% 概率**才有，AI 还会再判断一次
  // 只有少数命数极贵之人（神明转世/魔道遗孤/封印之子等）才在开局自带
  // 普通凡人孩子（农户/渔民/商贾/书生/猎户等）开局 roll 几乎为 0
  if (Math.random() > 0.08) return [];
  // 触发后再在 65%/35% 比例里决定 1 个或 2 个
  const count = Math.random() < 0.65 ? 1 : 2;
  const shuffled = [...COMPANION_POOL].sort(() => Math.random() - 0.5);
  const picked: CompanionItem[] = [];

  for (const item of shuffled) {
    if (picked.length >= count) break;
    // 简单相关性优先：妖族/海族倾向 spirit_egg / birthmark_dragon；人族偏 jade / scripture
    if (ethnicity === 'demon' || ethnicity === 'sea') {
      if (
        item.category === 'spirit_egg' ||
        item.category === 'birthmark'
      ) {
        picked.push(item);
        continue;
      }
    }
    if (ethnicity === 'witch' && item.category === 'spirit_seal') {
      picked.push(item);
      continue;
    }
    if (lineage === 'divine_reincarnation' && item.category === 'spirit_seal') {
      picked.push(item);
      continue;
    }
    if (lineage === 'demon_heir' && item.category === 'sword_shard') {
      picked.push(item);
      continue;
    }
    picked.push(item);
  }
  return picked;
}

export function rollSealedFate(
  lineage: Lineage,
  enabled = true,
): SealedFate | null {
  if (!enabled) return null;
  // 仅特定出身触发
  if (!SEALED_FATE_LINEAGES.includes(lineage)) return null;
  // 60% 概率触发（已通过出身筛选）
  if (Math.random() > 0.6) return null;
  return SEALED_FATE_POOL[Math.floor(Math.random() * SEALED_FATE_POOL.length)];
}

export interface RollOriginOptions {
  ethnicity?: Ethnicity;
  lineage?: Lineage;
  /** 默认不 roll；显式 true 才开局 roll 伴生灵物。AI 在剧情里自然给的是主路径 */
  companionItems?: boolean;
  sealedFate?: boolean;
  previousLivesCount?: number;
}

export function rollOrigin(opts: RollOriginOptions = {}): OriginRoll {
  const ethnicity = rollEthnicity(opts.ethnicity);
  const lineage = rollLineage(ethnicity, opts.lineage);
  const companionItems = rollCompanionItem(
    ethnicity,
    lineage,
    opts.companionItems === true,
  );
  const sealedFate = rollSealedFate(lineage, opts.sealedFate !== false);
  return { ethnicity, lineage, companionItems, sealedFate };
}

// ==================== LLM Prompt 增强字符串 ====================

export function buildOriginPrompt(origin: OriginRoll): string {
  const e = ETHNICITIES[origin.ethnicity];
  const l = LINEAGES[origin.lineage];

  const companionStr = origin.companionItems.length
    ? `\n【伴生灵物】（来自胎里/出生异象/父母遗物，请描写其来历与主角的因缘）：\n${origin.companionItems
        .map(
          (c) =>
            `- ${c.name}（${c.origin}）：${c.description}`,
        )
        .join('\n')}`
    : '\n【伴生灵物】无';

  const sealedStr = origin.sealedFate
    ? `\n【先天封印/命格】（请写角色被封印的特殊命格 + 解封契机）：\n- ${origin.sealedFate.name}：${origin.sealedFate.description}\n- 解封契机：${origin.sealedFate.unlockHint}`
    : '\n【先天封印/命格】无';

  return `【角色族裔】${e.name}：${e.description}族裔特征：${e.traits}
【角色出身】${l.name}：${l.description}
${companionStr}
${sealedStr}`;
}

// ==================== Fallback 模板 ====================

const FALLBACK_TEMPLATES: Record<Ethnicity, Partial<Record<Lineage, { birthplace: string; family: string; background: string }>>> = {
  human: {
    mortal: {
      birthplace: '中原腹地一处凡人村落',
      family: '农户之家',
      background: '降生于寻常人家，呱呱坠地时屋上青烟袅袅，邻家老妪笑称此子目有灵光。家虽清贫，然邻里和睦，父母慈爱。',
    },
    fallen_cultivator: {
      birthplace: '落魄的青阳镇',
      family: '没落修士家族',
      background: '祖上曾有筑基修士，后因一场变故家道中落。降生时祖宅深处忽有灵光一闪，似是残卷回应。',
    },
    sect_heir: {
      birthplace: '青云宗山门外一处别院',
      family: '仙门嫡系子弟',
      background: '父为青云宗长老，母为同门仙子。生而异香满室，宗门长老皆言此子灵根非凡，赐下玉牌护身。',
    },
    demon_heir: {
      birthplace: '正邪大战后遗弃的荒村',
      family: '魔道遗孤',
      background: '父母为魔道巨擘，正邪大战中同归于尽。降生之夜，血色残月高悬，婴儿左肩隐现魔纹。',
    },
    sealed_child: {
      birthplace: '上古封印遗迹旁的凡人小镇',
      family: '封印守护者之家',
      background: '世代守护封印的家族这一代诞下一子，封印深处传来一声叹息，似认主。',
    },
    divine_reincarnation: {
      birthplace: '仙雾缭绕的洞天福地',
      family: '收养的上界弃婴',
      background: '一对散修夫妇在云海捡到此婴，婴儿识海中隐见星辰旋转，似有前世痕迹。',
    },
    fisherman: {
      birthplace: '东海之滨的渔村',
      family: '渔家子',
      background: '生于渔家，自幼听惯了潮起潮落，对水行灵气异常亲近。',
    },
    scholar: {
      birthplace: '江南书香古城',
      family: '书香门第',
      background: '家中藏书万卷，父母皆是凡间大儒。生而识字，目光澄澈，被视为神童。',
    },
    merchant: {
      birthplace: '通商大埠',
      family: '商贾之家',
      background: '家中资财丰厚，南北通商。降生时满室金光流转，账房先生笑言此子将来必能广结人脉。',
    },
    hunter: {
      birthplace: '北荒边陲山林',
      family: '猎户之家',
      background: '父辈以猎妖为生，自幼与山林妖兽为伴，胆识过人。',
    },
    royal_blood: {
      birthplace: '凡间没落王城',
      family: '王族遗血',
      background: '末代王族后裔，族谱残卷上仍可追溯数代王号。身上隐含金印，平日不显。',
    },
  },
  demon: {
    mortal: {
      birthplace: '青丘狐族外围小镇',
      family: '混迹凡间的妖狐一族',
      background: '父为化形狐妖，母为凡女。生而狐耳隐现，灵动非常。',
    },
    fallen_cultivator: {
      birthplace: '妖界废弃的修行洞府',
      family: '没落妖族世家',
      background: '祖上曾为妖王，后因天劫陨落。降生时洞府深处传来一声低吼，似血脉回应。',
    },
    demon_heir: {
      birthplace: '魔渊深处的妖王宫殿',
      family: '妖王嫡子',
      background: '父为当世妖王，生而异象：妖云翻涌，万妖朝拜。',
    },
    sealed_child: {
      birthplace: '上古妖神封印之地',
      family: '封印兽裔之家',
      background: '世代看守封印的妖族一脉，这一代所生幼崽竟令封印深处的古妖低语。',
    },
    beast_hybrid: {
      birthplace: '妖凡交界处的山寨',
      family: '半妖混血',
      background: '父为妖兽、母为凡女，自幼受两族排斥，然血脉中隐隐有灵光流转。',
    },
  },
  witch: {
    mortal: {
      birthplace: '南疆十万大山深处',
      family: '灵巫遗脉',
      background: '巫族后裔，生而身具咒纹，可通神鬼。',
    },
    fallen_cultivator: {
      birthplace: '巫道衰落的祭祀古寨',
      family: '没落巫祝家族',
      background: '祖上曾为一方大巫，后神位陨落。所生此子，背上隐现灵巫纹身。',
    },
    sealed_child: {
      birthplace: '巫神沉睡的禁忌之地',
      family: '巫神守护者',
      background: '世代守护沉睡巫神的一族，所生之子竟与古巫之心隐隐相系。',
    },
    divine_reincarnation: {
      birthplace: '神巫祭坛之下',
      family: '神巫转世',
      background: '识海中沉睡着上古神巫之魂，未达化神不可触碰。',
    },
    hunter: {
      birthplace: '巫山猎巫之地',
      family: '猎巫者之家',
      background: '父辈猎巫为生，所生此子反得巫神认可，猎与被猎的因果从此纠缠。',
    },
  },
  winged: {
    mortal: {
      birthplace: '云海之上的羽族山寨',
      family: '羽族平民',
      background: '生而双翼未丰，待到修行有成方能展翅九霄。',
    },
    fallen_cultivator: {
      birthplace: '坠落凡尘的羽族废墟',
      family: '没落羽族世家',
      background: '祖上为羽族王庭，后陨落于仙妖大战。所生幼崽，翼上羽色斑驳。',
    },
    sect_heir: {
      birthplace: '九天之上羽神宗',
      family: '羽族神宗嫡传',
      background: '生而彩羽覆体，宗门长老皆视为羽神转世之兆。',
    },
    royal_blood: {
      birthplace: '羽族王庭',
      family: '羽族王族末裔',
      background: '末代羽王血脉，翼尖金羽熠熠生辉。',
    },
    divine_reincarnation: {
      birthplace: '羽神祭坛之上',
      family: '羽神转世',
      background: '识海深处沉睡羽神之魂，未至金丹不可触碰。',
    },
  },
  sea: {
    mortal: {
      birthplace: '东海龙宫外围的珊瑚城',
      family: '海族平民',
      background: '生而腮裂可隐，水下行如平地。',
    },
    fallen_cultivator: {
      birthplace: '沉没的远古龙宫',
      family: '没落龙族旁支',
      background: '祖上为龙王旁支，因政变流落。所生此子，鳞色与正统龙族无异。',
    },
    royal_blood: {
      birthplace: '龙宫深处',
      family: '东海龙族末裔',
      background: '末代龙王子嗣，额间龙鳞隐现，可号令部分水族。',
    },
    fisherman: {
      birthplace: '海边的渔家',
      family: '海民之家',
      background: '父辈以捕鱼为生，所生此子竟可水下长时间不溺，似与海族有不解之缘。',
    },
    beast_hybrid: {
      birthplace: '海妖与人族交界的小岛',
      family: '海妖混血',
      background: '父为海妖、母为凡女，自幼耳后有鳃裂，遇水则现。',
    },
  },
  spirit: {
    mortal: {
      birthplace: '某处洞天福地的灵脉之上',
      family: '天地灵气所生',
      background: '无父无母，由天地灵气凝聚而生，形如草木所化，灵台自守。',
    },
    divine_reincarnation: {
      birthplace: '远古灵脉深处',
      family: '灵族宿慧转世',
      background: '识海深处沉睡着上古灵神之魂，未至金丹不可触碰。',
    },
    sealed_child: {
      birthplace: '天地封印的灵脉之眼',
      family: '灵脉封印者',
      background: '灵脉深处一缕封印之力与心神相连，缘到自解。',
    },
    sect_heir: {
      birthplace: '某位大能遗留的洞府',
      family: '大能遗泽之灵',
      background: '大能坐化后灵气不散，孕育出此灵。',
    },
  },
};

// 给 spirit 用一个简化的 fallback（避免 TS 复杂类型）
const SPIRIT_FALLBACK: Record<string, { birthplace: string; family: string; background: string }> = {
  mortal: {
    birthplace: '某处洞天福地的灵脉之上',
    family: '天地灵气所生',
    background: '无父无母，由天地灵气凝聚而生，形如草木所化，灵台自守。',
  },
  divine_reincarnation: {
    birthplace: '远古灵脉深处',
    family: '灵族宿慧转世',
    background: '识海深处沉睡着上古灵神之魂，未至金丹不可触碰。',
  },
  sealed_child: {
    birthplace: '天地封印的灵脉之眼',
    family: '灵脉封印者',
    background: '灵脉深处一缕封印之力与心神相连，缘到自解。',
  },
  sect_heir: {
    birthplace: '某位大能遗留的洞府',
    family: '大能遗泽之灵',
    background: '大能坐化后灵气不散，孕育出此灵。',
  },
};

export function buildFallbackBackground(origin: OriginRoll): { birthplace: string; family: string; background: string } {
  if (origin.ethnicity === 'spirit') {
    return SPIRIT_FALLBACK[origin.lineage] || SPIRIT_FALLBACK.mortal;
  }
  const byE = FALLBACK_TEMPLATES[origin.ethnicity] || FALLBACK_TEMPLATES.human;
  return byE[origin.lineage] || byE.mortal || SPIRIT_FALLBACK.mortal;
}