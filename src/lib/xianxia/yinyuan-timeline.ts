// Phase-S #5: Fate Timeline (因缘时间线) — visualize FateNode + FateEcho + FateWeb across whole lifespan.
// Uses engine's detectFateEchoes + predictFateTrajectory for projections.
// Player sees: 已历因缘 (resolved) + 当前回响 (active echoes) + 未来预兆 (predicted).

import type { FateNode } from '@/lib/xianxia/types';
import type { FateEchoTrigger, FateEchoResolution, FatePredictedOutcome } from '@/lib/xianxia/types';
import { detectFateEchoes, predictFateTrajectory } from '@/lib/xianxia/engine';

export interface YinyuanTimelineEntry {
  age: number;
  archetype: 'resolved' | 'echo-active' | 'predicted' | 'untriggered';
  title: string;
  narrative: string;
  urgency: 'low' | 'normal' | 'high' | 'critical' | 'unknown';
  involvedIds?: string[];
}

const URGENCY_LABEL: Record<string, string> = {
  low: '淡然',
  normal: '留意',
  high: '紧迫',
  critical: '急迫',
  unknown: '未知',
};

const ARCHETYPE_LABEL: Record<YinyuanTimelineEntry['archetype'], string> = {
  'resolved': '已了',
  'echo-active': '回响中',
  'predicted': '预兆',
  'untriggered': '伏笔',
};

const ARCHETYPE_COLOR: Record<YinyuanTimelineEntry['archetype'], string> = {
  'resolved': '#9bbf6c',
  'echo-active': '#c4a76d',
  'predicted': '#9a82c2',
  'untriggered': '#a89878',
};

export function buildYinyuanTimeline(input: {
  character: any;
  fateNodes?: FateNode[];
  history?: FateEchoResolution[];
  web?: any;
}): YinyuanTimelineEntry[] {
  const ch = (input.character && typeof input.character === 'object') ? input.character : {};
  const charId = typeof ch.id === 'string' ? ch.id : 'protagonist';
  const charAge = typeof ch.age === 'number' && ch.age >= 0 ? ch.age : 0;

  // 1. 已触发命运节点（fateNodes 数组存的是 index 列表）
  const triggeredIndexes = Array.isArray(ch.fateNodes) ? ch.fateNodes : [];
  const fateNodes = Array.isArray(input.fateNodes) ? input.fateNodes : [];
  const resolvedEntries: YinyuanTimelineEntry[] = triggeredIndexes.map((idx: number) => {
    const node = fateNodes.find((n) => n.index === idx);
    return {
      age: typeof node?.triggerAge?.max === 'number' ? node.triggerAge.max : charAge,
      archetype: 'resolved',
      title: node?.name || `命节点 ${idx}`,
      narrative: node?.coreConflict || '已历一段因缘',
      urgency: 'low',
    };
  });

  // 2. 当前回响中（detectFateEchoes）
  let activeEchoes: FateEchoTrigger[] = [];
  try {
    activeEchoes = detectFateEchoes(
      { id: charId, age: charAge, npcs: ch.npcs, longTermMemory: ch.longTermMemory },
      Array.isArray(ch.pendingThreads) ? ch.pendingThreads : [],
    );
  } catch { activeEchoes = []; }
  const echoEntries: YinyuanTimelineEntry[] = activeEchoes.map((e) => ({
    age: typeof e.age === 'number' ? e.age : charAge,
    archetype: 'echo-active',
    title: `${e.kind || '回响'} · ${e.id}`,
    narrative: e.narrativeHook || '命途回响尚待回应',
    urgency: (['low', 'normal', 'high', 'critical'].includes(e.urgency) ? e.urgency : 'normal') as any,
    involvedIds: [e.sourceCharacterId, e.targetCharacterId].filter(Boolean),
  }));

  // 3. 未来预兆（predictFateTrajectory）
  let predictions: FatePredictedOutcome[] = [];
  try {
    predictions = predictFateTrajectory(
      { id: charId, age: charAge },
      input.web || { echoes: [], resolutions: [] },
      30,
    );
  } catch { predictions = []; }
  const predictedEntries: YinyuanTimelineEntry[] = predictions.map((p) => ({
    age: typeof p.predictedAge === 'number' ? p.predictedAge : charAge + 5,
    archetype: 'predicted',
    title: p.title || p.eventKind || '预兆',
    narrative: p.narrative || '命途渐露征兆',
    urgency: (['low', 'normal', 'high', 'critical'].includes(p.urgency) ? p.urgency : 'normal') as any,
  }));

  // 4. 未触发命运节点（伏笔）
  const untriggeredEntries: YinyuanTimelineEntry[] = fateNodes
    .filter((n) => n && !triggeredIndexes.includes(n.index))
    .map((n) => ({
      age: typeof n.triggerAge?.min === 'number' ? n.triggerAge.min : charAge,
      archetype: 'untriggered',
      title: n.name,
      narrative: n.narrativeGoal || '一段尚未揭开的因缘',
      urgency: 'unknown',
    }));

  const all = [...resolvedEntries, ...echoEntries, ...predictedEntries, ...untriggeredEntries];
  all.sort((a, b) => a.age - b.age);
  return all;
}

export const YINYUAN_LABELS = {
  URGENCY: URGENCY_LABEL,
  ARCHETYPE: ARCHETYPE_LABEL,
  COLOR: ARCHETYPE_COLOR,
};
