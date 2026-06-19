// POST /api/game/combat/action
// 战斗回合行动：执行一回合，并记录隐藏审计。

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import {
  dbToState,
  executeCombatRound,
  stateToResponse,
  buildStateContext,
  normalizeCultivationState,
} from '@/lib/xianxia/engine';
import { generateCombatRoundNarrative } from '@/lib/xianxia/llm';
import { buildStateChangeAuditEffect, buildStateChangeLog } from '@/lib/xianxia/state-change-log';
import type { AttributeChange } from '@/lib/xianxia/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 30;

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
      action: z.enum(['attack', 'skill', 'item', 'talisman', 'defend', 'flee']),
      payload: z.object({
        skillIdx: z.number().optional(),
        itemId: z.string().optional(),
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

    const sessionBefore = state.combatSession;
    const result = executeCombatRound(state, action, payload || {});
    state = normalizeCultivationState(result.state);

    if (sessionBefore && result.round) {
      const enemyName = sessionBefore.enemies?.[sessionBefore.currentEnemyIdx]?.name;
      const ctx = buildStateContext(state, []);
      const narrative = await Promise.race([
        generateCombatRoundNarrative({
          ctx,
          sessionBefore,
          round: result.round,
          enemyName,
        }),
        new Promise<string>((resolve) => setTimeout(() => resolve(result.round.narrative), 3500)),
      ]);
      result.round.narrative = narrative;
      if (state.combatSession?.log?.length) {
        const log = [...state.combatSession.log];
        const lastIdx = log.length - 1;
        if (log[lastIdx]?.round === result.round.round) {
          log[lastIdx] = { ...log[lastIdx], narrative };
          state = { ...state, combatSession: { ...state.combatSession, log } };
        }
      }
    }

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
