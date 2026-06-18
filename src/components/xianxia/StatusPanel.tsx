'use client';

import { useState } from 'react';
import { CharacterState } from '@/lib/xianxia/store';
import { RealmOrb } from './RealmOrb';
import { CharacterDetailSheet } from './CharacterDetailSheet';
import { Heart, Sparkles, MapPin, ChevronRight, Sword, Shield, Zap, Clover, Brain, Leaf, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface StatusPanelProps {
  character: CharacterState;
  compact?: boolean;
}

export function StatusPanel({ character }: StatusPanelProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const lifespanLeft = character.lifespan - character.age;
  const lifePct = character.lifespan > 0
    ? Math.max(0, Math.min(100, (character.age / character.lifespan) * 100))
    : 0;
  const expPct = character.expToBreak > 0
    ? Math.max(0, Math.min(100, (character.cultivationExp / character.expToBreak) * 100))
    : 0;
  const genderLabel = character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : character.gender || '未知';
  const quickStats = [
    { label: '攻', value: character.attack, icon: <Sword className="w-2.5 h-2.5" />, color: '#c8453c' },
    { label: '防', value: character.defense, icon: <Shield className="w-2.5 h-2.5" />, color: '#2e5c8a' },
    { label: '速', value: character.speed, icon: <Zap className="w-2.5 h-2.5" />, color: '#d4af37' },
    { label: '运', value: character.luck, icon: <Clover className="w-2.5 h-2.5" />, color: '#22c55e' },
    { label: '悟', value: character.comprehension, icon: <Brain className="w-2.5 h-2.5" />, color: '#a855f7' },
  ];
  const topStatuses = (character.activeStatuses || [])
    .filter((s: any) => s && s.name && s.category !== 'identity' && s.category !== 'quest')
    .slice(0, 4);

  return (
    <>
      <div className="paper-texture rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {/* 顶部角色信息 - 可点击展开详情 */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setDetailOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDetailOpen(true);
            }
          }}
          className="w-full text-left relative px-3 py-2.5 bg-gradient-to-r from-secondary/40 to-transparent hover:from-secondary/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            {/* 境界球（可点击） */}
            <div className="shrink-0 relative">
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
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center">
                <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
              </div>
            </div>

            {/* 名字 + 核心信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-serif-cn text-base font-bold truncate">{character.name}</h2>
                <span className="seal text-[9px]">道</span>
                {character.ascended && (
                  <span className="text-[9px] px-1 rounded bg-yellow-400/20 text-yellow-600">飞升</span>
                )}
                {!character.alive && (
                  <span className="text-[9px] px-1 rounded bg-destructive/20 text-destructive">陨落</span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span style={{ color: character.realmColor }} className="font-semibold">
                  {character.realmName}{character.realmMaxLevel > 0 ? ` ${character.realmLevel + 1}层` : ''}
                </span>
                <span className="opacity-50">·</span>
                <span>{genderLabel}</span>
                <span className="opacity-50">·</span>
                <span>{character.age}岁</span>
                <span className="opacity-50">·</span>
                <span className="flex items-center gap-0.5 truncate max-w-[100px]">
                  <MapPin className="w-2.5 h-2.5" />
                  {character.location}
                </span>
              </div>

              {topStatuses.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {topStatuses.map((s: any, idx: number) => {
                    const negative = s.category === 'debuff' || /伤|毒|虚|痛|劫|魔|损|衰/.test(s.name);
                    const color = negative ? '#c8453c' : '#2f8f5b';
                    return (
                      <Popover key={s.id || `${s.name}-${idx}`}>
                        <PopoverTrigger asChild>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-serif-cn shadow-sm cursor-pointer hover:scale-[1.02] transition-transform"
                            style={{ borderColor: `${color}40`, background: `${color}10`, color }}
                          >
                            {negative ? <AlertTriangle className="w-2.5 h-2.5" /> : <Leaf className="w-2.5 h-2.5" />}
                            <span className="max-w-[72px] truncate">{s.name}</span>
                            {s.duration && s.duration !== -1 && <span className="opacity-70">{s.duration}岁</span>}
                          </span>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          side="bottom"
                          className="w-64 p-3 paper-texture border-primary/20 shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-2 font-serif-cn">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-bold" style={{ color }}>{s.name}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {statusCategoryLabel(s.category)}
                                  <span className="mx-1 opacity-50">·</span>
                                  {s.duration === -1 ? '长驻' : s.duration ? `余 ${s.duration} 岁` : '短暂'}
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
                              <p className="text-[11px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
                                {s.description}
                              </p>
                            )}
                            {s.source && (
                              <div className="text-[10px] text-muted-foreground">
                                来源：{s.source}
                              </div>
                            )}
                            {Array.isArray(s.effects) && s.effects.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                                {s.effects.slice(0, 4).map((eff: any, k: number) => (
                                  <span key={k} className="rounded bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
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
                  {(character.activeStatuses || []).length > topStatuses.length && (
                    <span className="text-[9px] text-muted-foreground px-1 py-0.5">+{(character.activeStatuses || []).length - topStatuses.length}</span>
                  )}
                </div>
              )}

              <div className="mt-1.5 grid grid-cols-5 gap-1">
                {quickStats.map(stat => (
                  <div
                    key={stat.label}
                    className="rounded-md border border-border/50 bg-background/45 px-1.5 py-1 text-center shadow-sm"
                    title={`${stat.label}：${stat.value}`}
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

              {/* 寿元 + 修为 双进度条（紧凑） */}
              <div className="mt-1.5 space-y-1">
                <MiniBar
                  icon={<Heart className="w-2.5 h-2.5" />}
                  color="#c8453c"
                  pct={lifePct}
                  label={`寿余 ${lifespanLeft} 年`}
                />
                <MiniBar
                  icon={<Sparkles className="w-2.5 h-2.5" />}
                  color={character.realmColor}
                  pct={expPct}
                  label={`${character.cultivationExp}/${character.expToBreak}`}
                />
              </div>
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
