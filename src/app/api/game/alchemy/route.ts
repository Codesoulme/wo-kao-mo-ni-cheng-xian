// POST /api/game/alchemy
// 炼丹：投入 2-3 味材料 + 灵石，产出丹药或焦丹。

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import { dbToState, alchemy, recordActionCausality, stateToResponse } from '@/lib/xianxia/engine';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { appendStateChangeAuditEffect, buildStateChangeLog } from '@/lib/xianxia/state-change-log';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    const materialIds: string[] | undefined = body?.materialIds;
    const spiritStoneCost: number | undefined = body?.spiritStoneCost;

    if (!characterId) {
      return NextResponse.json({ success: false, error: '缺少 characterId' }, { status: 400 });
    }
    if (!Array.isArray(materialIds) || materialIds.length < 2 || materialIds.length > 3) {
      return NextResponse.json({ success: false, error: '须选 2-3 味材料入炉' }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    await clearAdvancePreload(characterId);
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });
    if (char.isAtChoice) return NextResponse.json({ success: false, error: '当前有待选择事件，暂不能开炉炼丹' }, { status: 400 });

    const state = dbToState(char as any);
    const stateBeforeAlchemy = { ...state, inventory: [...state.inventory], equipped: [...(state.equipped || [])] };

    const cost = typeof spiritStoneCost === 'number' && spiritStoneCost > 0 ? spiritStoneCost : 10;
    const result = alchemy(state, materialIds, cost);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const finalState = recordActionCausality(result.state, {
      actionId: `alchemy_${state.age}_${materialIds.join('_')}`,
      actionType: 'alchemy',
      title: result.success ? `炼成${result.product?.name || '丹药'}` : '炼丹焦炉',
      summary: result.narrative,
      tags: ['alchemy', result.success ? 'success' : 'failed'],
      newItems: result.product ? [result.product] : [],
      consumedItems: result.consumedMaterials,
    });
    const stateChangeLog = buildStateChangeLog({
      before: stateBeforeAlchemy,
      after: finalState,
      appliedChanges: [{ attribute: 'spiritStones', delta: -result.spiritStoneCost, reason: '炼丹耗用' }],
      rejectedChanges: [],
      contentRegistryTrace: result.contentRegistryTrace,
      effectResolveTrace: [],
      aiBoundaryTrace: [],
    });

    await db.character.update({
      where: { id: characterId },
      data: {
        age: finalState.age,
        lifespan: finalState.lifespan,
        realm: finalState.realm,
        realmLevel: finalState.realmLevel,
        cultivationExp: finalState.cultivationExp,
        expToBreak: finalState.expToBreak,
        elementMetal: finalState.elements.metal,
        elementWood: finalState.elements.wood,
        elementWater: finalState.elements.water,
        elementFire: finalState.elements.fire,
        elementEarth: finalState.elements.earth,
        hp: finalState.hp,
        maxHp: finalState.maxHp,
        mp: finalState.mp,
        maxMp: finalState.maxMp,
        attack: finalState.attack,
        defense: finalState.defense,
        speed: finalState.speed,
        luck: finalState.luck,
        comprehension: finalState.comprehension,
        spiritStones: finalState.spiritStones,
        reputation: finalState.reputation,
        alive: finalState.alive,
        ascended: finalState.ascended,
        causeOfDeath: finalState.causeOfDeath,
        faction: finalState.faction,
        master: finalState.master,
        location: finalState.location,
        fateNodes: finalState.fateNodes.join(','),
        isAtChoice: finalState.isAtChoice,
        lastEventAge: finalState.lastEventAge,
        statusJson: JSON.stringify(finalState.activeStatuses),
        inventoryJson: JSON.stringify(finalState.inventory),
        equippedJson: JSON.stringify(finalState.equipped || []),
        storageCapacity: finalState.storageCapacity ?? 5,
        cultivationMultiplier: finalState.cultivationMultiplier ?? 1.0,
        cultivationInsight: finalState.cultivationInsight || '',
        cultivationFactorsJson: JSON.stringify(finalState.cultivationFactors || []),
        memoryJson: JSON.stringify(finalState.longTermMemory || []),
        pendingThreadsJson: JSON.stringify(finalState.pendingThreads || []),
        characterIntentsJson: JSON.stringify(finalState.characterIntents || []),
        combatStateJson: finalState.combatSession ? JSON.stringify(finalState.combatSession) : '',
        npcsJson: JSON.stringify(finalState.npcs || []),
        causalGraphJson: JSON.stringify(finalState.causalGraph || { nodes: [], edges: [] }),
        worldFactsJson: JSON.stringify(finalState.worldFacts || []),
        heartDemon: finalState.heartDemon ?? 0,
        petsJson: JSON.stringify(finalState.pets || []),
        exploredRealmsJson: JSON.stringify(finalState.exploredRealms || []),
      },
    });

    const displayEffects = buildEventDisplayEffects({
      before: stateBeforeAlchemy,
      after: finalState,
      changes: [{ attribute: 'spiritStones', delta: -result.spiritStoneCost, reason: '炼丹耗用' }],
      newItems: result.product ? [result.product] : [],
      removedItemIds: result.consumedMaterials.map(material => material.id),
    });
    const effectsWithAudit = appendStateChangeAuditEffect(displayEffects, stateChangeLog);

    await db.eventLog.create({
      data: {
        characterId,
        age: finalState.age,
        title: result.success ? `开炉炼成${result.product?.name || '丹药'}` : '炼丹失手成焦丹',
        narrative: result.narrative,
        eventType: 'alchemy',
        effects: JSON.stringify(effectsWithAudit),
      },
    });

    return NextResponse.json({
      success: true,
      alchemySuccess: result.success,
      narrative: result.narrative,
      product: result.product,
      consumedMaterials: result.consumedMaterials.map(material => ({ id: material.id, name: material.name })),
      spiritStoneCost: result.spiritStoneCost,
      successRate: Math.round(result.successRate),
      contentRegistryWarnings: result.contentRegistryWarnings,
      stateChangeLog,
      state: stateToResponse(finalState),
    });
  } catch (err: any) {
    console.error('alchemy error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to alchemy' },
      { status: 500 }
    );
  }
}
