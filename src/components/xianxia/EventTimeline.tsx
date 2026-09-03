'use client';

import { GameEvent, streamingRef, useGameStore } from '@/lib/xianxia/store';
import { cn } from '@/lib/utils';
import { formatEventEffectLabel, eventEffectTone, isVisibleNumericEventEffect } from '@/lib/xianxia/display';
import { Sparkles, Skull, Crown, Swords, Mountain, Zap, ChevronDown, ChevronsUpDown, Maximize2, Minimize2, Compass, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useCallback, Fragment } from 'react';
import { formatNarrativeForDisplay } from '@/lib/xianxia/narrative-format';
import { XianxiaRibbon } from './XianxiaRibbon';
import { TreasureCard } from './TreasureCard';
import { NpcEncounterCard } from './NpcEncounterCard';
import { SceneRevealCard } from './SceneRevealCard';
import { BreakthroughFlashCard } from './BreakthroughFlashCard';

// 场景蓝图分类 → 场景中文标签（用于 SceneRevealCard 顶栏 chip）
const SCENE_CATEGORY_LABEL: Record<string, string> = {
  exploration: '探幽',
  secret_realm: '秘境',
  travel: '游历',
  encounter: '奇遇',
};

interface EventTimelineProps {
  events: GameEvent[];
  /** 默认展开最近几条事件，默认 3 */
  defaultExpandedCount?: number;
  /** 是否显示顶部工具栏（展开/折叠全部），默认 true */
  showToolbar?: boolean;
  /** 新事件索引范围 [start, end)：这些事件会触发气泡级流式显示 */
  newEventRange?: { start: number; end: number };
  /** 真正流式：当前正在流式写入的 event */
  streamingEvent?: { eventIndex: number; text: string } | null;
  /** 结算提示：'calculating' = 收获结算中 */
  settlingHint?: 'calculating' | null;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  normal: <Sparkles className="w-3.5 h-3.5" />,
  fate_node: <Mountain className="w-3.5 h-3.5" />,
  choice: <Zap className="w-3.5 h-3.5" />,
  combat: <Swords className="w-3.5 h-3.5" />,
  breakthrough: <Sparkles className="w-3.5 h-3.5" />,
  death: <Skull className="w-3.5 h-3.5" />,
  ascension: <Crown className="w-3.5 h-3.5" />,
  interference: <Zap className="w-3.5 h-3.5" />,
  exploration: <Compass className="w-3.5 h-3.5" />,
};

const EVENT_LABELS: Record<string, string> = {
  normal: '流年',
  fate_node: '因缘转折',
  choice: '抉择',
  combat: '争斗',
  breakthrough: '突破',
  death: '陨落',
  ascension: '飞升',
  interference: '天机一动',
  exploration: '探幽',
};

// Task 20: 事件蓝图 category → 配色（避免 indigo/blue 主色调）
const BLUEPRINT_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  combat:       { bg: 'bg-red-500/15',     text: 'text-red-700 dark:text-red-300',     border: 'border-red-500/40' },
  encounter:    { bg: 'bg-yellow-500/15',  text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-500/40' },
  trade:        { bg: 'bg-green-500/15',   text: 'text-green-700 dark:text-green-300', border: 'border-green-500/40' },
  social:       { bg: 'bg-cyan-500/15',    text: 'text-cyan-700 dark:text-cyan-300',   border: 'border-cyan-500/40' },
  cultivation:  { bg: 'bg-purple-500/15',  text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/40' },
  inner_demon:  { bg: 'bg-pink-500/15',    text: 'text-pink-700 dark:text-pink-300',   border: 'border-pink-500/40' },
  heritage:     { bg: 'bg-orange-500/15',  text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/40' },
  exploration:  { bg: 'bg-teal-500/15',    text: 'text-teal-700 dark:text-teal-300',   border: 'border-teal-500/40' },
  trial:        { bg: 'bg-amber-500/15',   text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/40' },
  daily:        { bg: 'bg-muted/40',       text: 'text-muted-foreground',              border: 'border-muted-foreground/30' },
};


function hasInternalVisibleText(text?: string) {
  return /\u6d41\u5e74\u56e0|\u540c\u5e74\u7eed\u7bc7|\u547d\u8282\u70b9|\u7eed\u7bc7/.test(String(text || ''));
}

function cleanVisibleNarrativeText(text?: string) {
  return String(text || '')
    .replace(/\u6d41\u5e74\u56e0[\uff1a:]?/g, '')
    .replace(/\u540c\u5e74\u7eed\u7bc7/g, '')
    .replace(/\u7eed\u7bc7/g, '')
    .replace(/^[\u002c\uff0c\u003b\uff1b\u3002\s]+/, '')
    .trim();
}

function BlueprintChip({ blueprint, eventType }: { blueprint?: { category: string; name: string }; eventType?: string }) {
  if (!blueprint) return null;
  if (hasInternalVisibleText(blueprint.name)) return null;
  // "突破前夜/酝酿突破"是生成主题，不是玩家已成功突破的标签；成功破境只由 breakthrough 事件本身呈现。
  if (blueprint.category === 'cultivation' && /突破|冲关|破境/.test(blueprint.name || '') && eventType !== 'breakthrough') {
    return null;
  }
  const style = BLUEPRINT_STYLE[blueprint.category] || BLUEPRINT_STYLE.daily;
  return (
    <span
      className={cn(
        "text-[9px] px-1.5 py-0.5 rounded border font-serif-cn xianxia-chip",
        style.bg, style.text, style.border
      )}
      title={`主题：${blueprint.name}`}
    >
      因缘：{blueprint.name}
    </span>
  );
}

/**
 * 实时流式显示组件：使用 requestAnimationFrame 轮询 ref，直接操作 DOM
 * 完全绕过 React 状态系统，实现真正的实时流式效果（参考 Ägir 项目）
 */
function StreamingNarrative({ text, isNew, streamingText, eventIndex }: { text?: string; isNew?: boolean; streamingText?: string; eventIndex: number }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<string>('');
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const streamingEventIdx = useRef<number | null>(null);
  // 熔断：记录 ref 最近一次更新的时间戳；超时后用 props 静态 text 兜底渲染
  const lastRefUpdateAt = useRef<number>(Date.now());
  // 是否已触发过熔断，避免重复清场
  const fellbackRef = useRef<boolean>(false);

  // 停止动画循环
  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 熔断 fallback：清 RAF + interval，用静态 text 兜底，通知上层清掉 streamingRef
  const fallbackToStaticText = useCallback(() => {
    if (fellbackRef.current) return;
    fellbackRef.current = true;
    stopAnimation();
    if (contentRef.current && text != null) {
      contentRef.current.innerText = formatNarrativeForDisplay(text);
    }
    textRef.current = text || '';
    // 通知上层 isStreaming = false（直接清掉共享 streamingRef）
    streamingRef.current = null;
  }, [stopAnimation, text]);

  // 启动动画循环：持续检查 ref 并更新 DOM
  const startAnimation = useCallback(() => {
    stopAnimation();
    fellbackRef.current = false;
    lastRefUpdateAt.current = Date.now();

    const tick = () => {
      const state = streamingRef.current;
      const el = contentRef.current;

      if (!el) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (state && state.eventIndex === streamingEventIdx.current) {
        const newText = state.text;
        if (newText !== textRef.current) {
          // 流式态也走 normalize，避免"流式看到逗号断段/空白行 → 流完静态又调回来"的二次跳变
          el.innerText = formatNarrativeForDisplay(newText);
          textRef.current = newText;
          lastRefUpdateAt.current = Date.now();
          el.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    // 1s 轮询：若 ref 长时间（>3s）未更新且仍在流式态，触发熔断
    intervalRef.current = window.setInterval(() => {
      if (fellbackRef.current) return;
      // 仍在流式态：streamingEventIdx 已设置且共享 ref 还指向同一 eventIndex
      const stillStreaming = streamingEventIdx.current !== null
        && streamingRef.current !== null
        && streamingRef.current.eventIndex === streamingEventIdx.current;
      if (stillStreaming && Date.now() - lastRefUpdateAt.current > 3000) {
        fallbackToStaticText();
      }
    }, 1000);
  }, [stopAnimation, fallbackToStaticText]);

  // 处理流式状态开始
  useEffect(() => {
    if (streamingText !== undefined) {
      textRef.current = '';
      streamingEventIdx.current = eventIndex;
      lastRefUpdateAt.current = Date.now();
      fellbackRef.current = false;
      if (contentRef.current) {
        contentRef.current.innerText = formatNarrativeForDisplay(streamingText);
      }
      startAnimation();
    } else {
      stopAnimation();
    }

    return () => stopAnimation();
  }, [streamingText, eventIndex, startAnimation, stopAnimation]);

  // 非流式模式：普通渲染
  // 用与流式态一致的容器与 CSS（xianxia-prose 带 white-space: pre-line），
  // 完全信任 AI 分段——不再做任何前端切段/缩进兜底，避免"写完再跳一下"。
  if (streamingText === undefined) {
    if (!text) return null;
    return <div className="xianxia-prose">{formatNarrativeForDisplay(text)}</div>;
  }

  // 流式模式：保持段落结构，避免 done 后重排
  return (
    <div ref={contentRef} className="xianxia-prose" />
  );
}

/**
 * 2026-08-31 时序改制：外部时间标注从"条条盖戳"改成聊天软件式的日期分隔条。
 *
 * 旧版给每条事件顶上都挂一整串「23岁 · 一年后【青岚仙历5001年 · 孟春 · 7日 · 晨钟后】」。
 * 条条都标，等于没标——网文里"三个月后"一眼就懂，恰恰因为前后几十段都没写时间。
 * 现在只在真的跨了时段 / 日 / 月 / 年的那一条前面插一条分隔条，写"到达"的绝对节点；
 * 同一场戏里的连续几条之间一个字都不出，相对说法交给正文去写。
 */
export type TimeDividerScale = 'phase' | 'day' | 'month' | 'year';

export interface TimeDivider {
  /** 玩家可见文案，只写绝对节点，不重复正文里的相对说法 */
  text: string;
  /** 跨度档位，决定分隔条的视觉轻重 */
  scale: TimeDividerScale;
}

interface TimeAnchor {
  eraName: string;
  calendarYear: number;
  dayCount: number;
  monthName: string;
  day: number;
  phase: string;
  age: number;
  /** 世界历字段是否齐备；老存档缺字段时为 false，只能退化成按岁数比 */
  hasCalendar: boolean;
}

function readTimeAnchor(event?: GameEvent): TimeAnchor | undefined {
  if (!event) return undefined;
  const w = event.worldTime as Partial<NonNullable<GameEvent['worldTime']>> | undefined;
  const rawDays = Number(w?.elapsedDays);
  const rawYear = Number(w?.calendarYear);
  const hasCalendar = Number.isFinite(rawDays) && Number.isFinite(rawYear);
  const rawAge = Number(event.age);
  const rawDay = Number(w?.day);
  return {
    eraName: String(w?.eraName || '').trim(),
    calendarYear: hasCalendar ? Math.round(rawYear) : 0,
    dayCount: hasCalendar ? Math.round(rawDays) : 0,
    monthName: String(w?.monthName || '').trim(),
    day: Number.isFinite(rawDay) ? Math.round(rawDay) : 0,
    phase: String(w?.phase || '').trim(),
    age: Number.isFinite(rawAge) ? rawAge : NaN,
    hasCalendar,
  };
}

/**
 * 连续态判定：这一条是"接着刚才"，一个时间元素都不渲染。
 * 三种信号任一命中即算：新契约的连续档、题签被清成空串、成品串被清成空串。
 */
export function isContinuousScene(event?: GameEvent): boolean {
  if (!event) return false;
  if (event.timeAdvance?.unit === 'continuous') return true;
  if (event.timeAdvance && typeof event.timeAdvance.label === 'string' && !event.timeAdvance.label.trim()) return true;
  if (event.worldTime && event.worldTime.displayLabel === '') return true;
  return false;
}

/**
 * 算这一条相对上一条该不该插分隔条，插的话写什么。
 * 抽成纯函数是为了能脱开 JSX 单独验：给一串事件就能核对读感。
 */
export function computeTimeDivider(event?: GameEvent, prevEvent?: GameEvent): TimeDivider | null {
  if (!event) return null;
  // 甲：连续态与上一条黏成同一场戏，不插分隔，也不回落成"N岁"
  if (isContinuousScene(event)) return null;

  const cur = readTimeAnchor(event);
  if (!cur) return null;
  const prev = readTimeAnchor(prevEvent);
  const ageText = Number.isFinite(cur.age) ? `${cur.age}岁` : '';

  // 老数据没有世界历：退化成"岁数一变就插一条"，不崩，也不装作知道具体日子
  if (!cur.hasCalendar) {
    if (!ageText) return null;
    if (!prev) return { text: ageText, scale: 'year' };
    const bothAges = Number.isFinite(prev.age) && Number.isFinite(cur.age);
    return bothAges && prev.age === cur.age ? null : { text: ageText, scale: 'year' };
  }

  const yearText = [
    cur.eraName ? `${cur.eraName}${cur.calendarYear}年` : `${cur.calendarYear}年`,
    cur.monthName,
    ageText,
  ].filter(Boolean).join(' · ');

  // 开篇，或上一条根本没有世界历可比：先立一个完整锚点，
  // 让玩家从第一屏起就答得出"现在是什么时候"——旧版只有相对量，这一点始终做不到
  if (!prev || !prev.hasCalendar) return { text: yearText, scale: 'year' };

  // 跨年 / 跨岁：写满纪年 + 月令 + 岁数
  const ageMoved = Number.isFinite(prev.age) && Number.isFinite(cur.age) && prev.age !== cur.age;
  if (prev.calendarYear !== cur.calendarYear || ageMoved) return { text: yearText, scale: 'year' };

  // 跨月 / 跨季：同年之内，写到月令就够定位
  if (cur.monthName && prev.monthName !== cur.monthName) {
    return { text: cur.day > 0 ? `${cur.monthName} · ${cur.day}日` : cur.monthName, scale: 'month' };
  }

  // 跨日：隔一天写"次日"，隔更久写落到哪一日
  const dayGap = cur.dayCount - prev.dayCount;
  if (dayGap !== 0) {
    const phaseSuffix = cur.phase ? ` · ${cur.phase}` : '';
    if (dayGap === 1) return { text: `次日${phaseSuffix}`, scale: 'day' };
    const absolute = cur.monthName && cur.day > 0 ? `${cur.monthName} · ${cur.day}日` : '数日之后';
    return { text: `${absolute}${phaseSuffix}`, scale: 'day' };
  }

  // 同日之内换了时段：只写时段，白天走到入夜也该让玩家察觉
  if (cur.phase && prev.phase && prev.phase !== cur.phase) return { text: cur.phase, scale: 'phase' };

  return null;
}

const DIVIDER_STYLE: Record<TimeDividerScale, string> = {
  year:  'text-[11px] tracking-[0.08em] border-primary/35 bg-primary/10 text-primary font-semibold',
  month: 'text-[10px] border-border/70 bg-muted/60 text-foreground/75',
  day:   'text-[10px] border-border/60 bg-muted/45 text-muted-foreground',
  phase: 'text-[9px] border-border/40 bg-muted/30 text-muted-foreground/80',
};

/** 日期分隔条：两侧细线 + 中间一枚绝对时间节点。 */
function TimeDividerRow({ divider }: { divider: TimeDivider }) {
  return (
    <div className="relative my-3 flex items-center gap-2 px-2 pointer-events-none select-none">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/70 to-transparent" />
      <span className={cn('font-serif-cn rounded-full border px-2.5 py-0.5 whitespace-nowrap', DIVIDER_STYLE[divider.scale])}>
        {divider.text}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/70 to-transparent" />
    </div>
  );
}

function eventTypeLabel(event: GameEvent, prevEvent?: GameEvent) {
  // 与上一条事件类型相同（且都是默认/常规类型时更明显重复）时，省略标签
  if (prevEvent && prevEvent.eventType === event.eventType) {
    return '' as const;
  }
  return EVENT_LABELS[event.eventType] || '流年';
}

export function EventTimeline({ events, defaultExpandedCount = 3, showToolbar = true, newEventRange, streamingEvent, settlingHint }: EventTimelineProps) {
  const character = useGameStore((s) => s.character);
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // 用 Set 记录展开的事件 index（按 events 数组顺序）
  // 首次渲染也默认展开最后 defaultExpandedCount 条，避免 0 岁开局叙事被折叠
  const [expandedSet, setExpandedSet] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    const start = Math.max(0, events.length - defaultExpandedCount);
    for (let i = start; i < events.length; i++) initial.add(i);
    return initial;
  });
  const [allExpanded, setAllExpanded] = useState(false);
  // 跟踪上次 events 长度，用于在事件数量变化时重置展开状态
  const [prevEventsLen, setPrevEventsLen] = useState(events.length);
  const lastAutoScrollLenRef = useRef(events.length);
  // 本次新增事件的第一条 index；用来滚到它而不是最底
  const [pendingScrollIndex, setPendingScrollIndex] = useState<number | null>(null);
  const newEventCardRef = useRef<HTMLDivElement | null>(null);

  const sameAgeMeta = useMemo(() => {
    const ageCounts = new Map<number, number>();
    const ageSeen = new Map<number, number>();
    for (const event of events) ageCounts.set(event.age, (ageCounts.get(event.age) || 0) + 1);
    return events.map(event => {
      const count = ageCounts.get(event.age) || 1;
      const index = (ageSeen.get(event.age) || 0) + 1;
      ageSeen.set(event.age, index);
      return { count, index, isContinuation: count > 1 && index > 1 };
    });
  }, [events]);

  // 当事件数量变化时，重置展开状态：默认展开最后 N 条
  // 使用"渲染期间调整状态"模式（React 推荐）避免 useEffect 内 setState
  if (events.length !== prevEventsLen) {
    const newFirstIndex = Math.min(prevEventsLen, events.length);
    if (newFirstIndex < events.length) setPendingScrollIndex(newFirstIndex);
    setPrevEventsLen(events.length);
    setExpandedSet(prev => {
      if (events.length === 0) return new Set();
      if (allExpanded) {
        return new Set(events.map((_, i) => i));
      }
      const next = new Set<number>();
      const start = Math.max(0, events.length - defaultExpandedCount);
      for (let i = start; i < events.length; i++) next.add(i);
      // 保留用户之前手动展开的（如果事件还在）
      prev.forEach(i => {
        if (i < events.length && i < start) next.add(i);
      });
      return next;
    });
  }

  // 流式叙事更新时，始终滚动到底部，确保“收获结算中”可见
  useEffect(() => {
    if (!streamingEvent) return;
    const timer = window.setTimeout(() => {
      let node: HTMLElement | null = containerRef.current;
      while (node) {
        const style = getComputedStyle(node);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
          node.scrollTo({ top: node.scrollHeight, behavior: 'auto' });
          return;
        }
        node = node.parentElement;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [streamingEvent?.text, streamingEvent?.eventIndex]);
  useEffect(() => {
    // 初次加载（如刷新页面后恢复 state）：直接滚到最底部
    if (events.length > 0 && lastAutoScrollLenRef.current === 0 && !pendingScrollIndex) {
      const target = endRef.current;
      if (!target) return;
      let node: HTMLElement | null = target.parentElement;
      while (node) {
        const style = getComputedStyle(node);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
          node.scrollTo({ top: node.scrollHeight, behavior: 'auto' });
          lastAutoScrollLenRef.current = events.length;
          return;
        }
        node = node.parentElement;
      }
    }
    if (events.length <= lastAutoScrollLenRef.current) {
      lastAutoScrollLenRef.current = events.length;
      return;
    }
    lastAutoScrollLenRef.current = events.length;
    // 优先滚到本次新增事件的第一条卡片；拿不到就兜底滚到底
    const target = newEventCardRef.current || endRef.current;
    if (!target) return;
    let node: HTMLElement | null = target.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
        // 用 getBoundingClientRect 算目标相对容器的位置，再预留足够顶部空间避免被 fixed/sticky header 遮挡
        const containerRect = node.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - containerRect.top + node.scrollTop;
        // 滚动后让卡片顶部在容器内 80px 处，给顶部状态栏/标签栏留出视觉空间
        node.scrollTo({ top: Math.max(0, offset - 80), behavior: 'smooth' });
        window.setTimeout(() => setPendingScrollIndex(null), 0);
        return;
      }
      node = node.parentElement;
    }
  }, [events.length]);

  // 最后一条突破事件的下标；-1 表示还没有过突破
  const lastBreakthroughIdx = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i]?.eventType === 'breakthrough') return i;
    }
    return -1;
  }, [events]);

  const toggle = (idx: number) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSet(new Set(events.map((_, i) => i)));
    setAllExpanded(true);
  };

  const collapseAll = () => {
    // 折叠全部，但保留最新一条可见
    const next = new Set<number>();
    if (events.length > 0) next.add(events.length - 1);
    setExpandedSet(next);
    setAllExpanded(false);
  };

  if (!events.length) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <p className="font-serif-cn">道未启，缘未至。</p>
        <p className="mt-2 text-xs">点入"踏入此世"步入修仙之路</p>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* 工具栏 */}
      {showToolbar && (
        <div className="sticky top-0 z-20 -mx-1 px-1 py-1.5 mb-2 bg-background/80 backdrop-blur-sm flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">
            共 <span className="text-foreground font-semibold">{events.length}</span> 条记载
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="px-1.5 py-0.5 rounded border border-border/60 hover:bg-accent/10 hover:border-accent/40 text-foreground/80 transition-colors flex items-center gap-0.5"
            >
              <Maximize2 className="w-2.5 h-2.5" />
              <span>全展</span>
            </button>
            <button
              onClick={collapseAll}
              className="px-1.5 py-0.5 rounded border border-border/60 hover:bg-accent/10 hover:border-accent/40 text-foreground/80 transition-colors flex items-center gap-0.5"
            >
              <Minimize2 className="w-2.5 h-2.5" />
              <span>全折</span>
            </button>
          </div>
        </div>
      )}

      {/* 中线 */}
      <div className="absolute left-[18px] top-12 bottom-2 w-px bg-gradient-to-b from-border via-border to-transparent" />

      {/* 沉浸版天象词徽章：扫最近 3 条 narrative 命中关键词出 chip */}
      <XianxiaRibbon narratives={events.slice(-3).map((e) => e?.narrative ?? '')} />

      <div className="space-y-2">
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1;
          const isExpanded = expandedSet.has(idx);
          const isNewEvent = !!(newEventRange && idx >= newEventRange.start && idx < newEventRange.end);
          const isFate = event.isFateNode || event.eventType === 'fate_node';
          const isDeath = event.eventType === 'death';
          const isAscension = event.eventType === 'ascension';
          const isBreakthrough = event.eventType === 'breakthrough';
          const isExploration = event.eventType === 'exploration';
          const visibleEffects = (event.effects || []).filter(isVisibleEffect);
          const ageMeta = sameAgeMeta[idx] || { count: 1, index: 1, isContinuation: false };
          const prevEvent = idx > 0 ? events[idx - 1] : undefined;
          // 2026-08-31：日期分隔条取代原先"每条卡片顶上一串时间"。
          const divider = computeTimeDivider(event, prevEvent);
          // 破境 / 因缘转折 / 陨落 / 飞升 自带节点语义，保留原来那道弱化细线；
          // 但"同年首条 / 开篇"这两个触发条件已被分隔条覆盖，撤掉免得两层分隔叠着出现。
          const showMilestoneRule = (isFate || isBreakthrough || isDeath || isAscension) && !divider;
          // 连续态与同年续写一样走紧凑排版，视觉上黏在上一条下面
          const isTightScene = ageMeta.isContinuation || isContinuousScene(event);
          const typeText = eventTypeLabel(event, prevEvent);
          return (
            <Fragment key={event.id || idx}>
            {divider && <TimeDividerRow divider={divider} />}
            {showMilestoneRule && (
              <div className="relative my-3 flex items-center gap-2 px-2 pointer-events-none">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/60 to-transparent" />
                <span className="text-[9px] tracking-[0.3em] text-muted-foreground/50 font-serif-cn">·</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/60 to-transparent" />
              </div>
            )}
            <div
              className={cn(
                "relative pl-10 scroll-reveal",
                isTightScene && "-mt-1 pl-14",
                (isFate || isBreakthrough) && "scale-100"
              )}
            >
              {/* 节点圆点 */}
              <div
                className={cn(
                  "absolute left-[10px] top-2 w-4 h-4 rounded-full border-2 flex items-center justify-center z-10",
                  isFate ? "bg-primary border-primary text-primary-foreground" :
                  isBreakthrough ? "bg-yellow-400 border-yellow-400 text-white" :
                  isDeath ? "bg-destructive border-destructive text-white" :
                  isAscension ? "bg-yellow-400 border-yellow-400 text-white" :
                  isExploration ? "bg-emerald-500 border-emerald-500 text-white" :
                  "bg-card border-border text-muted-foreground"
                )}
                style={isFate ? { boxShadow: '0 0 12px var(--primary)' } : isBreakthrough || isAscension ? { boxShadow: '0 0 12px #fbbf24' } : isExploration ? { boxShadow: '0 0 10px #10b981' } : undefined}
              >
                <span className="scale-75">{EVENT_ICONS[event.eventType] || EVENT_ICONS.normal}</span>
              </div>

              {/* 卡片 - 可点击折叠 */}
              <div
                ref={idx === pendingScrollIndex ? newEventCardRef : undefined}
                className={cn(
                  "rounded-lg border shadow-sm cursor-pointer transition-all",
                  isFate ? "border-primary/40 bg-primary/5" :
                  isBreakthrough ? "border-yellow-400/40 bg-yellow-400/5" :
                  isDeath ? "border-destructive/40 bg-destructive/5" :
                  isAscension ? "border-yellow-400/40 bg-yellow-400/5" :
                  isExploration ? "border-emerald-500/40 bg-emerald-500/5" :
                  isTightScene ? "border-border/50 bg-card/55 border-l-4 border-l-amber-500/35 shadow-none" :
                  "border-border/60 bg-card/80",
                  "hover:shadow-md hover:border-primary/40",
                  !isExpanded && "py-2"
                )}
                onClick={() => toggle(idx)}
              >
                {/* 头部 - 始终可见
                    2026-08-31：原来这里挂的整串时间已撤走。时间节点统一由上方的日期分隔条承担，
                    卡片顶上不再逐条重复，"没提到时间就是现在进行"才立得住。 */}
                <div className="flex items-center justify-between mb-0.5 px-3 pt-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {isFate && (
                      <span className="seal text-[9px]">命</span>
                    )}
                    {isBreakthrough && (
                      <span className="text-[9px] px-1 rounded bg-yellow-400/20 text-yellow-600">破</span>
                    )}
                    {typeText && (
                      <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50 shrink-0">
                        {typeText}
                      </span>
                    )}
                    {/* Task 20: 事件蓝图主题 chip */}
                    <BlueprintChip blueprint={event.blueprint} eventType={event.eventType} />
                  </div>
                  <div className="flex items-center gap-1">
                    {event.fateNodeName && (
                      <span className="text-[10px] font-semibold text-primary hidden sm:inline">
                        {event.fateNodeName}
                      </span>
                    )}
                    <ChevronDown className={cn(
                      "w-3.5 h-3.5 text-muted-foreground transition-transform",
                      isExpanded ? "rotate-180" : ""
                    )} />
                  </div>
                </div>

                {/* 标题 - 始终可见 */}
                <h4 className={cn(
                  "font-semibold font-serif-cn px-3 xianxia-readable",
                  isTightScene ? "text-xs text-foreground/85" : "text-sm",
                  isExpanded ? "pb-1" : "pb-2"
                )}>
                  {event.title}
                </h4>

                {/* 正文 - 可折叠
                    2026-07-10：正文字号从 text-xs (12px) 提到 text-sm (14px)，
                    行距同步从 leading-relaxed 提到 leading-7，减轻长篇 AI 叙事阅读疲劳 */}
                {isExpanded && (
                  <div className="px-3 pb-2">
                    <div className="text-sm leading-7 text-foreground/90 xianxia-prose">
                      <StreamingNarrative text={event.narrative} isNew={isNewEvent} streamingText={streamingEvent && isNewEvent ? streamingEvent.text : undefined} eventIndex={idx} />
                    </div>
                    {/* 生成式 UI DEMO #1（2026-07-10）——本次事件获得的物品用宝物卡呈现，
                        品阶色 + 图标 + 描述 + 属性 chip；从 event.effects 里提取 kind='item'|'equipment' 的名字 */}
                    {(() => {
                      const itemNames = (event.effects || [])
                        .filter((e: any) => e && (e.kind === 'item' || e.kind === 'equipment') && typeof e.name === 'string' && e.name.trim())
                        .map((e: any) => e.name);
                      return itemNames.length > 0 ? <TreasureCard names={itemNames} /> : null;
                    })()}
                    {/* 生成式 UI DEMO #2 —— 灵宠结契卡：从 effects 里提取 kind==='pet' 的名字 */}
                    {(() => {
                      const petNames = (event.effects || [])
                        .filter((e: any) => e && e.kind === 'pet' && typeof e.name === 'string' && e.name.trim())
                        .map((e: any) => e.name);
                      return petNames.length > 0 ? <NpcEncounterCard pets={petNames} /> : null;
                    })()}
                    {/* 生成式 UI DEMO #3 —— 场景现身卡：blueprint.category 命中 exploration|secret_realm|travel|encounter */}
                    {(() => {
                      const cat = event.blueprint?.category;
                      if (!cat || !SCENE_CATEGORY_LABEL[cat]) return null;
                      const location = String(character?.location || event.blueprint?.name || '').trim();
                      if (!location) return null;
                      return (
                        <SceneRevealCard
                          location={location}
                          categoryLabel={SCENE_CATEGORY_LABEL[cat]}
                          narrative={event.narrative}
                        />
                      );
                    })()}
                    {/* 生成式 UI DEMO #5 —— 突破闪耀卡：eventType === 'breakthrough' */}
                    {event.eventType === 'breakthrough' && (
                      <BreakthroughFlashCard
                        narrative={event.narrative}
                        // 只有最后一条突破才和角色当下的境界对得上。
                        // 往上翻的历史突破如果也拿当下境界去填,元婴期回看炼气那次
                        // 会写成「突破入元婴」——卡片上写的不是那一刻的事。
                        isLatest={idx === lastBreakthroughIdx}
                      />
                    )}
                    {/* 效果 */}
                    {visibleEffects.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {visibleEffects.map((eff: any, i: number) => (
                          <span
                            key={i}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded border xianxia-chip",
                              getEffectTone(eff) === 'positive'
                                ? "bg-green-500/10 text-green-700 border-green-500/30"
                                : getEffectTone(eff) === 'negative'
                                ? "bg-red-500/10 text-red-700 border-red-500/30"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {formatEffectLabel(eff)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* 折叠态效果摘要 */}
                {!isExpanded && visibleEffects.length > 0 && (
                  <div className="px-3 pb-1 flex flex-wrap gap-1">
                    {visibleEffects.slice(0, 4).map((eff: any, i: number) => (
                      <span
                        key={i}
                        className={cn(
                          "text-[9px] px-1 py-0.5 rounded border xianxia-chip",
                          getEffectTone(eff) === 'positive'
                            ? "bg-green-500/10 text-green-700 border-green-500/30"
                            : getEffectTone(eff) === 'negative'
                            ? "bg-red-500/10 text-red-700 border-red-500/30"
                            : "bg-muted text-muted-foreground border-border"
                        )}
                      >
                        {formatEffectLabel(eff)}
                      </span>
                    ))}
                    {visibleEffects.length > 4 && (
                      <span className="text-[9px] text-muted-foreground px-1">
                        +{visibleEffects.length - 4}
                      </span>
                    )}
                  </div>
                )}
                {/* 折叠态结算提示已迁移到事件标题 */}

                {/* 折叠态提示 */}
                {!isExpanded && (
                  <div className="px-3 pb-1 text-[9px] text-muted-foreground/70 flex items-center gap-1">
                    <ChevronsUpDown className="w-2.5 h-2.5" />
                    <span>点入展开详情</span>
                  </div>
                )}

                {/* 收获结算中提示：仅显示在最后一个事件下方 */}
                {isLast && settlingHint === 'calculating' && (
                  <div className="px-3 pb-2 -mt-1">
                    <div className="text-[11px] text-primary/80 italic flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>收获结算中…</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </Fragment>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}



function isVisibleEffect(eff: any): boolean {
  return eff?.kind !== 'eventMeta' && isVisibleNumericEventEffect(eff);
}

function formatEffectLabel(eff: any): React.ReactNode {
  const label = formatEventEffectLabel(eff);
  const match = label.match(/^(获得状态|收服灵宠|获得|装备|失去|得|售)([：:]?)(.+)$/);
  if (match) return <>{match[1]}{match[2]}<span className="ml-0.5 font-medium">{match[3]}</span></>;
  return <>{label}</>;
}

function getEffectTone(eff: { attribute?: string; delta?: number; kind?: string; tone?: 'positive' | 'negative' | 'neutral' }): 'positive' | 'negative' | 'neutral' {
  return eventEffectTone(eff);
}
