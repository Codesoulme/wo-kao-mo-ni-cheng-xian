// POST /api/game/interfere
// 玩家在任意时刻输入"干扰模拟"

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, buildStateContext, applyChanges, addStatuses, addItems, addMemory, checkLifespan, stateToResponse, removeItemsByIds, equipItemsByIds, unequipItemsByIds, recalcCultivationMultiplier, applyItemEffects, ensureUniqueIds, computeCultivationFactors } from '@/lib/xianxia/engine';
import { generateInterfereResponse } from '@/lib/xianxia/llm';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    const input: string | undefined = body?.input;

    if (!characterId || !input || !input.trim()) {
      return NextResponse.json({ success: false, error: 'characterId 和 input 必填' }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });

    const recentEventsDb = await db.eventLog.findMany({
      where: { characterId },
      orderBy: { age: 'desc' },
      take: 5,
    });
    const recentEvents = recentEventsDb.reverse().map(e => ({
      age: e.age,
      title: e.title,
      narrative: e.narrative,
    }));

    let state = dbToState(char);
    const ctx = buildStateContext(state, recentEvents);

    const result = await generateInterfereResponse(ctx, input.trim());

    // 仅当 accepted 时应用变更
    let died = false;
    let deathReason: string | undefined;
    if (result.accepted) {
      state = applyChanges(state, result.changes || []);
      state = addStatuses(state, result.newStatuses || []);
      state = addItems(state, result.newItems || []);
      if (result.removedItemIds && result.removedItemIds.length) {
        state = removeItemsByIds(state, result.removedItemIds).state;
      }
      // AI 联动：创造性装备（玩家干扰“把储物戒指串成项链”等）
      if (result.newEquippedItems && result.newEquippedItems.length) {
        const ensured = ensureUniqueIds([], result.newEquippedItems).items;
        state = { ...state, equipped: [...(state.equipped || []), ...ensured] };
        for (const it of ensured) state = applyItemEffects(state, it, 1);
        state = recalcCultivationMultiplier(state);
      }
      if (result.equipItemIds && result.equipItemIds.length) {
        state = equipItemsByIds(state, result.equipItemIds).state;
      }
      if (result.unequipItemIds && result.unequipItemIds.length) {
        state = unequipItemsByIds(state, result.unequipItemIds).state;
      }
      if (result.memory) state = addMemory(state, result.memory);
      // 应用修炼心得文本（仅当 AI 输出了非空文本时覆盖）
      if (result.cultivationInsight && result.cultivationInsight.trim()) {
        state.cultivationInsight = result.cultivationInsight.trim();
      }
      // 引擎权威：cultivationFactors 完全由引擎从 state 计算（灵根 + 功法 + 状态词条）
      // 不再合并 AI 输出——避免条目忽隐忽现 + 数字与 multiplier 脱节
      state.cultivationFactors = computeCultivationFactors(state);

      // 干扰可能消耗时间
      if (result.ageAdvance && result.ageAdvance > 0) {
        state.age += result.ageAdvance;
        // 检查寿元
        const life = checkLifespan(state);
        if (life.died) {
          state = life.state;
          died = true;
          deathReason = life.reason;
        }
      }
    }

    // 持久化
    await db.character.update({
      where: { id: characterId },
      data: {
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
        hp: state.hp, maxHp: state.maxHp,
        mp: state.mp, maxMp: state.maxMp,
        attack: state.attack, defense: state.defense, speed: state.speed,
        luck: state.luck, comprehension: state.comprehension,
        spiritStones: state.spiritStones, reputation: state.reputation,
        alive: state.alive, ascended: state.ascended,
        causeOfDeath: state.causeOfDeath,
        faction: state.faction, master: state.master, location: state.location,
        statusJson: JSON.stringify(state.activeStatuses),
        inventoryJson: JSON.stringify(state.inventory),
        equippedJson: JSON.stringify(state.equipped || []),
        storageCapacity: state.storageCapacity ?? 5,
        cultivationMultiplier: state.cultivationMultiplier ?? 1.0,
        cultivationInsight: state.cultivationInsight || '',
        cultivationFactorsJson: JSON.stringify(state.cultivationFactors || []),
        memoryJson: JSON.stringify(state.longTermMemory),
      },
    });

    // 写入干扰日志
    await db.interferenceLog.create({
      data: {
        characterId,
        age: state.age,
        input: input.trim(),
        classification: result.classification,
        response: result.narrative,
        effects: JSON.stringify(result.accepted ? result.changes : []),
        accepted: result.accepted,
      },
    });

    // 干扰也算一次事件，写入事件日志
    await db.eventLog.create({
      data: {
        characterId,
        age: state.age,
        title: result.accepted ? '干扰·天道回响' : '干扰·世界如常',
        narrative: result.narrative,
        eventType: 'interference',
        effects: JSON.stringify(result.accepted ? result.changes : []),
      },
    });

    return NextResponse.json({
      success: true,
      classification: result.classification,
      accepted: result.accepted,
      narrative: result.narrative,
      changes: result.accepted ? result.changes : [],
      newStatuses: result.accepted ? result.newStatuses : [],
      newItems: result.accepted ? result.newItems : [],
      ageAdvance: result.ageAdvance,
      died,
      deathReason,
      state: stateToResponse(state),
    });
  } catch (err: any) {
    console.error('interfere error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process interference' },
      { status: 500 }
    );
  }
}
