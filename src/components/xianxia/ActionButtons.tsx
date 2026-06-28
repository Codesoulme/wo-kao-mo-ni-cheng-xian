'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Play, SkipForward, RotateCcw, Loader2, FastForward, Square, Swords, Store, Compass, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { REALMS } from '@/lib/xianxia/types';
import type { CharacterState, GameEvent } from '@/lib/xianxia/store';
import { ensureAIConfigured } from '@/lib/xianxia/ai-config-client';
import { generateSettlementResult } from '@/lib/xianxia/settlement';
import { LOADING_LABELS } from '@/lib/xianxia/display';
import { useStreamingPlaceholder } from '@/hooks/useStreamingPlaceholder';

function latestActionProjections(events: GameEvent[]) {
  const latest = events[events.length - 1];
  return {
    sourceLabel: latest?.title || latest?.blueprint?.name || '近期事件',
    projections: (latest?.actionProjections || []).filter((a: any) => ['market', 'exploration', 'thread', 'trade', 'cultivate', 'rest', 'custom'].includes(a.kind)).slice(0, 4),
  };
}

const ATTR_LABEL: Record<string, string> = {
  age: '年龄', lifespan: '寿元', cultivationExp: '修为',
  hp: '生命', maxHp: '生命上限', mp: '灵力', maxMp: '灵力上限',
  attack: '\u7834\u52bf', defense: '\u62a4\u6301', speed: '\u673a\u53d8',
  luck: '气运', comprehension: '悟性',
  spiritStones: '灵石', reputation: '声望',
};

export function ActionButtons() {
  const {
    character, events, pendingChoice, loading, worldCalendar, worldLegacies,
    setCharacter, addEvent, setPendingChoice,
    setEvents, setChoices, setFateNodes,
    setLastChange, setLastBreakthrough, setLoading, setError,
    setBreakthroughCeremony,
    setSettlementResult,
    setMarketOpen,
    setExplorationOpen,
    setWorldCalendar,
    setNewEventRange,
    appendStreamingNarrative,
    finishStreamingNarrative,
    clearStreamingNarrative,
    reset,
  } = useGameStore();

  // Use refs to guard against stale closures during rapid clicks
  const advancingRef = useRef(false);
  const [autoCount, setAutoCount] = useState(0); // 0 = off, >0 = remaining years
  const [autoTotal, setAutoTotal] = useState(0);
  const [restartOpen, setRestartOpen] = useState(false);
  const autoCancelRef = useRef(false);
  const preloadRef = useRef<{ key: string | null; inFlight: boolean }>({ key: null, inFlight: false });

  // ★ 流式叙事占位事件 ID 状态（之前用 (store as any)._placeholderId 是 hack）
  const { setPlaceholder, placeholderIdRef } = useStreamingPlaceholder();

  const syncLatestState = async (characterId: string) => {
    const res = await fetch(`/api/game/state?characterId=${characterId}`);
    const data = await res.json();
    if (!data.success || !data.character) return null;
    setCharacter(data.character);
    setEvents(data.events || []);
    setChoices(data.choices || []);
    setFateNodes(data.fateNodes || []);
    if (data.pendingChoice && data.character?.isAtChoice) {
      setPendingChoice(data.pendingChoice);
    } else if (!data.character?.isAtChoice) {
      setPendingChoice(null);
    }
    return data.character;
  };

  const prepareNextTurn = (characterId: string, preloadKey?: string) => {
    const key = preloadKey || characterId;
    if (preloadRef.current.inFlight && preloadRef.current.key === key) return;
    if (preloadRef.current.key === key) return;
    preloadRef.current = { key, inFlight: true };
    fetch('/api/game/preload-advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId }),
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (!data?.success) preloadRef.current.key = null;
      })
      .catch(() => {
        preloadRef.current.key = null;
      })
      .finally(() => {
        preloadRef.current.inFlight = false;
      });
  };

  useEffect(() => {
    if (!character?.id) return;
    const blocked = loading || pendingChoice || !character.alive || character.ascended || character.isAtChoice || (character as any).pendingChoice || (character.combatSession?.status === 'ongoing');
    if (blocked) return;
    const key = [
      character.id,
      character.age,
      character.realm,
      character.realmLevel,
      character.cultivationExp,
      character.hp,
      character.mp,
      character.spiritStones,
      events.length,
    ].join(':');
    const timer = window.setTimeout(() => prepareNextTurn(character.id, key), 900);
    return () => window.clearTimeout(timer);
  }, [character?.id, character?.age, character?.realm, character?.realmLevel, character?.cultivationExp, character?.hp, character?.mp, character?.spiritStones, character?.alive, character?.ascended, character?.isAtChoice, (character as any)?.pendingChoice, character?.combatSession?.status, pendingChoice, loading, events.length]);

  const advanceAbortRef = useRef<AbortController | null>(null);

  if (!character) return null;

  const isDead = !character.alive;
  const isAscended = character.ascended;
  const atChoice = !!pendingChoice;
  // Task 20: 战斗进行中时禁用推进
  const inCombat = !!(character.combatSession && character.combatSession.status === 'ongoing');
  const aiOpportunity = latestActionProjections(events);

  // 触发突破仪式
  const triggerBreakthroughCeremony = (newState: any, oldChar: typeof character) => {
    const newRealmInfo = REALMS.find(r => r.id === newState.realm);
    const oldRealmInfo = REALMS.find(r => r.id === oldChar.realm);
    const boosts: { label: string; value: number }[] = [];
    if (newState.maxHp > oldChar.maxHp) boosts.push({ label: '生命上限', value: newState.maxHp - oldChar.maxHp });
    if (newState.maxMp > oldChar.maxMp) boosts.push({ label: '灵力上限', value: newState.maxMp - oldChar.maxMp });
    if (newState.attack > oldChar.attack) boosts.push({ label: '\u7834\u52bf', value: newState.attack - oldChar.attack });
    if (newState.defense > oldChar.defense) boosts.push({ label: '\u62a4\u6301', value: newState.defense - oldChar.defense });
    if (newState.speed > oldChar.speed) boosts.push({ label: '\u673a\u53d8', value: newState.speed - oldChar.speed });
    if (newState.lifespan > oldChar.lifespan) boosts.push({ label: '寿元', value: newState.lifespan - oldChar.lifespan });

    setBreakthroughCeremony({
      fromRealm: oldChar.realm,
      fromRealmName: oldRealmInfo?.name || '凡人',
      toRealm: newState.realm,
      toRealmName: newRealmInfo?.name || '未知',
      toRealmColor: newRealmInfo?.color || '#c8453c',
      newLifespan: newState.lifespan,
      statBoosts: boosts,
    });
  };

  const advance = async () => {
    if (advancingRef.current || atChoice || isDead || isAscended || inCombat) return;
    advancingRef.current = true;
    setLoading(true);
    setError(null);
    setLastChange(null);
    setLastBreakthrough(null);
    // 取消上一次的推进请求（如果存在）
    if (advanceAbortRef.current) {
      advanceAbortRef.current.abort();
      advanceAbortRef.current = null;
    }
    try {
      await ensureAIConfigured();
      const previousEventCount = events.length;
      setNewEventRange({ start: previousEventCount, end: previousEventCount + 5 });

      // ★ 清理上次推进遗留：旧占位事件、旧流式叙事、旧结算提示
      const stalePlaceholderId = placeholderIdRef.current;
      if (stalePlaceholderId) {
        const curEvents = useGameStore.getState().events;
        if (curEvents.some((e: any) => e.id === stalePlaceholderId)) {
          setEvents(curEvents.filter((e: any) => e.id !== stalePlaceholderId));
        }
        setPlaceholder(null);
      }
      useGameStore.getState().finishStreamingNarrative();
      useGameStore.getState().setSettlingHint(null);
      console.log('[SSE advance] Starting, calling /api/game/advance-sse');
      const eventIndex = previousEventCount;
      let fullNarrative = '';
      let doneData: any = null;
      const setSettlingHint = useGameStore.getState().setSettlingHint;

      const abortCtrl = new AbortController();
      advanceAbortRef.current = abortCtrl;
      const response = await fetch('/api/game/advance-sse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, worldCalendar, previousWorldLegacies: worldLegacies }),
        signal: abortCtrl.signal,
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      // 立即初始化流式状态
      useGameStore.getState().setStreamingNarrative(eventIndex, '');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // ★ 同步结算：按钮锁定直到done到达，避免异步带来的状态混乱
      let narrativeCompleted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[SSE advance] Stream done');
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        buffer += chunkText;
        // SSE 格式: "event: xxx\ndata: {json}\n\n"
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const part of lines) {
          if (!part.trim()) continue;
          const eventLine = part.split('\n').find(l => l.startsWith('event:'));
          const dataLine = part.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;
          const dataStr = dataLine.slice(5).trim();
          if (!dataStr) continue;
          try {
            const obj = JSON.parse(dataStr);
            if (obj.type === 'start') {
              console.log('[SSE advance] Received start, age:', obj.age);
              // ★ 立即清掉旧推进遗留的"收获结算中"提示
              setSettlingHint(null);
              // ★ 立即添加一个空 narrative 的占位事件，StreamingNarrative 会显示实时增量文本
              const placeholderId = `streaming-${Date.now()}`;
              const newAge = obj.age + (obj.timeAdvance?.ageDeltaYears || 0);
              const placeholderEvent: any = {
                id: placeholderId,
                age: newAge,  // 用新年龄（当前年龄 + 岁数增量），避免 isContinuation 误判
                title: LOADING_LABELS.advanceTitle,
                narrative: '',
                eventType: 'normal',
                effects: [],
                isFateNode: false,
                fateNodeName: undefined,
                blueprint: undefined,
                timeAdvance: obj.timeAdvance || undefined,
                worldTime: obj.worldTime || undefined,
                actionProjections: [],
                createdAt: new Date().toISOString(),
                };
              // 用 setEvents 替换（不是 addEvent），避免出现两个事件
              setEvents([...events, placeholderEvent]);
              // 记录占位 ID，后面 done 时替换
              setPlaceholder(placeholderId);
            } else if (obj.type === 'heartbeat') {
              // 忽略心跳
            } else if (obj.type === 'narrative_delta') {
              fullNarrative += obj.delta;
              useGameStore.getState().setStreamingNarrative(eventIndex, fullNarrative);
              // ★ 同步更新占位事件的 narrative 字段，这样 done 到达前气泡也不会空
              const phId = placeholderIdRef.current;
              if (phId) {
                const curEvents = useGameStore.getState().events;
                setEvents(curEvents.map((e: any) =>
                  e.id === phId ? { ...e, narrative: fullNarrative } : e
                ));
              }
            } else if (obj.type === 'narrative_complete') {
              // ★ narrative 字段闭合：LLM 已写完正文，正在生成剩余 JSON 字段
              // → 显示"收获结算中..."提示，但按钮仍锁定（同步结算）
              if (!narrativeCompleted) {
                narrativeCompleted = true;
                console.log('[SSE advance] narrative_complete, showing settling hint');
                setSettlingHint('calculating');
              }
            } else if (obj.type === 'done') {
              console.log('[SSE advance] Received done, narrative length:', obj.narrative?.length, 'perf:', obj._debug_perf);
              doneData = obj;
            } else if (obj.type === 'error') {
              throw new Error(obj.error || 'SSE error');
            }
          } catch (e: any) {
            if (e?.message?.includes('SSE error')) throw e;
            console.error('[SSE advance] Parse error:', e);
          }
        }
      }

      if (!doneData) {
        throw new Error('SSE 响应未完成');
      }

      // ★ done 到达：同步更新所有状态
      // 立即清除结算提示，但保留新事件动画一段时间，避免结算后气泡闪动
      setSettlingHint(null);

      // ★ 更新角色状态
      const latestCharacter = useGameStore.getState().character;
      if (doneData.state) {
        setCharacter({ ...latestCharacter, ...doneData.state, worldCalendar: doneData.worldTime || doneData.worldCalendar });
      } else if (doneData.worldCalendar || doneData.worldTime) {
        setCharacter({ ...latestCharacter, worldCalendar: doneData.worldTime || doneData.worldCalendar });
      }
      if (doneData.worldCalendar) setWorldCalendar(doneData.worldCalendar);
      setLastChange(doneData.changes || null);
      if (doneData.breakthrough) setLastBreakthrough(doneData.breakthrough);

      // ★ 同步更新占位事件（标题 + narrative + effects + id）
      const phId = placeholderIdRef.current;
      if (phId) {
        const phEvents = useGameStore.getState().events;
        const savedTimeAdvance = phEvents.find((e: any) => e.id === phId)?.timeAdvance;
        const savedWorldTime = phEvents.find((e: any) => e.id === phId)?.worldTime;
        const finalTitle = doneData.title || '天道路漫';
        const eventId = doneData.eventId || phId;
        setEvents(phEvents.map((e: any) =>
          e.id === phId
            ? {
                ...e,
                id: eventId,
                title: finalTitle,
                // 优先用更完整的 narrative（流式累积的可能比 doneData 解析的完整）
                narrative: (doneData.narrative && doneData.narrative.length >= fullNarrative.length)
                  ? doneData.narrative
                  : fullNarrative,
                effects: doneData.changes || [],
                timeAdvance: savedTimeAdvance,
                worldTime: savedWorldTime,
              }
            : e
        ));
        setPlaceholder(null);
      }

      finishStreamingNarrative();

      // 延迟清除新事件高亮动画，让 DOM 稳定后再取消动画，避免结算时气泡闪动
      window.setTimeout(() => {
        setNewEventRange(null);
      }, 3000);

      // 待选择
      if (doneData.hasChoice && doneData.choice) {
        setPendingChoice({
          ...doneData.choice,
          contextTitle: doneData.title,
          contextNarrative: doneData.narrative,
          contextAge: doneData.state?.age,
          contextFateNodeName: undefined,
        });
        toast('因缘转折', { description: '请做出你的抉择' });
        autoCancelRef.current = true;
      }

      // 触发战斗 → 中断自动推进
      if (doneData.triggeredCombat) {
        toast('战斗触发', { description: '请进入战斗界面应战' });
        autoCancelRef.current = true;
      }

      if (doneData.breakthrough) {
        if (doneData.breakthrough.major) {
          toast.success('大境界突破！', { description: `踏入新境界` });
          triggerBreakthroughCeremony(doneData.state, latestCharacter);
        } else {
          toast.success('小境界突破！', { description: `晋至${doneData.state.realmLevel + 1}层` });
        }
      }
      if (doneData.state && !doneData.state.alive) {
        toast.error('角色陨落', { description: (doneData.state as any).deathReason });
        autoCancelRef.current = true;
      }
      if (doneData.state && doneData.state.ascended) {
        toast.success('飞升仙界！', { description: '超脱凡俗，与天地同寿' });
        autoCancelRef.current = true;
      }
      if (doneData.fallbackGenerated) {
        toast.warning('灵机未通', { description: '天道推演暂歇，已依天机本相续接。' });
      }
      if (!doneData.hasChoice && doneData.state && doneData.state.alive) {
        preloadRef.current.key = null;
        prepareNextTurn(latestCharacter?.id);
      }
    } catch (err: any) {
      // 主动取消（刷新/离开页面/重复点击）不显示错误提示
      if (err?.name === 'AbortError' || err?.message?.includes('aborted') || err?.message?.includes('AbortError')) {
        console.log('[advance] Aborted by user or page refresh');
        return;
      }
      console.error('[advance] Error:', err?.message);
      setError(err.message);
      toast.error('推进失败', { description: err.message });
      autoCancelRef.current = true;
      finishStreamingNarrative();
    } finally {
      advancingRef.current = false;
      setLoading(false);
      advanceAbortRef.current = null;
    }
  };

  // 一键十载：后端批量推进，遇到因缘抉择/战斗/陨落/飞升立即停下
  const autoAdvance = async (years: number) => {
    if (advancingRef.current || atChoice || isDead || isAscended || inCombat || !character) return;
    autoCancelRef.current = false;
    advancingRef.current = true;
    setLoading(true);
    setError(null);
    setAutoTotal(years);
    setAutoCount(years);
    toast(`开始连推 ${years} 载`, { description: '遇到因缘抉择、战斗或终局会自动停止' });
    try {
      const res = await fetch('/api/game/advance-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, years, worldCalendar, previousWorldLegacies: worldLegacies }),
      });
      const data = await res.json();
      if (!data.success) {
        const message = data.error || '推进失败';
        if (message.includes('战斗进行中')) {
          const latest = await syncLatestState(character.id);
          if (latest?.combatSession?.status === 'ongoing') {
            toast('战斗已接续', { description: '请先了结此战，再让岁月继续流转' });
            return;
          }
        }
        throw new Error(message);
      }

      setAutoCount(Math.max(0, years - (data.count || 0)));
      if (data.state) setCharacter({ ...character, ...data.state, worldCalendar: data.worldTime || data.worldCalendar });
      if (data.worldCalendar) setWorldCalendar(data.worldCalendar);
      setLastChange(data.changes || null);
      if (data.breakthrough) setLastBreakthrough(data.breakthrough);

      const returnedEvents = Array.isArray(data.events) && data.events.length ? data.events : [];
      // 批量推进：每段都触发气泡级流式显示
      const batchStart = events.length;
      setNewEventRange({ start: batchStart, end: batchStart + returnedEvents.length });
      setTimeout(() => setNewEventRange(null), 10000);
      returnedEvents.forEach((evt: any, idx: number) => addEvent({
        id: evt.id || `event-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        age: evt.age,
        title: evt.title,
        narrative: evt.narrative,
        eventType: evt.eventType,
        effects: evt.effects || (idx === returnedEvents.length - 1 ? (data.changes || []) : []),
        isFateNode: evt.isFateNode,
        fateNodeName: evt.fateNodeName,
        blueprint: evt.blueprint,
        timeAdvance: evt.timeAdvance,
        worldTime: evt.worldTime,
        actionProjections: evt.actionProjections || [],
        createdAt: evt.createdAt || new Date().toISOString(),
      }));

      const finalEvent = data.event || returnedEvents[returnedEvents.length - 1];
      if (data.hasChoice && data.choice && finalEvent) {
        setPendingChoice({
          ...data.choice,
          contextTitle: finalEvent.title,
          contextNarrative: finalEvent.narrative,
          contextAge: finalEvent.age,
          contextFateNodeName: finalEvent.fateNodeName,
        });
        toast('因缘转折', { description: '请做出你的抉择' });
        autoCancelRef.current = true;
      }
      if (data.triggeredCombat) {
        toast('战斗爆发', { description: '请先处理战斗' });
        autoCancelRef.current = true;
      }
      if (data.died) {
        toast.error('角色陨落', { description: data.deathReason });
        autoCancelRef.current = true;
      }
      if (data.ascended) {
        toast.success('飞升仙界！', { description: '超脱凡俗，与天地同寿' });
        autoCancelRef.current = true;
      }
      if (!data.hasChoice && !data.triggeredCombat && !data.died && !data.ascended && character.id) {
        preloadRef.current.key = null;
        prepareNextTurn(character.id);
      }
    } catch (err: any) {
      setError(err.message);
      toast.error('推进失败', { description: err.message });
      autoCancelRef.current = true;
    } finally {
      advancingRef.current = false;
      setLoading(false);
      setAutoCount(0);
      setAutoTotal(0);
    }
  };

  const stopAuto = () => {
    autoCancelRef.current = true;
  };

  const restart = () => setRestartOpen(true);

  const confirmRestart = () => {
    autoCancelRef.current = true;
    setAutoCount(0);
    setAutoTotal(0);
    reset();
    setRestartOpen(false);
    toast('\u5df2\u91cd\u7f6e\uff0c\u53ef\u91cd\u65b0\u5f00\u59cb');
  };

  const isAutoRunning = autoCount > 0;

  return (
    <>
    <div className="space-y-2">
      {/* 主推进按钮 + 一键十载 */}
      <div className="flex items-center gap-2">
        <Button
          onClick={advance}
          disabled={loading || atChoice || isDead || isAscended || isAutoRunning || inCombat}
          className={cn(
            "flex-1 h-10 font-serif-cn tracking-wider transition-all",
            isDead || isAscended
              ? "bg-muted text-muted-foreground"
              : inCombat
              ? "bg-destructive/20 text-destructive border border-destructive/40"
              : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg hover:shadow-primary/30"
          )}
        >
          {loading && !isAutoRunning ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{LOADING_LABELS.advanceButton}</>
          ) : isAutoRunning ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />连推中 {autoCount}/{autoTotal}</>
          ) : isDead ? (
            <><RotateCcw className="w-4 h-4 mr-2" />已陨落</>
          ) : isAscended ? (
            <><Play className="w-4 h-4 mr-2" />已飞升</>
          ) : atChoice ? (
            <><SkipForward className="w-4 h-4 mr-2" />待抉择</>
          ) : inCombat ? (
            <><Swords className="w-4 h-4 mr-2" />战斗进行中</>
          ) : (
            <><SkipForward className="w-4 h-4 mr-2" />岁月流转一载</>
          )}
        </Button>

        {/* 一键十载 / 停止 */}
        {!isDead && !isAscended && !inCombat && (
          isAutoRunning ? (
            <Button
              onClick={stopAuto}
              variant="destructive"
              className="h-10 px-3 shrink-0"
            >
              <Square className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">停</span>
            </Button>
          ) : (
            <Button
              onClick={() => autoAdvance(10)}
              disabled={loading || atChoice}
              variant="outline"
              className="h-10 px-3 shrink-0 border-accent/40 text-accent hover:bg-accent/10"
              title="一键推进十载"
            >
              <FastForward className="w-4 h-4 mr-1" />
              <span className="text-xs font-serif-cn">十载</span>
            </Button>
          )
        )}

        {(isDead || isAscended) && (
          <Button
            onClick={restart}
            variant="outline"
            className="h-10 px-3"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* 行动投影：后端/AI 注册此刻可做之事，前端只负责投影 */}
      {!isDead && !isAscended && !inCombat && !atChoice && !isAutoRunning && aiOpportunity.projections.filter((a: any) => a.kind !== 'thread').length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-primary/15 bg-primary/5 p-2">
          <div className="text-[10px] text-muted-foreground font-serif-cn truncate">
            因缘所至：{aiOpportunity.sourceLabel}
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: aiOpportunity.projections.length > 1 ? '1fr 1fr' : '1fr' }}>
            {aiOpportunity.projections.filter((action: any) => action.kind !== 'thread').map((action: any) => {
              const isMarket = action.kind === 'market' || action.kind === 'trade';
              const isExplore = action.kind === 'exploration';
              const Icon = isMarket ? Store : isExplore ? Compass : ScrollText;
              const onClick = () => {
                if (isMarket) setMarketOpen(true);
                else if (isExplore) setExplorationOpen(true);
                else toast(action.label, { description: action.description || '此因缘已入心中，后续将随剧情承接。' });
              };
              return (
                <Button
                  key={action.id}
                  onClick={onClick}
                  disabled={loading}
                  variant="outline"
                  title={action.description || action.label}
                  className={cn(
                    "h-9 font-serif-cn tracking-wider",
                    isMarket
                      ? "border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/60"
                      : isExplore
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/60"
                        : "border-primary/30 text-primary hover:bg-primary/10"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5" />
                  {action.label}
                  {isMarket && (
                    <span className="ml-1 text-[10px] text-amber-700/70 dark:text-amber-400/70 tabular-nums">
                      {character.spiritStones || 0}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      )}
      {/* 连推进度条 */}
      {isAutoRunning && (
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
            style={{ width: `${((autoTotal - autoCount) / autoTotal) * 100}%` }}
          />
        </div>
      )}
    </div>
    <AlertDialog open={restartOpen} onOpenChange={setRestartOpen}>
      <AlertDialogContent className="border-destructive/25 bg-background/95">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif-cn text-destructive">{'\u653e\u5f03\u6b64\u4e16\uff1f'}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">
            {'\u5f53\u524d\u89d2\u8272\u5c06\u6682\u79bb\u73a9\u5bb6\u624b\u4e2d\u7684\u6f14\u7b97\uff0c\u5e76\u56de\u5230\u65b0\u7684\u5f00\u59cb\u3002\u8fd9\u4e00\u6b65\u4e0d\u4ee3\u8868\u6e05\u7a7a\u6574\u4e2a\u4e16\u754c\uff1b\u5982\u9700\u6e05\u7a7a\u6d4b\u8bd5\u4e16\u754c\uff0c\u8bf7\u5728\u5f00\u59cb\u9875\u4f7f\u7528\u300c\u91cd\u7f6e\u4e16\u754c\u300d\u3002'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{'\u6682\u4e0d\u653e\u5f03'}</AlertDialogCancel>
          <AlertDialogAction onClick={confirmRestart} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {'\u786e\u8ba4\u653e\u5f03'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
