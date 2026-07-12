'use client';

/**
 * 生成式 UI DEMO #5 —— 突破闪耀卡
 *
 * 触发条件：EventTimeline 检测 event.eventType === 'breakthrough'
 * 数据来源：event 本身 + character.realm / realmName / realmColor / realmLevel
 * 视觉：全宽横板 + 顶部动画光晕（realmColor 渐变）+ "境界升迁"字样 + 前后境界名 + 层数
 *       金/紫/青三色渐变边框 + 底部一句领悟；进场 scale-up + 光晕从中心扩散一次
 */

import { useMemo } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreakthroughFlashCardProps {
  /** 事件叙事（用于抓取"一句领悟"） */
  narrative?: string;
  /** 事件所记录的前一境界名（可选，若无从事件里取则用 character.lastBreakthrough 兜底） */
  fromRealmName?: string;
  /** 事件所记录的目标境界名（可选，兜底走 character.realmName） */
  toRealmName?: string;
  /** 目标层数（可选） */
  toRealmLevel?: number;
}

/** 从叙事文本里抓一句含"领悟/顿悟/一念/心念"的短句；抓不到就取前 30 字 */
function pickInsightSentence(text: string, limit = 30): string {
  const src = String(text || '').replace(/\s+/g, ' ').trim();
  if (!src) return '';
  const sentences = src.split(/[。！？；.!?;]+/).map((s) => s.trim()).filter(Boolean);
  const keyed = sentences.find((s) => /领悟|顿悟|一念|心念/.test(s));
  const pick = keyed || sentences[0] || src;
  if (pick.length <= limit) return pick;
  return pick.slice(0, limit).replace(/[，。；！？、,.;!?]+$/g, '').trim();
}

export function BreakthroughFlashCard({
  narrative,
  fromRealmName,
  toRealmName,
  toRealmLevel,
}: BreakthroughFlashCardProps) {
  const character = useGameStore((s) => s.character);

  const insight = useMemo(() => pickInsightSentence(narrative || '', 30), [narrative]);

  if (!character) return null;

  const toName = toRealmName || character.realmName || String(character.realm || '');
  const fromName = fromRealmName || character.lastBreakthrough?.newRealm || '';
  const level =
    typeof toRealmLevel === 'number' && Number.isFinite(toRealmLevel)
      ? toRealmLevel
      : character.realmLevel;

  // realmColor 兜底：character 上带 realmColor 则用，否则用琥珀色
  const glowColor = character.realmColor || '#fbbf24';

  return (
    <div
      data-testid="breakthrough-flash-card"
      className={cn(
        'relative mt-3 w-full rounded-xl overflow-hidden',
        'p-[2px]',
        'animate-in fade-in zoom-in-95 duration-500',
      )}
      style={{
        // 金/紫/青三色渐变 border-image
        background:
          'linear-gradient(90deg, rgb(252 211 77 / 0.9) 0%, var(--primary, rgb(147 51 234)) 50%, rgb(167 139 250 / 0.9) 100%)',
      }}
    >
      <div className="relative rounded-[10px] paper-texture px-4 py-3 overflow-hidden bg-background/70">
        {/* 顶部动画光晕：realmColor 渐变，用 tailwind animate-in 一次性从中心扩散 */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70 animate-in zoom-in-50 fade-in duration-700"
          style={{
            background: `radial-gradient(circle at 50% 20%, ${glowColor}66 0%, transparent 60%)`,
          }}
          aria-hidden
        />

        <div className="relative flex flex-col items-center text-center gap-1.5">
          {/* 顶栏 chip */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-50/60 text-amber-700 font-serif-cn tracking-wider">
              <Sparkles className="w-2.5 h-2.5" />
              境界升迁
            </span>
          </div>

          {/* 中央大字：突破 从…到… */}
          <div className="font-serif-cn font-bold text-base sm:text-lg tracking-wider text-foreground">
            <span className="text-amber-600">突破</span>
            {fromName && (
              <>
                <span className="mx-1.5 text-muted-foreground text-sm">从</span>
                <span className="text-violet-700">{fromName}</span>
              </>
            )}
            <span className="mx-1.5 text-muted-foreground text-sm">{fromName ? '至' : '入'}</span>
            <span
              className="text-primary"
              style={character.realmColor ? { color: character.realmColor } : undefined}
            >
              {toName}
            </span>
            {typeof level === 'number' && Number.isFinite(level) && level > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground font-normal tracking-normal">
                第 {level} 层
              </span>
            )}
          </div>

          {/* 底部一句领悟 */}
          {insight && (
            <p className="mt-0.5 max-w-md text-xs text-foreground/80 leading-relaxed font-serif-cn xianxia-prose italic">
              {insight}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
