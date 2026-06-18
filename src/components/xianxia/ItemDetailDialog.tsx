'use client';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Swords, Shield, Gem, Sparkles, BookOpen, FlaskConical, Package, Wrench,
} from 'lucide-react';
import { formatItemEffectLabel } from '@/lib/xianxia/display';

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#d4af37', mythic: '#ec4899',
};
const RARITY_LABEL: Record<string, string> = {
  common: '凡品', uncommon: '良品', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话',
};
const ITEM_TYPE_LABEL: Record<string, string> = {
  weapon: '兵器', armor: '防具', accessory: '饰物', artifact: '法宝',
  consumable: '丹药', material: '材料', tool: '器具', scripture: '功法',
};
const TYPE_ICON: Record<string, React.ReactNode> = {
  weapon: <Swords className="w-3.5 h-3.5" />,
  armor: <Shield className="w-3.5 h-3.5" />,
  accessory: <Gem className="w-3.5 h-3.5" />,
  artifact: <Sparkles className="w-3.5 h-3.5" />,
  scripture: <BookOpen className="w-3.5 h-3.5" />,
  consumable: <FlaskConical className="w-3.5 h-3.5" />,
  material: <Package className="w-3.5 h-3.5" />,
  tool: <Wrench className="w-3.5 h-3.5" />,
};

function fmtEffectZh(eff: any): string {
  return formatItemEffectLabel(eff);
}

interface Props {
  item: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 若是已装备物品，显示卸下按钮 */
  equipped?: boolean;
  onUnequip?: () => void;
  /** 若是背包物品且可装备，显示装备按钮 */
  canEquip?: boolean;
  onEquip?: () => void;
  /** 若是丹药，显示使用按钮 */
  canUse?: boolean;
  onUse?: () => void;
}

export function ItemDetailDialog({
  item, open, onOpenChange,
  equipped, onUnequip, canEquip, onEquip, canUse, onUse,
}: Props) {
  if (!item) return null;
  const color = RARITY_COLORS[item.rarity] || '#6b7280';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] gap-0 p-0 overflow-hidden">
        {/* 顶部彩色 banner（按稀有度渐变） */}
        <div
          className="px-4 pt-4 pb-3"
          style={{
            background: `linear-gradient(135deg, ${color}18, ${color}06)`,
            borderBottom: `1px solid ${color}30`,
          }}
        >
          <DialogHeader className="space-y-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${color}20`, color }}
              >
                {TYPE_ICON[item.item_type] || <Package className="w-3.5 h-3.5" />}
              </span>
              <Badge
                variant="secondary"
                className="text-[10px] h-5 shrink-0"
                style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
              >
                {RARITY_LABEL[item.rarity] || item.rarity}
              </Badge>
              <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                {ITEM_TYPE_LABEL[item.item_type] || item.item_type}
              </Badge>
            </div>
            <DialogTitle
              className="text-lg font-serif-cn tracking-wide"
              style={{ color }}
            >
              {item.name}
            </DialogTitle>
            {item.equipNote && (
              <DialogDescription className="text-[11px] mt-0.5">
                装备位置：<span className="font-medium" style={{ color }}>{item.equipNote}</span>
              </DialogDescription>
            )}
          </DialogHeader>
        </div>

        {/* 主体内容 */}
        <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto xianxia-scroll">
          {/* 描述 */}
          <div>
            <div className="text-[10px] text-muted-foreground mb-1">描述</div>
            <p className="text-xs leading-relaxed font-serif-cn text-foreground/90">
              {item.description}
            </p>
          </div>

          {/* 效果 */}
          {item.effects && item.effects.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">效果</div>
              <div className="flex flex-wrap gap-1.5">
                {item.effects.map((e: any, i: number) => fmtEffectZh(e)).filter(Boolean).map((label: string, i: number) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded font-medium"
                    style={{
                      background: e.operation === 'multiply' ? '#c8453c15' : '#3b82f615',
                      color: e.operation === 'multiply' ? '#c8453c' : '#3b82f6',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 来源 */}
          {item.source && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">来源</div>
              <p className="text-[11px] text-muted-foreground/90 leading-relaxed">{item.source}</p>
            </div>
          )}

          {/* id（小字角标，便于调试） */}
          <div className="text-[9px] text-muted-foreground/40 font-mono pt-1 border-t border-dashed">
            id: {item.id}
          </div>
        </div>

        {/* 底部操作栏 */}
        {(canEquip || canUse || (equipped && onUnequip)) && (
          <div className="px-4 py-3 border-t flex gap-2 bg-muted/20">
            {canEquip && (
              <button
                onClick={() => { onEquip?.(); onOpenChange(false); }}
                className="flex-1 text-xs py-2 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-medium"
              >
                装备
              </button>
            )}
            {canUse && (
              <button
                onClick={() => { onUse?.(); onOpenChange(false); }}
                className="flex-1 text-xs py-2 rounded border border-accent/40 text-accent hover:bg-accent/10 transition-colors font-medium"
              >
                使用
              </button>
            )}
            {equipped && onUnequip && (
              <button
                onClick={() => { onUnequip?.(); onOpenChange(false); }}
                className="flex-1 text-xs py-2 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors font-medium"
              >
                卸下
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
