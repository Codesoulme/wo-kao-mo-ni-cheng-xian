'use client';

import { useState } from 'react';
import { useGameStore, CharacterState } from '@/lib/xianxia/store';
import { RealmOrb } from './RealmOrb';
import { CharacterDetailSheet } from './CharacterDetailSheet';
import { Heart, Sparkles, MapPin, ChevronRight } from 'lucide-react';
import { REALMS, ELEMENTS, SPIRITUAL_ROOTS } from '@/lib/xianxia/types';
import { cn } from '@/lib/utils';

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

  return (
    <>
      <div className="paper-texture rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {/* 顶部角色信息 - 可点击展开详情 */}
        <button
          onClick={() => setDetailOpen(true)}
          className="w-full text-left relative px-3 py-2.5 bg-gradient-to-r from-secondary/40 to-transparent hover:from-secondary/60 transition-colors"
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
                <span>{character.age}岁</span>
                <span className="opacity-50">·</span>
                <span className="flex items-center gap-0.5 truncate max-w-[100px]">
                  <MapPin className="w-2.5 h-2.5" />
                  {character.location}
                </span>
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
        </button>
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
