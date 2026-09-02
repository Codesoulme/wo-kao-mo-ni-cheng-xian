// 报时对账：把「引擎先拍的跨度」和「正文最后写出来的时点」对齐。
//
// 2026-08-31：这两段原本只长在 advance-sse 路由里。可玩家点「连推」走的是
// advance-batch → advance/route.ts，那是另一套实现，两段一段都没有。
// 于是同一个存档，单步推进时戳与正文对得上，连推十年就对不上——
// 戳上盖着「三月后」，字里行间还在接着上一句往下说。
// 抽到这里，两条路各调一次，行为同源，改一处两边都跟着改。
//
// 纯函数：不碰 db、不发 SSE、不读 process.env。异常一律由调用方兜。

import {
  advanceWorldCalendar,
  inferDayHourFromText,
  hourNameOf,
  phaseOf,
  mentionsTimeInProse,
  CONTINUOUS_TIME,
  MAX_CONTINUOUS_BEFORE_FORCE_ACCEPT,
} from './world-time';

/** 跨度是谁定的：引擎推的 / 模型自报的 / 按正文回校出来的 */
export type TimeSource = 'engine' | 'model' | 'prose';

const HOUR_LABELS: Record<string, string> = {
  '0.5': '夜半', '3': '凌晨', '5.5': '拂晓', '7': '清晨',
  '12': '日中', '14.5': '午后', '18.5': '黄昏', '20.5': '入夜后',
};

export interface ReconcileInput {
  title?: string;
  narrative?: string;
  timeAdvance: any;
  /** 见 TimeSource。缺省当引擎拍的处理（最保守，两道校对都会跑） */
  timeSource?: TimeSource;
  /** 推进前的日历。没有就只回跨度、不回日历 */
  worldCalendarBefore?: any;
  /** 连续态积压条数，用于止损闸门 */
  consecutiveContinuous?: number;
}

export interface ReconcileOutput {
  timeAdvance: any;
  worldCalendar: any;
  timeSource: TimeSource;
  /** 供日志用的人话，调用方自行决定打不打 */
  notes: string[];
}

/**
 * 一、按正文回校日内时点。
 *   引擎在正文写出来之前就把日历推走了，那时还不知道这段会写成「当晚」还是「翌日清晨」。
 *   拿写完的开头分句反查一次绝对时点，只改 setDayHour，不碰 elapsedDays / ageDeltaYears——
 *   跨度归引擎，时点归行文，两边不打架。
 *
 * 二、矛盾体检：引擎判了要跳，正文却当没这回事。
 *   这种情形把本次跨度撤回，本幕按接着刚才处理，下一幕再跳。三道边界：
 *     1. 只撤引擎自己拍的。模型自报或行文回校出来的时点是它要写的东西，不动；
 *     2. 只撤不跨岁的。岁数在 advance-preload 里早已加过并跑完年度结算，事后撤岁会脱节；
 *     3. 连续态积压到 MAX_CONTINUOUS_BEFORE_FORCE_ACCEPT 就不再撤，改为认下这次跨度，
 *        否则遇上一个始终不肯交代时间的模型，光景会永远停在同一天。
 */
export function reconcileNarrativeTime(input: ReconcileInput): ReconcileOutput {
  const notes: string[] = [];
  let timeAdvance = input.timeAdvance;
  let timeSource: TimeSource = input.timeSource || 'engine';
  const before = input.worldCalendarBefore;
  let worldCalendar = before ? advanceWorldCalendar(before, timeAdvance) : undefined;
  const backlog = Number(input.consecutiveContinuous || 0);
  const narrative = String(input.narrative || '');
  const title = String(input.title || '');

  // ——— 一、日内时点回校 ———
  // 只看标题 + 正文开头分句。按报时约定，时间词落在首句才算报时；
  // 扫全篇会把"他想起那年黄昏"这类回忆误当成当下时点。
  try {
    const firstClause = narrative.split(/[，。！？；\n]/)[0] || '';
    const opening = `${title}\n${firstClause.slice(0, 24)}`;
    const proseHour = inferDayHourFromText(opening);
    if (proseHour !== undefined && proseHour !== timeAdvance?.setDayHour) {
      const isContinuous = timeAdvance?.unit === 'continuous';
      timeAdvance = {
        ...timeAdvance,
        // 连续态被行文改口了：正文既然报了时点，它就不再是"接着刚才"。
        unit: isContinuous ? 'hour' : timeAdvance.unit,
        label: isContinuous ? (HOUR_LABELS[String(proseHour)] || phaseOf(proseHour)) : timeAdvance.label,
        elapsedHours: 0,
        setDayHour: proseHour,
      };
      if (before) worldCalendar = advanceWorldCalendar(before, timeAdvance);
      timeSource = 'prose';
      notes.push(`日内时点按正文回校: ${timeAdvance.label} ${hourNameOf(proseHour)}`);
    }
  } catch (e: any) {
    // 回校失败一律沿用引擎原值，绝不阻断主流程。
    notes.push(`日内时点回校跳过: ${e?.message}`);
  }

  // ——— 二、矛盾体检 ———
  try {
    const twoClauses = narrative.split(/[，。！？；\n]/).slice(0, 2).join('，');
    const opening = `${title}\n${twoClauses.slice(0, 48)}`;
    if (
      timeSource === 'engine' &&
      timeAdvance?.unit !== 'continuous' &&
      Number(timeAdvance?.ageDeltaYears || 0) === 0 &&
      backlog < MAX_CONTINUOUS_BEFORE_FORCE_ACCEPT &&
      !mentionsTimeInProse(opening)
    ) {
      const dropped = timeAdvance?.label;
      timeAdvance = { ...CONTINUOUS_TIME, reason: '正文未交代跨度，本幕按接着刚才处理' };
      if (before) worldCalendar = advanceWorldCalendar(before, timeAdvance);
      notes.push(`跨度撤回（正文未交代）: ${dropped} 积压 ${backlog}`);
    }
  } catch (e: any) {
    notes.push(`矛盾体检跳过: ${e?.message}`);
  }

  return { timeAdvance, worldCalendar, timeSource, notes };
}
