'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { characterDisplayEntries, entriesForSlot } from '@/lib/xianxia/display-registry';
import { Globe, ScrollText, Crown, Mountain, Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface WorldLegacyPanelProps {
  className?: string;
  character?: any; // 可选外部传入；不传则从 store 读
  defaultCollapsed?: boolean; // AI-60: 默认折叠
  maxCollapsed?: number;       // AI-60: 折叠时显示上限
}

/**
 * AI-50: worldLegacy slot 消费
 * 展示"世界遗产"——AI 创造的、对世界/后世有持久影响的状态/印记（如：开宗祖师、封印守护者、天道印记等）。
 * 数据来源：display-registry.ts 的 worldLegacy slot。
 *
 * AI-60: 接入 GameLayout 折叠区（默认折叠 + 限 3 + 展开全部）
 */
export function WorldLegacyPanel({ className, character: externalCharacter, defaultCollapsed = true, maxCollapsed = 3 }: WorldLegacyPanelProps) {
  const { character: storeCharacter } = useGameStore();
  const character = externalCharacter || storeCharacter;
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  if (!character) return null;
  const allEntries = entriesForSlot(characterDisplayEntries(character), 'worldLegacy', 100);
  if (allEntries.length === 0) return null;
  const visibleEntries = expanded ? allEntries : allEntries.slice(0, maxCollapsed);
  const hiddenCount = Math.max(0, allEntries.length - visibleEntries.length);

  const toneIcon = (tone: string) => {
    switch (tone) {
      case 'rare': return <Crown className="w-3 h-3" />;
      case 'mystery': return <Sparkles className="w-3 h-3" />;
      case 'good': return <Mountain className="w-3 h-3" />;
      default: return <ScrollText className="w-3 h-3" />;
    }
  };
  const toneClass = (tone: string) => {
    switch (tone) {
      case 'rare': return 'bg-amber-50 text-amber-900 border-amber-300';
      case 'mystery': return 'bg-violet-50 text-violet-900 border-violet-300';
      case 'good': return 'bg-emerald-50 text-emerald-900 border-emerald-300';
      case 'bad':
      case 'danger': return 'bg-rose-50 text-rose-900 border-rose-300';
      default: return 'bg-stone-50 text-stone-800 border-stone-200';
    }
  };

  return (
    <Card className={cn('paper-texture', className)} data-testid="world-legacy-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span className="font-serif-cn">此身所遗于世</span>
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {allEntries.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1.5">
          {visibleEntries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                'flex items-start gap-2 rounded-md border px-2 py-1.5',
                toneClass(entry.tone),
              )}
            >
              <span className="shrink-0 mt-0.5">{toneIcon(entry.tone)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold font-serif-cn truncate">
                  {entry.displayLabel}
                </div>
                {(entry.description || entry.detail) && (
                  <div className="text-[10px] text-foreground/70 font-serif-cn leading-relaxed line-clamp-2 mt-0.5">
                    {entry.description || entry.detail}
                  </div>
                )}
                {entry.source && (
                  <div className="text-[9px] text-muted-foreground mt-0.5 italic font-serif-cn">
                    缘起：{entry.source}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            data-testid="world-legacy-toggle"
            className="w-full mt-2 rounded-md border border-dashed border-border/70 px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1"
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
            {expanded ? '收拢此身所遗' : `展开其余 ${hiddenCount} 项所遗`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
