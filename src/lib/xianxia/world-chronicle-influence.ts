// 世界大事年表 · 玩家干预标记解析与应用
// AI 在 narrative 中可能写入形如：
//   [WORLD_EVENT_INFLUENCE:eventId type=advance|delay|weaken|amplify|cancel [years=N] reason="..."]
// 本模块负责：
//   1. parseInfluenceMarkers  — 从 narrative 中提取所有干预标记
//   2. applyInfluencesToChronicle — 按 type 分派更新 chronicle schedule
// 失败绝不阻塞主流程；不合法/前置条件不满足 → skipped，绝不改数据。

import type { ScheduledWorldEvent } from './world-chronicle-types';
import { getChronicle, updateEvent, moveToHistory } from './world-chronicle-store';

export type InfluenceType = 'advance' | 'delay' | 'weaken' | 'amplify' | 'cancel';

export interface ParsedInfluence {
  eventId: string;
  type: InfluenceType;
  reason: string;
  years?: number;
  matchedText: string;
}

export interface ApplyInfluenceResult {
  applied: ParsedInfluence[];
  skipped: Array<{ influence: ParsedInfluence; reason: string }>;
}

const VALID_TYPES: ReadonlySet<string> = new Set(['advance', 'delay', 'weaken', 'amplify', 'cancel']);
const MAX_YEARS = 50;
const DEFAULT_ADVANCE_DELAY_YEARS = 3;

// 主匹配正则
// eventId: 允许 字母/数字/-/_
// type: 任意 word（后校验）
// years: 可选
// reason: 引号内 0-200 字（非 " 字符）
const INFLUENCE_MARKER_RE = /\[WORLD_EVENT_INFLUENCE:\s*([\w\-]+)\s+type=(\w+)(?:\s+years=(\d+))?\s+reason="([^"]{0,200})"\s*\]/gi;

// 通用清洗正则（清除 narrative 中所有 [WORLD_EVENT_INFLUENCE:...] 及可能的闭合标签）
export const INFLUENCE_MARKER_STRIP_RE = /\[WORLD_EVENT_INFLUENCE:[^\]]*\]/gi;
export const INFLUENCE_CLOSING_STRIP_RE = /\[\/WORLD_EVENT_INFLUENCE\]/gi;

/**
 * 从 narrative 文本中提取全部干预标记。
 * 未识别 type 的会被丢弃（不进 applied 也不进 skipped，因为它压根就是废字符串）。
 * 若上层想追踪也可通过 return 值 length 判断——这里保守只返回合法解析结果。
 */
export function parseInfluenceMarkers(narrative: string): ParsedInfluence[] {
  if (!narrative || typeof narrative !== 'string') return [];
  const results: ParsedInfluence[] = [];
  // 重置 lastIndex 防重入
  INFLUENCE_MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INFLUENCE_MARKER_RE.exec(narrative)) !== null) {
    const rawEventId = m[1];
    const rawType = (m[2] || '').toLowerCase();
    const rawYears = m[3];
    const rawReason = m[4] ?? '';
    const matchedText = m[0];
    if (!VALID_TYPES.has(rawType)) continue;
    const parsed: ParsedInfluence = {
      eventId: rawEventId,
      type: rawType as InfluenceType,
      reason: rawReason,
      matchedText,
    };
    if (rawYears != null) {
      const n = parseInt(rawYears, 10);
      if (Number.isFinite(n) && n >= 0) {
        parsed.years = Math.min(n, MAX_YEARS);
      }
    }
    results.push(parsed);
  }
  return results;
}

/**
 * 把干预标记按 type 分派、应用到 chronicle schedule。
 * ctx.currentYear: 当前世界年（用于 advance 的下限 clamp）
 * ctx.characterId: causedBy.id
 */
export async function applyInfluencesToChronicle(
  influences: ParsedInfluence[],
  ctx: {
    currentYear: number;
    characterId: string;
  },
): Promise<ApplyInfluenceResult> {
  const applied: ParsedInfluence[] = [];
  const skipped: Array<{ influence: ParsedInfluence; reason: string }> = [];
  if (!influences || influences.length === 0) {
    return { applied, skipped };
  }

  const chronicle = await getChronicle();
  // 逐条应用；每条基于最新 in-memory schedule 判定，但用 store 的 updateEvent 落库
  // 同一 eventId 多个标记时，后一个会覆盖前一个（尊重 narrative 顺序）
  const scheduleMap = new Map<string, ScheduledWorldEvent>();
  for (const ev of chronicle.schedule) scheduleMap.set(ev.id, ev);
  for (const ev of chronicle.history) scheduleMap.set(ev.id, ev);

  for (const inf of influences) {
    const ev = scheduleMap.get(inf.eventId);
    if (!ev) {
      skipped.push({ influence: inf, reason: 'event_not_found' });
      continue;
    }

    // 已 canceled 一律跳过
    if (ev.status === 'canceled') {
      skipped.push({ influence: inf, reason: 'already_canceled' });
      continue;
    }

    // 已 concluded 且不是 weaken/amplify（纯 causedBy 追记）→ 跳过
    if (ev.status === 'concluded' && inf.type !== 'weaken' && inf.type !== 'amplify') {
      skipped.push({ influence: inf, reason: 'already_concluded' });
      continue;
    }

    const causedBy: NonNullable<ScheduledWorldEvent['causedBy']> = {
      kind: 'character',
      id: ctx.characterId,
      reason: inf.reason,
    };

    const years = Math.max(0, Math.min(inf.years ?? DEFAULT_ADVANCE_DELAY_YEARS, MAX_YEARS));

    if (inf.type === 'advance') {
      // active 已经在发生 → 记 skipped
      if (ev.status === 'active') {
        skipped.push({ influence: inf, reason: 'active_cannot_advance' });
        continue;
      }
      const beforeYear = ev.scheduledYear;
      const afterYear = Math.max(ctx.currentYear, ev.scheduledYear - years);
      try {
        await updateEvent(ev.id, { scheduledYear: afterYear, causedBy });
        // 同步 in-memory 供后续同 eventId 的标记读到最新值
        scheduleMap.set(ev.id, { ...ev, scheduledYear: afterYear, causedBy });
        applied.push(inf);
        console.log('[chronicle] influence applied:', ev.id, inf.type, years, '→', beforeYear, '->', afterYear);
      } catch (e) {
        skipped.push({ influence: inf, reason: 'store_update_failed' });
      }
      continue;
    }

    if (inf.type === 'delay') {
      const beforeYear = ev.scheduledYear;
      if (ev.status === 'scheduled') {
        const afterYear = ev.scheduledYear + years;
        try {
          await updateEvent(ev.id, { scheduledYear: afterYear, causedBy });
          scheduleMap.set(ev.id, { ...ev, scheduledYear: afterYear, causedBy });
          applied.push(inf);
          console.log('[chronicle] influence applied:', ev.id, inf.type, years, '→', beforeYear, '->', afterYear);
        } catch {
          skipped.push({ influence: inf, reason: 'store_update_failed' });
        }
      } else if (ev.status === 'active') {
        // 拖长持续
        const curDur = ev.actualDuration ?? ev.plannedDuration;
        const nextDur = Math.max(0, curDur + years);
        try {
          await updateEvent(ev.id, { actualDuration: nextDur, causedBy });
          scheduleMap.set(ev.id, { ...ev, actualDuration: nextDur, causedBy });
          applied.push(inf);
          console.log('[chronicle] influence applied:', ev.id, inf.type, years, '→ duration', curDur, '->', nextDur);
        } catch {
          skipped.push({ influence: inf, reason: 'store_update_failed' });
        }
      } else {
        skipped.push({ influence: inf, reason: 'unsupported_status_for_delay' });
      }
      continue;
    }

    if (inf.type === 'weaken') {
      try {
        const patch: Partial<ScheduledWorldEvent> = { causedBy };
        if (ev.status === 'active') {
          const curDur = ev.actualDuration ?? ev.plannedDuration;
          patch.actualDuration = Math.max(1, curDur - 1);
        }
        await updateEvent(ev.id, patch);
        scheduleMap.set(ev.id, { ...ev, ...patch });
        applied.push(inf);
        console.log('[chronicle] influence applied:', ev.id, inf.type, '(causedBy recorded)');
      } catch {
        skipped.push({ influence: inf, reason: 'store_update_failed' });
      }
      continue;
    }

    if (inf.type === 'amplify') {
      try {
        const patch: Partial<ScheduledWorldEvent> = { causedBy };
        if (ev.status === 'active') {
          const curDur = ev.actualDuration ?? ev.plannedDuration;
          patch.actualDuration = curDur + 1;
        }
        await updateEvent(ev.id, patch);
        scheduleMap.set(ev.id, { ...ev, ...patch });
        applied.push(inf);
        console.log('[chronicle] influence applied:', ev.id, inf.type, '(causedBy recorded)');
      } catch {
        skipped.push({ influence: inf, reason: 'store_update_failed' });
      }
      continue;
    }

    if (inf.type === 'cancel') {
      if (ev.status !== 'scheduled') {
        skipped.push({ influence: inf, reason: 'cancel_requires_scheduled' });
        continue;
      }
      try {
        await updateEvent(ev.id, { status: 'canceled', causedBy, actualEndYear: ctx.currentYear });
        // 从 schedule 归档到 history（moveToHistory 只搬 concluded，这里需要手动 —— 直接用 updateEvent 保留 status=canceled；
        // 但架构里 moveToHistory 仅接受 concluded，故 canceled 事件留在 schedule 也 OK，tick 会因为 status!==scheduled 跳过它）
        scheduleMap.set(ev.id, { ...ev, status: 'canceled', causedBy, actualEndYear: ctx.currentYear });
        applied.push(inf);
        console.log('[chronicle] influence applied:', ev.id, inf.type, 'at year', ctx.currentYear);
      } catch {
        skipped.push({ influence: inf, reason: 'store_update_failed' });
      }
      continue;
    }
  }

  return { applied, skipped };
}

/**
 * 从 narrative 中剥离所有 [WORLD_EVENT_INFLUENCE:...] 标记（含误加的闭合标签）。
 */
export function stripInfluenceMarkers(narrative: string): string {
  if (!narrative) return narrative;
  return narrative
    .replace(INFLUENCE_MARKER_STRIP_RE, '')
    .replace(INFLUENCE_CLOSING_STRIP_RE, '');
}
