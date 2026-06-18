"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { useGameStore } from '@/lib/xianxia/store';

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#d4af37', mythic: '#ec4899',
};

export function CultivationSpeedCard() {
  const { character } = useGameStore();
  if (!character) return null;

  const totalMult = character.cultivationMultiplier ?? 0;
  const flatBonus = character.cultivationFlatBonus ?? 0;
  const factors: any[] = character.cultivationFactors || [];
  const insightText: string = character.cultivationInsight || '';
  const hasInsight = insightText.trim().length > 0;

  return (
    <Card className="paper-texture">
      <CardHeader className="pb-1.5 pt-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            修炼速度
          </span>
          <span className="text-base font-bold tabular-nums flex items-baseline gap-1">
            <span style={{ color: totalMult > 0 ? '#c8453c' : '#6b7280' }}>
              ×{totalMult.toFixed(2)}
            </span>
            {flatBonus > 0 && (
              <span className="text-xs" style={{ color: '#3b82f6' }}>
                +{flatBonus}/岁
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-1 space-y-2">
        {factors.length > 0 ? (
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground mb-1">来源 · 名称与加成</div>
            {factors.map((f, i) => {
              const color = RARITY_COLORS[f.rarity] || '#6b7280';
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md px-2 py-1 transition-colors hover:bg-muted/30"
                  style={{
                    background: `${color}08`,
                    borderLeft: `2px solid ${color}80`,
                  }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: color, boxShadow: `0 0 6px ${color}80` }}
                    />
                    <span
                      className="text-xs font-serif-cn font-medium truncate"
                      style={{ color }}
                      title={f.name}
                    >
                      {f.name}
                    </span>
                    {f.note && (
                      <span className="text-[9px] text-muted-foreground/80 truncate hidden sm:inline">
                        · {f.note}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-xs tabular-nums font-semibold shrink-0 ml-2 px-1.5 py-0.5 rounded"
                    style={{
                      background: f.operation === 'multiply' ? '#c8453c15' : '#3b82f615',
                      color: f.operation === 'multiply' ? '#c8453c' : '#3b82f6',
                    }}
                  >
                    {f.operation === 'multiply' ? '×' : '+'}{f.value}{f.operation === 'add' ? '/岁' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground/70 px-1 py-1">
            {totalMult > 0
              ? '无额外加成来源——修炼速度仅由灵根根基决定。'
              : '凡人之躯，无灵根可引天地灵气，修为难进。'}
          </div>
        )}

        {hasInsight && (
          <div
            className="rounded-md p-2.5 leading-relaxed text-[11px] font-serif-cn xianxia-scroll"
            style={{
              background: 'linear-gradient(135deg, rgba(200,69,60,0.04), rgba(60,80,90,0.04))',
              border: '1px solid rgba(200,69,60,0.12)',
              color: '#3a3530',
            }}
          >
            {insightText.split(/(?<=[。；])/).filter(s => s.trim()).map((seg, i) => (
              <p key={i} className="mb-0.5 last:mb-0">{seg.trim()}</p>
            ))}
          </div>
        )}

        <p className="text-[9px] text-muted-foreground/60 leading-relaxed pt-0.5">
          每岁修为 = 基础 × 倍率（×{totalMult.toFixed(2)}）{flatBonus > 0 ? ` + 额外修为（${flatBonus}/岁）` : ''}。来源依灵根、功法、奇缘实时归算。
        </p>
      </CardContent>
    </Card>
  );
}
