// POST /api/game/advance
// 推进年龄 - AI 生成下一岁事件

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, buildStateContext, executeAIEvent, checkLifespan, tickStatusDurations, checkFateNode, markFateNodeDone, applyChanges, stateToResponse, tryBreakthrough, pickEventBlueprint, addThreads, advanceThread, completeThread, failThread, startCombat, generateCharacterIntents, tickFormations, tickHeartDemon, tryHeartDemonTrial, tickPets } from '@/lib/xianxia/engine';
import { generateAgeEvent } from '@/lib/xianxia/llm';
import { FATE_NODES } from '@/lib/xianxia/types';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';

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
    // Task 22: 战斗中不可推进年龄——必须先结束战斗
    if (char.combatStateJson) {
      try {
        const cs = JSON.parse(char.combatStateJson);
        if (cs && cs.status === 'ongoing') {
          return NextResponse.json({ success: false, error: '战斗进行中，请先结束战斗' }, { status: 400 });
        }
      } catch { /* ignore */ }
    }

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
      eventType: e.eventType,
    }));

    let state = dbToState(char);
    // Task 20: 抽取本轮事件蓝图（避开最近 3 次同类）
    const recentBlueprintCategories = (state as any)._recentBlueprintCategories || [];
    const blueprint = pickEventBlueprint(state, recentBlueprintCategories);
    // 推进年龄
    state.age += 1;
    // 持续状态 duration -1
    state = tickStatusDurations(state);
    // Task 21: 阵法维持消耗灵石
    const formationTick = tickFormations(state);
    state = formationTick.state;
    // Task 22: 心魔值每岁自然变化（静修净化 / urgent 线索缠心 / 高心魔反噬）
    state = tickHeartDemon(state);
    // Task 23: 灵宠每岁状态变化（饱食度 -10、忠诚度 -2、HP 回复、低忠诚可能逃离）
    state = tickPets(state);

    // 检查是否触发命节点
    const fateNodeIdx = checkFateNode(state);
    const isFateNode = fateNodeIdx !== null;
    const fateNode = isFateNode ? FATE_NODES.find(n => n.index === fateNodeIdx) : null;

    // Task 20: 把蓝图注入 ctx
    const ctx = buildStateContext(state, recentEvents);
    ctx.blueprint = blueprint;

    // 调用 LLM 生成事件（含重试 + 兜底 fallback）
    let aiOutput;
    try {
      aiOutput = await generateAgeEvent(ctx, isFateNode);
    } catch (llmErr: any) {
      // Task 21: LLM 失败兜底——保证游戏不卡死，依然推进年龄并保存进度
      console.error('LLM advance failed, using fallback:', llmErr?.message || llmErr);
      const blueprintName = blueprint?.name || '岁月';
      aiOutput = {
        title: `${blueprintName}·流年`,
        narrative: `${state.age}岁，${state.name}于${state.location || '此地'}度日。${blueprint ? `天道示现"${blueprint.name}"之象。` : ''}岁月流转，未有大事。`,
        eventType: isFateNode ? 'fate_node' : 'normal',
        changes: [],
        newStatuses: [],
        newItems: [],
        removedItemIds: [],
        newEquippedItems: [],
        equipItemIds: [],
        unequipItemIds: [],
        memory: `${state.age}岁流年`,
        cultivationInsight: ctx.cultivationInsight || '',
        hasChoice: false,
        choice: null,
        triggeredBreakthrough: false,
        causedDeath: false,
        causedAscension: false,
        newThreads: [],
        advanceThreads: [],
        completeThreadIds: [],
        failThreadIds: [],
        triggerCombat: null,
      };
      // 若是命节点，必须给选择
      if (isFateNode && fateNode) {
        aiOutput.eventType = 'fate_node';
        aiOutput.hasChoice = true;
        aiOutput.choice = {
          prompt: `命节点「${fateNode.name}」：${fateNode.coreConflict}。请做出你的抉择。`,
          options: [
            { text: '顺应天命，稳健前行', hint: '风险低，收益正常' },
            { text: '逆天而行，激进突破', hint: '风险高，收益丰厚' },
            { text: '另辟蹊径，独行其道', hint: '触发特殊剧情' },
          ],
        };
      }
    }
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
    const stateBeforeEvent = { ...state };
    const result = executeAIEvent(state, aiOutput);
    let finalState = result.state;

    // Task 21 引擎兜底：若本轮蓝图是 thread_resolve 但 AI 未推进任何 urgent 线索，引擎自动加 progressDelta
    // 防止 urgent 线索"原地踏步"——AI 偶尔会忽略 advanceThreads 字段
    if (blueprint.category === 'thread_resolve') {
      const urgentThread = (finalState.pendingThreads || []).find(t => t.status === 'urgent' || (t.status === 'pending' && t.deadlineAge - finalState.age <= 1));
      const aiDidAdvance = (aiOutput.advanceThreads && aiOutput.advanceThreads.length > 0) ||
                            (aiOutput.completeThreadIds && aiOutput.completeThreadIds.length > 0) ||
                            (aiOutput.failThreadIds && aiOutput.failThreadIds.length > 0);
      if (urgentThread && !aiDidAdvance) {
        // 引擎自动推进 +30%（让 urgent 线索不至于完全卡死）
        finalState = advanceThread(finalState, urgentThread.id, 30, '引擎兜底推进（AI 未推进 urgent 线索）');
        console.log(`[Task 21] Engine auto-advancing urgent thread: ${urgentThread.id} (${urgentThread.title}) +30%`);
      }
    }

    // 引擎兜底：若修为已达突破阈值且 AI 未显式触发，则自动突破
    // 这保证修真进度不会无限卡住，且境界会正确更新到顶部信息
    if (
      !result.breakthroughHappened &&
      !result.died &&
      !finalState.ascended &&
      finalState.alive &&
      finalState.cultivationExp >= finalState.expToBreak
    ) {
      const br = tryBreakthrough(finalState);
      if (br.success) {
        finalState = br.state;
        result.breakthroughHappened = true;
        result.newRealm = br.newRealm;
        result.breakthroughMajor = Boolean(br.major);
        // 突破后追加叙事提示（附加到原 narrative 后）
        const breakthroughText = br.major
          ? `修为圆满，水到渠成，你破开大关，踏入新境域。`
          : `修为圆满，水到渠成，你气脉更进一步，晋至${finalState.realmLevel + 1}层。`;
        aiOutput.narrative = aiOutput.narrative + `

【天道感应】${breakthroughText}`;
        aiOutput.triggeredBreakthrough = true;
      }
    }

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

    // Task 22: 心魔试炼触发判定——心魔值 >= 60 时每岁有概率触发独立战斗
    // 注意：只在没有任何战斗（即时或延迟）/选择/死亡的情况下触发，避免叠加
    const hasImmediateOrDeferredCombat = !!finalState.combatSession ||
      !!((finalState as any)._deferredCombat);
    const hasChoiceThisEvent = !!aiOutput.hasChoice;
    if (
      !result.died &&
      !finalState.ascended &&
      finalState.alive &&
      !hasImmediateOrDeferredCombat &&
      !hasChoiceThisEvent
    ) {
      const trial = tryHeartDemonTrial(finalState);
      if (trial.triggered && trial.trigger) {
        finalState = startCombat(finalState, trial.trigger);
        // 追加叙事提示
        aiOutput.narrative = aiOutput.narrative + `\n\n【心魔试炼】${trial.trigger.contextNarrative}`;
        console.log(`[Task 22] Heart demon trial triggered at age ${finalState.age} (heartDemon=${finalState.heartDemon})`);
      }
    }

    // 命节点完成标记（若事件含 hasChoice，等玩家选完再标记；若不含选择直接标记）
    if (isFateNode && fateNode && !aiOutput.hasChoice) {
      finalState = markFateNodeDone(finalState, fateNode.index);
    } else if (isFateNode && fateNode && aiOutput.hasChoice) {
      // 等待玩家选择，先标记为选择中
      finalState.isAtChoice = true;
    } else if (aiOutput.hasChoice) {
      // Task 21 修复 bug：非命节点的普通选择节点也必须设置 isAtChoice=true
      // 否则 choose route 会因 isAtChoice=false 返回 400，玩家点选项无效
      finalState.isAtChoice = true;
    }

    // 持久化 pendingChoice（让页面刷新后可恢复，避免 ChoiceModal 丢失导致卡死）
    // Task 22: 同时保存 deferredCombat——若 hasChoice 与 triggerCombat 同时出现，战斗延迟到选择后触发
    const pendingChoiceJson = (aiOutput.hasChoice && aiOutput.choice)
      ? JSON.stringify({
          prompt: aiOutput.choice.prompt,
          options: aiOutput.choice.options,
          contextTitle: aiOutput.title,
          contextNarrative: aiOutput.narrative,
          contextAge: finalState.age,
          contextFateNodeName: fateNode?.name,
          deferredCombat: (finalState as any)._deferredCombat || null,
        })
      : '';

    // 持久化
    // Task 20: 更新 recentEventTypes / recentBlueprintCategories（用于反重复）
    const recentEventTypes = [...((state as any)._recentEventTypes || []), aiOutput.eventType || 'normal'].slice(-5);
    const newRecentBlueprintCategories = [...recentBlueprintCategories, blueprint.category].slice(-3);

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
        equippedJson: JSON.stringify(finalState.equipped || []),
        storageCapacity: finalState.storageCapacity ?? 5,
        cultivationMultiplier: finalState.cultivationMultiplier ?? 1.0,
        cultivationInsight: finalState.cultivationInsight || '',
        cultivationFactorsJson: JSON.stringify(finalState.cultivationFactors || []),
        pendingChoiceJson,
        memoryJson: JSON.stringify(finalState.longTermMemory),
        // Task 20 新字段
        pendingThreadsJson: JSON.stringify(finalState.pendingThreads || []),
        characterIntentsJson: JSON.stringify(finalState.characterIntents || []),
        combatStateJson: finalState.combatSession ? JSON.stringify(finalState.combatSession) : '',
        recentEventTypesJson: JSON.stringify(recentEventTypes),
        recentBlueprintCategoriesJson: JSON.stringify(newRecentBlueprintCategories),
        // Task 22: 心魔值
        heartDemon: finalState.heartDemon ?? 0,
        // Task 23: 灵宠
        petsJson: JSON.stringify(finalState.pets || []),
        // Task 24: 秘境探索记录
        exploredRealmsJson: JSON.stringify(finalState.exploredRealms || []),
      },
    });

    // 写入事件日志
    // 若发生突破，事件类型强制为 'breakthrough'（便于史册识别）
    const finalEventType = result.breakthroughHappened
      ? 'breakthrough'
      : (isFateNode ? 'fate_node' : aiOutput.eventType);
    const displayEffects = buildEventDisplayEffects({
      before: stateBeforeEvent,
      after: finalState,
      changes: result.appliedChanges,
      newStatuses: aiOutput.newStatuses,
      newItems: aiOutput.newItems,
      newEquippedItems: aiOutput.newEquippedItems,
      newPets: aiOutput.newPets,
      removedItemIds: aiOutput.removedItemIds,
    });
    const event = await db.eventLog.create({
      data: {
        characterId,
        age: finalState.age,
        title: result.breakthroughHappened ? `境界突破·${aiOutput.title}` : aiOutput.title,
        narrative: aiOutput.narrative,
        eventType: finalEventType,
        effects: JSON.stringify(displayEffects),
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
        // Task 20: 返回本轮蓝图主题（让前端可显示）
        blueprint: { category: blueprint.category, name: blueprint.name },
        effects: displayEffects,
      },
      changes: result.appliedChanges,
      rejectedChanges: result.rejectedChanges,
      breakthrough: result.breakthroughHappened ? { newRealm: result.newRealm, major: Boolean(result.breakthroughMajor) } : null,
      hasChoice: aiOutput.hasChoice,
      choice: aiOutput.choice,
      died: result.died,
      deathReason: result.deathReason,
      ascended: finalState.ascended,
      // Task 20: 是否触发战斗（前端据此打开 CombatModal）
      triggeredCombat: !!finalState.combatSession,
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
