'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Swords, Heart, Sparkles, Shield, Footprints, ChevronDown, BookOpen, FlaskConical, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// 战斗动作类型
type CombatAction = 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee';

// Task 22: 伤害飘字
interface FloatNumber {
  id: string;
  value: number;
  type: 'damage' | 'heal' | 'crit' | 'miss';
  target: 'player' | 'enemy';
}

export function CombatModal() {
  const { character, setCharacter, addEvent, setLoading, setError } = useGameStore();
  const [busy, setBusy] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);
  // 战斗结束后短暂展示结果界面（玩家点"了结"按钮关闭）
  const [endResult, setEndResult] = useState<{ status: string; narrative: string } | null>(null);
  // Task 22: 伤害飘字
  const [floats, setFloats] = useState<FloatNumber[]>([]);
  // 上一次的 HP/MP 快照，用于计算差值生成飘字
  const prevHpRef = useRef<{ player: number; enemy: number } | null>(null);

  // 没有战斗或不在进行中 → 不显示
  // 但战斗结束后短暂展示结果界面（玩家点"了结"按钮关闭）
  const session = character?.combatSession;
  if (!character) return null;
  const isOngoing = !!session && session.status === 'ongoing';
  // 显示条件：战斗进行中 OR 有待展示的 endResult
  // （endResult 在 setCharacter 清掉 combatSession 后才展示，所以即使 session=null 也要渲染）
  if (!isOngoing && !endResult) return null;

  // 当前攻击的敌人（session 可能为 null——endResult 显示场景）
  const enemyIdx = session?.currentEnemyIdx ?? 0;
  const enemy = session?.enemies?.[enemyIdx];

  // ====== 执行战斗行动 ======
  const doAction = async (action: CombatAction, payload?: { skillIdx?: number; itemId?: string }) => {
    if (busy || !isOngoing) return;
    setBusy(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/game/combat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          action,
          payload: payload || {},
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '行动失败');

      // Task 22: 计算伤害飘字
      const round = data.round;
      const newFloats: FloatNumber[] = [];
      if (round) {
        // 玩家造成的伤害（飘在敌人头上）
        if (round.playerDamage && round.playerDamage > 0) {
          newFloats.push({
            id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            value: round.playerDamage,
            type: round.playerDamage >= 30 ? 'crit' : 'damage',
            target: 'enemy',
          });
        }
        // 玩家回复（飘在玩家头上）
        if (round.playerHeal && round.playerHeal > 0) {
          newFloats.push({
            id: `f_${Date.now() + 1}_${Math.random().toString(36).slice(2, 6)}`,
            value: round.playerHeal,
            type: 'heal',
            target: 'player',
          });
        }
        // 敌人造成的伤害（飘在玩家头上）
        if (round.enemyDamage && round.enemyDamage > 0) {
          newFloats.push({
            id: `f_${Date.now() + 2}_${Math.random().toString(36).slice(2, 6)}`,
            value: round.enemyDamage,
            type: round.enemyDamage >= 30 ? 'crit' : 'damage',
            target: 'player',
          });
        }
      }
      if (newFloats.length) {
        setFloats(prev => [...prev, ...newFloats]);
        // 1.2 秒后清除飘字
        setTimeout(() => {
          setFloats(prev => prev.filter(f => !newFloats.find(nf => nf.id === f.id)));
        }, 1200);
      }

      // 更新角色（含 combatSession）
      setCharacter({ ...character, ...data.state });

      // 若战斗结束，调用 /api/game/combat/end 获取战后叙事
      if (data.ended) {
        await endCombat(data.state?.combatSession?.status || data.endStatus);
      }
    } catch (err: any) {
      setError(err.message);
      toast.error('行动失败', { description: err.message });
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  // ====== 结束战斗 ======
  const endCombat = async (status: string) => {
    try {
      const res = await fetch('/api/game/combat/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '战斗结算失败');

      // 更新角色（combatSession 已被清空；可能含新物品、新线索）
      setCharacter({ ...character, ...data.state });

      // 显示战后叙事
      const narrative = data.narrative || '';
      setEndResult({ status, narrative });

      // 写入事件日志（让史册可查）
      if (narrative) {
        addEvent({
          id: `combat-${Date.now()}`,
          age: character.age,
          title: status === 'victory' ? '战斗·胜' : status === 'defeat' ? '战斗·陨' : '战斗·遁',
          narrative,
          eventType: 'combat',
          effects: data.drops?.length
            ? data.drops.map((d: any) => ({ attribute: 'inventory', delta: 1, reason: `得 ${d.name}` }))
            : [],
          createdAt: new Date().toISOString(),
        });
      }

      // toast 提示
      if (status === 'victory') {
        toast.success('战斗胜利', {
          description: data.drops?.length ? `获得：${data.drops.map((d: any) => d.name).join('、')}` : '凯旋而归',
        });
      } else if (status === 'defeat') {
        toast.error('战斗败北', { description: '角色已陨落' });
      } else {
        toast('全身而退', { description: '遁走成功' });
      }
    } catch (err: any) {
      // 战斗结算失败不阻塞——前端直接清掉 combatSession
      console.error('endCombat failed:', err);
      setEndResult({ status, narrative: '战场归于沉寂。' });
      setCharacter({ ...character, combatSession: null });
    }
  };

  const closeEndResult = () => {
    setEndResult(null);
  };

  // 玩家与敌人 HP/MP 比例（session 可能为 null）
  const playerHpPct = session && session.playerMaxHp > 0 ? (session.playerHp / session.playerMaxHp) * 100 : 0;
  const playerMpPct = session && session.playerMaxMp > 0 ? (session.playerMp / session.playerMaxMp) * 100 : 0;
  const enemyHpPct = enemy && enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) * 100 : 0;

  // 战斗日志：最近 5 条，倒序展示（最新在底部）
  const recentLog: any[] = session ? (session.log || []).slice(-5) : [];

  // 玩家可用法术
  const skills: any[] = session?.playerSkills || [];
  // 玩家可用丹药
  const items: any[] = session?.playerItems || [];
  // Task 23: 参战灵宠
  const petCombatant = (session as any)?.petCombatant || null;
  // Task 23: 战斗中可用的符箓（从 inventory 提取，通过 effects 中的 target_attribute 判定）
  const talismans: any[] = (character?.inventory || []).filter((it: any) => {
    if (it.item_type !== 'consumable') return false;
    return (it.effects || []).some((e: any) =>
      e.target_attribute === 'talisman_attack' ||
      e.target_attribute === 'talisman_defense' ||
      e.target_attribute === 'talisman_heal' ||
      e.target_attribute === 'talisman_escape' ||
      e.target_attribute === 'talisman_stun'
    );
  });
  // 普通丹药（非符箓的 consumable）
  const pills: any[] = (session?.playerItems || []).filter((it: any) => {
    const item = (character?.inventory || []).find((i: any) => i.id === it.itemId);
    if (!item) return false;
    return !(item.effects || []).some((e: any) =>
      e.target_attribute === 'talisman_attack' ||
      e.target_attribute === 'talisman_defense' ||
      e.target_attribute === 'talisman_heal' ||
      e.target_attribute === 'talisman_escape' ||
      e.target_attribute === 'talisman_stun'
    );
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-md paper-texture border-destructive/50 shadow-2xl flex flex-col max-h-[100dvh] rounded-none sm:rounded-lg sm:max-h-[96vh] sm:my-2">
        {/* 顶部：战斗标题 + 红色装饰边框（session 可能为 null——endResult 显示场景） */}
        <CardHeader className="pb-2 shrink-0 border-b-2 border-destructive/40 bg-destructive/5">
          <CardTitle className="text-base flex items-center gap-2 font-serif-cn text-destructive">
            <Swords className="w-5 h-5" />
            <span>⚔ 战斗</span>
            {session && (
              <Badge variant="outline" className="text-[10px] ml-auto border-destructive/40 text-destructive">
                第 {session.round || 1} 回合
              </Badge>
            )}
          </CardTitle>
          {session?.contextTitle && (
            <div className="text-xs text-foreground/80 font-serif-cn mt-1 flex items-center gap-1.5 flex-wrap">
              {(session as any).isHeartDemonTrial && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-serif-cn" style={{ background: '#dc262620', color: '#dc2626', border: '1px solid #dc262640' }}>
                  👹 心魔试炼
                </span>
              )}
              <span>{session.contextTitle}</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto xianxia-scroll space-y-3 p-3">
          {/* 战场背景叙事（可折叠） */}
          {session?.contextNarrative && (
            <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
              <button
                onClick={() => setContextCollapsed(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/10 transition-colors"
              >
                <BookOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-semibold font-serif-cn text-muted-foreground flex-1">
                  战场背景
                </span>
                <ChevronDown className={cn(
                  "w-3 h-3 text-muted-foreground transition-transform shrink-0",
                  contextCollapsed ? "" : "rotate-180"
                )} />
              </button>
              {!contextCollapsed && (
                <p className="px-3 pb-2 text-xs leading-relaxed text-foreground/85 font-serif-cn whitespace-pre-wrap">
                  {session?.contextNarrative}
                </p>
              )}
            </div>
          )}

          {/* 敌方信息（顶部） */}
          {enemy && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2 relative overflow-visible">
              {/* Task 22: 敌人伤害飘字 */}
              <FloatNumbersOverlay floats={floats.filter(f => f.target === 'enemy')} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-semibold">
                    敌
                  </span>
                  <span className="text-sm font-bold font-serif-cn text-foreground">{enemy.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>攻 {enemy.attack}</span>
                  <span>·</span>
                  <span>防 {enemy.defense}</span>
                  <span>·</span>
                  <span>速 {enemy.speed}</span>
                </div>
              </div>
              {enemy.description && (
                <p className="text-[11px] text-muted-foreground font-serif-cn">{enemy.description}</p>
              )}
              <div>
                <div className="flex items-center justify-between text-[10px] mb-0.5">
                  <span className="text-destructive font-semibold">气血</span>
                  <span className="text-muted-foreground">{enemy.hp} / {enemy.maxHp}</span>
                </div>
                <Progress value={enemyHpPct} className="h-2.5 bg-destructive/10 [&>div]:bg-destructive [&>div]:transition-all [&>div]:duration-500 [&>div]:ease-out" />
              </div>
              {/* 多敌人预览 */}
              {session && session.enemies.length > 1 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {session.enemies.map((e: any, i: number) => (
                    <span
                      key={i}
                      className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded border",
                        i === enemyIdx
                          ? "border-destructive bg-destructive/15 text-destructive font-semibold"
                          : e.hp <= 0
                          ? "border-muted bg-muted/30 text-muted-foreground line-through"
                          : "border-border bg-muted/30 text-muted-foreground"
                      )}
                    >
                      {e.name}{e.hp <= 0 ? '·亡' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VS 分隔 */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex-1 h-px bg-border" />
            <span className="font-serif-cn">▽ 对阵 ▽</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          {/* 玩家信息（session 可能为 null——endResult 显示场景跳过） */}
          {session && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 relative overflow-visible">
            {/* Task 22: 玩家伤害飘字 */}
            <FloatNumbersOverlay floats={floats.filter(f => f.target === 'player')} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold">
                  我
                </span>
                <span className="text-sm font-bold font-serif-cn text-foreground">{character.name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>攻 {session.playerAttack}</span>
                <span>·</span>
                <span>防 {session.playerDefense}</span>
                <span>·</span>
                <span>速 {session.playerSpeed}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-green-600 font-semibold flex items-center gap-1">
                  <Heart className="w-2.5 h-2.5" /> 气血
                </span>
                <span className="text-muted-foreground">{session.playerHp} / {session.playerMaxHp}</span>
              </div>
              <Progress value={playerHpPct} className="h-2.5 bg-green-500/10 [&>div]:bg-green-500 [&>div]:transition-all [&>div]:duration-500 [&>div]:ease-out" />
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-amber-600 font-semibold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> 灵力
                </span>
                <span className="text-muted-foreground">{session.playerMp} / {session.playerMaxMp}</span>
              </div>
              <Progress value={playerMpPct} className="h-2.5 bg-amber-500/10 [&>div]:bg-amber-500 [&>div]:transition-all [&>div]:duration-500 [&>div]:ease-out" />
            </div>

            {/* Task 23: 参战灵宠快照 */}
            {petCombatant && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2 space-y-1 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] px-1 py-0.5 rounded bg-rose-500/20 text-rose-600 font-semibold">
                      灵宠
                    </span>
                    <span className="text-xs font-semibold font-serif-cn text-rose-700 dark:text-rose-300">{petCombatant.name}</span>
                    <span className="text-[9px] text-muted-foreground">{petCombatant.skillName}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <span>攻 {petCombatant.attack}</span>
                    <span>·</span>
                    <span>速 {petCombatant.speed}</span>
                    <span>·</span>
                    <span style={{ color: petCombatant.currentCooldown > 0 ? '#f97316' : '#22c55e' }}>
                      {petCombatant.currentCooldown > 0 ? `冷却${petCombatant.currentCooldown}` : '技能就绪'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(0, Math.min(100, (petCombatant.hp / petCombatant.maxHp) * 100))}%`,
                        background: '#f43f5e',
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground tabular-nums">
                    {petCombatant.hp}/{petCombatant.maxHp}
                  </span>
                </div>
              </div>
            )}
          </div>
          )}

          {/* 战斗日志（session 可能为 null——endResult 显示场景跳过） */}
          {session && (
          <div>
            <div className="text-[10px] text-muted-foreground mb-1 px-1 font-serif-cn">
              战斗记录
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-2 max-h-60 overflow-y-auto xianxia-scroll space-y-1.5">
              {recentLog.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-3 font-serif-cn">
                  战端初启，尚未交锋...
                </p>
              ) : (
                recentLog.map((r: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        第{r.round}回合
                      </span>
                      {/* 玩家行动 chip（蓝色） */}
                      {r.playerAction && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                          {r.playerAction}
                          {r.playerDamage ? ` ·-${r.playerDamage}` : ''}
                          {r.playerHeal ? ` ·+${r.playerHeal}` : ''}
                        </span>
                      )}
                      {/* 敌人行动 chip（红色） */}
                      {r.enemyDamage != null && r.enemyDamage > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30">
                          敌反扑 ·-{r.enemyDamage}
                        </span>
                      )}
                    </div>
                    {r.narrative && (
                      <p className="text-[11px] leading-relaxed text-foreground/80 font-serif-cn pl-1">
                        {r.narrative}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          )}

          {/* 战斗结束结果展示 */}
          {endResult && (
            <div className={cn(
              "rounded-lg border-2 p-3 space-y-2",
              endResult.status === 'victory'
                ? "border-green-500/50 bg-green-500/10"
                : endResult.status === 'defeat'
                ? "border-destructive/50 bg-destructive/10"
                : "border-amber-500/50 bg-amber-500/10"
            )}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-serif-cn">
                  {endResult.status === 'victory' ? '⚔ 战胜！' : endResult.status === 'defeat' ? '☠ 战败' : '✦ 遁走'}
                </span>
              </div>
              {endResult.narrative && (
                <p className="text-xs leading-relaxed text-foreground/90 font-serif-cn whitespace-pre-wrap">
                  {endResult.narrative}
                </p>
              )}
              <Button
                onClick={closeEndResult}
                className="w-full h-9"
                size="sm"
              >
                了结此战
              </Button>
            </div>
          )}
        </CardContent>

        {/* 底部：行动按钮区（仅 ongoing 且未结束展示时显示） */}
        {isOngoing && !endResult && (
          <div className="shrink-0 border-t border-border/40 bg-card/40 p-2">
            <div className="grid grid-cols-6 gap-1">
              {/* 普攻 */}
              <ActionButton
                onClick={() => doAction('attack')}
                disabled={busy}
                icon={<Swords className="w-3.5 h-3.5" />}
                label="挥击"
                tone="primary"
              />

              {/* 法术（dropdown） */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={busy || skills.length === 0}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 h-14 rounded-md border-2 transition-all",
                      "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60 active:scale-95",
                      "text-amber-700 dark:text-amber-400",
                      (busy || skills.length === 0) && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-serif-cn font-semibold">法术</span>
                    <span className="text-[8px] text-muted-foreground">{skills.length || 0}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  <div className="text-[10px] text-muted-foreground px-2 py-1 font-serif-cn">
                    选择法术施展
                  </div>
                  {skills.length === 0 ? (
                    <DropdownMenuItem disabled>无可施法术</DropdownMenuItem>
                  ) : (
                    skills.map((sk, i) => (
                      <DropdownMenuItem
                        key={i}
                        onClick={() => doAction('skill', { skillIdx: i })}
                        disabled={busy || session.playerMp < (sk.mpCost || 0)}
                        className="flex items-start gap-2 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold font-serif-cn flex items-center gap-1">
                            {sk.name}
                            <span className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-700">
                              -{sk.mpCost}灵
                            </span>
                          </div>
                          {sk.description && (
                            <div className="text-[10px] text-muted-foreground truncate">{sk.description}</div>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 丹药（dropdown）—— 仅非符箓 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={busy || pills.length === 0}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 h-14 rounded-md border-2 transition-all",
                      "border-green-500/40 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/60 active:scale-95",
                      "text-green-700 dark:text-green-400",
                      (busy || pills.length === 0) && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-serif-cn font-semibold">丹药</span>
                    <span className="text-[8px] text-muted-foreground">{pills.length || 0}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  <div className="text-[10px] text-muted-foreground px-2 py-1 font-serif-cn">
                    选择丹药服用
                  </div>
                  {pills.length === 0 ? (
                    <DropdownMenuItem disabled>无丹药可用</DropdownMenuItem>
                  ) : (
                    pills.map((it, i) => (
                      <DropdownMenuItem
                        key={i}
                        onClick={() => doAction('item', { itemId: it.itemId })}
                        disabled={busy}
                        className="flex items-start gap-2 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold font-serif-cn">{it.name}</div>
                          {it.effect && (
                            <div className="text-[10px] text-muted-foreground truncate">{it.effect}</div>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Task 23: 符箓（dropdown）—— 单次使用、即时生效 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={busy || talismans.length === 0}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 h-14 rounded-md border-2 transition-all",
                      "border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/60 active:scale-95",
                      "text-purple-700 dark:text-purple-400",
                      (busy || talismans.length === 0) && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-serif-cn font-semibold">符箓</span>
                    <span className="text-[8px] text-muted-foreground">{talismans.length || 0}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  <div className="text-[10px] text-muted-foreground px-2 py-1 font-serif-cn">
                    激发符箓（单次消耗）
                  </div>
                  {talismans.length === 0 ? (
                    <DropdownMenuItem disabled>无符箓可用</DropdownMenuItem>
                  ) : (
                    talismans.map((it, i) => {
                      const talismanType = (it.effects || []).find((e: any) =>
                        e.target_attribute === 'talisman_attack' ||
                        e.target_attribute === 'talisman_defense' ||
                        e.target_attribute === 'talisman_heal' ||
                        e.target_attribute === 'talisman_escape' ||
                        e.target_attribute === 'talisman_stun'
                      );
                      const typeLabel: Record<string, string> = {
                        talisman_attack: '攻',
                        talisman_defense: '防',
                        talisman_heal: '疗',
                        talisman_escape: '遁',
                        talisman_stun: '镇',
                      };
                      const tColor: Record<string, string> = {
                        talisman_attack: '#dc2626',
                        talisman_defense: '#0891b2',
                        talisman_heal: '#22c55e',
                        talisman_escape: '#a16207',
                        talisman_stun: '#7c3aed',
                      };
                      const tt = talismanType?.target_attribute || '';
                      return (
                        <DropdownMenuItem
                          key={i}
                          onClick={() => doAction('talisman', { itemId: it.id })}
                          disabled={busy}
                          className="flex items-start gap-2 py-2"
                        >
                          <span className="text-[9px] px-1 py-0.5 rounded shrink-0" style={{
                            background: `${tColor[tt] || '#6b7280'}25`,
                            color: tColor[tt] || '#6b7280',
                          }}>
                            {typeLabel[tt] || '?'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold font-serif-cn">{it.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {talismanType ? `效力 ${talismanType.value}` : ''}
                              {it.description ? ` · ${it.description}` : ''}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 防御 */}
              <ActionButton
                onClick={() => doAction('defend')}
                disabled={busy}
                icon={<Shield className="w-3.5 h-3.5" />}
                label="戒备"
                tone="neutral"
              />

              {/* 逃跑 */}
              <ActionButton
                onClick={() => doAction('flee')}
                disabled={busy}
                icon={<Footprints className="w-3.5 h-3.5" />}
                label="遁走"
                tone="muted"
              />
            </div>

            {busy && (
              <div className="text-center text-[10px] text-muted-foreground animate-pulse mt-1.5">
                <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
                招式催动中...
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// 紧凑行动按钮组件
function ActionButton({
  onClick, disabled, icon, label, tone,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  tone: 'primary' | 'neutral' | 'muted';
}) {
  const toneClasses = {
    primary: 'border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 text-primary',
    neutral: 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60 text-amber-700 dark:text-amber-400',
    muted: 'border-muted-foreground/30 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/50 text-muted-foreground',
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 h-14 rounded-md border-2 transition-all active:scale-95",
        toneClasses,
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {icon}
      <span className="text-[10px] font-serif-cn font-semibold">{label}</span>
    </button>
  );
}

// Task 22: 伤害飘字 overlay
// 渲染飘字在父容器（敌人/玩家区域）的右上角，飘字向上飘并淡出
function FloatNumbersOverlay({ floats }: { floats: FloatNumber[] }) {
  if (!floats.length) return null;
  return (
    <div className="absolute top-0 right-2 pointer-events-none z-10 flex flex-col items-end gap-0.5">
      {floats.map(f => (
        <span
          key={f.id}
          className="text-sm font-bold tabular-nums font-serif-cn"
          style={{
            color: f.type === 'heal' ? '#22c55e' : f.type === 'crit' ? '#fbbf24' : f.type === 'miss' ? '#9ca3af' : '#ef4444',
            textShadow: '0 1px 2px rgba(0,0,0,0.5), 0 0 4px currentColor',
            animation: 'combat-float-up 1.2s ease-out forwards',
            display: 'inline-block',
          }}
        >
          {f.type === 'heal' ? '+' : f.type === 'miss' ? '闪' : '-'}{f.value}
          {f.type === 'crit' && <span className="text-[9px] ml-0.5">暴击</span>}
        </span>
      ))}
    </div>
  );
}
