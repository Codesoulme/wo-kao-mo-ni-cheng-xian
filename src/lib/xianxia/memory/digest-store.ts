// 历史纪要读写层（NarrativeDigest）
//
// ── 定位 ────────────────────────────────────────────────────
// 本层是**旁路派生物**的读写口，不是 source of truth。
// EventLog 永久保留逐字原文，纪要绝不覆盖、绝不删除原文；
// 纪要整表清空后，重跑生成即可复原（有原文才能做后续对比验证）。
//
// ── 边界：纪要不携带硬事实 ──────────────────────────────────
// 引擎要校验的硬事实一条都不在纪要里：
//   境界 / 寿元 / 修为   → Character 表字段
//   物品                 → inventory
//   关系门槛             → NpcRelationship 表
// 纪要只负责叙事连贯与笔触延续。所以本层任何一行读失败，
// 调用方都可以直接降级到"不注入纪要"，不会让引擎校验失准。
//
// ── 本批范围 ────────────────────────────────────────────────
// 纯新增，无任何生产调用点。接线（lifecycle 的定长裁剪改预算驱动、
// prompt-builder 增加纪要块）归后续批次。

import { db } from '../../db';

// ── 类型 ───────────────────────────────────────────────────

/**
 * 纪要层级。与 schema 的 String 列一一对应：
 *   year  = L1 岁纪要（每岁一条）
 *   stage = L2 阶段纪要（每个已跨越的境界一条）
 *   life  = L3 生平纲要（L2 之前全部压成一条）
 * L0 是逐字原文，不落本表（原文本来就在 EventLog 里）。
 */
export type DigestLevel = 'year' | 'stage' | 'life';

export const DIGEST_LEVELS: readonly DigestLevel[] = ['year', 'stage', 'life'];

export function isDigestLevel(v: unknown): v is DigestLevel {
  return typeof v === 'string' && (DIGEST_LEVELS as readonly string[]).includes(v);
}

export interface NarrativeDigestSnapshot {
  id: string;
  characterId: string;
  level: DigestLevel;
  startAge: number;
  endAge: number;
  realmAtStart: string;
  summary: string;
  /** 该段几条要点标题（由 highlightsJson 解析；解析失败按空数组兜底） */
  highlights: string[];
  /** 本段覆盖的 EventLog 条数，缺口校验的唯一依据 */
  coveredEventCount: number;
  boundaryFingerprint: string;
  createdAt: number;
}

export interface NarrativeDigestInput {
  characterId: string;
  level: DigestLevel;
  startAge: number;
  endAge: number;
  realmAtStart?: string;
  summary: string;
  highlights?: string[];
  coveredEventCount: number;
  /** 边界指纹，去重键。见 digest-generator.computeBoundaryFingerprint */
  boundaryFingerprint: string;
}

// ── 查询 ───────────────────────────────────────────────────

export interface ListDigestsOptions {
  level?: DigestLevel;
  /** 只取 startAge >= 此值的段 */
  minStartAge?: number;
  /** 只取 endAge <= 此值的段（用于"L0 之前的历史"这类区间取数） */
  maxEndAge?: number;
  limit?: number;
}

/** 分层查询：按 characterId(+level) 取，startAge 升序（叙事必须按时间顺序拼） */
export async function listDigests(
  characterId: string,
  options: ListDigestsOptions = {}
): Promise<NarrativeDigestSnapshot[]> {
  const where: Record<string, unknown> = { characterId };
  if (options.level) where.level = options.level;
  if (options.minStartAge !== undefined) where.startAge = { gte: options.minStartAge };
  if (options.maxEndAge !== undefined) where.endAge = { lte: options.maxEndAge };
  const rows = await db.narrativeDigest.findMany({
    where: where as never,
    orderBy: [{ startAge: 'asc' }, { endAge: 'asc' }],
    ...(options.limit ? { take: options.limit } : {}),
  });
  return rows.map(toSnapshot);
}

/**
 * 一次取齐三层，按层分桶。
 * 每桶内部仍是 startAge 升序，调用方可直接按 life → stage → year 顺序拼文本。
 */
export async function listDigestsByLevel(
  characterId: string
): Promise<Record<DigestLevel, NarrativeDigestSnapshot[]>> {
  const all = await listDigests(characterId);
  const bucket: Record<DigestLevel, NarrativeDigestSnapshot[]> = { year: [], stage: [], life: [] };
  for (const d of all) {
    if (bucket[d.level]) bucket[d.level].push(d);
  }
  return bucket;
}

export async function countDigests(characterId: string, level?: DigestLevel): Promise<number> {
  return db.narrativeDigest.count({
    where: level ? { characterId, level } : { characterId },
  });
}

export async function findDigestByFingerprint(
  characterId: string,
  boundaryFingerprint: string
): Promise<NarrativeDigestSnapshot | null> {
  const row = await db.narrativeDigest.findUnique({
    where: { characterId_boundaryFingerprint: { characterId, boundaryFingerprint } },
  });
  return row ? toSnapshot(row) : null;
}

// ── 写入（幂等） ────────────────────────────────────────────

/**
 * 幂等 upsert：去重键是 (characterId, boundaryFingerprint) 复合唯一索引。
 * 同一段边界重复生成不产生重复行——只把正文覆盖成新的一份。
 *
 * 为什么按指纹而不按 (level, startAge, endAge) 去重：
 * 同一区间的覆盖事件集合可能变（同岁补写了一条事件），
 * 那时区间没变但内容变了，指纹会变，理应是新的一段。
 */
export async function upsertDigest(input: NarrativeDigestInput): Promise<NarrativeDigestSnapshot> {
  const data = {
    level: input.level,
    startAge: input.startAge,
    endAge: input.endAge,
    realmAtStart: input.realmAtStart ?? '',
    summary: input.summary,
    highlightsJson: JSON.stringify(input.highlights ?? []),
    coveredEventCount: input.coveredEventCount,
  };
  const row = await db.narrativeDigest.upsert({
    where: {
      characterId_boundaryFingerprint: {
        characterId: input.characterId,
        boundaryFingerprint: input.boundaryFingerprint,
      },
    },
    update: data,
    create: {
      characterId: input.characterId,
      boundaryFingerprint: input.boundaryFingerprint,
      ...data,
    },
  });
  return toSnapshot(row);
}

export interface UpsertBatchResult {
  /** 新建的行数 */
  created: number;
  /** 命中已有指纹、被覆盖的行数 */
  updated: number;
  rows: NarrativeDigestSnapshot[];
}

/**
 * 批量幂等写入。顺序执行不并发：SQLite 单写者，
 * 并发 upsert 同一张表只会换来 database is locked。
 */
export async function upsertDigests(inputs: NarrativeDigestInput[]): Promise<UpsertBatchResult> {
  let created = 0;
  let updated = 0;
  const rows: NarrativeDigestSnapshot[] = [];
  for (const input of inputs) {
    const existing = await findDigestByFingerprint(input.characterId, input.boundaryFingerprint);
    const row = await upsertDigest(input);
    if (existing) updated++;
    else created++;
    rows.push(row);
  }
  return { created, updated, rows };
}

/** 删除纪要。原文在 EventLog 里，删纪要不丢历史，重跑生成即可复原。 */
export async function deleteDigests(characterId: string, level?: DigestLevel): Promise<number> {
  const result = await db.narrativeDigest.deleteMany({
    where: level ? { characterId, level } : { characterId },
  });
  return result.count;
}

// ── 缺口校验 ───────────────────────────────────────────────

export interface CoverageReport {
  /** 无缺口且无重叠才为 true。false 时调用方降级到"不注入纪要" */
  ok: boolean;
  /** EventLog 总条数 */
  totalEvents: number;
  /** 逐字注入的 L0 条数 */
  level0Count: number;
  /** Σ coveredEventCount */
  digestCovered: number;
  /** level0Count + digestCovered */
  accounted: number;
  /** totalEvents - accounted。正数 = 有历史没人管；负数 = 被重复计入 */
  gap: number;
  /** 区间重叠对，重叠即意味着同一段历史被两层同时覆盖（重复计数） */
  overlaps: Array<{ a: string; b: string }>;
  /** 人话原因，便于日志定位；不含任何硬事实数值 */
  reason: string;
}

/**
 * 缺口校验（纯函数）。
 *
 * ── 为什么参数是"选中的那批纪要"而不是"该角色所有纪要" ──
 * 三层纪要不是互斥存储：一段 L1 岁纪要被卷进 L2 阶段纪要之后，
 * 两行都还在表里（原文与派生物都不删，方便回溯）。
 * 此时把全表的 coveredEventCount 直接相加必然重复计数。
 * 真正有意义的校验是：**本次准备注入的那一批** + L0 是否正好铺满历史。
 * 所以调用方要传入选中集合；overlaps 会把误选（同段历史选了两层）抓出来。
 */
export function verifyDigestCoverage(
  selected: Array<Pick<NarrativeDigestSnapshot, 'id' | 'level' | 'startAge' | 'endAge' | 'coveredEventCount'>>,
  level0Count: number,
  totalEvents: number
): CoverageReport {
  const digestCovered = selected.reduce((sum, d) => sum + (d.coveredEventCount || 0), 0);
  const accounted = digestCovered + level0Count;
  const gap = totalEvents - accounted;

  const overlaps: Array<{ a: string; b: string }> = [];
  const sorted = [...selected].sort((x, y) => x.startAge - y.startAge || x.endAge - y.endAge);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (b.startAge > a.endAge) break; // 已排序，后面的只会更远
      overlaps.push({ a: a.id, b: b.id });
    }
  }

  const ok = gap === 0 && overlaps.length === 0;
  let reason: string;
  if (ok) reason = '历史铺满，无缺口无重叠';
  else if (overlaps.length > 0) reason = '选中的纪要区间有重叠，同一段历史被重复计入';
  else if (gap > 0) reason = '有一段历史既没被逐字注入也没被纪要覆盖';
  else reason = '覆盖数超过历史总数，存在重复计入';

  return { ok, totalEvents, level0Count, digestCovered, accounted, gap, overlaps, reason };
}

/**
 * 缺口校验的库端便利版：totalEvents 从 EventLog 现查，避免调用方传错。
 * selected 不传时默认取该角色全部纪要——那只适合"表里只有一层"的场景，
 * 一般情况请显式传本次要注入的集合（理由见 verifyDigestCoverage 注释）。
 */
export async function verifyCharacterDigestCoverage(
  characterId: string,
  options: { level0Count: number; selected?: NarrativeDigestSnapshot[] }
): Promise<CoverageReport> {
  const totalEvents = await db.eventLog.count({ where: { characterId } });
  const selected = options.selected ?? (await listDigests(characterId));
  return verifyDigestCoverage(selected, options.level0Count, totalEvents);
}

// ── helpers ────────────────────────────────────────────────

function parseHighlights(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function toSnapshot(row: {
  id: string;
  characterId: string;
  level: string;
  startAge: number;
  endAge: number;
  realmAtStart: string;
  summary: string;
  highlightsJson: string;
  coveredEventCount: number;
  boundaryFingerprint: string;
  createdAt: Date | number;
}): NarrativeDigestSnapshot {
  return {
    id: row.id,
    characterId: row.characterId,
    level: isDigestLevel(row.level) ? row.level : 'year',
    startAge: row.startAge,
    endAge: row.endAge,
    realmAtStart: row.realmAtStart,
    summary: row.summary,
    highlights: parseHighlights(row.highlightsJson),
    coveredEventCount: row.coveredEventCount,
    boundaryFingerprint: row.boundaryFingerprint,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt),
  };
}
