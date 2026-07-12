'use client';

/**
 * 生成式 UI DEMO #1 —— 宝物入怀卡
 *
 * 触发条件：event.effects 中出现 { kind: 'item', name: 'X' }
 * 数据来源：从 character.inventory / character.equipped 按 name 反查完整 ItemEntry
 * 视觉：品阶色渐变边框 + emoji 图标 + 名字 + 简介 + 效果 chip + 一次性微光晕动画
 *
 * 2026-07-10 首发：只覆盖"事件正文里获得的物品"，不动战斗/炼丹/秘境结算入口——
 * 跑几局观察玩家反馈再决定往其他入口铺。
 */

import { useMemo } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import type { ItemEntry } from '@/lib/xianxia/types';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatItemEffectLabel, sanitizeNarrative } from '@/lib/xianxia/display';

interface TreasureCardProps {
  /** 该事件里获得的物品名字数组（从 event.effects 里 kind==='item'||'equipment' 提取） */
  names: string[];
}

const RARITY_LABEL: Record<string, string> = {
  common: '凡品',
  uncommon: '良品',
  rare: '珍稀',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
};

// 品阶色 —— 从冷淡到炽热，跟游戏水墨调保持接近，不太跳
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

// 按 item_type 挑一个 emoji 图标（视觉锚点）。允许 item 为最简对象（无 item_type），走默认 ✦
function iconFor(item: { item_type?: string }): string {
  switch (item.item_type) {
    case 'weapon': return '⚔';
    case 'armor': return '🛡';
    case 'accessory': return '🪙';
    case 'artifact': return '💎';
    case 'scripture': return '📜';
    case 'consumable': return '🍶';
    case 'material': return '🌿';
    case 'tool': return '⚗';
    default: return '✦';
  }
}

// effect 变身"仙侠属性词"——复用项目共享的 formatItemEffectLabel（含完整 ATTRIBUTE_LABEL + 漏出保护）
// 2026-07-12 之前 TreasureCard 自己维护了一份缩小的 ATTR_LABEL，遗漏了五行 / heartDemon 等属性，
// 导致 chip 上直接显示「elementMetal+2」之类原始 key。改为复用 display.ts 的统一格式化函数。
function effectChip(eff: any): string {
  return formatItemEffectLabel(eff) || '';
}

export function TreasureCard({ names }: TreasureCardProps) {
  const character = useGameStore((s) => s.character);

  // 从背包和已装备里反查名字对应的完整 ItemEntry；
  // 反查不到时用最简"记名卡"兜底——玩家至少能看到"这一年得到了 xxx"
  // 2026-07-12：修复"获得物品但不显示"——问题在于事件发生后物品可能被消耗/装备/丢弃/命名微差，
  //   反查失败原本直接 return null 导致 UI 消失。现改为反查不到也用 name 渲染最简卡片
  const items = useMemo<Array<ItemEntry | { name: string; __minimal: true }>>(() => {
    if (!Array.isArray(names) || names.length === 0) return [];
    const pool: ItemEntry[] = character
      ? [
          ...(character.inventory || []),
          ...(character.equipped || []),
        ]
      : [];
    return names.map((name) => {
      const hit = pool.find((it) => it && it.name === name);
      return hit || { name, __minimal: true as const };
    });
  }, [character, names]);

  if (items.length === 0) return null;

  return (
    <div
      data-testid="treasure-card"
      className="mt-3 space-y-2"
    >
      {items.map((rawItem, idx) => {
        // 类型宽松：完整 ItemEntry 时有 rarity/description/effects/item_type 等；最简卡片只有 name
        const item = rawItem as any;
        const rarity: string = item.rarity || 'common';
        const isMinimal = item.__minimal === true;
        return (
          <div
            key={item.id || `${item.name}-${idx}`}
            className={cn(
              'relative rounded-lg border-2 px-3 py-2.5 paper-texture overflow-hidden',
              'animate-in fade-in slide-in-from-bottom-2 duration-500',
              RARITY_BORDER[rarity] || RARITY_BORDER.common,
            )}
            style={{ animationDelay: `${idx * 120}ms` }}
          >
            {/* 微光晕：从卡片左上淡出到右下，一次性 */}
            <div
              className="absolute inset-0 pointer-events-none opacity-60"
              style={{
                background: 'radial-gradient(circle at 15% 15%, rgba(255,255,255,0.6) 0%, transparent 55%)',
              }}
            />

            <div className="relative flex items-start gap-3">
              {/* 图标 */}
              <div
                className={cn(
                  'shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-2xl border',
                  RARITY_BORDER[rarity] || RARITY_BORDER.common,
                )}
                aria-hidden
              >
                {iconFor(item)}
              </div>

              {/* 主体 */}
              <div className="flex-1 min-w-0">
                {/* 顶栏：品阶 chip + "宝物入怀"标签 */}
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
                    宝物入怀
                  </span>
                </div>

                {/* 名字 */}
                <div className={cn(
                  'font-serif-cn font-bold text-sm tracking-wider',
                  RARITY_TEXT[rarity] || RARITY_TEXT.common,
                )}>
                  {item.name}
                </div>

                {/* 简介 */}
                {item.description && (
                  <p className="mt-1 text-xs text-foreground/75 leading-relaxed font-serif-cn xianxia-prose">
                    {sanitizeNarrative(item.description || '')}
                  </p>
                )}

                {/* effects → 仙侠化属性词 */}
                {Array.isArray(item.effects) && item.effects.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.effects.slice(0, 4).map((eff, k) => {
                      const chip = effectChip(eff);
                      if (!chip) return null;
                      return (
                        <span
                          key={k}
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded border xianxia-chip',
                            RARITY_BORDER[rarity] || RARITY_BORDER.common,
                            RARITY_TEXT[rarity] || RARITY_TEXT.common,
                          )}
                        >
                          {chip}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* 来源（若 AI 给了）*/}
                {item.source && (
                  <div className="mt-1 text-[10px] text-muted-foreground font-serif-cn">
                    · {item.source}
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
