// src/lib/xianxia/eval/rules.ts
//
// 叙事质量评测 · 确定性门禁层（不调模型，正则可判，秒级）
//
// 本文件是**唯一**的禁令词表出处。此前这些规则散落在六处：
//   1. src/lib/xianxia/display.ts:385-417        MECHANISM_PATTERNS 展示前替换表
//   2. src/lib/xianxia/llm/prompt-builder.ts:184 机制词黑名单长串（用语约束区）
//   3. src/lib/xianxia/llm/prompt-builder.ts:265 业力/功德数值词
//   4. src/lib/xianxia/llm/prompt-builder.ts:384 元叙事口吻 + 机制词
//   5. src/lib/xianxia/llm/prompt-builder.ts:410 说书局外词
//   6. src/lib/xianxia/llm/prompt-builder.ts:766 功德/杀业数值词
//   7. src/lib/xianxia/llm/prompt-builder.ts:1135 经验值机制词
//   8. src/lib/xianxia/llm/generators.ts:683     旁白口吻词（评传）
//   9. src/lib/xianxia/llm/generators.ts:781     战报数值词
//  10. scripts/ai-output-regression.ts:41-49     BANNED_TERMS
//  11. scripts/probe-leak-all.ts                 14 条泄漏正则
//
// 本层是**纯旁挂**：只读不写，不参与运行时生成链路，不影响玩家可见产出。
//
// ─── 分级原则（最容易做错的地方，务必先读） ────────────────────────────────
//  hard  零容忍。纯技术词，在修仙叙事里出现 100% 是泄漏（engine / JSON / 缓存 / 预演）。
//  soft  按**正则形态**判而非按词判。数值泄漏走这一档：「属性+3」是泄漏，
//        「属性」本身不是；「4层」是泄漏，「四层」不是。
//  warn  只报不判。语体倾向类（半文言、旁白味）主观性强，留给判分器加权，
//        门禁层默认不因它判失败——否则会把正常叙事全判死。
//
// ─── 白名单铁律 ────────────────────────────────────────────────────────────
//  「境界」「灵根」「天劫」「机缘」「渡劫」「飞升」「修为」「法宝」「宗门」这类
//  是玩家可见的正常题材词，**绝不入黑名单**。误伤正常题材词是本层最容易犯的错。
//  见 LORE_WHITELIST_TERMS 与 assertLoreWhitelistSafe()。
//  同理排除的高危误伤项：
//   - 第二人称「你」「我们」：本作叙事本身就用第二人称（真实产出如「你攥着沾了灶灰
//     的衣角」），所以元叙事只按**多字构式**判（「诸位看官」「各位读者」），
//     绝不按裸代词判。
//   - 「可见」：「隐约可见远山」是正常景物描写，只判「由此可见」这类总结构式。
//   - 文言虚词单字「之」「其」「而」：现代汉语复合词遍地（总之/其中/而且），
//     单字一律不入表，只收多字半文言构式且降到 warn。
//   - 「请求」：「向师尊请求」是正常白话。归入 AMBIGUOUS，默认不判失败。

// ==================== 门禁类型 ====================

export type GateId = 'G1' | 'G2' | 'G3' | 'G4';

export type HitSeverity = 'hard' | 'soft' | 'warn';

export interface GateHit {
  /** 命中的实际文本片段 */
  term: string;
  /** 命中来源分类，便于判分器分维度加权 */
  category: string;
  severity: HitSeverity;
  /** 命中位置（字符下标） */
  index: number;
  /** 上下文摘录，便于人工复核是否误报 */
  excerpt: string;
}

export interface GateResult {
  gate: GateId;
  name: string;
  pass: boolean;
  hits: GateHit[];
}

export type NarrativeScope =
  | 'birth'
  | 'advance'
  | 'choice'
  | 'combat-round'
  | 'combat-end'
  | 'breakthrough'
  | 'death'
  | 'settlement'
  | 'generic';

export interface CheckGatesOptions {
  /** 叙事场景，影响 G4 长度界与 G3 旁白口吻是否收紧 */
  scope?: NarrativeScope;
  /** G4 长度下界，缺省按 scope 取 */
  minChars?: number;
  /** G4 长度上界，缺省按 scope 取 */
  maxChars?: number;
  /** 收紧模式：把 AMBIGUOUS 词也计入 G1 判失败 */
  strictAmbiguous?: boolean;
  /** 收紧模式：把半文言/套话语体也计入 G3 判失败 */
  strictStyle?: boolean;
  /** G4 字段齐备校验：必需字段名 */
  requiredFields?: string[];
  /** G4 字段齐备校验：实际字段（配合 requiredFields） */
  fields?: Record<string, unknown>;
}

// ==================== 白名单：正常题材词，绝不入黑名单 ====================

/**
 * 玩家可见的正常业务词。任何黑名单项若命中这里的词，即为词表设计错误。
 * assertLoreWhitelistSafe() 会在自检时逐项验证。
 */
export const LORE_WHITELIST_TERMS: readonly string[] = [
  '境界', '灵根', '天劫', '机缘', '渡劫', '飞升', '修为', '法宝', '宗门',
  '功法', '丹药', '灵石', '筑基', '金丹', '元婴', '化神', '炼气', '大乘',
  '神识', '魂魄', '体魄', '悟性', '气运', '根骨', '福缘', '命格', '血脉',
  '心魔', '秘境', '坊市', '散修', '魔修', '师尊', '道侣', '传承', '闭关',
  '走火', '夺舍', '符箓', '阵盘', '傀儡', '古宝', '灵药', '寿元', '声望',
  '因果', '业力', '功德', '杀业', '善恶', '气血', '灵力', '破势', '护持', '机变',
];

/** 已知的高危误伤项：曾被或可能被误列入黑名单，本层显式排除 */
export const FALSE_POSITIVE_GUARDS: readonly string[] = [
  '你', '我们', '他们', '她',           // 本作用第二人称叙事
  '可见', '之', '其', '而', '也',        // 现代汉语复合词遍地
  '请求', '同步', '内部',                // 正常白话/歧义
  '节点',                                // 「关键节点」可正常出现，只判「命节点」
];

// ==================== G1 机制词泄漏 ====================

/**
 * 硬泄漏 · 英文技术词。零容忍。
 * 来源：prompt-builder.ts:184 + display.ts:412-413 + ai-output-regression.ts:47-49
 * 判法：英文单词边界，大小写不敏感。中文叙事里出现这些 = 100% 泄漏。
 */
export const HARD_LEAK_TERMS_EN: readonly string[] = [
  'engine', 'cache', 'json', 'token', 'schema', 'prompt', 'api', 'fallback',
  'payload', 'render', 'http', 'ssr', 'hydration', 'hook', 'debug', 'stateHash',
  'preload', 'pre_load', 'idempotent', 'backend', 'server', 'pipeline', 'fetch',
  'config', 'route', 'llm', 'node', 'progress', 'timestamp', 'uuid', 'cuid',
  'undefined', 'null', 'NaN', 'stacktrace', 'traceback', 'middleware', 'reducer',
  'projector', 'aggregate', 'zod', 'tsx', 'nextjs',
];

/**
 * 硬泄漏 · 中文机制词。零容忍。
 * 来源：prompt-builder.ts:184 / :384、generators.ts:683、ai-output-regression.ts:41-44
 * 注意 display.ts 的 MECHANISM_PATTERNS **不含**这些中文元词，
 * 所以「天道干预」「预演」能穿过展示层过滤直达玩家——这是真实存在的漏网。
 */
export const HARD_LEAK_TERMS_ZH: readonly string[] = [
  '引擎', '缓存', '命节点', '天道干预', '预演', '预加载', '大模型',
  '服务端', '后端', '客户端', '前端', '数据库', '占位符', '序列化',
  '兜底', '状态机', '回调', '埋点', '幂等', '灰度', '字段', '参数',
  '流年因', '同年续篇', '续篇', '抽卡', '版本号', '接口调用',
  '数值上限', '数值下限', '扣血', '本回合', '结算公式', '伤害公式',
];

/** 硬泄漏 · 中文机制构式（需要上下文限定，单词会误伤） */
export const HARD_LEAK_PATTERNS_ZH: ReadonlyArray<readonly [RegExp, string]> = [
  [/系统(?:提示|公告|消息|面板|播报|通知|判定)/g, 'mechanism-system'],
  [/(?:内部|底层|后台)(?:机制|逻辑|实现|状态|字段)/g, 'mechanism-internal'],
  [/(?:事件|状态|数据|命理)节点/g, 'mechanism-node'],
  [/(?:调用|请求|返回)(?:接口|参数|结果集)/g, 'mechanism-call'],
  [/(?:属性|数值)(?:面板|表|栏)/g, 'mechanism-panel'],
  [/(?:经验值|经验点|熟练度条)/g, 'mechanism-exp'],
  [/(?:业力|功德|杀业|善恶)(?:点数|数值|值)/g, 'mechanism-karma'],
];

/**
 * 歧义词。默认只报 warn 不判失败，opts.strictAmbiguous 才收紧。
 * 这些词在正常白话里有合法用法，legacy 词表把它们一并硬禁是过度触发。
 */
export const AMBIGUOUS_MECHANISM_TERMS: readonly string[] = [
  '请求', '配置', '接口', '节点', '内部', '同步', '异步', '版本', '系统', '模板',
];

// ==================== G2 数值泄漏（按形态判，不按词判） ====================

/** 属性名词根：只用于组装「属性+数字」形态，单独出现不算泄漏 */
export const NUMERIC_ATTRIBUTE_ROOTS: readonly string[] = [
  '变化', '属性', '修为', '悟性', '灵根', '根骨', '福缘', '机缘', '气运',
  '天赋', '命格', '血脉', '体魄', '神识', '魂魄', '破势', '护持', '机变',
  '气血上限', '气血', '灵力上限', '灵力', '声望', '寿元', '功德', '杀业',
  '业力', '心魔', '灵石', '好感', '亲和', '进度', '容量',
];

function buildAttrDeltaPattern(): RegExp {
  // 长词根排前，避免「气血」先吃掉「气血上限」
  const roots = [...NUMERIC_ATTRIBUTE_ROOTS].sort((a, b) => b.length - a.length).join('|');
  return new RegExp(`(?:${roots})\\s*[+\\-±]\\s*\\d{1,8}`, 'g');
}

/**
 * 数值泄漏正则表。
 * 来源：display.ts:401-417（8 条）+ probe-leak-all.ts 的 14 条（已归并为 1 条属性表达式）
 *     + generators.ts:781 战报数值词 + prompt-builder.ts:265 / :766 / :1135
 * 形态判定的好处：不误伤「修为大进」「悟性极高」这类正常写法。
 */
export const NUMERIC_LEAK_PATTERNS: ReadonlyArray<readonly [RegExp, string, HitSeverity]> = [
  // 属性 + 增减号 + 数字（归并 probe-leak-all 的 14 条）
  [buildAttrDeltaPattern(), 'numeric-attr-delta', 'soft'],
  // 阿拉伯数字 + 量词单位（中文数字「三层」不算）
  [/[+\-×*]?\d{1,8}\s*(?:点|层|颗|枚|格|阶|档)(?![钟头])/g, 'numeric-unit', 'soft'],
  // 裸增减值
  [/(?<![\d/])[+\-±]\d{1,8}(?![\d年月日岁])/g, 'numeric-bare-delta', 'soft'],
  // 百分比
  [/[+\-]?\d{1,8}(?:%|％)/g, 'numeric-percent', 'soft'],
  // 内部字段名 + 数值（attack:12 / hp = 30 / cultivationExp+50）
  [/\b(?:hp|maxHp|mp|maxMp|attack|defense|speed|exp|cultivationExp|luck|comprehension|karma|merit|sin|heartDemon|spiritStones|reputation|lifespan|storageCapacity)\s*[:=+\-]?\s*\d{1,8}/gi, 'numeric-field-value', 'soft'],
  // progress 裸值
  [/\bprogress\s*\d+/gi, 'numeric-progress', 'soft'],
  // 括号内数值摘要
  [/[（(【[][+\-]?\d{1,8}[)）\]】]/g, 'numeric-paren', 'soft'],
  // 战报机制表达（generators.ts:781）
  [/(?:造成|受到|扣除|恢复|回复)\s*\d{1,8}\s*点?\s*(?:伤害|血|气血|灵力)/g, 'numeric-combat-report', 'soft'],
  [/\bHP\b|\bMP\b/g, 'numeric-combat-hp', 'soft'],
  // 分数/比值形态（120/200）
  [/(?<![\d年月日])\d{1,6}\s*\/\s*\d{1,6}(?![\d年月日])/g, 'numeric-ratio', 'warn'],
  // 倍率机制表达（×1.5 修炼速度这类只应出现在心得，不应出现在叙事）
  [/[×x]\s*\d+(?:\.\d+)?\s*倍?/g, 'numeric-multiplier', 'warn'],
];

// ==================== G3 局外词 ====================

/**
 * 说书体局外词。来源：prompt-builder.ts:410（逐条抄录，一字不减）
 */
export const STORYTELLER_TERMS: readonly string[] = [
  '上回说到', '且听下回分解', '预知后事如何', '系统提示', '旁白', '作者注',
  '笔者', '注：', '话说回来', '话说', '上回', '上文书', '欲知后事', '下文分解',
];

/**
 * 元叙事构式。来源：prompt-builder.ts:384
 * 关键：**不收裸代词**。原文列了「你」「我们」，但本作叙事本身就是第二人称，
 * 裸代词入表会把绝大多数正常样本判死，故只收多字构式。
 */
export const META_NARRATIVE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?:诸位|各位|亲爱的)?(?:看官|读者)/g, 'meta-audience'],
  [/(?:本文|本回|本章|本节|上一章|下一章)/g, 'meta-chapter'],
  [/(?:这部|这篇|本篇)?(?:小说|话本|故事)(?:里|中)?(?:的)?(?:主角|人物)/g, 'meta-fiction'],
  [/(?:作者|编者|译者)(?:注|按|曰|说)/g, 'meta-author'],
  [/(?:欲知|预知)后事(?:如何)?/g, 'meta-cliffhanger'],
  [/(?:我们|咱们)(?:可以)?(?:看到|发现|注意到)/g, 'meta-wefind'],
];

/**
 * 旁白/观察者口吻。来源：generators.ts:683（评传禁旁白）
 * 关键：「可见」单字排除，只判「由此可见」构式；「此生」降 warn。
 */
export const NARRATOR_VOICE_PATTERNS: ReadonlyArray<readonly [RegExp, string, HitSeverity]> = [
  [/由此可见|足见其|足见/g, 'narrator-conclude', 'soft'],
  [/纵观(?:其|这|全)/g, 'narrator-survey', 'soft'],
  [/堪称(?:一代|一世|绝)?/g, 'narrator-appraise', 'warn'],
  [/此人|其人|这位修士|这名修士/g, 'narrator-thirdperson', 'soft'],
  [/(?:他|她)(?:的)?这一生|(?:他|她)这一世/g, 'narrator-lifespan', 'soft'],
  [/此生(?:此世)?/g, 'narrator-thislife', 'warn'],
];

/**
 * 元认知旁白（AI 替玩家解读角色心理）。来源：prompt-builder.ts:339
 * 用紧构式，避免把「他不知道自己该往哪走」这类正常内心戏判死。
 */
export const META_COGNITION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?:他|她|它)?(?:还|尚)(?:不|未)(?:明白|知道|懂|清楚)(?:这|那|其|此)(?:意味|代表|将|会|究竟)/g, 'metacog-notyet'],
  [/这(?:一刻|一瞬|时)[^。！？]{0,12}(?:还|尚)(?:不|未)(?:懂|明白|知道)/g, 'metacog-moment'],
  [/懵懂(?:的)?(?:喜悦|欢喜|快乐|无知)/g, 'metacog-innocent'],
  [/(?:他|她)(?:并)?不曾想到/g, 'metacog-foreshadow'],
  [/(?:年纪尚小|年岁尚幼)[^。！？]{0,10}(?:只是|不过)(?:懵懂|无知)/g, 'metacog-tooyoung'],
];

/**
 * 抽象总结套话。来源：prompt-builder.ts:375（避三件事之①②）
 */
export const CLICHE_SUMMARY_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/这一(?:天|年|刻)(?:注定)?(?:不平凡|不寻常|将被铭记)/g, 'cliche-fateful'],
  [/心(?:里|中)(?:涌起|升起|泛起)(?:一股|一阵)?(?:暖流|暖意|豪情)/g, 'cliche-warmth'],
  [/人生(?:真是|果然)?(?:奇妙|无常|如戏)/g, 'cliche-life'],
  [/一切(?:都)?(?:结束了|才刚开始)|故事(?:才)?刚(?:刚)?开始/g, 'cliche-ending'],
  [/(?:绝美|惊艳|震撼|万古|绝世|旷世|一场造化)/g, 'cliche-adjective'],
];

/**
 * 半文言语体。来源：prompt-builder.ts:339「全文用白话」规则。
 * 全部为 warn 级：语体主观、判分器加权更合适；且**绝不收单字虚词**
 * （「之」「其」「而」在现代汉语复合词里遍地，收单字必然误伤）。
 */
export const CLASSICAL_STYLE_TERMS: readonly string[] = [
  '此子', '这般', '已然', '甚是', '不过如此', '心中那桩未了之事',
  '岂', '吾', '汝', '尔等', '乃是', '盖因', '焉', '哉',
];

/**
 * 题材违和反例。来源：prompt-builder.ts:262（原 :335，天灵根降生却「甚是失望」）
 * 这不是词表而是**语义组合**：天灵根/异灵根 + 失望/遗憾/不过如此。
 *
 * 两处刻意的设计（改动前先想清楚）：
 *   1. 中间允许跨句号（真实坏例几乎都是「……是天灵根。村民甚是失望」两句写的），
 *      但仍限 40 字内，且不跨 ！？（跨感叹/疑问基本已是另一段情绪）。
 *   2. 前置否定护栏：「不是天灵根，母亲有些失望」是**完全正当**的写法，
 *      测灵失败本该失望。漏掉这层护栏，这条正则就是误报机器。
 */
export const SETTING_VIOLATION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?<!不是)(?<!并非)(?<!没有)(?<!未见)(?<!无)(?:天灵根|异灵根|单属性灵根|真灵根)[^！？]{0,40}(?:甚是失望|有些失望|失望|遗憾|不过如此|不以为意|不甚在意)/g, 'setting-root-disappoint'],
  [/(?:失望|遗憾|不过如此)[^！？]{0,20}(?<!不是)(?<!并非)(?<!没有)(?:天灵根|异灵根|真灵根)/g, 'setting-disappoint-root'],
];

// ==================== G4 结构完整 ====================

/** 按场景的长度界。来源：prompt-builder.ts:265（推进 400-600）/ :377（80-200） */
const SCOPE_LENGTH_BOUNDS: Record<NarrativeScope, readonly [number, number]> = {
  birth: [20, 1600],
  advance: [20, 1600],
  choice: [20, 1600],
  'combat-round': [20, 1600],
  'combat-end': [12, 1600],
  breakthrough: [20, 1600],
  death: [20, 1600],
  settlement: [20, 2400],
  generic: [12, 1600],
};

/** 句末合法收尾字符 */
const SENTENCE_END_CHARS = ['。', '！', '？', '!', '?', '」', '”', '』', '…', '.', '—'];

/** 句中停顿字符：出现在结尾或换行前 = 半句截断 */
const MID_SENTENCE_CHARS = ['，', '、', '；', '：', ',', ';', ':', '「', '“', '『'];

// ==================== 内部工具 ====================

function excerptAt(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 12);
  const end = Math.min(text.length, index + len + 12);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\n/g, '⏎') + (end < text.length ? '…' : '');
}

function pushTermHits(
  text: string,
  terms: readonly string[],
  category: string,
  severity: HitSeverity,
  out: GateHit[],
  caseInsensitive = false,
): void {
  const haystack = caseInsensitive ? text.toLowerCase() : text;
  for (const term of terms) {
    const needle = caseInsensitive ? term.toLowerCase() : term;
    let from = 0;
    for (;;) {
      const idx = haystack.indexOf(needle, from);
      if (idx < 0) break;
      out.push({ term: text.slice(idx, idx + term.length), category, severity, index: idx, excerpt: excerptAt(text, idx, term.length) });
      from = idx + needle.length;
    }
  }
}

function pushEnglishWordHits(text: string, terms: readonly string[], category: string, out: GateHit[]): void {
  for (const term of terms) {
    // 英文单词边界；\b 对纯 ASCII 词可靠
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({ term: m[0], category, severity: 'hard', index: m.index, excerpt: excerptAt(text, m.index, m[0].length) });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
}

function pushPatternHits(
  text: string,
  patterns: ReadonlyArray<readonly [RegExp, string] | readonly [RegExp, string, HitSeverity]>,
  defaultSeverity: HitSeverity,
  out: GateHit[],
): void {
  for (const entry of patterns) {
    const re = entry[0];
    const category = entry[1];
    const severity = (entry.length > 2 ? (entry as readonly [RegExp, string, HitSeverity])[2] : defaultSeverity) as HitSeverity;
    const local = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = local.exec(text)) !== null) {
      if (!m[0]) { local.lastIndex++; continue; }
      out.push({ term: m[0], category, severity, index: m.index, excerpt: excerptAt(text, m.index, m[0].length) });
      if (m.index === local.lastIndex) local.lastIndex++;
    }
  }
}

function failsOn(hits: GateHit[], strict: boolean): boolean {
  return hits.some((h) => h.severity === 'hard' || h.severity === 'soft' || (strict && h.severity === 'warn'));
}

// ==================== 四道门禁 ====================

/** G1 机制词泄漏 */
export function checkG1MechanismLeak(text: string, opts: CheckGatesOptions = {}): GateResult {
  const hits: GateHit[] = [];
  pushEnglishWordHits(text, HARD_LEAK_TERMS_EN, 'leak-en', hits);
  pushTermHits(text, HARD_LEAK_TERMS_ZH, 'leak-zh', 'hard', hits);
  pushPatternHits(text, HARD_LEAK_PATTERNS_ZH, 'hard', hits);
  pushTermHits(text, AMBIGUOUS_MECHANISM_TERMS, 'leak-ambiguous', opts.strictAmbiguous ? 'soft' : 'warn', hits);
  hits.sort((a, b) => a.index - b.index);
  return { gate: 'G1', name: '机制词泄漏', pass: !failsOn(hits, false), hits };
}

/** G2 数值泄漏 */
export function checkG2NumericLeak(text: string, _opts: CheckGatesOptions = {}): GateResult {
  const hits: GateHit[] = [];
  pushPatternHits(text, NUMERIC_LEAK_PATTERNS, 'soft', hits);
  hits.sort((a, b) => a.index - b.index);
  return { gate: 'G2', name: '数值泄漏', pass: !failsOn(hits, false), hits };
}

/** G3 局外词（说书体 / 元叙事 / 旁白视角 / 套话 / 题材违和） */
export function checkG3OutOfWorld(text: string, opts: CheckGatesOptions = {}): GateResult {
  const hits: GateHit[] = [];
  pushTermHits(text, STORYTELLER_TERMS, 'outworld-storyteller', 'hard', hits);
  pushPatternHits(text, META_NARRATIVE_PATTERNS, 'hard', hits);
  pushPatternHits(text, META_COGNITION_PATTERNS, 'soft', hits);
  pushPatternHits(text, SETTING_VIOLATION_PATTERNS, 'soft', hits);
  pushPatternHits(text, CLICHE_SUMMARY_PATTERNS, 'warn', hits);
  pushTermHits(text, CLASSICAL_STYLE_TERMS, 'outworld-classical', 'warn', hits);
  // 旁白口吻只在评传/身故场景收硬，其它场景降 warn（战斗里「此人」也算出戏但不致命）
  const narratorStrict = opts.scope === 'settlement' || opts.scope === 'death';
  const narratorHits: GateHit[] = [];
  pushPatternHits(text, NARRATOR_VOICE_PATTERNS, 'warn', narratorHits);
  for (const h of narratorHits) {
    hits.push(narratorStrict ? h : { ...h, severity: 'warn' });
  }
  hits.sort((a, b) => a.index - b.index);
  return { gate: 'G3', name: '局外词', pass: !failsOn(hits, Boolean(opts.strictStyle)), hits };
}

/** G4 结构完整（字段齐备 / 长度在界 / 无半句截断） */
export function checkG4Structure(text: string, opts: CheckGatesOptions = {}): GateResult {
  const hits: GateHit[] = [];
  const scope = opts.scope ?? 'generic';
  const [defMin, defMax] = SCOPE_LENGTH_BOUNDS[scope];
  const min = opts.minChars ?? defMin;
  const max = opts.maxChars ?? defMax;

  const add = (term: string, category: string, severity: HitSeverity, index = 0) => {
    hits.push({ term, category, severity, index, excerpt: excerptAt(text, index, Math.min(term.length, 20)) });
  };

  // 字段齐备
  if (opts.requiredFields && opts.requiredFields.length) {
    const fields = opts.fields ?? {};
    for (const f of opts.requiredFields) {
      if (fields[f] === undefined || fields[f] === null) add(`missing:${f}`, 'struct-missing-field', 'hard');
    }
  }

  const trimmed = text.trim();
  if (!trimmed) {
    add('empty', 'struct-empty', 'hard');
    return { gate: 'G4', name: '结构完整', pass: false, hits };
  }
  if (trimmed.length < min) add(`tooShort:${trimmed.length}<${min}`, 'struct-too-short', 'hard');
  if (trimmed.length > max) add(`tooLong:${trimmed.length}>${max}`, 'struct-too-long', 'soft');

  // 半句截断：结尾不是句末标点
  const last = trimmed[trimmed.length - 1] ?? '';
  if (!SENTENCE_END_CHARS.includes(last)) {
    add(`badTail:${last}`, MID_SENTENCE_CHARS.includes(last) ? 'struct-mid-sentence-tail' : 'struct-no-sentence-end', 'soft', trimmed.length - 1);
  }

  // 冒号收尾且无内容（prompt-builder.ts:388『宣大江低头看儿子:』）
  if (/[:：]\s*$/.test(trimmed)) add('danglingColon', 'struct-dangling-colon', 'hard', trimmed.length - 1);

  // 换行前是句中停顿 = 段落边界切错（prompt-builder.ts:377）
  const badBreak = /([，、；：,;])\s*\n/.exec(trimmed);
  if (badBreak) add(badBreak[1], 'struct-bad-paragraph-break', 'soft', badBreak.index);

  // 引号不配对
  const pairs: Array<[string, string, string]> = [['「', '」', 'quote-corner'], ['“', '”', 'quote-curly'], ['『', '』', 'quote-double-corner']];
  for (const [open, close, tag] of pairs) {
    const o = trimmed.split(open).length - 1;
    const c = trimmed.split(close).length - 1;
    if (o !== c) add(`${tag}:${o}/${c}`, 'struct-unbalanced-quote', 'soft');
  }
  // 直引号奇数个
  const straight = (trimmed.match(/"/g) || []).length;
  if (straight % 2 === 1) add(`straightQuote:${straight}`, 'struct-unbalanced-quote', 'warn');

  hits.sort((a, b) => a.index - b.index);
  return { gate: 'G4', name: '结构完整', pass: !failsOn(hits, false), hits };
}

/**
 * 四道门禁一次跑完。确定性、不调模型、纯正则，秒级。
 */
export function checkGates(text: string, opts: CheckGatesOptions = {}): GateResult[] {
  const safe = typeof text === 'string' ? text : '';
  return [
    checkG1MechanismLeak(safe, opts),
    checkG2NumericLeak(safe, opts),
    checkG3OutOfWorld(safe, opts),
    checkG4Structure(safe, opts),
  ];
}

/** 汇总：是否全部通过 */
export function gatesPassed(results: GateResult[]): boolean {
  return results.every((r) => r.pass);
}

/** 汇总：失败的门禁 id 列表 */
export function failedGateIds(results: GateResult[]): GateId[] {
  return results.filter((r) => !r.pass).map((r) => r.gate);
}

// ==================== 自检：白名单不被误伤 ====================

export interface WhitelistAudit {
  ok: boolean;
  violations: Array<{ term: string; gate: GateId; hit: string }>;
}

/**
 * 逐个把白名单题材词单独喂给 G1/G2/G3，确认没有任何一道门禁把它当泄漏。
 * G4 不参与（单词必然过短，长度门禁本就该报）。
 * 词表任何一次改动都应重跑这个自检。
 */
export function assertLoreWhitelistSafe(): WhitelistAudit {
  const violations: WhitelistAudit['violations'] = [];
  const probes = [...LORE_WHITELIST_TERMS, ...FALSE_POSITIVE_GUARDS];
  for (const term of probes) {
    // 包进一句正常叙事，避免 G4 长度干扰
    const sentence = `他在山中静坐三日，把${term}的事想了一遍，随后起身下山。`;
    for (const r of [checkG1MechanismLeak(sentence), checkG2NumericLeak(sentence), checkG3OutOfWorld(sentence)]) {
      const bad = r.hits.filter((h) => h.severity !== 'warn');
      if (bad.length) violations.push({ term, gate: r.gate, hit: bad.map((h) => `${h.category}:${h.term}`).join(',') });
    }
  }
  return { ok: violations.length === 0, violations };
}

// ==================== 词表规模统计（供报告与体检用） ====================

export interface RuleTableStats {
  hardEn: number;
  hardZh: number;
  hardPatternsZh: number;
  ambiguous: number;
  numericPatterns: number;
  numericAttrRoots: number;
  storyteller: number;
  metaNarrative: number;
  narratorVoice: number;
  metaCognition: number;
  cliche: number;
  classicalStyle: number;
  settingViolation: number;
  loreWhitelist: number;
  fpGuards: number;
  total: number;
}

export function ruleTableStats(): RuleTableStats {
  const s: Omit<RuleTableStats, 'total'> = {
    hardEn: HARD_LEAK_TERMS_EN.length,
    hardZh: HARD_LEAK_TERMS_ZH.length,
    hardPatternsZh: HARD_LEAK_PATTERNS_ZH.length,
    ambiguous: AMBIGUOUS_MECHANISM_TERMS.length,
    numericPatterns: NUMERIC_LEAK_PATTERNS.length,
    numericAttrRoots: NUMERIC_ATTRIBUTE_ROOTS.length,
    storyteller: STORYTELLER_TERMS.length,
    metaNarrative: META_NARRATIVE_PATTERNS.length,
    narratorVoice: NARRATOR_VOICE_PATTERNS.length,
    metaCognition: META_COGNITION_PATTERNS.length,
    cliche: CLICHE_SUMMARY_PATTERNS.length,
    classicalStyle: CLASSICAL_STYLE_TERMS.length,
    settingViolation: SETTING_VIOLATION_PATTERNS.length,
    loreWhitelist: LORE_WHITELIST_TERMS.length,
    fpGuards: FALSE_POSITIVE_GUARDS.length,
  };
  const total = Object.values(s).reduce((a, b) => a + b, 0);
  return { ...s, total };
}

// ==================== legacy 兼容出口 ====================

/**
 * scripts/ai-output-regression.ts 原有的 25 词表，**逐字保留**。
 * 该脚本被主回归 smoke 同步 require，行为必须与改造前完全一致，
 * 所以这里只做"搬家"，不做增删——新增能力全部走 checkGates()。
 */
export const BANNED_TERMS_LEGACY: readonly string[] = [
  // 中文
  '引擎', '缓存', '命节点', '天道干预', '预演', '预加载', '节点', '配置',
  'LLM', '大模型', '接口', '请求', '后端', '服务端', '数据库',
  // 英文
  'engine', 'cache', 'node', 'config', 'render', 'backend', 'server',
  'api', 'json', 'http', 'fetch', 'pipeline',
];
