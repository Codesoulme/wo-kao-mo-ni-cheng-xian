// POST /api/game/choose
// 玩家在命节点/重要事件中做出选择

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, buildStateContext, applyChanges, addStatuses, addItems, addMemory, checkLifespan, markFateNodeDone, tickStatusDurations, tryBreakthrough, stateToResponse, removeItemsByIds, equipItemsByIds, unequipItemsByIds, recalcCultivationMultiplier, applyItemEffects, ensureUniqueIds, computeCultivationFactors, addThreads, advanceThread, completeThread, failThread, startCombat, addPet } from '@/lib/xianxia/engine';
import { generateChoiceResult } from '@/lib/xianxia/llm';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    const chosenIndex: number | undefined = body?.chosenIndex;
    const choicePrompt: string | undefined = body?.choicePrompt;
    const options: any[] | undefined = body?.options;

    if (!characterId || chosenIndex === undefined || typeof choicePrompt !== 'string' || !Array.isArray(options)) {
      return NextResponse.json({ success: false, error: `参数缺失: ${!characterId ? 'characterId' : ''} ${chosenIndex === undefined ? 'chosenIndex' : ''} ${typeof choicePrompt !== 'string' ? 'choicePrompt' : ''} ${!Array.isArray(options) ? 'options' : ''}` }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });
    if (!char.isAtChoice) return NextResponse.json({ success: false, error: '当前无待选择' }, { status: 400 });

    const chosenOption = options[chosenIndex];
    if (!chosenOption) return NextResponse.json({ success: false, error: '选项无效' }, { status: 400 });

    const recentEventsDb = await db.eventLog.findMany({
      where: { characterId },
      orderBy: { age: 'desc' },
      take: 5,
    });
    const recentEvents = recentEventsDb.reverse().map(e => ({
      age: e.age,
      title: e.title,
      narrative: e.narrative,
      eventType: e.eventType,
    }));

    let state = dbToState(char);
    const ctx = buildStateContext(state, recentEvents);

    // Task 22: 读取 pendingChoice 中的 deferredCombat（advance 时若同时有 choice + combat，战斗延迟到选择后触发）
    let deferredCombat: any = null;
    try {
      const pc = char.pendingChoiceJson ? JSON.parse(char.pendingChoiceJson) : null;
      if (pc && pc.deferredCombat && pc.deferredCombat.enemies?.length) {
        deferredCombat = pc.deferredCombat;
      }
    } catch { /* ignore parse errors */ }

    const result = await generateChoiceResult(ctx, choicePrompt, chosenOption.text);

    // 应用变更
    state = applyChanges(state, result.changes || []);
    state = addStatuses(state, result.newStatuses || []);
    state = addItems(state, result.newItems || []);
    if (result.removedItemIds && result.removedItemIds.length) {
      state = removeItemsByIds(state, result.removedItemIds).state;
    }
    // AI 联动：创造性装备（如玩家把储物戒指串成项链）
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
    // 不再合并 AI 输出——AI 输出不稳定会导致条目忽隐忽现，且编造的数字与 multiplier 脱节
    state.cultivationFactors = computeCultivationFactors(state);
    // Task 20: 应用未决线索变更
    if (result.newThreads && result.newThreads.length) state = addThreads(state, result.newThreads);
    if (result.advanceThreads && result.advanceThreads.length) {
      for (const adv of result.advanceThreads) {
        if (adv.id) state = advanceThread(state, adv.id, adv.progressDelta || 0, adv.note);
      }
    }
    if (result.completeThreadIds && result.completeThreadIds.length) {
      for (const id of result.completeThreadIds) state = completeThread(state, id);
    }
    if (result.failThreadIds && result.failThreadIds.length) {
      for (const id of result.failThreadIds) state = failThread(state, id);
    }
    // Task 20: 触发战斗
    // Task 22: 优先使用选择结果的 triggerCombat（AI 可根据玩家选择定制战斗）；
    // 若选择结果未触发战斗，但 advance 时延迟了战斗 → 现在作为 fallback 触发
    if (result.triggerCombat && result.triggerCombat.enemies?.length) {
      state = startCombat(state, result.triggerCombat);
    } else if (deferredCombat) {
      state = startCombat(state, deferredCombat);
    }
    // Task 23: 应用 AI 授予的灵宠
    if ((result as any).newPets && (result as any).newPets.length) {
      for (const pet of (result as any).newPets) {
        state = addPet(state, pet);
      }
    }

    // 处理死亡
    let died = false;
    let deathReason: string | undefined;
    if (result.causedDeath) {
      state.alive = false;
      state.causeOfDeath = result.deathReason || '陨落于劫难';
      died = true;
      deathReason = state.causeOfDeath;
    }

    // 寿元检查
    if (!died && !state.ascended) {
      const life = checkLifespan(state);
      if (life.died) {
        state = life.state;
        died = true;
        deathReason = life.reason;
      }
    }

    // 检查命节点是否完成（如果之前是命节点）
    // 简化：每次选择后尝试标记当前年龄对应的命节点
    const fateNodeAge = state.age;
    // 尝试标记最近的命节点
    const FATE_NODES = (await import('@/lib/xianxia/types')).FATE_NODES;
    for (const node of FATE_NODES) {
      if (state.fateNodes.includes(node.index)) continue;
      if (fateNodeAge >= node.triggerAge.min && fateNodeAge <= node.triggerAge.max) {
        state = markFateNodeDone(state, node.index);
        break;
      }
    }

    // 选择后退出选择态
    state.isAtChoice = false;

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
        fateNodes: state.fateNodes.join(','),
        isAtChoice: state.isAtChoice,
        statusJson: JSON.stringify(state.activeStatuses),
        inventoryJson: JSON.stringify(state.inventory),
        equippedJson: JSON.stringify(state.equipped || []),
        storageCapacity: state.storageCapacity ?? 5,
        cultivationMultiplier: state.cultivationMultiplier ?? 1.0,
        cultivationInsight: state.cultivationInsight || '',
        cultivationFactorsJson: JSON.stringify(state.cultivationFactors || []),
        pendingChoiceJson: '',
        memoryJson: JSON.stringify(state.longTermMemory),
        // Task 20 新字段
        pendingThreadsJson: JSON.stringify(state.pendingThreads || []),
        characterIntentsJson: JSON.stringify(state.characterIntents || []),
        combatStateJson: state.combatSession ? JSON.stringify(state.combatSession) : '',
        // Task 22: 心魔值
        heartDemon: state.heartDemon ?? 0,
        // Task 23: 灵宠
        petsJson: JSON.stringify(state.pets || []),
      },
    });

    // 写入选择日志
    await db.choiceLog.create({
      data: {
        characterId,
        age: state.age,
        prompt: choicePrompt,
        options: JSON.stringify(options),
        chosenIndex,
        chosenText: chosenOption.text,
        result: result.narrative,
      },
    });

    // 写入事件日志
    await db.eventLog.create({
      data: {
        characterId,
        age: state.age,
        title: `抉择：${chosenOption.text.slice(0, 12)}`,
        narrative: result.narrative,
        eventType: 'choice',
        effects: JSON.stringify(result.changes || []),
      },
    });

    return NextResponse.json({
      success: true,
      narrative: result.narrative,
      changes: result.changes,
      newStatuses: result.newStatuses,
      newItems: result.newItems,
      died,
      deathReason,
      // Task 20: 是否触发战斗（前端据此打开 CombatModal）
      triggeredCombat: !!state.combatSession,
      state: stateToResponse(state),
    });
  } catch (err: any) {
    console.error('choose error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process choice' },
      { status: 500 }
    );
  }
}
