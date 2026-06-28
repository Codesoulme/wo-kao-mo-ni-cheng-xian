// TechDoc 18.6.6: 分层摘要（hierarchical summarization）
// 阈值：30 events → day；7 days → week；4 weeks → month
// 摘要生成函数由调用方注入（生产接 LLM；测试可用 mock）

import type { EpisodicMemory, HierarchicalSummary } from './types';
import { listMemories, addSummary, listSummaries } from './store';
import { generateEntityId } from '../engine';

/** 触发日摘要的 episodic 事件数 */
export const DAY_THRESHOLD = 30;
/** 触发周摘要的日摘要数 */
export const WEEK_THRESHOLD = 7;
/** 触发月摘要的周摘要数 */
export const MONTH_THRESHOLD = 4;

/**
 * 触发条件：未被日摘要过的 episodic 事件数 ≥ DAY_THRESHOLD
 * 摘要生成由调用方注入（避免循环依赖 LLM）
 */
export async function maybeBuildDaySummary(
  characterId: string,
  summarize: (events: EpisodicMemory[]) => Promise<string>
): Promise<HierarchicalSummary | null> {
  const all = listMemories({ kind: 'episodic', characterId }) as EpisodicMemory[];
  // 按 age 升序
  const sorted = [...all].sort((a, b) => a.age - b.age);
  const noSummary = sorted.filter((e) => !e.daySummaryId);
  if (noSummary.length < DAY_THRESHOLD) return null;

  const summaryText = await summarize(noSummary);
  const day: HierarchicalSummary = {
    id: generateEntityId('day_summary'),
    level: 'day',
    characterId,
    startAge: noSummary[0].age,
    endAge: noSummary[noSummary.length - 1].age,
    summary: summaryText,
    highlights: noSummary.slice(0, 5).map((e) => e.eventId),
    createdAt: Date.now(),
  };
  addSummary(day);
  for (const e of noSummary) e.daySummaryId = day.id;
  return day;
}

/**
 * 触发条件：未被周摘要过的日摘要数 ≥ WEEK_THRESHOLD
 */
export async function maybeBuildWeekSummary(
  characterId: string,
  summarize: (summaries: HierarchicalSummary[]) => Promise<string>
): Promise<HierarchicalSummary | null> {
  const days = listSummaries('day', characterId);
  const noWeek = days.filter((d) => !d.weekSummaryId);
  if (noWeek.length < WEEK_THRESHOLD) return null;

  const summaryText = await summarize(noWeek);
  const week: HierarchicalSummary = {
    id: generateEntityId('week_summary'),
    level: 'week',
    characterId,
    startAge: noWeek[0].startAge,
    endAge: noWeek[noWeek.length - 1].endAge,
    summary: summaryText,
    highlights: noWeek.map((d) => d.id),
    createdAt: Date.now(),
  };
  addSummary(week);
  for (const d of noWeek) d.weekSummaryId = week.id;
  return week;
}

/**
 * 触发条件：未被月摘要过的周摘要数 ≥ MONTH_THRESHOLD
 */
export async function maybeBuildMonthSummary(
  characterId: string,
  summarize: (summaries: HierarchicalSummary[]) => Promise<string>
): Promise<HierarchicalSummary | null> {
  const weeks = listSummaries('week', characterId);
  const noMonth = weeks.filter((w) => !w.monthSummaryId);
  if (noMonth.length < MONTH_THRESHOLD) return null;

  const summaryText = await summarize(noMonth);
  const month: HierarchicalSummary = {
    id: generateEntityId('month_summary'),
    level: 'month',
    characterId,
    startAge: noMonth[0].startAge,
    endAge: noMonth[noMonth.length - 1].endAge,
    summary: summaryText,
    highlights: noMonth.map((w) => w.id),
    createdAt: Date.now(),
  };
  addSummary(month);
  for (const w of noMonth) w.monthSummaryId = month.id;
  return month;
}

/**
 * 一次性跑完三层：返回新生成的摘要数量
 */
export async function maybeBuildAllSummaries(
  characterId: string,
  summarizeEvents: (events: EpisodicMemory[]) => Promise<string>,
  summarizeSummaries: (summaries: HierarchicalSummary[]) => Promise<string>
): Promise<{ day?: HierarchicalSummary; week?: HierarchicalSummary; month?: HierarchicalSummary }> {
  const day = await maybeBuildDaySummary(characterId, summarizeEvents);
  const week = await maybeBuildWeekSummary(characterId, summarizeSummaries);
  const month = await maybeBuildMonthSummary(characterId, summarizeSummaries);
  return { day: day ?? undefined, week: week ?? undefined, month: month ?? undefined };
}
