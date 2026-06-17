'use client';

import { GameEvent } from '@/lib/xianxia/store';
import { cn } from '@/lib/utils';
import { Sparkles, Skull, Crown, Swords, Mountain, Zap, ChevronDown, ChevronsUpDown, Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
};

export function EventTimeline({ events, defaultExpandedCount = 3, showToolbar = true }: EventTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // 用 Set 记录展开的事件 index（按 events 数组顺序）
  // 默认展开最后 defaultExpandedCount 条
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  // 跟踪上次 events 长度，用于在事件数量变化时重置展开状态
  const [prevEventsLen, setPrevEventsLen] = useState(events.length);

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

  // 自动滚动到最新事件：仅滚动最近的滚动容器，避免向上传播到 body
  useEffect(() => {
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
  }, [events.length, expandedSet]);

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

          return (
            <div
              key={event.id || idx}
              className={cn(
                "relative pl-10 scroll-reveal",
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
                  "bg-card border-border text-muted-foreground"
                )}
                style={isFate ? { boxShadow: '0 0 12px var(--primary)' } : isBreakthrough || isAscension ? { boxShadow: '0 0 12px #fbbf24' } : undefined}
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
                  "border-border/60 bg-card/80",
                  "hover:shadow-md hover:border-primary/40",
                  !isExpanded && "py-2"
                )}
                onClick={() => toggle(idx)}
              >
                {/* 头部 - 始终可见 */}
                <div className="flex items-center justify-between mb-0.5 px-3 pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-primary font-serif-cn">
                      {event.age}岁
                    </span>
                    {isFate && (
                      <span className="seal text-[9px]">命</span>
                    )}
                    {isBreakthrough && (
                      <span className="text-[9px] px-1 rounded bg-yellow-400/20 text-yellow-600">破</span>
                    )}
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">
                      {EVENT_LABELS[event.eventType] || '流年'}
                    </span>
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
                  "text-sm font-semibold font-serif-cn px-3",
                  isExpanded ? "pb-1" : "pb-2"
                )}>
                  {event.title}
                </h4>

                {/* 正文 - 可折叠 */}
                {isExpanded && (
                  <div className="px-3 pb-2">
                    <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {event.narrative}
                    </p>
                    {/* 效果 */}
                    {event.effects && event.effects.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {event.effects.map((eff: any, i: number) => (
                          <span
                            key={i}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded border",
                              eff.delta > 0
                                ? "bg-green-500/10 text-green-700 border-green-500/30"
                                : eff.delta < 0
                                ? "bg-red-500/10 text-red-700 border-red-500/30"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {ATTR_LABEL[eff.attribute] || eff.attribute}
                            {eff.delta > 0 ? '+' : ''}{eff.delta}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 折叠态效果摘要 */}
                {!isExpanded && event.effects && event.effects.length > 0 && (
                  <div className="px-3 pb-1 flex flex-wrap gap-1">
                    {event.effects.slice(0, 4).map((eff: any, i: number) => (
                      <span
                        key={i}
                        className={cn(
                          "text-[9px] px-1 py-0.5 rounded border",
                          eff.delta > 0
                            ? "bg-green-500/10 text-green-700 border-green-500/30"
                            : eff.delta < 0
                            ? "bg-red-500/10 text-red-700 border-red-500/30"
                            : "bg-muted text-muted-foreground border-border"
                        )}
                      >
                        {ATTR_LABEL[eff.attribute] || eff.attribute}
                        {eff.delta > 0 ? '+' : ''}{eff.delta}
                      </span>
                    ))}
                    {event.effects.length > 4 && (
                      <span className="text-[9px] text-muted-foreground px-1">
                        +{event.effects.length - 4}
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

const ATTR_LABEL: Record<string, string> = {
  age: '年龄', lifespan: '寿元',
  cultivationExp: '修为',
  hp: '生命', maxHp: '生命上限',
  mp: '灵力', maxMp: '灵力上限',
  attack: '攻击', defense: '防御', speed: '速度',
  luck: '气运', comprehension: '悟性',
  spiritStones: '灵石', reputation: '声望',
  elementMetal: '金', elementWood: '木', elementWater: '水', elementFire: '火', elementEarth: '土',
};
