'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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
  const [showAll, setShowAll] = useState(false);
  if (!character) return null;
  const intents: any[] = character.characterIntents || [];

  // 按优先级降序；同优先级最近生成的在前
  const sorted = [...intents]
    .map((it, idx) => ({ ...it, __idx: idx }))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.__idx || 0) - (a.__idx || 0));
  const visibleIntents = showAll ? sorted : sorted.slice(0, 3);
  const hiddenCount = Math.max(0, sorted.length - visibleIntents.length);

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
          <>
            {visibleIntents.map((it, i) => {
            const p = it.priority || 1;
            const ps = priorityStyle(p);
            return (
              <IntentRow key={it.id || i} it={it} p={p} ps={ps} />
            );
            })}
            {sorted.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                className="w-full rounded-md border border-dashed border-border/70 px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1"
              >
                <ChevronDown className={cn("w-3 h-3 transition-transform", showAll && "rotate-180")} />
                {showAll ? '收起所向' : `展开其余 ${hiddenCount} 条所向`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}


function sanitizeIntentDescription(text: string): string {
  return String(text || '')
    .replace(/角色应主动/g, '心中已有念头，欲')
    .replace(/角色必须/g, '心知此事须')
    .replace(/不能被后续流年遗忘/g, '仍不可轻放')
    .replace(/不可无故略过/g, '不宜轻轻揭过')
    .replace(/不要让人际牵挂凭空消失/g, '旧缘不宜无声断去')
    .replace(/deadline 临近/g, '期限渐近')
    .replace(/若无武器应设法获取/g, '若兵器未备，须设法补足')
    .replace(/若修为不足应闭关苦修/g, '若修为不足，便该闭关磨砺')
    .replace(/说明暂时无法入内的原因/g, '另寻暂缓入内的缘由')
    .trim();
}
function IntentRow({ it, p, ps }: { it: any; p: number; ps: { color: string; bg: string; border: string } }) {
  const [expanded, setExpanded] = useState(false);
  const desc = it.description ? sanitizeIntentDescription(it.description) : '';
  const needExpand = desc.length > 40;
  return (
    <div
      className="flex items-start gap-2 p-1.5 rounded-md hover:bg-accent/5 transition-colors min-w-0"
    >
      {/* 优先级数字徽标 */}
      <span className={cn(
        "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border",
        ps.bg, ps.color, ps.border
      )}>
        {p}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
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
          <>
            <p className={cn(
              "text-[10px] text-muted-foreground font-serif-cn leading-relaxed mt-0.5 xianxia-readable",
              !expanded && 'line-clamp-2'
            )}>
              {desc}
            </p>
            {needExpand && (
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="text-[10px] text-primary/80 hover:text-primary mt-0.5"
              >
                {expanded ? '收起' : '展开全文'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
