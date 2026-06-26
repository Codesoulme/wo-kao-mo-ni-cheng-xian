// POST /api/game/combat/action
// 战斗回合行动：执行一回合，并记录隐藏审计。

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import {
  dbToState,
  executeCombatRound,
  executeCombatRoundWithProposal,
  stateToResponse,
  buildStateContext,
  normalizeCultivationState,
  recordActionCausality,
} from '@/lib/xianxia/engine';
import { generateCombatRoundNarrative, generateCombatRoundProposal } from '@/lib/xianxia/llm';
import { buildStateChangeAuditEffect, buildStateChangeLog } from '@/lib/xianxia/state-change-log';
import { sanitizeNarrativeText } from '@/lib/xianxia/display';
import type { AttributeChange } from '@/lib/xianxia/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 30;


function isMechanicalCombatSentence(text: string) {
  const compact = text.replace(/\s+/g, '');
  const numberLike = '[0-9一二三四五六七八九十百千万两]+';
  const patterns = [
    new RegExp(`造成(?:了)?${numberLike}(?:点)?(?:伤害|创伤|气血)`),
    new RegExp(`(?:受到|承受|损失|扣除)(?:了)?${numberLike}(?:点)?(?:伤害|气血|生命)`),
    new RegExp(`(?:敌人|对手|敌方).{0,8}(?:反扑|反击).{0,8}造成`),
    /HP|hp|生命值|气血值|伤害值|数值|公式|结算|本回合/i,
    /你(?:对|向)?.{0,12}造成.{0,8}伤害/,
    /敌方(?:对|向)?.{0,12}造成.{0,8}伤害/,
  ];
  return patterns.some(pattern => pattern.test(compact));
}

function cleanCombatNarrative(text?: string) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const parts = raw.match(/[^。！？；.!?;]+[。！？；.!?;]?/g) || [raw];
  const kept = parts
    .map(part => part.trim())
    .filter(part => part && !isMechanicalCombatSentence(part));
  return kept.join('').replace(/\s{2,}/g, ' ').trim().slice(0, 380);
}

function needsCombatNarrativeRewrite(text?: string) {
  if (!text) return true;
  const compact = text.replace(/\s+/g, '');
  if (compact.length < 48) return true;
  if (isMechanicalCombatSentence(compact)) return true;
  const cleaned = cleanCombatNarrative(text);
  return cleaned.length < Math.min(48, compact.length * 0.55);
}

function buildLocalCombatNarrativeFallback(args: {
  playerAction?: string;
  enemyName?: string;
  playerDamage?: number;
  enemyDamage?: number;
  playerHeal?: number;
  endStatus?: string;
}) {
  const action = args.playerAction || '攻势';
  const enemy = args.enemyName || '敌手';
  const opening = `你提气运转${action}，灵力沿经脉骤然绷紧，衣袍被劲风扯得猎猎作响。`;
  const pressure = args.playerDamage && args.playerDamage > 0
    ? `${enemy}身前护光一暗，脚下碎石被余波震开，身形也被逼得后撤半步。`
    : `${enemy}看破来势，侧身卸去锋芒，双方气机在半空短促相撞。`;
  const counter = args.enemyDamage && args.enemyDamage > 0
    ? `对方旋即借势压回，罡风擦过肩臂，你气血一阵翻涌。`
    : `你稳住步伐，没有给对方趁隙反扑的余地。`;
  const heal = args.playerHeal && args.playerHeal > 0 ? `一缕回元之力随呼吸沉入丹田，紊乱气息稍稍平复。` : '';
  const ending = args.endStatus === 'victory'
    ? `待尘雾落下，敌势已散，此战胜负分明。`
    : args.endStatus === 'defeat'
      ? `只是余劲未消，你眼前一沉，战局终究滑向不可挽回。`
      : args.endStatus === 'fled'
        ? `你趁气浪遮眼抽身疾退，战场很快被抛在身后。`
        : `片刻之后，双方仍隔着翻涌灵压对峙，破绽尚在暗处游移。`;
  return `${opening}${pressure}${counter}${heal}${ending}`.slice(0, 380);
}

function persistableCombatActionStateData(state: ReturnType<typeof dbToState>) {
  return {
    hp: state.hp,
    maxHp: state.maxHp,
    mp: state.mp,
    maxMp: state.maxMp,
    attack: state.attack,
    defense: state.defense,
    speed: state.speed,
    luck: state.luck,
    comprehension: state.comprehension,
    spiritStones: state.spiritStones,
    reputation: state.reputation,
    alive: state.alive,
    ascended: state.ascended,
    causeOfDeath: state.causeOfDeath || '',
    statusJson: JSON.stringify(state.activeStatuses),
    inventoryJson: JSON.stringify(state.inventory || []),
    equippedJson: JSON.stringify(state.equipped || []),
    storageCapacity: state.storageCapacity ?? 5,
    cultivationMultiplier: state.cultivationMultiplier ?? 1.0,
    cultivationInsight: state.cultivationInsight || '',
    cultivationFactorsJson: JSON.stringify(state.cultivationFactors || []),
    memoryJson: JSON.stringify(state.longTermMemory || []),
    pendingThreadsJson: JSON.stringify(state.pendingThreads || []),
    characterIntentsJson: JSON.stringify(state.characterIntents || []),
    combatStateJson: state.combatSession ? JSON.stringify(state.combatSession) : '',
    npcsJson: JSON.stringify(state.npcs || []),
    causalGraphJson: JSON.stringify(state.causalGraph || { nodes: [], edges: [] }),
    worldFactsJson: JSON.stringify(state.worldFacts || []),
    heartDemon: state.heartDemon ?? 0,
    petsJson: JSON.stringify(state.pets || []),
    exploredRealmsJson: JSON.stringify(state.exploredRealms || []),
  };
}

function buildCombatRoundChanges(before: ReturnType<typeof dbToState>, after: ReturnType<typeof dbToState>, action: string, itemId?: string): AttributeChange[] {
  const changes: AttributeChange[] = [];
  const hpDelta = Number(after.hp || 0) - Number(before.hp || 0);
  if (hpDelta !== 0) changes.push({ attribute: 'hp', delta: hpDelta, reason: '战斗回合气血变化' });
  const mpDelta = Number(after.mp || 0) - Number(before.mp || 0);
  if (mpDelta !== 0) changes.push({ attribute: 'mp', delta: mpDelta, reason: '战斗回合法力变化' });
  if ((action === 'item' || action === 'talisman') && itemId && (after.inventory || []).every(item => item.id !== itemId)) {
    changes.push({ attribute: 'inventory', delta: -1, reason: action === 'talisman' ? '战斗消耗符箓' : '战斗服用丹药' } as any);
  }
  return changes;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({
      characterId: z.string(),
      action: z.enum(['attack', 'skill', 'item', 'talisman', 'defend', 'flee', 'other']),
      payload: z.object({
        skillIdx: z.number().optional(),
        itemId: z.string().optional(),
        optionId: z.string().optional(),
        targetEnemyIdx: z.number().optional(),
      }).optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: '参数有误' }, { status: 400 });
    }
    const { characterId, action, payload } = parsed.data;

    const char = await db.character.findUnique({ where: { id: characterId } });
    await clearAdvancePreload(characterId);
    if (!char) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });

    let state = dbToState(char as any);
    const stateBeforeAction = {
      ...state,
      inventory: [...(state.inventory || [])],
      equipped: [...(state.equipped || [])],
      activeStatuses: [...(state.activeStatuses || [])],
      pendingThreads: [...(state.pendingThreads || [])],
      combatSession: state.combatSession ? { ...state.combatSession, log: [...(state.combatSession.log || [])] } : null,
    };

    if (!state.combatSession || state.combatSession.status !== 'ongoing') {
      return NextResponse.json({ success: false, error: '当前无进行中的战斗' }, { status: 400 });
    }

    // 目标切换：玩家可指定这一手针对的敌人（仅限存活敌人）
    const tIdx = payload?.targetEnemyIdx;
    if (typeof tIdx === 'number' && tIdx >= 0 && tIdx < (state.combatSession.enemies?.length || 0) && (state.combatSession.enemies[tIdx]?.hp ?? 0) > 0) {
      state.combatSession.currentEnemyIdx = tIdx;
    }

    const sessionBefore = state.combatSession;
    const ctxBefore = buildStateContext(state, []);
    let aiProposal = null as Awaited<ReturnType<typeof generateCombatRoundProposal>> | null;
    try {
      aiProposal = await Promise.race([
        generateCombatRoundProposal({ ctx: ctxBefore, sessionBefore, action, payload: payload || {} }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
      ]);
    } catch (err: any) {
      console.error('generateCombatRoundProposal failed:', err?.message || err);
    }
    const result = aiProposal
      ? executeCombatRoundWithProposal(state, action, payload || {}, aiProposal)
      : executeCombatRound(state, action, payload || {});
    state = normalizeCultivationState(result.state);

    if (sessionBefore && result.round) {
      const enemyName = sessionBefore.enemies?.[sessionBefore.currentEnemyIdx]?.name;
      let narrative = cleanCombatNarrative(result.round.narrative);
      if (needsCombatNarrativeRewrite(result.round.narrative)) {
        const ctx = buildStateContext(state, []);
        const rewritten = await Promise.race([
          generateCombatRoundNarrative({
            ctx,
            sessionBefore,
            round: { ...result.round, narrative: narrative || result.round.narrative },
            enemyName,
          }),
          new Promise<string>((resolve) => setTimeout(() => resolve(narrative || result.round.narrative), 3500)),
        ]);
        narrative = cleanCombatNarrative(rewritten);
      }
      if (!narrative || needsCombatNarrativeRewrite(narrative)) {
        narrative = buildLocalCombatNarrativeFallback({
          playerAction: result.round.playerAction,
          enemyName,
          playerDamage: result.round.playerDamage,
          enemyDamage: result.round.enemyDamage,
          playerHeal: result.round.playerHeal,
          endStatus: result.endStatus,
        });
      }
      result.round.narrative = sanitizeNarrativeText(narrative);
      if (state.combatSession?.log?.length) {
        const log = [...state.combatSession.log];
        const lastIdx = log.length - 1;
        if (log[lastIdx]?.round === result.round.round) {
          log[lastIdx] = { ...log[lastIdx], narrative };
          state = { ...state, combatSession: { ...state.combatSession, log } };
        }
      }
    }

    const usedCombatItem = payload?.itemId ? stateBeforeAction.inventory.filter(item => item.id === payload.itemId) : [];
    // AI-29: 战斗结束后自动补 enemy 线索（若敌人逃脱/留有余患）
    const endedStatus = state.combatSession?.status;
    if (endedStatus && endedStatus !== 'ongoing' && sessionBefore?.enemies?.length) {
      const survivedEnemies = (sessionBefore.enemies || []).filter((e: any, idx: number) => {
        const hp = e?.hp ?? 0;
        return hp > 0;
      });
      const deathCause = endedStatus === 'defeat' ? '被' : '';
      const enemyThreadSource = endedStatus === 'defeat'
        ? survivedEnemies.map((e: any) => e.name).filter(Boolean).join('、')
        : '';
      if (survivedEnemies.length > 0) {
        // 至少有一个敌人存活（逃脱或留有余患）
        const enemyNames = survivedEnemies.map((e: any) => e.name).filter(Boolean).join('、');
        if (enemyNames) {
          const title = endedStatus === 'defeat' ? `${enemyNames}追杀未止` : `${enemyNames}未竟之患`;
          const existing = (state.pendingThreads || []).some((t: any) => t.title === title);
          if (!existing) {
            const deadlineAge = state.age + 8;
            const newThread = {
              id: `thread_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`,
              title,
              description: endedStatus === 'defeat'
                ? `被${enemyNames}击退，伤势未愈，对方扬言必报此仇——${deadlineAge}岁前需设法了结。`
                : `${enemyNames}在战斗中脱身，留下一桩未了的因果——${deadlineAge}岁前或仍有后患。`,
              category: 'enemy',
              startAge: state.age,
              deadlineAge,
              status: 'pending',
              progress: 0,
              reward: '了断此桩恩怨，或反收为己用',
              failureCost: '仇敌在后续流年中再次出现',
              dueInSameYear: false,
              followUpHint: '若角色不主动寻仇，可由 AI 在下一岁暗示对方行踪',
            };
            state = {
              ...state,
              pendingThreads: [...(state.pendingThreads || []), newThread],
            };
          }
        }
      }
    }
    state = recordActionCausality(state, {
      actionId: `combat_round_${state.age}_${state.combatSession?.id || 'session'}_${result.round?.round || 'round'}_${action}`,
      actionType: 'combat',
      title: `战斗回合：${action}`,
      summary: result.round?.narrative,
      tags: ['combat-round', action],
      usedItems: usedCombatItem,
      consumedItems: (action === 'item' || action === 'talisman') ? usedCombatItem : [],
    });
    const appliedChanges = buildCombatRoundChanges(stateBeforeAction, state, action, payload?.itemId);
    const stateChangeLog = buildStateChangeLog({
      before: stateBeforeAction,
      after: state,
      appliedChanges,
      rejectedChanges: [],
      contentRegistryTrace: [],
      effectResolveTrace: [],
      aiBoundaryTrace: [],
    });

    if (state.combatSession?.log?.length && stateChangeLog.length) {
      const log = [...state.combatSession.log];
      const lastIdx = log.length - 1;
      log[lastIdx] = {
        ...log[lastIdx],
        audit: buildStateChangeAuditEffect(stateChangeLog),
      } as any;
      state = { ...state, combatSession: { ...state.combatSession, log } };
    }

    await db.character.update({
      where: { id: characterId },
      data: persistableCombatActionStateData(state),
    });

    return NextResponse.json({
      success: true,
      round: result.round,
      ended: result.ended,
      endStatus: result.endStatus,
      victoryDrops: result.victoryDrops,
      stateChangeLog,
      state: stateToResponse(state),
    });
  } catch (err: any) {
    console.error('combat action error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '战斗行动失败' },
      { status: 500 }
    );
  }
}
