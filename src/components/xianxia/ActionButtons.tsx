'use client';

import { useRef, useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Play, SkipForward, RotateCcw, Loader2, FastForward, Square, Swords, Store, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { REALMS } from '@/lib/xianxia/types';
import type { GameEvent } from '@/lib/xianxia/store';
import { ensureAIConfigured } from '@/lib/xianxia/ai-config-client';

type AiOpportunity = {
  market: boolean;
  exploration: boolean;
  sourceLabel: string;
};

const MARKET_TRIGGER_RE = /(坊市|市集|集市|黑市|商铺|店铺|摊位|商会|拍卖|交易|买卖|商人|货郎|丹药铺|法器铺|灵材铺)/;
const EXPLORATION_TRIGGER_RE = /(秘境|遗迹|遗址|洞府|古洞|古墓|禁地|洞天|遗府|试炼之地|裂隙|古阵|灵脉|荒谷|山谷深处)/;

function getAiOpportunity(events: GameEvent[]): AiOpportunity {
  const latest = events[events.length - 1];
  if (!latest) return { market: false, exploration: false, sourceLabel: '' };

  const category = latest.blueprint?.category;
  const text = `${latest.title || ''}
${latest.narrative || ''}
${latest.blueprint?.name || ''}`;
  const market = latest.eventType === 'trade' || category === 'trade' || MARKET_TRIGGER_RE.test(text);
  const exploration = latest.eventType === 'exploration' || category === 'exploration' || EXPLORATION_TRIGGER_RE.test(text);

  return {
    market,
    exploration,
    sourceLabel: latest.title || latest.blueprint?.name || '近期事件',
  };
}

const ATTR_LABEL: Record<string, string> = {
  age: '年龄', lifespan: '寿元', cultivationExp: '修为',
  hp: '生命', maxHp: '生命上限', mp: '灵力', maxMp: '灵力上限',
  attack: '攻击', defense: '防御', speed: '速度',
  luck: '气运', comprehension: '悟性',
  spiritStones: '灵石', reputation: '声望',
};

export function ActionButtons() {
  const {
    character, events, pendingChoice, loading,
    setCharacter, addEvent, setPendingChoice,
    setLastChange, setLastBreakthrough, setLoading, setError,
    setBreakthroughCeremony,
    setMarketOpen,
    setExplorationOpen,
    reset,
  } = useGameStore();

  // Use refs to guard against stale closures during rapid clicks
  const advancingRef = useRef(false);
  const [autoCount, setAutoCount] = useState(0); // 0 = off, >0 = remaining years
  const [autoTotal, setAutoTotal] = useState(0);
  const autoCancelRef = useRef(false);

  if (!character) return null;

  const isDead = !character.alive;
  const isAscended = character.ascended;
  const atChoice = !!pendingChoice;
  // Task 20: 战斗进行中时禁用推进
  const inCombat = !!(character.combatSession && character.combatSession.status === 'ongoing');
  const aiOpportunity = getAiOpportunity(events);

  // 触发突破仪式
  const triggerBreakthroughCeremony = (newState: any, oldChar: typeof character) => {
    const newRealmInfo = REALMS.find(r => r.id === newState.realm);
    const oldRealmInfo = REALMS.find(r => r.id === oldChar.realm);
    const boosts: { label: string; value: number }[] = [];
    if (newState.maxHp > oldChar.maxHp) boosts.push({ label: '生命上限', value: newState.maxHp - oldChar.maxHp });
    if (newState.maxMp > oldChar.maxMp) boosts.push({ label: '灵力上限', value: newState.maxMp - oldChar.maxMp });
    if (newState.attack > oldChar.attack) boosts.push({ label: '攻击', value: newState.attack - oldChar.attack });
    if (newState.defense > oldChar.defense) boosts.push({ label: '防御', value: newState.defense - oldChar.defense });
    if (newState.speed > oldChar.speed) boosts.push({ label: '速度', value: newState.speed - oldChar.speed });
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
      const res = await fetch('/api/game/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '推进失败');

      // 更新角色
      setCharacter({ ...character, ...data.state });
      setLastChange(data.changes || null);
      if (data.breakthrough) setLastBreakthrough(data.breakthrough);

      // 添加事件
      addEvent({
        id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        age: data.event.age,
        title: data.event.title,
        narrative: data.event.narrative,
        eventType: data.event.eventType,
        effects: data.changes || [],
        isFateNode: data.isFateNode,
        fateNodeName: data.fateNodeName,
        // Task 20: 蓝图主题（让 EventTimeline 显示主题 chip）
        blueprint: data.event.blueprint,
        createdAt: new Date().toISOString(),
      });

      // 设置待选择（带上命节点前情提要，供弹窗展示完整情境）
      if (data.hasChoice && data.choice) {
        setPendingChoice({
          ...data.choice,
          contextTitle: data.event.title,
          contextNarrative: data.event.narrative,
          contextAge: data.event.age,
          contextFateNodeName: data.fateNodeName,
        });
        toast('命节点触发', { description: '请做出你的抉择' });
        // 命节点中断自动推进
        autoCancelRef.current = true;
      }

      // Task 20: 触发战斗 → 中断自动推进，提示玩家
      if (data.triggeredCombat) {
        toast('战斗触发', { description: '请进入战斗界面应战' });
        autoCancelRef.current = true;
      }

      if (data.breakthrough) {
        toast.success('境界突破！', { description: `踏入新境界` });
        // 触发突破仪式
        triggerBreakthroughCeremony(data.state, character);
      }
      if (data.died) {
        toast.error('角色陨落', { description: data.deathReason });
        autoCancelRef.current = true;
      }
      if (data.ascended) {
        toast.success('飞升仙界！', { description: '超脱凡俗，与天地同寿' });
        autoCancelRef.current = true;
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

  // 一键十载：连续推进 N 年
  const autoAdvance = async (years: number) => {
    if (advancingRef.current || atChoice || isDead || isAscended || inCombat) return;
    autoCancelRef.current = false;
    setAutoTotal(years);
    setAutoCount(years);
    toast(`开始连推 ${years} 载`, { description: '遇到命节点/陨落会自动停止' });
    for (let i = 0; i < years; i++) {
      if (autoCancelRef.current) break;
      setAutoCount(years - i);
      await advance();
      // advance 完成后检查是否需要中断
      if (autoCancelRef.current) break;
      // 短暂停顿，让 UI 有反馈
      await new Promise(r => setTimeout(r, 200));
    }
    setAutoCount(0);
    setAutoTotal(0);
  };

  const stopAuto = () => {
    autoCancelRef.current = true;
  };

  const restart = () => {
    if (!confirm('确定要重新开始吗？当前角色将被放弃。')) return;
    autoCancelRef.current = true;
    setAutoCount(0);
    setAutoTotal(0);
    reset();
    toast('已重置，可重新开始');
  };

  const isAutoRunning = autoCount > 0;

  return (
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

      {/* 坊市/秘境入口：只在最近 AI 事件明确触发相关场景时出现 */}
      {!isDead && !isAscended && !inCombat && !atChoice && !isAutoRunning && (aiOpportunity.market || aiOpportunity.exploration) && (
        <div className="space-y-1.5 rounded-lg border border-primary/15 bg-primary/5 p-2">
          <div className="text-[10px] text-muted-foreground font-serif-cn truncate">
            AI 事件触发：{aiOpportunity.sourceLabel}
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: aiOpportunity.market && aiOpportunity.exploration ? '1fr 1fr' : '1fr' }}>
            {aiOpportunity.market && (
              <Button
                onClick={() => setMarketOpen(true)}
                disabled={loading}
                variant="outline"
                className="h-9 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/60 font-serif-cn tracking-wider"
              >
                <Store className="w-3.5 h-3.5 mr-1.5" />
                前往坊市
                <span className="ml-1 text-[10px] text-amber-700/70 dark:text-amber-400/70 tabular-nums">
                  {character.spiritStones || 0}
                </span>
              </Button>
            )}
            {aiOpportunity.exploration && (
              <Button
                onClick={() => setExplorationOpen(true)}
                disabled={loading}
                variant="outline"
                className="h-9 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/60 font-serif-cn tracking-wider"
              >
                <Compass className="w-3.5 h-3.5 mr-1.5" />
                探入秘境
              </Button>
            )}
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
  );
}
