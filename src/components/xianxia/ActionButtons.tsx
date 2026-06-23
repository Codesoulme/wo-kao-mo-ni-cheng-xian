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
    try {
      await ensureAIConfigured();
      // 流式接口：边读 narrative 边触发气泡
      const previousEventCount = events.length;
      setNewEventRange({ start: previousEventCount, end: previousEventCount + 5 }); // 占位：最多 5 段
      // Fallback：流式中断/失败时调用非流式接口拉完整事件
      const advanceFallbackNonStream = async (prevCount: number) => {
        try {
          const res2 = await fetch('/api/game/advance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId: character.id, worldCalendar, previousWorldLegacies: worldLegacies }),
          });
          const data = await res2.json();
          if (!data.success) {
            // 推进已完成但 LLM 又跑了一次（重复推 / 待选择 / 已飞升 等）→ 同步 db 最新状态即可
            // 这些情况下 stream 那侧实际上已经把状态写进了 db
            const errMsg = data.error || '';
            const alreadyCompleted = /age|已|选择|飞升|陨落|战斗/.test(errMsg);
            if (alreadyCompleted) {
              const latest = await syncLatestState(character.id);
              if (latest) {
                setCharacter({ ...character, ...latest, worldCalendar: data.worldCalendar || worldCalendar });
                if (data.worldCalendar) setWorldCalendar(data.worldCalendar);
                // 同步待选择（stream 触发过 choice 的话）
                if ((latest as any).pendingChoiceJson || (latest as any).isAtChoice) {
                  try {
                    const pendingChoice = (latest as any).pendingChoiceJson ? JSON.parse((latest as any).pendingChoiceJson) : null;
                    if (pendingChoice?.prompt) {
                      setPendingChoice({
                        ...pendingChoice,
                        contextTitle: pendingChoice.contextTitle,
                        contextNarrative: pendingChoice.contextNarrative,
                        contextAge: pendingChoice.contextAge,
                        contextFateNodeName: pendingChoice.contextFateNodeName,
                      });
                    }
                  } catch {}
                }
                toast.warning('流式响应已中断', { description: '事件已写入，但叙事未完整显示。最新状态已同步。' });
                setNewEventRange(null);
                finishStreamingNarrative();
              }
              return;
            }
            throw new Error(errMsg || 'fallback failed');
          }
          // 正常完成：应用结果
          setCharacter({ ...character, ...data.state, worldCalendar: data.worldTime || data.worldCalendar });
          if (data.worldCalendar) setWorldCalendar(data.worldCalendar);
          setLastChange(data.changes || null);
          if (data.breakthrough) setLastBreakthrough(data.breakthrough);
          const returnedEvents = Array.isArray(data.events) && data.events.length ? data.events : [data.event];
          returnedEvents.forEach((evt: any, idx: number) => addEvent({
            id: evt.id || `event-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            age: evt.age,
            title: evt.title,
            narrative: evt.narrative,
            eventType: evt.eventType,
            effects: evt.effects || (idx === 0 ? (data.changes || []) : []),
            isFateNode: evt.isFateNode,
            fateNodeName: evt.fateNodeName,
            blueprint: evt.blueprint,
            timeAdvance: evt.timeAdvance,
            worldTime: evt.worldTime,
            actionProjections: evt.actionProjections || [],
            createdAt: evt.createdAt || new Date().toISOString(),
          }));
          setNewEventRange({ start: prevCount, end: prevCount + returnedEvents.length });
          setTimeout(() => setNewEventRange(null), 10000);
        } catch (e: any) {
          console.error('[advance fallback] failed:', e?.message);
          // 最后兜底：sync 最新状态，让 UI 不卡死
          const latest = await syncLatestState(character.id);
          if (latest) setCharacter({ ...character, ...latest });
          toast.error('推进出错', { description: e?.message || '网络中断' });
          setNewEventRange(null);
          finishStreamingNarrative();
        }
      };
      let res: Response;
      try {
        res = await fetch('/api/game/advance/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId: character.id, worldCalendar, previousWorldLegacies: worldLegacies }),
          signal: AbortSignal.timeout(55_000), // 比服务端 maxDuration 60s 略短
        });
      } catch (fetchErr: any) {
        // 网络中断/abort：fallback 到非流式接口
        if (fetchErr?.name === 'AbortError' || /aborted|aborted/i.test(fetchErr?.message || '')) {
          console.warn('[advance stream] aborted, falling back to /api/game/advance');
          await advanceFallbackNonStream(previousEventCount);
          return;
        }
        throw fetchErr;
      }
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${errText.slice(0, 200)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneData: any = null;
      let startedEvent = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let obj: any;
            try { obj = JSON.parse(trimmed); } catch { continue; }
            if (obj.type === 'start') {
              startedEvent = true;
            } else if (obj.type === 'narrative_delta') {
              if (!startedEvent) startedEvent = true;
              appendStreamingNarrative(previousEventCount, obj.delta);
            } else if (obj.type === 'done') {
              doneData = obj;
            } else if (obj.type === 'error') {
              throw new Error(obj.error || 'stream error');
            }
          }
        }
      } catch (readErr: any) {
        // reader 中断（页面切走/HMR/网络断开）：fallback 到非流式接口拉完整事件
        console.warn('[advance stream] reader failed:', readErr?.message);
        finishStreamingNarrative();
        try { reader.cancel(); } catch {}
        await advanceFallbackNonStream(previousEventCount);
        return;
      }
      if (!doneData) throw new Error('流式响应未完成');

      // 流结束：清掉 streamingNarrative 标记，让 EventTimeline 走完整 narrative
      finishStreamingNarrative();

      // 更新角色
      setCharacter({ ...character, ...doneData.state, worldCalendar: doneData.worldTime || doneData.worldCalendar });
      if (doneData.worldCalendar) setWorldCalendar(doneData.worldCalendar);
      setLastChange(doneData.changes || null);
      if (doneData.breakthrough) setLastBreakthrough(doneData.breakthrough);

      // 添加事件
      const returnedEvents = Array.isArray(doneData.events) && doneData.events.length ? doneData.events : [];
      returnedEvents.forEach((evt: any, idx: number) => addEvent({
        id: evt.id || `event-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        age: evt.age,
        title: evt.title,
        narrative: evt.narrative,
        eventType: evt.eventType,
        effects: evt.effects || (idx === 0 ? (doneData.changes || []) : []),
        isFateNode: evt.isFateNode,
        fateNodeName: evt.fateNodeName,
        blueprint: evt.blueprint,
        timeAdvance: evt.timeAdvance,
        worldTime: evt.worldTime,
        actionProjections: evt.actionProjections || [],
        createdAt: evt.createdAt || new Date().toISOString(),
      }));

      // 标记新事件气泡（流式已经显示，这里给旧 fallback 流程留入口）
      setNewEventRange({ start: previousEventCount, end: previousEventCount + returnedEvents.length });
      setTimeout(() => setNewEventRange(null), 10000);

      // 待选择
      if (doneData.hasChoice && doneData.choice) {
        setPendingChoice({
          ...doneData.choice,
          contextTitle: doneData.events?.[0]?.title,
          contextNarrative: doneData.events?.[0]?.narrative,
          contextAge: doneData.events?.[0]?.age,
          contextFateNodeName: doneData.events?.[0]?.fateNodeName,
        });
        toast('因缘转折', { description: '请做出你的抉择' });
        // 因缘抉择中断自动推进
        autoCancelRef.current = true;
      }

      // Task 20: 触发战斗 → 中断自动推进，提示玩家
      if (doneData.triggeredCombat || doneData.hasChoice || doneData.events?.[0]?.isFateNode) {
        // 战斗或选择触发：中断自动推进
        if (doneData.triggeredCombat) {
          toast('战斗触发', { description: '请进入战斗界面应战' });
        }
        autoCancelRef.current = true;
      }

      if (doneData.breakthrough) {
        if (doneData.breakthrough.major) {
          toast.success('大境界突破！', { description: `踏入新境界` });
          // 触发突破仪式
          triggerBreakthroughCeremony(doneData.state, character);
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
        toast.warning('AI 响应异常', { description: 'AI 生成失败，已使用模板叙事。请检查 AI 配置或额度。' });
      }
      if (!doneData.hasChoice && !(doneData.state && !doneData.state.alive)) {
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
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />天道演算...</>
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
