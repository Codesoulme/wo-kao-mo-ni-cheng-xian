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
import { filterMeaningfulStatuses, isConstitutionStatus } from '@/lib/xianxia/engine';

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
    .filter((s: any) => !isConstitutionStatus(s))
    .map((s: any, idx: number) => ({ ...s, __idx: idx }))
    .sort((a: any, b: any) => (b.__idx ?? 0) - (a.__idx ?? 0));
  const identityStatuses = visibleStatuses.filter(s => classifyStatus(s) === 'identity');
  const fateStatuses = visibleStatuses.filter(s => classifyStatus(s) === 'fate');
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
                  {identityStatuses.length > 0 && (
                    <StatusGroup title="??" items={identityStatuses} />
                  )}
                  {fateStatuses.length > 0 && (
                    <StatusGroup title="??" items={fateStatuses} />
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


function classifyStatus(status: any): 'identity' | 'fate' | 'buff' | 'debuff' {
  const text = `${status?.name || ''}${status?.description || ''}${status?.source || ''}`;
  const effects = Array.isArray(status?.effects) ? status.effects : [];
  const negativeText = new RegExp('\\u6bd2|\\u4f24|\\u865a\\u5f31|\\u4fb5\\u6270|\\u53cd\\u566c|\\u8bc5\\u5492|\\u51cf|\\u635f|\\u4e0d\\u5229');
  const negativeEffect = new RegExp('\\u964d\\u4f4e|\\u51cf\\u5c11|\\u524a\\u5f31|\\u53d7\\u635f|\\u4f24|\\u6bd2|\\u865a\\u5f31|\\u4e0d\\u5229|\\u51cf');
  const hasNegative = status?.category === 'debuff' || negativeText.test(text)
    || effects.some((e: any) => Number(e?.value ?? e?.delta ?? 0) < 0 || negativeEffect.test(`${e?.description || ''}${e?.attribute || ''}`));
  if (hasNegative) return 'debuff';

  if (status?.category === 'identity') return 'identity';
  const fateText = new RegExp('\\u4ed9\\u7f18|\\u673a\\u7f18|\\u56e0\\u7f18|\\u79d8\\u5883|\\u4f20\\u627f|\\u7ebf\\u7d22|\\u6f6e|\\u7981|\\u95e8\\u5f84|\\u8bc6\\u95e8|\\u609f\\u606f|\\u7389\\u7247|\\u6b8b\\u7b80|\\u697c\\u5fc3|\\u96fe\\u697c');
  const isFateLike = status?.category === 'special' || status?.category === 'quest' || fateText.test(text);
  const positiveEffect = new RegExp('\\u63d0\\u5347|\\u589e\\u52a0|\\u589e\\u5f3a|\\u6062\\u590d|\\u62a4\\u6301|\\u52a0|\\u5fae\\u589e');
  const hasPositive = status?.category === 'buff' || status?.category === 'attribute'
    || effects.some((e: any) => Number(e?.value ?? e?.delta ?? 0) > 0 || positiveEffect.test(`${e?.description || ''}${e?.attribute || ''}`));

  if (isFateLike && status?.category !== 'buff' && !(status?.category === 'attribute' && hasPositive)) return 'fate';
  if (status?.category === 'skill' && !effects.length) return 'fate';
  if (hasPositive || status?.category === 'skill') return 'buff';
  return 'fate';
}

function displayCategoryLabel(status: any): string {
  if (classifyStatus(status) === 'fate') return '??';
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
