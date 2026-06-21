// POST /api/game/advance
// 推进年龄 - AI 生成下一岁事件

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeAIEvent, checkLifespan, applyChanges, stateToResponse, tryBreakthrough, addThreads, advanceThread, completeThread, failThread, startCombat, generateCharacterIntents, tryHeartDemonTrial, getSameYearThreads, buildThreadContinuationEvent } from '@/lib/xianxia/engine';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { appendNarrativeContractAuditEffect } from '@/lib/xianxia/state-change-log';
import { clearAdvancePreload, isAdvancePreloadUsable, prepareAdvanceCandidate } from '@/lib/xianxia/advance-preload';
import { getRealmInfo } from '@/lib/xianxia/types';
import { advanceWorldCalendar, clampTimeAdvance, deriveActionProjections, hiddenEventMeta, sanitizeActionProjections, worldTimeStamp } from '@/lib/xianxia/world-time';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    const qualityMode: 'full' | 'light' = body?.qualityMode === 'light' ? 'light' : 'full';
    const skipPreload = Boolean(body?.skipPreload);
    const inputWorldCalendar = body?.worldCalendar;
    const previousWorldLegacies = Array.isArray(body?.previousWorldLegacies) ? body.previousWorldLegacies.slice(0, 8) : [];
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

    const preload = skipPreload ? null : await db.advancePreload.findUnique({ where: { characterId } });
    let candidate;
    if (preload && await isAdvancePreloadUsable(char, preload)) {
      candidate = {
        preparedState: JSON.parse(preload.preparedStateJson),
        blueprint: JSON.parse(preload.blueprintJson),
        aiOutput: JSON.parse(preload.aiOutputJson),
        isFateNode: false,
        fateNode: null,
        recentBlueprintCategories: JSON.parse(char.recentBlueprintCategoriesJson || '[]'),
      };
      await clearAdvancePreload(characterId);
    } else {
      if (preload) await clearAdvancePreload(characterId);
      candidate = await prepareAdvanceCandidate(char, { qualityMode, worldCalendar: inputWorldCalendar, previousWorldLegacies });
    }

    let state = candidate.preparedState;
    const blueprint = candidate.blueprint;
    const aiOutput = candidate.aiOutput;
    const timeAdvance = clampTimeAdvance(aiOutput?.timeAdvance, candidate.aiOutput?.timeAdvance);
    const worldCalendar = advanceWorldCalendar(inputWorldCalendar, timeAdvance);
    const worldTime = worldTimeStamp(worldCalendar);
    const isFateNode = candidate.isFateNode;
    const fateNode = candidate.fateNode;
    const recentBlueprintCategories = candidate.recentBlueprintCategories || [];
    const sameYearThreadIdsBeforeEvent = new Set(
      getSameYearThreads(state).map((thread) => thread.id)
    );

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
        finalState = advanceThread(finalState, urgentThread.id, 30, '因缘暗潮自行推进');
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
        const realmNameBL = getRealmInfo(finalState.realm).name;
        let blSeed = 0; const blStr = `${characterId}|${finalState.age}|bl`;
        for (let bi = 0; bi < blStr.length; bi++) blSeed = (blSeed * 31 + blStr.charCodeAt(bi)) >>> 0;
        const blMajor = [
          `修为水到渠成，瓶颈再难束缚，你顺势冲开大关，跻身${realmNameBL}。`,
          `灵机盈极而溢，关隘轰然洞开，你一举踏入${realmNameBL}之境。`,
          `积淡已足，再不强求，修为自行破关，登临${realmNameBL}。`,
        ];
        const blMinor = [
          `修为圆满，气脉再通一节，你顺势更进一层，晋至${finalState.realmLevel + 1}层。`,
          `灵息盈满，淤塞自解，你的修为悄然更进，晋至${finalState.realmLevel + 1}层。`,
          `水到渠成，不假外力，你的境界稳稳推进，晋至${finalState.realmLevel + 1}层。`,
        ];
        const breakthroughText = br.major ? blMajor[blSeed % blMajor.length] : blMinor[blSeed % blMinor.length];
        aiOutput.narrative = aiOutput.narrative + `

${breakthroughText}`;
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
        }
    }


    // 普通重要事件如 AI 给出选择，进入选择状态；命节点只作 AI 参考，不自动完成或强制标记。
    if (aiOutput.hasChoice) {
      finalState.isAtChoice = true;
    }

    // 同岁续写：若本轮产生/保留了“今年内、不久后、三月后”等必须承接的线索，
    // 自动追加一段同岁史册，避免“准备进仙门，下一年却跑路”这类断裂。
    const sameYearContinuationDrafts: { title: string; narrative: string; eventType: string; effects: any[]; timeAdvance?: any; worldTime?: any; actionProjections?: any[] }[] = [];
    if (!finalState.isAtChoice && !finalState.combatSession && finalState.alive && !finalState.ascended) {
      const sameYearThreads = getSameYearThreads(finalState).filter((thread) => sameYearThreadIdsBeforeEvent.has(thread.id));
      for (const thread of sameYearThreads) {
        const beforeContinuation = { ...finalState };
        const continuationOutput = buildThreadContinuationEvent(finalState, thread);
        const continuationResult = executeAIEvent(finalState, continuationOutput);
        finalState = continuationResult.state;
        const continuationEffects = buildEventDisplayEffects({
          before: beforeContinuation,
          after: finalState,
          changes: continuationResult.appliedChanges,
          newStatuses: continuationOutput.newStatuses,
          newItems: continuationOutput.newItems,
          newEquippedItems: continuationOutput.newEquippedItems,
          removedItemIds: continuationOutput.removedItemIds,
        });
        const continuationTimeAdvance = clampTimeAdvance((continuationOutput as any).timeAdvance, { amount: 1, unit: 'month', label: '月余后', reason: '同年因缘续写', ageDeltaYears: 0, elapsedDays: 30 });
        const continuationActions = deriveActionProjections({ title: continuationOutput.title, narrative: continuationOutput.narrative, eventType: continuationOutput.eventType, threads: finalState.pendingThreads || [] });
        sameYearContinuationDrafts.push({
          title: continuationOutput.title,
          narrative: continuationOutput.narrative,
          eventType: continuationOutput.eventType || 'normal',
          effects: continuationEffects,
          timeAdvance: continuationTimeAdvance,
          actionProjections: continuationActions,
        });
      }
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
        spiritualRoot: finalState.spiritualRoot,
        rootDetail: finalState.rootDetail,
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
        npcsJson: JSON.stringify(finalState.npcs || []),
        causalGraphJson: JSON.stringify(finalState.causalGraph || { nodes: [], edges: [] }),
        worldFactsJson: JSON.stringify(finalState.worldFacts || []),
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
    const displayEffects = appendNarrativeContractAuditEffect(
      buildEventDisplayEffects({
        before: stateBeforeEvent,
        after: finalState,
        changes: result.appliedChanges,
        newStatuses: aiOutput.newStatuses,
        newItems: aiOutput.newItems,
        newEquippedItems: aiOutput.newEquippedItems,
        newPets: aiOutput.newPets,
        removedItemIds: aiOutput.removedItemIds,
      }),
      {
        output: aiOutput,
        eventSchedule: stateBeforeEvent.eventSchedule,
        boundaryEntries: result.stateChangeLog,
      },
    );

    const isSuccessfulBreakthroughText = (title?: string, narrative?: string) =>
      /成功|破境|更进|踏入|晋入|成就|贯通/.test(`${title || ''}
${narrative || ''}`);
    const visibleEventType = (eventType?: string, title?: string, narrative?: string) => {
      if (eventType !== 'breakthrough') return eventType || 'normal';
      return result.breakthroughHappened && isSuccessfulBreakthroughText(title, narrative) ? 'breakthrough' : 'normal';
    };

    const baseActionProjections = sanitizeActionProjections(
      aiOutput.actionProjections,
      deriveActionProjections({
        title: aiOutput.title,
        narrative: aiOutput.narrative,
        eventType: aiOutput.eventType,
        blueprint,
        threads: finalState.pendingThreads || [],
        realms: finalState.discoveredRealms || [],
      }),
    );

    let eventWorldCalendarCursor = worldCalendar;
    let finalWorldCalendar = worldCalendar;
    let finalWorldTime = worldTime;

    const eventDrafts: { title: string; narrative: string; eventType: string; effects: any[]; timeAdvance?: any; worldTime?: any; actionProjections?: any[] }[] = [{
      // 主事件只记录这一段时日发生的因果；不要因为最终数值成功突破，就把“冲关前夜/开始冲关”提前包装成已破境。
      title: aiOutput.title,
      narrative: aiOutput.narrative,
      eventType: isFateNode ? 'fate_node' : visibleEventType(aiOutput.eventType, aiOutput.title, aiOutput.narrative),
      effects: [...displayEffects, hiddenEventMeta({ timeAdvance, worldTime, actionProjections: baseActionProjections })],
      timeAdvance,
      worldTime,
      actionProjections: baseActionProjections,
    }];

    for (const extra of aiOutput.extraEvents || []) {
      const extraTimeAdvance = extra.timeAdvance ? clampTimeAdvance(extra.timeAdvance, timeAdvance) : undefined;
      if (extraTimeAdvance) eventWorldCalendarCursor = advanceWorldCalendar(eventWorldCalendarCursor, extraTimeAdvance);
      const extraWorldTime = extraTimeAdvance ? worldTimeStamp(eventWorldCalendarCursor) : finalWorldTime;
      finalWorldCalendar = eventWorldCalendarCursor;
      finalWorldTime = extraWorldTime;
      const extraActions = sanitizeActionProjections(extra.actionProjections);
      eventDrafts.push({
        title: extra.title,
        narrative: extra.narrative,
        eventType: visibleEventType(extra.eventType || 'normal', extra.title, extra.narrative),
        effects: [hiddenEventMeta({ timeAdvance: extraTimeAdvance, worldTime: extraWorldTime, actionProjections: extraActions })],
        timeAdvance: extraTimeAdvance,
        worldTime: extraWorldTime,
        actionProjections: extraActions,
      });
    }
    for (const continuation of sameYearContinuationDrafts) {
      if (continuation.timeAdvance) eventWorldCalendarCursor = advanceWorldCalendar(eventWorldCalendarCursor, continuation.timeAdvance);
      const continuationWorldTime = continuation.timeAdvance ? worldTimeStamp(eventWorldCalendarCursor) : finalWorldTime;
      finalWorldCalendar = eventWorldCalendarCursor;
      finalWorldTime = continuationWorldTime;
      eventDrafts.push({
        ...continuation,
        worldTime: continuationWorldTime,
        effects: [...continuation.effects, hiddenEventMeta({ timeAdvance: continuation.timeAdvance, worldTime: continuationWorldTime, actionProjections: continuation.actionProjections })],
      });
    }

    // 若引擎最终确认已经突破，单独追加一条破境成功记载。
    // 只有这条显示“破/突破”标签，避免“开始突破/酝酿突破”的过程事件被误标为已成功。
    if (result.breakthroughHappened) {
      const alreadyHasSuccessEvent = eventDrafts.some(e =>
        e.eventType === 'breakthrough' && isSuccessfulBreakthroughText(e.title, e.narrative)
      );
      if (!alreadyHasSuccessEvent) {
        const bSteps = typeof result.breakthroughSteps === 'number' && result.breakthroughSteps > 1 ? result.breakthroughSteps : 1;
        const realmName = getRealmInfo(finalState.realm).name;
        const elPairs: [('metal' | 'wood' | 'water' | 'fire' | 'earth'), string][] = [['metal', '金锐之气'], ['wood', '木灵之气'], ['water', '水润之气'], ['fire', '炙烈之气'], ['earth', '厚土之气']];
        let domEl = elPairs[0];
        for (const pr of elPairs) { if (finalState.elements[pr[0]] > finalState.elements[domEl[0]]) domEl = pr; }
        const flavor = domEl[1];
        const cName = finalState.name || '你';
        const seedStr = `${characterId}|${finalState.age}|${finalState.realm}|${finalState.realmLevel}`;
        let seed = 0; for (let si2 = 0; si2 < seedStr.length; si2++) seed = (seed * 31 + seedStr.charCodeAt(si2)) >>> 0;
        const majorTail = bSteps > 1 ? `一举连进${bSteps}层，跻身${realmName}` : `跻身${realmName}`;
        const majorNarr = [
          `${cName}收束多年因果，气机翻涌如潮。最后一道关隘在心念间松动，周身灵息轰然贯通，旧壳寸寸剥落，${majorTail}。`,
          `这一夜，${cName}周身灵机暴涨，${flavor}沿经脉奔流，冲开淤塞已久的窍穴。识海豁然开朗，旧境如残壳褐去，${majorTail}。`,
          `积淡水到渠成。${cName}屏息凝神，任灵潮一寸寸冲刷瓶颈，只听轰然一震，道基重铸，${majorTail}。`,
          `${cName}盘膝枯坐，引天地灵气灌体。瓶颈在反复冲撞下骤然碎裂，神魂为之一清，${majorTail}。`,
          `因果汇成一线，时机稍纵即逸。${cName}催动全身修为撞向关隘，剧痛过后是前所未有的通透，旧境崩解，${majorTail}。`,
        ];
        const minorNarr = [
          `${cName}的修持水到渠成，闭目调息间，浮动的灵机被一寸寸纳入丹田，气脉渐次清明，修为更进一层。`,
          `一道淤涩在${cName}经脉中悄然化开，${flavor}随之顺畅流转，周身轻盈几分，修为更进一层。`,
          `${cName}心神沉入静定，将连日所悟尽数熔炼入体，灵息盈满窍穴，气脉再通一节。`,
          `不急不躁，${cName}稳稳压住翻涌气机，待其自然沉淀。睁眼时丹田较往日凝实许多，修为更进一层。`,
        ];
        const majorTitles = ['破境成功', '登阶破境', '道境新成'];
        const minorTitles = ['气脉贯通', '修为更进', '境界微进', '灵台澄明'];
        eventDrafts.push({
          title: result.breakthroughMajor ? majorTitles[seed % majorTitles.length] : minorTitles[seed % minorTitles.length],
          narrative: result.breakthroughMajor ? majorNarr[seed % majorNarr.length] : minorNarr[seed % minorNarr.length],
          eventType: 'breakthrough',
          effects: [],
        });
      }
    }

    const createdEvents: any[] = [];
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
        timeAdvance: draft.timeAdvance,
        worldTime: draft.worldTime,
        actionProjections: draft.actionProjections || [],
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
      timeAdvance,
      worldCalendar: finalWorldCalendar,
      worldTime: finalWorldTime,
      actionProjections: baseActionProjections,
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
