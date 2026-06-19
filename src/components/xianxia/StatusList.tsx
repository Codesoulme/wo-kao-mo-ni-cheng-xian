'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PendingThreadsCard } from '@/components/xianxia/PendingThreadsCard';
import { CharacterIntentsCard } from '@/components/xianxia/CharacterIntentsCard';
import { HeartDemonCard } from '@/components/xianxia/HeartDemonCard';
import { CultivationSpeedCard } from '@/components/xianxia/CultivationSpeedCard';
import { filterMeaningfulStatuses } from '@/lib/xianxia/engine';

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#d4af37',
  mythic: '#ec4899',
};

const RARITY_LABEL: Record<string, string> = {
  common: '凡品', uncommon: '良品', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话',
};

const CATEGORY_LABEL: Record<string, string> = {
  attribute: '属性', skill: '技能', buff: '增益', debuff: '减益',
  special: '特殊', identity: '身份', quest: '任务', environment: '环境',
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  weapon: '兵器', armor: '防具', accessory: '饰物', artifact: '法宝',
  consumable: '丹药', material: '材料', tool: '器具', scripture: '功法',
};

export function StatusList() {
  const { character } = useGameStore();
  const [open, setOpen] = useState(true);

  if (!character) return null;

  const visibleStatuses = filterMeaningfulStatuses(character.activeStatuses || [])
    .map((s: any, idx: number) => ({ ...s, __idx: idx }))
    .sort((a: any, b: any) => (b.__idx ?? 0) - (a.__idx ?? 0));
  const coreStatuses = visibleStatuses.filter(s => classifyStatus(s) === 'core');
  const buffStatuses = visibleStatuses.filter(s => classifyStatus(s) === 'buff');
  const debuffStatuses = visibleStatuses.filter(s => classifyStatus(s) === 'debuff');

  return (
    <div className="space-y-3">
      <CultivationSpeedCard />

      {/* 状态 */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <Card className="paper-texture">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" />
                  状态
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {visibleStatuses.length}
                  </Badge>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3 max-h-[60vh] overflow-y-auto xianxia-scroll">
              {visibleStatuses.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">尚无状态</p>
              ) : (
                <>
                  {coreStatuses.length > 0 && (
                    <StatusGroup title="身份·仙缘" items={coreStatuses} />
                  )}
                  {buffStatuses.length > 0 && (
                    <StatusGroup title="增益" items={buffStatuses} />
                  )}
                  {debuffStatuses.length > 0 && (
                    <StatusGroup title="减益" items={debuffStatuses} />
                  )}
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 未决线索：紧贴状态之后，方便查看当前牵挂与约期 */}
      <PendingThreadsCard />

      {/* 心之所向——角色主动意图 */}
      <CharacterIntentsCard />

      {/* Task 22: 心魔值卡片 */}
      <HeartDemonCard />

      <p className="text-[10px] text-muted-foreground text-center pt-1">
        装备与储物袋请查看「宝」页
      </p>
    </div>
  );
}


function classifyStatus(status: any): 'core' | 'buff' | 'debuff' {
  const text = `${status?.name || ''}${status?.description || ''}${status?.source || ''}`;
  const effects = Array.isArray(status?.effects) ? status.effects : [];
  const hasNegative = status?.category === 'debuff' || /毒|伤|虚弱|侵扰|反噬|诅咒|减|损|不利/.test(text)
    || effects.some((e: any) => Number(e?.value ?? e?.delta ?? 0) < 0 || /降低|减少|削弱|受损|伤|毒|虚弱|不利|减/.test(`${e?.description || ''}${e?.attribute || ''}`));
  if (hasNegative) return 'debuff';

  const isFateLike = status?.category === 'identity' || status?.category === 'special' || status?.category === 'quest'
    || /仙缘|机缘|因缘|秘境|传承|线索|潮|禁|门径|识门|悟息|玉片|残简|楼心|雾楼/.test(text);
  const hasPositive = status?.category === 'buff' || status?.category === 'attribute'
    || effects.some((e: any) => Number(e?.value ?? e?.delta ?? 0) > 0 || /提升|增加|增强|恢复|护持|加|微增/.test(`${e?.description || ''}${e?.attribute || ''}`));

  if (isFateLike && status?.category !== 'buff' && !(status?.category === 'attribute' && hasPositive)) return 'core';
  if (status?.category === 'skill' && !effects.length) return 'core';
  if (hasPositive || status?.category === 'skill') return 'buff';
  return 'core';
}

function displayCategoryLabel(status: any): string {
  if (classifyStatus(status) === 'core' && status?.category !== 'identity') return '仙缘';
  if (classifyStatus(status) === 'buff') return '增益';
  if (classifyStatus(status) === 'debuff') return '减益';
  return CATEGORY_LABEL[status?.category] || status?.category || '状态';
}

function effectTone(status: any, effect: any) {
  const text = `${effect?.description || ''}${effect?.attribute || ''}`;
  const value = Number(effect?.value ?? effect?.delta ?? 0);
  const isDebuff = status?.category === 'debuff' || status?.category === 'environment' || /降低|减少|削弱|受损|伤|毒|虚弱|不利|减/.test(text);
  const isBuff = status?.category === 'buff' || status?.category === 'attribute' || status?.category === 'skill' || /提升|增加|增强|恢复|护持|加/.test(text);
  if (isDebuff || value < 0) return 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400';
  if (isBuff || value > 0) return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  return 'border-muted bg-muted/60 text-muted-foreground';
}

function StatusGroup({ title, items }: { title: string; items: any[] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? items : items.slice(0, 3);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 px-1">
        <span>{title}</span>
        <span>{showAll ? items.length : visibleItems.length}/{items.length}</span>
      </div>
      <div className="space-y-1.5">
        {visibleItems.map((s, i) => (
          <div
            key={i}
            className="rounded-md border p-2 text-xs"
            style={{
              borderColor: `${RARITY_COLORS[s.rarity] || '#6b7280'}40`,
              background: `${RARITY_COLORS[s.rarity] || '#6b7280'}08`,
            }}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-semibold font-serif-cn" style={{ color: RARITY_COLORS[s.rarity] }}>
                {s.name}
              </span>
              <div className="flex items-center gap-1">
                {s.duration === -1 ? (
                  <span className="text-[9px] text-muted-foreground">永久</span>
                ) : (
                  <span className="text-[9px] text-muted-foreground">{s.duration}年</span>
                )}
                <span className="text-[9px] px-1 rounded bg-muted">
                  {displayCategoryLabel(s)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{s.description}</p>
            {s.effects && s.effects.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {s.effects.map((e: any, j: number) => (
                  <span key={j} className={cn("text-[9px] px-1 py-0.5 rounded border", effectTone(s, e))}>
                    {e.description}
                  </span>
                ))}
              </div>
            )}
            {s.source && (
              <div className="text-[9px] text-muted-foreground/70 mt-1">来源：{s.source}</div>
            )}
          </div>
        ))}
        {items.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className="w-full rounded-md border border-dashed border-border/70 px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1"
          >
            <ChevronDown className={cn("w-3 h-3 transition-transform", showAll && "rotate-180")} />
            {showAll ? '收起' : `展开其余 ${hiddenCount} 个`}
          </button>
        )}
      </div>
    </div>
  );
}
