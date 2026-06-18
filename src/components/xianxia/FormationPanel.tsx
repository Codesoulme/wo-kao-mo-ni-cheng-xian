'use client';

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown, Hexagon, Loader2, Power, PowerOff, Sparkles, Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatItemEffectLabel } from '@/lib/xianxia/display';
import { toast } from 'sonner';
import { FormationType } from '@/lib/xianxia/types';

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#d4af37', mythic: '#ec4899',
};
const RARITY_LABEL: Record<string, string> = {
  common: '凡品', uncommon: '良品', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话',
};

// 阵法类型徽标配色（避开 indigo/blue 主色调；水属性用 cyan 代替 blue）
const FORMATION_TYPE_STYLE: Record<FormationType, { label: string; color: string }> = {
  spirit_gathering: { label: '聚灵', color: '#10b981' },  // emerald
  protection:       { label: '护体', color: '#06b6d4' },  // cyan
  concealment:      { label: '迷踪', color: '#a855f7' },  // purple
  killing:          { label: '杀阵', color: '#ef4444' },  // red
  illusion:         { label: '幻阵', color: '#ec4899' },  // pink
  fire:             { label: '火阵', color: '#f97316' },  // orange
  water:            { label: '水阵', color: '#06b6d4' },  // cyan (替代 blue)
  wood:             { label: '木阵', color: '#22c55e' },  // green
  metal:            { label: '金阵', color: '#eab308' },  // yellow
  earth:            { label: '土阵', color: '#d97706' },  // amber
};

// 从阵法名/阵盘名推断类型（与 engine.ts activateFormation 同口径）
function inferFormationType(name: string): FormationType {
  if (!name) return 'spirit_gathering';
  if (name.includes('聚灵')) return 'spirit_gathering';
  if (name.includes('护体') || name.includes('防御')) return 'protection';
  if (name.includes('迷踪') || name.includes('隐匿')) return 'concealment';
  if (name.includes('杀') || name.includes('攻伐')) return 'killing';
  if (name.includes('幻')) return 'illusion';
  if (name.includes('火')) return 'fire';
  if (name.includes('水')) return 'water';
  if (name.includes('木')) return 'wood';
  if (name.includes('金')) return 'metal';
  if (name.includes('土')) return 'earth';
  return 'spirit_gathering';
}

// 效果文本中文化
function fmtEffectZh(eff: any): string {
  return formatItemEffectLabel(eff);
}

interface DiskItem {
  id: string;
  name: string;
  description?: string;
  item_type: string;
  rarity: string;
  effects: any[];
  source?: string;
}

interface ActiveFormation {
  id: string;
  name: string;
  description?: string;
  rarity: string;
  effects: any[];
}

export function FormationPanel() {
  const { character, setCharacter } = useGameStore();
  const [open, setOpen] = useState(true);
  const [disks, setDisks] = useState<DiskItem[]>([]);
  const [activeFormations, setActiveFormations] = useState<ActiveFormation[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // 加载阵法数据
  const loadList = useCallback(async () => {
    if (!character?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/game/formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, action: 'list' }),
      });
      const data = await res.json();
      if (data.success) {
        setDisks(data.disks || []);
        setActiveFormations(data.activeFormations || []);
      }
    } catch (err) {
      // 静默失败：list 是辅助加载，不打扰玩家
      console.error('load formations failed:', err);
    } finally {
      setLoading(false);
    }
  }, [character?.id]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  if (!character) return null;

  const doActivate = async (diskItemId: string) => {
    if (!character) return;
    setBusy(diskItemId);
    try {
      const res = await fetch('/api/game/formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, action: 'activate', diskItemId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '激活失败');
      setCharacter({ ...character, ...data.state });
      toast.success(data.message || '阵法激活');
      await loadList();
    } catch (err: any) {
      toast.error('激活失败', { description: err.message });
    } finally {
      setBusy(null);
    }
  };

  const doDeactivate = async (formationId: string) => {
    if (!character) return;
    setBusy(formationId);
    try {
      const res = await fetch('/api/game/formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, action: 'deactivate', formationId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '关闭失败');
      setCharacter({ ...character, ...data.state });
      toast.success(data.message || '阵法已关闭');
      await loadList();
    } catch (err: any) {
      toast.error('关闭失败', { description: err.message });
    } finally {
      setBusy(null);
    }
  };

  const totalCount = activeFormations.length + disks.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="paper-texture">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Hexagon className="w-4 h-4 text-primary" />
                阵法
              </span>
              <div className="flex items-center gap-2">
                {activeFormations.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] gap-0.5">
                    <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                    {activeFormations.length} 启用
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">{totalCount}</Badge>
                <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : totalCount === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 font-serif-cn">
                无阵法加持。获得阵盘后可激活。
              </p>
            ) : (
              <>
                {/* ==================== 已激活阵法 ==================== */}
                {activeFormations.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground/80 font-serif-cn flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> 已激活阵法（每岁消耗灵石）
                    </p>
                    {activeFormations.map((f, i) => {
                      const formType = inferFormationType(f.name);
                      const typeStyle = FORMATION_TYPE_STYLE[formType];
                      const rarityColor = RARITY_COLORS[f.rarity] || '#6b7280';
                      return (
                        <div
                          key={f.id || i}
                          className="rounded-md border p-2"
                          style={{
                            borderColor: `${typeStyle.color}50`,
                            background: `${typeStyle.color}08`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1 gap-1.5">
                            <span
                              className="flex items-center gap-1.5 text-xs font-semibold font-serif-cn truncate"
                              style={{ color: rarityColor }}
                            >
                              <Hexagon className="w-3 h-3 shrink-0" style={{ color: typeStyle.color }} />
                              {f.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className="text-[9px] px-1 py-0.5 rounded font-semibold"
                                style={{
                                  background: `${typeStyle.color}20`,
                                  color: typeStyle.color,
                                }}
                              >
                                {typeStyle.label}
                              </span>
                              <span
                                className="text-[9px] px-1 rounded"
                                style={{ background: `${rarityColor}20`, color: rarityColor }}
                              >
                                {RARITY_LABEL[f.rarity] || f.rarity}
                              </span>
                            </div>
                          </div>
                          {f.description && (
                            <p className="text-[10px] text-muted-foreground leading-relaxed mb-1 line-clamp-2">
                              {f.description}
                            </p>
                          )}
                          {f.effects && f.effects.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {f.effects.map((e: any, j: number) => (
                                <span
                                  key={j}
                                  className="text-[9px] px-1 py-0.5 rounded"
                                  style={{
                                    background: e.operation === 'multiply' ? '#c8453c15' : `${typeStyle.color}15`,
                                    color: e.operation === 'multiply' ? '#c8453c' : typeStyle.color,
                                  }}
                                >
                                  {fmtEffectZh(e)}
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => doDeactivate(f.id)}
                            disabled={busy === f.id}
                            className={cn(
                              'w-full h-7 rounded-md text-[11px] font-serif-cn tracking-wider transition-all',
                              'flex items-center justify-center gap-1 border',
                              'bg-amber-50/60 text-amber-700 border-amber-300/50 hover:bg-amber-100/70',
                              'disabled:opacity-50 disabled:cursor-not-allowed',
                            )}
                          >
                            {busy === f.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <PowerOff className="w-3 h-3" />
                                关闭阵法
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ==================== 阵盘物品（可激活） ==================== */}
                {disks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground/80 font-serif-cn flex items-center gap-1">
                      <Hexagon className="w-2.5 h-2.5" /> 阵盘（点击激活）
                    </p>
                    {disks.map((disk, i) => {
                      const formType = inferFormationType(disk.name);
                      const typeStyle = FORMATION_TYPE_STYLE[formType];
                      const rarityColor = RARITY_COLORS[disk.rarity] || '#6b7280';
                      const isActive = activeFormations.some(f =>
                        f.name === disk.name || f.name.includes(disk.name) || disk.name.includes(f.name)
                      );
                      return (
                        <div
                          key={disk.id || i}
                          className="rounded-md border p-2"
                          style={{
                            borderColor: `${rarityColor}40`,
                            background: `${rarityColor}06`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1 gap-1.5">
                            <span
                              className="flex items-center gap-1.5 text-xs font-semibold font-serif-cn truncate"
                              style={{ color: rarityColor }}
                            >
                              <Hexagon className="w-3 h-3 shrink-0" style={{ color: typeStyle.color }} />
                              {disk.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className="text-[9px] px-1 py-0.5 rounded font-semibold"
                                style={{
                                  background: `${typeStyle.color}20`,
                                  color: typeStyle.color,
                                }}
                              >
                                {typeStyle.label}
                              </span>
                              <span
                                className="text-[9px] px-1 rounded"
                                style={{ background: `${rarityColor}20`, color: rarityColor }}
                              >
                                {RARITY_LABEL[disk.rarity] || disk.rarity}
                              </span>
                            </div>
                          </div>
                          {disk.description && (
                            <p className="text-[10px] text-muted-foreground leading-relaxed mb-1 line-clamp-2">
                              {disk.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mb-1.5">
                            <Coins className="w-2.5 h-2.5 text-amber-600/80" />
                            <span className="text-[9px] text-amber-700/80 font-serif-cn">
                              每岁消耗 {rarityToStoneCost(disk.rarity)} 灵石维持
                            </span>
                          </div>
                          {isActive ? (
                            <div className="w-full h-7 rounded-md text-[11px] font-serif-cn flex items-center justify-center gap-1 bg-emerald-50/60 text-emerald-700 border border-emerald-300/50">
                              <Sparkles className="w-3 h-3" />
                              已激活
                            </div>
                          ) : (
                            <button
                              onClick={() => doActivate(disk.id)}
                              disabled={busy === disk.id}
                              className={cn(
                                'w-full h-7 rounded-md text-[11px] font-serif-cn tracking-wider transition-all',
                                'flex items-center justify-center gap-1 border',
                                'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                              )}
                            >
                              {busy === disk.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Power className="w-3 h-3" />
                                  激活阵法
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// 与 engine.ts tickFormations 中 rarityCost 同口径
function rarityToStoneCost(rarity: string): number {
  const map: Record<string, number> = { common: 2, uncommon: 3, rare: 5, epic: 10, legendary: 20, mythic: 50 };
  return map[rarity] || 2;
}

