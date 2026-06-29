// 修真界感改进 - 任务 E v2：世界级事件模板库 + LLM 决策触发
// 让世界"活"起来（不只是单 character 在玩）：
//   灵潮枯竭/复苏、魔道入侵/败退、妖族入侵/平定、仙凡通道开/关、古修洞府开/探完、
//   大修士飞升/陨落、异宝出世/被夺、邪修崛起/剿灭、上古封印松动/加固、仙门大比/内战、
//   妖兽潮/平息、仙凡大战/和解、末法时代开/结、圣兽降世/隐退、天道垂青/警告、大劫将至
//
// 设计核心（E v2 用户反馈）：
//   1) 事件**不固定时间**——按角色当前状态（年龄/日历/族裔/灵根/realm/上轮事件/世界大势）
//      通过 getAvailableEvents 过滤可触发模板
//   2) LLM 自主决定**本年是否触发 0-1 个世界级事件**（advance prompt 暴露可触发模板）
//   3) 事件是**类型 + 模板**：WorldEventType + WorldEventTemplate（narrative + effects + triggerConditions）
//   4) LLM 输出 [WORLD_EVENT:type]...[/WORLD_EVENT] 标记触发；不输出 fallback 到 random roll
//
// 注入 character state（statusList + cultivationMultiplier + lifespan + pendingThread + previousWorldLegacies）。
// 状态存 character stateJson（runtime 不依赖 prisma schema）。

import type { CharacterState } from './types';

// ============================================================
// 类型定义 —— 30 种世界级事件
// ============================================================

export type WorldEventType =
  // 灵气/天道（5）
  | 'spirit_tide_low'         // 灵潮枯竭
  | 'spirit_tide_high'        // 灵潮复苏
  | 'dao_blessing'            // 天道垂青
  | 'dao_warning'             // 天道警告
  | 'mofa_era_begins'         // 末法时代开
  | 'mofa_era_ends'           // 末法时代结
  // 魔道/邪修（4）
  | 'demon_invasion'          // 魔道入侵
  | 'demon_pushed_back'       // 魔道败退
  | 'demonic_sect_rises'      // 邪修崛起
  | 'demonic_sect_destroyed'  // 邪修剿灭
  // 妖族（4）
  | 'beast_invasion'          // 妖族入侵
  | 'beast_calmed'            // 妖族平定
  | 'beast_tide'              // 妖兽潮
  | 'beast_tide_calmed'       // 妖兽潮平息
  | 'holy_beast_descends'     // 圣兽降世
  | 'holy_beast_retreats'     // 圣兽隐退
  // 宝物（2）
  | 'rare_treasure_surfaces'  // 异宝出世
  | 'rare_treasure_taken'     // 异宝被夺
  // 修士（4）
  | 'great_cultivator_ascend' // 大修士飞升
  | 'great_cultivator_falls'  // 大修士陨落
  | 'ancient_seal_weakens'    // 上古封印松动
  | 'ancient_seal_strengthened' // 上古封印加固
  // 仙凡/大劫（5）
  | 'mortal_celestial_open'   // 仙凡通道开
  | 'mortal_celestial_close'  // 仙凡通道关
  | 'mortal_celestial_war'    // 仙凡大战
  | 'mortal_celestial_peace'  // 仙凡和解
  | 'catastrophe_imminent'    // 大劫将至
  // 宗门（2）
  | 'sect_tournament'         // 仙门大比
  | 'sect_civil_war'          // 仙门内战
  // 秘境（2）
  | 'ancient_cave_open'       // 古修洞府开
  | 'ancient_cave_explored'   // 古修洞府探完

export type WorldEventCategory =
  | 'spirit' | 'demon' | 'beast' | 'treasure'
  | 'cultivator' | 'mortal_celestial' | 'era'
  | 'beast_tide' | 'sect' | 'catastrophe' | 'cave';

export type WorldEventRarity =
  | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface WorldEventTemplate {
  type: WorldEventType;
  title: string;
  category: WorldEventCategory;
  /** 含 {actor}/{place}/{age}/{year}/{realm}/{faction} 占位符，由 LLM 据此扩写 */
  narrativeTemplate: string;
  effectsTemplate: {
    cultivationMultiplier?: number;
    lifespanModifier?: number;
    rootMultiplierBoost?: number;
    threadTitle?: string;
    threadSummary?: string;
    previousWorldLegacies?: string;
    realmChange?: string;
  };
  triggerConditions: {
    minAge?: number;
    maxAge?: number;
    minRealm?: string;        // realm id or realm name
    applicableEthnicity?: string[]; // ['*'] 为不限
    applicableLineage?: string[];   // ['*'] 为不限
    /** 距上次同类事件最少 N 年（防刷屏）；0 = 不限制 */
    cooldown: number;
    /** 此前必须发生的事件类型；全部必须存在才可触发 */
    prerequisites?: WorldEventType[];
    /** 必须 NOT 存在的事件（互斥/反义） */
    excludedIf?: WorldEventType[];
  };
  /** 持续年数（-1 = 单次/瞬时） */
  duration: number;
  rarity: WorldEventRarity;
  /** LLM 据此扩写 narrative 的"事件描述暗示" */
  hints: string[];
}

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  triggeredAge: number;
  triggeredWorldTime: { eraName: string; calendarYear: number; elapsedDays: number };
  duration: number;
  effects: {
    cultivationMultiplier?: number;
    lifespanModifier?: number;
    rootMultiplierBoost?: number;
    threadTitle?: string;
    threadSummary?: string;
    previousWorldLegacies?: string;
    realmChange?: string;
  };
  narrative: string;
  appliedTo: 'this' | 'all';
}

export interface ActiveWorldEvent {
  event: WorldEvent;
  remainingYears: number;
}

export interface WorldEventState {
  lastRollAge: number;
  activeEvents: ActiveWorldEvent[];
  history: WorldEvent[];
}

// ============================================================
// 模板库：30 种 WorldEventTemplate
// ============================================================

interface TemplateBuilder {
  type: WorldEventType;
  title: string;
  category: WorldEventCategory;
  duration: number;
  rarity: WorldEventRarity;
  narrativeTemplate: string;
  effectsTemplate: WorldEventTemplate['effectsTemplate'];
  hints: string[];
  triggerConditions: WorldEventTemplate['triggerConditions'];
}

const TEMPLATE_BUILDERS: TemplateBuilder[] = [
  // ---------- 灵气/天道（5）----------
  {
    type: 'spirit_tide_low',
    title: '灵潮枯竭',
    category: 'spirit',
    duration: 5,
    rarity: 'epic',
    narrativeTemplate: '灵气如潮水退去，九州天地元气骤然稀薄。{place} 周边修士皆感突破艰难，仿佛整片天地都在沉睡。',
    effectsTemplate: { cultivationMultiplier: 0.3 },
    hints: ['灵气稀薄修炼效率 -70%', '散修减少外出', '灵药产量大减', '坊市丹药涨价'],
    triggerConditions: { minAge: 16, cooldown: 10, excludedIf: ['spirit_tide_high'] },
  },
  {
    type: 'spirit_tide_high',
    title: '灵潮复苏',
    category: 'spirit',
    duration: 3,
    rarity: 'epic',
    narrativeTemplate: '沉睡千年的灵脉重新涌动，天降灵雨，万物复苏。{place} 修士奔走相告：这是大世之兆。',
    effectsTemplate: { cultivationMultiplier: 2.0 },
    hints: ['天地元气充沛', '修炼效率 ×2', '新灵根觉醒者增多', '老修士纷纷破境'],
    triggerConditions: { minAge: 16, cooldown: 10, prerequisites: ['spirit_tide_low'] },
  },
  {
    type: 'dao_blessing',
    title: '天道垂青',
    category: 'spirit',
    duration: 2,
    rarity: 'legendary',
    narrativeTemplate: '一日{actor}夜观星象，忽见天心澄明，灵气自然汇顶。{faction} 山门紫气东来，修士皆感悟道微光。',
    effectsTemplate: { cultivationMultiplier: 1.5, rootMultiplierBoost: 0.05 },
    hints: ['悟道加速', '灵气自然汇聚', '灵根微调', '持续 2 年'],
    triggerConditions: { minAge: 30, cooldown: 20 },
  },
  {
    type: 'dao_warning',
    title: '天道警告',
    category: 'spirit',
    duration: 1,
    rarity: 'rare',
    narrativeTemplate: '天地忽生异象：{place} 天现血月，{realm} 修士皆感心惊肉跳，凡人亦有不安。这是天道对 {faction} 的警示。',
    effectsTemplate: { cultivationMultiplier: 0.8 },
    hints: ['大劫先兆', '修士心悸', '不宜突破'],
    triggerConditions: { minAge: 50, cooldown: 15, prerequisites: ['catastrophe_imminent'] },
  },
  {
    type: 'mofa_era_begins',
    title: '末法时代降临',
    category: 'era',
    duration: 50,
    rarity: 'mythic',
    narrativeTemplate: '天地巨变。灵气如退潮般向外散去，{place} 灵脉一条条枯竭。修仙界凋零，{faction} 关闭山门隐世。',
    effectsTemplate: { cultivationMultiplier: 0.2, lifespanModifier: -20 },
    hints: ['修炼效率 -80%', '寿元上限缩短', '仙门隐世', '凡间灵气断绝'],
    triggerConditions: { minAge: 100, cooldown: 100, maxAge: 5000 },
  },
  {
    type: 'mofa_era_ends',
    title: '末法时代终结',
    category: 'era',
    duration: 10,
    rarity: 'mythic',
    narrativeTemplate: '封闭的灵脉重开，灵气重新灌入九州。{faction} 重启山门，{realm} 散修结社重立。',
    effectsTemplate: { cultivationMultiplier: 1.5 },
    hints: ['灵气回归', '修炼效率 +50%', '新修行时代开启'],
    triggerConditions: { minAge: 200, cooldown: 100, prerequisites: ['mofa_era_begins'] },
  },

  // ---------- 魔道/邪修（4）----------
  {
    type: 'demon_invasion',
    title: '魔道入侵',
    category: 'demon',
    duration: 3,
    rarity: 'epic',
    narrativeTemplate: '极北冰原之下，魔道大能破封而出。{faction} 风云变色，正道与魔道的千年恩怨再次点燃。{place} 血色弥漫。',
    effectsTemplate: { cultivationMultiplier: 0.5, lifespanModifier: -10 },
    hints: ['魔道修士攻伐九州', '修士寿元 -10', '邪修踪迹增多'],
    triggerConditions: { minAge: 30, cooldown: 15 },
  },
  {
    type: 'demon_pushed_back',
    title: '魔道败退',
    category: 'demon',
    duration: 2,
    rarity: 'rare',
    narrativeTemplate: '正道联军大捷！魔道大能重伤退避极北。{faction} 声望大振，{place} 修士举杯相庆。',
    effectsTemplate: { cultivationMultiplier: 1.1 },
    hints: ['魔劫暂时平息', '正法压邪', '正道声望提升'],
    triggerConditions: { minAge: 30, cooldown: 5, prerequisites: ['demon_invasion'] },
  },
  {
    type: 'demonic_sect_rises',
    title: '邪修崛起',
    category: 'demon',
    duration: 8,
    rarity: 'rare',
    narrativeTemplate: '{place} 附近邪修结社壮大，血祭凡人扩张势力。{faction} 弟子下山调查，皆言其势已成。',
    effectsTemplate: { cultivationMultiplier: 0.85 },
    hints: ['邪修扩散', '血祭/夺舍频繁', '散修受害'],
    triggerConditions: { minAge: 40, cooldown: 12 },
  },
  {
    type: 'demonic_sect_destroyed',
    title: '邪修剿灭',
    category: 'demon',
    duration: 1,
    rarity: 'uncommon',
    narrativeTemplate: '{faction} 奉命围剿，{place} 一带的邪修巢穴尽数焚毁。天地重归清明。',
    effectsTemplate: { cultivationMultiplier: 1.2 },
    hints: ['地方清净', '邪修退散'],
    triggerConditions: { minAge: 40, cooldown: 8, prerequisites: ['demonic_sect_rises'] },
  },

  // ---------- 妖族（6）----------
  {
    type: 'beast_invasion',
    title: '妖族入侵',
    category: 'beast',
    duration: 2,
    rarity: 'epic',
    narrativeTemplate: '万妖山脉动荡，妖王率众越过山脊南下。{place} 妖兽啸月，弱者被淘汰，强者于血火中诞生。',
    effectsTemplate: { cultivationMultiplier: 1.5 },
    hints: ['妖兽南下', '妖丹/妖骨频繁出现', '炼器材料大丰', '风险升高'],
    triggerConditions: { minAge: 20, cooldown: 8 },
  },
  {
    type: 'beast_calmed',
    title: '妖族平定',
    category: 'beast',
    duration: 1,
    rarity: 'uncommon',
    narrativeTemplate: '高阶修士震慑万妖山，{faction} 与妖族签订契约，南下妖兽退散。{place} 商路重开。',
    effectsTemplate: { cultivationMultiplier: 1.05 },
    hints: ['妖兽退去', '商路恢复'],
    triggerConditions: { minAge: 20, cooldown: 5, prerequisites: ['beast_invasion'] },
  },
  {
    type: 'beast_tide',
    title: '妖兽潮',
    category: 'beast_tide',
    duration: 1,
    rarity: 'legendary',
    narrativeTemplate: '万妖齐出！{place} 一夜之间被妖兽潮淹没。城门接连告破，凡人死伤惨重，{faction} 弟子下山护民。',
    effectsTemplate: { cultivationMultiplier: 2.0 },
    hints: ['兽潮横扫', '修士大量下山', '战场淬炼'],
    triggerConditions: { minAge: 30, cooldown: 30, prerequisites: ['beast_invasion'] },
  },
  {
    type: 'beast_tide_calmed',
    title: '妖兽潮平息',
    category: 'beast_tide',
    duration: 2,
    rarity: 'rare',
    narrativeTemplate: '{faction} 联合几大宗门围剿，兽王伏诛。{place} 重建家园，幸存者收敛骸骨。',
    effectsTemplate: { cultivationMultiplier: 0.9 },
    hints: ['战后阴郁', '修士悲愤', '重建秩序'],
    triggerConditions: { minAge: 30, cooldown: 8, prerequisites: ['beast_tide'] },
  },
  {
    type: 'holy_beast_descends',
    title: '圣兽降世',
    category: 'beast',
    duration: 5,
    rarity: 'legendary',
    narrativeTemplate: '天现彩凤/青龙/玄武/白虎/麒麟虚影。{place} 一带灵气暴涨，灵草疯长，修士纷纷前往朝圣。',
    effectsTemplate: { cultivationMultiplier: 1.8, rootMultiplierBoost: 0.08 },
    hints: ['祥瑞降临', '灵脉增幅', '灵草丰产', '气运加身'],
    triggerConditions: { minAge: 60, cooldown: 80 },
  },
  {
    type: 'holy_beast_retreats',
    title: '圣兽隐退',
    category: 'beast',
    duration: 1,
    rarity: 'epic',
    narrativeTemplate: '圣兽虚影淡去，灵气回落。{faction} 长叹：祥瑞已矣。{place} 一带灵草渐稀。',
    effectsTemplate: { cultivationMultiplier: 0.8 },
    hints: ['灵气回落', '圣兽离去'],
    triggerConditions: { minAge: 60, cooldown: 30, prerequisites: ['holy_beast_descends'] },
  },

  // ---------- 宝物（2）----------
  {
    type: 'rare_treasure_surfaces',
    title: '异宝出世',
    category: 'treasure',
    duration: 1,
    rarity: 'legendary',
    narrativeTemplate: '{place} 异象纷呈：灵光冲天、彩云环绕。传闻某处洞府/遗迹开启，{faction} 弟子纷纷前往。',
    effectsTemplate: {},
    hints: ['异宝现世', '修士云集', '可能获得传承/法宝'],
    triggerConditions: { minAge: 20, cooldown: 8 },
  },
  {
    type: 'rare_treasure_taken',
    title: '异宝被夺',
    category: 'treasure',
    duration: 1,
    rarity: 'rare',
    narrativeTemplate: '新出世异宝已被大能/宗派夺去。{place} 一带哗然，{faction} 长辈提醒弟子勿贪。',
    effectsTemplate: {},
    hints: ['错失机缘', '大势力掌控'],
    triggerConditions: { minAge: 20, cooldown: 5, prerequisites: ['rare_treasure_surfaces'] },
  },

  // ---------- 修士（4）----------
  {
    type: 'great_cultivator_ascend',
    title: '大修士飞升',
    category: 'cultivator',
    duration: 5,
    rarity: 'legendary',
    narrativeTemplate: '天际紫气东来三万里，仙音缥缈。{faction} 某位前辈历劫成功，破碎虚空飞升仙界，余泽润泽后世千年。',
    effectsTemplate: { cultivationMultiplier: 1.1, previousWorldLegacies: '飞升大能遗泽' },
    hints: ['大能飞升', '宗门声望提升', '福泽后世'],
    triggerConditions: { minAge: 200, cooldown: 50 },
  },
  {
    type: 'great_cultivator_falls',
    title: '大修士陨落',
    category: 'cultivator',
    duration: 3,
    rarity: 'epic',
    narrativeTemplate: '天降血雨，{faction} 山门传来哀钟。某位大能坐化/陨落于外敌/心魔。{place} 一带修士皆感寒意。',
    effectsTemplate: { cultivationMultiplier: 0.8 },
    hints: ['大能陨落', '宗门动荡', '灵气减少'],
    triggerConditions: { minAge: 100, cooldown: 30 },
  },
  {
    type: 'ancient_seal_weakens',
    title: '上古封印松动',
    category: 'cultivator',
    duration: -1,
    rarity: 'mythic',
    narrativeTemplate: '万年前封印的某处禁地显出裂隙——妖/魔/古修之墓的封印在岁月侵蚀下松动。{place} 修士皆感压制之力减弱。',
    effectsTemplate: { cultivationMultiplier: 1.0 },
    hints: ['隐藏秘境可入', '危险亦增大', '罕见机缘'],
    triggerConditions: { minAge: 200, cooldown: 50 },
  },
  {
    type: 'ancient_seal_strengthened',
    title: '上古封印加固',
    category: 'cultivator',
    duration: -1,
    rarity: 'legendary',
    narrativeTemplate: '数位大能联手，{place} 上古封印再次巩固。魔气/死气被压回深渊，{faction} 弟子负责巡守。',
    effectsTemplate: { cultivationMultiplier: 0.95 },
    hints: ['封印稳固', '暂无大劫'],
    triggerConditions: { minAge: 100, cooldown: 30, prerequisites: ['ancient_seal_weakens'] },
  },

  // ---------- 仙凡/大劫（5）----------
  {
    type: 'mortal_celestial_open',
    title: '仙凡通道开启',
    category: 'mortal_celestial',
    duration: 10,
    rarity: 'legendary',
    narrativeTemplate: '传说中封印的仙凡通道微颤，灵气渗入凡尘。散落人间的灵根开始觉醒，平民少年亦有仙缘。',
    effectsTemplate: { rootMultiplierBoost: 0.1 },
    hints: ['灵根觉醒者增多', '凡间灵气涌现', '持续 10 年'],
    triggerConditions: { minAge: 16, cooldown: 30 },
  },
  {
    type: 'mortal_celestial_close',
    title: '仙凡通道关闭',
    category: 'mortal_celestial',
    duration: 20,
    rarity: 'epic',
    narrativeTemplate: '仙凡通道缓缓闭合。灵气外渗停止，凡间散修修炼愈加艰难。新灵根觉醒者骤降。',
    effectsTemplate: { rootMultiplierBoost: -0.05 },
    hints: ['灵根觉醒减少', '凡间灵气低迷'],
    triggerConditions: { minAge: 16, cooldown: 20, prerequisites: ['mortal_celestial_open'] },
  },
  {
    type: 'mortal_celestial_war',
    title: '仙凡大战',
    category: 'mortal_celestial',
    duration: 5,
    rarity: 'epic',
    narrativeTemplate: '仙凡交恶！凡间王朝仰仗新得灵气扩张，{place} 周边摩擦骤升。修士与凡间兵卒时有冲突。',
    effectsTemplate: { cultivationMultiplier: 0.7 },
    hints: ['凡间介入', '散修被杀', '灵气回流'],
    triggerConditions: { minAge: 50, cooldown: 30, prerequisites: ['mortal_celestial_open'] },
  },
  {
    type: 'mortal_celestial_peace',
    title: '仙凡和解',
    category: 'mortal_celestial',
    duration: 10,
    rarity: 'rare',
    narrativeTemplate: '仙凡签订互不侵犯之约。{faction} 与凡间王朝各退一步，{place} 一带秩序恢复。',
    effectsTemplate: { cultivationMultiplier: 1.05 },
    hints: ['秩序恢复', '灵气稳定'],
    triggerConditions: { minAge: 50, cooldown: 15, prerequisites: ['mortal_celestial_war'] },
  },
  {
    type: 'catastrophe_imminent',
    title: '大劫将至',
    category: 'catastrophe',
    duration: 1,
    rarity: 'mythic',
    narrativeTemplate: '天机紊乱，{place} 一带灵气狂暴异常。{faction} 长辈焚香卜卦，皆言：大劫将至。',
    effectsTemplate: { cultivationMultiplier: 0.6 },
    hints: ['天机异象', '灵气异常', '凶兆'],
    triggerConditions: { minAge: 200, cooldown: 50, prerequisites: ['demon_invasion'] },
  },

  // ---------- 宗门（2）----------
  {
    type: 'sect_tournament',
    title: '仙门大比',
    category: 'sect',
    duration: 1,
    rarity: 'epic',
    narrativeTemplate: '{faction} 等几大仙门联合举办大比，{place} 宾客云集。天才辈出，胜者得名得资源。',
    effectsTemplate: { cultivationMultiplier: 1.3, threadTitle: '仙门大比', threadSummary: '仙门大比在 nearby 召开，可以前往观摩或参与。' },
    hints: ['比试机缘', '可获得名次', '宗门声望', '前往观摩'],
    triggerConditions: { minAge: 16, maxAge: 500, minRealm: 'foundation', cooldown: 5 },
  },
  {
    type: 'sect_civil_war',
    title: '仙门内战',
    category: 'sect',
    duration: 5,
    rarity: 'epic',
    narrativeTemplate: '{faction} 内部因理念/利益分裂为两派，{place} 山门染血。长老对峙，弟子各选其主。',
    effectsTemplate: { cultivationMultiplier: 0.7, lifespanModifier: -5 },
    hints: ['师门内乱', '两派对立', '凡亲近其中一派'],
    triggerConditions: { minAge: 30, cooldown: 30 },
  },

  // ---------- 秘境（2）----------
  {
    type: 'ancient_cave_open',
    title: '古修洞府开启',
    category: 'cave',
    duration: 1,
    rarity: 'rare',
    narrativeTemplate: '深山古洞之中，禁制因岁月侵蚀而松动。{place} 附近的修士纷纷前往，传闻此地曾为上古大能闭关之所。',
    effectsTemplate: { threadTitle: '古修洞府', threadSummary: '某处古修遗留洞府禁制松动，机缘巧合之下重见天日。' },
    hints: ['秘府现世', '可前往探索', '伴生异宝/传承'],
    triggerConditions: { minAge: 16, maxAge: 800, cooldown: 5 },
  },
  {
    type: 'ancient_cave_explored',
    title: '古修洞府探完',
    category: 'cave',
    duration: 1,
    rarity: 'uncommon',
    narrativeTemplate: '{place} 古修洞府已被高阶修士探完，禁制渐次合拢。来晚一步者只余残垣断壁与道听途说。',
    effectsTemplate: {},
    hints: ['秘府关闭', '来晚一步', '道听途说'],
    triggerConditions: { minAge: 16, cooldown: 3, prerequisites: ['ancient_cave_open'] },
  },
];

// 把 TEMPLATE_BUILDERS 转成完整 WorldEventTemplate 数组（运行时只读）
export const WORLD_EVENT_TEMPLATES: WorldEventTemplate[] = TEMPLATE_BUILDERS.map(b => ({
  type: b.type,
  title: b.title,
  category: b.category,
  narrativeTemplate: b.narrativeTemplate,
  effectsTemplate: b.effectsTemplate,
  triggerConditions: b.triggerConditions,
  duration: b.duration,
  rarity: b.rarity,
  hints: b.hints,
}));

export const WORLD_EVENT_TYPES: WorldEventType[] = WORLD_EVENT_TEMPLATES.map(t => t.type);

// 模板按 type 索引
const TEMPLATE_BY_TYPE: Record<WorldEventType, WorldEventTemplate> = (() => {
  const m = {} as Record<string, WorldEventTemplate>;
  for (const t of WORLD_EVENT_TEMPLATES) m[t.type] = t;
  return m as Record<WorldEventType, WorldEventTemplate>;
})();

// ============================================================
// realm 排序（用于 minRealm 过滤）
// ============================================================

const REALM_ORDER: string[] = [
  '凡人', '炼气期', '筑基期', '金丹期', '元婴期',
  '化神期', '炼虚期', '合体期', '大乘期', '渡劫期',
];

const REALM_ALIASES: Record<string, number> = {
  // 中文
  '凡人': 0, '炼气期': 1, '筑基期': 2, '金丹期': 3,
  '元婴期': 4, '化神期': 5, '炼虚期': 6, '合体期': 7,
  '大乘期': 8, '渡劫期': 9,
  // 英文
  'mortal': 0, 'qi_refining': 1, 'qi refining': 1,
  'foundation': 2, 'foundation_building': 2,
  'core_formation': 3, 'core formation': 3, 'golden_core': 3,
  'nascent_soul': 4, 'nascent soul': 4,
  'soul_transformation': 5, 'soul formation': 5,
  'void_refinement': 6, 'void refinement': 6,
  'integration': 7, 'mahayana': 8, 'tribulation': 9,
  // 短别名
  '炼气': 1, '筑基': 2, '金丹': 3, '元婴': 4,
  '化神': 5, '炼虚': 6, '合体': 7, '大乘': 8, '渡劫': 9,
};

export function realmRank(realm: string | undefined | null): number {
  if (!realm) return -1;
  const norm = String(realm).trim().toLowerCase();
  // 别名表精确匹配
  if (norm in REALM_ALIASES) return REALM_ALIASES[norm];
  if (realm in REALM_ALIASES) return REALM_ALIASES[realm];
  // 包含匹配
  const idx = REALM_ORDER.findIndex(r => realm.includes(r) || r.includes(realm));
  if (idx >= 0) return idx;
  // 启发式 fallback
  if (realm.includes('渡劫')) return 9;
  if (realm.includes('大乘')) return 8;
  if (realm.includes('合体')) return 7;
  if (realm.includes('炼虚')) return 6;
  if (realm.includes('化神')) return 5;
  if (realm.includes('元婴')) return 4;
  if (realm.includes('金丹')) return 3;
  if (realm.includes('筑基')) return 2;
  if (realm.includes('炼气')) return 1;
  if (realm.includes('凡人')) return 0;
  return -1;
}

// ============================================================
// getAvailableEvents：按当前 state + worldTime + history 过滤可触发模板
// ============================================================

export interface AvailableEventsFilterOpts {
  /** 最大返回模板数（按 rarity / 优先级截断）；默认 10 */
  limit?: number;
}

export function getAvailableEvents(
  state: any,
  worldTime: { eraName: string; calendarYear: number; elapsedDays: number } | undefined,
  history: WorldEvent[],
  opts: AvailableEventsFilterOpts = {},
): WorldEventTemplate[] {
  const age = Number(state?.age ?? 0);
  const realm = String(state?.realm ?? state?.realmName ?? '');
  const ethnicity = String(state?.ethnicity ?? state?.种族 ?? '');
  const lineage = String(state?.lineage ?? state?.出身 ?? state?.origin ?? '');
  const legacyStr = JSON.stringify(state?.previousWorldLegacies ?? []);
  const limit = opts.limit ?? 10;

  // 当前已 active 的事件类型（用于 excludedIf 判定）
  const activeTypes = new Set<string>(
    Array.isArray(state?.worldEvent?.activeEvents)
      ? state.worldEvent.activeEvents.map((a: any) => a?.event?.type).filter(Boolean)
      : [],
  );
  // 历史事件类型（用于 prerequisites & excludedIf）
  const historyTypes = new Set<string>((history ?? []).map(e => e?.type).filter(Boolean));
  // 合并 active + history（active 视为已发生）
  const triggered = new Set<string>([...activeTypes, ...historyTypes]);

  const available: WorldEventTemplate[] = [];
  for (const tpl of WORLD_EVENT_TEMPLATES) {
    const cond = tpl.triggerConditions;
    // 1. age 区间
    if (cond.minAge !== undefined && age < cond.minAge) continue;
    if (cond.maxAge !== undefined && age > cond.maxAge) continue;
    // 2. minRealm
    if (cond.minRealm) {
      const need = realmRank(cond.minRealm);
      const have = realmRank(realm);
      if (need >= 0 && have >= 0 && have < need) continue;
    }
    // 3. 族裔
    if (cond.applicableEthnicity && cond.applicableEthnicity.length > 0) {
      if (!cond.applicableEthnicity.includes('*') && !cond.applicableEthnicity.includes(ethnicity)) continue;
    }
    // 4. 出身
    if (cond.applicableLineage && cond.applicableLineage.length > 0) {
      if (!cond.applicableLineage.includes('*') && !cond.applicableLineage.includes(lineage)) continue;
    }
    // 5. cooldown（距上次同类事件最少 N 年）
    if (cond.cooldown > 0) {
      const lastSame = (history ?? [])
        .filter(e => e.type === tpl.type)
        .sort((a, b) => b.triggeredAge - a.triggeredAge)[0];
      if (lastSame && age - lastSame.triggeredAge < cond.cooldown) continue;
    }
    // 6. prerequisites（必须已发生）
    if (cond.prerequisites && cond.prerequisites.length > 0) {
      if (!cond.prerequisites.every(p => triggered.has(p))) continue;
    }
    // 7. excludedIf（不能与这些事件并发或已发生）
    if (cond.excludedIf && cond.excludedIf.length > 0) {
      if (cond.excludedIf.some(t => triggered.has(t))) continue;
    }
    available.push(tpl);
  }

  // 优先级：mythic > legendary > epic > rare > uncommon > common；
  // 同级按 cooldown 升序（容易触发的优先）
  const rarityRank: Record<WorldEventRarity, number> = {
    mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1,
  };
  available.sort((a, b) => {
    const r = rarityRank[b.rarity] - rarityRank[a.rarity];
    if (r !== 0) return r;
    return a.triggerConditions.cooldown - b.triggerConditions.cooldown;
  });
  return available.slice(0, limit);
}

// ============================================================
// applyEventTemplate：根据模板构造完整 WorldEvent 并注入 finalState
// ============================================================

export function applyEventTemplate(
  template: WorldEventTemplate,
  state: any,
  worldTime: { eraName: string; calendarYear: number; elapsedDays: number } | undefined,
): WorldEvent {
  const age = Number(state?.age ?? 0);
  const wt = worldTime ?? { eraName: 'default', calendarYear: age, elapsedDays: age * 365 };
  return {
    id: `we-${template.type}-${age}-${Math.floor(Math.random() * 100000)}`,
    type: template.type,
    triggeredAge: age,
    triggeredWorldTime: { ...wt },
    duration: template.duration,
    effects: { ...template.effectsTemplate },
    narrative: template.narrativeTemplate,
    appliedTo: (template.category === 'demon' || template.category === 'beast' || template.category === 'beast_tide' || template.category === 'spirit' || template.category === 'era')
      ? 'all' : 'this',
  };
}

// 解析 narrative 中的 [WORLD_EVENT:type]...[/WORLD_EVENT] 标记
// 返回该次触发的事件；若没有标记返回 null
export function parseWorldEventMarkers(
  narrative: string,
  state: any,
  worldTime: { eraName: string; calendarYear: number; elapsedDays: number } | undefined,
  history: WorldEvent[],
): { event: WorldEvent; matchedText: string } | null {
  if (!narrative) return null;
  // 支持 [WORLD_EVENT:type] 简写 + [WORLD_EVENT:type]...[/WORLD_EVENT] 完整块
  const re = /\[WORLD_EVENT:\s*([a-z_]+)\s*\]([\s\S]*?)\[\/WORLD_EVENT\]|\[WORLD_EVENT:\s*([a-z_]+)\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(narrative)) !== null) {
    const eventType = (m[1] ?? m[3]) as WorldEventType;
    const innerText = (m[2] ?? '').trim();
    const tpl = TEMPLATE_BY_TYPE[eventType];
    if (!tpl) continue;
    // 再次过滤：LLM 也可能输出不在 getAvailableEvents 里的类型（直接尝试构造）
    // 但要满足 prerequisites/cooldown 等条件才注入
    if (!isTemplateEligible(tpl, state, worldTime, history)) continue;
    const event = applyEventTemplate(tpl, state, worldTime);
    // 把 innerText 当 narrative（保留 LLM 详细描述）
    if (innerText) event.narrative = innerText;
    return { event, matchedText: m[0] };
  }
  return null;
}

// 测试 helper：判断某个模板在当前 state 下可否触发（不过滤 limit）
export function isTemplateEligible(
  template: WorldEventTemplate,
  state: any,
  _worldTime: any,
  history: WorldEvent[],
): boolean {
  const age = Number(state?.age ?? 0);
  const realm = String(state?.realm ?? state?.realmName ?? '');
  const ethnicity = String(state?.ethnicity ?? '');
  const lineage = String(state?.lineage ?? state?.origin ?? '');
  const cond = template.triggerConditions;
  if (cond.minAge !== undefined && age < cond.minAge) return false;
  if (cond.maxAge !== undefined && age > cond.maxAge) return false;
  if (cond.minRealm) {
    const need = realmRank(cond.minRealm);
    const have = realmRank(realm);
    if (need >= 0 && have >= 0 && have < need) return false;
  }
  if (cond.applicableEthnicity && cond.applicableEthnicity.length > 0 && !cond.applicableEthnicity.includes('*')) {
    if (!cond.applicableEthnicity.includes(ethnicity)) return false;
  }
  if (cond.applicableLineage && cond.applicableLineage.length > 0 && !cond.applicableLineage.includes('*')) {
    if (!cond.applicableLineage.includes(lineage)) return false;
  }
  if (cond.cooldown > 0) {
    const lastSame = (history ?? [])
      .filter(e => e.type === template.type)
      .sort((a, b) => b.triggeredAge - a.triggeredAge)[0];
    if (lastSame && age - lastSame.triggeredAge < cond.cooldown) return false;
  }
  if (cond.prerequisites && cond.prerequisites.length > 0) {
    const trig = new Set((history ?? []).map(e => e.type));
    if (!cond.prerequisites.every(p => trig.has(p))) return false;
  }
  if (cond.excludedIf && cond.excludedIf.length > 0) {
    const trig = new Set((history ?? []).map(e => e.type));
    if (cond.excludedIf.some(t => trig.has(t))) return false;
  }
  return true;
}

// ============================================================
// 构建 advance prompt 注入文本：天道传入当前可触发模板
// ============================================================

export function buildAvailableWorldEventsPrompt(
  state: any,
  worldTime: { eraName: string; calendarYear: number; elapsedDays: number } | undefined,
  history: WorldEvent[],
  opts: { maxItems?: number } = {},
): string {
  const maxItems = opts.maxItems ?? 8;
  const available = getAvailableEvents(state, worldTime, history, { limit: maxItems });
  if (available.length === 0) {
    return `【世界级事件·按当前档决定】
- 当前档无可触发世界级事件模板（可能因年龄/境界/冷却/前置条件不满足）。
- LLM 可自主判断是否仍要触发"前所未有"的事件（不在模板库中），如纳入 narrative 文末即可。
- 若不触发，本年 narrative 末尾可写"今年天下太平，无大事发生"自然收尾。`;
  }
  const lines = available.map(t => {
    const eff = t.effectsTemplate;
    const effStrs: string[] = [];
    if (eff.cultivationMultiplier !== undefined) effStrs.push(`修炼倍率×${eff.cultivationMultiplier}`);
    if (eff.lifespanModifier !== undefined) effStrs.push(`寿元${eff.lifespanModifier > 0 ? '+' : ''}${eff.lifespanModifier}`);
    if (eff.rootMultiplierBoost !== undefined) effStrs.push(`灵根倍率${eff.rootMultiplierBoost > 0 ? '+' : ''}${eff.rootMultiplierBoost}`);
    if (eff.threadTitle) effStrs.push(`新增线索「${eff.threadTitle}」`);
    if (eff.previousWorldLegacies) effStrs.push(`遗留「${eff.previousWorldLegacies}」`);
    return `- ${t.type}（${t.rarity}，${t.title}）：提示=${t.hints.slice(0, 2).join('；') || '无'}；影响=${effStrs.join('，') || '叙事为主'}; cooldown=${t.triggerConditions.cooldown} 年`;
  });
  return `【世界级事件·按当前档决定】
天道传入当前可触发事件模板（按 age/realm/族裔/出身/cooldown/prerequisites 已过滤；最多列 ${maxItems} 个）：
${lines.join('\n')}

要求：
- 根据角色当前状态（年龄/灵根/realm/族裔/出生地/最近 5 年事件 + 天道大势），**自主决定**本年是否触发 0-1 个世界级事件
- 触发时：把 narrativeTemplate 自然融入本年 narrative，并显式标注 \`[WORLD_EVENT: {type}] ... [/WORLD_EVENT]\`（不要照抄模板原文，要用角色所见所闻折射）
- 不触发：理由可写在 narrative 末尾（如"今年天下太平，无大事发生"）
- 事件须**自然嵌入**——不是平铺直叙"XXX事件发生"，而是通过角色所见所闻（茶肆谈论/集市传闻/宗门告示/长老传话）折射
- 同年内**不重复**同类事件（cooldown 强制；type 列表内已过滤）
- 长事件（持续多年）须在 narrative 显式表达影响（如"灵潮已三载未复"）
- 事件与个人剧情**互不干扰**——可以同时触发，但不强制关联
- 决策依据：若 previousWorldLegacies 含"末法"线索，可在适龄触发末法相关事件；若族裔为某族，可结合该族特点
- 若无模板适合、但 narrative 自然出现事件，可不标 [WORLD_EVENT] 标记，引擎会走 fallback 路径`;
}

// ============================================================
// 兼容旧 API：fallbackRollWorldEvent（LLM 不输出 [WORLD_EVENT] 标记时调用）
// 保留 7 种历史事件的随机 roll 逻辑（向后兼容）
// ============================================================

const FALLBACK_CONFIGS: Record<WorldEventType, WorldEventConfig> = {
  spirit_tide_low: {
    type: 'spirit_tide_low', duration: 5,
    cultivationMultiplier: 0.3,
    statusName: '灵气枯竭', statusId: 'world-event-spirit-tide-low',
    statusDescription: () => '灵潮衰退，灵气稀薄，修炼事倍功半。',
    narrativeTemplate: '灵气如潮水退去，九州天地元气骤然稀薄。修炼者皆感突破艰难，仿佛整片天地都在沉睡。',
  },
  spirit_tide_high: {
    type: 'spirit_tide_high', duration: 3,
    cultivationMultiplier: 2.0,
    statusName: '灵潮复苏', statusId: 'world-event-spirit-tide-high',
    statusDescription: () => '灵潮复涌，天地元气充沛，修炼一日千里。',
    narrativeTemplate: '沉睡千年的灵脉重新涌动，天降灵雨，万物复苏。修士们奔走相告：这是大世之兆！',
  },
  demon_invasion: {
    type: 'demon_invasion', duration: 3,
    cultivationMultiplier: 0.5, lifespanModifier: -10,
    statusName: '魔劫', statusId: 'world-event-demon-invasion',
    statusDescription: () => '魔道大能兴风作浪，九州血色弥漫。',
    narrativeTemplate: '极北冰原之下，魔道大能破封而出。九州修仙界风云变色，正道与魔道的千年恩怨再次点燃。',
  },
  beast_invasion: {
    type: 'beast_invasion', duration: 2,
    cultivationMultiplier: 1.5,
    statusName: '妖劫', statusId: 'world-event-beast-invasion',
    statusDescription: () => '妖界动荡，妖王率众南下，弱者被淘汰。',
    narrativeTemplate: '妖界动荡，妖王率众越过万妖山脉南下。山野之间妖兽啸月，弱者被淘汰，强者于血火中诞生。',
  },
  mortal_celestial_open: {
    type: 'mortal_celestial_open', duration: 10,
    rootMultiplierBoost: 0.1,
    statusName: '仙凡交融', statusId: 'world-event-mortal-celestial-open',
    statusDescription: () => '仙凡通道微启，凡尘之中灵根觉醒者增多。',
    narrativeTemplate: '传说中封印的仙凡通道微微颤动，灵气渗入凡尘。散落人间的灵根开始觉醒，平民少年亦有仙缘。',
  },
  ancient_cave_open: {
    type: 'ancient_cave_open', duration: 1,
    threadTitle: '古修洞府', threadSummary: '某处古修遗留洞府禁制松动，机缘巧合之下重见天日。',
    statusName: '古修遗府', statusId: 'world-event-ancient-cave-open',
    statusDescription: (age) => `古修洞府于 ${age} 岁开启，引得四方云动。`,
    narrativeTemplate: '深山古洞之中，禁制因岁月侵蚀而松动。传闻此地曾为上古大能闭关之所，遗留秘宝无数。',
  },
  great_cultivator_ascend: {
    type: 'great_cultivator_ascend', duration: 5,
    cultivationMultiplier: 1.1,
    statusName: '大修士飞升', statusId: 'world-event-great-ascend',
    statusDescription: () => '有大能破界飞升，余泽润泽后世。',
    narrativeTemplate: '天际紫气东来三万里，仙音缥缈。有大修士历劫成功，破碎虚空飞升仙界，余泽润泽后世千年。',
  },
  // 兜底：未列出的事件类型共享通用配置
  demon_pushed_back: FALLBACK_GENERIC('demon_pushed_back', '魔道败退', 'world-event-demon-pushed-back'),
  demonic_sect_rises: FALLBACK_GENERIC('demonic_sect_rises', '邪修崛起', 'world-event-demonic-sect-rises', 0.85),
  demonic_sect_destroyed: FALLBACK_GENERIC('demonic_sect_destroyed', '邪修剿灭', 'world-event-demonic-sect-destroyed', 1.2),
  beast_calmed: FALLBACK_GENERIC('beast_calmed', '妖族平定', 'world-event-beast-calmed', 1.05),
  beast_tide: {
    type: 'beast_tide', duration: 1,
    cultivationMultiplier: 2.0,
    statusName: '妖兽潮', statusId: 'world-event-beast-tide',
    statusDescription: () => '万妖齐出，凡尘大乱。',
    narrativeTemplate: '万妖山脉大乱，兽潮如海浪般涌向九州。修士纷纷下山护凡，城池接连告急。',
  },
  beast_tide_calmed: FALLBACK_GENERIC('beast_tide_calmed', '妖兽潮平息', 'world-event-beast-tide-calmed', 0.9),
  holy_beast_descends: {
    type: 'holy_beast_descends', duration: 5,
    cultivationMultiplier: 1.8, rootMultiplierBoost: 0.08,
    statusName: '圣兽降世', statusId: 'world-event-holy-beast-descends',
    statusDescription: () => '圣兽祥瑞，灵气暴涨。',
    narrativeTemplate: '天现彩凤/青龙/玄武虚影，祥瑞临世。灵气暴涨，灵草疯长，修士纷纷前往朝圣。',
  },
  holy_beast_retreats: FALLBACK_GENERIC('holy_beast_retreats', '圣兽隐退', 'world-event-holy-beast-retreats', 0.8),
  rare_treasure_surfaces: {
    type: 'rare_treasure_surfaces', duration: 1,
    statusName: '异宝出世', statusId: 'world-event-rare-treasure-surfaces',
    statusDescription: () => '异宝现世，修士云集。',
    narrativeTemplate: '异象纷呈，灵光冲天。某处洞府/遗迹开启，修士云集。',
  },
  rare_treasure_taken: FALLBACK_GENERIC('rare_treasure_taken', '异宝被夺', 'world-event-rare-treasure-taken'),
  great_cultivator_falls: {
    type: 'great_cultivator_falls', duration: 3,
    cultivationMultiplier: 0.8,
    statusName: '大修士陨落', statusId: 'world-event-great-cultivator-falls',
    statusDescription: () => '大能陨落，灵气衰微。',
    narrativeTemplate: '天降血雨，山门传来哀钟。某位大能坐化或陨落，灵气一时衰微。',
  },
  ancient_seal_weakens: FALLBACK_GENERIC('ancient_seal_weakens', '上古封印松动', 'world-event-ancient-seal-weakens'),
  ancient_seal_strengthened: FALLBACK_GENERIC('ancient_seal_strengthened', '上古封印加固', 'world-event-ancient-seal-strengthened', 0.95),
  mortal_celestial_close: {
    type: 'mortal_celestial_close', duration: 20,
    rootMultiplierBoost: -0.05,
    statusName: '仙凡通道关闭', statusId: 'world-event-mortal-celestial-close',
    statusDescription: () => '灵气外渗停止，凡间散修艰难。',
    narrativeTemplate: '仙凡通道缓缓闭合，灵气外渗停止。凡间散修修炼愈加艰难，新灵根觉醒者骤降。',
  },
  mortal_celestial_war: {
    type: 'mortal_celestial_war', duration: 5,
    cultivationMultiplier: 0.7,
    statusName: '仙凡大战', statusId: 'world-event-mortal-celestial-war',
    statusDescription: () => '仙凡交恶，修士与凡人冲突。',
    narrativeTemplate: '凡间王朝仰仗新得灵气扩张，仙凡交恶。修士与凡间兵卒时有冲突。',
  },
  mortal_celestial_peace: FALLBACK_GENERIC('mortal_celestial_peace', '仙凡和解', 'world-event-mortal-celestial-peace', 1.05),
  catastrophe_imminent: {
    type: 'catastrophe_imminent', duration: 1,
    cultivationMultiplier: 0.6,
    statusName: '大劫将至', statusId: 'world-event-catastrophe-imminent',
    statusDescription: () => '天机紊乱，凶兆。',
    narrativeTemplate: '天机紊乱，灵气狂暴异常。宗门长辈卜卦皆言：大劫将至。',
  },
  dao_blessing: {
    type: 'dao_blessing', duration: 2,
    cultivationMultiplier: 1.5, rootMultiplierBoost: 0.05,
    statusName: '天道垂青', statusId: 'world-event-dao-blessing',
    statusDescription: () => '天道眷顾，悟道加速。',
    narrativeTemplate: '天心澄明，灵气自然汇顶。修士皆感悟道微光。',
  },
  dao_warning: {
    type: 'dao_warning', duration: 1,
    cultivationMultiplier: 0.8,
    statusName: '天道警告', statusId: 'world-event-dao-warning',
    statusDescription: () => '天道警示，修士心惊。',
    narrativeTemplate: '天现血月，凡人亦有不安。这是天道对修士的警示。',
  },
  mofa_era_begins: {
    type: 'mofa_era_begins', duration: 50,
    cultivationMultiplier: 0.2, lifespanModifier: -20,
    statusName: '末法时代降临', statusId: 'world-event-mofa-era-begins',
    statusDescription: () => '灵气外散，仙门凋零。',
    narrativeTemplate: '灵气外散，灵脉枯竭。修仙界凋零，宗门关闭山门隐世。',
  },
  mofa_era_ends: {
    type: 'mofa_era_ends', duration: 10,
    cultivationMultiplier: 1.5,
    statusName: '末法时代终结', statusId: 'world-event-mofa-era-ends',
    statusDescription: () => '灵气回归。',
    narrativeTemplate: '封闭的灵脉重开，灵气重新灌入九州。新修行时代开启。',
  },
  sect_tournament: {
    type: 'sect_tournament', duration: 1,
    cultivationMultiplier: 1.3,
    threadTitle: '仙门大比', threadSummary: '仙门大比召开，附近宗门共襄盛举。',
    statusName: '仙门大比', statusId: 'world-event-sect-tournament',
    statusDescription: () => '仙门大比召开，修士云集。',
    narrativeTemplate: '几大仙门联合举办大比，宾客云集。天骄辈出，胜者得名得资源。',
  },
  sect_civil_war: {
    type: 'sect_civil_war', duration: 5,
    cultivationMultiplier: 0.7, lifespanModifier: -5,
    statusName: '仙门内战', statusId: 'world-event-sect-civil-war',
    statusDescription: () => '宗门内乱，弟子各选其主。',
    narrativeTemplate: '宗门内因理念分裂为两派，山门染血。长老对峙，弟子各选其主。',
  },
  ancient_cave_explored: FALLBACK_GENERIC('ancient_cave_explored', '古修洞府探完', 'world-event-ancient-cave-explored'),
};

function FALLBACK_GENERIC(type: WorldEventType, statusName: string, statusId: string, cultivationMultiplier?: number): WorldEventConfig {
  return {
    type, duration: 1,
    ...(cultivationMultiplier !== undefined ? { cultivationMultiplier } : {}),
    statusName, statusId,
    statusDescription: () => `${statusName}。`,
    narrativeTemplate: statusName + '。',
  };
}

interface WorldEventConfig {
  type: WorldEventType;
  duration: number;
  cultivationMultiplier?: number;
  lifespanModifier?: number;
  rootMultiplierBoost?: number;
  threadTitle?: string;
  threadSummary?: string;
  statusName: string;
  statusId: string;
  statusDescription: (age: number) => string;
  narrativeTemplate: string;
}

// 旧 API 兼容：fallbackRollWorldEvent
export function fallbackRollWorldEvent(
  state: any,
  worldTime?: { eraName: string; calendarYear: number; elapsedDays: number },
  randomFn: () => number = Math.random,
): WorldEvent | null {
  const age = Number(state?.age ?? 0);
  if (!Number.isFinite(age) || age < 30) return null;
  const existing = (state?.worldEvent?.activeEvents ?? []) as ActiveWorldEvent[];
  if (existing.some(a => a.event.triggeredAge >= age - 1)) return null;

  const roll = randomFn();
  const wt = worldTime ?? { eraName: 'default', calendarYear: age, elapsedDays: age * 365 };
  const hasRecentTideLow = existing.some(a => a.event.type === 'spirit_tide_low');

  if (age < 100) {
    if (roll < 0.008) return makeFallbackEvent('ancient_cave_open', age, wt);
    if (roll < 0.008 + 0.005) return makeFallbackEvent('demon_invasion', age, wt);
    return null;
  }
  if (age < 500) {
    if (roll < 0.005) return makeFallbackEvent('ancient_cave_open', age, wt);
    if (roll < 0.005 + 0.003) return makeFallbackEvent('demon_invasion', age, wt);
    if (roll < 0.008 + 0.002) return makeFallbackEvent('beast_invasion', age, wt);
    if (roll < 0.010 + 0.001) return makeFallbackEvent('spirit_tide_low', age, wt);
    if (hasRecentTideLow && roll < 0.012) return makeFallbackEvent('spirit_tide_high', age, wt);
    if (roll < 0.012 + 0.0005) return makeFallbackEvent('mortal_celestial_open', age, wt);
    return null;
  }
  if (roll < 0.002) return makeFallbackEvent('demon_invasion', age, wt);
  if (roll < 0.002 + 0.0015) return makeFallbackEvent('beast_invasion', age, wt);
  if (roll < 0.0035 + 0.001) return makeFallbackEvent('spirit_tide_low', age, wt);
  if (roll < 0.0045 + 0.0005) return makeFallbackEvent('great_cultivator_ascend', age, wt);
  if (hasRecentTideLow && roll < 0.0055) return makeFallbackEvent('spirit_tide_high', age, wt);
  if (roll < 0.0055 + 0.001) return makeFallbackEvent('mortal_celestial_open', age, wt);
  return null;
}

function makeFallbackEvent(
  type: WorldEventType,
  age: number,
  worldTime: { eraName: string; calendarYear: number; elapsedDays: number },
): WorldEvent {
  const cfg = FALLBACK_CONFIGS[type] ?? FALLBACK_GENERIC(type, type, `world-event-${type}`);
  return {
    id: `we-fb-${type}-${age}-${Math.floor(Math.random() * 100000)}`,
    type,
    triggeredAge: age,
    triggeredWorldTime: { ...worldTime },
    duration: cfg.duration,
    effects: {
      cultivationMultiplier: cfg.cultivationMultiplier,
      lifespanModifier: cfg.lifespanModifier,
      rootMultiplierBoost: cfg.rootMultiplierBoost,
      threadTitle: cfg.threadTitle,
      threadSummary: cfg.threadSummary,
    },
    narrative: cfg.narrativeTemplate + `（${age}岁）`,
    appliedTo: type === 'demon_invasion' || type === 'beast_invasion' || type === 'spirit_tide_low' || type === 'spirit_tide_high'
      ? 'all' : 'this',
  };
}

// 向后兼容旧 API：rollWorldEvent = fallbackRollWorldEvent
export const rollWorldEvent = fallbackRollWorldEvent;

// ============================================================
// apply 函数（inject finalState）
// ============================================================

export function applyWorldEvent(state: any, event: WorldEvent): any {
  const newState: any = { ...state };
  const cfg = FALLBACK_CONFIGS[event.type];

  const existingWE: WorldEventState = newState.worldEvent ?? {
    lastRollAge: 0,
    activeEvents: [],
    history: [],
  };
  let combinedMultiplier = 1.0;
  const allActive = [...existingWE.activeEvents.map(a => a.event), event];
  for (const ev of allActive) {
    const m = ev.effects.cultivationMultiplier;
    if (typeof m === 'number') combinedMultiplier *= m;
  }

  const newActive: ActiveWorldEvent[] = [
    ...existingWE.activeEvents,
    { event, remainingYears: event.duration },
  ];

  newState.worldEvent = {
    lastRollAge: event.triggeredAge,
    activeEvents: newActive,
    history: [...existingWE.history, event].slice(-100), // 扩到 100 便于长程 history 过滤
  };

  if (event.effects.cultivationMultiplier !== undefined) {
    const priorCombined = existingWE.activeEvents.reduce((acc, a) => {
      const m = a.event.effects.cultivationMultiplier;
      return typeof m === 'number' ? acc * m : acc;
    }, 1.0);
    const currentMul = Number(newState.cultivationMultiplier ?? 1.0);
    const baseMul = priorCombined === 0 ? currentMul : currentMul / priorCombined;
    newState.cultivationMultiplier = baseMul * combinedMultiplier;
  }

  if (event.effects.lifespanModifier !== undefined && typeof newState.lifespan === 'number') {
    newState.lifespan = Math.max(1, newState.lifespan + event.effects.lifespanModifier);
  }

  if (event.effects.rootMultiplierBoost !== undefined && typeof newState.rootMultiplier === 'number') {
    newState.rootMultiplier = newState.rootMultiplier + event.effects.rootMultiplierBoost;
  }

  // 注入 statusList / statusJson
  const statusList: any[] = Array.isArray(newState.statusList)
    ? [...newState.statusList]
    : (Array.isArray(newState.activeStatuses) ? [...newState.activeStatuses] : []);
  if (cfg && !statusList.some((s: any) => s && s.id === cfg.statusId)) {
    statusList.push({
      id: cfg.statusId,
      name: cfg.statusName,
      category: 'world',
      rarity: 'legendary',
      description: cfg.statusDescription(event.triggeredAge),
      source: 'world-event-scheduler',
      duration: event.duration,
      eventType: event.type,
    });
    newState.statusList = statusList;
    newState.statuses = statusList;
    newState.statusJson = JSON.stringify(statusList);
  }

  // 注入 pendingThread
  if (event.effects.threadTitle) {
    const threads: any[] = Array.isArray(newState.pendingThreads) ? [...newState.pendingThreads] : [];
    if (!threads.some((t: any) => t && t.title === event.effects.threadTitle)) {
      threads.push({
        title: event.effects.threadTitle,
        description: event.effects.threadSummary ?? event.narrative,
        category: 'world-event',
        urgency: 'medium',
        deadlineAge: event.triggeredAge + event.duration * 12,
        source: 'world-event-scheduler',
      });
      newState.pendingThreads = threads;
    }
  }

  if (event.type === 'great_cultivator_ascend') {
    const legacies: any[] = Array.isArray(newState.previousWorldLegacies) ? [...newState.previousWorldLegacies] : [];
    legacies.push({
      characterName: `飞升大能 ${event.triggeredAge}`,
      status: `${event.triggeredAge} 岁飞升`,
      summary: event.narrative,
      relicSeeds: ['飞升遗泽'],
      legendSeeds: [`飞升者余泽 +10% 修为 ${event.duration} 年`],
    });
    newState.previousWorldLegacies = legacies;
  }

  return newState;
}

// ============================================================
// decay：时间推进移出已结束事件
// ============================================================

export function decayWorldEvents(state: any, yearsAdvanced: number): any {
  if (!state?.worldEvent) return state;
  const newState: any = { ...state };
  const we: WorldEventState = state.worldEvent;
  const dt = Math.max(0, Number(yearsAdvanced) || 0);

  const stillActive: ActiveWorldEvent[] = [];
  const ended: WorldEvent[] = [];

  for (const a of we.activeEvents) {
    const remaining = a.remainingYears - dt;
    if (remaining > 0) {
      stillActive.push({ event: a.event, remainingYears: remaining });
    } else {
      ended.push(a.event);
    }
  }

  if (ended.length > 0) {
    const statusList: any[] = Array.isArray(newState.statusList) ? [...newState.statusList] : [];
    for (const ev of ended) {
      const cfg = FALLBACK_CONFIGS[ev.type];
      if (!cfg) continue;
      const idx = statusList.findIndex((s: any) => s && s.id === cfg.statusId);
      if (idx >= 0) statusList.splice(idx, 1);
    }
    newState.statusList = statusList;
    newState.statuses = statusList;
    newState.statusJson = JSON.stringify(statusList);

    let combinedMultiplier = 1.0;
    for (const a of stillActive) {
      const m = a.event.effects.cultivationMultiplier;
      if (typeof m === 'number') combinedMultiplier *= m;
    }
    if (stillActive.length < we.activeEvents.length) {
      const priorCombined = we.activeEvents.reduce((acc, a) => {
        const m = a.event.effects.cultivationMultiplier;
        return typeof m === 'number' ? acc * m : acc;
      }, 1.0);
      const currentMul = Number(newState.cultivationMultiplier ?? 1.0);
      const baseMul = priorCombined === 0 ? currentMul : currentMul / priorCombined;
      newState.cultivationMultiplier = baseMul * combinedMultiplier;
    }

    for (const ev of ended) {
      if (ev.effects.lifespanModifier !== undefined && typeof newState.lifespan === 'number') {
        newState.lifespan = newState.lifespan - ev.effects.lifespanModifier;
      }
      if (ev.effects.rootMultiplierBoost !== undefined && typeof newState.rootMultiplier === 'number') {
        newState.rootMultiplier = Math.max(0, newState.rootMultiplier - ev.effects.rootMultiplierBoost);
      }
    }
  }

  newState.worldEvent = {
    lastRollAge: we.lastRollAge,
    activeEvents: stillActive,
    history: [...we.history, ...ended].slice(-100),
  };

  return newState;
}

// ============================================================
// 工具
// ============================================================

export function activeCultivationMultiplier(state: any): number {
  const active: ActiveWorldEvent[] = state?.worldEvent?.activeEvents ?? [];
  return active.reduce((acc, a) => {
    const m = a.event.effects.cultivationMultiplier;
    return typeof m === 'number' ? acc * m : acc;
  }, 1.0);
}

export function isUnderWorldEvent(state: any, type: WorldEventType): boolean {
  const active: ActiveWorldEvent[] = state?.worldEvent?.activeEvents ?? [];
  return active.some(a => a.event.type === type);
}

// 兼容旧 API：导出 WorldEventType 数组（旧 7 个 + 新加的）
export const WORLD_EVENT_TYPES_LEGACY: WorldEventType[] = [
  'spirit_tide_low', 'spirit_tide_high', 'demon_invasion', 'beast_invasion',
  'mortal_celestial_open', 'ancient_cave_open', 'great_cultivator_ascend',
];

export function getWorldEventTemplate(type: WorldEventType): WorldEventTemplate | undefined {
  return TEMPLATE_BY_TYPE[type];
}
