'use client';

/**
 * 生成式 UI DEMO #4 —— 天道抉择卡（选项列表）
 *
 * ChoiceModal 内部把 pendingChoice.options.map 那块渲染换成此组件。
 * 每个选项：文字关键词 → emoji + 大字选项文字 + 小字 hint 描述。
 * 悬停/按压时边框加亮。多选项错开 120ms 依次入场。
 */

import { cn } from '@/lib/utils';

interface FateChoiceOption {
  text: string;
  hint?: string;
}

interface FateChoiceCardProps {
  options: FateChoiceOption[];
  onChooseIndex: (idx: number) => void;
  busy?: boolean;
}

// 关键词 → emoji 规则
function iconFor(text: string): string {
  const s = String(text || '');
  if (/上前|去|前|走/.test(s)) return '🚶';
  if (/避|躲|退/.test(s)) return '🌫';
  if (/打|斗|杀/.test(s)) return '⚔';
  if (/问|说|答/.test(s)) return '💬';
  if (/取|拿|收/.test(s)) return '✋';
  return '◇';
}

export function FateChoiceCard({ options, onChooseIndex, busy }: FateChoiceCardProps) {
  if (!Array.isArray(options) || options.length === 0) return null;

  return (
    <div data-testid="fate-choice-card" className="space-y-2 mt-3">
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={() => onChooseIndex(i)}
          disabled={busy}
          className={cn(
            'group w-full text-left p-3 rounded-lg border transition-all min-w-0',
            'border-border/60 bg-background/60',
            'hover:border-primary hover:bg-primary/5 hover:shadow-sm',
            'active:scale-[0.99]',
            'animate-in fade-in slide-in-from-bottom-1 duration-300',
            busy && 'opacity-50 cursor-not-allowed hover:border-border/60 hover:bg-background/60 hover:shadow-none',
          )}
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <div className="flex items-start gap-2.5">
            {/* 选项 emoji */}
            <span
              className={cn(
                'shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-lg border',
                'border-border/60 bg-background/80',
                'group-hover:border-primary/50 group-hover:bg-primary/10 transition-colors',
              )}
              aria-hidden
            >
              {iconFor(opt.text)}
            </span>

            {/* 选项文字 + hint */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold font-serif-cn xianxia-readable">
                {opt.text}
              </div>
              {opt.hint && (
                <div className="text-xs text-muted-foreground mt-0.5 xianxia-readable leading-relaxed">
                  {opt.hint}
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
