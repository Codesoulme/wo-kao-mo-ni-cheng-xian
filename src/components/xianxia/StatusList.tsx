'use client';

import { useState } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PendingThreadsCard } from '@/components/xianxia/PendingThreadsCard';
import { CharacterIntentsCard } from '@/components/xianxia/CharacterIntentsCard';
import { HeartDemonCard } from '@/components/xianxia/HeartDemonCard';
import { CultivationSpeedCard } from '@/components/xianxia/CultivationSpeedCard';
import { characterDisplayEntries, entriesForSlot, groupDisplayEntries, type DisplayEntry } from '@/lib/xianxia/display-registry';
import { cn } from '@/lib/utils';

export function StatusList() {
  const { character } = useGameStore();
  const [open, setOpen] = useState(true);

  if (!character) return null;

  const displayEntries = characterDisplayEntries(character);
  const statusEntries = entriesForSlot(displayEntries, 'statusPage');
  const groupedStatusEntries = groupDisplayEntries(statusEntries);

  return (
    <div className="space-y-3">
      <CultivationSpeedCard />

      <Collapsible open={open} onOpenChange={setOpen}>
        <Card className="paper-texture">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" />
                  {'\u72b6\u6001'}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{statusEntries.length}</Badge>
                  <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3 max-h-[60vh] overflow-y-auto xianxia-scroll">
              {statusEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{'\u6682\u672a\u663e\u5316\u53ef\u89c1\u72b6\u6001'}</p>
              ) : (
                groupedStatusEntries.map(({ group, items }) => (
                  <DisplayEntryGroup key={group} title={group} items={items} />
                ))
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <PendingThreadsCard />
      <CharacterIntentsCard />
      <HeartDemonCard />

      <p className="text-[10px] text-muted-foreground text-center pt-1">
        {'\u88c5\u5907\u4e0e\u50a8\u7269\u888b\u8bf7\u67e5\u770b\u300c\u5b9d\u300d\u9875'}
      </p>
    </div>
  );
}

function toneClass(tone: DisplayEntry['tone']) {
  if (tone === 'rare') return 'border-purple-300/50 bg-purple-500/10 text-purple-900 dark:text-purple-100';
  if (tone === 'danger' || tone === 'bad') return 'border-red-300/50 bg-red-500/10 text-red-900 dark:text-red-100';
  if (tone === 'good') return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100';
  if (tone === 'mystery') return 'border-amber-300/50 bg-amber-500/10 text-amber-900 dark:text-amber-100';
  return 'border-border/60 bg-muted/40 text-foreground';
}

function DisplayEntryGroup({ title, items }: { title: string; items: DisplayEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? items : items.slice(0, 3);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);
  if (!items.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 px-1">
        <span>{title}</span>
        <span>{visibleItems.length}/{items.length}</span>
      </div>
      <div className="space-y-1.5">
        {visibleItems.map((entry) => (
          <div key={entry.id} className={cn('rounded-md border p-2 text-xs', toneClass(entry.tone))}>
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="font-semibold font-serif-cn truncate">{entry.displayLabel}</span>
              <span className="text-[10px] opacity-60 shrink-0">{entry.persistence === 'temporary' ? '\u6682' : '\u663e'}</span>
            </div>
            {entry.description && <p className="text-[11px] leading-relaxed opacity-80 line-clamp-2">{entry.description}</p>}
            {entry.source && <p className="mt-1 text-[10px] opacity-60 truncate">{entry.source}</p>}
          </div>
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className="w-full rounded-md border border-dashed border-border/70 px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1"
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', showAll && 'rotate-180')} />
            {showAll ? '\u6536\u8d77' : `\u5c55\u5f00\u5176\u4f59 ${hiddenCount} \u9879`}
          </button>
        )}
      </div>
    </div>
  );
}
