'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Heart, ChevronDown, Bone, Sword, Shield, Footprints, Loader2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// 灵宠物种图标（用 lucide 替代，简化为大致分类）
function speciesIcon(species: string) {
  // 全部用 Bone 图标作为通用灵宠图标
  return <Bone className="w-3.5 h-3.5" />;
}

// 稀有度颜色（避开 indigo/blue）
const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',     // 灰
  uncommon: '#84cc16',   // 绿
  rare: '#eab308',       // 黄
  epic: '#f97316',       // 橙
  legendary: '#dc2626',  // 红
  mythic: '#a855f7',     // 紫
};
const RARITY_LABEL: Record<string, string> = {
  common: '凡品', uncommon: '良品', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话',
};

const SPECIES_LABEL: Record<string, string> = {
  fox: '灵狐', wolf: '灵狼', snake: '灵蛇', turtle: '灵龟', eagle: '灵鹰', ape: '灵猿',
  spider: '灵蛛', butterfly: '灵蝶', fish: '灵鱼', tiger: '灵虎', phoenix: '火凤', dragon: '幼龙',
};

const ELEMENT_LABEL: Record<string, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
};
const ELEMENT_COLOR: Record<string, string> = {
  metal: '#d4d4d8', wood: '#65a30d', water: '#0891b2', fire: '#dc2626', earth: '#a16207',
};

// 忠诚度分级
function loyaltyTier(loyalty: number): { label: string; color: string } {
  if (loyalty >= 80) return { label: '死忠', color: '#22c55e' };
  if (loyalty >= 60) return { label: '亲近', color: '#84cc16' };
  if (loyalty >= 40) return { label: '顺从', color: '#eab308' };
  if (loyalty >= 30) return { label: '勉强', color: '#f97316' };
  return { label: '离心', color: '#ef4444' };
}

// 饱食度分级
function satietyTier(satiety: number): { label: string; color: string } {
  if (satiety >= 70) return { label: '饱腹', color: '#22c55e' };
  if (satiety >= 40) return { label: '半饱', color: '#eab308' };
  if (satiety >= 20) return { label: '饥饿', color: '#f97316' };
  return { label: '濒饿', color: '#ef4444' };
}

export function PetPanel() {
  const { character, setCharacter, setLoading, setError } = useGameStore();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expandedPetId, setExpandedPetId] = useState<string | null>(null);
  const [dismissTarget, setDismissTarget] = useState<{ id: string; name: string } | null>(null);

  if (!character) return null;
  const pets = character.pets || [];

  // 可用于喂养的物品（材料 / 丹药 / 工具类）
  const feedableItems = (character.inventory || []).filter(
    (it: any) => it.item_type === 'material' || it.item_type === 'consumable' || it.item_type === 'tool'
  );

  const feedPet = async (petId: string, itemId: string) => {
    if (busy) return;
    setBusy(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/game/pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          action: 'feed',
          petId,
          itemId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '喂养失败');
      if (data.state) setCharacter({ ...character, ...data.state });
      toast.success(`灵宠${data.pet?.name || ''}喂养成功`);
    } catch (err: any) {
      setError(err?.message || '喂养失败');
      toast.error(err?.message || '喂养失败');
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  const requestDismissPet = (petId: string, petName: string) => {
    if (busy) return;
    setDismissTarget({ id: petId, name: petName });
  };

  const dismissPet = async () => {
    if (busy || !dismissTarget) return;
    const petId = dismissTarget.id;
    const petName = dismissTarget.name;
    setBusy(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/game/pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          action: 'dismiss',
          petId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '\u653e\u5f52\u5931\u8d25');
      if (data.state) setCharacter({ ...character, ...data.state });
      toast.success(`\u5df2\u653e\u5f52\u300c${petName}\u300d`);
      setDismissTarget(null);
    } catch (e: any) {
      setError(e.message);
      toast.error('\u653e\u5f52\u5931\u8d25', { description: e.message });
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="paper-texture">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                灵宠
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{pets.length}</Badge>
                <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-1.5">
            {pets.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 leading-relaxed">
                尚无灵宠。修仙途中可收服妖兽幼崽、前辈相赠、灵宠店购买等途径获得。
                <br />
                灵宠可参战、护院、增加修炼效率，但需定期喂养（消耗材料）维持忠诚。
              </p>
            ) : (
              pets.map((pet: any, i: number) => {
                const color = RARITY_COLORS[pet.rarity] || '#6b7280';
                const loy = loyaltyTier(pet.loyalty);
                const sat = satietyTier(pet.satiety);
                const elemColor = ELEMENT_COLOR[pet.element] || '#6b7280';
                const isExpanded = expandedPetId === pet.id;
                return (
                  <div
                    key={pet.id || i}
                    className="rounded-md border p-2 transition-all"
                    style={{
                      borderColor: `${color}40`,
                      background: `${color}08`,
                    }}
                  >
                    {/* 标题行 */}
                    <div className="flex items-center justify-between mb-1">
                      <button
                        className="flex items-center gap-1.5 text-xs font-semibold font-serif-cn truncate hover:opacity-80 transition-opacity"
                        style={{ color }}
                        onClick={() => setExpandedPetId(isExpanded ? null : pet.id)}
                      >
                        {speciesIcon(pet.species)}
                        {pet.name}
                        <span className="text-[9px] px-1 rounded ml-0.5" style={{
                          background: `${elemColor}25`, color: elemColor,
                        }}>
                          {ELEMENT_LABEL[pet.element] || pet.element}
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] px-1 rounded shrink-0" style={{
                          background: `${color}20`, color,
                        }}>
                          {RARITY_LABEL[pet.rarity] || pet.rarity}
                        </span>
                        <span className="text-[9px] text-muted-foreground/70 shrink-0">Lv.{pet.level}</span>
                        <button
                          onClick={() => requestDismissPet(pet.id, pet.name)}
                          disabled={busy}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                          title="放生"
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {/* 状态条 */}
                    <div className="grid grid-cols-2 gap-1 text-[9px] mb-1">
                      <div className="flex items-center gap-1" title={`忠诚度 ${pet.loyalty}/100`}>
                        <Heart className="w-2.5 h-2.5" style={{ color: loy.color }} />
                        <span style={{ color: loy.color }}>{loy.label}</span>
                        <span className="text-muted-foreground/60">{pet.loyalty}</span>
                      </div>
                      <div className="flex items-center gap-1" title={`饱食度 ${pet.satiety}/100`}>
                        <Bone className="w-2.5 h-2.5" style={{ color: sat.color }} />
                        <span style={{ color: sat.color }}>{sat.label}</span>
                        <span className="text-muted-foreground/60">{pet.satiety}</span>
                      </div>
                    </div>

                    {/* HP 条 */}
                    <div className="flex items-center gap-1 mb-1">
                      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(0, Math.min(100, (pet.hp / pet.maxHp) * 100))}%`,
                            background: '#22c55e',
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground tabular-nums">
                        {pet.hp}/{pet.maxHp}
                      </span>
                    </div>

                    {/* 简要属性 */}
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground/80 mb-1">
                      <span className="flex items-center gap-0.5">
                        <Sword className="w-2.5 h-2.5" />{pet.attack}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" />{pet.defense}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Footprints className="w-2.5 h-2.5" />{pet.speed}
                      </span>
                    </div>

                    {/* 展开详情：技能 + 喂养按钮 */}
                    {isExpanded && (
                      <div className="space-y-1.5 pt-1 mt-1 border-t border-border/30">
                        <div>
                          <div className="text-[9px] text-muted-foreground/60 mb-0.5">主动技能</div>
                          <div className="text-[10px] font-serif-cn font-semibold" style={{ color }}>
                            {pet.skill?.name || '—'}
                          </div>
                          <div className="text-[9px] text-muted-foreground/70 leading-relaxed">
                            {pet.skill?.description || ''}
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60 mt-0.5">
                            <span>威力 ×{pet.skill?.power || 1}</span>
                            <span>冷却 {pet.skill?.cooldown || 0} 回合</span>
                          </div>
                        </div>
                        <div className="text-[9px] text-muted-foreground/60">
                          {pet.description}
                        </div>
                        <div className="text-[9px] text-muted-foreground/60">
                          来源：{pet.sourceAcquired} · {pet.acquiredAge}岁得
                        </div>
                        <div className="text-[9px] text-muted-foreground/60">
                          经验：{pet.exp}/{pet.expToLevel}
                        </div>

                        {/* 喂养按钮 */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={busy || feedableItems.length === 0}
                              className={cn(
                                "w-full text-[10px] py-1 rounded border transition-all",
                                "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60",
                                "text-amber-700 dark:text-amber-400 font-serif-cn font-semibold",
                                "flex items-center justify-center gap-1",
                                (busy || feedableItems.length === 0) && "opacity-40 cursor-not-allowed"
                              )}
                            >
                              <Bone className="w-3 h-3" />
                              喂养 {feedableItems.length > 0 ? `(${feedableItems.length}物可喂)` : '(无可喂物)'}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-56 max-h-72 overflow-y-auto">
                            <div className="text-[10px] text-muted-foreground px-2 py-1 font-serif-cn">
                              选择物品喂养（消耗该物品）
                            </div>
                            {feedableItems.length === 0 ? (
                              <DropdownMenuItem disabled>储物袋中无可喂养物品</DropdownMenuItem>
                            ) : (
                              feedableItems.map((it: any, j: number) => {
                                const itColor = RARITY_COLORS[it.rarity] || '#6b7280';
                                return (
                                  <DropdownMenuItem
                                    key={it.id || j}
                                    onClick={() => feedPet(pet.id, it.id)}
                                    disabled={busy}
                                    className="flex items-start gap-2 py-1.5"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-semibold font-serif-cn flex items-center gap-1">
                                        <span style={{ color: itColor }}>{it.name}</span>
                                        <span className="text-[9px] px-1 rounded" style={{
                                          background: `${itColor}20`, color: itColor,
                                        }}>
                                          {RARITY_LABEL[it.rarity] || it.rarity}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-muted-foreground truncate">
                                        {it.description || it.item_type}
                                      </div>
                                    </div>
                                  </DropdownMenuItem>
                                );
                              })
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* 警告：忠诚度过低 */}
                        {pet.loyalty < 30 && (
                          <div className="text-[9px] text-destructive bg-destructive/10 rounded p-1 text-center">
                            ⚠ 忠诚度过低，灵宠可能每岁有 5% 概率逃离！请尽快喂养。
                          </div>
                        )}
                        {/* 警告：饱食度过低 */}
                        {pet.satiety < 30 && pet.loyalty >= 30 && (
                          <div className="text-[9px] text-amber-600 bg-amber-500/10 rounded p-1 text-center">
                            ⚠ 饱食度过低，忠诚度下降加速！请尽快喂养。
                          </div>
                        )}
                      </div>
                    )}

                    {/* 收起状态下也显示技能名（小字） */}
                    {!isExpanded && (
                      <div className="text-[9px] text-muted-foreground/60 truncate">
                        技能：{pet.skill?.name || '—'}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <p className="text-[9px] text-muted-foreground/60 leading-relaxed pt-1 px-0.5">
              灵宠自动参战（忠诚≥30 且饱食≥20），每回合追加攻击；被动加成玩家属性与修炼速度。
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
    <AlertDialog open={Boolean(dismissTarget)} onOpenChange={(next) => !busy && !next && setDismissTarget(null)}>
      <AlertDialogContent className="border-destructive/25 bg-background/95">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif-cn text-destructive">{'\u653e\u5f52\u7075\u5ba0\uff1f'}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">
            {dismissTarget ? `\u5c06\u300c${dismissTarget.name}\u300d\u653e\u5f52\u5c71\u91ce\u540e\uff0c\u5b83\u5c06\u4e0d\u518d\u968f\u4f60\u540c\u884c\u3002\u6b64\u4e3e\u65e0\u6cd5\u76f4\u63a5\u64a4\u56de\u3002` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{'\u6682\u4e0d\u653e\u5f52'}</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={dismissPet} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {busy ? '\u653e\u5f52\u4e2d' : '\u786e\u8ba4\u653e\u5f52'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
