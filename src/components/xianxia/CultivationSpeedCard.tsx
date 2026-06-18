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
  const factors: any[] = buildVisibleCultivationFactors(character);
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


const CULTIVATION_EFFECT_ALIASES = new Set(['cultivationExp', 'cultivation', 'cultivationRate', 'cultivationMultiplier', 'cultivation_speed', '修为', '修炼速度']);
const SCRIPTURE_NAME_RE = /诀|决|经|典|录|篇|章|解|式|术|功法|心法|秘籍|玉简|心得|真经|真解|引气|凝气|吐纳/;

function defaultScriptureMultiplier(rarity?: string): number {
  const multByRarity: Record<string, number> = {
    common: 1.3, uncommon: 1.7, rare: 2.5, epic: 3.5, legendary: 4.5, mythic: 5.5,
  };
  return multByRarity[rarity || ''] || 1.5;
}

function buildVisibleCultivationFactors(character: any): any[] {
  const factors = Array.isArray(character.cultivationFactors) ? [...character.cultivationFactors] : [];
  const seen = new Set(factors.map(f => `${f.name}|${f.operation}|${f.value}`));

  for (const it of character.equipped || []) {
    const effects = Array.isArray(it.effects) ? it.effects : [];
    const cultivationEffects = effects.filter((e: any) => CULTIVATION_EFFECT_ALIASES.has(e.target_attribute));
    for (const eff of cultivationEffects) {
      if (eff.operation !== 'multiply' && eff.operation !== 'add') continue;
      if (eff.operation === 'multiply' && !(eff.value > 0)) continue;
      if (eff.operation === 'add' && !eff.value) continue;
      const value = Number(eff.value);
      const key = `${it.name}|${eff.operation}|${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      factors.push({
        name: it.name,
        value,
        operation: eff.operation,
        rarity: it.rarity,
        note: eff.operation === 'multiply' ? '功法加成' : '额外修为/岁',
      });
    }

    const looksLikeScripture = it.item_type === 'scripture' || SCRIPTURE_NAME_RE.test(`${it.name || ''}${it.description || ''}`);
    if (looksLikeScripture && !cultivationEffects.some((e: any) => e.operation === 'multiply')) {
      const value = defaultScriptureMultiplier(it.rarity);
      const key = `${it.name}|multiply|${value}`;
      if (!seen.has(key)) {
        seen.add(key);
        factors.push({ name: it.name, value, operation: 'multiply', rarity: it.rarity, note: '功法加成' });
      }
    }
  }

  return factors;
}
