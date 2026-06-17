// POST /api/game/choose
// 玩家在命节点/重要事件中做出选择

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, buildStateContext, applyChanges, addStatuses, addItems, addMemory, checkLifespan, markFateNodeDone, tickStatusDurations, tryBreakthrough, stateToResponse, removeItemsByIds } from '@/lib/xianxia/engine';
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

    if (!characterId || chosenIndex === undefined || !choicePrompt || !Array.isArray(options)) {
      return NextResponse.json({ success: false, error: '参数缺失' }, { status: 400 });
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
    }));

    let state = dbToState(char);
    const ctx = buildStateContext(state, recentEvents);

    const result = await generateChoiceResult(ctx, choicePrompt, chosenOption.text);

    // 应用变更
    state = applyChanges(state, result.changes || []);
    state = addStatuses(state, result.newStatuses || []);
    state = addItems(state, result.newItems || []);
    if (result.removedItemIds && result.removedItemIds.length) {
      state = removeItemsByIds(state, result.removedItemIds).state;
    }
    if (result.memory) state = addMemory(state, result.memory);

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
        equippedJson: JSON.stringify(state.equipped || {}),
        cultivationMultiplier: state.cultivationMultiplier ?? 1.0,
        memoryJson: JSON.stringify(state.longTermMemory),
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
