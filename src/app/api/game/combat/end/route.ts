// POST /api/game/combat/end
// 结束战斗：结算战利品、战斗叙事、任务推进，并写入隐藏审计。

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import {
  dbToState,
  endCombat,
  buildStateContext,
  stateToResponse,
  addItems,
  addThreads,
  completeThread,
  resolveHeartDemonTrial,
  normalizeCultivationState,
  recordActionCausality,
  refreshWorldFacts,
} from '@/lib/xianxia/engine';
import { generateCombatEndNarrative } from '@/lib/xianxia/llm';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { appendStateChangeAuditEffect, buildStateChangeLog } from '@/lib/xianxia/state-change-log';
import { registerItem, registerMany, registerThread } from '@/lib/xianxia/content-registry';
import type { AttributeChange } from '@/lib/xianxia/types';
import type { ValidationTrace } from '@/lib/xianxia/content-registry';

export const runtime = 'nodejs';
export const maxDuration = 60;

function persistableCombatEndStateData(state: ReturnType<typeof dbToState>) {
  return {
    age: state.age,
    lifespan: state.lifespan,
    realm: state.realm,
    realmLevel: state.realmLevel,
    cultivationExp: state.cultivationExp,
    expToBreak: state.expToBreak,
    elementMetal: state.elements.metal,
    elementWood: state.elements.wood,
    elementWater: state.elements.water,
    elementFire: state.elements.fire,
    elementEarth: state.elements.earth,
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
    faction: state.faction,
    master: state.master,
    location: state.location,
    fateNodes: state.fateNodes.join(','),
    isAtChoice: state.isAtChoice,
    lastEventAge: state.lastEventAge,
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
    combatStateJson: '',
    npcsJson: JSON.stringify(state.npcs || []),
    causalGraphJson: JSON.stringify(state.causalGraph || { nodes: [], edges: [] }),
    worldFactsJson: JSON.stringify(state.worldFacts || []),
    heartDemon: state.heartDemon ?? 0,
    petsJson: JSON.stringify(state.pets || []),
    exploredRealmsJson: JSON.stringify(state.exploredRealms || []),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    if (!characterId) {
      return NextResponse.json({ success: false, error: '缺少 characterId' }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    await clearAdvancePreload(characterId);
    if (!char) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });

    let state = dbToState(char as any);
    const stateBeforeCombatEnd = {
      ...state,
      inventory: [...(state.inventory || [])],
      equipped: [...(state.equipped || [])],
      activeStatuses: [...(state.activeStatuses || [])],
      pendingThreads: [...(state.pendingThreads || [])],
      worldFacts: [...(state.worldFacts || [])],
    };

    if (!state.combatSession) {
      return NextResponse.json({ success: false, error: '当前没有战斗会话' }, { status: 400 });
    }

    const session = state.combatSession;
    const enemies = session.enemies || [];
    const endStatus = session.status;
    const contentRegistryTrace: ValidationTrace[] = [];
    const contentRegistryWarnings: string[] = [];
    const appliedChanges: AttributeChange[] = [];

    const endResult = endCombat(state, true);
    state = endResult.state;
    const appliedDrops = endResult.drops || [];
    const lootedSpiritStones = Math.max(0, Number(endResult.spiritStones || 0));
    if (lootedSpiritStones > 0) {
      appliedChanges.push({ attribute: 'spiritStones', delta: lootedSpiritStones, reason: '战斗缴获灵石' });
    }

    const wasHeartDemonTrial = Boolean((session as any).isHeartDemonTrial);
    if (wasHeartDemonTrial) {
      const beforeHeartDemon = state.heartDemon ?? 0;
      state = resolveHeartDemonTrial(state, endStatus === 'victory');
      const delta = (state.heartDemon ?? 0) - beforeHeartDemon;
      if (delta !== 0) {
        appliedChanges.push({ attribute: 'heartDemon', delta, reason: endStatus === 'victory' ? '破除心魔试炼' : '心魔试炼失利' });
      }
    } else if (endStatus === 'victory') {
      const beforeHeartDemon = state.heartDemon ?? 0;
      state = { ...state, heartDemon: Math.min(100, beforeHeartDemon + 3) };
      const delta = (state.heartDemon ?? 0) - beforeHeartDemon;
      if (delta !== 0) {
        appliedChanges.push({ attribute: 'heartDemon', delta, reason: '战斗杀伐扰动道心' });
      }
    }

    let narrative = '';
    let llmNewItems: any[] = [];
    let llmNewThreads: any[] = [];
    let llmCompleteThreadIds: string[] = [];
    try {
      const recentEventsDb = await db.eventLog.findMany({
        where: { characterId },
        orderBy: { age: 'desc' },
        take: 3,
      });
      const recentEvents = recentEventsDb.reverse().map(event => ({
        age: event.age,
        title: event.title,
        narrative: event.narrative,
      }));
      const ctx = buildStateContext(state, recentEvents);
      const resultForLlm = (endStatus === 'victory' || endStatus === 'defeat' || endStatus === 'fled') ? endStatus : 'fled';

      const llmResult = await generateCombatEndNarrative(
        ctx,
        resultForLlm as 'victory' | 'defeat' | 'fled',
        enemies,
        appliedDrops,
      );
      narrative = llmResult.narrative || '';

      if (endStatus === 'victory') {
        const registeredItems = registerMany(llmResult.newItems || [], registerItem, {
          source: 'combat-end',
          age: state.age,
          existingIds: [...state.inventory, ...(state.equipped || []), ...appliedDrops].map(item => item.id),
        });
        contentRegistryTrace.push(...registeredItems.trace);
        contentRegistryWarnings.push(...registeredItems.warnings);
        llmNewItems = registeredItems.accepted;
      } else {
        llmNewItems = [];
      }

      const registeredThreads = registerMany(llmResult.newThreads || [], registerThread, {
        source: 'combat-end',
        age: state.age,
        existingIds: (state.pendingThreads || []).map(thread => thread.id),
      });
      contentRegistryTrace.push(...registeredThreads.trace);
      contentRegistryWarnings.push(...registeredThreads.warnings);
      llmNewThreads = registeredThreads.accepted;
      llmCompleteThreadIds = llmResult.completeThreadIds || [];

      if (llmNewItems.length) state = addItems(state, llmNewItems);
      state = normalizeCultivationState(state);
      if (llmNewThreads.length) state = addThreads(state, llmNewThreads);
      for (const threadId of llmCompleteThreadIds) {
        if (threadId) state = completeThread(state, threadId);
      }
    } catch (err: any) {
      console.error('combat end narrative failed:', err?.message || err);
      narrative = endStatus === 'victory'
        ? '战尘渐落，敌手气息已断，胜负已分。'
        : endStatus === 'defeat'
          ? '血气散乱，意识沉入战尘深处。'
          : '他寻得一线退路，远离战局。';
    }

    state = refreshWorldFacts(state, 'combat-end');
    state = recordActionCausality(state, {
      actionId: `combat_end_${state.age}_${session.id || endStatus}`,
      actionType: 'combat',
      title: endStatus === 'victory' ? '战斗得胜' : endStatus === 'defeat' ? '战斗落败' : '脱离战局',
      summary: narrative,
      tags: ['combat', endStatus || 'ended'],
      newItems: [...appliedDrops, ...llmNewItems],
      threads: llmNewThreads,
    });

    const stateChangeLog = buildStateChangeLog({
      before: stateBeforeCombatEnd,
      after: state,
      appliedChanges,
      rejectedChanges: [],
      contentRegistryTrace,
      effectResolveTrace: [],
      aiBoundaryTrace: [],
    });

    await db.character.update({
      where: { id: characterId },
      data: persistableCombatEndStateData(state),
    });

    const displayEffects = buildEventDisplayEffects({
      before: stateBeforeCombatEnd,
      after: state,
      changes: appliedChanges,
      newItems: [...appliedDrops, ...llmNewItems],
    });
    const effectsWithAudit = appendStateChangeAuditEffect(displayEffects, stateChangeLog);

    try {
      await db.eventLog.create({
        data: {
          characterId,
          age: state.age,
          title: endStatus === 'victory'
            ? `战罢·胜过${(enemies[0]?.name || '敌').slice(0, 6)}`
            : endStatus === 'defeat'
              ? `战罢·败于${(enemies[0]?.name || '敌').slice(0, 6)}`
              : `战罢·退离${(enemies[0]?.name || '敌').slice(0, 6)}`,
          narrative,
          eventType: 'combat',
          effects: JSON.stringify(effectsWithAudit),
        },
      });
    } catch {
      // 日志写入失败不影响战斗结算。
    }

    return NextResponse.json({
      success: true,
      result: endStatus,
      narrative,
      drops: [...appliedDrops, ...llmNewItems],
      lootedSpiritStones,
      newThreads: llmNewThreads,
      completeThreadIds: llmCompleteThreadIds,
      contentRegistryWarnings,
      stateChangeLog,
      state: stateToResponse(state),
    });
  } catch (err: any) {
    console.error('combat end error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '战斗结算失败' },
      { status: 500 }
    );
  }
}
