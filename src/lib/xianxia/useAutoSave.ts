'use client';

import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  writeSaveSlot, summarizeCharacterForSlot, AUTO_SAVE_SLOT,
  type SlotId,
} from '@/lib/xianxia/save-slots';
import { useGameStore } from './store';

/**
 * Phase-M: 自动存档触发器
 * - 每岁变化时自动存到槽 3（手动存到 1/2）
 * - 关键剧情节点（突破、死亡、坐化）后立刻自动存档
 * - 使用 ref 去重，避免同一岁内多次存档
 *
 * P0 修复（silent failure）：
 * - writeSaveSlot 返回 Result，失败时不再静默吞错
 * - 失败时记录 lastError 到全局 store（暴露给 UI），但不更新 lastSavedAgeRef，
 *   避免同年龄反复重试写入（QuotaExceeded 时会无限循环）
 * - 每次新失败都用 sonner toast 提示玩家，避免"我以为存了结果没存"
 *
 * P1 修复（双写风险 — Worker N 报告）：
 * - 旧实现里 lastError/lastAutoSaveAt 维护在 useState + useRef，每个组件实例独立。
 *   当 3 个组件（page.tsx / SaveSlotPanel / DeathGuidancePanel）各调一次 useAutoSave，
 *   同一 character age 推进时会触发 3 次 writeSaveSlot(AUTO_SAVE_SLOT=3, ...)。
 * - 新实现：lastError / lastAutoSaveAt 提升到全局 zustand store，
 *   SaveSlotPanel 和 DeathGuidancePanel 直接从 store selector 读取，不调 hook；
 *   page.tsx 是唯一调用 useAutoSave 的地方，写副作用只触发一次。
 *   refs 只保留"已处理"去重（lastSavedAge / breakthrough / death / signal），
 *   因 page.tsx 是唯一调用方，多实例 ref 不再冲突。
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
  // 可选 toast 注入（默认用 sonner.toast）
  showToast?: (msg: string, opts?: { variant?: string }) => void;
  // 可选槽位（默认 3 = 自动档）
  slot?: SlotId;
}

export interface AutoSaveError {
  age: number;
  error: string;
  at: number;                 // Date.now()
  reason: string;             // 触发原因（突破/死亡/年岁推进...）
}

export interface UseAutoSaveResult {
  lastAutoSaveAt: string | null;
  lastError: AutoSaveError | null;
  clearError: () => void;
}

export function useAutoSave({
  character, worldCalendar, events, pendingChoice,
  watchForBreakthrough, watchForDeath, refreshSignal,
  showToast, slot = AUTO_SAVE_SLOT,
}: Props): UseAutoSaveResult {
  // P1 修复：refs 只用于"已处理"去重，错误/成功时间统一从 store 读。
  // page.tsx 是唯一调用方，多实例 ref 不再冲突。
  const lastSavedAgeRef = useRef<number | null>(null);
  const lastBreakthroughRef = useRef<any>(null);
  const lastDeathRef = useRef<any>(null);
  const lastSignalRef = useRef<number>(0);
  const lastErrorAtRef = useRef<number>(0); // 仅用于 5s toast 节流（不持久化、不进 store）

  // 包装一个稳定 toast：默认走 sonner.error
  const notify = useCallback(
    (msg: string) => {
      if (showToast) {
        try { showToast(msg, { variant: 'destructive' }); return; } catch { /* fallthrough */ }
      }
      try { toast.error(msg); } catch { /* sonner not ready */ }
    },
    [showToast],
  );

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

    // 节流：同一错误 5 秒内只 toast 一次，避免突破/死亡瞬间被刷屏
    const now = Date.now();
    const skipNotify = now - lastErrorAtRef.current < 5000;

    try {
      const summary = summarizeCharacterForSlot(character);
      const wc = worldCalendar ?? {};
      const result = writeSaveSlot(slot, {
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

      if (!result.ok) {
        // P0 关键修复：失败时 **不更新** lastSavedAgeRef，
        // 避免下个 useEffect tick（同 age）又再次尝试写入失败的槽位
        const errInfo: AutoSaveError = {
          age: character.age,
          error: result.error ?? '未知错误',
          at: now,
          reason,
        };
        // P1 修复：写到全局 store（SaveSlotPanel/DeathGuidancePanel 订阅这里）
        useGameStore.getState().setLastAutoSaveError(errInfo);
        lastErrorAtRef.current = now;
        if (!skipNotify) {
          notify(`自动存档失败（${reason}）：${errInfo.error}`);
        }
        // eslint-disable-next-line no-console
        console.warn('[auto-save] failed:', errInfo);
        return;
      }

      // 成功路径
      // P1 修复：lastAutoSaveAt 写到全局 store（避免组件实例各自维护）
      useGameStore.getState().setLastAutoSaveAt(result.meta.savedAt);
      useGameStore.getState().setLastAutoSaveError(null);
      lastSavedAgeRef.current = character.age;
      if (watchForBreakthrough) lastBreakthroughRef.current = watchForBreakthrough;
      if (watchForDeath) lastDeathRef.current = watchForDeath;
      lastSignalRef.current = refreshSignal ?? 0;
    } catch (e: any) {
      // writeSaveSlot 自身已 try/catch，这里只兜底其他意外（比如 summarizeCharacterForSlot 抛错）
      const msg = (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string')
        ? (e as any).message
        : 'unknown';
      const errInfo: AutoSaveError = {
        age: character.age,
        error: msg,
        at: now,
        reason,
      };
      useGameStore.getState().setLastAutoSaveError(errInfo);
      lastErrorAtRef.current = now;
      if (!skipNotify) notify(`自动存档失败（${reason}）：${msg}`);
      // eslint-disable-next-line no-console
      console.warn('[auto-save] failed:', errInfo);
    }
  }, [character?.age, character?.id, watchForBreakthrough, watchForDeath, refreshSignal, events?.length, notify, character, worldCalendar, events, pendingChoice, slot]);

  // P1 修复：从全局 store 读取最新值，让 SaveSlotPanel / DeathGuidancePanel 通过 selector 也读同一份
  const lastAutoSaveAt = useGameStore((s) => s.lastAutoSaveAt);
  const lastError = useGameStore((s) => s.lastAutoSaveError);
  const clearError = useCallback(() => {
    useGameStore.getState().setLastAutoSaveError(null);
  }, []);

  return { lastAutoSaveAt, lastError, clearError };
}
