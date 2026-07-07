// 沉浸版：AI 成就系统（与传统成就系统的区别）

// 传统做法：if (state.age >= 100) grant('百岁修仙') —— 由引擎按规则判定

// 本系统：AI 是事实登记员。引擎维护一份"成就种子池"（AchievementDefinition），

// 每岁推进后由 LLM 据 narrative 输出 [ACHIEVEMENT:id] [REWARD:cat/rarity/name/desc] 标记。

// 无标记 = 本岁无成就（沉默也是合法结果）。

// 触发成就时附带一份"局外奖励"，进入 heritageVault，下一次开局可选。



import type { CharacterState } from './types';

import type { HeritageCategory, HeritageRarity } from './store';



// ==================== 成就定义池（30 条种子）====================

// 按"年岁 / 境界 / 属性 / 战斗 / 师承 / 社交 / 剧情 / 轮回"分桶

// 名字尽量半文言 + 白话，让玩家一眼懂；id 是稳定 key。



export type AchievementBucket =

  | 'age' | 'realm' | 'attribute' | 'combat' | 'teacher' | 'social' | 'story' | 'cycle';



export interface AchievementDefinition {

  id: string;

  bucket: AchievementBucket;

  name: string;

  /** 简述；玩家可见 */

  hint: string;

  /** 默认奖励 rarity + category（仅作为兜底，AI 完全可改） */

  defaultRarity: HeritageRarity;

  defaultCategory: HeritageCategory;

  /**

   * 奖励风格提示（软约束；不进硬规则，仅给 LLM 看做风格引导）。

   * 例如："适合给一本入门吐纳法" / "适合给一段命格碎片" / "适合给一只灵宠"。

   * AI 可以完全无视；不提供时引擎只给一个默认引导。

   */

  rewardHint?: string;

}



export const ACHIEVEMENT_POOL: AchievementDefinition[] = [

  // 年岁（6）

  { id: 'first-decade',     bucket: 'age',  name: '十年踪迹',         hint: '主角活过十岁',                       defaultRarity: 'common',    defaultCategory: 'treasure',  rewardHint: '适合送一份小礼物、一枚护身玉佩、或一段童年纪念物' },

  { id: 'century-mark',     bucket: 'age',  name: '百年沧桑',         hint: '主角活过一百岁',                     defaultRarity: 'rare',      defaultCategory: 'artifact',  rewardHint: '适合送一件本命法宝、一缕感悟、或一段尘缘旧物' },

  { id: 'half-millennium',  bucket: 'age',  name: '半千之寿',         hint: '主角活过五百岁',                     defaultRarity: 'epic',      defaultCategory: 'constitution', rewardHint: '适合送一段命格碎片、一次神魂凝炼、或一枚延命丹' },

  { id: 'first-millennium', bucket: 'age',  name: '千年一叹',         hint: '主角活过一千岁',                     defaultRarity: 'legendary', defaultCategory: 'fate',      rewardHint: '可送一段前世残影、一缕天道感悟、或一件神话之物' },

  { id: 'beyond-lifespan',  bucket: 'age',  name: '逆天续命',         hint: '凡人寿命将尽却继续活着',             defaultRarity: 'epic',      defaultCategory: 'fate',      rewardHint: '可送一颗延寿金丹、一段生机符文、或一道续命法旨' },

  { id: 'elder-statesman',  bucket: 'age',  name: '宗门元老',         hint: '年过三百仍在世',                     defaultRarity: 'rare',      defaultCategory: 'scripture', rewardHint: '可送一段不传之秘、一卷宗门密录、或一枚令牌' },



  // 境界（6）

  { id: 'qi-refining',      bucket: 'realm', name: '炼气入门',         hint: '踏入炼气期',                         defaultRarity: 'common',    defaultCategory: 'scripture', rewardHint: '送一本最基础的吐纳口诀即可' },

  { id: 'foundation-build', bucket: 'realm', name: '筑基有成',         hint: '踏入筑基期',                         defaultRarity: 'uncommon',  defaultCategory: 'scripture', rewardHint: '送一段筑基期可修的辅助功法 / 灵草 / 一缕感悟' },

  { id: 'golden-core',      bucket: 'realm', name: '金丹初成',         hint: '结成金丹',                           defaultRarity: 'rare',      defaultCategory: 'constitution', rewardHint: '送一段金丹期可用的法宝 / 体质淬炼法 / 同道贺礼' },

  { id: 'nascent-soul',     bucket: 'realm', name: '元婴初显',         hint: '孕育元婴',                           defaultRarity: 'epic',      defaultCategory: 'fate',      rewardHint: '送一段元婴护道秘术 / 灵山遗宝 / 命格凝炼法' },

  { id: 'soul-transform',   bucket: 'realm', name: '化神归一',         hint: '踏入化神期',                         defaultRarity: 'epic',      defaultCategory: 'artifact',  rewardHint: '送一件化神期法宝 / 一缕天道之痕 / 一只伴生神兽' },

  { id: 'ascended',         bucket: 'realm', name: '飞升之兆',         hint: '渡过飞升天劫',                       defaultRarity: 'legendary', defaultCategory: 'fate',      rewardHint: '可送飞升之证 / 天道赐福 / 一缕上界法旨' },



  // 属性（3）

  { id: 'body-tempered',    bucket: 'attribute', name: '肉身成圣',     hint: '体魄破三百',                          defaultRarity: 'rare',      defaultCategory: 'constitution', rewardHint: '送一段肉身淬炼法 / 一瓶炼体丹' },

  { id: 'divine-sense',     bucket: 'attribute', name: '神识如海',     hint: '神识破三百',                          defaultRarity: 'rare',      defaultCategory: 'constitution', rewardHint: '送一段神识凝炼法 / 一缕心灯' },

  { id: 'soul-fortress',    bucket: 'attribute', name: '魂魄如城',     hint: '魂魄破三百',                          defaultRarity: 'rare',      defaultCategory: 'constitution', rewardHint: '送一段魂魄固守秘术 / 一枚镇魂玉' },



  // 战斗（3）

  { id: 'first-blood',      bucket: 'combat', name: '首战告捷',         hint: '第一次赢得战斗',                     defaultRarity: 'common',    defaultCategory: 'artifact',  rewardHint: '送一件初阶战利品 / 一枚功勋玉' },

  { id: 'demon-slayer',     bucket: 'combat', name: '斩妖除魔',         hint: '击杀一只化形以上妖魔',               defaultRarity: 'rare',      defaultCategory: 'artifact',  rewardHint: '送一颗妖丹 / 一段妖骨 / 一缕妖魂' },

  { id: 'tribulation-past', bucket: 'combat', name: '天劫余生',         hint: '在渡劫中险些身死却挺了过来',         defaultRarity: 'epic',      defaultCategory: 'fate',      rewardHint: '可送一段劫后余生感悟 / 一道护身符' },



  // 师承（3）

  { id: 'disciple-of-immortal', bucket: 'teacher', name: '仙人门徒',   hint: '被下凡仙人收为记名弟子',             defaultRarity: 'rare',      defaultCategory: 'scripture', rewardHint: '送一本入门功法 / 一枚信物 / 一段师承铭文' },

  { id: 'apprentice-master', bucket: 'teacher', name: '名师高徒',         hint: '拜入大宗师门下',                     defaultRarity: 'epic',      defaultCategory: 'scripture', rewardHint: '送一段师门心法 / 一卷秘传 / 一件师门法器' },

  { id: 'renegade-apprentice', bucket: 'teacher', name: '逆徒',       hint: '背叛师门出走',                       defaultRarity: 'rare',      defaultCategory: 'artifact',  rewardHint: '可送从师门偷出的禁术 / 一缕被夺走的师门气运' },



  // 社交（3）

  { id: 'first-bond',       bucket: 'social', name: '知己初识',         hint: '第一次与 NPC 亲疏破 50',             defaultRarity: 'common',    defaultCategory: 'pet',       rewardHint: '送一段情义纪念物 / 一缕结缘信物' },

  { id: 'spouse-bound',     bucket: 'social', name: '道侣之约',         hint: '结为道侣',                           defaultRarity: 'epic',      defaultCategory: 'fate',      rewardHint: '送一枚双修法器 / 一段同心符文 / 一缕命格牵绊' },

  { id: 'sworn-brother',    bucket: 'social', name: '结义金兰',         hint: '与一位 NPC 结为异姓兄妹',           defaultRarity: 'rare',      defaultCategory: 'pet',       rewardHint: '送一缕结义信物 / 一段血脉牵绊' },



  // 剧情（3）

  { id: 'cave-discovery',   bucket: 'story', name: '古修遗府',         hint: '首次探索一处在世古修洞府',           defaultRarity: 'rare',      defaultCategory: 'artifact',  rewardHint: '送一件古修遗宝 / 一卷残卷 / 一缕残念' },

  { id: 'sect-savior',      bucket: 'story', name: '宗门救世',         hint: '救宗门于危难',                       defaultRarity: 'epic',      defaultCategory: 'fate',      rewardHint: '送一段宗门气运 / 一枚掌门信物 / 一卷护宗秘录' },

  { id: 'forbidden-art',    bucket: 'story', name: '禁术染身',         hint: '习得一种被禁的功法',                 defaultRarity: 'rare',      defaultCategory: 'scripture', rewardHint: '送一本禁术 / 一段禁法残页' },



  // 轮回（3）

  { id: 'first-cycle',      bucket: 'cycle', name: '轮回初醒',         hint: '第一次完成一世轮回',                 defaultRarity: 'rare',      defaultCategory: 'fate',      rewardHint: '送一段前世记忆 / 一缕魂魄残余' },

  { id: 'three-cycles',     bucket: 'cycle', name: '三世之缘',         hint: '累计完成三轮',                       defaultRarity: 'epic',      defaultCategory: 'fate',      rewardHint: '送一段三世感悟 / 一缕命格牵绊' },

  { id: 'divine-reincarnated', bucket: 'cycle', name: '神魂不灭',     hint: '神魂觉醒且完成一世',                 defaultRarity: 'legendary', defaultCategory: 'fate',      rewardHint: '送一段神魂心印 / 一缕神明法旨' },

];



export const ACHIEVEMENT_BY_ID: Record<string, AchievementDefinition> = (() => {

  const map: Record<string, AchievementDefinition> = {};

  for (const a of ACHIEVEMENT_POOL) map[a.id] = a;

  return map;

})();



// ==================== 玩家侧记录 ====================



export interface AchievementReward {

  id: string;

  /**

   * 奖励类别。已知 6 种（scripture/fate/pet/artifact/constitution/treasure）用于 UI 上色；

   * AI 也可自由给任意 kebab/snake 字符串（如 "elixir"/"memory-fragment"），UI 走灰色 fallback。

   * 类型上保留窄枚举以便老代码兼容，新解析层会塞自定义字符串，运行时用 KNOWN_CATEGORIES 判断。

   */

  category: HeritageCategory | string;

  /** 同上：rarity 已知 6 种 + AI 自由字符串 */

  rarity: HeritageRarity | string;

  name: string;

  description: string;

  /** 来自该成就 */

  fromAchievement: string;

}



export interface AchievementRecord {

  id: string;

  name: string;

  bucket: AchievementBucket;

  triggeredAge: number;

  triggeredAt: string;       // ISO 时间

  rewardId: string;          // → heritageVault 同步写入

  hint: string;

}



// ==================== 标记解析 ====================



/**

 * 从 LLM narrative 中解析 [ACHIEVEMENT:id] 和 [REWARD:cat/rarity/name/desc] 标记。

 *

 * 设计原则（沉浸版 Phase-Z 放权 AI）：

 * - cat / rarity 由 AI 完全主导，**不再卡白名单**。

 *   已知 6 种 (scripture/fate/pet/artifact/constitution/treasure × common..mythic) 用于 UI 上色；

 *   AI 可给任意 kebab-case / snake_case（如 "elixir" / "memory" / "old-coin"），引擎原样保留。

 * - 缺 [REWARD] 时，引擎尝试从 [ACHIEVEMENT:id] 后面的中文 narrative 里抓取"获得 / 赐 / 传 / 收"等动词

 *   后的「…」、〔…〕、（…）作为奖励名 + 描述，AI 即使忘了写标记也能识别。

 * - 最差兜底才用 ACHIEVEMENT_POOL 的 default（仅 category / rarity，name 用"{成就名}之礼"）。

 * - 未知 id 直接忽略（AI 自由发挥的部分不强制执行）。

 * - 同一 id 在同一 narrative 中重复出现只取一次。

 */

export interface ParsedAchievement {

  definition: AchievementDefinition;

  reward: Omit<AchievementReward, 'fromAchievement' | 'id'> & { id: string };

}



const ACH_RE = /\[ACHIEVEMENT:\s*([a-z0-9\-]+)\s*\]/g;

// REWARD 标记放宽：name/desc 允许中文（含 CJK），不再限定 [a-z]

const REW_RE = /\[REWARD:\s*([\w\-]+)\s*\/\s*([\w\-]+)\s*\/\s*([^\]\/]{1,40})\s*\/\s*([^\]]{1,160})\]/;



const KNOWN_CATEGORIES: readonly HeritageCategory[] = ['scripture', 'fate', 'pet', 'artifact', 'constitution', 'treasure'];

const KNOWN_RARITIES: readonly HeritageRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];



/** 是否合法的"自定义 cat/rarity token"——kebab / snake / 单词 */

function isValidToken(t: string): boolean {

  return /^[a-z][a-z0-9\-]{0,23}$/i.test(t);

}



function sanitizeRewardText(s: string, max: number): string {

  const t = String(s || '').trim().replace(/\s+/g, ' ').replace(/[，。、；！？]+$/g, '');

  return t.slice(0, max);

}



/** 从 narrative body 抓"获得 / 赐 / 传 / 收 / 觉醒"等动词后的奖励名（中文优先） */

function extractRewardFromNarrative(body: string): { name: string; description: string } | null {

  if (!body) return null;

  // 模式 1：「…」「…」、〔…〕、(…) 内含奖励名

  const bracketMatch = body.match(/[「〔（]([^「〕）()]{1,16})[」〕）]/);

  // 模式 2：动词 + 了 + 名字（限 1-12 字）

  const verbMatch = body.match(/(?:获得|得|获赐|被赐|被传|被授|收|觉醒|凝成|凝就|结成|修成|悟得|悟出)(?:了)?\s*([一-龥A-Za-z0-9·]{1,12})/);

  if (!bracketMatch && !verbMatch) return null;

  const name = (bracketMatch?.[1] || verbMatch?.[1] || '').trim();

  if (!name) return null;

  // 描述：取整段 body 前 80 字（trim 后）

  const description = sanitizeRewardText(body.replace(/\[REWARD:[^\]]+\]/g, ''), 80);

  return { name: sanitizeRewardText(name, 16), description };

}



export function parseAchievementMarkers(narrative: string): ParsedAchievement[] {

  if (!narrative || typeof narrative !== 'string') return [];

  const out: ParsedAchievement[] = [];

  const seen = new Set<string>();



  // 把 narrative 切成"段"，每段从 [ACHIEVEMENT:...] 起，到下一个 [ACHIEVEMENT: 或 narrative 末尾

  const segments: { id: string; body: string }[] = [];

  let lastIdx = 0;

  let m: RegExpExecArray | null;

  ACH_RE.lastIndex = 0;

  while ((m = ACH_RE.exec(narrative)) !== null) {

    if (lastIdx < m.index && segments.length) segments[segments.length - 1].body += narrative.slice(lastIdx, m.index);

    segments.push({ id: m[1], body: '' });

    lastIdx = m.index + m[0].length;

  }

  if (lastIdx < narrative.length && segments.length) {

    segments[segments.length - 1].body += narrative.slice(lastIdx);

  }



  for (const seg of segments) {

    const def = ACHIEVEMENT_BY_ID[seg.id];

    if (!def) continue;

    if (seen.has(def.id)) continue;

    seen.add(def.id);



    const rewMatch = seg.body.match(REW_RE);

    let category: string = def.defaultCategory;

    let rarity: string = def.defaultRarity;

    let name: string | null = null;

    let description: string | null = null;



    if (rewMatch) {

      // AI 给了 [REWARD] 标记——完全尊重

      const catRaw = rewMatch[1].toLowerCase();

      const rarRaw = rewMatch[2].toLowerCase();

      category = isValidToken(catRaw) ? catRaw : def.defaultCategory;

      rarity = isValidToken(rarRaw) ? rarRaw : def.defaultRarity;

      name = sanitizeRewardText(rewMatch[3], 16) || null;

      description = sanitizeRewardText(rewMatch[4], 160) || null;

    }



    // 缺 [REWARD] 或 reward 字段空 → 从 narrative body 抓

    if (!name || !description) {

      const extracted = extractRewardFromNarrative(seg.body);

      if (extracted) {

        if (!name) name = extracted.name;

        if (!description) description = extracted.description;

      }

    }



    // 最终兜底：用 default 字段

    if (!name) name = `${def.name}之礼`;

    if (!description) description = def.hint;



    const reward: ParsedAchievement['reward'] = {

      id: `ach-${def.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,

      category: category as HeritageCategory,

      rarity: rarity as HeritageRarity,

      name,

      description,

    };

    out.push({ definition: def, reward });

  }

  return out;

}



// ==================== 落地函数 ====================



/**

 * 把解析出的成就 + 奖励写入 state。

 * - character.achievements 追加（去重）

 * - character.heritageVault 追加对应 reward（用于下次开局选）

 * - 同时通过 fxHint 返回给调用方，前端可立即弹"成就达成"飘字

 */

export interface ApplyAchievementsResult {

  state: CharacterState;

  newAchievements: { record: AchievementRecord; reward: AchievementReward; definition: AchievementDefinition }[];

}



export function applyAchievements(

  state: CharacterState,

  parsed: ParsedAchievement[],

  options: {

    triggeredAge?: number;

    triggeredAt?: string;

    /** 调用方提供的"已触发的成就 id 集合"——支持跨会话去重（zustand persist 会持久化） */

    alreadyTriggered?: Set<string>;

  } = {},

): ApplyAchievementsResult {

  const triggeredAge = options.triggeredAge ?? Number(state.age ?? 0);

  const triggeredAt = options.triggeredAt ?? new Date().toISOString();

  const alreadyTriggered = options.alreadyTriggered ?? new Set<string>();



  const newAchievements: ApplyAchievementsResult['newAchievements'] = [];

  for (const p of parsed) {

    if (alreadyTriggered.has(p.definition.id)) continue;

    const record: AchievementRecord = {

      id: p.definition.id,

      name: p.definition.name,

      bucket: p.definition.bucket,

      triggeredAge,

      triggeredAt,

      rewardId: p.reward.id,

      hint: p.definition.hint,

    };

    const reward: AchievementReward = {

      ...p.reward,

      fromAchievement: p.definition.id,

    };

    newAchievements.push({ record, reward, definition: p.definition });

  }

  // 不写 state：调用方把 newAchievements 推进 store（zustand persist 自动 localStorage），

  // heritageVault 也通过 store.addHeritageItems() 写入

  // 同时把本批 reward items 附在 state 上，让前端 hook 直接拿

  if (newAchievements.length > 0) {

    (state as any).__lastHeritageAdditions = newAchievements.map((a) => ({

      id: a.reward.id,

      category: a.reward.category,

      name: a.reward.name,

      description: a.reward.description,

      rarity: a.reward.rarity,

      source: `achievement:${a.definition.id}`,

    }));

  }

  return { state, newAchievements };

}



// ==================== 提示生成（给 LLM 看）====================



export function buildAchievementPromptHint(): string {
  // 每条 rewardHint 给 LLM 做风格引导（不强制）
  const lines = ACHIEVEMENT_POOL.map((a) => {
    const hintPart = a.rewardHint ? ` | rewardHint: ${a.rewardHint}` : '';
    return `- ${a.id} | ${a.bucket} | ${a.name}${hintPart}`;
  });
  return `【成就种子池（AI 据本岁 narrative 自主决定是否触发）】
以下 ${ACHIEVEMENT_POOL.length} 条成就候选；若 narrative 自然贴合某条，按下述格式在叙事末尾标注（可写 0 条）：

主格式（推荐，AI 完全主导奖励）：
\`[ACHIEVEMENT:<id>] … [REWARD:<category>/<rarity>/<奖励名>/<奖励说明>]\`
示例：\`[ACHIEVEMENT:disciple-of-immortal] 仙人见我根骨不错……[REWARD:scripture/rare/仙人吐纳残篇/前辈亲授的入门吐纳法]\`

奖励完全自由：
- category：上述 6 种之外可任意 kebab-case（如 elixir / memory-fragment / old-coin），引擎原样保留；
- rarity：常见 6 阶之外可自由发挥（如 ancient / cursed / divine）；
- 奖励名：1-16 字中文为主，含「…」或〔…〕亦可；
- 若忘了写 [REWARD]，只要 narrative 里出现「获得 X」「被赐 X」「收 X」「凝成 X」等动词，引擎会自动提取 X 作为奖励名。

示例：
- 经典：\`[REWARD:scripture/rare/仙人吐纳残篇/前辈亲授的入门吐纳法]\`
- 自定义：\`[REWARD:elixir/divine/九转金丹/炼化后突破无瓶颈]\`
- 残影：\`[REWARD:memory-fragment/rare/前世残影/隐约看见雪山与一座道观]\`

无把握时不必硬凑 —— 沉默也是合法结果。

${lines.join('\n')}
`.trim();
}