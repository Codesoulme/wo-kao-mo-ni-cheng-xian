'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown, Package, Swords, Shield, Gem, Sparkles, BookOpen,
  FlaskConical, Loader2, Hand, X, Check, Star, Heart, Brain, Crown, Wrench, Backpack, Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ITEM_TYPE_LABEL, itemToSlot, ItemType, StatusEntry,
} from '@/lib/xianxia/types';
import { AlchemyFurnace } from './AlchemyFurnace';
import { ItemDetailDialog } from './ItemDetailDialog';
import { FormationPanel } from './FormationPanel';
import { PetPanel } from './PetPanel';
import { formatItemEffectLabel } from '@/lib/xianxia/display';
import { filterMeaningfulStatuses } from '@/lib/xianxia/engine';

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#d4af37', mythic: '#ec4899',
};
const RARITY_LABEL: Record<string, string> = {
  common: '凡品', uncommon: '良品', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话',
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

// 特殊状态的图标映射（灵宠/命格/天赋/身份等）
function specialIcon(name: string): React.ReactNode {
  if (/灵宠|坐骑|妖兽|灵禽/.test(name)) return <Heart className="w-3.5 h-3.5" />;
  if (/命格|命途|气运|天命/.test(name)) return <Crown className="w-3.5 h-3.5" />;
  if (/天赋|悟性|体质|灵体/.test(name)) return <Brain className="w-3.5 h-3.5" />;
  if (/身份|师承|宗门|职位/.test(name)) return <Star className="w-3.5 h-3.5" />;
  return <Sparkles className="w-3.5 h-3.5" />;
}

function fmtEffectZh(eff: any): string {
  return formatItemEffectLabel(eff);
}

// 判定物品是否是储物袋（含 storageCapacity 效果的 tool）
function isStorageBag(item: any): boolean {
  if (!item || item.item_type !== 'tool') return false;
  return (item.effects || []).some((e: any) => e.target_attribute === 'storageCapacity' && e.operation === 'add' && e.value > 0);
}

export function InventoryPanel() {
  const { character, setCharacter } = useGameStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [bagOpen, setBagOpen] = useState(true);
  const [specialOpen, setSpecialOpen] = useState(true);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  if (!character) return null;

  const equippedList: any[] = Array.isArray(character.equipped) ? character.equipped : [];
  const inventory: any[] = character.inventory || [];
  const activeStatuses: StatusEntry[] = filterMeaningfulStatuses(character.activeStatuses || []) as StatusEntry[];

  const doAction = async (action: 'equip' | 'unequip' | 'use', payload: { itemId?: string }) => {
    if (!character) return;
    const key = payload.itemId || action;
    setBusy(key);
    try {
      const res = await fetch('/api/game/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, action, ...payload }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '操作失败');
      setCharacter({ ...character, ...data.state });
      if (data.narrative) {
        toast.success(data.message, { description: data.narrative });
      } else {
        toast.success(data.message);
      }
    } catch (err: any) {
      toast.error('操作失败', { description: err.message });
    } finally {
      setBusy(null);
    }
  };

  // 打开物品详情弹窗
  const openDetail = (item: any) => {
    setDetailItem(item);
    setDetailOpen(true);
  };

  // 储物袋按类型分组
  const grouped: Record<string, any[]> = {};
  for (const it of inventory) {
    const t = it.item_type || 'material';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(it);
  }
  const groupOrder: ItemType[] = ['scripture', 'weapon', 'armor', 'accessory', 'artifact', 'consumable', 'tool', 'material'];

  // 储物袋容量
  const storageCap = character.storageCapacity ?? 5;
  const invCount = inventory.length;
  const hasBag = inventory.some(i => isStorageBag(i));
  const capacityRatio = storageCap > 0 ? invCount / storageCap : 0;
  const capacityWarn = capacityRatio >= 1;
  const capacityNearFull = capacityRatio >= 0.8 && !capacityWarn;

  // 特殊状态
  const specialStatuses = activeStatuses.filter(s => s.category === 'special' || s.category === 'identity');

  // 习得的法术：当前已装备/修习的功法、法宝可在斗法中施展
  const learnedArts = equippedList
    .filter(it => it.item_type === 'scripture' || it.item_type === 'artifact')
    .map(it => ({
      ...it,
      mpCost: Math.max(5, Math.floor((it.rarity === 'mythic' ? 30 : it.rarity === 'legendary' ? 25 : it.rarity === 'epic' ? 20 : it.rarity === 'rare' ? 15 : 10))),
      power: 1 + ((['common','uncommon','rare','epic','legendary','mythic'].indexOf(it.rarity) >= 0 ? ['common','uncommon','rare','epic','legendary','mythic'].indexOf(it.rarity) : 0) * 0.5),
    }));

  return (
    <div className="space-y-3 pb-2">
      {/* ==================== 已装备（数组，无固定槽位） ==================== */}
      <Card className="paper-texture">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              已装备
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {equippedList.length} 件
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-1.5">
          {equippedList.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              身无长物。获得装备后可在储物袋装备。
            </p>
          ) : (
            equippedList.map((item, i) => {
              const isBusy = busy === item.id;
              const color = RARITY_COLORS[item.rarity] || '#6b7280';
              return (
                <div
                  key={item.id || i}
                  className="rounded-md border p-2 flex items-center gap-2 transition-all cursor-pointer hover:bg-muted/30"
                  style={{
                    borderColor: `${color}40`,
                    background: `${color}08`,
                  }}
                  onClick={() => openDetail(item)}
                >
                  <div
                    className="shrink-0 w-7 h-7 rounded flex items-center justify-center"
                    style={{ background: `${color}15`, color }}
                  >
                    {TYPE_ICON[item.item_type] || <Package className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-xs font-semibold font-serif-cn truncate"
                        style={{ color }}
                      >
                        {item.name}
                      </span>
                      {item.equipNote && (
                        <span
                          className="text-[9px] px-1 py-0 rounded shrink-0"
                          style={{ background: `${color}20`, color: `${color}cc` }}
                        >
                          {item.equipNote}
                        </span>
                      )}
                    </div>
                    {item.effects && item.effects.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {item.effects.slice(0, 3).map((e: any, j: number) => fmtEffectZh(e)).filter(Boolean).map((label: string, j: number) => (
                          <span
                            key={j}
                            className="text-[9px] px-1 py-0 rounded"
                            style={{
                              background: '#3b82f615',
                              color: '#3b82f6',
                            }}
                          >
                            {label}
                          </span>
                        ))}
                        {item.effects.length > 3 && (
                          <span className="text-[9px] text-muted-foreground">+{item.effects.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); doAction('unequip', { itemId: item.id }); }}
                    disabled={isBusy}
                    className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    title="卸下"
                  >
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  </button>
                </div>
              );
            })
          )}
          <p className="text-[9px] text-muted-foreground/60 leading-relaxed pt-1 px-0.5">
            点击装备查看详情。
          </p>
        </CardContent>
      </Card>

      {/* ==================== 习得的法术 ==================== */}
      <Card className="paper-texture">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" />
              习得的法术
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {learnedArts.length} 门
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-1.5">
          {learnedArts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              尚未修习可用于斗法的功法或法宝。装备功法、法宝后，此处会显现可施展之术。
            </p>
          ) : (
            learnedArts.map((art, i) => {
              const color = RARITY_COLORS[art.rarity] || '#6b7280';
              return (
                <div
                  key={art.id || i}
                  className="rounded-md border p-2 cursor-pointer transition-all hover:bg-muted/30"
                  style={{ borderColor: `${color}40`, background: `${color}08` }}
                  onClick={() => openDetail(art)}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <BookOpen className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                      <span className="text-xs font-semibold font-serif-cn truncate" style={{ color }}>
                        {art.name}
                      </span>
                    </span>
                    <span className="text-[9px] px-1 rounded shrink-0" style={{ background: `${color}20`, color }}>
                      {art.item_type === 'artifact' ? '法宝术' : '功法术'}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                    {art.description || '此术含而未发，斗法时可调动其灵机。'}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">耗灵 {art.mpCost}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-accent/10 text-accent">威势 ×{art.power.toFixed(1)}</span>
                    {art.equipNote && <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{art.equipNote}</span>}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ==================== 储物袋（含容量显示） ==================== */}
      <Collapsible open={bagOpen} onOpenChange={setBagOpen}>
        <Card className="paper-texture">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Backpack className="w-4 h-4 text-accent" />
                  储物袋
                </span>
                <div className="flex items-center gap-2">
                  {/* 容量徽章 */}
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded tabular-nums",
                      capacityWarn
                        ? "bg-destructive/15 text-destructive"
                        : capacityNearFull
                          ? "bg-amber-500/15 text-amber-700"
                          : "bg-muted/40 text-muted-foreground"
                    )}
                    title={hasBag ? '已有储物袋' : '无储物袋，上限仅 5 件'}
                  >
                    {invCount}/{storageCap}
                    {!hasBag && <span className="opacity-60"> · 无袋</span>}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", bagOpen && "rotate-180")} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              {/* 容量警告条 */}
              {capacityWarn && (
                <div className="text-[10px] px-2 py-1.5 rounded bg-destructive/10 text-destructive border border-destructive/30">
                  储物袋已满，无法再装新物。需获更大的储物袋或消耗现有物品。
                </div>
              )}
              {capacityNearFull && (
                <div className="text-[10px] px-2 py-1.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/30">
                  储物袋将满，仅余 {storageCap - invCount} 格。
                </div>
              )}

              {inventory.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">储物袋空空如也</p>
              ) : (
                groupOrder.map(type => {
                  const items = grouped[type];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={type}>
                      <div className="text-[10px] text-muted-foreground mb-1 px-0.5 flex items-center gap-1">
                        <span className="font-serif-cn">{ITEM_TYPE_LABEL[type] || type}</span>
                        <span className="opacity-50">·</span>
                        <span>{items.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {items.map((item, i) => {
                          const slot = itemToSlot(item.item_type);
                          const canEquip = !!slot && !isStorageBag(item);
                          const canUse = item.item_type === 'consumable';
                          const isBusy = busy === item.id;
                          const color = RARITY_COLORS[item.rarity] || '#6b7280';
                          const bag = isStorageBag(item);
                          return (
                            <div
                              key={item.id || i}
                              className="rounded-md border p-2 cursor-pointer transition-all hover:bg-muted/30"
                              style={{
                                borderColor: `${color}40`,
                                background: `${color}08`,
                              }}
                              onClick={() => openDetail(item)}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <span style={{ color }}>{TYPE_ICON[item.item_type] || <Package className="w-3.5 h-3.5" />}</span>
                                  <span className="text-xs font-semibold font-serif-cn truncate" style={{ color }}>
                                    {item.name}
                                  </span>
                                  {bag && (
                                    <span className="text-[9px] px-1 py-0 rounded shrink-0 bg-accent/20 text-accent">
                                      储物袋
                                    </span>
                                  )}
                                </span>
                                <span
                                  className="text-[9px] px-1 rounded shrink-0 ml-1"
                                  style={{ background: `${color}20`, color }}
                                >
                                  {RARITY_LABEL[item.rarity] || item.rarity}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-relaxed mb-1">{item.description}</p>
                              {item.effects && item.effects.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1.5">
                                  {item.effects
                                    .map((eff: any, j: number) => ({ eff, label: fmtEffectZh(eff), j }))
                                    .filter((x: { label: string }) => Boolean(x.label))
                                    .map(({ eff, label, j }: { eff: any; label: string; j: number }) => (
                                      <span
                                        key={j}
                                        className="text-[9px] px-1 py-0.5 rounded"
                                        style={{
                                          background: eff.operation === 'multiply' ? '#c8453c15' : '#3b82f615',
                                          color: eff.operation === 'multiply' ? '#c8453c' : '#3b82f6',
                                        }}
                                      >
                                        {label}
                                      </span>
                                    ))}
                                </div>
                              )}
                              {(canEquip || canUse) && (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  {canEquip && (
                                    <button
                                      onClick={() => doAction('equip', { itemId: item.id })}
                                      disabled={isBusy}
                                      className="text-[10px] px-2 py-0.5 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 disabled:opacity-50"
                                    >
                                      {isBusy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                                      装备
                                    </button>
                                  )}
                                  {canUse && (
                                    <button
                                      onClick={() => doAction('use', { itemId: item.id })}
                                      disabled={isBusy}
                                      className="text-[10px] px-2 py-0.5 rounded border border-accent/40 text-accent hover:bg-accent/10 transition-colors flex items-center gap-1 disabled:opacity-50"
                                    >
                                      {isBusy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Hand className="w-2.5 h-2.5" />}
                                      使用
                                    </button>
                                  )}
                                </div>
                              )}
                              {item.source && (
                                <div className="text-[9px] text-muted-foreground/70 mt-1">来源：{item.source}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>


      {/* Task 21: 阵法管理面板 */}
      <FormationPanel />

      {/* Task 23: 灵宠管理面板 */}
      <PetPanel />


      {/* 炼丹炉 */}
      <AlchemyFurnace />

      {/* 奇缘异宝 */}
      <Collapsible open={specialOpen} onOpenChange={setSpecialOpen}>
        <Card className="paper-texture">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" />
                  奇缘异宝
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{specialStatuses.length}</Badge>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", specialOpen && "rotate-180")} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-1.5">
              {specialStatuses.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  尚无奇缘异宝。灵根、伤势、心境等常规状态请看「状态」页；此处只收录灵宠、命格、身份、特殊体质等长期奇缘。
                </p>
              ) : (
                specialStatuses.map((s, i) => {
                  const color = RARITY_COLORS[s.rarity] || '#6b7280';
                  return (
                    <div
                      key={s.id || i}
                      className="rounded-md border p-2"
                      style={{
                        borderColor: `${color}40`,
                        background: `${color}08`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="flex items-center gap-1.5 text-xs font-semibold font-serif-cn truncate" style={{ color }}>
                          {specialIcon(s.name)}
                          {s.name}
                        </span>
                        <span className="text-[9px] px-1 rounded shrink-0 ml-1" style={{
                          background: `${color}20`, color,
                        }}>
                          {RARITY_LABEL[s.rarity] || s.rarity}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed mb-1">{s.description}</p>
                      {s.effects && s.effects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {s.effects
                            .map((eff: any, j: number) => ({ eff, label: fmtEffectZh(eff), j }))
                            .filter((x: { label: string }) => Boolean(x.label))
                            .map(({ eff, label, j }: { eff: any; label: string; j: number }) => (
                              <span
                                key={j}
                                className="text-[9px] px-1 py-0.5 rounded"
                                style={{
                                  background: eff.operation === 'multiply' ? '#c8453c15' : '#3b82f615',
                                  color: eff.operation === 'multiply' ? '#c8453c' : '#3b82f6',
                                }}
                              >
                                {label}
                              </span>
                            ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground/70">
                        <span>来源：{s.source || '未知'}</span>
                        <span>{s.duration === -1 ? '永久' : `剩余 ${s.duration} 岁`}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 物品详情弹窗 */}
      <ItemDetailDialog
        item={detailItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        equipped={equippedList.some(it => it.id === detailItem?.id)}
        onUnequip={() => detailItem && doAction('unequip', { itemId: detailItem.id })}
        canEquip={detailItem ? !!itemToSlot(detailItem.item_type) && !isStorageBag(detailItem) : false}
        onEquip={() => detailItem && doAction('equip', { itemId: detailItem.id })}
        canUse={detailItem?.item_type === 'consumable'}
        onUse={() => detailItem && doAction('use', { itemId: detailItem.id })}
      />
    </div>
  );
}
