'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { sanitizeClueText } from '@/lib/xianxia/display';
import { characterDisplayEntries, entriesForSlot } from '@/lib/xianxia/display-registry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ScrollText, Hourglass, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, type ReactNode } from 'react';

const STATUS_STYLE: Record<string, {
  color: string;
  bg: string;
  border: string;
  label: string;
  icon: ReactNode;
}> = {
  urgent: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    label: '将近',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  pending: {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    label: '待续',
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
    label: '缘断',
    icon: <XCircle className="w-3 h-3" />,
  },
};

export function PendingThreadsCard() {
  const { character } = useGameStore();
  const [showAll, setShowAll] = useState(false);
  const [expandedThreadIds, setExpandedThreadIds] = useState<Record<string, boolean>>({});
  if (!character) return null;

  const sourceThreads = Array.isArray(character.pendingThreads) && character.pendingThreads.length > 0
    ? character.pendingThreads
    : (character.questEntries || []).map(questEntryToThread);
  const threads: any[] = sortThreads(sourceThreads);
  const visibleThreads = showAll ? threads : threads.slice(0, 3);
  const hiddenCount = Math.max(0, threads.length - visibleThreads.length);
  // AI-47: threadPage slot 消费 — AI 创造的 attribute/status 标 threadPage 时也按"命格/仙缘"展示
  const allDisplayEntries = characterDisplayEntries(character);
  const threadPageEntries = entriesForSlot(allDisplayEntries, 'threadPage', 6);

  return (
    <Card className="paper-texture">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" />
            <span className="font-serif-cn">未了因缘</span>
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
            暂无线头牵身，且随岁月自流。
          </p>
        ) : (
          <>
            {visibleThreads.map((t, i) => {
              const style = STATUS_STYLE[t.status] || STATUS_STYLE.pending;
              const age = character.age || 0;
              const progress = Math.max(0, Math.min(100, t.progress || 0));
                const threadKey = String(t.id || `${t.title || 'thread'}-${i}`);
                const expanded = Boolean(expandedThreadIds[threadKey]);
                const description = sanitizeThreadText(t.description || '');
              return (
                <div
                  key={t.id || i}
                  className={cn(
                    'rounded-md border p-2 space-y-1.5 min-w-0',
                    style.bg,
                    style.border,
                  )}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn('shrink-0', style.color)}>{style.icon}</span>
                      <span className={cn('text-xs font-bold font-serif-cn truncate', style.color)}>
                        {displayThreadTitle(t)}
                      </span>
                    </div>
                    <span className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded shrink-0 font-semibold border',
                      style.bg,
                      style.color,
                      style.border,
                    )}>
                      {style.label}
                    </span>
                  </div>

                  {description && (
                    <div className="space-y-1">
                      <p className={cn(
                        "text-[11px] text-foreground/70 font-serif-cn leading-relaxed xianxia-readable",
                        !expanded && "line-clamp-2",
                      )}>
                        {description}
                      </p>
                      {description.length > 52 && (
                        <button
                          type="button"
                          onClick={() => setExpandedThreadIds(prev => ({ ...prev, [threadKey]: !expanded }))}
                          className="text-[10px] text-primary/80 hover:text-primary"
                        >
                          {expanded ? '\u6536\u8d77' : '\u5c55\u5f00\u5168\u6587'}
                        </button>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
                      <span>牵引</span>
                      <span>{progressLabel(progress)}</span>
                    </div>
                    <Progress
                      value={progress}
                      className="h-1.5 bg-muted/40 [&>div]:bg-primary"
                    />
                  </div>

                  <div className="text-[10px] text-muted-foreground font-serif-cn">
                    {threadTimeText(t, age)}
                  </div>

                  {(t.reward || t.failureCost) && (
                    <div className="flex flex-wrap gap-1 pt-0.5 min-w-0">
                      {t.reward && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/30 xianxia-chip">
                          得：{sanitizeThreadText(t.reward)}
                        </span>
                      )}
                      {t.failureCost && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 xianxia-chip">
                          失：{sanitizeThreadText(t.failureCost)}
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
                <ChevronDown className={cn('w-3 h-3 transition-transform', showAll && 'rotate-180')} />
                {showAll ? '收起因缘' : `展开其余 ${hiddenCount} 缕因缘`}
              </button>
            )}
            {threadPageEntries.length > 0 && (
              <div className="pt-2 border-t border-border/50 space-y-1" data-testid="thread-page-slot">
                <div className="text-[10px] text-muted-foreground font-serif-cn">命格印记</div>
                <div className="flex flex-wrap gap-1">
                  {threadPageEntries.map((entry) => (
                    <span
                      key={entry.id}
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-violet-50 text-violet-900 border-violet-300 font-serif-cn"
                      title={entry.description || entry.displayLabel}
                    >
                      {entry.shortLabel || entry.displayLabel}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function questEntryToThread(q: any): any {
  const statusMap: Record<string, string> = {
    open: 'pending',
    urgent: 'urgent',
    completed: 'resolved',
    failed: 'failed',
  };
  return {
    id: q.sourceThreadId || q.id,
    title: q.title,
    description: q.summary || q.currentHook,
    category: q.kind,
    status: statusMap[q.stage] || 'pending',
    progress: q.progress,
    startAge: q.startedAtAge,
    deadlineAge: q.dueAge,
    reward: q.rewardHint,
    failureCost: q.failureHint,
    followUpHint: q.currentHook,
    sourceEventTitle: q.sourceEventTitle,
    __urgency: q.urgency,
  };
}

function progressLabel(progress: number): string {
  if (progress >= 90) return '将成';
  if (progress >= 60) return '渐明';
  if (progress >= 25) return '已有眉目';
  if (progress > 0) return '初露';
  return '未显';
}

function threadTimeText(t: any, age: number): string {
  if (t.status === 'resolved') return '因果已圆';
  if (t.status === 'failed') return '缘机已散';
  if (!Number.isFinite(Number(t.deadlineAge))) return '暂随流年回响';
  const remaining = Number(t.deadlineAge) - age;
  if (remaining <= 0) return '约期已至';
  if (remaining === 1) return '只余一载转圜';
  return `尚余 ${remaining} 载转圜`;
}

function sanitizeThreadText(text: string): string {
  return String(text || '')
    .replace(/deadline/gi, '\u7ea6\u671f')
    .replace(/pending/gi, '\u5f85\u7eed')
    .replace(/quest/gi, '\u56e0\u7f18')
    .replace(/thread/gi, '\u7ebf\u5934')
    .replace(new RegExp('\\u6b64\\u524d\\u5929\\u9053\\u5e72\\u9884\\u4f7f([^\\uff1a:\\uff0c,\\u3002\\s]+)\\u7ecf\\u5386\\u4e86[\\uff1a:\\uff0c,\\u3002\\s]*', 'g'), '$1\u66fe\u7ecf')
    .replace(new RegExp('\\u5929\\u9053\\u5e72\\u9884\\u4f7f([^\\uff1a:\\uff0c,\\u3002\\s]+)\\u7ecf\\u5386\\u4e86[\\uff1a:\\uff0c,\\u3002\\s]*', 'g'), '$1\u66fe\u7ecf')
    .replace(new RegExp('\\u6b64\\u524d\\u5929\\u9053\\u5e72\\u9884', 'g'), '\u6b64\u524d')
    .replace(new RegExp('\\u524d\\u5929\\u9053\\u5e72\\u9884', 'g'), '\u6b64\u524d')
    .replace(new RegExp('\\u5929\\u9053\\u5e72\\u9884', 'g'), '\u56e0\u7f18\u7275\u52a8')
    .replace(/[。，]?(后续流年|来年岁月)?需承接此因果[，,]?不可无故转向[。]?/g, '')
    .replace(/前事余波在这一日重新牵动[。]?/g, '')
    .replace(/使这段因果没有半途断线[。]?/g, '')
    .replace(new RegExp('\\u89d2\\u8272\\u5e94\\u4e3b\\u52a8', 'g'), '\u5fc3\u4e2d\u5df2\u6709\u5ff5\u5934\uff0c\u6b32')
    .replace(new RegExp('\\u4e0d\\u80fd\\u88ab\\u540e\\u7eed\\u6d41\\u5e74\\u9057\\u5fd8', 'g'), '\u4ecd\u4e0d\u53ef\u8f7b\u653e')
    .replace(new RegExp('\\u540e\\u7eed\\u6d41\\u5e74', 'g'), '\u6765\u5e74\u5c81\u6708')
    // AI-20: 委托给 display.ts 统一 sanitize
    .replace(/^.*$/s, (m) => sanitizeClueText(m))
    .trim();
}

function displayThreadTitle(t: any): string {
  const rawTitle = sanitizeThreadText(t.title || '');
  const text = sanitizeThreadText(`${t.description || ''} ${t.followUpHint || ''} ${t.sourceEventTitle || ''}`);
  const bloodScripture = new RegExp('\\u6b8b\\u7f3a\\u8840\\u715e\\u8bc0|\\u8840\\u715e\\u8bc0');
  const badTitle = new RegExp('\\u4f59\\u6ce2|\\u7528.*\\u8840\\u715e\\u8bc0');
  if (bloodScripture.test(text) && badTitle.test(rawTitle)) {
    const repairHint = new RegExp('\\u6574\\u7406|\\u4e92\\u8865|\\u4fee\\u8865|\\u5408\\u5377|\\u8865\\u5168|\\u6b8b\\u53e5|\\u4e24\\u672c|\\u4e24\\u5377');
    if (repairHint.test(text)) return '\u6574\u7406\u6b8b\u7f3a\u8840\u715e\u8bc0';
    return '\u4fee\u8865\u8840\u715e\u8bc0';
  }
  return rawTitle.replace(new RegExp('^\\u7528(.{2,18})\\u4f59\\u6ce2$'), '$1\u540e\u7eed') || '\u65e0\u540d\u56e0\u7f18';
}

function sortThreads(threads: any[]): any[] {
  const order: Record<string, number> = { urgent: 0, pending: 0, resolved: 1, failed: 2 };
  return [...threads]
    .map((t, idx) => ({ ...t, __idx: idx }))
    .sort((a, b) => {
      const oa = order[a.status] ?? 0;
      const ob = order[b.status] ?? 0;
      if (oa !== ob) return oa - ob;
      const ua = Number(a.__urgency || 0);
      const ub = Number(b.__urgency || 0);
      if (ua !== ub) return ub - ua;
      return (b.__idx ?? 0) - (a.__idx ?? 0);
    });
}