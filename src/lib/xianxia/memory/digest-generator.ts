// 历史纪要生成（纯模板，不调任何模型）
//
// ── v1 为什么一律纯模板 ─────────────────────────────────────
// (a) 配额互抢：异步摘要若与已有的 prepareAdvanceCandidate 预热抢同一个
//     5h 窗口，摘要会反过来拖慢主推进——玩家等的是下一岁，不是纪要。
//     纪要是旁路派生物，没有任何理由占用主推进的窗口。
// (b) 可复现：模板是确定性的，同样的输入永远得到同样的文本，
//     验证检查才可复现。带模型的版本每跑一次结果都不同，
//     "上次过了这次没过"根本没法定位。
// 后续若要接模型润色，前提是先有一版确定性输出做对照基线。
//
// ── 为什么按境界阶段切段，不按年数也不按固定事件数 ──────────
// realmTraits 的 capabilities / limitations / worldAccess / socialWeight
// 全部随境界重置。跨境界之前的经历天然该降级——那时角色是另一个量级的
// 存在，能去的地方、说得上话的人、办得成的事全换了一套。
// 这是题材自带的语义边界，不是拍出来的阈值。境界数量有限，段数天然有界。
//
// ── 纪要正文的硬规矩 ────────────────────────────────────────
// 1. 正文里**一个数字都不出现**。年龄区间走 startAge / endAge 两列，
//    境界走 realmAtStart 列。这样"纪要不携带硬事实"是可机械校验的
//    （正文匹配 /[0-9]/ 即为违规），比维护一张词表可靠得多。
// 2. 不写境界名，不写物品 id。物品名与人名是叙事锚点，保留。
// 3. 白话写，不用文言虚词与半文言句式；不出现机制词。
//
// ── 数据来源的实际限制（接线批必读）────────────────────────
// EventLog 没有记录每条事件当时的境界：破境事件写进库时 effects 是空数组，
// 且大境界与小层次都写成同一个 eventType，从原文无法区分。
// 所以本模块**不猜**境界时间线，由调用方作为参数传入
// （事件流里的 character.realm.changed 带 from/to，是正经来源）。
// 传空时退化成单段，再由长停留兜底按年数强切。

// ── 常量 ───────────────────────────────────────────────────

/** L0 逐字保留的最近岁数。范围 3-5，默认取上界 */
export const L0_RECENT_YEARS_DEFAULT = 5;
export const L0_RECENT_YEARS_MIN = 3;
export const L0_RECENT_YEARS_MAX = 5;

/** 各层字数目标区间。上界硬截断，下界是目标值（素材太少时达不到，见 belowMinChars） */
export const YEAR_DIGEST_CHARS: readonly [number, number] = [100, 150];
export const STAGE_DIGEST_CHARS: readonly [number, number] = [200, 300];
export const LIFE_DIGEST_CHARS: readonly [number, number] = [300, 400];

/**
 * 长停留兜底：同一境界停留超过这个岁数就按年数强切一段。
 *
 * ⚠ 待实测常量，依据不足。取 30 只是为了让"元婴期停三百年"不被压成
 * 一条没有信息量的段，没有任何实测或数据支撑说明 30 比 20 或 50 更好。
 * 校准方式：拿真实长寿存档跑一遍，看强切段的字数分布与要点密度，
 * 段内要点被挤掉说明该调小，段与段读起来重复说明该调大。
 * 在此之前不要把这个数字当成结论引用。
 */
export const MAX_YEARS_PER_STAGE_UNVERIFIED = 30;

/** L2 阶段纪要最多保留几段；更早的全部卷进单条 L3 生平纲要 */
export const MAX_STAGE_DIGESTS_DEFAULT = 3;

// ── 输入类型 ───────────────────────────────────────────────

/** 生成纪要所需的最小事件形状。刻意不依赖 Prisma 行类型，便于测试与解耦 */
export interface DigestSourceEvent {
  id: string;
  age: number;
  title: string;
  narrative: string;
  eventType?: string;
}

/** 境界变更点：从 age 这一岁起，角色处于 realm。由调用方从事件流取 */
export interface RealmChangePoint {
  age: number;
  realm: string;
}

/** 模板填充素材，全部来自结构化字段，不从原文里正则抠 */
export interface DigestMaterial {
  /** 该段获得的物品名（不要传 id） */
  itemsGained?: Array<{ age: number; name: string }>;
  /** 该段结识的人 */
  peopleMet?: Array<{ age: number; name: string }>;
  /** 该段结下的怨 */
  grudges?: Array<{ age: number; name: string }>;
}

// ── 切段 ───────────────────────────────────────────────────

export interface StageSegment {
  /** 该段所处境界 id。境界时间线为空时是 'unknown' */
  realm: string;
  startAge: number;
  endAge: number;
  events: DigestSourceEvent[];
  /** true = 因同境界长停留被强切，**不是**真的跨了境界。模板必须据此换措辞 */
  forcedSplit: boolean;
  /** 同一境界内的第几段，从 0 起 */
  splitIndex: number;
}

export interface SegmentOptions {
  maxYearsPerStage?: number;
}

/** 取某一岁所处的境界。时间线为空返回 'unknown' */
export function realmAtAge(timeline: RealmChangePoint[], age: number): string {
  let current = 'unknown';
  for (const p of [...timeline].sort((a, b) => a.age - b.age)) {
    if (p.age <= age) current = p.realm;
    else break;
  }
  return current;
}

/**
 * 按境界阶段切段，同境界长停留按年数强切兜底。
 * 事件按 age 升序处理；同岁多条事件不会被拆到两段。
 */
export function segmentByRealmStage(
  events: DigestSourceEvent[],
  timeline: RealmChangePoint[] = [],
  options: SegmentOptions = {}
): StageSegment[] {
  const maxYears = options.maxYearsPerStage ?? MAX_YEARS_PER_STAGE_UNVERIFIED;
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.age - b.age);
  const segments: StageSegment[] = [];
  let current: StageSegment | null = null;
  const splitCount = new Map<string, number>();

  for (const ev of sorted) {
    const realm = realmAtAge(timeline, ev.age);
    const realmChanged = current !== null && current.realm !== realm;
    // 同岁事件绝不跨段：只有 age 真的推进了才允许强切
    const tooLong =
      current !== null &&
      !realmChanged &&
      ev.age > current.startAge &&
      ev.age - current.startAge >= maxYears &&
      ev.age !== current.endAge;

    if (current === null || realmChanged || tooLong) {
      const idx = realmChanged || current === null ? 0 : (splitCount.get(realm) ?? 0) + 1;
      splitCount.set(realm, idx);
      current = {
        realm,
        startAge: ev.age,
        endAge: ev.age,
        events: [],
        forcedSplit: Boolean(tooLong),
        splitIndex: idx,
      };
      segments.push(current);
    }
    current.events.push(ev);
    current.endAge = ev.age;
  }

  return segments;
}

// ── 边界指纹 ───────────────────────────────────────────────

/**
 * 边界指纹：同一段边界重复生成时的去重键。
 * 覆盖的事件 id 集合进指纹——同区间补写了一条事件，指纹就该变。
 * 用两个不同种子的 FNV-1a 拼成一串，避免只用 32 位时的碰撞；
 * 刻意不引 node:crypto，让本模块在任何运行环境下都能跑。
 */
export function computeBoundaryFingerprint(parts: {
  level: string;
  startAge: number;
  endAge: number;
  realm?: string;
  eventIds: string[];
}): string {
  const canonical = [
    parts.level,
    String(parts.startAge),
    String(parts.endAge),
    parts.realm ?? '',
    [...parts.eventIds].sort().join(','),
  ].join('|');
  const a = fnv1a(canonical, 0x811c9dc5);
  const b = fnv1a(canonical, 0x01000193);
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}${canonical.length.toString(36)}`;
}

function fnv1a(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ── 纪要草稿 ───────────────────────────────────────────────

export interface DigestDraft {
  level: 'year' | 'stage' | 'life';
  startAge: number;
  endAge: number;
  realmAtStart: string;
  summary: string;
  highlights: string[];
  coveredEventCount: number;
  boundaryFingerprint: string;
  /** 素材太少、正文没达到目标下界。不造假填充，如实标出来 */
  belowMinChars: boolean;
}

/** L1 岁纪要：每岁一条 */
export function buildYearDigest(
  age: number,
  events: DigestSourceEvent[],
  material: DigestMaterial = {},
  realm = 'unknown'
): DigestDraft {
  const titles = events.map((e) => normalizeTitle(e.title)).filter(Boolean);
  const clauses: string[] = [];

  clauses.push(openerForYear(events.length));
  if (titles.length > 0) clauses.push(joinDoings(titles));
  const items = pickNames(material.itemsGained, age, age);
  if (items.length) clauses.push(`手里多了${listNames(items)}。`);
  const people = pickNames(material.peopleMet, age, age);
  if (people.length) clauses.push(`认得了${listNames(people)}。`);
  const grudges = pickNames(material.grudges, age, age);
  if (grudges.length) clauses.push(`跟${listNames(grudges)}闹翻了，这笔账没算完。`);
  clauses.push('这些事往后还得接着往下走。');

  return finishDraft('year', age, age, realm, clauses, titles, events, YEAR_DIGEST_CHARS);
}

/** L2 阶段纪要：每个已跨越的境界一条 */
export function buildStageDigest(segment: StageSegment, material: DigestMaterial = {}): DigestDraft {
  const titles = segment.events.map((e) => normalizeTitle(e.title)).filter(Boolean);
  const picked = spreadPick(titles, 5);
  const clauses: string[] = [];

  clauses.push(
    segment.forcedSplit
      ? '这一段日子拖得很长，路数没怎么变，事情一件接一件堆上来。'
      : '这一段日子里跨过了一道大关口。'
  );
  if (picked.length) clauses.push(`要紧的几桩是${listNames(picked)}。`);

  const items = pickNames(material.itemsGained, segment.startAge, segment.endAge);
  if (items.length) clauses.push(`这期间到手的东西有${listNames(items)}，都还留着。`);
  const people = pickNames(material.peopleMet, segment.startAge, segment.endAge);
  if (people.length) clauses.push(`打过交道的人里，${listNames(people)}后来还有牵连。`);
  const grudges = pickNames(material.grudges, segment.startAge, segment.endAge);
  if (grudges.length) clauses.push(`跟${listNames(grudges)}结下的过节一直没解开。`);

  clauses.push(
    segment.forcedSplit
      ? '长年守着同一条路走下来，手上熟了，脾气磨平了些，眼前的难处还是那几样。'
      : '过了那道关口以后，从前那些难处大多不算难处了，能去的地方、说得上话的人跟着换了一层。'
  );

  return finishDraft(
    'stage',
    segment.startAge,
    segment.endAge,
    segment.realm,
    clauses,
    picked,
    segment.events,
    STAGE_DIGEST_CHARS
  );
}

/** L3 生平纲要：L2 之前的全部经历压成一条 */
export function buildLifeDigest(segments: StageSegment[], material: DigestMaterial = {}): DigestDraft {
  const allEvents = segments.flatMap((s) => s.events);
  if (allEvents.length === 0) {
    return finishDraft('life', 0, 0, 'unknown', ['早年的事已经记不清了。'], [], [], LIFE_DIGEST_CHARS);
  }
  const startAge = Math.min(...segments.map((s) => s.startAge));
  const endAge = Math.max(...segments.map((s) => s.endAge));
  const titles = allEvents.map((e) => normalizeTitle(e.title)).filter(Boolean);
  const picked = spreadPick(titles, 6);

  const clauses: string[] = ['早年的事回头看只剩几条筋骨。'];
  if (picked.length) clauses.push(`记得住的是${listNames(picked)}。`);

  const crossed = segments.filter((s) => !s.forcedSplit).length;
  clauses.push(
    crossed > 1
      ? '这些年里换过好几层身份，前后判若两人，早年在意的那些事后来大半不值得再提。'
      : '这些年一直在同一条路上熬着，起落都在这条路里头。'
  );

  const items = pickNames(material.itemsGained, startAge, endAge);
  if (items.length) clauses.push(`一路攒下来的东西里，${listNames(items.slice(0, 4))}还派得上用。`);
  const people = pickNames(material.peopleMet, startAge, endAge);
  if (people.length) clauses.push(`早年结识的人多半散了，${listNames(people.slice(0, 4))}还有下文。`);
  const grudges = pickNames(material.grudges, startAge, endAge);
  if (grudges.length) clauses.push(`欠下和结下的账里，${listNames(grudges.slice(0, 3))}那几笔一直搁着。`);

  clauses.push('往后要办的事都从这些旧账里长出来，绕不开。');

  return finishDraft('life', startAge, endAge, segments[0].realm, clauses, picked, allEvents, LIFE_DIGEST_CHARS);
}

// ── 分层规划（三层 + L0 构成一个不重不漏的划分）─────────────

export interface PlanOptions {
  l0RecentYears?: number;
  maxStageDigests?: number;
  maxYearsPerStage?: number;
  material?: DigestMaterial;
}

export interface DigestPlan {
  /** 逐字注入的最近事件 */
  level0: DigestSourceEvent[];
  /** 三层纪要草稿，startAge 升序 */
  drafts: DigestDraft[];
  /** level0.length + Σ coveredEventCount，应等于输入事件总数 */
  accounted: number;
  totalEvents: number;
}

/**
 * 把一条完整历史规划成 L3 → L2 → L1 → L0 四段，互不重叠、合起来铺满。
 * 划分方式：
 *   L0  最近若干岁，逐字
 *   L1  L0 之前、仍在当前境界段内的年份，每岁一条
 *   L2  最近若干个已跨越的境界段，每段一条
 *   L3  再往前的全部，单条
 * 这样 Σ coveredEventCount + L0 条数恰好等于总条数，缺口校验才有意义。
 */
export function planDigests(
  events: DigestSourceEvent[],
  timeline: RealmChangePoint[] = [],
  options: PlanOptions = {}
): DigestPlan {
  const total = events.length;
  if (total === 0) return { level0: [], drafts: [], accounted: 0, totalEvents: 0 };

  const material = options.material ?? {};
  const recentYears = clampInt(
    options.l0RecentYears ?? L0_RECENT_YEARS_DEFAULT,
    L0_RECENT_YEARS_MIN,
    L0_RECENT_YEARS_MAX
  );
  const maxStages = Math.max(0, options.maxStageDigests ?? MAX_STAGE_DIGESTS_DEFAULT);

  const sorted = [...events].sort((a, b) => a.age - b.age);
  const latestAge = sorted[sorted.length - 1].age;
  const l0Cutoff = latestAge - recentYears + 1;

  const level0 = sorted.filter((e) => e.age >= l0Cutoff);
  const older = sorted.filter((e) => e.age < l0Cutoff);

  const drafts: DigestDraft[] = [];
  if (older.length === 0) return { level0, drafts, accounted: level0.length, totalEvents: total };

  const segments = segmentByRealmStage(older, timeline, {
    maxYearsPerStage: options.maxYearsPerStage,
  });

  // 最后一段与 L0 同处一个境界 → 该段按岁拆成 L1；其余段走 L2 / L3
  const currentRealm = realmAtAge(timeline, latestAge);
  const lastSeg = segments[segments.length - 1];
  const yearSegIdx = lastSeg && lastSeg.realm === currentRealm ? segments.length - 1 : -1;

  const stageCandidates = yearSegIdx >= 0 ? segments.slice(0, yearSegIdx) : segments.slice();
  const yearSeg = yearSegIdx >= 0 ? segments[yearSegIdx] : null;

  const lifeSegs = stageCandidates.slice(0, Math.max(0, stageCandidates.length - maxStages));
  const stageSegs = stageCandidates.slice(Math.max(0, stageCandidates.length - maxStages));

  if (lifeSegs.length > 0) drafts.push(buildLifeDigest(lifeSegs, material));
  for (const seg of stageSegs) drafts.push(buildStageDigest(seg, material));
  if (yearSeg) {
    for (const [age, group] of groupByAge(yearSeg.events)) {
      drafts.push(buildYearDigest(age, group, material, yearSeg.realm));
    }
  }

  drafts.sort((a, b) => a.startAge - b.startAge || a.endAge - b.endAge);
  const accounted = level0.length + drafts.reduce((s, d) => s + d.coveredEventCount, 0);
  return { level0, drafts, accounted, totalEvents: total };
}

// ── helpers ────────────────────────────────────────────────

function finishDraft(
  level: DigestDraft['level'],
  startAge: number,
  endAge: number,
  realm: string,
  clauses: string[],
  highlights: string[],
  events: DigestSourceEvent[],
  band: readonly [number, number]
): DigestDraft {
  const [min, max] = band;
  // 上界硬截断：按句拼，超出就不再加下一句，绝不切半句
  let summary = '';
  for (const c of clauses) {
    if (summary.length + c.length > max && summary.length > 0) continue;
    summary += c;
  }
  return {
    level,
    startAge,
    endAge,
    realmAtStart: realm,
    summary,
    highlights: highlights.slice(0, 5),
    coveredEventCount: events.length,
    boundaryFingerprint: computeBoundaryFingerprint({
      level,
      startAge,
      endAge,
      realm,
      eventIds: events.map((e) => e.id),
    }),
    belowMinChars: summary.length < min,
  };
}

function openerForYear(eventCount: number): string {
  if (eventCount >= 4) return '这一年事情赶得紧，一桩没歇又来一桩。';
  if (eventCount >= 2) return '这一年前后忙了两三件正事。';
  return '这一年过得清淡，只有一件事记得住。';
}

function joinDoings(titles: string[]): string {
  const picked = spreadPick(titles, 3);
  if (picked.length === 1) return `主要是${picked[0]}。`;
  if (picked.length === 2) return `先是${picked[0]}，后来${picked[1]}。`;
  return `先是${picked[0]}，接着${picked[1]}，再往后${picked[2]}。`;
}

/**
 * 去掉标题里的界面前缀，保留可读正文。
 *
 * 带数字的标题一律返回空串（调用方按 filter(Boolean) 丢掉）。
 * 理由：正文"一个数字都不出现"是本模块唯一可机械校验的硬事实边界，
 * 而标题是外来数据，AI 完全写得出带数字的标题。若照抄进正文，
 * 这条边界就退化成"靠调用方自觉"。宁可少引一条标题，不破边界。
 * 抹掉数字再拼会得到"第件事"这种残句，比丢掉更糟，所以整条丢。
 * 实测参考：库里现有的历史标题没有一条带阿拉伯数字，这条兜底几乎不触发。
 */
function normalizeTitle(title: string): string {
  const cleaned = (title || '')
    .replace(/^抉择[：:]\s*/, '')
    .replace(/^干扰[·・]\s*/, '')
    .replace(/^装备[·・]\s*/, '')
    .trim();
  return containsDigit(cleaned) ? '' : cleaned;
}

/** 数字判定：阿拉伯数字 + 全角数字。中文数字不算，"三枚灵石"是叙事不是字段值 */
function containsDigit(text: string): boolean {
  return /[0-9０-９]/.test(text);
}

/** 均匀取样，保证首尾都在，避免只取头几条 */
function spreadPick<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr.slice();
  if (n <= 0) return [];
  if (n === 1) return [arr[0]];
  const out: T[] = [];
  const step = (arr.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

function pickNames(
  list: Array<{ age: number; name: string }> | undefined,
  startAge: number,
  endAge: number
): string[] {
  if (!Array.isArray(list)) return [];
  const names = list
    .filter((x) => x && x.age >= startAge && x.age <= endAge && typeof x.name === 'string' && x.name)
    .map((x) => x.name.trim())
    // 带数字的名字同样丢掉：物品 id、"第三层" 这类都会破掉"正文无数字"的边界
    .filter((n) => n && !containsDigit(n));
  return Array.from(new Set(names));
}

function listNames(names: string[]): string {
  const capped = names.slice(0, 4);
  if (capped.length <= 1) return capped[0] ?? '';
  return `${capped.slice(0, -1).join('、')}和${capped[capped.length - 1]}`;
}

function groupByAge(events: DigestSourceEvent[]): Array<[number, DigestSourceEvent[]]> {
  const map = new Map<number, DigestSourceEvent[]>();
  for (const e of events) {
    const bucket = map.get(e.age);
    if (bucket) bucket.push(e);
    else map.set(e.age, [e]);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
