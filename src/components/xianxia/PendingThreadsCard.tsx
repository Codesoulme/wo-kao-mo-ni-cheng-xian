'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ScrollText, Hourglass, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// 状态颜色映射：urgent 红 / pending 黄 / resolved 绿 / failed 灰
const STATUS_STYLE: Record<string, {
  color: string; bg: string; border: string; label: string; icon: React.ReactNode;
}> = {
  urgent: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    label: '紧迫',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  pending: {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    label: '待办',
    icon: <Hourglass className="w-3 h-3" />,
  },
  resolved: {
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/40',
    label: '已了',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    color: 'text-muted-foreground',
    bg: 'bg-muted/40',
    border: 'border-muted-foreground/30',
    label: '已失',
    icon: <XCircle className="w-3 h-3" />,
  },
};

export function PendingThreadsCard() {
  const { character } = useGameStore();
  const [showAll, setShowAll] = useState(false);
  if (!character) return null;
  const threads: any[] = sortThreads(character.pendingThreads || []);
  const visibleThreads = showAll ? threads : threads.slice(0, 3);
  const hiddenCount = Math.max(0, threads.length - visibleThreads.length);

  return (
    <Card className="paper-texture">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" />
            <span className="font-serif-cn">未决线索</span>
          </span>
          {threads.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {threads.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {threads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3 font-serif-cn">
            暂无未决之事，岁月静好。
          </p>
        ) : (
          <>
            {visibleThreads.map((t, i) => {
            const style = STATUS_STYLE[t.status] || STATUS_STYLE.pending;
            const age = character.age || 0;
            const remaining = (t.deadlineAge || 0) - age;
            const expired = remaining <= 0 && t.status === 'pending';
            const progress = Math.max(0, Math.min(100, t.progress || 0));
            return (
              <div
                key={t.id || i}
                className={cn(
                  "rounded-md border p-2 space-y-1.5 min-w-0",
                  style.bg, style.border
                )}
              >
                {/* 标题行 */}
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn("shrink-0", style.color)}>{style.icon}</span>
                    <span className={cn("text-xs font-bold font-serif-cn truncate", style.color)}>
                      {t.title || '无名线索'}
                    </span>
                  </div>
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded shrink-0 font-semibold",
                    style.bg, style.color, "border", style.border
                  )}>
                    {style.label}
                  </span>
                </div>

                {/* 描述 */}
                {t.description && (
                  <p className="text-[11px] text-foreground/70 font-serif-cn leading-relaxed line-clamp-2 xianxia-readable">
                    {t.description}
                  </p>
                )}

                {/* 进度条 */}
                <div>
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
                    <span>进度</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress
                    value={progress}
                    className="h-1.5 bg-muted/40 [&>div]:bg-primary"
                  />
                </div>

                {/* 截止信息 */}
                <div className="text-[10px] text-muted-foreground">
                  {t.status === 'resolved' ? (
                    <span className="text-green-600 dark:text-green-400">已圆满</span>
                  ) : t.status === 'failed' ? (
                    <span className="text-muted-foreground">已错过</span>
                  ) : expired ? (
                    <span className="text-red-600 dark:text-red-400 font-semibold">已过期</span>
                  ) : (
                    <span>
                      剩 <span className="text-foreground font-semibold">{remaining}</span> 岁
                    </span>
                  )}
                </div>

                {/* 奖励 / 失败代价 */}
                {(t.reward || t.failureCost) && (
                  <div className="flex flex-wrap gap-1 pt-0.5 min-w-0">
                    {t.reward && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/30 xianxia-chip">
                        酬：{t.reward}
                      </span>
                    )}
                    {t.failureCost && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 xianxia-chip">
                        失：{t.failureCost}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
            })}
            {threads.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                className="w-full rounded-md border border-dashed border-border/70 px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1"
              >
                <ChevronDown className={cn("w-3 h-3 transition-transform", showAll && "rotate-180")} />
                {showAll ? '收起线索' : `展开其余 ${hiddenCount} 条线索`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}


function sortThreads(threads: any[]): any[] {
  const order: Record<string, number> = { urgent: 0, pending: 0, resolved: 1, failed: 2 };
  return [...threads]
    .map((t, idx) => ({ ...t, __idx: idx }))
    .sort((a, b) => {
      const oa = order[a.status] ?? 0;
      const ob = order[b.status] ?? 0;
      if (oa !== ob) return oa - ob;
      return (b.__idx ?? 0) - (a.__idx ?? 0);
    });
}
