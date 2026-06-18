'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MapPin, X, Coins, Loader2, Skull, Sparkles, Clock, Zap, AlertTriangle,
  Compass, ChevronRight, Trophy, Shield, Ghost, CloudLightning, Droplet, ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { REALMS, SECRET_REALMS, type SecretRealm, type SecretRealmTier } from '@/lib/xianxia/types';

const TIER_LABEL: Record<SecretRealmTier, string> = {
  common: '凡境',
  uncommon: '灵境',
  rare: '玄境',
  epic: '仙境',
  legendary: '圣境',
  mythic: '混沌',
};
const TIER_COLOR: Record<SecretRealmTier, string> = {
  common: '#84cc16',
  uncommon: '#16a34a',
  rare: '#0ea5e9',
  epic: '#a855f7',
  legendary: '#d4af37',
  mythic: '#ec4899',
};

// 主题标签中英对照 + 图标
const THEME_TAG_LABEL: Record<string, { label: string; icon: React.ReactNode }> = {
  beast: { label: '妖兽', icon: <Skull className="w-2.5 h-2.5" /> },
  combat: { label: '争斗', icon: <Skull className="w-2.5 h-2.5" /> },
  material: { label: '灵材', icon: <Sparkles className="w-2.5 h-2.5" /> },
  herb: { label: '灵药', icon: <Droplet className="w-2.5 h-2.5" /> },
  inheritance: { label: '传承', icon: <Trophy className="w-2.5 h-2.5" /> },
  trap: { label: '机关', icon: <AlertTriangle className="w-2.5 h-2.5" /> },
  treasure: { label: '宝物', icon: <Sparkles className="w-2.5 h-2.5" /> },
  ghost: { label: '鬼物', icon: <Ghost className="w-2.5 h-2.5" /> },
  undead: { label: '不死', icon: <Ghost className="w-2.5 h-2.5" /> },
  blood: { label: '血气', icon: <Skull className="w-2.5 h-2.5" /> },
  murderous: { label: '杀机', icon: <Skull className="w-2.5 h-2.5" /> },
  dragon: { label: '龙族', icon: <Sparkles className="w-2.5 h-2.5" /> },
  spiritual_energy: { label: '灵气', icon: <Sparkles className="w-2.5 h-2.5" /> },
  illusion: { label: '幻境', icon: <CloudLightning className="w-2.5 h-2.5" /> },
  heart_demon: { label: '心魔', icon: <Skull className="w-2.5 h-2.5" /> },
  lightning: { label: '雷霆', icon: <Zap className="w-2.5 h-2.5" /> },
  trial: { label: '试炼', icon: <AlertTriangle className="w-2.5 h-2.5" /> },
  ancient: { label: '上古', icon: <Trophy className="w-2.5 h-2.5" /> },
};

const ELEMENT_LABEL: Record<string, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
};

// 危险度渲染（骷髅头）
function DangerMeter({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`危险度 ${level}/10`}>
      {Array.from({ length: 10 }).map((_, i) => (
        <Skull
          key={i}
          className={cn(
            "w-2 h-2 transition-colors",
            i < level
              ? level <= 3 ? 'text-green-500' : level <= 6 ? 'text-amber-500' : 'text-red-500'
              : 'text-muted-foreground/20'
          )}
        />
      ))}
    </div>
  );
}

interface RealmCardProps {
  realm: SecretRealm;
  onCooldown: boolean;
  cooldownRemaining: number;
  timesExplored: number;
  bestReward?: string;
  lastExploredAge?: number;
  canExplore: boolean;
  cannotExploreReason?: string;
  onExplore: () => void;
  busy: boolean;
}

function RealmCard({
  realm, onCooldown, cooldownRemaining, timesExplored, bestReward,
  canExplore, cannotExploreReason, onExplore, busy,
}: RealmCardProps) {
  const [expanded, setExpanded] = useState(false);
  const tierColor = TIER_COLOR[realm.tier];
  const spiritStones = useGameStore(s => s.character?.spiritStones || 0);
  const canAfford = spiritStones >= realm.spiritStoneCost;
  const disabled = !canExplore || onCooldown || busy;

  return (
    <div
      className={cn(
        "relative rounded-xl border overflow-hidden transition-all duration-300 group",
        onCooldown ? "opacity-60 grayscale-[0.4]" : "",
        expanded ? "col-span-full" : ""
      )}
      style={{
        borderColor: `${tierColor}50`,
        background: `linear-gradient(135deg, ${tierColor}10 0%, ${tierColor}03 50%, transparent 100%)`,
      }}
    >
      {/* 顶部色条 */}
      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(90deg, ${tierColor}, ${tierColor}80, transparent)` }}
      />

      {/* 头部：图标 + 名称 + 品级 */}
      <div className="px-3 pt-2.5 pb-2 flex items-start gap-2">
        <div
          className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg shadow-inner"
          style={{
            background: `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)`,
            border: `1px solid ${tierColor}40`,
          }}
        >
          {realm.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3
              className="text-sm font-bold font-serif-cn truncate"
              style={{ color: tierColor }}
            >
              {realm.name}
            </h3>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 h-4"
              style={{
                borderColor: `${tierColor}60`,
                color: tierColor,
                background: `${tierColor}10`,
              }}
            >
              {TIER_LABEL[realm.tier]}
            </Badge>
            {realm.elementAffinity && (
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 h-4 font-serif-cn"
              >
                {ELEMENT_LABEL[realm.elementAffinity]}属
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* 描述 */}
      <p className="px-3 pb-1.5 text-[10.5px] text-muted-foreground font-serif-cn leading-relaxed line-clamp-2">
        {realm.description}
      </p>

      {/* 主题标签 */}
      <div className="px-3 pb-1.5 flex flex-wrap gap-1">
        {realm.themeTags.map(tag => {
          const t = THEME_TAG_LABEL[tag];
          if (!t) return null;
          return (
            <span
              key={tag}
              className="text-[9px] px-1.5 py-0.5 rounded-full border bg-muted/30 text-foreground/80 flex items-center gap-0.5 font-serif-cn"
            >
              {t.icon}
              {t.label}
            </span>
          );
        })}
      </div>

      {/* 危险度 + 奖励倍率 */}
      <div className="px-3 pb-1.5 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground font-serif-cn">危险</span>
          <DangerMeter level={realm.dangerLevel} />
        </div>
        <div className="flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
          <Trophy className="w-2.5 h-2.5" />
          <span className="font-bold tabular-nums">{realm.rewardMultiplier.toFixed(1)}×</span>
          <span className="text-[9px] text-muted-foreground font-serif-cn">奖励</span>
        </div>
      </div>

      {/* 历史探索记录 */}
      {timesExplored > 0 && (
        <div className="px-3 pb-1.5 text-[9.5px] text-muted-foreground/80 font-serif-cn flex items-center gap-1">
          <Compass className="w-2.5 h-2.5" />
          <span>已探 {timesExplored} 次</span>
          {bestReward && (
            <span className="truncate opacity-80">· 最佳：{bestReward}</span>
          )}
        </div>
      )}

      {/* 底部：灵石消耗 + 探索按钮 */}
      <div className="px-3 py-2 flex items-center justify-between border-t border-border/30 bg-muted/10">
        <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <Coins className="w-3 h-3" />
          <span className="text-xs font-bold tabular-nums">{realm.spiritStoneCost}</span>
          <span className="text-[9px] text-muted-foreground font-serif-cn ml-0.5">路费</span>
        </div>
        {onCooldown ? (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-serif-cn">
            <Clock className="w-3 h-3 animate-pulse" />
            <span>冷却 {cooldownRemaining} 载</span>
          </div>
        ) : (
          <button
            onClick={onExplore}
            disabled={disabled}
            className={cn(
              "px-2.5 h-7 rounded-md text-[11px] font-serif-cn tracking-wider transition-all flex items-center gap-1",
              disabled
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-sm"
            )}
            title={cannotExploreReason}
          >
            {busy ? (
              <><Loader2 className="w-3 h-3 animate-spin" />探索中</>
            ) : !canAfford ? (
              '灵石不足'
            ) : (
              <><Compass className="w-3 h-3" />探索</>
            )}
          </button>
        )}
      </div>

      {/* 冷却遮罩 */}
      {onCooldown && (
        <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px] pointer-events-none flex items-center justify-center">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/90 font-serif-cn bg-background/80 px-2 py-1 rounded-full border border-border/40 shadow">
            <Clock className="w-3 h-3" />
            <span>冷却中</span>
          </div>
        </div>
      )}
    </div>
  );
}

// 探索结果展示
function ExplorationResult() {
  const { lastExploration, setLastExploration, setSelectedEventId } = useGameStore();
  if (!lastExploration) return null;

  const tierColor = TIER_COLOR[lastExploration.realmTier as SecretRealmTier] || '#84cc16';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <Card
        className="w-full max-w-md paper-texture border-amber-500/50 shadow-2xl animate-in zoom-in-95 duration-300 realm-result-enter realm-glow"
        style={{
          background: `linear-gradient(180deg, ${tierColor}15, var(--background) 30%)`,
        }}
      >
        <CardHeader className="pb-2 border-b" style={{ borderColor: `${tierColor}40` }}>
          <CardTitle className="text-base flex items-center gap-2 font-serif-cn">
            <span className="text-2xl realm-icon-celebrate">{lastExploration.realmIcon}</span>
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground font-serif-cn flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" />
                <span>秘境归来 · {lastExploration.realmName}</span>
              </div>
              <div className="text-sm font-bold" style={{ color: tierColor }}>
                {lastExploration.title}
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setLastExploration(null)}
              className="w-7 h-7 shrink-0"
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 pb-4">
          <div
            className="text-[12px] font-serif-cn leading-relaxed text-foreground/90 whitespace-pre-wrap max-h-[50vh] overflow-y-auto xianxia-scroll pr-1"
            style={{
              borderLeft: `2px solid ${tierColor}50`,
              paddingLeft: '0.75rem',
            }}
          >
            {lastExploration.narrative}
          </div>
          {lastExploration.effects && lastExploration.effects.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {lastExploration.effects.slice(0, 4).map((eff: any, idx: number) => (
                <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 font-serif-cn">
                  {eff.label || eff.name || eff.reason || '有所变化'}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border/40 flex justify-between gap-2">
            {lastExploration.eventId ? (
              <Button
                variant="outline"
                onClick={() => { setSelectedEventId(lastExploration.eventId!); setLastExploration(null); }}
                className="h-8"
              >
                <ScrollText className="w-3.5 h-3.5 mr-1" />
                <span className="text-xs font-serif-cn">查看史册</span>
              </Button>
            ) : <span />}
            <Button
              onClick={() => setLastExploration(null)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-8"
            >
              <ChevronRight className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs font-serif-cn">归去</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SecretRealmPanel() {
  const {
    character, explorationOpen, setExplorationOpen,
    setCharacter, addEvent, setLastChange, setLoading, setError,
    setLastExploration, setPendingChoice, setSelectedEventId,
  } = useGameStore();
  const [busyRealmId, setBusyRealmId] = useState<string | null>(null);

  if (!character || !explorationOpen) return null;

  // 计算每个秘境的状态
  const realmIdx = REALMS.findIndex(r => r.id === character.realm);
  const records = character.exploredRealms || [];
  const availableRealms = SECRET_REALMS
    .filter(r => realmIdx >= r.minRealm && character.age >= r.minAge)
    .map(r => {
      const rec = records.find((rec: any) => rec.realmId === r.id);
      const lastAge = rec?.lastExploredAge ?? -999;
      const elapsed = character.age - lastAge;
      const onCooldown = elapsed < r.cooldownYears;
      const cooldownRemaining = onCooldown ? (r.cooldownYears - elapsed) : 0;
      const canExplore = character.spiritStones >= r.spiritStoneCost && !onCooldown;
      let cannotExploreReason: string | undefined;
      if (character.spiritStones < r.spiritStoneCost) cannotExploreReason = '灵石不足';
      else if (onCooldown) cannotExploreReason = `冷却中（剩 ${cooldownRemaining} 载）`;
      return {
        realm: r,
        onCooldown,
        cooldownRemaining,
        timesExplored: rec?.timesExplored ?? 0,
        bestReward: rec?.bestReward,
        lastExploredAge: rec?.lastExploredAge,
        canExplore,
        cannotExploreReason,
      };
    });

  const lockedRealms = SECRET_REALMS
    .filter(r => realmIdx < r.minRealm || character.age < r.minAge)
    .map(r => ({
      realm: r,
      reason: realmIdx < r.minRealm
        ? `需${REALMS[r.minRealm].name}以上`
        : `需${r.minAge}岁以上`,
    }));

  const close = () => {
    if (busyRealmId) return; // 探索中不可关闭
    setExplorationOpen(false);
  };

  const explore = async (realm: SecretRealm) => {
    if (busyRealmId || !character) return;
    if (character.spiritStones < realm.spiritStoneCost) {
      toast.error('灵石不足', { description: `需 ${realm.spiritStoneCost} 灵石作路费` });
      return;
    }
    // 二次确认（高危险度秘境）
    if (realm.dangerLevel >= 7) {
      if (!confirm(`「${realm.name}」危险度 ${realm.dangerLevel}/10，可能陨落！确认前往？`)) return;
    }
    setBusyRealmId(realm.id);
    setLoading(true);
    setError(null);
    setLastChange(null);
    try {
      const res = await fetch('/api/game/exploration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          action: 'start',
          realmId: realm.id,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '探索失败');

      // 更新角色状态
      setCharacter({ ...character, ...data.state });
      setLastChange(data.changes || null);

      // 添加事件
      const eventId = data.event.id || `event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addEvent({
        id: eventId,
        age: data.event.age,
        title: data.event.title,
        narrative: data.event.narrative,
        eventType: 'exploration',
        effects: data.event.effects || [],
        isFateNode: false,
        blueprint: { category: 'exploration', name: `秘境·${data.event.realmName}` },
        createdAt: new Date().toISOString(),
      });

      // 设置探索结果弹窗
      setLastExploration({
        eventId,
        age: data.event.age,
        realmName: data.event.realmName,
        realmTier: data.event.realmTier,
        realmIcon: data.event.realmIcon,
        title: data.event.title,
        narrative: data.event.narrative,
        effects: data.event.effects || data.changes || [],
      });

      // 关闭秘境面板（让结果弹窗独占），同时把本次探索写成当前史册事件
      setExplorationOpen(false);
      setSelectedEventId(eventId);

      // 处理选择 / 战斗 / 死亡
      if (data.hasChoice && data.choice) {
        setPendingChoice({
          ...data.choice,
          contextTitle: data.event.title,
          contextNarrative: data.event.narrative,
          contextAge: data.event.age,
          contextFateNodeName: undefined,
        });
        toast('秘境遇抉择', { description: '请做出你的选择' });
      }
      if (data.triggeredCombat) {
        toast('秘境遇敌', { description: '请进入战斗界面应战' });
      }
      if (data.died) {
        toast.error('殒落秘境', { description: data.deathReason });
      } else {
        toast.success(`探索「${realm.name}」归来`, {
          description: data.changes?.length
            ? `${data.changes.length} 项变化`
            : '略有收获',
        });
      }
    } catch (err: any) {
      setError(err.message);
      toast.error('探索失败', { description: err.message });
    } finally {
      setBusyRealmId(null);
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-0 sm:p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
        <Card className="w-full max-w-md paper-texture border-amber-500/40 shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[92vh] rounded-none sm:rounded-lg overflow-hidden">
          {/* 顶部 */}
          <CardHeader className="pb-2 shrink-0 border-b border-amber-500/30 bg-amber-500/5">
            <CardTitle className="text-base flex items-center gap-2 font-serif-cn">
              <Compass className="w-4 h-4 text-amber-600" />
              <span>秘境探索</span>
              <Badge
                variant="outline"
                className="ml-auto text-[11px] flex items-center gap-1 border-amber-500/50 text-amber-700 bg-amber-500/10"
              >
                <Coins className="w-3 h-3" />
                <span className="tabular-nums font-semibold">{character.spiritStones || 0}</span>
                <span className="text-[9px] opacity-70">灵石</span>
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                onClick={close}
                disabled={!!busyRealmId}
                className="w-7 h-7 shrink-0"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
            <div className="text-[10px] text-muted-foreground font-serif-cn flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3 h-3" />
              <span>{character.realmName} · {character.age}载</span>
              <span className="opacity-50">·</span>
              <span>共 {availableRealms.length + lockedRealms.length} 处</span>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground font-serif-cn">
              秘境不是独立副本，而是本年内的一次主动入世：入境所得会写入史册，影响状态、线索、战斗与后续天道推演。
            </p>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
            {/* 可探索秘境列表 */}
            <div className="flex-1 overflow-y-auto xianxia-scroll px-3 py-3">
              {availableRealms.length === 0 && lockedRealms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Compass className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs font-serif-cn">天地虽大，无处可探</p>
                  <p className="text-[10px] opacity-70 mt-1 font-serif-cn">提升境界与年岁，方有秘境可入</p>
                </div>
              ) : (
                <>
                  {/* 可探索 */}
                  {availableRealms.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] text-muted-foreground font-serif-cn mb-1.5 flex items-center gap-1 px-1">
                        <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                        <span>可入秘境（{availableRealms.length}）</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {availableRealms.map(({ realm, onCooldown, cooldownRemaining, timesExplored, bestReward, canExplore, cannotExploreReason }) => (
                          <RealmCard
                            key={realm.id}
                            realm={realm}
                            onCooldown={onCooldown}
                            cooldownRemaining={cooldownRemaining}
                            timesExplored={timesExplored}
                            bestReward={bestReward}
                            canExplore={canExplore}
                            cannotExploreReason={cannotExploreReason}
                            onExplore={() => explore(realm)}
                            busy={busyRealmId === realm.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 锁定秘境 */}
                  {lockedRealms.length > 0 && (
                    <div>
                      <div className="text-[10px] text-muted-foreground font-serif-cn mb-1.5 flex items-center gap-1 px-1">
                        <Shield className="w-2.5 h-2.5 text-muted-foreground/60" />
                        <span>未启秘境（{lockedRealms.length}）</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {lockedRealms.map(({ realm, reason }) => {
                          const tierColor = TIER_COLOR[realm.tier];
                          return (
                            <div
                              key={realm.id}
                              className="rounded-lg border border-dashed border-border/40 bg-muted/10 px-3 py-2 flex items-center gap-2 opacity-70"
                            >
                              <div
                                className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-base grayscale"
                                style={{ background: `${tierColor}10` }}
                              >
                                {realm.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-serif-cn font-bold text-muted-foreground truncate">
                                  {realm.name}
                                </div>
                                <div className="text-[9px] text-muted-foreground/70 font-serif-cn">
                                  {TIER_LABEL[realm.tier]} · {reason}
                                </div>
                              </div>
                              <Shield className="w-3 h-3 text-muted-foreground/40" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 底部说明 */}
            <div className="shrink-0 px-3 py-2 border-t border-amber-500/20 bg-amber-500/5 text-[10px] text-muted-foreground font-serif-cn leading-relaxed">
              <p className="flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                秘境探索不推进年龄；危险度高者可能陨落；冷却期内不可重复探索。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 探索结果弹窗 */}
      <ExplorationResult />
    </>
  );
}
