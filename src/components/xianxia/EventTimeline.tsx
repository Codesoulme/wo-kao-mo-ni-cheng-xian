'use client';

import { GameEvent } from '@/lib/xianxia/store';
import { cn } from '@/lib/utils';
import { formatEventEffectLabel, eventEffectTone, isVisibleNumericEventEffect } from '@/lib/xianxia/display';
import { Sparkles, Skull, Crown, Swords, Mountain, Zap, ChevronDown, ChevronsUpDown, Maximize2, Minimize2, Compass } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface EventTimelineProps {
  events: GameEvent[];
  /** 默认展开最近几条事件，默认 3 */
  defaultExpandedCount?: number;
  /** 是否显示顶部工具栏（展开/折叠全部），默认 true */
  showToolbar?: boolean;
  /** 新事件索引范围 [start, end)：这些事件会触发气泡级流式显示 */
  newEventRange?: { start: number; end: number };
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
  interference: '干扰',
  exploration: '秘境',
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

function isActionLikeTimeSegment(text?: string) {
  return /\u53ef\u5411|\u6253\u542c|\u8be2\u95ee|\u524d\u5f80|\u6267\u884c\u7ea6\u5b9a|\u8ffd\u67e5|\u8ffd\u5bfb|\u63a2\u5165|\u5165\u5e02|\u8d74\u7ea6|\u5bfb\u8bbf|\u62dc\u8bbf|\u4fee\u58eb/.test(String(text || ''));
}

function cleanVisibleNarrativeText(text?: string) {
  return String(text || '')
    .replace(/\u6d41\u5e74\u56e0[\uff1a:]?/g, '')
    .replace(/\u540c\u5e74\u7eed\u7bc7/g, '')
    .replace(/\u7eed\u7bc7/g, '')
    .replace(/^[\u002c\uff0c\u003b\uff1b\u3002\s]+/, '')
    .trim();
}

function cleanVisibleTimeLabel(label?: string) {
  const raw = String(label || '').trim();
  if (!raw) return '';
  const bracketIndex = raw.indexOf('\u3010');
  if (bracketIndex >= 0) {
    const before = raw.slice(0, bracketIndex).trim();
    const world = raw.slice(bracketIndex).trim();
    const ageMatch = before.match(/^(\d+\u5c81)/);
    const segment = before.replace(/^(\d+\u5c81)(\s*\u00b7\s*)?/, '').trim();
    if (hasInternalVisibleText(segment) || isActionLikeTimeSegment(segment)) {
      return `${ageMatch?.[1] || ''}${world}`;
    }
  }
  return hasInternalVisibleText(raw) || isActionLikeTimeSegment(raw) ? '' : raw;
}


function splitNarrativeParagraphs(text?: string): string[] {
  const raw = cleanVisibleNarrativeText(text);
  if (!raw) return [];
  const explicit = raw
    .split(/\n+/)
    .map(part => part.trim())
    .filter(Boolean);
  const source = explicit.length > 1 ? explicit : [raw];
  const paragraphs: string[] = [];
  for (const part of source) {
    if (part.length <= 90) {
      paragraphs.push(part);
      continue;
    }
    const sentences = part.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [part];
    let current = '';
    for (const sentence of sentences.map(s => s.trim()).filter(Boolean)) {
      if (current && (current + sentence).length > 86) {
        paragraphs.push(current);
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current) paragraphs.push(current);
  }
  return paragraphs;
}

function BlueprintChip({ blueprint, eventType }: { blueprint?: { category: string; name: string }; eventType?: string }) {
  if (!blueprint || hasInternalVisibleText(blueprint.name)) return null;
  // “突破前夜/酝酿突破”是生成主题，不是玩家已成功突破的标签；成功破境只由 breakthrough 事件本身呈现。
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
 * 气泡级增量显示：narrative 按句切片后逐个出现
 * - 旧事件/已展开：直接全部显示（无动画）
 * - 新事件：逐句出现，间隔 180ms；玩家感觉"AI 在写"
 */
function StreamingNarrative({ text, isNew }: { text?: string; isNew?: boolean }) {
  const paragraphs = useMemo(() => splitNarrativeParagraphs(text), [text]);
  const [visibleCount, setVisibleCount] = useState(isNew ? 0 : paragraphs.length);

  // 新事件 + 内容变化时重置
  useEffect(() => {
    if (!isNew) {
      setVisibleCount(paragraphs.length);
      return;
    }
    setVisibleCount(0);
    let cancelled = false;
    let i = 0;
    // 间隔随段数递减：前 2 段稍慢（让首气泡有悬念感），之后快
    const intervalFor = (n: number) => n < 2 ? 220 : n < 5 ? 150 : 120;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setVisibleCount(i);
      if (i < paragraphs.length) {
        setTimeout(tick, intervalFor(i));
      }
    };
    if (paragraphs.length > 0) {
      setTimeout(tick, 200); // 第一个气泡延迟稍长，让"loading -> 出字"有过渡
    } else {
      setVisibleCount(0);
    }
    return () => { cancelled = true; };
  }, [paragraphs, isNew]);

  if (paragraphs.length === 0) return null;
  return (
    <>
      {paragraphs.slice(0, visibleCount).map((p, idx) => (
        <p
          key={idx}
          className={cn(
            "first-letter:pl-0 transition-opacity duration-300",
            idx === visibleCount - 1 && isNew ? "animate-in fade-in slide-in-from-bottom-1" : ""
          )}
        >
          {p}
        </p>
      ))}
      {isNew && visibleCount < paragraphs.length && (
        <p className="text-muted-foreground/50 text-[10px] animate-pulse">…</p>
      )}
    </>
  );
}

function eventTimeLabel(event: GameEvent, ageMeta: { isContinuation: boolean }, prevEvent?: GameEvent) {
  const displayLabel = cleanVisibleTimeLabel(event.worldTime?.displayLabel);
  // 与上一条事件时间完全一致时，省略本条时间戳
  if (prevEvent) {
    const prevDisplay = cleanVisibleTimeLabel(prevEvent.worldTime?.displayLabel);
    if (displayLabel && prevDisplay && displayLabel === prevDisplay) return '';
    // 当本条也没有 displayLabel 但构造出来会等于 prevDisplay 时也省略
    if (!displayLabel) {
      const fallback = buildFallbackTimeLabel(event, ageMeta);
      if (fallback && fallback === prevDisplay) return '';
    }
  }
  if (displayLabel) return displayLabel;
  const worldLabel = event.worldTime?.label;
  const segmentLabel = cleanVisibleTimeLabel(event.timeAdvance?.label);
  const ageText = ageMeta.isContinuation ? '' : `${event.age}\u5c81`;
  const open = '\u3010';
  const close = '\u3011';
  if (worldLabel && segmentLabel) return ageText ? `${ageText} \u00b7 ${segmentLabel}${open}${worldLabel}${close}` : `${segmentLabel}${open}${worldLabel}${close}`;
  if (worldLabel) return ageText ? `${ageText}${open}${worldLabel}${close}` : `${open}${worldLabel}${close}`;
  if (segmentLabel) return ageText ? `${ageText} \u00b7 ${segmentLabel}` : segmentLabel;
  return ageText || '';
}

function buildFallbackTimeLabel(event: GameEvent, ageMeta: { isContinuation: boolean }) {
  const worldLabel = event.worldTime?.label;
  const segmentLabel = cleanVisibleTimeLabel(event.timeAdvance?.label);
  const ageText = ageMeta.isContinuation ? '' : `${event.age}\u5c81`;
  const open = '\u3010';
  const close = '\u3011';
  if (worldLabel && segmentLabel) return ageText ? `${ageText} \u00b7 ${segmentLabel}${open}${worldLabel}${close}` : `${segmentLabel}${open}${worldLabel}${close}`;
  if (worldLabel) return ageText ? `${ageText}${open}${worldLabel}${close}` : `${open}${worldLabel}${close}`;
  if (segmentLabel) return ageText ? `${ageText} \u00b7 ${segmentLabel}` : segmentLabel;
  return ageText || '';
}

function eventTypeLabel(event: GameEvent, prevEvent?: GameEvent) {
  // 与上一条事件类型相同（且都是默认/常规类型时更明显重复）时，省略标签
  if (prevEvent && prevEvent.eventType === event.eventType) {
    return '' as const;
  }
  return EVENT_LABELS[event.eventType] || '流年';
}

export function EventTimeline({ events, defaultExpandedCount = 3, showToolbar = true, newEventRange }: EventTimelineProps) {
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

  // 只在新增史册事件时滚到本次新增事件的第一条；切换标签页或展开/折叠不改变玩家离开时的位置。
  useEffect(() => {
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
        setPendingScrollIndex(null);
        return;
      }
      node = node.parentElement;
    }
  }, [events.length]);

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
        <p className="mt-2 text-xs">点击"开始模拟"步入修仙之路</p>
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
          const timeText = eventTimeLabel(event, ageMeta, prevEvent);
          const typeText = eventTypeLabel(event, prevEvent);
          return (
            <div
              key={event.id || idx}
              className={cn(
                "relative pl-10 scroll-reveal",
                ageMeta.isContinuation && "-mt-1 pl-14",
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
                  ageMeta.isContinuation ? "border-border/50 bg-card/55 border-l-4 border-l-amber-500/35 shadow-none" :
                  "border-border/60 bg-card/80",
                  "hover:shadow-md hover:border-primary/40",
                  !isExpanded && "py-2"
                )}
                onClick={() => toggle(idx)}
              >
                {/* 头部 - 始终可见 */}
                <div className="flex items-center justify-between mb-0.5 px-3 pt-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {timeText && (
                      <span className={cn(
                        "text-xs font-bold font-serif-cn",
                        ageMeta.isContinuation ? "text-amber-600 dark:text-amber-300" : "text-primary"
                      )}>
                        {timeText}
                      </span>
                    )}
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
                  ageMeta.isContinuation ? "text-xs text-foreground/85" : "text-sm",
                  isExpanded ? "pb-1" : "pb-2"
                )}>
                  {event.title}
                </h4>

                {/* 正文 - 可折叠 */}
                {isExpanded && (
                  <div className="px-3 pb-2">
                    <div className="space-y-2 text-xs leading-relaxed text-foreground/90 xianxia-prose">
                      <StreamingNarrative text={event.narrative} isNew={isNewEvent} />
                    </div>
                    {/* 效果 */}
                    {visibleEffects.length > 0 && (
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
                    )}
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

                {/* 折叠态提示 */}
                {!isExpanded && (
                  <div className="px-3 pb-1 text-[9px] text-muted-foreground/70 flex items-center gap-1">
                    <ChevronsUpDown className="w-2.5 h-2.5" />
                    <span>点击展开详情</span>
                  </div>
                )}
              </div>
            </div>
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
