// scripts/build-narrative-eval-states.ts
//
// 乙路（状态快照）样本生成器 —— 补甲路缺失的极端态覆盖。
//
// 设计要点（别走偏）：
//   1. **不新造种子设施**。仓里已有确定性伪随机（npc-growth.ts:19 seededRand、
//      advance-fallback.ts:141 年龄哈希种子、settlement.ts:39 stableId），
//      本路要固定的**不是随机数，而是入参快照**：把 CharacterState 写死，
//      再过一遍引擎真实的 buildStateContext(lifecycle.ts:395)，冻结其输出。
//   2. 走真构造器而非手写 JSON：EngineStateContext 的派生字段（神识/魂魄/体魄、
//      神魂境界、境界特性、战斗投影、questEntries、characterIntents、
//      eventSchedule）全部由引擎算，手写必然与引擎脱节。
//   3. 本文件受 tsc 严格检查（无 @ts-nocheck），CharacterState 字段错了编译就红。
//
// 覆盖的极端态（甲路快照库里都没跑到）：
//   混沌灵根 / 渡劫期 / 寿元将尽 / 无灵根凡人 / 多条未决线索并存
//   + 心魔临界 / 神魂严重落后 / 杀业深重 / 濒死重伤 / 天灵根幼龄
//
// 用法：bun scripts/build-narrative-eval-states.ts

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildStateContext } from '../src/lib/xianxia/engine/lifecycle';
import type { CharacterState } from '../src/lib/xianxia/types/character';
import type { PendingThread } from '../src/lib/xianxia/types/event';
import type { StatusEntry } from '../src/lib/xianxia/types/status';

const __dirname_esm = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname_esm, '..');
const OUT_DIR = path.join(REPO, 'tests', 'fixtures', 'narrative-eval', 'state');

// ==================== 基准入参快照 ====================
// 一个中规中矩的炼气期角色。各极端态只覆盖差异字段，便于 diff 时一眼看出变量。

const BASE: CharacterState = {
  id: 'eval-state-base',
  name: '沈砚舟',
  age: 24,
  lifespan: 80,
  gender: '男',
  spiritualRoot: 'common',
  rootDetail: '水木双灵根',
  rootMultiplier: 1.2,
  realm: 'qi_refining',
  realmLevel: 4,
  cultivationExp: 320,
  expToBreak: 600,
  elements: { metal: 10, wood: 40, water: 55, fire: 5, earth: 15 },
  hp: 180, maxHp: 200,
  mp: 90, maxMp: 120,
  attack: 22, defense: 18, speed: 20,
  luck: 30, comprehension: 45,
  spiritStones: 60, reputation: 12,
  alive: true, ascended: false,
  causeOfDeath: '',
  faction: '青岚宗外门', master: '柳砚清', location: '青岚宗外门药圃',
  fateNodes: [],
  isAtChoice: false,
  lastEventAge: 23,
  activeStatuses: [],
  inventory: [],
  equipped: [],
  storageCapacity: 5,
  cultivationMultiplier: 1.2,
  cultivationInsight: '水木双灵根，行气顺水而不滞；宗门药圃活计虽杂，采药之间反能养神。',
  cultivationFactors: [],
  longTermMemory: ['十六岁被青岚宗外门收录，师父柳砚清只说了一句「先把药圃看好」。'],
  npcs: [],
  causalGraph: { nodes: [], edges: [] },
  worldFacts: [],
  pendingThreads: [],
  questEntries: [],
  characterIntents: [],
  combatSession: null,
  heartDemon: 8,
  pets: [],
  exploredRealms: [],
  karma: 0,
  merit: 5,
  sin: 0,
};

// ==================== 复用素材 ====================

function thread(over: Partial<PendingThread> & Pick<PendingThread, 'id' | 'title' | 'description' | 'category' | 'startAge' | 'deadlineAge'>): PendingThread {
  return { status: 'pending', progress: 0, ...over };
}

function status(over: Partial<StatusEntry> & Pick<StatusEntry, 'id' | 'name' | 'description' | 'category' | 'source'>): StatusEntry {
  return { rarity: 'common', duration: -1, effects: [], ...over };
}

// ==================== 十份极端态 ====================

interface StateCase {
  id: string;
  label: string;
  /** 这份快照要压测叙事的哪一面 */
  focus: string;
  /** 甲路为什么覆盖不到 */
  gapReason: string;
  state: CharacterState;
  /** 判分器接上后应重点看的维度 */
  expectedNarrativeTraits: string[];
}

const CASES: StateCase[] = [
  {
    id: 'state-chaos-root-youth',
    label: '混沌灵根 · 幼龄',
    focus: '混沌灵根既是绝品也是隐患，叙事需同时写出宗门争抢与不可控风险',
    gapReason: '快照库 12 个角色灵根为水真/普通，无混沌灵根',
    expectedNarrativeTraits: ['宗门/散修抢夺反应', '不可写成村民失望', '灵根不稳的具体代价'],
    state: {
      ...BASE,
      id: 'eval-state-chaos-root-youth',
      name: '陆无咎', age: 7, lifespan: 82,
      spiritualRoot: 'chaos', rootDetail: '五行俱全的混沌灵根，五气互冲', rootMultiplier: 2.6,
      realm: 'mortal', realmLevel: 0, cultivationExp: 0, expToBreak: 100,
      elements: { metal: 60, wood: 60, water: 60, fire: 60, earth: 60 },
      hp: 40, maxHp: 40, mp: 30, maxMp: 30, attack: 4, defense: 3, speed: 6,
      luck: 70, comprehension: 62, spiritStones: 0, reputation: 0,
      faction: '', master: '', location: '柳溪村外的老槐树下',
      cultivationMultiplier: 2.6,
      cultivationInsight: '五气俱全却互相顶撞，行气一次要歇三日。',
      longTermMemory: ['测灵那天，游方道士捏着灵石看了很久，最后什么也没说就走了。'],
      heartDemon: 0,
      activeStatuses: [
        status({ id: 'st-chaos-conflict', name: '五气互冲', description: '五行灵气在体内彼此顶撞，行气时经脉隐痛，稍不留神就走岔。', category: 'constitution', rarity: 'legendary', source: '混沌灵根天生' }),
      ],
    },
  },
  {
    id: 'state-tribulation-pending',
    label: '渡劫期 · 天劫将至',
    focus: '天劫压力下的行动选择，不能写成轻松过关',
    gapReason: '快照库最高只到炼气/筑基，没有角色走到渡劫',
    expectedNarrativeTraits: ['天劫的具体威压', '闭关/备劫的实际动作', '陨落风险不可回避'],
    state: {
      ...BASE,
      id: 'eval-state-tribulation-pending',
      name: '柳砚清', age: 412, lifespan: 520,
      spiritualRoot: 'pure', rootDetail: '水单灵根，至纯', rootMultiplier: 2.0,
      realm: 'golden_core', realmLevel: 8, cultivationExp: 9800, expToBreak: 10000,
      hp: 2600, maxHp: 3000, mp: 2100, maxMp: 2400, attack: 320, defense: 280, speed: 260,
      luck: 55, comprehension: 78, spiritStones: 4200, reputation: 260,
      faction: '青岚宗内门', master: '', location: '青岚宗后山寒潭洞府',
      cultivationMultiplier: 2.4,
      cultivationInsight: '金丹已至九转门前，再进一步便是天劫。近来行气到顶时，头顶总有闷雷般的压迫。',
      longTermMemory: ['三百年前在寒潭见过一次别人渡劫，那人连骨灰都没留下。'],
      heartDemon: 34, karma: 12, merit: 180, sin: 40,
      activeStatuses: [
        status({ id: 'st-tribulation-omen', name: '劫云初结', description: '洞府上空的云压得很低，雷声隔三五日就响一次，一次比一次近。', category: 'special', rarity: 'mythic', duration: 3, source: '金丹九转圆满' }),
        status({ id: 'st-old-wound', name: '旧伤未清', description: '两百年前被同门算计留下的暗伤，逢阴雨天就发作。', category: 'debuff', rarity: 'rare', source: '同门暗算' }),
      ],
    },
  },
  {
    id: 'state-lifespan-ending',
    label: '寿元将尽 · 无路可进',
    focus: '寿元只剩三年、境界卡死，叙事必须给出凡人式的收束而不是硬塞机缘',
    gapReason: '快照库无角色接近寿元上限',
    expectedNarrativeTraits: ['不硬塞延寿机缘', '交代身后事的具体动作', '不写成失败判词'],
    state: {
      ...BASE,
      id: 'eval-state-lifespan-ending',
      name: '周阿满', age: 77, lifespan: 80,
      spiritualRoot: 'mixed', rootDetail: '五行杂灵根，样样不通', rootMultiplier: 0.8,
      realm: 'qi_refining', realmLevel: 2, cultivationExp: 140, expToBreak: 400,
      hp: 62, maxHp: 90, mp: 30, maxMp: 60, attack: 12, defense: 10, speed: 8,
      luck: 18, comprehension: 22, spiritStones: 7, reputation: 4,
      faction: '', master: '', location: '青岚坊市西头的旧药铺',
      cultivationMultiplier: 0.8,
      cultivationInsight: '杂灵根行气如筛子盛水，六十年只挪了两层。近两年连药铺的活都做不利索了。',
      longTermMemory: ['三十岁那年把攒了十年的灵石全买了一炉丹，炸了。', '收养的哑女如今能自己看铺子了。'],
      heartDemon: 22, merit: 46, sin: 2,
      activeStatuses: [
        status({ id: 'st-lifespan-fading', name: '油尽灯枯', description: '气血一天薄一天，早上起身要扶着柜台歇一会儿。', category: 'debuff', rarity: 'rare', duration: 3, source: '寿元将尽' }),
      ],
      pendingThreads: [
        thread({ id: 'th-legacy', title: '药铺托付', description: '要把西头药铺和一册手抄药记交给收养的哑女，但她还不会认灵药成色。', category: 'promise', startAge: 75, deadlineAge: 79, progress: 40, followUpHint: '教她认灵药或直接立据过契' }),
      ],
    },
  },
  {
    id: 'state-mortal-no-root',
    label: '无灵根凡人 · 凡路完整',
    focus: '无灵根不等于失败人生，叙事要写谋生、手艺、乡里人情而不是硬推修为',
    gapReason: '快照库角色都测出了灵根，没有纯凡人样本',
    expectedNarrativeTraits: ['不硬推修为增长', '写具体谋生手艺', '不写成怨天悲叹'],
    state: {
      ...BASE,
      id: 'eval-state-mortal-no-root',
      name: '宣大江', age: 33, lifespan: 76,
      spiritualRoot: 'none', rootDetail: '无灵根，测灵石毫无反应', rootMultiplier: 0,
      realm: 'mortal', realmLevel: 0, cultivationExp: 0, expToBreak: 0,
      elements: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
      hp: 110, maxHp: 110, mp: 0, maxMp: 0, attack: 16, defense: 14, speed: 13,
      luck: 26, comprehension: 38, spiritStones: 3, reputation: 8,
      faction: '', master: '', location: '柳溪村渡口',
      cultivationMultiplier: 0,
      cultivationInsight: '无灵根，谈不上修炼速度。练的是家传的一套撑船桩功，只管腰腿。',
      longTermMemory: ['十二岁测灵，灵石没亮，测灵人把手抽回去就走了。', '接了父亲的渡船，一年能攒下三十文。'],
      heartDemon: 0, merit: 12, sin: 0,
      activeStatuses: [
        status({ id: 'st-boatman', name: '撐船桩功', description: '家传的粗浅桩功，腰腿比同龄人稳，扛得住风浪。', category: 'buff', source: '父亲所传' }),
      ],
    },
  },
  {
    id: 'state-many-threads',
    label: '多条未决线索并存',
    focus: '五条线索同时压顶（两条已到期），叙事必须承接而不是另起无关事件',
    gapReason: '快照库单角色最多一两条线索，压不出连续性问题',
    expectedNarrativeTraits: ['到期线索必须被承接', '线索不得凭空消失', '不得另起无关主线'],
    state: {
      ...BASE,
      id: 'eval-state-many-threads',
      name: '沈清澜', age: 31, lifespan: 120,
      spiritualRoot: 'pure', rootDetail: '水真灵根', rootMultiplier: 1.5,
      realm: 'foundation', realmLevel: 1, cultivationExp: 1200, expToBreak: 2000,
      hp: 420, maxHp: 500, mp: 300, maxMp: 380, attack: 62, defense: 48, speed: 55,
      luck: 40, comprehension: 58, spiritStones: 180, reputation: 46,
      faction: '', master: '', location: '白潮渔村南侧浅礁',
      cultivationMultiplier: 2.55,
      cultivationInsight: '水真灵根临潮纳灵，顺水行气；夺来的护身法器护脉助息不散。',
      longTermMemory: ['三十二岁巡白潮南礁，遭铁背潮蟹妖伏击，负轻伤而磨炼实战。'],
      heartDemon: 26, karma: -8, merit: 20, sin: 34,
      isAtChoice: true,
      pendingThreads: [
        thread({ id: 'th-debt', title: '药债压门', description: '欠青岚坊市孙掌柜三十块灵石的丹药钱，说好今年秋末还。', category: 'debt', startAge: 29, deadlineAge: 31, progress: 20, failureCost: '孙掌柜会把欠据转给催债的散修' }),
        thread({ id: 'th-enemy', title: '半潮门影', description: '半潮门的人去年在深水见过她，一直在打听护身法器的来处。', category: 'enemy', startAge: 30, deadlineAge: 31, progress: 55, followUpHint: '被截住或先下手' }),
        thread({ id: 'th-promise', title: '渡口寒誓', description: '答应过渔村老姚，等他孙子满十岁就带他去测灵。', category: 'promise', startAge: 26, deadlineAge: 34, progress: 10 }),
        thread({ id: 'th-mystery', title: '水脉残图', description: '从蟹妖巢里翻出半张水脉图，缺了东南一角。', category: 'mystery', startAge: 30, deadlineAge: 38, progress: 30 }),
        thread({ id: 'th-exploration', title: '潮隙浮阁', description: '潮湿玉片指向一处只在大潮时露头的浮阁，下次大潮在明年。', category: 'exploration', startAge: 31, deadlineAge: 40, progress: 5, dueInSameYear: false }),
      ],
      activeStatuses: [
        status({ id: 'st-claw-bruise', name: '钳震瘀伤', description: '腕臂受妖蟹钳风震荡，运刃与行气皆有隐痛。', category: 'debuff', duration: 2, source: '铁背潮蟹妖搏杀' }),
      ],
    },
  },
  {
    id: 'state-heart-demon-critical',
    label: '心魔临界',
    focus: '心魔近满，叙事应让判断失准、走火风险真实参与，而不是只挂个标签',
    gapReason: '快照库心魔值都在低位',
    expectedNarrativeTraits: ['心魔真实影响判断', '走火/失控的具体表现', '不得只作背景标签'],
    state: {
      ...BASE,
      id: 'eval-state-heart-demon-critical',
      name: '孟寒山', age: 58, lifespan: 200,
      spiritualRoot: 'pure', rootDetail: '火单灵根', rootMultiplier: 1.5,
      realm: 'foundation', realmLevel: 7, cultivationExp: 4200, expToBreak: 5000,
      hp: 300, maxHp: 620, mp: 410, maxMp: 500, attack: 96, defense: 60, speed: 70,
      luck: 22, comprehension: 66, spiritStones: 90, reputation: -30,
      faction: '', master: '', location: '赤石岭废弃丹房',
      cultivationMultiplier: 1.9,
      cultivationInsight: '火灵根催丹快，也催心火。近半年一坐下来，眼前就烧起旧事。',
      longTermMemory: ['师兄的丹方是他抢的，抢完那晚师兄跳了崖。'],
      heartDemon: 92, karma: -40, merit: 6, sin: 120,
      activeStatuses: [
        status({ id: 'st-heart-demon', name: '心火焚神', description: '入定就见旧人，手心常有黑纹浮出，夜里听得见有人叫他名字。', category: 'debuff', rarity: 'epic', source: '杀业积压' }),
      ],
    },
  },
  {
    id: 'state-soul-lagging',
    label: '神魂严重落后于法力',
    focus: '身神分化：法力已筑基，神魂却还是凡俗，突破与神识压制都该有明显风险',
    gapReason: '快照库角色神魂与法力基本同步，压不出分化分支',
    expectedNarrativeTraits: ['神魂落后的具体后果', '不得轻易承受高阶神识压制', '突破风险要写实'],
    state: {
      ...BASE,
      id: 'eval-state-soul-lagging',
      name: '田七', age: 40, lifespan: 150,
      spiritualRoot: 'common', rootDetail: '土金双灵根', rootMultiplier: 1.2,
      realm: 'foundation', realmLevel: 5, cultivationExp: 3000, expToBreak: 4500,
      hp: 700, maxHp: 700, mp: 120, maxMp: 200, attack: 110, defense: 130, speed: 40,
      spiritualSense: 6, soulStrength: 5, physicalFoundation: 88,
      luck: 30, comprehension: 14, spiritStones: 40, reputation: 20,
      faction: '铁砧门', master: '钟九', location: '铁砧门锻房',
      cultivationMultiplier: 1.35,
      cultivationInsight: '靠丹药和苦力把肉身堆上来的筑基，神识却薄得像纸，隔着墙都听不出人声。',
      longTermMemory: ['师父说过：你这身板是好的，脑子跟不上，别学神识那一路。'],
      heartDemon: 12,
      activeStatuses: [
        status({ id: 'st-soul-thin', name: '神魂薄弱', description: '神识出体不过三尺，被人一压就头痛欲裂。', category: 'debuff', rarity: 'rare', source: '以丹药强堆境界' }),
      ],
    },
  },
  {
    id: 'state-sin-heavy',
    label: '杀业深重 · 善恶失衡',
    focus: '业重时的世界内回响（夜梦阴魂、手心黑纹），严禁写成功德数值',
    gapReason: '快照库 karma/merit/sin 全为初值',
    expectedNarrativeTraits: ['只写世界内回响', '不得出现业力/功德数值', '旁人态度自然变化'],
    state: {
      ...BASE,
      id: 'eval-state-sin-heavy',
      name: '黑蝉', age: 66, lifespan: 180,
      spiritualRoot: 'pure', rootDetail: '阴属水单灵根', rootMultiplier: 1.5,
      realm: 'golden_core', realmLevel: 1, cultivationExp: 5200, expToBreak: 8000,
      hp: 1400, maxHp: 1600, mp: 900, maxMp: 1100, attack: 210, defense: 150, speed: 190,
      luck: 12, comprehension: 70, spiritStones: 2600, reputation: -180,
      faction: '半潮门', master: '', location: '鬼市夜巷',
      cultivationMultiplier: 2.1,
      cultivationInsight: '采补来的灵气纯，行气也快，只是每回收功都听见有人在耳边数数。',
      longTermMemory: ['七十三条命换来的金丹，他自己记得清清楚楚。'],
      heartDemon: 70, karma: -160, merit: 0, sin: 340,
      activeStatuses: [
        status({ id: 'st-sin-mark', name: '掌心黑纹', description: '左手掌心浮出一道洗不掉的黑纹，夜里发烫。', category: 'special', rarity: 'epic', source: '杀业积压' }),
        status({ id: 'st-ghost-dream', name: '夜梦阴魂', description: '每逢初一十五，梦里都有人排队站在床前，不说话。', category: 'debuff', rarity: 'rare', source: '杀业积压' }),
      ],
    },
  },
  {
    id: 'state-near-death',
    label: '濒死重伤 · 被围',
    focus: '气血不足一成且被多人缠住，这一拍可能只能挨打，不许写主角光环',
    gapReason: '快照库战斗样本都是胜局，没有濒死态',
    expectedNarrativeTraits: ['不得写主角光环反杀', '被压制的具体表现', '数值不得凭空夸大'],
    state: {
      ...BASE,
      id: 'eval-state-near-death',
      name: '沈清萝', age: 79, lifespan: 150,
      spiritualRoot: 'pure', rootDetail: '水真灵根', rootMultiplier: 1.5,
      realm: 'foundation', realmLevel: 9, cultivationExp: 4800, expToBreak: 5000,
      hp: 38, maxHp: 640, mp: 12, maxMp: 420, attack: 88, defense: 40, speed: 66,
      luck: 34, comprehension: 60, spiritStones: 0, reputation: 58,
      faction: '', master: '', location: '深水潮门残垣',
      cultivationMultiplier: 2.2,
      cultivationInsight: '水真灵根本该顺水行气，此刻灵力见底，连护脉都撑不住。',
      longTermMemory: ['半潮门影已到潮候，她本想托外院巡江弟子远远照应。'],
      heartDemon: 48, nearDeath: true, nearDeathYear: 79,
      activeStatuses: [
        status({ id: 'st-bleeding', name: '气血将竭', description: '肋下的口子一直在渗，走三步就要扶墙。', category: 'debuff', rarity: 'epic', duration: 1, source: '半潮门围杀' }),
        status({ id: 'st-surrounded', name: '被围', description: '三个方向都有人堵着，退路只剩塌了一半的残垣。', category: 'debuff', duration: 1, source: '半潮门围杀' }),
      ],
      pendingThreads: [
        thread({ id: 'th-hunt', title: '半潮门围杀', description: '半潮门四人已合围，为的是她身上那件护身法器。', category: 'enemy', startAge: 78, deadlineAge: 79, status: 'urgent', progress: 80 }),
      ],
    },
  },
  {
    id: 'state-heavenly-root-infant',
    label: '天灵根降生 · 凡人村镇',
    focus: '专测题材违和：天灵根降生在凡人村镇，绝不能有人「失望」',
    gapReason: '快照库出生事件全是兜底文案，未覆盖天灵根异象',
    expectedNarrativeTraits: ['邻里叩拜/道士登门', '严禁失望或不过如此', '不得写元叙事旁白'],
    state: {
      ...BASE,
      id: 'eval-state-heavenly-root-infant',
      name: '李青云', age: 0, lifespan: 100,
      spiritualRoot: 'heavenly', rootDetail: '单属性天灵根（雷）', rootMultiplier: 3.0,
      realm: 'mortal', realmLevel: 0, cultivationExp: 0, expToBreak: 100,
      elements: { metal: 20, wood: 10, water: 10, fire: 30, earth: 10 },
      hp: 12, maxHp: 12, mp: 8, maxMp: 8, attack: 1, defense: 1, speed: 2,
      luck: 88, comprehension: 80, spiritStones: 0, reputation: 0,
      faction: '', master: '', location: '柳溪村李家院',
      cultivationMultiplier: 3.0,
      cultivationInsight: '天灵根，尚在襁褓，谈不上修炼。',
      longTermMemory: [],
      heartDemon: 0,
      lastEventAge: 0,
      activeStatuses: [
        status({ id: 'st-birth-omen', name: '降生异象', description: '生他那夜院里的老槐无风自动，井水翻了半尺。', category: 'special', rarity: 'legendary', source: '天灵根降生' }),
      ],
    },
  },
];

// ==================== 落盘 ====================

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR).filter((x) => x.endsWith('.json'))) fs.unlinkSync(path.join(OUT_DIR, f));

let written = 0;
console.log('\n=== 乙路 · 状态快照（补覆盖）===');
for (const c of CASES) {
  // 过引擎真构造器：派生字段由引擎算，不手写
  const ctx = buildStateContext(c.state, [], []);
  const fixture = {
    id: c.id,
    route: '乙',
    kind: 'state-snapshot',
    label: c.label,
    prompt: `状态快照 · ${c.label} · ${c.focus}`,
    expectedSchema: {
      character: 'object',
      activeStatuses: 'array',
      pendingThreads: 'array',
      availableAttributes: 'array',
    },
    // 快照本体：引擎 buildStateContext 的真实输出
    expectedOutput: ctx,
    gateOptions: { scope: 'generic' },
    // 本路无叙事文本，G1-G3 不适用；G4 只校验快照字段齐备
    expectedGates: { result: 'pass', gates: [] as string[] },
    tags: ['state-snapshot', c.id.replace(/^state-/, '')],
    expectedNarrativeTraits: c.expectedNarrativeTraits,
    provenance: {
      builder: 'scripts/build-narrative-eval-states.ts',
      constructor: 'buildStateContext (src/lib/xianxia/engine/lifecycle.ts:395)',
      determinism: '固定入参快照 CharacterState；不引入新种子设施，派生字段全部由引擎计算',
      gapReason: c.gapReason,
    },
    notes: `乙路极端态：${c.focus}`,
  };
  fs.writeFileSync(path.join(OUT_DIR, `${c.id}.json`), JSON.stringify(fixture, null, 2) + '\n', 'utf-8');
  written++;
  const soul = `神识${ctx.character.spiritualSense}/魂魄${ctx.character.soulStrength}/体魄${ctx.character.physicalFoundation}`;
  console.log(`  ${c.label.padEnd(16)} 灵根=${ctx.character.rootDetail.slice(0, 10)} 境界=${ctx.character.realmName} 线索=${ctx.pendingThreads.length} 状态=${ctx.activeStatuses.length} ${soul} 神魂境=${ctx.character.soulRealmName}`);
}
console.log(`\n合计落盘 ${written} 份 → ${path.relative(REPO, OUT_DIR)}`);
process.exit(0);
