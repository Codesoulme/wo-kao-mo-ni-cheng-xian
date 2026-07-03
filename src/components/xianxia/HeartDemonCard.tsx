'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent } from '@/components/ui/card';
import { Flame } from 'lucide-react';
import type { HeartDemonProjection, HeartDemonTier } from '@/lib/xianxia/types';

// Task 22: 心魔值卡片——参考《凡人修仙传》走火入魔设定
// 心魔值 0-100，分级/色调/惩罚一律由引擎 heartDemonProjection 裁决，UI 只投影，避免多处硬编阈值分叉
// 分级：0-20 心境澄明 / 21-50 道心无损 / 51-80 心魔初现 / 81-100 心魔缠身
// 注意：Tailwind JIT 不能解析动态 class 名，颜色一律用 inline style

// 旧存档兜底：字段缺失时本地重算一次（阈值与惩罚保持与 engine/heart-demon.ts deriveHeartDemonProjection 一致）
function fallbackProjection(hd: number): HeartDemonProjection {
  const v = Math.max(0, Math.min(100, hd));
  let tier: HeartDemonTier = 'calm';
  let tierLabel = '心境澄明';
  let tierIcon = '🍃';
  let tierColor = '#65a30d';
  let tierBorderOpacity = 0.30;
  let tierBgOpacity = 0.06;
  let barGradient = 'linear-gradient(90deg, #84cc16, #65a30d)';
  if (v >= 81) {
    tier = 'demonic'; tierLabel = '心魔缠身'; tierIcon = '🔥';
    tierColor = '#dc2626'; tierBorderOpacity = 0.5; tierBgOpacity = 0.12;
    barGradient = 'linear-gradient(90deg, #ef4444, #b91c1c)';
  } else if (v >= 51) {
    tier = 'restless'; tierLabel = '心魔初现'; tierIcon = '👹';
    tierColor = '#ea580c'; tierBorderOpacity = 0.45; tierBgOpacity = 0.10;
    barGradient = 'linear-gradient(90deg, #f97316, #c2410c)';
  } else if (v >= 21) {
    tier = 'unsettled'; tierLabel = '道心无损'; tierIcon = '⚡';
    tierColor = '#d97706'; tierBorderOpacity = 0.40; tierBgOpacity = 0.08;
    barGradient = 'linear-gradient(90deg, #f59e0b, #b45309)';
  }
  const penalty = v >= 30 ? Math.min(0.7, Math.floor((v - 20) / 10) * 0.1) : 0;
  const penaltyPct = Math.round(penalty * 100);
  const penaltyText = penalty <= 0
    ? '心魔尚浅，修行未阻'
    : v >= 81 ? `修炼效率 -${penaltyPct}%，心魔真身将现`
    : v >= 51 ? `修炼效率 -${penaltyPct}%，可能触发心魔试炼`
    : `修炼效率 -${penaltyPct}%`;
  return { value: v, tier, tierLabel, tierIcon, tierColor, tierBorderOpacity, tierBgOpacity, barGradient, penalty, penaltyPct, penaltyText };
}

export function HeartDemonCard() {
  const { character } = useGameStore();
  if (!character) return null;
  const hd: number = (character as any).heartDemon ?? 0;
  const proj: HeartDemonProjection = (character as any).heartDemonProjection ?? fallbackProjection(hd);

  // 心魔为 0：折叠简短显示
  if (proj.value <= 0) {
    return (
      <Card className="paper-texture" style={{ borderColor: '#10b98140' }}>
        <CardContent className="p-3 flex items-center gap-2">
          <Flame className="w-4 h-4" style={{ color: '#059669' }} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-serif-cn" style={{ color: '#047857' }}>{proj.tierLabel}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">心魔 0/100</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const borderColor = `${proj.tierColor}${Math.round(proj.tierBorderOpacity * 255).toString(16).padStart(2, '0')}`;
  const bgColor = `${proj.tierColor}${Math.round(proj.tierBgOpacity * 255).toString(16).padStart(2, '0')}`;

  return (
    <Card className="paper-texture" style={{ borderColor }}>
      <CardContent className="p-3 space-y-2">
        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4" style={{ color: proj.tierColor }} />
            <span className="text-xs font-serif-cn" style={{ color: proj.tierColor }}>
              {proj.tierIcon} {proj.tierLabel}
            </span>
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            <span className="font-bold" style={{ color: proj.tierColor }}>{proj.value}</span>/100 · {proj.tierLabel}
          </span>
        </div>

        {/* 进度条 */}
        <div className="h-2 rounded-full bg-muted/50 overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${proj.value}%`, background: proj.barGradient }}
          />
          {/* 分级刻度标记（21/51/81 三条分隔线） */}
          <div className="absolute inset-0 flex items-center pointer-events-none">
            <div className="w-[21%] h-full border-r border-white/20" />
            <div className="w-[30%] h-full border-r border-white/20" />
            <div className="w-[30%] h-full border-r border-white/20" />
          </div>
        </div>

        {/* 当前惩罚提示 */}
        {proj.penalty > 0 ? (
          <div
            className="text-[10px] rounded px-2 py-1"
            style={{ background: bgColor, color: proj.tierColor }}
          >
            ⚠ {proj.penaltyText}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground/80 px-1">
            {proj.penaltyText}
          </div>
        )}

        {/* 分级说明（折叠在底部） */}
        <details className="text-[9px] text-muted-foreground/70">
          <summary className="cursor-pointer hover:text-muted-foreground transition-colors">心魔分级说明</summary>
          <div className="mt-1 space-y-0.5 pl-2">
            <div>🍃 0-20 心境澄明：无影响</div>
            <div>⚡ 21-50 道心无损：修炼 -10%~-30%</div>
            <div>👹 51-80 心魔初现：修炼 -40%~-60%，可能触发心魔试炼</div>
            <div>🔥 81-100 心魔缠身：每岁可能扣血，心魔真身将现</div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
