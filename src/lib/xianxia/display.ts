export const COMBAT_PROJECTION_LABELS = {
  force: '破势',
  guard: '护持',
  agility: '机变',
  spiritualAwareness: '神识',
  soulStability: '魂魄',
  bodyTenacity: '体魄',
} as const;

export const LOADING_LABELS = {
  advanceTitle: '灵机牵引中…',
  advanceButton: '灵机牵引中…',
  preload: '天机未明…',
  reset: '缘法重定中…',
  choose: '命数斟酌中…',
  combat: '战局推演中…',
  interfere: '因果介入中…',
  market: '坊市翻动中…',
  formation: '阵势排布中…',
  pet: '灵契感应中…',
  start: '仙缘初启…',
  aiConfigTest: '通灵测试中…',
  default: '灵机牵引中…',
} as const;

export function loadingLabelFor(kind: keyof typeof LOADING_LABELS = 'default'): string {
  return LOADING_LABELS[kind] || LOADING_LABELS.default;
}

// 战利品名称清洗：去掉"敌人XX"归因（山匪头目的储物袋、王铁匠的铁锤等），改为通用名
const LOOT_NAME_DROP: Array<[RegExp, string]> = [
  // "XX的" + 名词：去掉"XX的"前缀（XX = 任意非引号字符 1-8）
  [/[一-鿿A-Za-z0-9]{1,8}的(储物袋|包袱|法器|法宝|丹炉|飞剑|剑|刀|锤|弓|法杖|内丹|兽皮|骨骸|骨|爪|牙|鳞|心核|心|玉简|法盘|药瓶|丹药|丹丸)/g, '$1'],
  // "XX遗留的/留下的/用过的/留下的/留下的" + 名词
  [/[一-鿿A-Za-z0-9]{1,8}(遗留|留下|剩下|用剩|随身携带|持有|曾用)(的|着)?(储物袋|包袱|法器|法宝|丹炉|飞剑|剑|刀|锤|弓|法杖|内丹|兽皮|骨骸|骨|爪|牙|鳞|心核|心|玉简|法盘|药瓶|丹药|丹丸)/g, '$3'],
  // "从XX处/上夺得/取得" 这类前缀直接删
  [/从[一-鿿A-Za-z0-9]{1,8}(处|上|手中|身上|身上)夺取?/g, ''],
  // 单独"XX遗留物""XX遗物"
  [/[一-鿿A-Za-z0-9]{1,8}的(遗物|遗留物|遗蜕|遗骸|残骸|尸首|尸体)/g, '残骸'],
];

export function sanitizeLootName(name: string): string {
  if (!name) return name;
  let result = name;
  for (const [pattern, replacement] of LOOT_NAME_DROP) {
    result = result.replace(pattern, replacement);
  }
  // 去掉开头多余"的一/之"
  result = result.replace(/^的一|^之/, '');
  // 兜底：如果包含"的"且后面是物品，且前半段 <= 4 个字，截断到"的"后
  return result;
}

// 突破过程文案清洗：把"破境/突破"等终局标签从过程叙事（冲关/临门/准备）中移除
const BREAKTHROUGH_HIDE_PATTERNS: Array<[RegExp, string]> = [
  // "破境/突破" + 修饰词（接近终局/未达终局）整段替换为"修行/冲关"
  [/破\s*境\s*[之的]?\s*[瞬|时|刻|间|瞬息|刹那]?/g, '修行'],
  [/突\s*破\s*[之的]?\s*[瞬|时|刻|间|瞬息|刹那]?/g, '修行'],
  // 标题前缀"破境·" / "突破·" 改为"修行·"
  [/^[【\[]?\s*破\s*境\s*[·:：\-]\s*/gm, '修行·'],
  [/^[【\[]?\s*突\s*破\s*[·:：\-]\s*/gm, '修行·'],
];

export function sanitizeBreakthroughProcessText(text: string, isFinalBreakthrough: boolean = false): string {
  // 最终突破叙事保留"破境/突破"标签
  if (isFinalBreakthrough || !text) return text;
  let result = text;
  for (const [pattern, replacement] of BREAKTHROUGH_HIDE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// AI-20: 线索承接文案边界
// 1. 去掉"承接式"冗余开场（"说起这事""话说此事""原来如此"）
// 2. 限制单条 ≤200 字（防止 AI 把整段前情回放）
// 3. 重复句合并
const CLUE_TEXT_TRIM = [
  // 前情回放式开场
  [/(?:^|\n)\s*说起(?:此事|这桩事|前事|前缘).*?[。！？]/u, ''],
  [/(?:^|\n)\s*话?说(?:此事|起那桩|到此事|起前事|那桩事).*?[。！？]/u, ''],
  [/(?:^|\n)\s*原来如此[，,].{0,30}/u, ''],
  [/(?:^|\n)\s*且说.{0,30}/u, ''],
];
const CLUE_TEXT_MAX_LEN = 200;

export function sanitizeClueText(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [pattern] of CLUE_TEXT_TRIM) {
    result = result.replace(pattern, '');
  }
  // 折叠连续空行
  result = result.replace(/\n{3,}/g, '\n\n');
  // 长度截断（按句号/分号边界优先）
  if (result.length > CLUE_TEXT_MAX_LEN) {
    const sliced = result.slice(0, CLUE_TEXT_MAX_LEN);
    const lastPunct = Math.max(
      sliced.lastIndexOf('。'),
      sliced.lastIndexOf('；'),
      sliced.lastIndexOf('！'),
      sliced.lastIndexOf('？'),
    );
    if (lastPunct > CLUE_TEXT_MAX_LEN * 0.6) {
      result = sliced.slice(0, lastPunct + 1);
    } else {
      result = `${sliced}…`;
    }
  }
  return result.trim();
}

// AI-21: 境界 vs 身份 分离
// 境界（realm）：修为层/法力/练气/筑基/金丹…= 实力台阶
// 身份（identity）：宗门/师承/所在/称号/阵营 = 角色在世界里"是谁"
export const SECT_RELATION_LABEL = {
  hostile: '敌对',
  unfriendly: '不睦',
  neutral: '中立',
  friendly: '友善',
  allied: '同盟',
} as const;

export const LOCATION_TYPE_LABEL = {
  mountain: '山脉',
  river: '河流',
  forest: '森林',
  desert: '荒漠',
  sea: '海洋',
  city: '城邦',
  sectBase: '宗门山门',
  secretRealm: '秘境',
  ancientBattlefield: '古战场',
  mortalLand: '凡间',
} as const;

export const CRAFTING_TYPE_LABEL = {
  crafting: '合成',
  alchemy: '炼丹',
  formation: '布阵',
  techniqueLearning: '习法',
  artifactForging: '炼器',
} as const;

export const QUALITY_TIER_LABEL = {
  common: '凡品',
  fine: '良品',
  superior: '上品',
  supreme: '极品',
  legendary: '绝品',
} as const;

export const INHERITANCE_TYPE_LABEL = {
  spiritualRoot: '灵根所遗',
  technique: '功法所继',
  memory: '一缕前缘',
  soulFragment: '神识之遗',
  oldFriend: '故人之谊',
  token: '信物所托',
} as const;

export const SECT_STATUS_LABEL = {
  founding: '初创',
  rising: '兴起',
  flourishing: '鼎盛',
  stable: '守成',
  unrest: '内忧',
  underSiege: '外患',
  declining: '衰败',
  revival: '复兴',
  extinct: '灭门',
} as const;

export const NODE_TYPE_LABEL = {
  person: '人物',
  place: '地点',
  item: '物品',
  thread: '线索',
  event: '事件',
  faction: '势力',
  concept: '概念',
} as const;

export const EDGE_TYPE_LABEL = {
  cause: '因',
  effect: '果',
  related: '相关',
  oppose: '对立',
  belongs: '所属',
  created: '创造',
  destroyed: '破坏',
} as const;

export const ENDING_TYPE_LABEL = {
  ascension: '飞升',
  failedAscension: '飞升失败',
  grandPerfection: '圆满',
  combatDeath: '战死',
  qiDeviation: '走火入魔',
  naturalDeath: '老死',
  abandon: '放弃',
} as const;

// AI-62: 炼丹火候等级 label
export const ALCHEMY_HEAT_LABEL = {
  micro: '微火',
  weak: '弱火',
  moderate: '中火',
  strong: '强火',
  extreme: '极火',
} as const;

// AI-62: 阵法分类 label
export const FORMATION_CATEGORY_LABEL = {
  binding: '困阵',
  slaughter: '杀阵',
  illusion: '幻阵',
  defense: '防阵',
  support: '辅阵',
  trap: '陷阵',
} as const;

// AI-63: 法宝本命/外用 label
export const BONDED_ARTIFACT_LABEL = {
  bonded: '本命',
  external: '外用',
} as const;

// AI-63: 神识共鸣等级 label（4 档）
export const SOUL_LINK_LEVEL_LABEL = {
  stranger: '陌路',          // 0-25
  acquaintance: '初识',      // 26-50
  resonance: '共鸣',         // 51-75
  unity: '合一',             // 76-100
} as const;

// AI-63: 器灵状态 label
export const ARTIFACT_SPIRIT_LABEL = {
  dormant: '未醒',           // 器灵沉睡
  awakening: '初醒',         // 器灵初醒
  active: '觉醒',            // 器灵觉醒
} as const;

// AI-64: 道侣状态 label
export const DAO_LU_LABEL = {
  none: '未结道侣',
  daoLu: '道侣',           // 正式结为道侣
  promise: '未定之缘',     // 互有情愫，未正式结缘
  severed: '缘尽',         // 道侣离散
} as const;

// AI-64: 双修进度 label
export const DUAL_CULTIVATION_LABEL = {
  initial: '初窥',           // 0-25
  harmony: '和合',           // 26-50
  resonance: '共振',         // 51-75
  unity: '合一',             // 76-100
} as const;

// AI-66: 宗门历史原因 label
export const SECT_HISTORY_REASON_LABEL = {
  joined: '入门',
  left: '离开',
  banished: '逐出',
  ascended: '飞升',
  retired: '退隐',
  martyred: '殉道',
} as const;

// AI-66: 师徒关系 label
export const RELATION_MENTOR_LABEL = {
  master: '师',
  apprentice: '徒',
  peer: '同门',
} as const;

// AI-65: 灵宠/灵虫/灵兽类型 label

// 心志/志向类型 → 中文标签（AI-102 HeartIntentPanel）
export const HEART_INTENT_LABEL: Record<string, string> = {
  ambition: '志向',
  attachment: '牵挂',
  obsession: '执念',
  vow: '誓愿',
  resentment: '积怨',
  compassion: '悯念',
  curiosity: '求索',
  fear: '畏心',
  resolve: '心志',
  yearning: '慕道',
} as const;
export const PET_TYPE_LABEL = {
  pet: '灵宠',
  insect: '灵虫',
  swarm: '虫群',
  beast: '灵兽',
} as const;

export const REALM_SECTION_LABELS = {
  realm: '境界',
  realmLevel: '境界层数',
  cultivationExp: '修为',
  expToBreak: '破境进度',
  soulRealmName: '神魂境界',
  spiritualRoot: '灵根',
  rootMultiplier: '灵根倍率',
  realmTraits: '境界特性',
  realmProfile: '境界画像',
} as const;

export const IDENTITY_SECTION_LABELS = {
  faction: '宗门',
  master: '师承',
  location: '所在',
  reputation: '声望',
  spiritStones: '灵石',
  luck: '气运',
  comprehension: '悟性',
} as const;

export function isRealmAttribute(key: string): boolean {
  return key in REALM_SECTION_LABELS;
}

export function isIdentityAttribute(key: string): boolean {
  return key in IDENTITY_SECTION_LABELS;
}

export const ATTRIBUTE_LABEL: Record<string, string> = {
  age: '年龄',
  lifespan: '寿元',
  cultivationExp: '修为',
  expToBreak: '破境进度',
  hp: '气血',
  maxHp: '气血上限',
  mp: '灵力',
  maxMp: '灵力上限',
  attack: '\u7834\u52bf',
  defense: '\u62a4\u6301',
  speed: '\u673a\u53d8',
  luck: '气运',
  comprehension: '悟性',
  spiritStones: '灵石',
  reputation: '声望',
  heartDemon: '心魔',
  elementMetal: '金灵根',
  elementWood: '木灵根',
  elementWater: '水灵根',
  elementFire: '火灵根',
  elementEarth: '土灵根',
  storageCapacity: '储物容量',
  realm: '境界',
  realmLevel: '境界层数',
  spiritualRoot: '灵根',

  // 非角色数值属性，但可能出现在物品/事件效果里
  inventory: '物品',
  equipped: '装备',
  talisman_attack: '攻符威能',
  talisman_defense: '本回合减伤',
  talisman_heal: '气血回复',
  talisman_escape: '遁行符力',
  talisman_stun: '镇压符力',
  formationType: '阵盘类型',
};

export const HIDDEN_EFFECT_ATTRIBUTES = new Set([
  'formationType',
]);

export function attributeLabel(attr?: string): string {
  if (!attr) return '变化';
  return ATTRIBUTE_LABEL[attr] || '变化';
}

export function isInternalLikeAttr(attr?: string): boolean {
  if (!attr) return false;
  return /[A-Z_]/.test(attr) || attr.includes('_') || attr.includes('.') || attr.includes(':');
}

export function isVisibleNumericEventEffect(eff: any): boolean {
  if (!eff) return false;
  if (eff.kind) return Boolean(String(eff.name || '').trim());
  const attr = String(eff.attribute || '');
  const delta = Number(eff.delta || 0);
  if (!attr || attr === '*' || HIDDEN_EFFECT_ATTRIBUTES.has(attr)) return false;
  if (delta === 0) return false;
  // 背包数量是内部计数，不用 +1/-1 打断沉浸；保留reason，如"得 回春符""售 木剑"
  if (attr === 'inventory' && !String(eff.reason || '').trim()) return false;
  return true;
}

// ─── 文案过滤层：移除玩家可见叙事中的机制词 ────────────────────────────────────
// 策略：单次扫描文本，每段匹配到则替换/删除，跳过已处理区域，避免重复替换
// 何时调用：所有 API 返回 narrative/title 前

const MECHANISM_PATTERNS: Array<[RegExp, string | ((m: string) => string)]> = [
  // 内部字段名（全大写驼峰/蛇底，替换为玩家能理解的词）
  [/\bcultivationExp\b/gi, '修为'],
  [/\bheartDemon\b/gi, '心魔'],
  [/\bspiritStones?\b/gi, '灵石'],
  [/\bpendingThreads?\b/gi, '因缘线索'],
  [/\bquestEntries?\b/gi, '任务'],
  [/\bhp\b/gi, '气血'],
  [/\bmaxHp\b/gi, '气血上限'],
  [/\bmp\b/gi, '灵力'],
  [/\bmaxMp\b/gi, '灵力上限'],
  [/\battack\b/gi, '破势'],
  [/\bdefense\b/gi, '护持'],
  [/\bspeed\b/gi, '机变'],
  [/\breputation\b/gi, '声望'],
  [/\blifespan\b/gi, '寿元'],
  // 数值变化词（AI叙事中最常见的泄露形式）
  [/[+\-×*]?\d{1,8}(?:点|层|颗|枚)/g, ''],
  [/(\+|\-|±)\d{1,8}(?!\w)/g, ''],
  [/[+\-]?\d{1,8}(?:%|％)/g, ''],
  // progress 裸值
  [/\bprogress\s*\d+/gi, ''],
  // 内部/调试元词
  [/\b(?:debug|log|error|test|cache|config|api|route)\b/gi, ''],
  [/\b(?:P0|P1|P2|P3|IDEMPOTENT|preload|pre_load|stateHash)\b/g, ''],
  // key:value 机制文本兜底（如 attack:12 / attack +12 / attack=12）
  [/\b(attack|defense|speed)\s*[\:\+\-=]?\s*\d+/gi, ''],
  // 括号内的数值摘要
  [/[（\(【\[][+\-]?\d+[】\)\]\)】]/g, ''],
];

/**
 * 补全 narrative 末尾
 * - 末尾是"："+ 无引号对话 → 自动补一句"他沉默片刻，没有再开口。"让叙事完整
 * - 末尾是单引号 `"` 或 `'` → 自动补反引号 + 简短后续
 */
export function completeNarrative(text: string): string {
  // v8: 沉浸版 PoC撤销掉——AI 写什么就显示什么，不填充
  // 原因：AI 输出 `:` `,` 末尾时贸然填充会让玩家看到莫名尾注
  return (text || '').trim();
}

/**
 * 截断 narrative 到最近的完整句子边界
 * 用于 AI 输出超过字数上限被 max_tokens 截断时
 * - 如果 text <= maxChars，原样返回
 * - 如果 text > maxChars，找 maxChars 之前最后一个句末标点（。！？!?），截到那里
 * - 如果 maxChars 之前没有任何句末标点，截到 maxChars（不推荐：可能也是半句话）
 */
export function truncateNarrativeAtSentence(text: string, maxChars: number = 400): string {
  if (!text || text.length <= maxChars) return text;
  // 在 maxChars 范围内找最后一个句末标点
  const slice = text.slice(0, maxChars);
  const lastPunctIdx = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('！'),
    slice.lastIndexOf('？'),
    slice.lastIndexOf('!'),
    slice.lastIndexOf('?'),
    slice.lastIndexOf(';'),
    slice.lastIndexOf('；'),
  );
  if (lastPunctIdx > 0) {
    return slice.slice(0, lastPunctIdx + 1);
  }
  // 没有任何句末标点 → 截到 maxChars
  return slice;
}

export function sanitizeNarrativeText(text: string, currentAge?: number): string {
  if (!text || typeof text !== 'string') return text ?? '';
  let result = '';
  let lastIndex = 0;

  // 全局查找所有匹配片段并去重（处理重叠/嵌套匹配）
  type Segment = { start: number; end: number; replacement: string };
  const segments: Segment[] = [];

  for (const [pattern, replacement] of MECHANISM_PATTERNS) {
    pattern.lastIndex = 0; // reset per pattern
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const rep = typeof replacement === 'function' ? replacement(match[0]) : replacement;
      // 保留最长 replacement（去重）
      const existing = segments.findIndex(s => s.start === start && s.end === end);
      if (existing === -1 || rep.length > segments[existing].replacement.length) {
        if (existing !== -1) segments.splice(existing, 1);
        segments.push({ start, end, replacement: rep });
      }
      // 防止死循环：单字符匹配无进展时跳到下一位置
      if (end === start) pattern.lastIndex = start + 1;
    }
  }

  // 无匹配直接返回原文本
  if (!segments.length) return text;

  // 按位置顺序合并重叠片段
  segments.sort((a, b) => a.start - b.start || b.replacement.length - a.replacement.length);
  const merged: Segment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && seg.start <= last.end) {
      // 重叠：保留较长 replacement 的那个
      if (seg.replacement.length > last.replacement.length) {
        merged[merged.length - 1] = seg;
      }
    } else {
      merged.push(seg);
    }
  }

  // 重建文本
  let pos = 0;
  for (const seg of merged) {
    result += text.slice(pos, seg.start);
    result += seg.replacement;
    pos = seg.end;
  }
  result += text.slice(pos);

  // 清理多余空格
  result = result.replace(/ {2,}/g, ' ').trim();
  result = result.replace(/[，,。\.、;：:]{2,}/g, '，').trim();

  // 校准叙事里的"X岁"与当前年龄一致
  // 例：玩家5岁，AI 写了"六岁生辰"或"七岁时他上山"——前者是"生辰"= N+1（合理），后者是事实错位（必须改）
  if (typeof currentAge === 'number' && Number.isFinite(currentAge) && currentAge >= 0) {
    // 收集"X岁"所有出现位置，对每处检查"前/后语境"决定是否替换
    const ageRe = /(\d+)\s*岁(?![\d])/g;
    const targets: { start: number; end: number; num: number; before: string; after: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = ageRe.exec(result)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const num = parseInt(m[1], 10);
      const before = result.slice(Math.max(0, start - 8), start);
      const after = result.slice(end, Math.min(result.length, end + 8));
      targets.push({ start, end, num, before, after });
    }
    // 倒序替换，避免位移
    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      if (t.num === currentAge) continue;
      // 白名单：后跟"生辰/生日/周岁/满"，表示"将/已到达 N 岁"
      if (/(生辰|生日|周岁|满)[\u00b7\.\s\u3000]?$/.test(t.after)) continue;
      // 白名单：年长者称呼，如"百岁老翁" "千岁老祖"等不影响主角
      // 替换成 currentAge
      result = result.slice(0, t.start) + `${currentAge}岁` + result.slice(t.end);
    }
  }
  return result;
}

export function sanitizeEventDraft<T extends { title?: string; narrative?: string }>(draft: T, currentAge?: number): T {
  return {
    ...draft,
    title: draft.title ? sanitizeNarrativeText(draft.title, currentAge) : draft.title,
    narrative: draft.narrative ? sanitizeNarrativeText(draft.narrative, currentAge) : draft.narrative,
  };
}

export function formatEventEffectLabel(eff: any): string {
  if (!eff) return '';
  if (eff.kind) {
    const label = String(eff.label || '获得');
    const name = String(eff.name || '').trim();
    if (!name) return label;
    if (label === '获得状态' || label === '收服灵宠') return `${label}：${name}`;
    return `${label}${name}`;
  }
  const attr = String(eff.attribute || '');
  const reason = String(eff.reason || '').trim();
  const delta = Number(eff.delta || 0);

  if (attr === 'inventory') {
    return reason || (delta > 0 ? '获得物品' : '失去物品');
  }
  if (attr === 'equipped') {
    return reason || (delta > 0 ? '装备入手' : '装备失去');
  }

  const label = attributeLabel(attr);
  const amount = `${delta > 0 ? '+' : ''}${delta}`;
  return `${label}${amount}`;
}

export function eventEffectTone(eff: { attribute?: string; delta?: number; kind?: string; tone?: 'positive' | 'negative' | 'neutral' }): 'positive' | 'negative' | 'neutral' {
  if (eff.tone) return eff.tone;
  const delta = Number(eff.delta || 0);
  if (delta === 0) return 'neutral';
  if ((eff.attribute || '') === 'heartDemon') return delta > 0 ? 'negative' : 'positive';
  return delta > 0 ? 'positive' : 'negative';
}

export function formatItemEffectLabel(eff: any): string {
  const attr = String(eff?.target_attribute || eff?.attribute || '');
  if (!attr || HIDDEN_EFFECT_ATTRIBUTES.has(attr)) return '';
  const zh = attributeLabel(attr);
  const op = eff?.operation || 'add';
  const value = eff?.value ?? eff?.delta ?? '';
  if (op === 'add') return `${zh}${Number(value) > 0 ? '+' : ''}${value}`;
  if (op === 'multiply') return `${zh}×${value}`;
  if (op === 'override') return `${zh}改为${value}`;
  if (op === 'cap') return `${zh}上限${value}`;
  if (op === 'floor') return `${zh}下限${value}`;
  return `${zh}${value !== '' ? String(value) : ''}`;
}
