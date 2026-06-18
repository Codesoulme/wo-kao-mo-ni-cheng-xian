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

  const visibleStatuses = filterMeaningfulStatuses(character.activeStatuses || []);
  const coreStatuses = visibleStatuses.filter(s =>
    s.category === 'identity' || s.category === 'special'
  );
  const buffStatuses = visibleStatuses.filter(s =>
    s.category === 'buff' || s.category === 'attribute' || s.category === 'skill'
  );
  const debuffStatuses = visibleStatuses.filter(s =>
    s.category === 'debuff' || s.category === 'environment' || s.category === 'quest'
  );

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
                    <StatusGroup title="身份·命格" items={coreStatuses} />
                  )}
                  {buffStatuses.length > 0 && (
                    <StatusGroup title="增益·属性" items={buffStatuses} />
                  )}
                  {debuffStatuses.length > 0 && (
                    <StatusGroup title="减益·环境" items={debuffStatuses} />
                  )}
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 心之所向——角色主动意图 */}
      <CharacterIntentsCard />

      {/* Task 22: 心魔值卡片 */}
      <HeartDemonCard />

      {/* 未决线索 */}
      <PendingThreadsCard />

      <p className="text-[10px] text-muted-foreground text-center pt-1">
        装备与储物袋请查看「宝」页
      </p>
    </div>
  );
}

function StatusGroup({ title, items }: { title: string; items: any[] }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-1 px-1">{title}</div>
      <div className="space-y-1.5">
        {items.map((s, i) => (
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
                  {CATEGORY_LABEL[s.category] || s.category}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{s.description}</p>
            {s.effects && s.effects.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {s.effects.map((e: any, j: number) => (
                  <span key={j} className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">
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
      </div>
    </div>
  );
}
