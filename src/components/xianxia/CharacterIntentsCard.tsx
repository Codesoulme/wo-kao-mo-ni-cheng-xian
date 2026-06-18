'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Compass } from 'lucide-react';
import { cn } from '@/lib/utils';

// 优先级 1-10 的颜色映射
function priorityStyle(p: number): { color: string; bg: string; border: string } {
  if (p >= 9) return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/40' };
  if (p >= 7) return { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/40' };
  if (p >= 4) return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/40' };
  return { color: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-muted-foreground/30' };
}

// 意图类型 → 中文标签
const INTENT_LABEL: Record<string, string> = {
  prepare_combat: '备战',
  gather_resources: '聚资',
  seek_mentor: '访师',
  avoid_danger: '避险',
  resolve_thread: '了事',
  cultivate_diligently: '勤修',
  explore_opportunity: '探机',
  socialize: '结缘',
  trade: '交易',
  breakthrough: '冲境',
};

export function CharacterIntentsCard() {
  const { character } = useGameStore();
  if (!character) return null;
  const intents: any[] = character.characterIntents || [];

  // 按优先级降序
  const sorted = [...intents].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return (
    <Card className="paper-texture">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />
            <span className="font-serif-cn">心之所向</span>
          </span>
          {intents.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {intents.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-1.5">
        {intents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3 font-serif-cn">
            心如止水，顺其自然。
          </p>
        ) : (
          sorted.map((it, i) => {
            const p = it.priority || 1;
            const ps = priorityStyle(p);
            return (
              <div
                key={it.id || i}
                className="flex items-start gap-2 p-1.5 rounded-md hover:bg-accent/5 transition-colors"
              >
                {/* 优先级数字徽标 */}
                <span className={cn(
                  "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border",
                  ps.bg, ps.color, ps.border
                )}>
                  {p}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold font-serif-cn text-foreground truncate">
                      {it.title || '无名之意'}
                    </span>
                    {it.type && INTENT_LABEL[it.type] && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
                        {INTENT_LABEL[it.type]}
                      </span>
                    )}
                  </div>
                  {it.description && (
                    <p className="text-[10px] text-muted-foreground font-serif-cn leading-relaxed line-clamp-2 mt-0.5">
                      {it.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
