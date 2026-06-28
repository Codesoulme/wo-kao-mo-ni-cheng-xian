'use client';

import { useEffect, useRef } from 'react';
import {
  writeSaveSlot, summarizeCharacterForSlot, AUTO_SAVE_SLOT,
} from '@/lib/xianxia/save-slots';

/**
 * Phase-M: 自动存档触发器
 * - 每岁变化时自动存到槽 3（手动存到 1/2）
 * - 关键剧情节点（突破、死亡、坐化）后立刻自动存档
 * - 使用 ref 去重，避免同一岁内多次存档
 */

interface Props {
  character: any;             // 当前角色（含 age / realm / cause 等）
  worldCalendar: any;
  events: any[];
  pendingChoice: any;
  // 触发条件：当这些关键字段从无到有时强制自动存档
  watchForBreakthrough?: any;
  watchForDeath?: any;
  refreshSignal?: number;      // 每次外部 advance 后 +1
}

export function useAutoSave({
  character, worldCalendar, events, pendingChoice,
  watchForBreakthrough, watchForDeath, refreshSignal,
}: Props): { lastAutoSaveAt: string | null } {
  const lastSavedAgeRef = useRef<number | null>(null);
  const lastBreakthroughRef = useRef<any>(null);
  const lastDeathRef = useRef<any>(null);
  const lastSignalRef = useRef<number>(0);
  const lastAutoSaveRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!character || typeof character.age !== 'number') return;

    let triggered = false;
    let reason = '';

    // 触发 1: 角色年龄推进
    if (lastSavedAgeRef.current !== null && character.age > lastSavedAgeRef.current) {
      triggered = true;
      reason = `年岁推进至 ${character.age}`;
    }
    // 触发 2: 突破事件
    if (watchForBreakthrough && watchForBreakthrough !== lastBreakthroughRef.current) {
      triggered = true;
      reason = '境界突破';
    }
    // 触发 3: 死亡事件
    if (watchForDeath && watchForDeath !== lastDeathRef.current) {
      triggered = true;
      reason = '轮回坐化';
    }
    // 触发 4: 外部刷新信号
    if (typeof refreshSignal === 'number' && refreshSignal > 0 && refreshSignal !== lastSignalRef.current) {
      triggered = true;
      reason = '关键剧情推进';
    }

    if (!triggered) return;

    try {
      const summary = summarizeCharacterForSlot(character);
      const wc = worldCalendar ?? {};
      const meta = writeSaveSlot(AUTO_SAVE_SLOT, {
        character, events, pendingChoice,
        worldCalendar: wc,
      }, {
        name: '自动档',
        savedAt: new Date().toISOString(),
        savedAge: summary.age,
        savedCalendarYear: typeof wc.calendarYear === 'number' ? wc.calendarYear : 0,
        savedRealm: summary.realm,
        characterName: summary.name,
        eraName: typeof wc.eraName === 'string' ? wc.eraName : '',
        eventsCount: Array.isArray(events) ? events.length : 0,
        isAutoSave: true,
      });
      lastAutoSaveRef.current = meta.savedAt;
      lastSavedAgeRef.current = character.age;
      if (watchForBreakthrough) lastBreakthroughRef.current = watchForBreakthrough;
      if (watchForDeath) lastDeathRef.current = watchForDeath;
      lastSignalRef.current = refreshSignal ?? 0;
    } catch (e) {
      // Silent failure on auto-save so it never breaks gameplay
      console.warn('[auto-save] failed:', e);
    }
  }, [character?.age, character?.id, watchForBreakthrough, watchForDeath, refreshSignal, events?.length]);

  return { lastAutoSaveAt: lastAutoSaveRef.current };
}
