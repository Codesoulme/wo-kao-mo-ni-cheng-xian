'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown, Package, Swords, Shield, Gem, Sparkles, BookOpen,
  FlaskConical, Loader2, Hand, X, Check, Zap, Star, Heart, Brain, Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ITEM_TYPE_LABEL, SLOT_LABEL, itemToSlot, EquipSlot, ItemEntry, ItemType, StatusEntry,
} from '@/lib/xianxia/types';

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#d4af37', mythic: '#ec4899',
};
const RARITY_LABEL: Record<string, string> = {
  common: '凡品', uncommon: '良品', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话',
};

const SLOT_ICON: Record<EquipSlot, React.ReactNode> = {
  weapon: <Swords className="w-3.5 h-3.5" />,
  armor: <Shield className="w-3.5 h-3.5" />,
  accessory: <Gem className="w-3.5 h-3.5" />,
  artifact: <Sparkles className="w-3.5 h-3.5" />,
  scripture: <BookOpen className="w-3.5 h-3.5" />,
};

const SLOT_ORDER: EquipSlot[] = ['weapon', 'armor', 'accessory', 'artifact', 'scripture'];

// 特殊状态词条的图标映射（灵宠/命格/天赋/身份等）
function specialIcon(name: string): React.ReactNode {
  if (/灵宠|坐骑|妖兽|灵禽/.test(name)) return <Heart className="w-3.5 h-3.5" />;
  if (/命格|命格|命途|气运|天命/.test(name)) return <Crown className="w-3.5 h-3.5" />;
  if (/天赋|悟性|体质|灵体/.test(name)) return <Brain className="w-3.5 h-3.5" />;
  if (/身份|师承|宗门|职位/.test(name)) return <Star className="w-3.5 h-3.5" />;
  return <Sparkles className="w-3.5 h-3.5" />;
}

function fmtEffect(eff: any): string {
  if (eff.operation === 'add') return `${eff.target_attribute}${eff.value > 0 ? '+' : ''}${eff.value}`;
  if (eff.operation === 'multiply') return `${eff.target_attribute}×${eff.value}`;
  return `${eff.target_attribute}${eff.operation}${eff.value}`;
}

// 属性中文名映射（用于效果展示）
const ATTR_ZH: Record<string, string> = {
  attack: '攻击', defense: '防御', speed: '速度', hp: '气血', maxHp: '气血上限',
  mp: '灵力', maxMp: '灵力上限', luck: '气运', comprehension: '悟性',
  cultivationExp: '修为', lifespan: '寿元', spiritStones: '灵石', reputation: '声望',
  elementMetal: '金', elementWood: '木', elementWater: '水', elementFire: '火', elementEarth: '土',
};
function attrZh(attr: string): string {
  return ATTR_ZH[attr] || attr;
}
function fmtEffectZh(eff: any): string {
  const zh = attrZh(eff.target_attribute);
  if (eff.operation === 'add') return `${zh}${eff.value > 0 ? '+' : ''}${eff.value}`;
  if (eff.operation === 'multiply') return `${zh}×${eff.value}`;
  return `${zh}${eff.operation}${eff.value}`;
}

export function InventoryPanel() {
  const { character, setCharacter } = useGameStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [bagOpen, setBagOpen] = useState(true);
  const [specialOpen, setSpecialOpen] = useState(true);

  if (!character) return null;

  const equipped = (character.equipped || {}) as Partial<Record<EquipSlot, ItemEntry>>;
  const inventory = character.inventory || [];
  const activeStatuses: StatusEntry[] = character.activeStatuses || [];

  const doAction = async (action: 'equip' | 'unequip' | 'use', payload: { itemId?: string; slot?: string }) => {
    if (!character) return;
    const key = payload.itemId || payload.slot || action;
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
      toast.success(data.message);
    } catch (err: any) {
      toast.error('操作失败', { description: err.message });
    } finally {
      setBusy(null);
    }
  };

  // 储物袋按类型分组
  const grouped: Record<string, ItemEntry[]> = {};
  for (const it of inventory) {
    const t = it.item_type || 'material';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(it);
  }
  const groupOrder: ItemType[] = ['scripture', 'weapon', 'armor', 'accessory', 'artifact', 'consumable', 'material', 'tool'];

  // 修炼速度加成拆解
  const rootMult = character.rootMultiplier ?? 0;
  const totalMult = character.cultivationMultiplier ?? 0;
  // 功法贡献：从已装备的 scripture 里提取 multiply cultivationExp
  const scriptureContribs: { name: string; mult: number; rarity: string }[] = [];
  const scripture = equipped.scripture;
  let scriptureMult = 1;
  if (scripture) {
    for (const eff of scripture.effects || []) {
      if (eff.target_attribute === 'cultivationExp' && eff.operation === 'multiply' && eff.value > 0) {
        scriptureMult *= eff.value;
        scriptureContribs.push({ name: scripture.name, mult: eff.value, rarity: scripture.rarity });
      }
    }
  }
  // 总倍率 = 灵根 × 功法（与 engine recalcCultivationMultiplier 一致）
  const computedTotal = rootMult * scriptureMult;

  // 特殊状态词条：category 为 special/identity 的（灵宠、命格、天赋、身份等）
  const specialStatuses = activeStatuses.filter(s => s.category === 'special' || s.category === 'identity');

  return (
    <div className="space-y-3 pb-2">
      {/* 修炼速度概览 —— 拆解加成来源 */}
      <Card className="paper-texture">
        <CardHeader className="pb-1.5 pt-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              修炼速度
            </span>
            <span className="text-base font-bold tabular-nums" style={{ color: totalMult > 0 ? '#c8453c' : '#6b7280' }}>
              ×{totalMult.toFixed(2)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-1 space-y-1.5">
          {/* 加成拆解公式 */}
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-muted/40">灵根</span>
            <span className="tabular-nums font-semibold" style={{ color: rootMult > 0 ? '#c8453c' : '#6b7280' }}>×{rootMult.toFixed(2)}</span>
            <span className="opacity-50">×</span>
            <span className="px-1.5 py-0.5 rounded bg-muted/40">功法</span>
            <span className="tabular-nums font-semibold" style={{ color: scriptureMult > 1 ? '#c8453c' : '#6b7280' }}>×{scriptureMult.toFixed(2)}</span>
            <span className="opacity-50">=</span>
            <span className="tabular-nums font-bold" style={{ color: totalMult > 0 ? '#c8453c' : '#6b7280' }}>×{computedTotal.toFixed(2)}</span>
          </div>
          {/* 功法贡献明细 */}
          {scriptureContribs.length > 0 ? (
            <div className="space-y-1">
              {scriptureContribs.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] rounded px-1.5 py-1" style={{
                  background: `${RARITY_COLORS[s.rarity] || '#6b7280'}10`,
                }}>
                  <span className="flex items-center gap-1 truncate">
                    <BookOpen className="w-3 h-3 shrink-0" style={{ color: RARITY_COLORS[s.rarity] }} />
                    <span className="font-serif-cn truncate" style={{ color: RARITY_COLORS[s.rarity] }}>{s.name}</span>
                  </span>
                  <span className="tabular-nums font-semibold shrink-0" style={{ color: RARITY_COLORS[s.rarity] }}>
                    修为 ×{s.mult.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              未装备功法。获得功法类物品后可在储物袋装备，提升修为获取效率。
            </p>
          )}
          <p className="text-[9px] text-muted-foreground/60 leading-relaxed pt-0.5">
            每岁修为增量 = 基础修为 × 修炼速度。灵根决定基础倍率，功法可进一步放大。
          </p>
        </CardContent>
      </Card>

      {/* 已装备 - 5 槽位 */}
      <Card className="paper-texture">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              已装备
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {Object.keys(equipped).filter(k => equipped[k as EquipSlot]).length}/5
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-1.5">
          {SLOT_ORDER.map(slot => {
            const item = equipped[slot];
            const isBusy = busy === slot;
            return (
              <div
                key={slot}
                className={cn(
                  "rounded-md border p-2 flex items-center gap-2 transition-all",
                  item ? "bg-card/60" : "bg-muted/20 border-dashed"
                )}
                style={item ? {
                  borderColor: `${RARITY_COLORS[item.rarity] || '#6b7280'}40`,
                } : undefined}
              >
                <div className={cn(
                  "shrink-0 w-7 h-7 rounded flex items-center justify-center",
                  item ? "" : "bg-muted/40 text-muted-foreground"
                )} style={item ? { color: RARITY_COLORS[item.rarity] } : undefined}>
                  {SLOT_ICON[slot]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground w-8 shrink-0">{SLOT_LABEL[slot]}</span>
                    {item ? (
                      <span className="text-xs font-semibold font-serif-cn truncate" style={{ color: RARITY_COLORS[item.rarity] }}>
                        {item.name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60">空</span>
                    )}
                  </div>
                  {item && item.effects && item.effects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {item.effects.map((e: any, j: number) => (
                        <span key={j} className="text-[9px] px-1 py-0 rounded bg-primary/10 text-primary">
                          {fmtEffectZh(e)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {item && (
                  <button
                    onClick={() => doAction('unequip', { slot })}
                    disabled={isBusy}
                    className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    title="卸下"
                  >
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  </button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 储物袋 - 分类展示 + 操作 */}
      <Collapsible open={bagOpen} onOpenChange={setBagOpen}>
        <Card className="paper-texture">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-accent" />
                  储物袋
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{inventory.length}</Badge>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", bagOpen && "rotate-180")} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
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
                          const canEquip = !!slot;
                          const canUse = item.item_type === 'consumable';
                          const isBusy = busy === item.id;
                          return (
                            <div
                              key={item.id || i}
                              className="rounded-md border p-2"
                              style={{
                                borderColor: `${RARITY_COLORS[item.rarity] || '#6b7280'}40`,
                                background: `${RARITY_COLORS[item.rarity] || '#6b7280'}08`,
                              }}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-semibold font-serif-cn truncate" style={{ color: RARITY_COLORS[item.rarity] }}>
                                  {item.name}
                                </span>
                                <span className="text-[9px] px-1 rounded shrink-0 ml-1" style={{
                                  background: `${RARITY_COLORS[item.rarity]}20`,
                                  color: RARITY_COLORS[item.rarity],
                                }}>
                                  {RARITY_LABEL[item.rarity] || item.rarity}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-relaxed mb-1">{item.description}</p>
                              {item.effects && item.effects.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1.5">
                                  {item.effects.map((e: any, j: number) => (
                                    <span key={j} className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">
                                      {fmtEffectZh(e)}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(canEquip || canUse) && (
                                <div className="flex items-center gap-1.5">
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

      {/* 奇缘异宝 —— 特殊状态词条（灵宠/命格/天赋/身份等，AI 可通过 newStatuses 联动修改） */}
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
                  尚无奇缘。修行途中或获灵宠、或得命格、或觉醒天赋，皆显示于此。
                </p>
              ) : (
                specialStatuses.map((s, i) => (
                  <div
                    key={s.id || i}
                    className="rounded-md border p-2"
                    style={{
                      borderColor: `${RARITY_COLORS[s.rarity] || '#6b7280'}40`,
                      background: `${RARITY_COLORS[s.rarity] || '#6b7280'}08`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold font-serif-cn truncate" style={{ color: RARITY_COLORS[s.rarity] }}>
                        {specialIcon(s.name)}
                        {s.name}
                      </span>
                      <span className="text-[9px] px-1 rounded shrink-0 ml-1" style={{
                        background: `${RARITY_COLORS[s.rarity]}20`,
                        color: RARITY_COLORS[s.rarity],
                      }}>
                        {RARITY_LABEL[s.rarity] || s.rarity}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mb-1">{s.description}</p>
                    {s.effects && s.effects.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {s.effects.map((e: any, j: number) => (
                          <span key={j} className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">
                            {fmtEffectZh(e)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground/70">
                      <span>来源：{s.source || '未知'}</span>
                      <span>{s.duration === -1 ? '永久' : `剩余 ${s.duration} 岁`}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
