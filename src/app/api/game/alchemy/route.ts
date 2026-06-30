// @ts-nocheck - api route, types not critical

// POST /api/game/alchemy
// 炼丹：投入 2-3 味材料 + 灵石，产出丹药或焦丹。
// P1 step2: 收 where: { id, userId }（dev 模式 userId: undefined，Prisma 自动忽略 → 不破 dev/smoke）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import { dbToState, alchemy, computeAlchemyHints, buildStateContext, recordActionCausality, stateToResponse } from '@/lib/xianxia/engine';
import { generateAlchemyOutcome } from '@/lib/xianxia/llm';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { appendStateChangeAuditEffect, buildStateChangeLog } from '@/lib/xianxia/state-change-log';
import { sanitizeNarrativeText } from '@/lib/xianxia/display';
// 批 16: alchemy 路由接 Event Sourcing PoC — 炼丹触发 spirit-stones.changed（花费）+ item.added（产出）
// appendEvent 失败不影响主流程；保留 AI/公式双路径 + 鉴权 + 全部原逻辑。
import { appendEvent } from '@/lib/xianxia/events/store';
// Phase 5 #3: 把 ECS tick-helper 推广到 alchemy 路由。
// 炼丹后 ECS tick（修为推进 + 丹道沉淀），与 choose/interfere/advance 风格对齐——tick 放在 appendEvent 之前（不进事务），失败 try/catch 不阻断主流程。
// deathReason 兜底：ECS 判死时若 causeOfDeath 为空补 'ecs-aging-natural'，不覆盖炼丹焦炉/陨落等事件。
import { tickEcsForCharacter, applyEcsTickToState } from '@/lib/xianxia/ecs/tick-helper';

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

    const isProdMode = !!process.env.ADMIN_TOKEN;
    let user: { id: string } | null = null;
    if (isProdMode) {
      user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const char = await db.character.findUnique({ where: { id: characterId, userId: user?.id } });
    await clearAdvancePreload(characterId);
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });
    if (char.isAtChoice) return NextResponse.json({ success: false, error: '当前有待选择事件，暂不能开炉炼丹' }, { status: 400 });

    const state = dbToState(char as any);
    const stateBeforeAlchemy = { ...state, inventory: [...state.inventory], equipped: [...(state.equipped || [])] };

    const cost = typeof spiritStoneCost === 'number' && spiritStoneCost > 0 ? spiritStoneCost : 10;

    // AI 主路径：先让 AI 按材料/丹道造诣/因果产出炼丹结果，引擎再校验落库；AI 失败则回退引擎公式
    let aiOutcome = null as Awaited<ReturnType<typeof generateAlchemyOutcome>> | null;
    const hints = computeAlchemyHints(state, materialIds, cost);
    if (hints.ok && hints.materials) {
      try {
        const recentDb = await db.eventLog.findMany({ where: { characterId }, orderBy: { age: 'desc' }, take: 3 });
        const recent = recentDb.reverse().map(e => ({ age: e.age, title: e.title, narrative: e.narrative }));
        const ctx = buildStateContext(state, recent);
        aiOutcome = await generateAlchemyOutcome(ctx, hints.materials, {
          baseSuccessRate: hints.baseSuccessRate!,
          suggestedRarity: hints.suggestedRarity!,
          dominantElement: hints.dominantElement!,
          spiritStoneCost: cost,
        });
      } catch (err: any) {
        console.error('alchemy AI outcome failed, fallback to formula:', err?.message || err);
      }
    }

    const result = alchemy(state, materialIds, cost, aiOutcome || undefined);
    const safeNarrative = sanitizeNarrativeText(result.narrative);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const finalState = recordActionCausality(result.state, {
      actionId: `alchemy_${state.age}_${materialIds.join('_')}`,
      actionType: 'alchemy',
      title: result.success ? `炼成${result.product?.name || '丹药'}` : '炼丹焦炉',
      summary: safeNarrative,
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

    // Phase 5 #3: alchemy 接 ECS tick（炼丹成功后修为沉淀 / 寿元推进）。
    // 放在 appendEvent 之前——tick 不进 ES 事务；failure 仅 console.error，不阻断 alchemy 主流程。
    // deathReason 兜底：ECS 判死时若 causeOfDeath 为空补 'ecs-aging-natural'，不覆盖炼丹焦炉/陨落等显式原因。
    try {
      const ecsBaseSnapshot = {
        characterId,
        name: finalState.name || '',
        age: finalState.age,
        realm: finalState.realm,
        cultivationExp: finalState.cultivationExp,
        hp: finalState.hp,
        maxHp: finalState.maxHp,
        spiritStones: finalState.spiritStones,
        alive: finalState.alive,
        lifespan: finalState.lifespan || 100,
        inventory: [],
      };
      const ecsResult = tickEcsForCharacter(characterId, ecsBaseSnapshot, { source: 'alchemy' });
      applyEcsTickToState(finalState, ecsResult);
    } catch (e) {
      console.error('[alchemy] ECS tick failed (non-fatal):', e);
    }

    // Event Sourcing PoC: alchemy 触发 spirit-stones.changed（炼丹耗用，delta < 0）。
    // 成功时（result.success === true 且 result.product 存在）再追加 item.added。
    // 失败时只写灵石消耗事件，丹药 event 不发。
    // appendEvent 失败用 try/catch 兜底——不影响主流程。
    try {
      await appendEvent({
        characterId,
        type: 'character.spirit-stones.changed',
        data: {
          type: 'character.spirit-stones.changed',
          delta: -result.spiritStoneCost,
          newValue: finalState.spiritStones,
          reason: result.success ? 'alchemy-craft' : 'alchemy-failed',
        },
        source: 'user-action',
        triggerActor: 'player',
        createdAtAge: finalState.age,
      });
      if (result.success && result.product && result.product.id) {
        await appendEvent({
          characterId,
          type: 'character.item.added',
          data: {
            type: 'character.item.added',
            itemId: result.product.id,
            item: result.product,
          },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: finalState.age,
        });
      }
    } catch (evtErr: any) {
      console.error('[alchemy] event append failed (non-fatal):', evtErr?.message || evtErr);
    }

    await db.character.update({
      where: { id: characterId, userId: user?.id },
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
        causeOfDeath: finalState.causeOfDeath || '',
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
        narrative: safeNarrative,
        eventType: 'alchemy',
        effects: JSON.stringify(effectsWithAudit),
      },
    });

    return NextResponse.json({
      success: true,
      alchemySuccess: result.success,
      narrative: safeNarrative,
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
