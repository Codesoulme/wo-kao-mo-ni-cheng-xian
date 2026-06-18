// POST /api/game/advance
// 推进年龄 - AI 生成下一岁事件

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, buildStateContext, executeAIEvent, checkLifespan, tickStatusDurations, tickNaturalRecovery, checkFateNode, applyChanges, stateToResponse, tryBreakthrough, pickEventBlueprint, addThreads, advanceThread, completeThread, failThread, startCombat, generateCharacterIntents, tickFormations, tickHeartDemon, tryHeartDemonTrial, tickPets } from '@/lib/xianxia/engine';
import { generateAgeEvent } from '@/lib/xianxia/llm';
import { FATE_NODES } from '@/lib/xianxia/types';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';

export const runtime = 'nodejs';
export const maxDuration = 60;

function buildFallbackAgeEvent(state: any, blueprint: any, ctx: any, isFateNode: boolean) {
  const rate = Number(ctx?.cultivationRate?.finalRate || state.cultivationMultiplier || 1) || 1;
  const baseGain = Math.max(6, Math.round(10 * rate));
  const actions = [
    {
      title: '闭关温养',
      narrative: `${state.age}岁，${state.name}没有等天命垂青，而是在${state.location || '暂居之地'}寻了一处清静角落，按旧法吐纳运气。晨昏之间，灵息虽薄，却也一点点沉入丹田；偶有滞涩，便以行走、采水、静坐调匀身心。`,
      changes: [{ attribute: 'cultivationExp', delta: baseGain, reason: '一岁勤修不辍' }],
      insight: `这一年以稳固根基为主，按当前修炼速度约积累${baseGain}点修行进境。`,
    },
    {
      title: '溪畔寻药',
      narrative: `${state.age}岁，${state.name}沿${state.location || '居所'}附近山水寻找可用草木，白日辨药，夜里温习吐纳。虽未撞见惊天机缘，却学会分辨几味养气小草，也借奔走磨了心性。`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(4, Math.round(baseGain * 0.75)), reason: '采药间隙修行' },
        { attribute: 'luck', delta: 1, reason: '熟悉附近山水草木' },
      ],
      insight: `采药与吐纳并行，修行进境约${Math.max(4, Math.round(baseGain * 0.75))}点。`,
    },
    {
      title: '人间历练',
      narrative: `${state.age}岁，${state.name}没有久坐空耗，而是帮村人修桥、护送商队一程，又在夜深时独自运转周天。凡尘琐事不显赫，却让她更明白人心冷暖，也让气息在劳作后更易沉稳。`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(5, Math.round(baseGain * 0.65)), reason: '劳作之后静修' },
        { attribute: 'reputation', delta: 1, reason: '凡尘中积下一点口碑' },
      ],
      insight: `凡事磨心，劳作后静修，仍得${Math.max(5, Math.round(baseGain * 0.65))}点修行进境。`,
    },
    {
      title: '夜读残篇',
      narrative: `${state.age}岁，${state.name}从旧书摊换来几页残破修行札记。文字残缺，未必尽真，她便一边辨伪，一边以自身气感印证。数月下来，没有一步登天，却少走了几分岔路。`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(5, Math.round(baseGain * 0.8)), reason: '参读残篇后修行' },
        { attribute: 'comprehension', delta: 1, reason: '辨读修行札记' },
      ],
      insight: `残篇不足成法，却能校正吐纳，约得${Math.max(5, Math.round(baseGain * 0.8))}点修行进境。`,
    },
  ];
  const picked = actions[Math.abs((state.age || 0) + String(blueprint?.category || '').length) % actions.length];
  const hint = blueprint?.name ? `这一年原本隐有「${blueprint.name}」的因果影子，但天机晦暗，最终只落在日常选择与细碎积累里。` : '';
  return {
    title: picked.title,
    narrative: `${picked.narrative}${hint ? `

${hint}` : ''}`,
    eventType: isFateNode ? 'fate_node' : 'normal',
    changes: picked.changes,
    newStatuses: [],
    newItems: [],
    removedItemIds: [],
    newEquippedItems: [],
    equipItemIds: [],
    unequipItemIds: [],
    memory: `${state.age}岁，${picked.title}。`,
    cultivationInsight: picked.insight,
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
}

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
    // 每岁自然恢复少量气血/灵力；严重伤势仍交由 AI 叙事处理调息、疗伤、求药等。
    state = tickNaturalRecovery(state);
    // Task 21: 阵法维持消耗灵石
    const formationTick = tickFormations(state);
    state = formationTick.state;
    // Task 22: 心魔值每岁自然变化（静修净化 / urgent 线索缠心 / 高心魔反噬）
    state = tickHeartDemon(state);
    // Task 23: 灵宠每岁状态变化（饱食度 -10、忠诚度 -2、HP 回复、低忠诚可能逃离）
    state = tickPets(state);

    // 命节点只作为 AI 的长期参考锚点，不再强制触发或定性角色命运。
    const fateNodeIdx = checkFateNode(state);
    const referenceFateNode = fateNodeIdx !== null ? FATE_NODES.find(n => n.index === fateNodeIdx) : null;
    const isFateNode = false;
    const fateNode = referenceFateNode;

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
      aiOutput = buildFallbackAgeEvent(state, blueprint, ctx, isFateNode);
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
      const br = tryBreakthrough(finalState, {
        reason: aiOutput.breakthroughReason,
        targetRealm: aiOutput.breakthroughTargetRealm,
        targetLevel: aiOutput.breakthroughTargetLevel,
      });
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


    // 普通重要事件如 AI 给出选择，进入选择状态；命节点只作 AI 参考，不自动完成或强制标记。
    if (aiOutput.hasChoice) {
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
          contextFateNodeName: isFateNode ? fateNode?.name : undefined,
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

    // 写入事件日志；同一岁允许多段史册记录，避免复杂年份只塞进一段文本。
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

    const eventDrafts: { title: string; narrative: string; eventType: string; effects: any[] }[] = [{
      title: result.breakthroughHappened ? `境界突破·${aiOutput.title}` : aiOutput.title,
      narrative: aiOutput.narrative,
      eventType: finalEventType,
      effects: displayEffects,
    }];

    for (const extra of aiOutput.extraEvents || []) {
      eventDrafts.push({
        title: extra.title,
        narrative: extra.narrative,
        eventType: extra.eventType || 'normal',
        effects: [],
      });
    }

    // 兜底：若数值已突破但主叙事/额外叙事都没写破境过程，自动补一条独立破境事件。
    const allNarrative = eventDrafts.map(e => `${e.title}\n${e.narrative}`).join('\n');
    if (result.breakthroughHappened && !/突破|破境|冲关|贯通|筑基|炼气|金丹|元婴|化神|大乘|渡劫/.test(allNarrative)) {
      eventDrafts.push({
        title: result.breakthroughMajor ? '破开大关' : '气脉更进',
        narrative: result.breakthroughMajor
          ? `前事既定，灵机终于在丹田深处汇成一线。你收摄心神，循着这一缕契机冲开关隘，气海轰鸣，旧境如壳裂去，新的天地在神识中徐徐展开。`
          : `前事既定，积蓄已久的灵息终于贯通周身。你闭目调息，将浮动气机一寸寸压入丹田，待最后一缕滞涩化开，修为水到渠成，更进一层。`,
        eventType: 'breakthrough',
        effects: [],
      });
    }

    const createdEvents = [];
    for (const [idx, draft] of eventDrafts.entries()) {
      const created = await db.eventLog.create({
        data: {
          characterId,
          age: finalState.age,
          title: draft.title,
          narrative: draft.narrative,
          eventType: draft.eventType,
          effects: JSON.stringify(draft.effects),
        },
      });
      createdEvents.push({
        id: created.id,
        age: created.age,
        title: created.title,
        narrative: created.narrative,
        eventType: created.eventType,
        isFateNode: false,
        fateNodeName: undefined,
        blueprint: idx === 0 ? { category: blueprint.category, name: blueprint.name } : undefined,
        effects: draft.effects,
        createdAt: created.createdAt,
      });
    }

    return NextResponse.json({
      success: true,
      event: createdEvents[0],
      events: createdEvents,
      changes: result.appliedChanges,
      rejectedChanges: result.rejectedChanges,
      breakthrough: result.breakthroughHappened ? { newRealm: result.newRealm, major: Boolean(result.breakthroughMajor), steps: result.breakthroughSteps || 1 } : null,
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
