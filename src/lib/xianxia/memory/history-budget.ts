// 叙事历史注入预算（纯库，本批无任何调用点）
//
// ── 这层要解决什么 ──────────────────────────────────────────
// 现在生产里的裁剪是一刀定长 FIFO：从库取一批 → 取最后几条 → 每条正文截前若干字。
// 活到高龄、攒下几百条事件的角色，叙事历史只看得到最后几条的开头。
// 本模块给出**预算驱动**的选路决策，但只返回决策，不执行注入、不改任何现有路径。
//
// ── 三档的精髓不是"三档" ────────────────────────────────────
// 而是：昂贵路径必须有纯确定性的兜底，且兜底不依赖模型。
//   第 1 档 预算够 → 原样注入逐字原文，零成本
//   第 2 档 预算超 → 读已生成好的纪要拼接，同步只读，零模型调用
//   第 3 档 纪要没有（miss）→ 按重要度评分取前若干条标题单行列表，纯引擎算
// 任何一档都不会在这条路上调模型。第 3 档永远可达，所以永远不会没有输出。
//
// ── 两条设计要点 ────────────────────────────────────────────
// 1. 受保护条目永不丢：裁剪只从保护集**之外**挑丢弃对象。
//    保护集 = 未了结的心境记忆（尤其未了因缘 / 欠账 / 承诺 / 结怨）
//           + 紧要程度过线的未了牵挂
//           + 开局设定。
// 2. 压缩前先无损归档：纪要绝不覆盖 EventLog，原文永久保留，
//    纪要只是旁路派生物。有原文才能做后续对比验证。
//
// ── 预算单位刻意用字符 ──────────────────────────────────────
// 全仓没有任何 token 预算机制，也没有 tokenizer 依赖。本模块**不引** tokenizer：
// 预算一律以字符计（可以精确数），另给一个粗略换算供调用方参考。
// 换算系数是估算值，未经校准，见 TOKENS_PER_CJK_CHAR_ESTIMATE 注释。

// ── 估算系数 ───────────────────────────────────────────────

/**
 * 中日韩字符的每字 token 数估算。
 * ⚠ 估算值，未校准。常见 BPE 对中文大致一字一片，故先取 1。
 * 真要用于硬性上限之前，必须拿实际服务端返回的用量数字回归一次。
 */
export const TOKENS_PER_CJK_CHAR_ESTIMATE = 1.0;

/**
 * 拉丁字符的每字 token 数估算。
 * ⚠ 估算值，未校准。英文约四字符一片，故先取 0.25。
 */
export const TOKENS_PER_ASCII_CHAR_ESTIMATE = 0.25;

/** 每条逐字事件除正文以外的固定开销（标题、年龄、分隔符）字符数估算 */
export const PER_ITEM_OVERHEAD_CHARS = 12;

/** 第 3 档默认取前多少条标题 */
export const FALLBACK_TOP_N_DEFAULT = 12;

/** 紧要程度保护线。原始口径见 normalizeUrgency 注释 */
export const QUEST_URGENCY_PROTECT_THRESHOLD = 60;

// ── 估算 ───────────────────────────────────────────────────

export function countChars(text: string): number {
  return typeof text === 'string' ? text.length : 0;
}

/** 粗略 token 估算。仅供参考与日志，不作为硬性判据 */
export function estimateTokensRough(text: string): number {
  if (typeof text !== 'string' || !text) return 0;
  let cjk = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x2e7f) cjk++;
  }
  const ascii = text.length - cjk;
  return Math.ceil(cjk * TOKENS_PER_CJK_CHAR_ESTIMATE + ascii * TOKENS_PER_ASCII_CHAR_ESTIMATE);
}

// ── 输入类型 ───────────────────────────────────────────────

export interface HistoryItem {
  id: string;
  age: number;
  title: string;
  narrative: string;
  eventType?: string;
}

/** 已生成好的纪要（只读引用；形状对齐 digest-store 的快照，刻意不强依赖） */
export interface DigestRef {
  id: string;
  level: 'year' | 'stage' | 'life';
  startAge: number;
  endAge: number;
  summary: string;
  coveredEventCount: number;
}

/** 未了结的心境记忆。sourceEventId 是与历史条目挂钩的结构化线 */
export interface UnresolvedMemoryRef {
  category: string;
  title: string;
  intensity?: number;
  resolved?: boolean;
  sourceEventId?: string | null;
}

export interface QuestRef {
  id: string;
  title: string;
  urgency: number;
  stage?: string;
  sourceEventTitle?: string;
}

/** 最高优先保护的记忆类别：这几类丢了，剧情线就断了 */
export const HARD_PROTECTED_MEMORY_CATEGORIES: readonly string[] = [
  'unresolved_fate',
  'debt',
  'promise',
  'grudge',
];

export interface ProtectionContext {
  currentAge: number;
  /** 开局设定所在年龄，默认 0。该岁的条目一律受保护 */
  birthAge?: number;
  unresolvedMemories?: UnresolvedMemoryRef[];
  questEntries?: QuestRef[];
}

/**
 * 紧要程度归一到百分制。
 *
 * ⚠ 本仓实际口径是 **0-10**，不是 0-100：threads.ts 的 questUrgency 返回 1..10，
 * ai-boundary-validator.ts 直接用 `urgency >= 8` 判紧急。
 * 若照百分制直接拿 60 去比，保护集里的牵挂会永远为空——一条都过不了线，
 * 而且这种失效是静默的，不报错。所以这里做显式归一：
 *   'auto'（默认）→ 不大于 10 的值按十分制放大十倍
 *   'ten' / 'hundred' → 调用方明确指定
 */
export function normalizeUrgency(raw: number, scale: 'auto' | 'ten' | 'hundred' = 'auto'): number {
  if (!Number.isFinite(raw)) return 0;
  if (scale === 'hundred') return raw;
  if (scale === 'ten') return raw * 10;
  return raw <= 10 ? raw * 10 : raw;
}

/**
 * 收集受保护的历史条目 id。
 *
 * 心境记忆走 sourceEventId，是结构化外键，可靠。
 * 牵挂只带 sourceEventTitle、不带事件 id，只能按标题精确匹配挂钩——
 * 这条链**明显更弱**（标题可能重复、可能被改写）。真要收紧，
 * 得给牵挂补一个事件 id 字段，那是另一批的活。
 */
export function collectProtectedEventIds(
  ctx: ProtectionContext,
  items: HistoryItem[] = [],
  urgencyScale: 'auto' | 'ten' | 'hundred' = 'auto'
): Set<string> {
  const ids = new Set<string>();
  const birthAge = ctx.birthAge ?? 0;

  for (const item of items) {
    if (item.age === birthAge) ids.add(item.id);
  }

  for (const mem of ctx.unresolvedMemories ?? []) {
    if (mem.resolved) continue;
    if (mem.sourceEventId) ids.add(mem.sourceEventId);
  }

  const titleToId = new Map<string, string>();
  for (const item of items) {
    if (item.title && !titleToId.has(item.title)) titleToId.set(item.title, item.id);
  }
  for (const q of ctx.questEntries ?? []) {
    if (q.stage === 'completed' || q.stage === 'failed') continue;
    if (normalizeUrgency(q.urgency, urgencyScale) < QUEST_URGENCY_PROTECT_THRESHOLD) continue;
    const hit = q.sourceEventTitle ? titleToId.get(q.sourceEventTitle) : undefined;
    if (hit) ids.add(hit);
  }

  return ids;
}

// ── 重要度评分（可单独测）────────────────────────────────────

/** 事件类型权重。破境 / 因缘关口 / 身死这类是骨架，日常是填充 */
const EVENT_TYPE_WEIGHT: Record<string, number> = {
  death: 60,
  breakthrough: 45,
  fate_node: 40,
  tribulation: 40,
  combat: 25,
  choice: 20,
  interference: 12,
  item: 10,
  normal: 5,
};

export interface ScoreContext {
  currentAge: number;
  protectedEventIds?: Set<string>;
}

/**
 * 重要度评分（纯函数，确定性）。分数只用于排序，绝对值没有含义。
 * 受保护条目直接加一个压倒性的基数，保证排序后必然在最前，
 * 但真正"永不丢"靠的是选取阶段的显式保护，不靠这个分数。
 */
export function scoreImportance(item: HistoryItem, ctx: ScoreContext): number {
  let score = EVENT_TYPE_WEIGHT[item.eventType ?? 'normal'] ?? 5;

  if (ctx.protectedEventIds?.has(item.id)) score += 1000;

  // 越近越重要：与当前年龄的差距每拉开一岁扣一点，最多扣到 30
  const distance = Math.max(0, ctx.currentAge - item.age);
  score += Math.max(-30, -distance * 1);

  // 正文越长，通常信息量越大；权重压得很轻，避免"废话长文"挤掉要紧短条
  score += Math.min(10, Math.floor(countChars(item.narrative) / 100));

  return score;
}

/** 按重要度取前 N（受保护条目先入，再按分数补齐），结果按年龄升序返回 */
export function selectTopByImportance(items: HistoryItem[], n: number, ctx: ScoreContext): HistoryItem[] {
  if (n <= 0) return [];
  const protectedSet = ctx.protectedEventIds ?? new Set<string>();
  const kept = items.filter((i) => protectedSet.has(i.id));
  const rest = items
    .filter((i) => !protectedSet.has(i.id))
    .sort((a, b) => scoreImportance(b, ctx) - scoreImportance(a, ctx) || a.age - b.age);

  const out = [...kept];
  for (const item of rest) {
    if (out.length >= n) break;
    out.push(item);
  }
  // 受保护条目本身可能就超过 n：宁可超预算也不丢保护集
  return out.sort((a, b) => a.age - b.age || a.id.localeCompare(b.id));
}

// ── 三档选路 ───────────────────────────────────────────────

export type HistoryTier = 1 | 2 | 3;

export interface HistoryPlanInput {
  /** 字符预算。注入文本估算长度不得超过此值（第 3 档保护集溢出时例外） */
  budgetChars: number;
  /** L0 逐字候选，按年龄升序或任意序均可 */
  verbatim: HistoryItem[];
  /** 已生成好的纪要；空数组即为 miss，直接落第 3 档 */
  digests?: DigestRef[];
  protection: ProtectionContext;
  /** 第 3 档取前多少条标题 */
  fallbackTopN?: number;
  urgencyScale?: 'auto' | 'ten' | 'hundred';
}

export interface HistoryPlan {
  tier: HistoryTier;
  /** 人话原因，可进日志 */
  reason: string;
  /** 第 1 / 2 档下要逐字注入的条目（第 2 档只剩受保护的那些） */
  verbatimItems: HistoryItem[];
  /** 第 2 档要拼接的纪要，startAge 升序 */
  digests: DigestRef[];
  /** 第 3 档的标题单行列表 */
  fallbackTitles: string[];
  estimatedChars: number;
  budgetChars: number;
  /** 受保护且被保住的条目 id */
  protectedKept: string[];
  /** 被丢弃的条目数（保护集之外） */
  droppedCount: number;
  /** 预算兜不住保护集时为 true——如实标出，不假装没超 */
  overBudget: boolean;
}

function itemCost(item: HistoryItem): number {
  return countChars(item.title) + countChars(item.narrative) + PER_ITEM_OVERHEAD_CHARS;
}

function digestCost(d: DigestRef): number {
  return countChars(d.summary) + PER_ITEM_OVERHEAD_CHARS;
}

/**
 * 三档选路。**纯函数，只返回决策，不执行注入、不读库、不调模型。**
 */
export function planHistoryInjection(input: HistoryPlanInput): HistoryPlan {
  const budget = Math.max(0, input.budgetChars);
  const items = [...input.verbatim].sort((a, b) => a.age - b.age || a.id.localeCompare(b.id));
  const digests = [...(input.digests ?? [])].sort((a, b) => a.startAge - b.startAge);
  const protectedIds = collectProtectedEventIds(input.protection, items, input.urgencyScale);
  const scoreCtx: ScoreContext = {
    currentAge: input.protection.currentAge,
    protectedEventIds: protectedIds,
  };
  const keptProtected = items.filter((i) => protectedIds.has(i.id)).map((i) => i.id);

  // ── 第 1 档：预算兜得住全部逐字原文 ──
  const fullCost = items.reduce((s, i) => s + itemCost(i), 0);
  if (fullCost <= budget) {
    return {
      tier: 1,
      reason: '预算够，原样注入逐字原文',
      verbatimItems: items,
      digests: [],
      fallbackTitles: [],
      estimatedChars: fullCost,
      budgetChars: budget,
      protectedKept: keptProtected,
      droppedCount: 0,
      overBudget: false,
    };
  }

  // ── 第 2 档：预算超了，改拼已生成的纪要 ──
  // 受保护条目仍走逐字，绝不压缩掉。
  if (digests.length > 0) {
    const protectedItems = items.filter((i) => protectedIds.has(i.id));
    const protectedCost = protectedItems.reduce((s, i) => s + itemCost(i), 0);
    const digestTotal = digests.reduce((s, d) => s + digestCost(d), 0);
    if (protectedCost + digestTotal <= budget) {
      return {
        tier: 2,
        reason: '预算超了，改用已生成的纪要拼接，受保护条目仍逐字保留',
        verbatimItems: protectedItems,
        digests,
        fallbackTitles: [],
        estimatedChars: protectedCost + digestTotal,
        budgetChars: budget,
        protectedKept: keptProtected,
        droppedCount: items.length - protectedItems.length,
        overBudget: false,
      };
    }
    // 纪要也塞不下 → 按层降级：先丢岁纪要，再丢阶段纪要，生平纲要最后丢
    const levelDropOrder: Array<DigestRef['level']> = ['year', 'stage', 'life'];
    let trimmed = digests;
    for (const level of levelDropOrder) {
      const candidate = trimmed.filter((d) => d.level !== level);
      const cost = protectedCost + candidate.reduce((s, d) => s + digestCost(d), 0);
      trimmed = candidate;
      if (cost <= budget && candidate.length > 0) {
        return {
          tier: 2,
          reason: '预算超了，纪要按层降级后拼接',
          verbatimItems: protectedItems,
          digests: candidate,
          fallbackTitles: [],
          estimatedChars: cost,
          budgetChars: budget,
          protectedKept: keptProtected,
          droppedCount: items.length - protectedItems.length,
          overBudget: false,
        };
      }
    }
    // 连生平纲要都塞不下 → 落第 3 档，不硬撑
  }

  // ── 第 3 档：纪要没有（miss）或塞不下 → 确定性降级 ──
  // 纯引擎算：按重要度取前若干条标题单行列表，不调模型。
  const topN = input.fallbackTopN ?? FALLBACK_TOP_N_DEFAULT;
  const picked = selectTopByImportance(items, topN, scoreCtx);
  const titles = picked.map((i) => i.title).filter(Boolean);
  const cost = titles.reduce((s, t) => s + countChars(t) + 3, 0);
  return {
    tier: 3,
    reason:
      digests.length > 0
        ? '纪要塞不进预算，降级到重要度标题列表'
        : '没有可用纪要，降级到重要度标题列表',
    verbatimItems: [],
    digests: [],
    fallbackTitles: titles,
    estimatedChars: cost,
    budgetChars: budget,
    protectedKept: keptProtected,
    droppedCount: items.length - picked.length,
    overBudget: cost > budget,
  };
}
