'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent } from '@/components/ui/card';
import { Flame } from 'lucide-react';

// Task 22: 心魔值卡片——参考《凡人修仙传》走火入魔设定
// 心魔值 0-100，分级显示：
//   0-29 道心澄明（emerald）/ 30-59 心魔初起（amber）/ 60-89 心魔炽盛（orange）/ 90-100 走火入魔（red）
// 注意：Tailwind JIT 不能解析动态 class 名（如 text-${tier.text}），所有颜色用 inline style

interface Tier {
  label: string;
  icon: string;
  color: string;       // 主色 hex
  borderOpacity: number; // 0-1
  bgOpacity: number;
}

function getTier(hd: number): Tier {
  if (hd >= 90) return { label: '走火入魔', icon: '🔥', color: '#dc2626', borderOpacity: 0.5, bgOpacity: 0.12 };
  if (hd >= 60) return { label: '心魔炽盛', icon: '👹', color: '#ea580c', borderOpacity: 0.45, bgOpacity: 0.10 };
  if (hd >= 30) return { label: '心魔初起', icon: '⚡', color: '#d97706', borderOpacity: 0.40, bgOpacity: 0.08 };
  return { label: '道心微动', icon: '🍃', color: '#65a30d', borderOpacity: 0.30, bgOpacity: 0.06 };
}

export function HeartDemonCard() {
  const { character } = useGameStore();
  if (!character) return null;
  const hd: number = (character as any).heartDemon ?? 0;

  // 心魔为 0：折叠简短显示
  if (hd <= 0) {
    return (
      <Card className="paper-texture" style={{ borderColor: '#10b98140' }}>
        <CardContent className="p-3 flex items-center gap-2">
          <Flame className="w-4 h-4" style={{ color: '#059669' }} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-serif-cn" style={{ color: '#047857' }}>道心澄明</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">心魔 0/100</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tier = getTier(hd);
  // 修炼效率惩罚（与 engine.ts computeEffectiveCultivationRate 同口径）
  const penalty = hd >= 30 ? Math.min(0.7, Math.floor((hd - 20) / 10) * 0.1) : 0;
  const penaltyPct = Math.round(penalty * 100);

  // 进度条渐变
  const barGradient =
    hd >= 90 ? 'linear-gradient(90deg, #ef4444, #b91c1c)' :
    hd >= 60 ? 'linear-gradient(90deg, #f97316, #c2410c)' :
    hd >= 30 ? 'linear-gradient(90deg, #f59e0b, #b45309)' :
    'linear-gradient(90deg, #84cc16, #65a30d)';

  const borderColor = `${tier.color}${Math.round(tier.borderOpacity * 255).toString(16).padStart(2, '0')}`;
  const bgColor = `${tier.color}${Math.round(tier.bgOpacity * 255).toString(16).padStart(2, '0')}`;

  return (
    <Card className="paper-texture" style={{ borderColor }}>
      <CardContent className="p-3 space-y-2">
        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4" style={{ color: tier.color }} />
            <span className="text-xs font-serif-cn" style={{ color: tier.color }}>
              {tier.icon} {tier.label}
            </span>
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            心魔 <span className="font-bold" style={{ color: tier.color }}>{hd}</span>/100
          </span>
        </div>

        {/* 进度条 */}
        <div className="h-2 rounded-full bg-muted/50 overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${hd}%`, background: barGradient }}
          />
          {/* 分级刻度标记（30/60/90 三条分隔线） */}
          <div className="absolute inset-0 flex items-center pointer-events-none">
            <div className="w-[30%] h-full border-r border-white/20" />
            <div className="w-[30%] h-full border-r border-white/20" />
            <div className="w-[30%] h-full border-r border-white/20" />
          </div>
        </div>

        {/* 当前惩罚提示 */}
        {penalty > 0 ? (
          <div
            className="text-[10px] rounded px-2 py-1"
            style={{ background: bgColor, color: tier.color }}
          >
            ⚠ 修炼效率 -{penaltyPct}%{hd >= 60 ? '，可能触发心魔试炼' : ''}{hd >= 90 ? '，走火入魔风险极高' : ''}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground/80 px-1">
            心魔尚浅，无碍修行
          </div>
        )}

        {/* 分级说明（折叠在底部） */}
        <details className="text-[9px] text-muted-foreground/70">
          <summary className="cursor-pointer hover:text-muted-foreground transition-colors">心魔分级说明</summary>
          <div className="mt-1 space-y-0.5 pl-2">
            <div>🍃 0-29 道心澄明：无影响</div>
            <div>⚡ 30-59 心魔初起：修炼 -10%~-30%</div>
            <div>👹 60-89 心魔炽盛：修炼 -40%~-60%，可能触发心魔试炼</div>
            <div>🔥 90-100 走火入魔：每岁可能扣血，心魔真身将现</div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
