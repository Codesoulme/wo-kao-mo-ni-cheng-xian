// POST /api/game/advance
// 推进年龄 - AI 生成下一岁事件

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, buildStateContext, executeAIEvent, checkLifespan, tickStatusDurations, checkFateNode, markFateNodeDone, applyChanges } from '@/lib/xianxia/engine';
import { generateAgeEvent } from '@/lib/xianxia/llm';
import { FATE_NODES } from '@/lib/xianxia/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    if (!characterId) {
      return NextResponse.json({ success: false, error: 'characterId required' }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落，无法继续' }, { status: 400 });
    if (char.ascended) return NextResponse.json({ success: false, error: '角色已飞升，无需继续' }, { status: 400 });
    if (char.isAtChoice) return NextResponse.json({ success: false, error: '当前有待选择，请先完成选择' }, { status: 400 });

    // 取最近事件用于上下文
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
    // 推进年龄
    state.age += 1;
    // 持续状态 duration -1
    state = tickStatusDurations(state);

    // 检查是否触发命节点
    const fateNodeIdx = checkFateNode(state);
    const isFateNode = fateNodeIdx !== null;
    const fateNode = isFateNode ? FATE_NODES.find(n => n.index === fateNodeIdx) : null;

    const ctx = buildStateContext(state, recentEvents);

    // 调用 LLM 生成事件
    const aiOutput = await generateAgeEvent(ctx, isFateNode);
    if (isFateNode && fateNode) {
      aiOutput.eventType = 'fate_node';
      // 命节点必须给选择
      if (!aiOutput.hasChoice) {
        aiOutput.hasChoice = true;
        aiOutput.choice = {
          prompt: `命节点「${fateNode.name}」：${fateNode.coreConflict}。${fateNode.narrativeGoal}。请做出你的抉择。`,
          options: [
            { text: '顺应天命，稳健前行', hint: '风险低，收益正常' },
            { text: '逆天而行，激进突破', hint: '风险高，收益丰厚' },
            { text: '另辟蹊径，独行其道', hint: '触发特殊剧情' },
          ],
        };
      }
    }

    // 引擎执行 AI 输出
    const result = executeAIEvent(state, aiOutput);
    let finalState = result.state;

    // 寿元检查
    if (!result.died && !finalState.ascended) {
      const life = checkLifespan(finalState);
      if (life.died) {
        finalState = life.state;
        result.died = true;
        result.deathReason = life.reason;
        aiOutput.causedDeath = true;
        aiOutput.deathReason = life.reason;
        aiOutput.eventType = 'death';
      }
    }

    // 命节点完成标记（若事件含 hasChoice，等玩家选完再标记；若不含选择直接标记）
    if (isFateNode && fateNode && !aiOutput.hasChoice) {
      finalState = markFateNodeDone(finalState, fateNode.index);
    } else if (isFateNode && fateNode && aiOutput.hasChoice) {
      // 等待玩家选择，先标记为选择中
      finalState.isAtChoice = true;
    }

    // 持久化
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
        lastEventAge: finalState.age,
        statusJson: JSON.stringify(finalState.activeStatuses),
        inventoryJson: JSON.stringify(finalState.inventory),
        memoryJson: JSON.stringify(finalState.longTermMemory),
      },
    });

    // 写入事件日志
    const event = await db.eventLog.create({
      data: {
        characterId,
        age: finalState.age,
        title: aiOutput.title,
        narrative: aiOutput.narrative,
        eventType: isFateNode ? 'fate_node' : aiOutput.eventType,
        effects: JSON.stringify(aiOutput.changes),
      },
    });

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        age: event.age,
        title: event.title,
        narrative: event.narrative,
        eventType: event.eventType,
        isFateNode,
        fateNodeName: fateNode?.name,
      },
      changes: result.appliedChanges,
      rejectedChanges: result.rejectedChanges,
      breakthrough: result.breakthroughHappened ? { newRealm: result.newRealm } : null,
      hasChoice: aiOutput.hasChoice,
      choice: aiOutput.choice,
      died: result.died,
      deathReason: result.deathReason,
      ascended: finalState.ascended,
      state: stateToResponse(finalState),
    });
  } catch (err: any) {
    console.error('advance error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to advance' },
      { status: 500 }
    );
  }
}

function stateToResponse(s: any) {
  return {
    age: s.age,
    lifespan: s.lifespan,
    realm: s.realm,
    realmLevel: s.realmLevel,
    cultivationExp: s.cultivationExp,
    expToBreak: s.expToBreak,
    hp: s.hp, maxHp: s.maxHp,
    mp: s.mp, maxMp: s.maxMp,
    attack: s.attack, defense: s.defense, speed: s.speed,
    luck: s.luck, comprehension: s.comprehension,
    spiritStones: s.spiritStones, reputation: s.reputation,
    alive: s.alive, ascended: s.ascended,
    causeOfDeath: s.causeOfDeath,
    faction: s.faction, master: s.master, location: s.location,
    elements: s.elements,
    fateNodes: s.fateNodes,
    isAtChoice: s.isAtChoice,
    spiritualRoot: s.spiritualRoot,
    rootDetail: s.rootDetail,
    activeStatuses: s.activeStatuses,
    inventory: s.inventory,
  };
}
