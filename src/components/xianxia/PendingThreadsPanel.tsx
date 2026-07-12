'use client';

import { useMemo } from 'react';

interface PendingThreadsPanelProps {
  character?: any;
}

type CategoryKey = 'enemy' | 'debt' | 'promise' | 'mystery' | 'other';

const CATEGORY_META: Record<CategoryKey, { label: string; icon: string; tone: string }> = {
  enemy: {
    label: '恩仇',
    icon: '⚔',
    tone: 'bg-red-950/30 border-red-900/50 text-red-100',
  },
  promise: {
    label: '誓约',
    icon: '🤝',
    tone: 'bg-teal-950/30 border-teal-900/50 text-teal-100',
  },
  mystery: {
    label: '谜事',
    icon: '🔮',
    tone: 'bg-violet-950/30 border-violet-900/50 text-violet-100',
  },
  debt: {
    label: '债缘',
    icon: '💰',
    tone: 'bg-amber-950/30 border-amber-900/50 text-amber-100',
  },
  other: {
    label: '旧事',
    icon: '◆',
    tone: 'bg-stone-900/30 border-stone-700/50 text-stone-200',
  },
};

function mapCategory(raw: any): CategoryKey {
  const c = String(raw || '').toLowerCase();
  if (c === 'enemy') return 'enemy';
  if (c === 'debt') return 'debt';
  if (c === 'promise') return 'promise';
  if (c === 'mystery') return 'mystery';
  return 'other';
}

function threadTitle(t: any): string {
  const raw = String(t?.title || '').trim();
  if (raw) return raw;
  const narrative = String(t?.narrative || t?.description || '').trim();
  if (!narrative) return '无名因缘';
  return narrative.length > 20 ? narrative.slice(0, 20) + '…' : narrative;
}

function isActive(t: any): boolean {
  const status = String(t?.status || '').toLowerCase();
  if (status === 'resolved' || status === 'failed' || status === 'completed') return false;
  if (t?.resolved === true || t?.completed === true) return false;
  return true;
}

function categoryCounts(threads: any[]): { key: CategoryKey; count: number }[] {
  const order: CategoryKey[] = ['enemy', 'promise', 'mystery', 'debt', 'other'];
  const map: Record<CategoryKey, number> = { enemy: 0, promise: 0, mystery: 0, debt: 0, other: 0 };
  for (const t of threads) map[mapCategory(t.category)] += 1;
  return order
    .map((key) => ({ key, count: map[key] }))
    .filter((x) => x.count > 0);
}

function sortByDeadline(a: any, b: any): number {
  const da = Number.isFinite(Number(a?.deadlineAge)) ? Number(a.deadlineAge) : Number.POSITIVE_INFINITY;
  const db = Number.isFinite(Number(b?.deadlineAge)) ? Number(b.deadlineAge) : Number.POSITIVE_INFINITY;
  if (da !== db) return da - db;
  const sa = Number(a?.startAge ?? a?.sourceAge ?? 0);
  const sb = Number(b?.startAge ?? b?.sourceAge ?? 0);
  return sb - sa;
}

function deadlineText(t: any, age: number): {
  text: string;
  emphasis: 'urgent' | 'soft' | 'muted';
} {
  const deadline = Number(t?.deadlineAge);
  if (Number.isFinite(deadline) && deadline > age) {
    const remaining = deadline - age;
    return {
      text: `预计 ${deadline} 岁前显应・余 ${remaining} 载`,
      emphasis: remaining <= 5 ? 'urgent' : 'soft',
    };
  }
  if (!Number.isFinite(deadline) || deadline <= 0) {
    return { text: '时机未定', emphasis: 'muted' };
  }
  return { text: '终生延续', emphasis: 'muted' };
}

export function PendingThreadsPanel({ character }: PendingThreadsPanelProps) {
  const rawThreads: any[] = Array.isArray(character?.pendingThreads) ? character.pendingThreads : [];
  const age = Number(character?.age) || 0;

  const activeThreads = useMemo(() => {
    return rawThreads.filter(isActive).slice().sort(sortByDeadline);
  }, [rawThreads]);

  const counts = useMemo(() => categoryCounts(activeThreads), [activeThreads]);

  if (activeThreads.length === 0) {
    return (
      <div
        className="text-[11px] text-muted-foreground italic font-serif-cn text-center py-6 animate-in fade-in duration-300"
        data-testid="pending-threads-empty"
      >
        命途澄澈，尚无未了因缘。
      </div>
    );
  }

  return (
    <div
      className="space-y-2 animate-in fade-in duration-300"
      data-testid="pending-threads-panel"
    >
      {/* 顶部统计条 */}
      <div className="paper-texture rounded-md border border-stone-300/60 dark:border-stone-700/50 px-3 py-2 flex items-baseline gap-3">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-2xl font-bold font-serif-cn text-primary leading-none"
            data-testid="pending-threads-total"
          >
            {activeThreads.length}
          </span>
          <span className="text-[10px] text-muted-foreground font-serif-cn">
            缕未了因缘
          </span>
        </div>
        {counts.length > 0 && (
          <div className="text-[10px] text-muted-foreground font-serif-cn flex flex-wrap gap-x-1.5 gap-y-0.5">
            {counts.map((c, idx) => (
              <span key={c.key} className="inline-flex items-baseline gap-0.5">
                <span className="text-foreground/80 font-semibold">{c.count}</span>
                <span>桩</span>
                <span>{CATEGORY_META[c.key].label}</span>
                {idx < counts.length - 1 && (
                  <span className="opacity-40 pl-0.5">・</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 伏笔列表 */}
      <div className="space-y-1.5">
        {activeThreads.map((t, i) => {
          const catKey = mapCategory(t.category);
          const meta = CATEGORY_META[catKey];
          const dl = deadlineText(t, age);
          const startAge = Number(t?.startAge ?? t?.sourceAge);
          return (
            <div
              key={t.id || `${catKey}-${i}`}
              className={`paper-texture rounded-md border px-2.5 py-1.5 ${meta.tone}`}
              data-testid={`pending-thread-${catKey}`}
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="shrink-0 text-base leading-tight mt-0.5" aria-hidden="true">
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 min-w-0">
                    <div className="text-[11px] font-bold font-serif-cn truncate">
                      {threadTitle(t)}
                    </div>
                    {Number.isFinite(startAge) && startAge > 0 && (
                      <div className="shrink-0 text-[9px] opacity-70 font-serif-cn">
                        第 {startAge} 岁埋下
                      </div>
                    )}
                  </div>
                  <div
                    className={
                      'mt-0.5 text-[10px] font-serif-cn ' +
                      (dl.emphasis === 'urgent'
                        ? 'text-orange-300'
                        : dl.emphasis === 'soft'
                        ? 'text-amber-200/80'
                        : 'text-muted-foreground')
                    }
                  >
                    {dl.text}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { PendingThreadsPanelProps };
