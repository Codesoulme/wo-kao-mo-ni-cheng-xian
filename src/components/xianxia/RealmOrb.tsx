'use client';

import { cn } from '@/lib/utils';

interface RealmOrbProps {
  realmColor: string;
  realmName: string;
  realmLevel: number;
  realmMaxLevel: number;
  cultivationExp: number;
  expToBreak: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function RealmOrb({
  realmColor, realmName, realmLevel, realmMaxLevel,
  cultivationExp, expToBreak, size = 'md', showLabel = true,
}: RealmOrbProps) {
  const totalProgress = realmMaxLevel > 0
    ? (realmLevel / realmMaxLevel) * 0.7 + (cultivationExp / expToBreak) * 0.3
    : cultivationExp / expToBreak;

  const dim = size === 'sm' ? 56 : size === 'lg' ? 120 : 80;
  const pct = Math.max(0, Math.min(1, totalProgress));

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative rounded-full orb-glow flex items-center justify-center"
        style={{
          width: dim, height: dim,
          background: `radial-gradient(circle at 50% 30%, ${realmColor}33, transparent 70%), radial-gradient(circle at 50% 100%, ${realmColor}, ${realmColor}88 60%, transparent)`,
          color: realmColor,
          border: `2px solid ${realmColor}`,
          boxShadow: `0 0 20px ${realmColor}66, inset 0 -10px 20px rgba(0,0,0,0.3)`,
        }}
      >
        {/* 填充层 */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-700"
          style={{
            height: `${pct * 100}%`,
            background: `linear-gradient(to top, ${realmColor}cc, ${realmColor}44)`,
            borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
          }}
        />
        {/* 文字 */}
        <span
          className="relative z-10 font-serif-cn font-bold text-white realm-text"
          style={{ fontSize: size === 'sm' ? 16 : size === 'lg' ? 32 : 24, textShadow: '0 0 6px rgba(0,0,0,0.8)' }}
        >
          {realmName.slice(0, 1)}
        </span>
      </div>
      {showLabel && (
        <div className="text-center">
          <div className="text-xs text-muted-foreground">{realmName}</div>
          {realmMaxLevel > 0 && (
            <div className="text-[10px] text-muted-foreground">{realmLevel + 1} / {realmMaxLevel} 层</div>
          )}
        </div>
      )}
    </div>
  );
}
