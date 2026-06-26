'use client';

import { useState } from 'react';
import { CharacterState } from '@/lib/xianxia/store';
import { filterMeaningfulStatuses, isConstitutionStatus } from '@/lib/xianxia/engine';
import { REALM_SECTION_LABELS, IDENTITY_SECTION_LABELS, isRealmAttribute, isIdentityAttribute } from '@/lib/xianxia/display';
import { RealmOrb } from './RealmOrb';
import { CharacterDetailSheet } from './CharacterDetailSheet';
import { Heart, Sparkles, MapPin, ChevronRight, ChevronDown, Sword, Shield, Zap, Clover, Brain, Coins, Sprout } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface StatusPanelProps {
  character: CharacterState;
  compact?: boolean;
}

const RARITY_ORDER: Record<string, number> = {
  mythic: 6,
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
};

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280',
  uncommon: '#2f8f5b',
  rare: '#2e5c8a',
  epic: '#7c3aed',
  legendary: '#c47f2c',
  mythic: '#c8453c',
};

export function StatusPanel({ character }: StatusPanelProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [expandedVitals, setExpandedVitals] = useState(false);
  const lifespanLeft = character.lifespan - character.age;
  const hpPct = character.maxHp > 0
    ? Math.max(0, Math.min(100, (character.hp / character.maxHp) * 100))
    : 0;
  const mpPct = character.maxMp > 0
    ? Math.max(0, Math.min(100, (character.mp / character.maxMp) * 100))
    : 0;
  const expPct = character.expToBreak > 0
    ? Math.max(0, Math.min(100, (character.cultivationExp / character.expToBreak) * 100))
    : 0;
  const genderLabel = character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : character.gender || '未知';
  const rootLabel = character.rootDetail || character.spiritualRoot || '无灵根';
  const combatProjection = (character as any).combatProjection || {};
  const coreCultivationStats = [
    { label: '\u795e\u8bc6', value: (character as any).spiritualSense ?? 0, icon: <Brain className="w-2.5 h-2.5" />, color: '#7c3aed' },
    { label: '\u9b42\u9b44', value: (character as any).soulStrength ?? 0, icon: <Sparkles className="w-2.5 h-2.5" />, color: '#9333ea' },
    { label: '\u4f53\u9b44', value: (character as any).physicalFoundation ?? 0, icon: <Shield className="w-2.5 h-2.5" />, color: '#0f766e' },
  ];
  const quickStats = [
    { label: '\u7834\u52bf', value: combatProjection.force ?? character.attack, icon: <Sword className="w-2.5 h-2.5" />, color: '#c8453c' },
    { label: '\u62a4\u6301', value: combatProjection.guard ?? character.defense, icon: <Shield className="w-2.5 h-2.5" />, color: '#2e5c8a' },
    { label: '\u673a\u53d8', value: combatProjection.agility ?? character.speed, icon: <Zap className="w-2.5 h-2.5" />, color: '#d4af37' },
    { label: '\u8fd0', value: character.luck, icon: <Clover className="w-2.5 h-2.5" />, color: '#22c55e' },
    { label: '\u609f', value: character.comprehension, icon: <Brain className="w-2.5 h-2.5" />, color: '#a855f7' },
  ];
  const meaningfulStatuses = filterMeaningfulStatuses(character.activeStatuses || []);
  const constitutionStatuses = meaningfulStatuses
    .filter(isConstitutionStatus)
    .sort((a: any, b: any) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));
  const topConstitutions = constitutionStatuses.slice(0, 2);
  const constitutionExtraCount = Math.max(0, constitutionStatuses.length - topConstitutions.length);
  const visibleStatuses = meaningfulStatuses.filter(status => !isConstitutionStatus(status));
  const topStatuses = visibleStatuses
    .map((s: any, __idx: number) => ({ ...s, __idx }))
    .filter((s: any) => s && s.name && s.category !== 'identity' && s.category !== 'quest')
    .sort((a: any, b: any) => b.__idx - a.__idx)
    .slice(0, 3);
  const coreCultivationAttributeIds = new Set(['spiritualSense', 'soulStrength', 'physicalFoundation']);
  const coreCultivationAttributeNames = new Set(['\u795e\u8bc6', '\u9b42\u9b44', '\u4f53\u9b44']);
  const dynamicAttributes = (character.cultivationAttributes || [])
    .filter((attr: any) => attr && attr.visible !== false && attr.name)
    .filter((attr: any) => !coreCultivationAttributeIds.has(attr.id) && !coreCultivationAttributeNames.has(attr.name))
    .slice(0, 3);

  return (
    <>
      <div className="paper-texture rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="relative px-3 py-2.5 bg-gradient-to-r from-secondary/40 to-transparent">
          <div className="flex items-start gap-3">
            {/* 头像：只有这里进入详情，避免点顶部空白误触 */}
            <div className="shrink-0 flex flex-col items-center gap-2.5">
              <button
                type="button"
                aria-label="查看角色详情"
                onClick={() => setDetailOpen(true)}
                className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 transition-transform active:scale-95"
              >
                <RealmOrb
                  realmColor={character.realmColor}
                  realmName={character.realmName}
                  realmLevel={character.realmLevel}
                  realmMaxLevel={character.realmMaxLevel}
                  cultivationExp={character.cultivationExp}
                  expToBreak={character.expToBreak}
                  size="sm"
                  showLabel={false}
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
                  <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
                </div>
              </button>
              <span className="inline-flex items-center justify-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-600 tabular-nums max-w-[60px] translate-y-0.5">
                <Coins className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{character.spiritStones}</span>
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <h2 className="font-serif-cn text-base font-bold truncate shrink min-w-[3rem]">{character.name}</h2>
                    <span className="seal text-[9px] shrink-0">修</span>
                    <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-700 dark:text-emerald-400 min-w-0 max-w-[92px] shrink">
                      <Sprout className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{rootLabel}</span>
                    </span>
                    {topConstitutions.map((s: any, idx: number) => {
                      const color = RARITY_COLORS[s.rarity] || '#6b7280';
                      return (
                        <Popover key={s.id || `${s.name}-${idx}`}>
                          <PopoverTrigger asChild>
                            <span
                              role="button"
                              tabIndex={0}
                              className="inline-flex max-w-[82px] shrink items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-serif-cn cursor-pointer min-w-0"
                              style={{ borderColor: `${color}40`, background: `${color}10`, color }}
                              title={s.description || s.name}
                            >
                              <span className="truncate">{s.name}</span>
                            </span>
                          </PopoverTrigger>
                          <PopoverContent align="start" side="bottom" className="w-64 p-3 paper-texture border-primary/20 shadow-xl">
                            <div className="space-y-1.5 font-serif-cn">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-bold" style={{ color }}>{s.name}</div>
                                {s.constitution && <span className="text-[10px] text-muted-foreground shrink-0">{s.constitution.currentStage || 1}/{s.constitution.maxStage || 1}阶</span>}
                              </div>
                              {s.description && <p className="text-[11px] leading-relaxed text-foreground/85 xianxia-prose">{s.description}</p>}
                              {s.source && <div className="text-[10px] text-muted-foreground xianxia-readable">来源：{s.source}</div>}
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                    {constitutionExtraCount > 0 && (
                      <span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground tabular-nums">
                        +{constitutionExtraCount}
                      </span>
                    )}
                    {character.ascended && (
                      <span className="text-[9px] px-1 rounded bg-yellow-400/20 text-yellow-600">飞升</span>
                    )}
                    {!character.alive && (
                      <span className="text-[9px] px-1 rounded bg-destructive/20 text-destructive">陨落</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1 flex-wrap text-[10px] text-muted-foreground">
                    <span className="rounded bg-muted/60 px-1.5 py-0.5 shrink-0">{genderLabel}</span>
                    <span className="rounded bg-muted/60 px-1.5 py-0.5 shrink-0">{character.age}岁</span>
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700/90 shrink-0">寿余 {lifespanLeft} 岁</span>
                    <span className="flex items-center gap-0.5 rounded bg-muted/50 px-1.5 py-0.5 min-w-0 max-w-[112px]">
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{character.location}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* AI-22: 身份（宗门/师承/声望/灵石）独立分组，与境界分离 */}
              <div className="mt-1.5 flex items-center gap-1 flex-wrap text-[10px] text-muted-foreground" data-section="identity">
                <span className="text-[9px] px-1 py-0.5 rounded bg-sky-500/10 text-sky-700/90 shrink-0">
                  {IDENTITY_SECTION_LABELS.faction}：{character.faction || '散修'}
                </span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-muted/60 shrink-0">
                  {IDENTITY_SECTION_LABELS.master}：{character.master || '无'}
                </span>
                {character.reputation !== undefined && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-700/90 shrink-0">
                    {IDENTITY_SECTION_LABELS.reputation}：{character.reputation}
                  </span>
                )}
                {character.spiritStones !== undefined && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-700/90 shrink-0">
                    {IDENTITY_SECTION_LABELS.spiritStones}：{character.spiritStones}
                  </span>
                )}
              </div>

              {/* 境界与修为同区展示 */}
              <div className="mt-2 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5" data-section="realm">
                <div className="flex items-center gap-2 text-[10px]">
                  <span
                    style={{ color: character.realmColor }}
                    className="font-semibold font-serif-cn truncate max-w-[118px]"
                  >
                    {character.realmName}{character.realmMaxLevel > 0 ? ` ${character.realmLevel + 1}层` : ''}
                  </span>
                  <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden min-w-[56px]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${expPct}%`,
                        background: `linear-gradient(to right, ${character.realmColor}99, ${character.realmColor})`,
                        boxShadow: `0 0 5px ${character.realmColor}66`,
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground tabular-nums shrink-0 text-[9px]">
                    {character.cultivationExp}/{character.expToBreak}
                  </span>
                </div>
              </div>


              {topStatuses.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 min-w-0 overflow-hidden">
                  <div className="grid grid-cols-3 gap-1 min-w-0 flex-1 overflow-hidden">
                    {topStatuses.map((s: any, idx: number) => {
                    const negative = s.category === 'debuff' || /伤|毒|虚|痛|劫|魔|损|衰/.test(s.name);
                    const color = negative ? '#c8453c' : '#2f8f5b';
                    return (
                      <Popover key={s.id || `${s.name}-${idx}`}>
                        <PopoverTrigger asChild>
                          <span
                            role="button"
                            tabIndex={0}
                            className="inline-flex items-center justify-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-serif-cn shadow-sm cursor-pointer hover:scale-[1.02] transition-transform min-w-0 max-w-full"
                            style={{ borderColor: `${color}40`, background: `${color}10`, color }}
                          >
                            <span className="truncate">{s.name}</span>
                            {s.duration && s.duration !== -1 && <span className="opacity-70 shrink-0">{s.duration}岁</span>}
                          </span>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          side="bottom"
                          className="w-64 p-3 paper-texture border-primary/20 shadow-xl"
                        >
                          <div className="space-y-2 font-serif-cn">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-bold" style={{ color }}>{s.name}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {statusCategoryLabel(s.category)}
                                  <span className="mx-1 opacity-50">·</span>
                                  {s.duration === -1 ? '长驻' : s.duration ? `余${s.duration}岁` : '短暂'}
                                </div>
                              </div>
                              <span
                                className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9px]"
                                style={{ borderColor: `${color}40`, background: `${color}10`, color }}
                              >
                                {negative ? '负面' : '增益'}
                              </span>
                            </div>
                            {s.description && (
                              <p className="text-[11px] leading-relaxed text-foreground/85 xianxia-prose">
                                {s.description}
                              </p>
                            )}
                            {s.source && (
                              <div className="text-[10px] text-muted-foreground xianxia-readable">
                                来源：{s.source}
                              </div>
                            )}
                            {Array.isArray(s.effects) && s.effects.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                                {s.effects.slice(0, 4).map((eff: any, k: number) => (
                                  <span key={k} className="rounded bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground xianxia-chip">
                                    {eff.description || '状态影响'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                  </div>
                  {visibleStatuses.length > topStatuses.length && (
                    <span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground tabular-nums">
                      +{visibleStatuses.length - topStatuses.length}
                    </span>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setExpandedVitals(v => !v)}
                className="mt-1.5 w-full inline-flex items-center justify-center gap-1 rounded-lg border border-border/50 bg-background/45 px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/60 transition-colors"
                aria-expanded={expandedVitals}
              >
                {expandedVitals ? '收起' : '展开'}
                <ChevronDown className={`w-3 h-3 transition-transform ${expandedVitals ? 'rotate-180' : ''}`} />
              </button>

              {expandedVitals && (
                <div className="mt-2 space-y-1.5 border-t border-border/40 pt-2 animate-in fade-in duration-150">
                  <div className="grid grid-cols-3 gap-1">
                    {coreCultivationStats.map(stat => (
                      <div
                        key={stat.label}
                        className="rounded-md border border-primary/20 bg-primary/5 px-1.5 py-1 text-center shadow-sm"
                        title={`${stat.label}?${stat.value}`}
                      >
                        <div className="flex items-center justify-center gap-0.5 text-[9px] text-muted-foreground">
                          <span style={{ color: stat.color }}>{stat.icon}</span>
                          {stat.label}
                        </div>
                        <div className="text-[11px] leading-none mt-0.5 font-semibold tabular-nums" style={{ color: stat.color }}>
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-5 gap-1">
                    {quickStats.map(stat => (
                      <div
                        key={stat.label}
                        className="rounded-md border border-border/50 bg-background/45 px-1.5 py-1 text-center shadow-sm"
                        title={`${stat.label}?${stat.value}`}
                      >
                        <div className="flex items-center justify-center gap-0.5 text-[9px] text-muted-foreground">
                          <span style={{ color: stat.color }}>{stat.icon}</span>
                          {stat.label}
                        </div>
                        <div className="text-[11px] leading-none mt-0.5 font-semibold tabular-nums" style={{ color: stat.color }}>
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {dynamicAttributes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {dynamicAttributes.map((attr: any, idx: number) => (
                        <span
                          key={attr.id || `${attr.name}-${idx}`}
                          className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary shadow-sm"
                          title={`${attr.name}：${attr.description || attr.value || ''}`}
                        >
                          <Sparkles className="h-2.5 w-2.5 shrink-0" />
                          <span className="max-w-[88px] truncate font-serif-cn">{attr.name}</span>
                          {attr.value !== undefined && attr.value !== '' && (
                            <span className="shrink-0 opacity-75">{attr.value}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    <MiniBar
                      icon={<Heart className="w-2.5 h-2.5" />}
                      color="#c8453c"
                      pct={hpPct}
                      label={`${character.hp}/${character.maxHp}`}
                    />
                    <MiniBar
                      icon={<Sparkles className="w-2.5 h-2.5" />}
                      color="#2e8f8a"
                      pct={mpPct}
                      label={`${character.mp}/${character.maxMp}`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 详情抽屉 */}
      <CharacterDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        character={character}
      />
    </>
  );
}


function statusCategoryLabel(category?: string): string {
  switch (category) {
    case 'buff': return '增益';
    case 'debuff': return '负面';
    case 'special': return '奇遇';
    case 'attribute': return '资质';
    case 'skill': return '功法';
    case 'environment': return '环境';
    case 'identity': return '身份';
    case 'quest': return '线索';
    default: return '状态';
  }
}

function MiniBar({ icon, color, pct, label }: {
  icon: React.ReactNode; color: string; pct: number; label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color }}>{icon}</span>
      <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${color}aa, ${color})`,
            boxShadow: `0 0 4px ${color}66`,
          }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground w-[70px] text-right tabular-nums">{label}</span>
    </div>
  );
}
