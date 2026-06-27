'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HEART_INTENT_LABEL } from '@/lib/xianxia/display';
import { ChevronDown, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// 心志优先级 1-10 颜色映射（沿用 CharacterIntentsCard 模式）
function priorityStyle(p: number): { color: string; bg: string; border: string } {
  if (p >= 9) return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/40' };
  if (p >= 7) return { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/40' };
  if (p >= 4) return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/40' };
  return { color: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-muted-foreground/30' };
}

interface HeartIntentPanelProps {
  className?: string;
  defaultCollapsed?: boolean; // 折叠态时默认收起
  maxCollapsed?: number;       // 折叠态显示条数
  onUpdate?: (id: string, payload: any) => void; // 可选: 外部回调
}

/**
 * AI-102: 心志/志向面板
 * 消费 character.heartIntent (主心志) + character.intents[] (副心志列表)
 * 调用 store.setCharacter 实现状态更新（边界：不动 store 核心 action）
 * 使用 display.ts 中的 HEART_INTENT_LABEL 做类型 → 中文映射
 */
export function HeartIntentPanel({
  className,
  defaultCollapsed = false,
  maxCollapsed = 3,
  onUpdate,
}: HeartIntentPanelProps) {
  const { character, setCharacter } = useGameStore();
  const [showAll, setShowAll] = useState(!defaultCollapsed);
  if (!character) return null;

  // 读取主心志 + 副心志列表（兼容字段命名）
  const heartIntent: any = (character as any).heartIntent || null;
  const intents: any[] = Array.isArray((character as any).intents)
    ? (character as any).intents
    : [];

  // 合并主心志到列表头部，构造统一渲染列表
  const merged: any[] = heartIntent
    ? [{ ...heartIntent, __primary: true }, ...intents]
    : [...intents];

  // 按优先级降序排序
  const sorted = [...merged]
    .map((it, idx) => ({ ...it, __idx: idx }))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.__idx || 0) - (a.__idx || 0));

  const visible = showAll ? sorted : sorted.slice(0, maxCollapsed);
  const hiddenCount = Math.max(0, sorted.length - visible.length);

  // 更新入口：默认走 setCharacter（边界内不动核心 action）
  const updateHeartIntent = (id: string, payload: any) => {
    if (onUpdate) {
      onUpdate(id, payload);
      return;
    }
    if (!character) return;
    const nextIntents = (Array.isArray((character as any).intents) ? (character as any).intents : []).map((it: any) =>
      it.id === id ? { ...it, ...payload } : it,
    );
    const next = { ...character };
    if (heartIntent && heartIntent.id === id) {
      (next as any).heartIntent = { ...heartIntent, ...payload };
    } else {
      (next as any).intents = nextIntents;
    }
    setCharacter(next as any);
  };

  return (
    <Card className={cn('paper-texture', className)} data-testid="heart-intent-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" />
            <span className="font-serif-cn">心之所向</span>
          </span>
          {sorted.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {sorted.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-1.5">
        {sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3 font-serif-cn">
            心如止水，随缘而行。
          </p>
        ) : (
          <>
            {visible.map((it, i) => {
              const p = Number(it.priority || 1);
              const ps = priorityStyle(p);
              const kind = String(it.type || it.kind || 'resolve');
              const label = HEART_INTENT_LABEL[kind] || HEART_INTENT_LABEL.resolve || '心志';
              return (
                <div
                  key={it.id || i}
                  className="flex items-start gap-2 p-1.5 rounded-md hover:bg-accent/5 transition-colors min-w-0"
                  data-testid="heart-intent-row"
                >
                  {/* 优先级数字徽章 */}
                  <span className={cn(
                    'shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border',
                    ps.bg, ps.color, ps.border,
                  )}>
                    {p}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold font-serif-cn text-foreground truncate">
                        {it.title || (it.__primary ? '主心志' : '心志')}
                      </span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
                        {label}
                      </span>
                      {it.__primary && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                          主
                        </span>
                      )}
                    </div>
                    {it.description && (
                      <p className="text-[10px] text-muted-foreground font-serif-cn leading-relaxed line-clamp-2 mt-0.5 xianxia-readable">
                        {sanitizeIntentDescription(it.description)}
                      </p>
                    )}
                    {/* 调整优先级交互（边界内：仅本地 state 演示） */}
                    <div className="mt-1 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateHeartIntent(String(it.id), { priority: Math.max(1, p - 1) })}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground"
                        data-testid="heart-intent-dec"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => updateHeartIntent(String(it.id), { priority: Math.min(10, p + 1) })}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground"
                        data-testid="heart-intent-inc"
                      >
                        ＋
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {sorted.length > maxCollapsed && (
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                className="w-full rounded-md border border-dashed border-border/70 px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1"
                data-testid="heart-intent-toggle"
              >
                <ChevronDown className={cn('w-3 h-3 transition-transform', showAll && 'rotate-180')} />
                {showAll ? '收起心志' : `展开其余 ${hiddenCount} 条心志`}
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
    .replace(/天道干预/g, '因缘牵动')
    .replace(/deadline/g, '期限')
    .replace(/\s+/g, ' ')
    .trim();
}