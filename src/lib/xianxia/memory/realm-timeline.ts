// 境界时间线解析（Event store → digest-generator 的 timeline 入参）
//
// ── 这层为什么存在 ──────────────────────────────────────────
// digest-generator 刻意**不猜**境界时间线，由调用方显式传入。
// 那个设计是对的：EventLog 原文里分不出大境界与小层次，从正文回推必然出错。
// 正经来源是事件流里的 character.realm.changed，它带 from / to 两端，
// 且只在**大境界**变动时才写（小层次 realmLevel 0-9 不发）——
// 这正好是纪要按大境界切段要的粒度，不需要再过滤一遍。
//
// 写入点共四处，形状一致：
//   advance-sse/route.ts   系统推进
//   choose/route.ts        抉择结算
//   interfere/route.ts     干扰结算
//   ascension/end/route.ts 飞升收束
//
// ── 零变更点是常态，不是异常 ────────────────────────────────
// 绝大多数存档从没破过大境界（当前库里 character.realm.changed 一条都没有）。
// 这时整段历史算作一段，境界取角色当前值。
// 本模块**不许**为此报错、不许拒绝生成、不许返回空时间线——
// 返回空数组会让 realmAtAge 一路返回 'unknown'，纪要的 realmAtStart 就成了垃圾值。
//
// ── 时间戳一律用 createdAtAge ───────────────────────────────
// 不用 timestamp（真实世界毫秒）：纪要切的是角色的岁数轴，不是玩家的钟。
// createdAtAge 为空的记录无法定位到岁数轴上，只能跳过并如实计数。

import { getEvents } from '../events/store';
import type { RealmChangePoint } from './digest-generator';

/** 无法确定境界时的占位值。与 digest-generator.realmAtAge 的返回保持一致 */
export const UNKNOWN_REALM = 'unknown';

/** 解析所需的最小记录形状。刻意不依赖 Event 行类型，便于纯函数测试 */
export interface RealmChangeRecord {
  /** 该变更发生时角色的岁数。为空表示无法定位，会被跳过 */
  createdAtAge?: number | null;
  /** 变更前的大境界 id */
  from?: unknown;
  /** 变更后的大境界 id */
  to?: unknown;
}

export interface RealmTimelineOptions {
  /** 角色当前大境界。零变更点时整段用它；不传或为空时退化成占位值 */
  currentRealm?: string;
  /** 历史起点岁数，默认 0。首段回填挂在这一岁 */
  birthAge?: number;
}

export interface RealmTimelineResult {
  /** 直接喂给 digest-generator 的 planDigests / segmentByRealmStage */
  timeline: RealmChangePoint[];
  /** 'events' = 用上了真实变更点；'fallback' = 零变更点，整段一档 */
  source: 'events' | 'fallback';
  /** 真正采纳的变更点数，不含回填的起点 */
  changePointCount: number;
  /** 因缺 createdAtAge 或 to 字段被跳过的记录数 */
  skipped: number;
  /** 首段是否由 from 字段回填出来 */
  backfilledOrigin: boolean;
  /** 人话原因，进日志用 */
  reason: string;
}

function usableRealm(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * 纯函数版解析。输入按任意顺序给都行，但**同岁多条时保留靠后的那条**，
 * 所以调用方应按 aggregateVersion 升序传入（getEvents 默认就是这个序）。
 *
 * 产出保证：
 *   1. 返回的数组永不为空（零变更点走兜底单段）
 *   2. age 严格升序，同岁不会出现两条
 *   3. 相邻同境界会被合并——重复点会让 segmentByRealmStage 白切一刀
 */
export function buildRealmTimeline(
  records: RealmChangeRecord[],
  options: RealmTimelineOptions = {}
): RealmTimelineResult {
  const birthAge = Number.isFinite(options.birthAge) ? Number(options.birthAge) : 0;
  const currentRealm = usableRealm(options.currentRealm) ?? UNKNOWN_REALM;

  const list = Array.isArray(records) ? records : [];
  let skipped = 0;

  // 1) 只留能落到岁数轴上、且知道落点境界的记录
  const valid: Array<{ age: number; to: string; from: string | null; order: number }> = [];
  list.forEach((r, order) => {
    const age = r?.createdAtAge;
    const to = usableRealm(r?.to);
    if (typeof age !== 'number' || !Number.isFinite(age) || !to) {
      skipped++;
      return;
    }
    valid.push({ age, to, from: usableRealm(r?.from), order });
  });

  // 2) 零变更点：整段历史一档，用角色当前境界。这是常态
  if (valid.length === 0) {
    return {
      timeline: [{ age: birthAge, realm: currentRealm }],
      source: 'fallback',
      changePointCount: 0,
      skipped,
      backfilledOrigin: false,
      reason:
        skipped > 0
          ? '没有可用的境界变更点（有记录但缺岁数或落点境界），整段历史按角色当前境界算一段'
          : '从没跨过大境界，整段历史按角色当前境界算一段',
    };
  }

  // 3) 岁数升序；同岁按原顺序，落点境界取靠后的那条。
  //    但来源境界要取**靠前**的那条：同一岁连破两阶时，
  //    这一岁之前角色处的是第一条的 from，不是最后一条的 from。
  //    两者混用会让首段回填出一个角色从没待过的境界。
  valid.sort((a, b) => a.age - b.age || a.order - b.order);
  const byAge = new Map<number, { age: number; to: string; from: string | null }>();
  for (const v of valid) {
    const prev = byAge.get(v.age);
    byAge.set(v.age, { age: v.age, to: v.to, from: prev ? prev.from : v.from });
  }
  const points = Array.from(byAge.values()).sort((a, b) => a.age - b.age);

  // 4) 首段回填：第一次变更之前角色处于 from 那个境界，从出生起算。
  //    from 不可用时不硬造——留空比编一个错的强，realmAtAge 会如实返回占位值。
  const timeline: RealmChangePoint[] = [];
  const first = points[0];
  const backfilledOrigin = Boolean(first.from) && first.age > birthAge;
  if (backfilledOrigin) timeline.push({ age: birthAge, realm: first.from as string });

  for (const p of points) {
    const prev = timeline[timeline.length - 1];
    // 相邻同境界合并：重复点会让切段白切一刀，段内事件被无谓拆开
    if (prev && prev.realm === p.to) continue;
    timeline.push({ age: p.age, realm: p.to });
  }

  return {
    timeline,
    source: 'events',
    changePointCount: points.length,
    skipped,
    backfilledOrigin,
    reason: backfilledOrigin
      ? '按事件流里的境界变更点切段，首段由第一次变更的来源境界回填'
      : '按事件流里的境界变更点切段，首段来源境界不可用，之前的年份算作未知',
  };
}

/**
 * 库端版：从 Event store 读 character.realm.changed 再解析。
 *
 * 读失败不抛：纪要是旁路派生物，读不到时间线就退化成单段，
 * 绝不能因此把调用方的主流程带崩。
 */
export async function loadRealmTimeline(
  characterId: string,
  options: RealmTimelineOptions = {}
): Promise<RealmTimelineResult> {
  let records: RealmChangeRecord[] = [];
  try {
    const events = await getEvents(characterId, { type: 'character.realm.changed' });
    records = events.map((e) => {
      const data = (e.data ?? {}) as { from?: unknown; to?: unknown };
      return { createdAtAge: e.createdAtAge, from: data.from, to: data.to };
    });
  } catch (err) {
    const result = buildRealmTimeline([], options);
    return {
      ...result,
      reason: `读事件流失败，退化成单段：${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return buildRealmTimeline(records, options);
}
