// 世界大事年表 · 状态机 tick
// 扫 schedule：
//   1) scheduled 且 scheduledYear - drift <= yearTo → 转 active，actualStartYear 记下
//   2) active 且 actualStartYear + (actualDuration||plannedDuration) <= yearTo → 转 concluded
//   3) getFolkloreContext：抽 past/nowActive/upcoming 供 prompt 用（不告诉 AI 是"即将发生"）

import type { ScheduledWorldEvent, WorldChronicleShape } from './world-chronicle-types';
import { moveToHistory, updateEvent } from './world-chronicle-store';

export interface TickResult {
  justStarted: ScheduledWorldEvent[];
  active: ScheduledWorldEvent[];
  justConcluded: ScheduledWorldEvent[];
}

/**
 * yearFrom, yearTo: 本次 advance 覆盖的世界年区间（yearFrom 通常等于 yearTo，视 timeAdvance 而定）
 * 会写库：把状态转换持久化
 */
export async function tickChronicle(
  chronicle: WorldChronicleShape,
  yearFrom: number,
  yearTo: number,
): Promise<TickResult> {
  const justStarted: ScheduledWorldEvent[] = [];
  const justConcluded: ScheduledWorldEvent[] = [];
  const stillActive: ScheduledWorldEvent[] = [];

  // 1. scheduled → active
  for (const ev of chronicle.schedule) {
    if (ev.status !== 'scheduled') continue;
    const drift = ev.scheduledDrift ?? 3;
    if (ev.scheduledYear - drift <= yearTo) {
      // 用抖动决定实际开始年（clamp 到 [yearFrom, yearTo]）
      const jitter = Math.floor((Math.random() - 0.5) * Math.min(drift * 2, 6));
      const actualStartYear = Math.max(yearFrom, Math.min(yearTo, ev.scheduledYear + jitter));
      const patched: Partial<ScheduledWorldEvent> = {
        status: 'active',
        actualStartYear,
      };
      await updateEvent(ev.id, patched);
      const merged = { ...ev, ...patched } as ScheduledWorldEvent;
      justStarted.push(merged);
    }
  }

  // 2. active → concluded（含刚 start 的也检查——瞬时事件 duration=1 可能同轮结束）
  const activePool = chronicle.schedule.filter(e => e.status === 'active' || justStarted.some(js => js.id === e.id));
  for (const ev of activePool) {
    const merged = justStarted.find(js => js.id === ev.id) ?? ev;
    const dur = merged.actualDuration ?? merged.plannedDuration;
    if (dur < 0) {
      // 永久事件：不 conclude
      stillActive.push(merged);
      continue;
    }
    const startYear = merged.actualStartYear ?? merged.scheduledYear;
    if (startYear + dur <= yearTo) {
      const actualEndYear = startYear + dur;
      const actualDuration = actualEndYear - startYear;
      await updateEvent(ev.id, {
        status: 'concluded',
        actualEndYear,
        actualDuration,
      });
      justConcluded.push({ ...merged, status: 'concluded', actualEndYear, actualDuration });
    } else {
      stillActive.push(merged);
    }
  }

  // 3. 归档 concluded → history
  if (justConcluded.length > 0) {
    await moveToHistory(justConcluded.map(e => e.id));
  }

  return { justStarted, active: stillActive, justConcluded };
}

export interface FolkloreContext {
  past: ScheduledWorldEvent[];
  nowActive: ScheduledWorldEvent[];
  upcoming: ScheduledWorldEvent[];
}

/**
 * 提供给 prompt 的"世事流转"上下文
 * past: history 中 actualEndYear 落在 [currentYear-windowBefore, currentYear]
 * nowActive: 当前 schedule 中 status=active 的事件
 * upcoming: schedule 中 status=scheduled 且 scheduledYear 落在 [currentYear, currentYear+windowAfter]
 *           （放到 prompt 时改名"传闻卜卦"，不明示"即将发生"）
 */
export function getFolkloreContext(
  chronicle: WorldChronicleShape,
  currentYear: number,
  windowBefore = 120,
  windowAfter = 30,
): FolkloreContext {
  const past: ScheduledWorldEvent[] = chronicle.history
    .filter(e => {
      const y = e.actualEndYear ?? e.scheduledYear;
      return y >= currentYear - windowBefore && y <= currentYear;
    })
    .slice(-8);

  const nowActive: ScheduledWorldEvent[] = chronicle.schedule.filter(e => e.status === 'active');

  const upcoming: ScheduledWorldEvent[] = chronicle.schedule
    .filter(e => {
      if (e.status !== 'scheduled') return false;
      const y = e.scheduledYear;
      return y >= currentYear && y <= currentYear + windowAfter;
    })
    .slice(0, 4);

  return { past, nowActive, upcoming };
}
