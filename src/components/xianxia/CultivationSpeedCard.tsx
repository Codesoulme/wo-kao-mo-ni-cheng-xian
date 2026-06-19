"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, Zap } from 'lucide-react';
import { useGameStore } from '@/lib/xianxia/store';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#d4af37', mythic: '#ec4899',
};

export function CultivationSpeedCard() {
  const { character } = useGameStore();
  const [showAllSources, setShowAllSources] = useState(false);
  if (!character) return null;

  const totalMult = character.cultivationMultiplier ?? 0;
  const flatBonus = character.cultivationFlatBonus ?? 0;
  const factors: any[] = buildVisibleCultivationFactors(character);
  const groupedSources = groupCultivationFactors(factors);
  const visibleSources = showAllSources ? groupedSources : groupedSources.slice(0, 3);
  const hiddenSourceCount = Math.max(0, groupedSources.length - visibleSources.length);
  const insightText: string = character.cultivationInsight || '';
  const hasInsight = insightText.trim().length > 0;
  const canExpandDetails = groupedSources.length > 0 || hasInsight;

  return (
    <Card className="paper-texture">
      <CardHeader className="pb-1.5 pt-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            修炼速度
          </span>
          <span className="text-base font-bold tabular-nums flex items-baseline gap-1">
            <span style={{ color: multiplierTone(totalMult).color }}>
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
        {groupedSources.length > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>来源 · 名称与加成</span>
              {groupedSources.length > 3 && !showAllSources && (
                <span>已列 {visibleSources.length}/{groupedSources.length}</span>
              )}
            </div>
            {visibleSources.map((source) => {
              const color = source.rarity ? (RARITY_COLORS[source.rarity] || '#6b7280') : '#6b7280';
              return (
                <div
                  key={source.key}
                  className="rounded-md px-2 py-1.5 transition-colors hover:bg-muted/30"
                  style={{
                    background: `${color}08`,
                    borderLeft: `2px solid ${color}80`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: color, boxShadow: `0 0 6px ${color}80` }}
                      />
                      <span
                        className="text-xs font-serif-cn font-medium truncate"
                        style={{ color }}
                        title={source.name}
                      >
                        {source.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1 shrink-0 max-w-[46%]">
                      {source.effects.map((eff) => (
                        <span
                          key={`${eff.operation}-${eff.value}-${eff.note || ''}`}
                          className="text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded"
                          style={effectPillStyle(eff)}
                        >
                          {formatGroupedEffect(eff)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {source.notes.length > 0 && (
                    <div className="mt-0.5 pl-3 text-[9px] text-muted-foreground/80 truncate">
                      {source.notes.join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
            {canExpandDetails && (
              <button
                type="button"
                onClick={() => setShowAllSources(v => !v)}
                className="w-full mt-1 rounded-md border border-dashed border-border/70 px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1"
              >
                <ChevronDown className={cn("w-3 h-3 transition-transform", showAllSources && "rotate-180")} />
                {showAllSources
                  ? '收起详解'
                  : hiddenSourceCount > 0
                    ? `展开其余 ${hiddenSourceCount} 个来源与详解`
                    : '展开修炼详解'}
              </button>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground/70 px-1 py-1">
            {totalMult > 0
              ? '无额外加成来源——修炼速度仅由灵根根基决定。'
              : '凡人之躯，无灵根可引天地灵气，修为难进。'}
          </div>
        )}

        {showAllSources && (
          <div className="space-y-2">
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
          </div>
        )}
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


type GroupedCultivationSource = {
  key: string;
  name: string;
  rarity?: string;
  effects: { operation: 'multiply' | 'add'; value: number; note?: string }[];
  notes: string[];
};

function groupCultivationFactors(factors: any[]): GroupedCultivationSource[] {
  const groups: GroupedCultivationSource[] = [];
  const byName = new Map<string, GroupedCultivationSource>();

  for (const f of factors) {
    if (!f?.name) continue;
    const key = f.name;
    let group = byName.get(key);
    if (!group) {
      group = { key, name: f.name, rarity: f.rarity, effects: [], notes: [] };
      byName.set(key, group);
      groups.push(group);
    }
    const value = Number(f.value);
    if ((f.operation === 'multiply' || f.operation === 'add') && Number.isFinite(value)) {
      const exists = group.effects.some(e => e.operation === f.operation && e.value === value);
      if (!exists) group.effects.push({ operation: f.operation, value, note: f.note });
    }
    if (f.note && !group.notes.includes(f.note)) group.notes.push(f.note);
    if (!group.rarity && f.rarity) group.rarity = f.rarity;
  }

  for (const group of groups) {
    group.effects.sort((a, b) => {
      if (a.operation !== b.operation) return a.operation === 'multiply' ? -1 : 1;
      return b.value - a.value;
    });
  }

  return groups;
}

function formatGroupedEffect(eff: { operation: 'multiply' | 'add'; value: number }): string {
  return eff.operation === 'multiply' ? `速率 ×${eff.value}` : `每岁 +${eff.value}`;
}


function multiplierTone(value: number): { color: string; background: string } {
  if (value > 1) return { color: '#059669', background: '#10b98118' };
  if (value < 1) return { color: '#dc2626', background: '#ef444418' };
  return { color: '#6b7280', background: '#6b728018' };
}

function effectPillStyle(eff: { operation: 'multiply' | 'add'; value: number }): React.CSSProperties {
  if (eff.operation === 'multiply') {
    const tone = multiplierTone(eff.value);
    return { background: tone.background, color: tone.color };
  }
  return {
    background: eff.value >= 0 ? '#3b82f615' : '#ef444418',
    color: eff.value >= 0 ? '#3b82f6' : '#dc2626',
  };
}
