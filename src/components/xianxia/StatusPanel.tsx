'use client';

import { useGameStore, CharacterState } from '@/lib/xianxia/store';
import { RealmOrb } from './RealmOrb';
import { Heart, Sparkles, Sword, Shield, Zap, Clover, Brain, Coins, Star, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REALMS, ELEMENTS } from '@/lib/xianxia/types';

interface StatusPanelProps {
  character: CharacterState;
  compact?: boolean;
}

export function StatusPanel({ character, compact = false }: StatusPanelProps) {
  const realmInfo = REALMS.find(r => r.id === character.realm);
  const lifespanLeft = character.lifespan - character.age;

  const statRow = (icon: React.ReactNode, label: string, value: string | number, color?: string, hint?: string) => (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-[11px] text-muted-foreground w-10 shrink-0">{label}</span>
      <span className="text-[12px] font-semibold ml-auto" style={color ? { color } : undefined}>{value}</span>
      {hint && <span className="text-[10px] text-muted-foreground ml-1">{hint}</span>}
    </div>
  );

  return (
    <div className="paper-texture rounded-xl border border-border/60 shadow-sm overflow-hidden">
      {/* 顶部角色信息 */}
      <div className="relative px-4 py-3 bg-gradient-to-r from-secondary/40 to-transparent border-b border-border/40">
        <div className="flex items-center gap-3">
          <RealmOrb
            realmColor={character.realmColor}
            realmName={character.realmName}
            realmLevel={character.realmLevel}
            realmMaxLevel={character.realmMaxLevel}
            cultivationExp={character.cultivationExp}
            expToBreak={character.expToBreak}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-serif-cn text-lg font-bold truncate">{character.name}</h2>
              <span className="seal">道</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {character.gender === 'male' ? '男' : '女'} · {character.age}岁 ·{' '}
              <span style={{ color: character.realmColor }} className="font-semibold">
                {character.realmName}{character.realmMaxLevel > 0 ? ` ${character.realmLevel + 1}层` : ''}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{character.location}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 寿元/修为 进度条 */}
      <div className="px-4 py-2 space-y-2 border-b border-border/40">
        <ProgressBar
          label="寿元"
          current={character.age}
          max={character.lifespan}
          color="#c8453c"
          showText={`余 ${lifespanLeft} 年`}
          icon={<Heart className="w-3 h-3" />}
        />
        <ProgressBar
          label="修为"
          current={character.cultivationExp}
          max={character.expToBreak}
          color={character.realmColor}
          showText={`${character.cultivationExp} / ${character.expToBreak}`}
          icon={<Sparkles className="w-3 h-3" />}
        />
        <ProgressBar
          label="生命"
          current={character.hp}
          max={character.maxHp}
          color="#dc2626"
          showText={`${character.hp} / ${character.maxHp}`}
          icon={<Heart className="w-3 h-3" />}
        />
      </div>

      {/* 灵根 + 五行 */}
      <div className="px-4 py-2 border-b border-border/40">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground">灵根</span>
          <span className="text-xs font-semibold" style={{ color: character.rootMultiplier > 1 ? '#c8453c' : undefined }}>
            {character.rootDetail} {character.rootMultiplier > 0 && `（×${character.rootMultiplier}）`}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          {(['metal','wood','water','fire','earth'] as const).map(el => {
            const v = character.elements[el];
            return (
              <div key={el} className="flex-1">
                <div className="text-[10px] text-center" style={{ color: ELEMENTS[el].color }}>
                  {ELEMENTS[el].icon}{ELEMENTS[el].name}
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${v}%`, background: ELEMENTS[el].color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 属性网格 */}
      <div className="px-4 py-2 grid grid-cols-2 gap-x-3 gap-y-0 border-b border-border/40">
        {statRow(<Sword className="w-3 h-3" />, '攻击', character.attack, '#c8453c')}
        {statRow(<Shield className="w-3 h-3" />, '防御', character.defense, '#2e5c8a')}
        {statRow(<Zap className="w-3 h-3" />, '速度', character.speed)}
        {statRow(<Sparkles className="w-3 h-3" />, '灵力', `${character.mp}/${character.maxMp}`)}
        {statRow(<Clover className="w-3 h-3" />, '气运', character.luck)}
        {statRow(<Brain className="w-3 h-3" />, '悟性', character.comprehension)}
        {statRow(<Coins className="w-3 h-3" />, '灵石', character.spiritStones, '#d4af37')}
        {statRow(<Star className="w-3 h-3" />, '声望', character.reputation)}
      </div>

      {/* 宗门师承 */}
      <div className="px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <span>宗门：<span className="text-foreground">{character.faction || '散修'}</span></span>
        <span>师承：<span className="text-foreground">{character.master || '无'}</span></span>
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
        <span className="text-[11px] text-muted-foreground">{showText}</span>
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
