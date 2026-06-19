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
  fate_node: '命节点',
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


function splitNarrativeParagraphs(text?: string): string[] {
  const raw = String(text || '').trim();
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
  if (!blueprint) return null;
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
      {blueprint.name}
    </span>
  );
}

export function EventTimeline({ events, defaultExpandedCount = 3, showToolbar = true }: EventTimelineProps) {
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

  // 只在新增史册事件时滚到最新；切换标签页或展开/折叠不改变玩家离开时的位置。
  useEffect(() => {
    if (events.length <= lastAutoScrollLenRef.current) {
      lastAutoScrollLenRef.current = events.length;
      return;
    }
    lastAutoScrollLenRef.current = events.length;
    const el = endRef.current;
    if (!el) return;
    // 向上查找最近的可滚动祖先
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
        node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
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
          const isFate = event.isFateNode || event.eventType === 'fate_node';
          const isDeath = event.eventType === 'death';
          const isAscension = event.eventType === 'ascension';
          const isBreakthrough = event.eventType === 'breakthrough';
          const isExploration = event.eventType === 'exploration';
          const visibleEffects = (event.effects || []).filter(isVisibleEffect);
          const ageMeta = sameAgeMeta[idx] || { count: 1, index: 1, isContinuation: false };

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
                    {!ageMeta.isContinuation ? (
                      <span className="text-xs font-bold text-primary font-serif-cn">
                        {event.age}岁
                      </span>
                    ) : (
                      <span className="h-px w-6 bg-amber-500/40" aria-hidden="true" />
                    )}
                    {isFate && (
                      <span className="seal text-[9px]">命</span>
                    )}
                    {isBreakthrough && (
                      <span className="text-[9px] px-1 rounded bg-yellow-400/20 text-yellow-600">破</span>
                    )}
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50 shrink-0">
                      {EVENT_LABELS[event.eventType] || '流年'}
                    </span>
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
                      {splitNarrativeParagraphs(event.narrative).map((paragraph, pIdx) => (
                        <p key={pIdx} className="first-letter:pl-0">
                          {paragraph}
                        </p>
                      ))}
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
  return isVisibleNumericEventEffect(eff);
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
