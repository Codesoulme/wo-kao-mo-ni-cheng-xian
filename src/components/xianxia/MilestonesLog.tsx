'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import {
  ChevronDown, Baby, Sparkles, Mountain, Zap, Skull, Crown, Package, Star, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { REALMS } from '@/lib/xianxia/types';
import { formatEventEffectLabel, eventEffectTone, isVisibleNumericEventEffect } from '@/lib/xianxia/display';

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#d4af37', mythic: '#ec4899',
};
const RARITY_LABEL: Record<string, string> = {
  common: '凡品', uncommon: '良品', rare: '稀有',
  epic: '史诗', legendary: '传说', mythic: '神话',
};

export function MilestonesLog() {
  const { character, events, choices } = useGameStore();
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({
    birth: true,
    breakthrough: true,
    fate: true,
    interfere: false,
    treasures: true,
    statuses: false,
    end: true,
  });

  if (!character) return null;

  // 降世 - 第一条事件（age 0 或最早事件）
  const birthEvent = events[0];

  // 境界突破
  const breakthroughs = events.filter(e => e.eventType === 'breakthrough');

  // 命节点抉择（从 choices 记录）
  const fateChoices = choices;

  // 干扰回响
  const interferences = events.filter(e => e.eventType === 'interference');

  // 珍藏 - legendary/mythic 物品
  const treasures = character.inventory.filter((i: any) =>
    i.rarity === 'legendary' || i.rarity === 'mythic' || i.rarity === 'epic'
  );

  // 殊途 - epic+ 状态
  const majorStatuses = character.activeStatuses.filter((s: any) =>
    s.rarity === 'epic' || s.rarity === 'legendary' || s.rarity === 'mythic'
  );

  // 终焉
  const endEvent = events.find(e => e.eventType === 'death' || e.eventType === 'ascension');

  const toggle = (key: string) => setOpenMap(prev => ({ ...prev, [key]: !prev[key] }));

  const totalMilestones = 1 + breakthroughs.length + fateChoices.length + interferences.length +
    (endEvent ? 1 : 0) + treasures.length + majorStatuses.length;

  return (
    <div className="space-y-3">
      {/* 总览 */}
      <div className="text-xs text-muted-foreground px-1 flex items-center justify-between">
        <span>关键节点 · 修真历程</span>
        <span className="text-[10px]">共 {totalMilestones} 项</span>
      </div>

      {/* 降世 */}
      {birthEvent && (
        <MilestoneSection
          icon={<Baby className="w-4 h-4" />}
          title="降世"
          count={1}
          color="#84cc16"
          open={openMap.birth}
          onToggle={() => toggle('birth')}
        >
          <MilestoneItem
            age={birthEvent.age}
            title={birthEvent.title}
            narrative={birthEvent.narrative}
            color="#84cc16"
            tag="初生"
          />
        </MilestoneSection>
      )}

      {/* 境界突破 */}
      <MilestoneSection
        icon={<Sparkles className="w-4 h-4" />}
        title="境界突破"
        count={breakthroughs.length}
        color="#eab308"
        open={openMap.breakthrough}
        onToggle={() => toggle('breakthrough')}
      >
        {breakthroughs.length === 0 ? (
          <Empty text="尚未突破境界" />
        ) : (
          breakthroughs.map((e, i) => (
            <MilestoneItem
              key={e.id || i}
              age={e.age}
              title={e.title}
              narrative={e.narrative}
              color="#eab308"
              tag="突破"
              effects={e.effects}
            />
          ))
        )}
      </MilestoneSection>

      {/* 命节点抉择 */}
      <MilestoneSection
        icon={<Mountain className="w-4 h-4" />}
        title="命途抉择"
        count={fateChoices.length}
        color="#c8453c"
        open={openMap.fate}
        onToggle={() => toggle('fate')}
      >
        {fateChoices.length === 0 ? (
          <Empty text="尚未触发命节点" />
        ) : (
          fateChoices.map((c, i) => (
            <ChoiceMilestoneItem key={c.id || i} choice={c} />
          ))
        )}
      </MilestoneSection>

      {/* 天道回响（干扰） */}
      <MilestoneSection
        icon={<Zap className="w-4 h-4" />}
        title="天道回响"
        count={interferences.length}
        color="#2e5c8a"
        open={openMap.interfere}
        onToggle={() => toggle('interfere')}
      >
        {interferences.length === 0 ? (
          <Empty text="尚未干预天道" />
        ) : (
          interferences.map((e, i) => (
            <MilestoneItem
              key={e.id || i}
              age={e.age}
              title={e.title}
              narrative={e.narrative}
              color="#2e5c8a"
              tag="干扰"
              effects={e.effects}
            />
          ))
        )}
      </MilestoneSection>

      {/* 珍藏 */}
      <MilestoneSection
        icon={<Package className="w-4 h-4" />}
        title="珍藏·法宝"
        count={treasures.length}
        color="#d4af37"
        open={openMap.treasures}
        onToggle={() => toggle('treasures')}
      >
        {treasures.length === 0 ? (
          <Empty text="尚无珍稀之物" />
        ) : (
          treasures.map((item: any, i) => (
            <div
              key={i}
              className="rounded-md border p-2 text-xs"
              style={{
                borderColor: `${RARITY_COLORS[item.rarity]}40`,
                background: `${RARITY_COLORS[item.rarity]}08`,
              }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-serif-cn font-semibold" style={{ color: RARITY_COLORS[item.rarity] }}>
                  {item.name}
                </span>
                <span className="text-[9px] px-1 rounded" style={{
                  background: `${RARITY_COLORS[item.rarity]}20`,
                  color: RARITY_COLORS[item.rarity],
                }}>
                  {RARITY_LABEL[item.rarity]}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{item.description}</p>
              {item.source && (
                <div className="text-[9px] text-muted-foreground/70 mt-1">来源：{item.source}</div>
              )}
            </div>
          ))
        )}
      </MilestoneSection>

      {/* 殊途状态 */}
      <MilestoneSection
        icon={<Star className="w-4 h-4" />}
        title="殊途·命格"
        count={majorStatuses.length}
        color="#a855f7"
        open={openMap.statuses}
        onToggle={() => toggle('statuses')}
      >
        {majorStatuses.length === 0 ? (
          <Empty text="尚无殊途命格" />
        ) : (
          majorStatuses.map((s: any, i) => (
            <div
              key={i}
              className="rounded-md border p-2 text-xs"
              style={{
                borderColor: `${RARITY_COLORS[s.rarity]}40`,
                background: `${RARITY_COLORS[s.rarity]}08`,
              }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-serif-cn font-semibold" style={{ color: RARITY_COLORS[s.rarity] }}>
                  {s.name}
                </span>
                <span className="text-[9px] px-1 rounded" style={{
                  background: `${RARITY_COLORS[s.rarity]}20`,
                  color: RARITY_COLORS[s.rarity],
                }}>
                  {RARITY_LABEL[s.rarity]}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{s.description}</p>
              {s.source && (
                <div className="text-[9px] text-muted-foreground/70 mt-1">来源：{s.source}</div>
              )}
            </div>
          ))
        )}
      </MilestoneSection>

      {/* 终焉 */}
      {endEvent && (
        <MilestoneSection
          icon={endEvent.eventType === 'ascension' ? <Crown className="w-4 h-4" /> : <Skull className="w-4 h-4" />}
          title={endEvent.eventType === 'ascension' ? '飞升仙界' : '陨落'}
          count={1}
          color={endEvent.eventType === 'ascension' ? '#fbbf24' : '#7f1d1d'}
          open={openMap.end}
          onToggle={() => toggle('end')}
        >
          <MilestoneItem
            age={endEvent.age}
            title={endEvent.title}
            narrative={endEvent.narrative}
            color={endEvent.eventType === 'ascension' ? '#fbbf24' : '#7f1d1d'}
            tag={endEvent.eventType === 'ascension' ? '飞升' : '终焉'}
          />
        </MilestoneSection>
      )}

      {/* 空状态 */}
      {totalMilestones === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="font-serif-cn">史册待书</p>
          <p className="mt-1 text-xs">修真之路开启后，关键节点将记载于此</p>
        </div>
      )}
    </div>
  );
}

function MilestoneSection({
  icon, title, count, color, open, onToggle, children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <Card className="paper-texture overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader
            className="pb-2 cursor-pointer hover:bg-secondary/30 transition-colors"
            style={{ borderBottom: open ? `1px solid ${color}30` : undefined }}
          >
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span style={{ color }}>{icon}</span>
                <span className="font-serif-cn">{title}</span>
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="text-[10px] tabular-nums"
                  style={count > 0 ? { background: `${color}20`, color } : undefined}
                >
                  {count}
                </Badge>
                <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-3 space-y-2">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function MilestoneItem({
  age, title, narrative, color, tag, effects,
}: {
  age: number;
  title: string;
  narrative: string;
  color: string;
  tag: string;
  effects?: any[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded-md border p-2 cursor-pointer hover:bg-secondary/20 transition-colors min-w-0"
      style={{ borderColor: `${color}30`, background: `${color}05` }}
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-center justify-between mb-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-bold font-serif-cn" style={{ color }}>
            {age}岁
          </span>
          <span
            className="text-[9px] px-1 py-0.5 rounded"
            style={{ background: `${color}20`, color }}
          >
            {tag}
          </span>
        </div>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </div>
      <div className="text-xs font-semibold font-serif-cn mb-1 xianxia-readable">{title}</div>
      {expanded ? (
        <>
          <p className="text-[11px] leading-relaxed text-foreground/90 xianxia-prose">{narrative}</p>
          {effects && effects.filter(isVisibleNumericEventEffect).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {effects.filter(isVisibleNumericEventEffect).map((eff: any, i: number) => (
                <span
                  key={i}
                  className={cn(
                    "text-[9px] px-1 py-0.5 rounded border xianxia-chip",
                    eventEffectTone(eff) === 'positive'
                      ? "bg-green-500/10 text-green-700 border-green-500/30"
                      : eventEffectTone(eff) === 'negative'
                      ? "bg-red-500/10 text-red-700 border-red-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {formatEventEffectLabel(eff)}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-[10px] text-muted-foreground line-clamp-1 xianxia-readable">{narrative}</p>
      )}
    </div>
  );
}

function ChoiceMilestoneItem({ choice }: { choice: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded-md border p-2 cursor-pointer hover:bg-secondary/20 transition-colors min-w-0"
      style={{ borderColor: '#c8453c30', background: '#c8453c05' }}
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-center justify-between mb-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-bold font-serif-cn text-primary">{choice.age}岁</span>
          <span className="text-[9px] px-1 py-0.5 rounded bg-primary/20 text-primary">抉择</span>
        </div>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </div>
      {expanded ? (
        <>
          <p className="text-[11px] text-muted-foreground mb-1 italic xianxia-readable">{choice.prompt}</p>
          <div className="text-xs font-semibold font-serif-cn mb-1 text-primary xianxia-readable">
            → {choice.chosenText}
          </div>
          <p className="text-[11px] leading-relaxed text-foreground/90 xianxia-prose">{choice.result}</p>
        </>
      ) : (
        <>
          <div className="text-xs font-semibold font-serif-cn text-primary truncate min-w-0">
            → {choice.chosenText}
          </div>
          <p className="text-[10px] text-muted-foreground line-clamp-1 xianxia-readable">{choice.result}</p>
        </>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground text-center py-3">{text}</p>;
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
