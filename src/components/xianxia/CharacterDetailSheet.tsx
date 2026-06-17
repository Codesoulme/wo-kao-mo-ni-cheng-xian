'use client';

import { CharacterState } from '@/lib/xianxia/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Heart, Sparkles, Sword, Shield, Zap, Clover, Brain, Coins, Star, MapPin, Users, GraduationCap } from 'lucide-react';
import { REALMS, ELEMENTS, SPIRITUAL_ROOTS } from '@/lib/xianxia/types';

interface CharacterDetailSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  character: CharacterState;
}

export function CharacterDetailSheet({ open, onOpenChange, character }: CharacterDetailSheetProps) {
  const realmInfo = REALMS.find(r => r.id === character.realm);
  const rootInfo = SPIRITUAL_ROOTS[character.spiritualRoot as keyof typeof SPIRITUAL_ROOTS];
  const lifespanLeft = character.lifespan - character.age;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto xianxia-scroll p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/40 bg-gradient-to-b from-secondary/40 to-transparent">
          <SheetTitle className="font-serif-cn flex items-center gap-2">
            <span className="seal">道</span>
            <span>{character.name}</span>
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {character.gender === 'male' ? '男' : '女'} · {character.age}岁
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 py-3 space-y-4">
          {/* 境界详情 */}
          <section>
            <SectionTitle icon={<Sparkles className="w-3.5 h-3.5" />} title="境界·修为" />
            <div
              className="rounded-lg border p-3 mt-1.5"
              style={{
                borderColor: `${character.realmColor}50`,
                background: `linear-gradient(135deg, ${character.realmColor}10, transparent)`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-serif-cn font-bold text-lg" style={{ color: character.realmColor }}>
                  {character.realmName}
                  {character.realmMaxLevel > 0 && (
                    <span className="text-xs ml-1 text-muted-foreground">
                      {character.realmLevel + 1} / {character.realmMaxLevel} 层
                    </span>
                  )}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                  background: `${character.realmColor}20`,
                  color: character.realmColor,
                }}>
                  寿元上限 {character.lifespan}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {realmInfo?.description}
              </p>
            </div>

            {/* 修为进度 */}
            <div className="mt-2 space-y-2">
              <ProgressBar
                label="修为进度"
                current={character.cultivationExp}
                max={character.expToBreak}
                color={character.realmColor}
                showText={`${character.cultivationExp} / ${character.expToBreak}`}
                icon={<Sparkles className="w-3 h-3" />}
              />
              <ProgressBar
                label="寿元"
                current={character.age}
                max={character.lifespan}
                color="#c8453c"
                showText={`${character.age} / ${character.lifespan}（余 ${lifespanLeft} 年）`}
                icon={<Heart className="w-3 h-3" />}
              />
            </div>
          </section>

          {/* 灵根 */}
          <section>
            <SectionTitle icon={<Star className="w-3.5 h-3.5" />} title="灵根·天赋" />
            <div className="rounded-lg border border-border/60 p-3 mt-1.5 bg-card/40">
              <div className="flex items-center justify-between mb-1">
                <span className="font-serif-cn font-semibold text-sm" style={{
                  color: character.rootMultiplier >= 1.5 ? '#c8453c' : character.rootMultiplier >= 0.8 ? '#2e5c8a' : undefined,
                }}>
                  {character.rootDetail}
                </span>
                {character.rootMultiplier > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    修炼 ×{character.rootMultiplier}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{rootInfo?.description}</p>
            </div>

            {/* 五行 */}
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {(['metal', 'wood', 'water', 'fire', 'earth'] as const).map(el => {
                const v = character.elements[el];
                return (
                  <div key={el} className="text-center">
                    <div className="text-[10px]" style={{ color: ELEMENTS[el].color }}>
                      {ELEMENTS[el].icon}{ELEMENTS[el].name}
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${v}%`, background: ELEMENTS[el].color }}
                      />
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">{v}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 气血灵力 */}
          <section>
            <SectionTitle icon={<Heart className="w-3.5 h-3.5" />} title="气血·灵力" />
            <div className="space-y-2 mt-1.5">
              <ProgressBar
                label="生命"
                current={character.hp}
                max={character.maxHp}
                color="#dc2626"
                showText={`${character.hp} / ${character.maxHp}`}
                icon={<Heart className="w-3 h-3" />}
              />
              <ProgressBar
                label="灵力"
                current={character.mp}
                max={character.maxMp}
                color="#2e5c8a"
                showText={`${character.mp} / ${character.maxMp}`}
                icon={<Sparkles className="w-3 h-3" />}
              />
            </div>
          </section>

          {/* 战斗属性 */}
          <section>
            <SectionTitle icon={<Sword className="w-3.5 h-3.5" />} title="武学·属性" />
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <StatCard icon={<Sword className="w-3 h-3" />} label="攻击" value={character.attack} color="#c8453c" />
              <StatCard icon={<Shield className="w-3 h-3" />} label="防御" value={character.defense} color="#2e5c8a" />
              <StatCard icon={<Zap className="w-3 h-3" />} label="速度" value={character.speed} color="#d4af37" />
              <StatCard icon={<Clover className="w-3 h-3" />} label="气运" value={character.luck} color="#22c55e" />
              <StatCard icon={<Brain className="w-3 h-3" />} label="悟性" value={character.comprehension} color="#a855f7" />
              <StatCard icon={<Coins className="w-3 h-3" />} label="灵石" value={character.spiritStones} color="#d4af37" />
              <StatCard icon={<Star className="w-3 h-3" />} label="声望" value={character.reputation} color="#f97316" />
              <StatCard icon={<Users className="w-3 h-3" />} label="阵营" value={character.faction || '散修'} color="#6b7280" isText />
            </div>
          </section>

          {/* 师承·所在 */}
          <section>
            <SectionTitle icon={<GraduationCap className="w-3.5 h-3.5" />} title="师承·所在" />
            <div className="rounded-lg border border-border/60 p-3 mt-1.5 bg-card/40 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> 师承
                </span>
                <span className="font-serif-cn">{character.master || '无'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> 所在
                </span>
                <span className="font-serif-cn">{character.location}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> 宗门
                </span>
                <span className="font-serif-cn">{character.faction || '散修'}</span>
              </div>
            </div>
          </section>

          {/* 状态词条摘要 */}
          <section>
            <SectionTitle icon={<Star className="w-3.5 h-3.5" />} title={`状态词条 (${character.activeStatuses.length})`} />
            <div className="rounded-lg border border-border/60 p-2 mt-1.5 bg-card/40">
              {character.activeStatuses.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">尚无状态词条</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {character.activeStatuses.map((s: any, i: number) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{
                        borderColor: `${RARITY_COLORS[s.rarity] || '#6b7280'}40`,
                        color: RARITY_COLORS[s.rarity] || '#6b7280',
                        background: `${RARITY_COLORS[s.rarity] || '#6b7280'}10`,
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 背包摘要 */}
          <section className="pb-4">
            <SectionTitle icon={<Coins className="w-3.5 h-3.5" />} title={`储物袋 (${character.inventory.length})`} />
            <div className="rounded-lg border border-border/60 p-2 mt-1.5 bg-card/40">
              {character.inventory.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">储物袋空空如也</p>
              ) : (
                <div className="space-y-1">
                  {character.inventory.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-serif-cn" style={{ color: RARITY_COLORS[item.rarity] || '#6b7280' }}>
                        {item.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {RARITY_LABEL[item.rarity] || item.rarity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#d4af37', mythic: '#ec4899',
};
const RARITY_LABEL: Record<string, string> = {
  common: '凡品', uncommon: '良品', rare: '稀有',
  epic: '史诗', legendary: '传说', mythic: '神话',
};

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 text-foreground">
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-serif-cn font-semibold tracking-wider">{title}</span>
      <div className="flex-1 h-px bg-border/40 ml-1" />
    </div>
  );
}

function StatCard({ icon, label, value, color, isText }: {
  icon: React.ReactNode; label: string; value: string | number; color: string; isText?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/60 p-2 bg-card/40">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5 font-serif-cn truncate" style={{ color }}>
        {isText ? value : (typeof value === 'number' ? value.toLocaleString() : value)}
      </div>
    </div>
  );
}

function ProgressBar({ label, current, max, color, showText, icon }: {
  label: string; current: number; max: number; color: string; showText?: string; icon?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{showText}</span>
      </div>
      <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 relative"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${color}aa, ${color})`,
            boxShadow: `0 0 6px ${color}66`,
          }}
        >
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent 0, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 4px)'
          }} />
        </div>
      </div>
    </div>
  );
}
