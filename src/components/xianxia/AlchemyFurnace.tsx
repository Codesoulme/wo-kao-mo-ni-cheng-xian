'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown, FlaskConical, Loader2, Check, X, Flame, Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ItemEntry } from '@/lib/xianxia/types';

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#d4af37', mythic: '#ec4899',
};
const RARITY_LABEL: Record<string, string> = {
  common: '凡品', uncommon: '良品', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话',
};

const SPIRIT_STONE_COST = 10;

// 从材料 effects 提取元素倾向（用于显示）
function materialElement(item: ItemEntry): { el: string; zh: string; color: string } | null {
  for (const eff of item.effects || []) {
    if (eff.target_attribute === 'elementFire') return { el: 'fire', zh: '火', color: '#ef4444' };
    if (eff.target_attribute === 'elementWater') return { el: 'water', zh: '水', color: '#3b82f6' };
    if (eff.target_attribute === 'elementWood') return { el: 'wood', zh: '木', color: '#22c55e' };
    if (eff.target_attribute === 'elementMetal') return { el: 'metal', zh: '金', color: '#eab308' };
    if (eff.target_attribute === 'elementEarth') return { el: 'earth', zh: '土', color: '#a16207' };
  }
  return null;
}

export function AlchemyFurnace() {
  const { character, setCharacter } = useGameStore();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    narrative: string;
    product?: ItemEntry;
  } | null>(null);

  const inventory = character?.inventory || [];
  const materials = inventory.filter(it => it.item_type === 'material');

  // 预测成功率（与 engine.alchemy 公式一致，仅用于展示）
  const predictedRate = useMemo(() => {
    if (!character) return 0;
    if (selected.length < 2) return 0;
    const selectedItems = materials.filter(m => selected.includes(m.id));
    if (selectedItems.length !== selected.length) return 0;
    const comp = character.comprehension || 0;
    const root = character.rootMultiplier || 0;
    const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    const avgIdx = selectedItems.reduce((s, m) => s + RARITY_ORDER.indexOf(m.rarity), 0) / selectedItems.length;
    const rate = 30 + comp * 0.4 + root * 5 + avgIdx * 8 - (selected.length - 2) * 5;
    return Math.round(Math.max(10, Math.min(95, rate)));
  }, [selected, materials, character]);

  if (!character) return null;

  const canAlchemy = selected.length >= 2 && selected.length <= 3 && (character.spiritStones || 0) >= SPIRIT_STONE_COST && !busy;

  const toggleMaterial = (id: string) => {
    if (busy) return;
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev; // 最多 3 个
      return [...prev, id];
    });
  };

  const doAlchemy = async () => {
    if (!character || !canAlchemy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/game/alchemy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          materialIds: selected,
          spiritStoneCost: SPIRIT_STONE_COST,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '炼丹失败');

      setCharacter({ ...character, ...data.state });
      setLastResult({
        success: data.alchemySuccess,
        narrative: data.narrative,
        product: data.product,
      });
      setSelected([]);

      if (data.alchemySuccess) {
        toast.success('丹成！', { description: `得 ${data.product?.name || '丹药'} 一枚` });
      } else {
        toast.error('丹炉炸裂', { description: '材料化为飞灰，仅得废丹' });
      }
    } catch (err: any) {
      toast.error('炼丹失败', { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const successColor = predictedRate >= 70 ? '#22c55e' : predictedRate >= 40 ? '#eab308' : '#ef4444';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="paper-texture overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="relative">
                  <FlaskConical className="w-4 h-4 text-primary" />
                  <Flame className="w-2.5 h-2.5 text-orange-500 absolute -top-1 -right-1 animate-pulse" />
                </div>
                炼丹炉
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                  <Coins className="w-2.5 h-2.5" />
                  {character.spiritStones || 0}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{materials.length} 材</Badge>
                <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2.5">
            {/* 炼丹规则提示 */}
            <div className="text-[10px] text-muted-foreground leading-relaxed rounded p-2 bg-muted/20 border border-dashed border-muted/40">
              <p className="font-serif-cn text-foreground/80 mb-0.5">炼丹之法</p>
              选 2-3 件材料入炉，消耗 {SPIRIT_STONE_COST} 灵石。成功率受悟性、灵根、材料品质影响。成则得丹药，败则得废丹。
            </div>

            {/* 材料选择 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground">选择材料（已选 {selected.length}/3）</span>
                {selected.length > 0 && (
                  <button
                    onClick={() => setSelected([])}
                    disabled={busy}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    清空
                  </button>
                )}
              </div>
              {materials.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/70 text-center py-3 bg-muted/10 rounded">
                  储物袋中无机缘材料，修行途中留意拾取。
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto xianxia-scroll pr-1">
                  {materials.map((m, i) => {
                    const isSel = selected.includes(m.id);
                    const el = materialElement(m);
                    return (
                      <button
                        key={m.id || i}
                        onClick={() => toggleMaterial(m.id)}
                        disabled={busy || (!isSel && selected.length >= 3)}
                        className={cn(
                          "text-left rounded-md border p-1.5 transition-all relative",
                          isSel ? "ring-1 ring-primary" : "hover:border-primary/40",
                          (!isSel && selected.length >= 3) && "opacity-40 cursor-not-allowed"
                        )}
                        style={{
                          borderColor: isSel ? RARITY_COLORS[m.rarity] : `${RARITY_COLORS[m.rarity] || '#6b7280'}40`,
                          background: isSel
                            ? `${RARITY_COLORS[m.rarity]}15`
                            : `${RARITY_COLORS[m.rarity] || '#6b7280'}08`,
                        }}
                      >
                        {isSel && (
                          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="w-2 h-2" />
                          </span>
                        )}
                        <div className="flex items-center gap-1 mb-0.5">
                          {el && (
                            <span
                              className="text-[9px] px-1 rounded font-bold"
                              style={{ background: `${el.color}20`, color: el.color }}
                            >
                              {el.zh}
                            </span>
                          )}
                          <span className="text-[10px] font-serif-cn truncate font-semibold" style={{ color: RARITY_COLORS[m.rarity] }}>
                            {m.name}
                          </span>
                        </div>
                        <div className="text-[9px] text-muted-foreground/70">
                          {RARITY_LABEL[m.rarity]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 成功率 + 灵石消耗 + 开炉按钮 */}
            {selected.length >= 2 && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-2 space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">预测成功率</span>
                  <span className="font-bold tabular-nums" style={{ color: successColor }}>
                    {predictedRate}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${predictedRate}%`,
                      background: `linear-gradient(90deg, ${successColor}, ${successColor}cc)`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">灵石消耗</span>
                  <span className={cn(
                    "font-semibold tabular-nums flex items-center gap-0.5",
                    (character.spiritStones || 0) >= SPIRIT_STONE_COST ? "text-foreground" : "text-destructive"
                  )}>
                    <Coins className="w-2.5 h-2.5" />
                    {SPIRIT_STONE_COST}
                  </span>
                </div>
                <button
                  onClick={doAlchemy}
                  disabled={!canAlchemy}
                  className={cn(
                    "w-full h-8 rounded-md text-xs font-serif-cn tracking-wider transition-all flex items-center justify-center gap-1.5",
                    canAlchemy
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md hover:shadow-primary/30"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {busy ? (
                    <><Loader2 className="w-3 h-3 animate-spin" />炼制中...</>
                  ) : (
                    <><Flame className="w-3 h-3" />开炉炼丹</>
                  )}
                </button>
              </div>
            )}

            {/* 上次炼丹结果 */}
            {lastResult && (
              <div
                className={cn(
                  "rounded-md p-2 border text-[10px] leading-relaxed",
                  lastResult.success
                    ? "border-amber-400/40 bg-amber-50/30"
                    : "border-muted/40 bg-muted/10"
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {lastResult.success ? (
                    <><Check className="w-3 h-3 text-amber-600" /><span className="font-serif-cn text-amber-700">丹成</span></>
                  ) : (
                    <><X className="w-3 h-3 text-muted-foreground" /><span className="font-serif-cn text-muted-foreground">丹败</span></>
                  )}
                  {lastResult.product && (
                    <Badge
                      variant="outline"
                      className="text-[9px] ml-auto"
                      style={{
                        borderColor: `${RARITY_COLORS[lastResult.product.rarity]}60`,
                        color: RARITY_COLORS[lastResult.product.rarity],
                        background: `${RARITY_COLORS[lastResult.product.rarity]}10`,
                      }}
                    >
                      {RARITY_LABEL[lastResult.product.rarity]}·{lastResult.product.name}
                    </Badge>
                  )}
                </div>
                <p className="font-serif-cn text-foreground/80">{lastResult.narrative}</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
