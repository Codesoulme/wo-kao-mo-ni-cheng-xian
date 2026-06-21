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
  Swords, Heart, Sparkles, Shield, Footprints, ChevronDown, FlaskConical, Loader2, Zap, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { generateSettlementResult } from '@/lib/xianxia/settlement';

// 战斗动作类型
type CombatAction = 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee' | 'other';

// Task 22: 伤害飘字
interface FloatNumber {
  id: string;
  value: number;
  type: 'damage' | 'heal' | 'crit' | 'miss';
  target: 'player' | 'enemy';
}

export function CombatModal() {
  const { character, setCharacter, addEvent, setLoading, setError, setSettlementResult } = useGameStore();
  const [busy, setBusy] = useState(false);
  const [autoBattle, setAutoBattle] = useState(false);
  const autoBattleSessionRef = useRef<string | null>(null);
  // 战斗结束后短暂展示结果界面（玩家点"了结"按钮关闭）
  const [endResult, setEndResult] = useState<{ status: string; narrative: string } | null>(null);
  // Task 22: 伤害飘字
  const [floats, setFloats] = useState<FloatNumber[]>([]);
  // 先让玩家读完事件缘由，再进入战斗操作界面
  const [battleStarted, setBattleStarted] = useState(false);
  const [openPalette, setOpenPalette] = useState<string | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  // 上一次的 HP/MP 快照，用于计算差值生成飘字
  const prevHpRef = useRef<{ player: number; enemy: number } | null>(null);

  // 没有战斗或不在进行中 → 不显示
  // 但战斗结束后短暂展示结果界面（玩家点"了结"按钮关闭）
  const session = character?.combatSession;
  useEffect(() => {
    const sessionId = session?.id || null;
    const hasCombatProgress = !!session && ((session.round || 1) > 1 || (session.log || []).length > 0);
    if (sessionId !== lastSessionIdRef.current) {
      lastSessionIdRef.current = sessionId;
      autoBattleSessionRef.current = null;
      setAutoBattle(false);
      setBattleStarted(hasCombatProgress);
    } else if (hasCombatProgress && !battleStarted) {
      setBattleStarted(true);
    }
    if (!battleStarted) {
      autoBattleSessionRef.current = null;
      setAutoBattle(false);
    }
  }, [session?.id, session?.round, session?.log?.length, battleStarted]);
  useEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [session?.id, session?.log?.length, battleStarted, endResult?.status]);

  const isOngoing = !!session && session.status === 'ongoing';
  const hasCombatTarget = !!session?.enemies?.length && !!session.enemies[session.currentEnemyIdx ?? 0];
  const shouldRender = !!character && ((isOngoing && hasCombatTarget) || !!endResult);
  // 显示条件：战斗进行中 OR 有待展示的 endResult
  // （endResult 在 setCharacter 清掉 combatSession 后才展示，所以即使 session=null 也要渲染）

  // 当前攻击的敌人（session 可能为 null——endResult 显示场景）
  const enemyIdx = session?.currentEnemyIdx ?? 0;
  const enemy = session?.enemies?.[enemyIdx];

  // ====== 执行战斗行动 ======
  const doAction = async (action: CombatAction, payload?: { skillIdx?: number; itemId?: string; optionId?: string }) => {
    if (busy || !isOngoing || !character) return;
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

      // 若战斗结束，先立刻进入结果态，避免 combatSession.status 已非 ongoing 而结果叙事尚未返回时闪回叙事页。
      if (data.ended) {
        const status = data.state?.combatSession?.status || data.endStatus;
        setEndResult({ status, narrative: '战局尘埃落定，余波仍在胸臆间回荡……' });
        setCharacter({ ...character, ...data.state });
        await endCombat(status);
      } else {
        // 更新角色（含 combatSession）
        setCharacter({ ...character, ...data.state });
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
    if (!character) return;
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

      // 显示战后叙事；终局战斗直接交给轮回结算，避免战斗内小窗与全局结算重复弹出。
      const narrative = data.narrative || '';
      const combatEvent = narrative ? {
        id: `combat-${Date.now()}`,
        age: character.age,
        title: status === 'victory' ? '战斗·胜' : status === 'defeat' ? '战斗·陨' : '战斗·遁',
        narrative,
        eventType: 'combat',
        effects: data.drops?.length
          ? data.drops.map((d: any) => ({ kind: 'item', label: '获得', name: d.name, tone: 'positive' }))
          : [],
        createdAt: new Date().toISOString(),
      } : null;
      const nextCharacter = { ...character, ...data.state };
      const nextEvents = combatEvent ? [...(useGameStore.getState().events || []), combatEvent] : (useGameStore.getState().events || []);
      const isTerminal = !nextCharacter.alive || nextCharacter.ascended;
      if (combatEvent) addEvent(combatEvent);
      if (isTerminal) {
        setSettlementResult(generateSettlementResult(nextCharacter as any, nextEvents as any));
        setEndResult(null);
      } else {
        setEndResult({ status, narrative });
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
    if (character && (!character.alive || character.ascended)) {
      const store = useGameStore.getState() as any;
      if (!store.settlementResult || store.settlementResult.characterId !== character.id) {
        setSettlementResult(generateSettlementResult(character as any, store.events || []));
      }
    }
    setEndResult(null);
  };

  // 玩家与敌人 HP/MP 比例（session 可能为 null）
  const playerHpPct = session && session.playerMaxHp > 0 ? (session.playerHp / session.playerMaxHp) * 100 : 0;
  const playerMpPct = session && session.playerMaxMp > 0 ? (session.playerMp / session.playerMaxMp) * 100 : 0;
  const enemyHpPct = enemy && enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) * 100 : 0;
  const halfHpOrLower = !!session && session.playerHp <= session.playerMaxHp * 0.5;
  useEffect(() => {
    if (autoBattle && halfHpOrLower) {
      setAutoBattle(false);
      toast.warning('自运已止', { description: '气血跌破半数，已交还你亲自决断。' });
    }
  }, [autoBattle, halfHpOrLower]);


  // 战斗日志：最近 5 条，最新在底部

  const recentLog: any[] = session ? (session.log || []).slice(-5) : [];

  // 玩家可用法术
  const skills: any[] = session?.playerSkills || [];
  // 玩家可用丹药
  const items: any[] = session?.playerItems || [];
  // Task 23: 参战灵宠
  const petCombatant = (session as any)?.petCombatant || null;
  // Task 23: 战斗中可用的符箓（从 inventory 提取，通过 effects 中的 target_attribute 判定）
  const talismanTargets = new Set(['talisman_attack', 'talisman_defense', 'talisman_heal', 'talisman_escape', 'talisman_stun']);
  const getEffectTarget = (e: any) => e?.target_attribute || e?.targetAttribute || e?.attribute || '';
  const talismans: any[] = (character?.inventory || []).filter((it: any) => {
    if (it.item_type !== 'consumable') return false;
    return (it.effects || []).some((e: any) => talismanTargets.has(getEffectTarget(e)));
  });
  // 普通丹药（非符箓的 consumable）
  const pills: any[] = (session?.playerItems || []).filter((it: any) => {
    const item = (character?.inventory || []).find((i: any) => i.id === it.itemId);
    if (!item) return false;
    return !(item.effects || []).some((e: any) => talismanTargets.has(getEffectTarget(e)));
  });

  const isGenericSkillName = (name?: string) => /行动.*气术|气术式|未名术|^术法$/.test(String(name || '').trim());
  const sourceItems = [...((character as any)?.equipped || []), ...((character as any)?.inventory || [])];
  const repairSkillForDisplay = (sk: any, idx: number) => {
    const item = sourceItems.find((it: any) => it.id && it.id === sk?.itemId);
    const spell = item?.technique?.spell;
    const ability = item?.technique?.artifactAbilities?.[idx] || item?.technique?.artifactAbilities?.[0];
    const replacement = spell || ability;
    if (!replacement || (!isGenericSkillName(sk?.name) && !/行动.*气术|气术式/.test(String(sk?.description || '')))) return sk;
    return { ...sk, name: replacement.name || item?.name || sk?.name, description: replacement.description || item?.description || sk?.description };
  };

  const combatArtDisplayKind = (sk: any): 'technique' | 'spell' | 'artifact' => {
    if (sk?.sourceType === 'artifact') return 'artifact';
    const item = sourceItems.find((it: any) => it.id && it.id === sk?.itemId);
    if (item?.item_type === 'artifact') return 'artifact';
    if (item?.item_type === 'scripture') return 'technique';
    return 'spell';
  };

  const makeFallbackCombatPalette = () => {
    if (!session) return null;
    const techniqueOptions: any[] = [];
    const spellOptions: any[] = [];
    (session.playerSkills || []).slice(0, 8).forEach((rawSkill: any, idx: number) => {
      const sk = repairSkillForDisplay(rawSkill, idx);
      const kind = combatArtDisplayKind(sk);
      const option = {
        id: 'skill-' + idx,
        name: sk.name || '\u672a\u540d\u672f',
        description: sk.description || (kind === 'technique' ? '\u501f\u529f\u6cd5\u884c\u6c14\u8def\u6570\u5e94\u6218\u3002' : '\u8c03\u52a8\u5df2\u4f1a\u672f\u6cd5\u5e94\u6218\u3002'),
        actionType: kind === 'technique' ? 'technique' : 'spell',
        source: kind === 'artifact' ? 'artifact' : kind,
        enabled: session.playerMp >= (sk.mpCost || 0),
        disabledReason: session.playerMp < (sk.mpCost || 0) ? '\u7075\u529b\u4e0d\u8db3\u3002' : undefined,
        skillIdx: idx,
        itemId: sk.itemId,
        mpCost: sk.mpCost || 0,
      };
      if (kind === 'technique') techniqueOptions.push(option);
      else spellOptions.push(option);
    });
    const itemOptions = (session.playerItems || []).map((it: any) => ({
      id: 'item-' + it.itemId,
      name: it.name || '\u968f\u8eab\u7269',
      description: it.effect || it.description || '\u6218\u4e2d\u53ef\u7528\u4e4b\u7269\u3002',
      actionType: 'item',
      source: 'item',
      enabled: true,
      itemId: it.itemId,
    }));
    const basicOptions = [
      { id: 'basic-mana-burst', name: '\u51dd\u6c14\u4e00\u51fb', description: '\u4ee5\u7075\u529b\u5316\u52b2\uff0c\u8bd5\u63a2\u5bf9\u624b\u7834\u7efd\u3002', actionType: 'basic_attack', source: 'body', enabled: session.playerMp >= 3, disabledReason: session.playerMp < 3 ? '\u7075\u529b\u4e0d\u8db3\u3002' : undefined, mpCost: 3 },
      { id: 'basic-body-strike', name: '\u8fd1\u8eab\u640f\u6740', description: '\u8d34\u8eab\u51fa\u624b\uff0c\u4ee5\u6c14\u8840\u4e0e\u8eab\u6cd5\u76f8\u62fc\u3002', actionType: 'basic_attack', source: 'body', enabled: true, mpCost: 0 },
    ];
    const defenseOptions = [
      { id: 'defense-guard', name: '\u655b\u606f\u5b88\u5fa1', description: '\u6536\u675f\u7075\u529b\uff0c\u62a4\u4f4f\u8981\u5bb3\u3002', actionType: 'defense', source: 'body', enabled: true, mpCost: 0 },
      { id: 'defense-focus', name: '\u89c2\u52bf\u5bfb\u9699', description: '\u7a33\u4f4f\u5fc3\u795e\uff0c\u7aa5\u89c1\u5bf9\u624b\u7834\u7efd\u3002', actionType: 'defense', source: 'body', enabled: true, mpCost: 0 },
    ];
    const otherOptions = [
      { id: 'other-observe-opening', name: '\u501f\u52bf\u5e94\u53d8', description: '\u5ba1\u65f6\u5ea6\u52bf\uff0c\u968f\u573a\u8c03\u6574\u6218\u6cd5\u3002', actionType: 'other', source: 'environment', enabled: true, mpCost: 0 },
      { id: 'other-flee', name: '\u8f6c\u8eab\u9041\u8d70', description: '\u5bfb\u9699\u8131\u8eab\uff0c\u672a\u5fc5\u80fd\u5168\u8eab\u800c\u9000\u3002', actionType: 'flee', source: 'body', enabled: true, risk: '\u53ef\u80fd\u88ab\u654c\u4eba\u8ffd\u51fb' },
    ];
    return {
      basicAttack: { enabled: basicOptions.some((o: any) => o.enabled), label: '\u653b\u4f10', options: basicOptions },
      technique: { enabled: techniqueOptions.some((o: any) => o.enabled), label: '\u529f\u6cd5', disabledReason: techniqueOptions.length ? '\u7075\u529b\u4e0d\u8db3\u3002' : '\u6682\u65e0\u53ef\u7528\u529f\u6cd5\u3002', options: techniqueOptions },
      spell: { enabled: spellOptions.some((o: any) => o.enabled), label: '\u6cd5\u672f', disabledReason: spellOptions.length ? '\u7075\u529b\u4e0d\u8db3\u3002' : '\u6682\u65e0\u53ef\u7528\u6cd5\u672f\u3002', options: spellOptions },
      defense: { enabled: defenseOptions.some((o: any) => o.enabled), label: '\u5b88\u5fa1', options: defenseOptions },
      item: { enabled: itemOptions.some((o: any) => o.enabled), label: '\u7269\u7528', disabledReason: itemOptions.length ? '\u6b64\u523b\u96be\u4ee5\u53d6\u7528\u3002' : '\u6682\u65e0\u53ef\u7528\u4e4b\u7269\u3002', options: itemOptions },
      other: { enabled: otherOptions.some((o: any) => o.enabled), label: '\u5e94\u53d8', options: otherOptions },
      generatedBy: 'ui-resume-fallback',
    };
  };
  const storedPalette: any = (session as any)?.actionPalette || null;
  const fallbackPalette: any = makeFallbackCombatPalette();
  const mergePaletteGroup = (key: string) => {
    const storedGroup = storedPalette?.[key];
    const fallbackGroup = fallbackPalette?.[key];
    const storedOptions = storedGroup?.options || [];
    const repairedStoredOptions = (key === 'spell' || key === 'technique')
      ? storedOptions.map((option: any) => {
          const idx = typeof option?.skillIdx === 'number'
            ? option.skillIdx
            : typeof option?.id === 'string' && option.id.startsWith('skill-')
              ? Number(option.id.slice('skill-'.length))
              : -1;
          const skill = idx >= 0 ? repairSkillForDisplay(session?.playerSkills?.[idx], idx) : null;
          if (!skill || (!isGenericSkillName(option?.name) && !/行动.*气术|气术式/.test(String(option?.description || '')))) return option;
          return { ...option, name: skill.name || option.name, description: skill.description || option.description };
        })
      : storedOptions;
    const hasUsableStoredOption = repairedStoredOptions.some((option: any) => option?.enabled);
    if (!storedGroup || !repairedStoredOptions.length || !hasUsableStoredOption) {
      return fallbackGroup || storedGroup || { enabled: false, label: key, options: [] };
    }
    return (key === 'spell' || key === 'technique') ? { ...storedGroup, options: repairedStoredOptions } : storedGroup;
  };
  const palette: any = {
    ...(fallbackPalette || {}),
    ...(storedPalette || {}),
    basicAttack: mergePaletteGroup('basicAttack'),
    technique: mergePaletteGroup('technique'),
    spell: mergePaletteGroup('spell'),
    defense: mergePaletteGroup('defense'),
    item: mergePaletteGroup('item'),
    other: mergePaletteGroup('other'),
  };
  const groupOf = (key: string, fallbackLabel: string) => palette?.[key] || { enabled: false, label: fallbackLabel, options: [] };
  const actionFromOption = (option: any): CombatAction => {
    if (option?.actionType === 'spell' || option?.actionType === 'technique') return 'skill';
    if (option?.actionType === 'item') return 'item';
    if (option?.actionType === 'talisman') return 'talisman';
    if (option?.actionType === 'defense') return 'defend';
    if (option?.actionType === 'flee') return 'flee';
    if (option?.actionType === 'other') return 'other';
    return 'attack';
  };
  const runPaletteOption = (option: any) => doAction(actionFromOption(option), { skillIdx: option?.skillIdx, itemId: option?.itemId, optionId: option?.id });
  const chooseAutoOption = () => {
    const groups = [groupOf('spell', '\u6cd5\u672f'), groupOf('basicAttack', '\u653b\u4f10'), groupOf('defense', '\u5b88\u5fa1'), groupOf('other', '\u5e94\u53d8')];
    return groups.flatMap((g: any) => g.options || []).find((o: any) => o.enabled && !String(o.id || '').includes('flee') && !o.risk)
      || groups.flatMap((g: any) => g.options || []).find((o: any) => o.enabled && !String(o.id || '').includes('flee'));
  };
  useEffect(() => {
    if (!autoBattle || autoBattleSessionRef.current !== session?.id || busy || !isOngoing || !battleStarted || endResult || halfHpOrLower) return;
    const timer = setTimeout(() => {
      const option = chooseAutoOption();
      if (!option) {
        autoBattleSessionRef.current = null;
        setAutoBattle(false);
        toast.warning('自运已止', { description: '此刻没有稳妥可用的行动。' });
        return;
      }
      runPaletteOption(option);
    }, 650);
    return () => clearTimeout(timer);
  }, [autoBattle, busy, isOngoing, battleStarted, endResult, halfHpOrLower, session?.id, session?.round]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-md paper-texture border-destructive/50 shadow-2xl flex flex-col h-[100dvh] sm:h-[96vh] rounded-none sm:rounded-lg sm:my-2 overflow-hidden">
        {/* 顶部：战斗标题 + 红色装饰边框（session 可能为 null——endResult 显示场景） */}
        <CardHeader className="pb-2 shrink-0 border-b-2 border-destructive/40 bg-destructive/5">
          <CardTitle className="text-base flex items-center gap-2 font-serif-cn text-destructive">
            <Swords className="w-5 h-5" />
            <span>⚔ {session?.contextTitle || '战斗'}</span>
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
              <span>战端由此而起</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-hidden p-3 flex flex-col">
          {session && !battleStarted && !endResult && (
            <div className="flex-1 min-h-0 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-3 flex flex-col gap-3">
              <div className="flex-1 min-h-0 overflow-y-auto xianxia-scroll space-y-3 pr-1">
              <div className="space-y-1">
                <div className="text-xs font-bold font-serif-cn text-destructive xianxia-readable">
                  {session.contextTitle || '战端将启'}
                </div>
                {session.contextNarrative && (
                  <p className="text-xs leading-relaxed text-foreground/90 font-serif-cn xianxia-prose">
                    {session.contextNarrative}
                  </p>
                )}
              </div>
              {enemy && (
                <div className="rounded-md border border-destructive/30 bg-background/40 p-2 text-[11px] text-muted-foreground font-serif-cn">
                  对手：<span className="text-destructive font-semibold">{enemy.name}</span>
                  {enemy.description ? `｜${enemy.description}` : ''}
                </div>
              )}
              </div>
              <Button
                onClick={() => { autoBattleSessionRef.current = null; setAutoBattle(false); setBattleStarted(true); }}
                className="w-full h-9 font-serif-cn shrink-0"
                variant="destructive"
              >
                入战
              </Button>
            </div>
          )}

          {(!session || battleStarted || endResult) && (<div className="flex-1 min-h-0 flex flex-col gap-2">
          {/* Combat context is shown before entering battle, not repeated here. */}
          {enemy && (
            <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 space-y-1.5 relative overflow-visible">
              {/* Task 22: 敌人伤害飘字 */}
              <FloatNumbersOverlay floats={floats.filter(f => f.target === 'enemy')} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-semibold">
                    敌
                  </span>
                  <span className="text-sm font-bold font-serif-cn text-foreground truncate">{enemy.name}</span>
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
          <div className="shrink-0 rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-1.5 relative overflow-visible">
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
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 text-xs text-muted-foreground mb-1 px-1 font-serif-cn">
              战斗记录
            </div>
            <div ref={logScrollRef} className="flex-1 min-h-[112px] rounded-lg border border-border/60 bg-card/40 p-2.5 overflow-y-auto xianxia-scroll space-y-2 overscroll-contain">
              {recentLog.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-3 font-serif-cn">
                  战端初启，尚未交锋...
                </p>
              ) : (
                recentLog.map((r: any, i: number) => (
                  <div key={i} className="rounded-md border border-border/50 bg-background/35 px-2.5 py-2 space-y-1.5">
                    <div className="text-[11px] text-muted-foreground font-serif-cn">
                      第{r.round}回合 · {r.playerAction || '交锋'}
                    </div>
                    {r.narrative && (
                      <p className="text-sm leading-6 text-foreground/90 font-serif-cn xianxia-prose">
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
                <p className="text-xs leading-relaxed text-foreground/90 font-serif-cn xianxia-prose">
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
          </div>)}
        </CardContent>

        {/* 底部：行动按钮区（仅 ongoing 且未结束展示时显示） */}
        {isOngoing && battleStarted && !endResult && (
          <div className="relative shrink-0 border-t border-border/40 bg-card/40 p-2">
            <div className="grid grid-cols-7 gap-1">
              <PaletteButton paletteKey="basicAttack" openPalette={openPalette} setOpenPalette={setOpenPalette} group={groupOf('basicAttack', '\u653b\u4f10')} icon={<Swords className="w-3.5 h-3.5" />} tone="primary" busy={busy} onPick={runPaletteOption} />
              <PaletteButton paletteKey="technique" openPalette={openPalette} setOpenPalette={setOpenPalette} group={groupOf('technique', '\u529f\u6cd5')} icon={<BookOpen className="w-3.5 h-3.5" />} tone="gold" busy={busy} onPick={runPaletteOption} />
              <PaletteButton paletteKey="spell" openPalette={openPalette} setOpenPalette={setOpenPalette} group={groupOf('spell', '\u6cd5\u672f')} icon={<Sparkles className="w-3.5 h-3.5" />} tone="blue" busy={busy} onPick={runPaletteOption} />
              <PaletteButton paletteKey="defense" openPalette={openPalette} setOpenPalette={setOpenPalette} group={groupOf('defense', '\u5b88\u5fa1')} icon={<Shield className="w-3.5 h-3.5" />} tone="neutral" busy={busy} onPick={runPaletteOption} />
              <PaletteButton paletteKey="item" openPalette={openPalette} setOpenPalette={setOpenPalette} group={groupOf('item', '\u7269\u7528')} icon={<FlaskConical className="w-3.5 h-3.5" />} tone="green" busy={busy} onPick={runPaletteOption} />
              <PaletteButton paletteKey="other" openPalette={openPalette} setOpenPalette={setOpenPalette} group={groupOf('other', '\u5e94\u53d8')} icon={<Zap className="w-3.5 h-3.5" />} tone="purple" busy={busy} onPick={runPaletteOption} />
              <button
                onClick={() => {
                  if (halfHpOrLower) {
                    toast.warning('不可自运', { description: '气血不足半数，请亲自决断。' });
                    return;
                  }
                  setAutoBattle(v => {
                    const next = !v;
                    autoBattleSessionRef.current = next ? (session?.id || null) : null;
                    return next;
                  });
                }}
                disabled={busy || halfHpOrLower}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-14 rounded-md border-2 transition-all active:scale-95",
                  autoBattle ? "border-red-500/50 bg-red-500/10 text-red-600" : "border-muted-foreground/30 bg-muted/30 hover:bg-muted/50 text-muted-foreground",
                  (busy || halfHpOrLower) && "opacity-40 cursor-not-allowed"
                )}
              >
                <Footprints className="w-3.5 h-3.5" />
                <span className="text-[10px] font-serif-cn font-semibold">{autoBattle ? '止运' : '自运'}</span>
                <span className="text-[8px] text-muted-foreground">半血止</span>
              </button>
            </div>

            {busy && (
              <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[calc(100%+0.35rem)] rounded-full border border-border/60 bg-background/90 px-2.5 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur animate-pulse">
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

function PaletteButton({ paletteKey, openPalette, setOpenPalette, group, icon, tone, busy, onPick }: { paletteKey: string; openPalette: string | null; setOpenPalette: (key: string | null) => void; group: any; icon: React.ReactNode; tone: 'primary' | 'gold' | 'blue' | 'neutral' | 'green' | 'purple'; busy?: boolean; onPick: (option: any) => void }) {
  const options = group?.options || [];
  const enabledOptions = options.filter((o: any) => o.enabled);
  const disabled = busy || !group?.enabled || enabledOptions.length === 0;
  const toneClasses: Record<string, string> = {
    primary: 'border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 text-primary',
    gold: 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60 text-amber-700 dark:text-amber-400',
    blue: 'border-sky-500/40 bg-sky-500/5 hover:bg-sky-500/10 hover:border-sky-500/60 text-sky-700 dark:text-sky-400',
    neutral: 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60 text-amber-700 dark:text-amber-400',
    green: 'border-green-500/40 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/60 text-green-700 dark:text-green-400',
    purple: 'border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/60 text-purple-700 dark:text-purple-400',
  };
  const isOpen = openPalette === paletteKey;
  return (
    <DropdownMenu open={isOpen} onOpenChange={(open) => setOpenPalette(open ? paletteKey : null)}>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 h-14 rounded-md border-2 transition-all active:scale-95",
            toneClasses[tone],
            disabled && "opacity-40 cursor-not-allowed"
          )}
          title={group?.disabledReason}
        >
          {icon}
          <span className="text-[10px] font-serif-cn font-semibold">{group?.label || '行动'}</span>
          <span className="text-[8px] text-muted-foreground">{enabledOptions.length || 0}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="z-[80] w-64">
        <div className="text-[10px] text-muted-foreground px-2 py-1 font-serif-cn">
          {group?.disabledReason || `选择${group?.label || '行动'}`}
        </div>
        {options.length === 0 ? (
          <DropdownMenuItem disabled>此刻无可用选项</DropdownMenuItem>
        ) : options.map((option: any) => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => { if (!option.enabled) return; setOpenPalette(null); onPick(option); }}
            disabled={busy || !option.enabled}
            className="flex items-start gap-2 py-2"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold font-serif-cn flex items-center gap-1">
                {option.name}
                {option.mpCost > 0 && <span className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-700">-{option.mpCost}灵</span>}
              </div>
              <div className="text-[10px] text-muted-foreground line-clamp-2">{option.enabled ? option.description : (option.disabledReason || option.description)}</div>
              {option.risk && <div className="text-[10px] text-red-500/80 truncate">险：{option.risk}</div>}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
