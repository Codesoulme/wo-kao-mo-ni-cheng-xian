'use client';

/**
 * 生成式 UI DEMO #2 —— 灵宠结契卡
 *
 * 触发条件：event.effects 中出现 { kind: 'pet', name: 'X' }
 * 数据来源：从 character.pets 里按名字反查完整 Pet 对象
 * 视觉：品阶色边框 + 物种 emoji + 名字 + 描述 + 忠诚/修为/五行 chip + 淡入光晕
 *
 * 与 TreasureCard 同风格；多宠物错开 120ms 依次入场。
 */

import { useMemo } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import type { Pet } from '@/lib/xianxia/types';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NpcEncounterCardProps {
  /** 该事件里收服的灵宠名字数组（从 event.effects 里 kind==='pet' 提取的 name） */
  pets: string[];
}

const RARITY_LABEL: Record<string, string> = {
  common: '凡品',
  uncommon: '良品',
  rare: '珍稀',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
};

const RARITY_BORDER: Record<string, string> = {
  common: 'border-stone-400/40 bg-stone-50/50',
  uncommon: 'border-emerald-500/40 bg-emerald-50/40',
  rare: 'border-sky-500/40 bg-sky-50/40',
  epic: 'border-violet-500/40 bg-violet-50/40',
  legendary: 'border-amber-500/50 bg-amber-50/50',
  mythic: 'border-rose-500/50 bg-rose-50/50',
};

const RARITY_TEXT: Record<string, string> = {
  common: 'text-stone-700',
  uncommon: 'text-emerald-700',
  rare: 'text-sky-700',
  epic: 'text-violet-700',
  legendary: 'text-amber-700',
  mythic: 'text-rose-700',
};

// 物种 → emoji 兜底图标（未知物种回退 🐾）
const SPECIES_ICON: Record<string, string> = {
  fox: '🦊',
  wolf: '🐺',
  snake: '🐍',
  turtle: '🐢',
  tortoise: '🐢',
  eagle: '🦅',
  bird: '🦅',
  ape: '🐒',
  spider: '🕷',
  butterfly: '🦋',
  fish: '🐟',
  tiger: '🐅',
  phoenix: '🔥',
  dragon: '🐲',
};

// 物种中文简称（视觉辅助，非枚举必须）
const SPECIES_LABEL: Record<string, string> = {
  fox: '灵狐',
  wolf: '灵狼',
  snake: '灵蛇',
  turtle: '灵龟',
  tortoise: '灵龟',
  eagle: '灵鹰',
  bird: '灵禽',
  ape: '灵猿',
  spider: '灵蛛',
  butterfly: '灵蝶',
  fish: '灵鱼',
  tiger: '灵虎',
  phoenix: '火凤',
  dragon: '幼龙',
};

const ELEMENT_LABEL: Record<string, string> = {
  metal: '金',
  wood: '木',
  water: '水',
  fire: '火',
  earth: '土',
};

function speciesIcon(pet: { species?: string; name?: string }): string {
  return SPECIES_ICON[String(pet.species || '')] || '🐾';
}

function speciesLabel(pet: { species?: string }): string {
  return SPECIES_LABEL[String(pet.species || '')] || String(pet.species || '灵兽');
}

export function NpcEncounterCard({ pets }: NpcEncounterCardProps) {
  const character = useGameStore((s) => s.character);

  // 2026-07-12：反查失败也用 name 兜底渲染最简卡——防止事件后灵宠死亡/走失/被 AI 处理导致 UI 消失
  const found = useMemo<Array<Pet | { name: string; __minimal: true }>>(() => {
    if (!Array.isArray(pets) || pets.length === 0) return [];
    const pool: Pet[] = character?.pets || [];
    return pets.map((name) => {
      const hit = pool.find((p) => p && p.name === name);
      return hit || { name, __minimal: true as const };
    });
  }, [character, pets]);

  if (found.length === 0) return null;

  return (
    <div data-testid="npc-encounter-card" className="mt-3 space-y-2">
      {found.map((rawPet, idx) => {
        // 类型宽松：完整 Pet 时有 rarity/loyalty/description/species 等；最简卡片只有 name
        const pet = rawPet as any;
        const rarity: string = pet.rarity || 'common';
        return (
          <div
            key={pet.id || `${pet.name}-${idx}`}
            className={cn(
              'relative rounded-lg border-2 px-3 py-2.5 paper-texture overflow-hidden',
              'animate-in fade-in slide-in-from-bottom-2 duration-500',
              RARITY_BORDER[rarity] || RARITY_BORDER.common,
            )}
            style={{ animationDelay: `${idx * 120}ms` }}
          >
            {/* 微光晕 */}
            <div
              className="absolute inset-0 pointer-events-none opacity-60"
              style={{
                background:
                  'radial-gradient(circle at 15% 15%, rgba(255,255,255,0.6) 0%, transparent 55%)',
              }}
            />

            <div className="relative flex items-start gap-3">
              {/* 圆头像位 */}
              <div
                className={cn(
                  'shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-2xl border-2',
                  RARITY_BORDER[rarity] || RARITY_BORDER.common,
                )}
                aria-hidden
              >
                {speciesIcon(pet)}
              </div>

              {/* 主体 */}
              <div className="flex-1 min-w-0">
                {/* 顶栏：品阶 chip + "结契入缘" 徽标 */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={cn(
                      'inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border font-serif-cn tracking-wider',
                      RARITY_BORDER[rarity] || RARITY_BORDER.common,
                      RARITY_TEXT[rarity] || RARITY_TEXT.common,
                    )}
                  >
                    {RARITY_LABEL[rarity] || rarity}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-primary/80 font-serif-cn">
                    <Sparkles className="w-2.5 h-2.5" />
                    结契入缘
                  </span>
                </div>

                {/* 名字 + 物种 */}
                <div
                  className={cn(
                    'font-serif-cn font-bold text-sm tracking-wider',
                    RARITY_TEXT[rarity] || RARITY_TEXT.common,
                  )}
                >
                  {pet.name}
                  <span className="ml-1.5 text-[10px] text-muted-foreground font-normal tracking-normal">
                    · {speciesLabel(pet)}
                  </span>
                </div>

                {/* 描述 */}
                {pet.description && (
                  <p className="mt-1 text-xs text-foreground/75 leading-relaxed font-serif-cn xianxia-prose">
                    {pet.description}
                  </p>
                )}

                {/* 底部 chip：忠诚度 / 修为 / 元素属性 */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Number.isFinite(pet.loyalty) && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded border xianxia-chip',
                        RARITY_BORDER[rarity] || RARITY_BORDER.common,
                        RARITY_TEXT[rarity] || RARITY_TEXT.common,
                      )}
                    >
                      忠诚 {Math.round(pet.loyalty)}
                    </span>
                  )}
                  {Number.isFinite(pet.level) && pet.level > 0 && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded border xianxia-chip',
                        RARITY_BORDER[rarity] || RARITY_BORDER.common,
                        RARITY_TEXT[rarity] || RARITY_TEXT.common,
                      )}
                    >
                      修为 {pet.level} 阶
                    </span>
                  )}
                  {pet.element && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded border xianxia-chip',
                        RARITY_BORDER[rarity] || RARITY_BORDER.common,
                        RARITY_TEXT[rarity] || RARITY_TEXT.common,
                      )}
                    >
                      {ELEMENT_LABEL[pet.element] || pet.element} 属
                    </span>
                  )}
                </div>

                {/* 来源 */}
                {pet.sourceAcquired && (
                  <div className="mt-1 text-[10px] text-muted-foreground font-serif-cn">
                    · {pet.sourceAcquired}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
