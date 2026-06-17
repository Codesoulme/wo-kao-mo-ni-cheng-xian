'use client';

import { GameEvent } from '@/lib/xianxia/store';
import { cn } from '@/lib/utils';
import { Sparkles, Skull, Crown, Swords, Mountain, Zap } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface EventTimelineProps {
  events: GameEvent[];
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

export function EventTimeline({ events }: EventTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 滚动到最新
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [events.length]);

  if (!events.length) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <p className="font-serif-cn">道未启，缘未至。</p>
        <p className="mt-2 text-xs">点击"开始模拟"步入修仙之路</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 中线 */}
      <div className="absolute left-[18px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border to-transparent" />

      <div className="space-y-3">
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1;
          const isFate = event.isFateNode || event.eventType === 'fate_node';
          const isDeath = event.eventType === 'death';
          const isAscension = event.eventType === 'ascension';

          return (
            <div
              key={event.id || idx}
              className={cn(
                "relative pl-10 scroll-reveal",
                isFate && "scale-100"
              )}
            >
              {/* 节点圆点 */}
              <div
                className={cn(
                  "absolute left-[10px] top-2 w-4 h-4 rounded-full border-2 flex items-center justify-center z-10",
                  isFate ? "bg-primary border-primary text-primary-foreground" :
                  isDeath ? "bg-destructive border-destructive text-white" :
                  isAscension ? "bg-yellow-400 border-yellow-400 text-white" :
                  "bg-card border-border text-muted-foreground"
                )}
                style={isFate ? { boxShadow: '0 0 12px var(--primary)' } : undefined}
              >
                <span className="scale-75">{EVENT_ICONS[event.eventType] || EVENT_ICONS.normal}</span>
              </div>

              {/* 卡片 */}
              <div
                className={cn(
                  "rounded-lg border p-3 shadow-sm",
                  isFate ? "border-primary/40 bg-primary/5" :
                  isDeath ? "border-destructive/40 bg-destructive/5" :
                  isAscension ? "border-yellow-400/40 bg-yellow-400/5" :
                  "border-border/60 bg-card/80"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary font-serif-cn">
                      {event.age}岁
                    </span>
                    {isFate && (
                      <span className="seal text-[9px]">命</span>
                    )}
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">
                      {EVENT_LABELS[event.eventType] || '流年'}
                    </span>
                  </div>
                  {event.fateNodeName && (
                    <span className="text-[10px] font-semibold text-primary">
                      {event.fateNodeName}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold font-serif-cn mb-1">{event.title}</h4>
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
