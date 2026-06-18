'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Store, X, Coins, Loader2, Package, ShoppingCart, ArrowUpCircle,
  Swords, Shield, Gem, Sparkles, BookOpen, FlaskConical, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatItemEffectLabel } from '@/lib/xianxia/display';

// 稀有度配色（与 InventoryPanel 保持一致）
const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#d4af37', mythic: '#ec4899',
};
const RARITY_LABEL: Record<string, string> = {
  common: '凡品', uncommon: '良品', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话',
};
const TYPE_ICON: Record<string, React.ReactNode> = {
  weapon: <Swords className="w-3 h-3" />,
  armor: <Shield className="w-3 h-3" />,
  accessory: <Gem className="w-3 h-3" />,
  artifact: <Sparkles className="w-3 h-3" />,
  scripture: <BookOpen className="w-3 h-3" />,
  consumable: <FlaskConical className="w-3 h-3" />,
  material: <Package className="w-3 h-3" />,
  tool: <Wrench className="w-3 h-3" />,
};
function fmtEffectZh(eff: any): string {
  return formatItemEffectLabel(eff);
}

interface MarketItem {
  id: string;
  name: string;
  description: string;
  item_type: string;
  rarity: string;
  price: number;
  effects: any[];
  source: string;
}

interface SellableItem {
  id: string;
  name: string;
  description: string;
  item_type: string;
  rarity: string;
  effects: any[];
  source: string;
  sellPrice: number;
}

export function MarketModal() {
  const { character, marketOpen, setMarketOpen, setCharacter } = useGameStore();
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [sellableItems, setSellableItems] = useState<SellableItem[]>([]);

  // 当弹窗打开时拉取坊市列表
  const fetchList = useCallback(async () => {
    if (!character) return;
    setLoading(true);
    try {
      const res = await fetch('/api/game/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, action: 'list' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '加载坊市失败');
      setMarketItems(data.marketItems || []);
      setSellableItems(data.sellableItems || []);
    } catch (err: any) {
      toast.error('坊市加载失败', { description: err.message });
      setMarketOpen(false);
    } finally {
      setLoading(false);
    }
  }, [character, setMarketOpen]);

  useEffect(() => {
    if (marketOpen && character) {
      fetchList();
    }
    // 关闭时清理
    if (!marketOpen) {
      setMarketItems([]);
      setSellableItems([]);
      setBusyId(null);
      setTab('buy');
    }
  }, [marketOpen, character, fetchList]);

  if (!character || !marketOpen) return null;

  const spiritStones = character.spiritStones || 0;
  const inventoryCount = character.inventory?.length || 0;
  const storageCapacity = character.storageCapacity || 5;
  const bagFull = inventoryCount >= storageCapacity;

  // 购买
  const buy = async (item: MarketItem) => {
    if (busyId || !character) return;
    if (spiritStones < item.price) {
      toast.error('灵石不足', { description: `需 ${item.price} 灵石，当前仅有 ${spiritStones}` });
      return;
    }
    if (bagFull) {
      toast.error('储物袋已满', { description: `容量 ${storageCapacity}/${storageCapacity}` });
      return;
    }
    setBusyId(item.id);
    try {
      const res = await fetch('/api/game/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          action: 'buy',
          itemId: item.id,
          item: {
            name: item.name,
            description: item.description,
            item_type: item.item_type,
            rarity: item.rarity,
            price: item.price,
            effects: item.effects,
          },
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '购买失败');
      // 更新角色状态（spiritStones + inventory 都会更新）
      setCharacter({ ...character, ...data.state });
      // 从坊市列表移除该物品
      setMarketItems(prev => prev.filter(it => it.id !== item.id));
      toast.success('购入成功', {
        description: `得「${data.boughtItem?.name || item.name}」，耗灵石 ${data.price}`,
      });
    } catch (err: any) {
      toast.error('购买失败', { description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  // 出售
  const sell = async (item: SellableItem) => {
    if (busyId || !character) return;
    setBusyId(item.id);
    try {
      const res = await fetch('/api/game/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          action: 'sell',
          itemId: item.id,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '出售失败');
      setCharacter({ ...character, ...data.state });
      setSellableItems(prev => prev.filter(it => it.id !== item.id));
      toast.success('售出成功', {
        description: `去「${data.soldItem?.name || item.name}」，得灵石 ${data.sellPrice}`,
      });
    } catch (err: any) {
      toast.error('出售失败', { description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const close = () => setMarketOpen(false);

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-0 sm:p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-md paper-texture border-amber-500/40 shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[92vh] rounded-none sm:rounded-lg overflow-hidden">
        {/* 顶部：坊市淘宝 + 关闭按钮 + 灵石数 */}
        <CardHeader className="pb-2 shrink-0 border-b border-amber-500/30 bg-amber-500/5">
          <CardTitle className="text-base flex items-center gap-2 font-serif-cn">
            <Store className="w-4 h-4 text-amber-600" />
            <span>坊市淘宝</span>
            <Badge
              variant="outline"
              className="ml-auto text-[11px] flex items-center gap-1 border-amber-500/50 text-amber-700 bg-amber-500/10"
            >
              <Coins className="w-3 h-3" />
              <span className="tabular-nums font-semibold">{spiritStones}</span>
              <span className="text-[9px] opacity-70">灵石</span>
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={close}
              className="w-7 h-7 shrink-0"
              aria-label="关闭坊市"
            >
              <X className="w-4 h-4" />
            </Button>
          </CardTitle>
          <div className="text-[10px] text-muted-foreground font-serif-cn flex items-center gap-1.5 mt-0.5">
            <Package className="w-3 h-3" />
            <span>储物袋 {inventoryCount}/{storageCapacity}</span>
            {bagFull && (
              <span className="text-destructive font-semibold">· 已满</span>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'buy' | 'sell')} className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 px-3 pt-2">
              <TabsList className="grid grid-cols-2 w-full h-9 bg-muted/40">
                <TabsTrigger value="buy" className="text-xs gap-1">
                  <ShoppingCart className="w-3 h-3" />
                  <span className="font-serif-cn">购买</span>
                </TabsTrigger>
                <TabsTrigger value="sell" className="text-xs gap-1">
                  <ArrowUpCircle className="w-3 h-3" />
                  <span className="font-serif-cn">出售</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* 购买 Tab */}
            <TabsContent value="buy" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
              <div className="h-full overflow-y-auto xianxia-scroll px-3 py-2 space-y-2 max-h-[calc(100dvh-180px)]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mb-2" />
                    <p className="text-xs font-serif-cn">坊市开张中...</p>
                  </div>
                ) : marketItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Store className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-xs font-serif-cn">坊市空空如也，请稍后再来</p>
                  </div>
                ) : (
                  marketItems.map(item => {
                    const color = RARITY_COLORS[item.rarity] || '#6b7280';
                    const canAfford = spiritStones >= item.price;
                    const disabled = !canAfford || bagFull || busyId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border bg-card/60 overflow-hidden transition-all"
                        style={{
                          borderColor: `${color}50`,
                          background: `linear-gradient(180deg, ${color}08, transparent)`,
                        }}
                      >
                        {/* 头部：名称 + 类型 + 稀有度 */}
                        <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2">
                          <span
                            className="shrink-0 w-5 h-5 rounded flex items-center justify-center"
                            style={{ background: `${color}20`, color }}
                          >
                            {TYPE_ICON[item.item_type] || <Package className="w-3 h-3" />}
                          </span>
                          <span
                            className="text-sm font-bold font-serif-cn truncate flex-1"
                            style={{ color }}
                          >
                            {item.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] shrink-0"
                            style={{
                              borderColor: `${color}60`,
                              color,
                              background: `${color}10`,
                            }}
                          >
                            {RARITY_LABEL[item.rarity]}
                          </Badge>
                        </div>
                        {/* 描述 */}
                        {item.description && (
                          <p className="px-3 pb-1.5 text-[11px] text-muted-foreground font-serif-cn leading-relaxed">
                            {item.description}
                          </p>
                        )}
                        {/* 效果 chips */}
                        {item.effects && item.effects.length > 0 && (
                          <div className="px-3 pb-2 flex flex-wrap gap-1">
                            {item.effects.map((eff: any, i: number) => fmtEffectZh(eff)).filter(Boolean).map((label: string, i: number) => (
                              <span
                                key={i}
                                className="text-[9px] px-1.5 py-0.5 rounded border bg-muted/30 text-foreground/80 font-serif-cn"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* 底部：价格 + 购买按钮 */}
                        <div className="px-3 pb-2.5 pt-0.5 flex items-center justify-between border-t border-border/30 bg-muted/10">
                          <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                            <Coins className="w-3 h-3" />
                            <span className="text-sm font-bold tabular-nums">{item.price}</span>
                          </div>
                          <button
                            onClick={() => buy(item)}
                            disabled={disabled}
                            className={cn(
                              "px-3 h-8 rounded-md text-xs font-serif-cn tracking-wider transition-all flex items-center gap-1",
                              disabled
                                ? "bg-muted text-muted-foreground cursor-not-allowed"
                                : "bg-amber-600 text-white hover:bg-amber-700 active:scale-95 shadow-sm"
                            )}
                          >
                            {busyId === item.id ? (
                              <><Loader2 className="w-3 h-3 animate-spin" />交易中</>
                            ) : !canAfford ? (
                              '灵石不足'
                            ) : bagFull ? (
                              '储物袋已满'
                            ) : (
                              <><ShoppingCart className="w-3 h-3" />购入</>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* 出售 Tab */}
            <TabsContent value="sell" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
              <div className="h-full overflow-y-auto xianxia-scroll px-3 py-2 space-y-2 max-h-[calc(100dvh-180px)]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mb-2" />
                    <p className="text-xs font-serif-cn">清点行囊中...</p>
                  </div>
                ) : sellableItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Package className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-xs font-serif-cn">身无长物</p>
                    <p className="text-[10px] opacity-70 mt-1 font-serif-cn">储物袋空空，无可售之物</p>
                  </div>
                ) : (
                  sellableItems.map(item => {
                    const color = RARITY_COLORS[item.rarity] || '#6b7280';
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border bg-card/60 overflow-hidden transition-all"
                        style={{
                          borderColor: `${color}50`,
                          background: `linear-gradient(180deg, ${color}08, transparent)`,
                        }}
                      >
                        <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2">
                          <span
                            className="shrink-0 w-5 h-5 rounded flex items-center justify-center"
                            style={{ background: `${color}20`, color }}
                          >
                            {TYPE_ICON[item.item_type] || <Package className="w-3 h-3" />}
                          </span>
                          <span
                            className="text-sm font-bold font-serif-cn truncate flex-1"
                            style={{ color }}
                          >
                            {item.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] shrink-0"
                            style={{
                              borderColor: `${color}60`,
                              color,
                              background: `${color}10`,
                            }}
                          >
                            {RARITY_LABEL[item.rarity]}
                          </Badge>
                        </div>
                        {item.description && (
                          <p className="px-3 pb-1.5 text-[11px] text-muted-foreground font-serif-cn leading-relaxed">
                            {item.description}
                          </p>
                        )}
                        {item.effects && item.effects.length > 0 && (
                          <div className="px-3 pb-2 flex flex-wrap gap-1">
                            {item.effects.map((eff: any, i: number) => fmtEffectZh(eff)).filter(Boolean).map((label: string, i: number) => (
                              <span
                                key={i}
                                className="text-[9px] px-1.5 py-0.5 rounded border bg-muted/30 text-foreground/80 font-serif-cn"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="px-3 pb-2.5 pt-0.5 flex items-center justify-between border-t border-border/30 bg-muted/10">
                          <div className="flex items-center gap-1 text-green-700 dark:text-green-500">
                            <Coins className="w-3 h-3" />
                            <span className="text-sm font-bold tabular-nums">{item.sellPrice}</span>
                            <span className="text-[9px] text-muted-foreground ml-0.5">估价</span>
                          </div>
                          <button
                            onClick={() => sell(item)}
                            disabled={busyId === item.id}
                            className={cn(
                              "px-3 h-8 rounded-md text-xs font-serif-cn tracking-wider transition-all flex items-center gap-1",
                              busyId === item.id
                                ? "bg-muted text-muted-foreground cursor-not-allowed"
                                : "bg-green-700 text-white hover:bg-green-800 active:scale-95 shadow-sm"
                            )}
                          >
                            {busyId === item.id ? (
                              <><Loader2 className="w-3 h-3 animate-spin" />交易中</>
                            ) : (
                              <><ArrowUpCircle className="w-3 h-3" />售出</>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* 底部说明栏 */}
          <div className="shrink-0 px-3 py-2 border-t border-amber-500/20 bg-amber-500/5 text-[10px] text-muted-foreground font-serif-cn leading-relaxed">
            <p className="flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
              坊市每访问一次便更新陈列；售出估价为原值六成，望君斟酌。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
