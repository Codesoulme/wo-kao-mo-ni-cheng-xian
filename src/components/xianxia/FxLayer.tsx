'use client';

// 沉浸版 Phase-Z: 全局特效层组件
// - 飘字（攻+1 / 血+3 / 破势+5 / 等），从右上角向右飘出，自动消失
// - 境界突破过场：满屏 modal + 大字 + 灵气流光，2.5 秒自动收
// - 稀有掉落光柱：全屏紫/金/红光柱 + 物品名，2 秒
// - 成就达成 toast：右上角弹出卡片（成就名 + 局外奖励）

import { useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useFxStore, type FxEvent, type FxDelta, type FxBreakthrough, type FxDrop, type FxAchievement } from './fx-store';

const DELTA_TTL_MS = 1400;
const BREAKTHROUGH_TTL_MS = 2600;
const DROP_TTL_MS = 2200;
const ACHIEVEMENT_TTL_MS = 4200;

const RARITY_COLORS: Record<string, string> = {
  common:    '#a8a29e',
  uncommon:  '#84cc16',
  rare:      '#3b82f6',
  epic:      '#a855f7',
  legendary: '#f59e0b',
  mythic:    '#ef4444',
};

const RARITY_BG: Record<string, string> = {
  common:    'from-stone-500/30 via-stone-300/20 to-transparent',
  uncommon:  'from-lime-500/40 via-lime-300/20 to-transparent',
  rare:      'from-blue-500/40 via-blue-300/20 to-transparent',
  epic:      'from-purple-500/50 via-purple-300/30 to-transparent',
  legendary: 'from-amber-500/60 via-yellow-300/30 to-transparent',
  mythic:    'from-rose-600/70 via-rose-400/30 to-transparent',
};

export function FxLayer() {
  const events = useFxStore((s) => s.events);
  const remove = useFxStore((s) => s.remove);

  // 自动 TTL 清理
  useEffect(() => {
    if (events.length === 0) return;
    const timers = events.map((e) => {
      const ttl = ttlFor(e);
      return window.setTimeout(() => remove(e.id), ttl);
    });
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [events, remove]);

  const deltas = useMemo(() => events.filter((e): e is FxDelta => e.kind === 'delta'), [events]);
  const breakthroughs = useMemo(() => events.filter((e): e is FxBreakthrough => e.kind === 'breakthrough'), [events]);
  const drops = useMemo(() => events.filter((e): e is FxDrop => e.kind === 'drop'), [events]);
  const achievements = useMemo(() => events.filter((e): e is FxAchievement => e.kind === 'achievement'), [events]);

  return (
    <>
      {/* 飘字层：左侧中间（垂直居中、靠左） */}
      <div
        aria-hidden="true"
        data-testid="fx-layer-deltas"
        className="pointer-events-none fixed left-3 top-1/2 z-[60] flex -translate-y-1/2 flex-col items-start gap-1 sm:left-5"
      >
        {deltas.map((d) => <FloatingDelta key={d.id} d={d} />)}
      </div>

      {/* 成就达成 toast：右上靠下，避开飘字 */}
      <div
        aria-live="polite"
        data-testid="fx-layer-achievements"
        className="pointer-events-none fixed right-4 top-40 z-[60] flex w-72 flex-col gap-2 sm:right-6 sm:top-44"
      >
        {achievements.map((a) => <AchievementToast key={a.id} a={a} />)}
      </div>

      {/* 突破过场 */}
      {breakthroughs.map((b) => <BreakthroughOverlay key={b.id} b={b} />)}

      {/* 稀有掉落光柱 */}
      {drops.map((d) => <DropBurst key={d.id} d={d} />)}
    </>
  );
}

function ttlFor(e: FxEvent): number {
  switch (e.kind) {
    case 'delta': return DELTA_TTL_MS;
    case 'breakthrough': return BREAKTHROUGH_TTL_MS;
    case 'drop': return DROP_TTL_MS;
    case 'achievement': return ACHIEVEMENT_TTL_MS;
  }
}

function toneClass(tone: FxDelta['tone']): string {
  switch (tone) {
    case 'rose': return 'text-rose-600';
    case 'amber': return 'text-amber-600';
    case 'sky': return 'text-sky-600';
    case 'emerald':
    default: return 'text-emerald-600';
  }
}

function FloatingDelta({ d }: { d: FxDelta }) {
  const sign = d.value > 0 ? '+' : '−';
  return (
    <div
      data-testid="fx-delta"
      data-origin={d.origin ?? 'main'}
      className={cn(
        'pointer-events-none select-none rounded-md border bg-white/95 px-2.5 py-1 font-bold shadow-md',
        'animate-[fx-delta-fly_1.4s_ease-out_forwards]',
        'text-sm sm:text-base',
        toneClass(d.tone),
        d.value > 0 ? 'border-emerald-400' : 'border-rose-400',
      )}
    >
      <span className="mr-0.5 text-stone-500 font-normal">{d.label}</span>
      <span className="tabular-nums">{sign}{Math.abs(d.value)}</span>
    </div>
  );
}

function BreakthroughOverlay({ b }: { b: FxBreakthrough }) {
  return (
    <div
      role="status"
      aria-live="assertive"
      data-testid="fx-breakthrough"
      data-from-realm={b.fromRealm ?? ''}
      data-to-realm={b.toRealm}
      className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/70 backdrop-blur-sm"
    >
      <div className="relative flex flex-col items-center gap-4 animate-[fx-breakthrough_2.6s_ease-out_forwards]">
        {/* 灵气流光背景 */}
        <div className="absolute -inset-20 -z-10 animate-[fx-breakthrough-spiral_2.6s_ease-out_forwards] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(168,85,247,0.45)_30deg,transparent_60deg,rgba(59,130,246,0.45)_120deg,transparent_180deg,rgba(245,158,11,0.45)_240deg,transparent_300deg)] opacity-70 blur-2xl rounded-full" />
        <div className="text-xs uppercase tracking-[0.4em] text-amber-300/80">境界突破</div>
        <div className="text-2xl font-serif-cn font-bold text-amber-100 sm:text-4xl">
          {b.fromRealm ? b.fromRealm : '—'}  →  {b.toRealm}
        </div>
        <div className="text-sm font-serif-cn text-stone-200 sm:text-base">
          破境于青岚仙历 {b.triggeredAge} 岁
        </div>
        <div className="mt-2 text-amber-200 text-lg">✨</div>
      </div>
    </div>
  );
}

function DropBurst({ d }: { d: FxDrop }) {
  const color = RARITY_COLORS[d.rarity] ?? RARITY_COLORS.rare;
  const bg = RARITY_BG[d.rarity] ?? RARITY_BG.rare;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="fx-drop"
      data-rarity={d.rarity}
      className={cn(
        'pointer-events-none fixed inset-0 z-[70] flex items-center justify-center',
        'bg-gradient-to-b',
        bg,
      )}
    >
      <div className="flex flex-col items-center gap-3 animate-[fx-drop_2.2s_ease-out_forwards]">
        <div
          className="h-32 w-32 rounded-full"
          style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)`, filter: 'blur(8px)' }}
        />
        <div className="text-xs uppercase tracking-[0.4em]" style={{ color }}>
          获得
        </div>
        <div className="font-serif-cn text-2xl font-bold sm:text-3xl" style={{ color, textShadow: `0 0 8px ${color}` }}>
          {d.name}
        </div>
        <div className="text-xs text-stone-700">{d.category ? `[${d.category}]` : ''} {d.rarity}</div>
      </div>
    </div>
  );
}

function AchievementToast({ a }: { a: FxAchievement }) {
  const color = RARITY_COLORS[a.rewardRarity] ?? RARITY_COLORS.rare;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="fx-achievement"
      data-achievement-id={a.achievementId}
      className="pointer-events-auto rounded-lg border-2 border-amber-400 bg-white/95 p-3 shadow-lg animate-[fx-achievement_4.2s_ease-out_forwards]"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg">🏆</span>
        <span className="font-serif-cn font-bold text-stone-800">成就达成</span>
        <span className="ml-auto text-[10px] text-stone-500">{a.bucket ?? ''}</span>
      </div>
      <div className="mb-2 text-sm font-bold" style={{ color }}>
        {a.name}
      </div>
      <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
        <span className="font-bold">局外奖励 · </span>
        <span style={{ color }}>{a.rewardName}</span>
        <span className="ml-1 text-stone-500">({a.rewardRarity})</span>
        <div className="mt-0.5 text-[10px] text-stone-500">已入传承池，下次开局可选</div>
      </div>
    </div>
  );
}