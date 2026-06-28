// POST /api/game/item
// 物品动作：装备、卸下、使用。动作结果经引擎校验，并写入可追踪审计。
// P1 step2: 收 where: { id, userId }（dev 模式 userId: undefined，Prisma 自动忽略 → 不破 dev/smoke）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import { dbToState, equipItem, unequipItem, consumeItem, removeItemsByIds, recordActionCausality, stateToResponse, buildStateContext, normalizeCultivationState } from '@/lib/xianxia/engine';
import { generateItemActionNarrative } from '@/lib/xianxia/llm';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { appendStateChangeAuditEffect, buildStateChangeLog } from '@/lib/xianxia/state-change-log';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ItemAction = 'equip' | 'unequip' | 'use' | 'discard';

function actionVerb(action: ItemAction): string {
  if (action === 'equip') return '装备';
  if (action === 'unequip') return '\u5378\u4e0b';
  if (action === 'discard') return '\u4e22\u5f03';
  return '\u4f7f\u7528';
}

function persistableStateData(state: ReturnType<typeof dbToState>) {
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
    inventoryJson: JSON.stringify(state.inventory),
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({
      characterId: z.string(),
      action: z.enum(['equip', 'unequip', 'use', 'discard']),
      itemId: z.string().optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: '参数有误' }, { status: 400 });
    }
    const { characterId, action, itemId } = parsed.data;

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
    if (!char) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });

    let state = dbToState(char as any);
    const stateBeforeAction = {
      ...state,
      inventory: [...state.inventory],
      equipped: [...(state.equipped || [])],
      activeStatuses: [...(state.activeStatuses || [])],
      pets: [...(state.pets || [])],
    };

    if (!itemId) return NextResponse.json({ success: false, error: '缺少 itemId' }, { status: 400 });

    const result = (() => {
      if (action === 'equip') return equipItem(state, itemId);
      if (action === 'unequip') return unequipItem(state, itemId);
      if (action === 'use') return consumeItem(state, itemId);
      const inBag = state.inventory.find(it => it.id === itemId);
      if (!inBag) {
        const equippedItem = (state.equipped || []).find(it => it.id === itemId);
        return {
          state,
          ok: false,
          error: equippedItem ? '\u5df2\u88c5\u5907\u7269\u54c1\u9700\u5148\u5378\u4e0b\u518d\u4e22\u5f03' : '\u7269\u54c1\u4e0d\u5728\u50a8\u7269\u888b\u4e2d',
          appliedChanges: [],
          rejectedChanges: [],
          effectResolveTrace: [],
          effectResolveWarnings: [],
        };
      }
      const removed = removeItemsByIds(state, [itemId]);
      return {
        ...removed,
        ok: removed.removed.length > 0,
        item: removed.removed[0],
        error: removed.removed.length > 0 ? undefined : '\u672a\u627e\u5230\u8981\u4e22\u5f03\u7684\u7269\u54c1',
      };
    })();

    state = result.state;
    const message = result.ok ? `${actionVerb(action)}\u6210\u529f` : (result.error || `${actionVerb(action)}\u5931\u8d25`);
    const appliedItem = result.item;

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    let narrative = '';
    if (action !== 'discard') {
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
        if (!appliedItem) throw new Error('item action produced no item');
        const generated = await generateItemActionNarrative(ctx, action, appliedItem);
        narrative = generated.narrative;
        if (generated.cultivationInsight && generated.cultivationInsight.trim()) {
          state.cultivationInsight = generated.cultivationInsight.trim();
        }
      } catch (err: any) {
        console.error('item action narrative failed:', err?.message || err);
      }
    }

    state = normalizeCultivationState(state);
    state = recordActionCausality(state, {
      actionId: `item_${action}_${state.age}_${appliedItem?.id || itemId}`,
      actionType: 'item',
      title: `${actionVerb(action)}${appliedItem?.name || '物品'}`,
      summary: narrative || message,
      tags: ['item', action],
      usedItems: action === 'use' && appliedItem ? [appliedItem] : [],
      consumedItems: (action === 'use' || action === 'discard') && appliedItem ? [appliedItem] : [],
      equippedItems: action === 'equip' && appliedItem ? [appliedItem] : [],
      unequippedItems: action === 'unequip' && appliedItem ? [appliedItem] : [],
    });

    const stateChangeLog = buildStateChangeLog({
      before: stateBeforeAction,
      after: state,
      appliedChanges: result.appliedChanges,
      rejectedChanges: result.rejectedChanges,
      contentRegistryTrace: [],
      effectResolveTrace: result.effectResolveTrace,
      aiBoundaryTrace: [],
    });

    await db.character.update({
      where: { id: characterId, userId: user?.id },
      data: persistableStateData(state),
    });

    const removedItemIds = (action === 'use' || action === 'discard') && appliedItem?.id ? [appliedItem.id] : [];
    const displayEffects = buildEventDisplayEffects({
      before: stateBeforeAction,
      after: state,
      changes: result.appliedChanges,
      newItems: action === 'unequip' && appliedItem ? [appliedItem] : [],
      newEquippedItems: action === 'equip' && appliedItem ? [appliedItem] : [],
      removedItemIds,
    });
    const effectsWithAudit = appendStateChangeAuditEffect(displayEffects, stateChangeLog);

    const fallbackNarrative = action === 'discard'
      ? `${appliedItem?.name ? `\u300c${appliedItem.name}\u300d` : '\u6b64\u7269'}\u5df2\u79bb\u5f00\u50a8\u7269\u888b\uff0c\u8eab\u4e0a\u8d1f\u7d2f\u968f\u4e4b\u4e00\u8f7b\u3002`
      : `${actionVerb(action)}${appliedItem?.name ? `\u300c${appliedItem.name}\u300d` : '\u6b64\u7269'}\u540e\uff0c\u6c14\u673a\u968f\u4e4b\u5fae\u52a8\u3002`;
    try {
      await db.eventLog.create({
        data: {
          characterId,
          age: state.age,
          title: `${actionVerb(action)}·${(appliedItem?.name || '物品').slice(0, 12)}`,
          narrative: narrative || fallbackNarrative,
          eventType: 'item',
          effects: JSON.stringify(effectsWithAudit),
        },
      });
    } catch {
      // 日志写入失败不影响物品动作本身。
    }

    return NextResponse.json({
      success: true,
      message,
      narrative,
      effectResolveWarnings: result.effectResolveWarnings,
      stateChangeLog,
      state: stateToResponse(state),
    });
  } catch (err: any) {
    console.error('item action error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '物品操作失败' },
      { status: 500 }
    );
  }
}
