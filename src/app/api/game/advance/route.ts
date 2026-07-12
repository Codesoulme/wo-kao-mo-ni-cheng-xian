// @ts-nocheck - api route, types not critical

// POST /api/game/advance
// 推进年龄 - AI 生成下一岁事件

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeAIEvent, checkLifespan, applyAnnualAttributeGrowth, applyChanges, stateToResponse, tryBreakthrough, addThreads, advanceThread, completeThread, failThread, startCombat, generateCharacterIntents, tryHeartDemonTrial, getSameYearThreads, buildThreadContinuationEvent } from '@/lib/xianxia/engine';
import { detectLifespanExtension } from '@/lib/xianxia/realm-lifespan';
import { parseAchievementMarkers, applyAchievements } from '@/lib/xianxia/achievements';
import { tickAllNpcsForYear } from '@/lib/xianxia/npc-growth';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { sanitizeEventDraft, truncateNarrativeAtSentence, completeNarrative } from '@/lib/xianxia/display';
import { appendNarrativeContractAuditEffect } from '@/lib/xianxia/state-change-log';
import { clearAdvancePreload, isAdvancePreloadUsable, prepareAdvanceCandidate } from '@/lib/xianxia/advance-preload';
import { getRealmInfo } from '@/lib/xianxia/types';
import { advanceWorldCalendar, clampTimeAdvance, deriveActionProjections, formatWorldTimeDisplay, hiddenEventMeta, inferInlineTimeAdvance, phaseHintForTime, sanitizeActionProjections, worldTimeStamp } from '@/lib/xianxia/world-time';
import { buildAdvanceStateData } from '@/lib/xianxia/persist-advance-state';
import { appendEvent } from '@/lib/xianxia/events/store';
import { getCurrentUser } from '@/lib/auth-helpers';
// 2026-07-12：临终 LLM 叙事——避免死亡兜底只有一句"星辰夜凉，再无来者"
import { generateDeathNarrative } from '@/lib/xianxia/llm';
// 批 20: ECS 集成 advance —— 让 AgingSystem / CultivationSystem 在 advance 路径上额外跑一次 world.tick()
// Phase 5 #2: 抽 helper 后用 tickEcsForCharacter / applyEcsTickToState
import { tickEcsForCharacter, applyEcsTickToState } from '@/lib/xianxia/ecs/tick-helper';


// P1 step2 worker A: 生产模式下强制 userId 检查；dev 模式保持原行为。
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const isProdMode = process.env.SKIP_AUTH !== '1' && !!process.env.ADMIN_TOKEN;
    let user: { id: string } | null = null;
    if (isProdMode) {
      user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    const qualityMode: 'full' | 'light' = body?.qualityMode === 'light' ? 'light' : 'full';
    const skipPreload = Boolean(body?.skipPreload);
    const inputWorldCalendar = body?.worldCalendar;
    const previousWorldLegacies = Array.isArray(body?.previousWorldLegacies) ? body.previousWorldLegacies.slice(0, 8) : [];
    // 2026-07-12：玩家通过 UI 强制按月推进——把 forceTimeAdvance 透传给引擎，
    // 引擎把 state.age 预增量严格按 forceTimeAdvance（通常 ageDeltaYears=0）。
    const forceTimeAdvance = body?.forceTimeAdvance && typeof body.forceTimeAdvance === 'object'
      ? body.forceTimeAdvance : null;
    if (!characterId) {
      return NextResponse.json({ success: false, error: 'characterId required' }, { status: 400 });
    }

    const char = await db.character.findUnique({
      where: isProdMode ? { id: characterId, userId: user!.id } : { id: characterId },
    });
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落，无法继续' }, { status: 400 });
    if (char.ascended) return NextResponse.json({ success: false, error: '角色已飞升，无需继续' }, { status: 400 });
    if (char.isAtChoice) return NextResponse.json({ success: false, error: '当前有待选择，请先完成选择' }, { status: 400 });
    // P0: 幂等保护 - 记录推进前年龄，后续 update 加条件
    const ageBefore = char.age;
    const lastEventAgeBefore = char.lastEventAge ?? char.age;
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
    let usedPreload = false;
    const preloadResult = preload ? await isAdvancePreloadUsable(char, preload) : { usable: false };
    if (preloadResult.usable && preload) {
      candidate = {
        preparedState: JSON.parse(preload.preparedStateJson),
        blueprint: JSON.parse(preload.blueprintJson),
        aiOutput: JSON.parse(preload.aiOutputJson),
        isFateNode: false,
        fateNode: null,
        recentBlueprintCategories: JSON.parse(char.recentBlueprintCategoriesJson || '[]'),
      };
      usedPreload = true;
      await clearAdvancePreload(characterId);
    } else {
      if (preload) await clearAdvancePreload(characterId);
      candidate = await prepareAdvanceCandidate(char, { qualityMode, worldCalendar: inputWorldCalendar, previousWorldLegacies });
    }

    let state = candidate.preparedState;
    const blueprint = candidate.blueprint;
    const aiOutput = candidate.aiOutput;
    let timeAdvance = clampTimeAdvance(aiOutput?.timeAdvance, candidate.aiOutput?.timeAdvance);
    // 2026-07-12：玩家按月推进入参优先——强制覆盖引擎根据 narrative 推断出的跨度。
    if (forceTimeAdvance) {
      timeAdvance = clampTimeAdvance(forceTimeAdvance, timeAdvance);
    }
    let worldCalendar = advanceWorldCalendar(inputWorldCalendar, timeAdvance);
    const worldTime = worldTimeStamp(worldCalendar);
    const isFateNode = candidate.isFateNode;
    const fateNode = candidate.fateNode;
    const recentBlueprintCategories = candidate.recentBlueprintCategories || [];
    // 引擎执行 AI 输出
    const stateBeforeEvent = { ...state };
    const result = executeAIEvent(state, aiOutput);
    let finalState = result.state;

    // 沉浸版 Phase-N: 主角年度属性成长（修真后 8 维 / 凡人基础 / force/guard/agility）
    try {
      const growthResult = applyAnnualAttributeGrowth(finalState);
      if (growthResult && growthResult.state) {
        finalState = growthResult.state;
        (finalState as any).__lastAnnualGrowth = growthResult.growth;
      }
    } catch (e) {
      console.warn('[advance] applyAnnualAttributeGrowth failed:', e);
    }

    // 沉浸感：年龄跳跃对账
    // prepareAdvanceCandidate 用 AI 的 timeAdvance 预增 state.age，但 AI 常常不填 / 填 1 年。
    // 推进完拿到叙事后，从 AI 的标题+正文里重新推断时间单位；如果推断出小时间单位
    // （入夜/翌日/数日后等，ageDeltaYears=0），但原预增 ≥ 1，就把多跳的岁数还回去，
    // 世界历同步回滚。避免"叙事里写三日后却跳了一岁"的叙事违和。
    const inferredInline = inferInlineTimeAdvance(aiOutput?.title, aiOutput?.narrative);
    if (inferredInline && inferredInline.ageDeltaYears < timeAdvance.ageDeltaYears) {
      const yearDelta = timeAdvance.ageDeltaYears - inferredInline.ageDeltaYears;
      if (yearDelta > 0) {
        finalState = { ...finalState, age: Math.max(0, (finalState.age || 0) - yearDelta) };
        const daysToRevert = yearDelta * 365;
        const newElapsedDays = Math.max(0, worldCalendar.elapsedDays - daysToRevert);
        worldCalendar = { ...worldCalendar, elapsedDays: newElapsedDays };
        // 同时把本次推进写入的事件 createdAtAge 一起回滚（在线索/事件里保持一致）
        timeAdvance = { ...timeAdvance, ageDeltaYears: inferredInline.ageDeltaYears, amount: inferredInline.amount, unit: inferredInline.unit, label: inferredInline.label, elapsedDays: inferredInline.elapsedDays };
      }
    }

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
    // 这保证修仙进度不会无限卡住，且境界会正确更新到顶部信息
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
      finalState = life.state;
      // 沉浸版 Phase-Life: 大限过渡 + narrative 延寿检测
      try {
        const narr = String((aiOutput as any)?.narrative ?? '');
        const ext = detectLifespanExtension(narr);
        if (ext && (finalState as any).nearDeath) {
          finalState = { ...finalState, lifespan: (finalState.lifespan || 0) + ext.extended, nearDeath: false, nearDeathYear: undefined, causeOfDeath: undefined };
          (finalState as any).__lastLifespanExtension = { delta: ext.extended, reason: ext.reason, hint: ext.hint };
        }
      } catch {}
      // 沉浸版 Phase-Life: 末尾按当前属性重算 lifespan（修真者随境界提升）
      try {
        const { deriveLifespanFromState } = await import('@/lib/xianxia/realm-lifespan');
        const computed = deriveLifespanFromState(finalState);
        const cur = Number(finalState.lifespan || 0);
        if (computed > cur) finalState = { ...finalState, lifespan: computed };
      } catch {}

      if (life.died) {
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
      const sameYearThreads = getSameYearThreads(finalState);
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

    // P0: 幂等保护 - update 加 age 条件，重复请求会触发 P2025
    try {
      // 批 18 advance-event PoC：写库前先 append 4 类核心事件（age/realm/hp/alive）。
      // 独立 try/catch —— appendEvent 失败不阻断 advance 主流程。
      try {
        if (char.age !== finalState.age) {
          await appendEvent({
            characterId,
            type: 'character.age.advanced',
            data: { type: 'character.age.advanced', from: char.age, to: finalState.age },
            source: 'system-tick',
            triggerActor: 'system',
            createdAtAge: finalState.age,
          });
        }

        if (char.realm !== finalState.realm) {
          await appendEvent({
            characterId,
            type: 'character.realm.changed',
            data: { type: 'character.realm.changed', from: char.realm, to: finalState.realm, method: 'set' },
            source: 'system-tick',
            triggerActor: 'system',
            createdAtAge: finalState.age,
          });
        }

        if (char.hp !== finalState.hp) {
          await appendEvent({
            characterId,
            type: 'character.hp.changed',
            data: { type: 'character.hp.changed', delta: finalState.hp - char.hp, newValue: finalState.hp },
            source: 'system-tick',
            triggerActor: 'system',
            createdAtAge: finalState.age,
          });
        }

        if (char.alive !== finalState.alive && finalState.alive === false) {
          const cause = finalState.causeOfDeath || '寿元已尽，身隳道消';
          await appendEvent({
            characterId,
            type: 'character.alive.changed',
            data: { type: 'character.alive.changed', alive: false, cause, narrative: `他的一生走到了尽头。${cause}。星辰夜凉，再无来者。` },
            source: 'system-tick',
            triggerActor: 'system',
            createdAtAge: finalState.age,
          });
        }
      } catch (e) {
        console.error('[advance] event append failed (non-fatal):', e);
        // 不阻断 advance 主流程
      }

      // Phase 5 #2: ECS tick 改用 helper（封装 new World + createCharacterEntity + addSystem + tick）
      // PoC 简化：不替换 advance 主流程；失败仅 console.error，不阻断主流程
      try {
        const ecsBaseSnapshot = {
          characterId,
          name: char.name || '',
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
        const ecsResult = tickEcsForCharacter(characterId, ecsBaseSnapshot);
        applyEcsTickToState(finalState, ecsResult);
      } catch (e) {
        console.error('[advance] ECS tick failed (non-fatal):', e);
        // 不阻断 advance 主流程
      }

      // 修复 P1-1：与 SSE 路径共用 buildAdvanceStateData，确保两路径落库字段一致
      await db.character.update({
        where: isProdMode
          ? { id: characterId, userId: user!.id, age: ageBefore }
          : { id: characterId, age: ageBefore },
        data: {
          ...buildAdvanceStateData(finalState, {
            pendingChoiceJson,
            worldCalendar,
            causeOfDeath: finalState.causeOfDeath || '',
            lastEventAge: finalState.age,
            recentEventTypes,
            recentBlueprintCategories: newRecentBlueprintCategories,
          }),
          // non-SSE 路径额外字段（schema 有但 build 函数没暴露的，比如五元素细分、reputation、faction、master、location、fateNodes）
          elementMetal: finalState.elements.metal,
          elementWood: finalState.elements.wood,
          elementWater: finalState.elements.water,
          elementFire: finalState.elements.fire,
          elementEarth: finalState.elements.earth,
          reputation: finalState.reputation,
          faction: finalState.faction,
          master: finalState.master,
          location: finalState.location,
          fateNodes: finalState.fateNodes.join(','),
        },
      });
    } catch (e: any) {
      // P2025 = record to update not found → 年龄条件不满足，说明重复请求已被其他调用处理
      if (e?.code === 'P2025') {
        return NextResponse.json({ success: false, error: '请求已处理，请刷新页面', code: 'IDEMPOTENT_DUPLICATE' }, { status: 409 });
      }
      throw e;
    }

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
    const stampEventTime = (stamp: any, advance: any, includeAge: boolean) => ({
      ...stamp,
      displayLabel: formatWorldTimeDisplay({ age: finalState.age, timeAdvance: advance, worldTime: stamp, includeAge }),
    });
    const stampedWorldTime = stampEventTime(worldTime, timeAdvance, true);
    finalWorldTime = stampedWorldTime;

    const eventDrafts: { title: string; narrative: string; eventType: string; effects: any[]; timeAdvance?: any; worldTime?: any; actionProjections?: any[] }[] = [{
      // 主事件只记录这一段时日发生的因果；不要因为最终数值成功突破，就把“冲关前夜/开始冲关”提前包装成已破境。
      title: sanitizeEventDraft({ title: aiOutput.title, narrative: '' }, finalState.age).title,
      // AI 偶发超字数输出：超过 420 字时强制截到最近完整句（避免 max_tokens 截断导致半句话）
      narrative: sanitizeEventDraft({ title: '', narrative: truncateNarrativeAtSentence(completeNarrative(aiOutput.narrative || ''), 1500) }, finalState.age).narrative,
      eventType: isFateNode ? 'fate_node' : visibleEventType(aiOutput.eventType, aiOutput.title, aiOutput.narrative),
      effects: [...displayEffects, hiddenEventMeta({ timeAdvance, worldTime: stampedWorldTime, actionProjections: baseActionProjections })],
      timeAdvance,
      worldTime: stampedWorldTime,
      actionProjections: baseActionProjections,
    }];

    for (const extra of aiOutput.extraEvents || []) {
      const inferredExtraTime = inferInlineTimeAdvance(extra.title, extra.narrative);
      const extraTimeAdvance = extra.timeAdvance
        ? clampTimeAdvance(extra.timeAdvance, timeAdvance)
        : inferredExtraTime ? clampTimeAdvance(inferredExtraTime, inferredExtraTime) : undefined;
      if (extraTimeAdvance) eventWorldCalendarCursor = advanceWorldCalendar(eventWorldCalendarCursor, extraTimeAdvance);
      const extraPhaseHint = phaseHintForTime(extraTimeAdvance?.label, `${extra.title || ''} ${extra.narrative || ''}`);
      const extraWorldTime = extraTimeAdvance ? stampEventTime(worldTimeStamp(eventWorldCalendarCursor, extraPhaseHint), extraTimeAdvance, false) : finalWorldTime;
      finalWorldCalendar = eventWorldCalendarCursor;
      finalWorldTime = extraWorldTime;
      const extraActions = sanitizeActionProjections(extra.actionProjections);
      eventDrafts.push(sanitizeEventDraft({
        title: extra.title || '',
        narrative: truncateNarrativeAtSentence(completeNarrative(extra.narrative || ''), 1500),
        eventType: visibleEventType(extra.eventType || 'normal', extra.title, extra.narrative),
        effects: [hiddenEventMeta({ timeAdvance: extraTimeAdvance, worldTime: extraWorldTime, actionProjections: extraActions })],
        timeAdvance: extraTimeAdvance,
        worldTime: extraWorldTime,
        actionProjections: extraActions,
      }, finalState.age));
    }
    for (const continuation of sameYearContinuationDrafts) {
      if (continuation.timeAdvance) eventWorldCalendarCursor = advanceWorldCalendar(eventWorldCalendarCursor, continuation.timeAdvance);
      const continuationPhaseHint = phaseHintForTime(continuation.timeAdvance?.label, continuation.narrative);
      const continuationWorldTime = continuation.timeAdvance ? stampEventTime(worldTimeStamp(eventWorldCalendarCursor, continuationPhaseHint), continuation.timeAdvance, false) : finalWorldTime;
      finalWorldCalendar = eventWorldCalendarCursor;
      finalWorldTime = continuationWorldTime;
      eventDrafts.push(sanitizeEventDraft({
        ...continuation,
        worldTime: continuationWorldTime,
        effects: [...continuation.effects, hiddenEventMeta({ timeAdvance: continuation.timeAdvance, worldTime: continuationWorldTime, actionProjections: continuation.actionProjections })],
      }, finalState.age));
    }

    // 沉浸版·生命终结叙事：若这一轮角色因 ECS aging / 战斗 / 寿元等任何原因跨过了 alive=false，
    // 单独追加一条"临终"独立事件，避免玩家看到主事件叙事却在角色死亡时毫无征兆。
    //
    // 2026-07-12 用户反馈"结局突兀"：这里从"硬编码一句'星辰夜凉再无来者'"改成"先调 LLM 生成 3-5 句
    // 死亡场景（8s 上限），失败才落到硬编码兜底"。当年的主事件叙事保留，死亡叙事**追加**在其后作独立事件。
    if (char.alive !== finalState.alive && finalState.alive === false) {
      const deathCause = finalState.causeOfDeath || '寿元已尽，身隳道消';
      const deathTitles = ['身殒道消', '身隳道消', '道途已尽', '尘世收局'];
      const seedStr = `${characterId}|${finalState.age}`;
      let seed = 0; for (let si = 0; si < seedStr.length; si++) seed = (seed * 31 + seedStr.charCodeAt(si)) >>> 0;

      // 先尝试 LLM 生成临终叙事
      let deathNarrative: string | null = null;
      try {
        deathNarrative = await generateDeathNarrative({
          characterName: finalState.name || char.name || '此人',
          age: finalState.age,
          realmName: finalState.realmName || finalState.realm || '凡身',
          causeOfDeath: deathCause,
          precedingNarrative: aiOutput.narrative || '',
          ascended: false,
        });
      } catch (e) {
        console.error('[advance] death narrative gen failed (non-fatal):', e);
      }
      // 兜底：LLM 失败才用硬编码那一句
      const fallbackNarrative = `${aiOutput.title ? `${aiOutput.title}之后，` : ''}他的一生走到了尽头。${deathCause}。`;

      eventDrafts.push({
        title: deathTitles[seed % deathTitles.length],
        narrative: deathNarrative || fallbackNarrative,
        eventType: 'death',
        effects: [],
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

    // ===== 沉浸版 Phase-Z: AI 成就判定 =====
    try {
      const aiNarrative = String((aiOutput as any)?.narrative ?? '');
      const parsedAch = parseAchievementMarkers(aiNarrative);
      if (parsedAch.length > 0) {
        const achResult = applyAchievements(finalState, parsedAch, {
          triggeredAge: Number(finalState.age ?? 0),
        });
        if (achResult && achResult.state && achResult.newAchievements.length > 0) {
          finalState = achResult.state;
          (finalState as any).__lastAchievements = achResult.newAchievements.map((a) => ({
            id: a.definition.id,
            name: a.definition.name,
            bucket: a.definition.bucket,
            reward: a.reward,
          }));
        }
      }
    } catch (e) {
      console.warn('[advance] applyAchievements failed:', e);
    }

    // ===== 沉浸版 Phase-Z: 破境事件 → 飘字层自动 emit 全屏过场 =====
    try {
      if (result && (result as any).breakthroughHappened) {
        const prevRealm = String((state as any)?.realm ?? '');
        const nextRealm = String((finalState as any)?.realm ?? prevRealm);
        if (prevRealm && nextRealm && prevRealm !== nextRealm) {
          (finalState as any).__lastBreakthrough = {
            fromRealm: prevRealm,
            toRealm: nextRealm,
            triggeredAge: Number(finalState.age ?? 0),
          };
        }
      }
    } catch {}

    // ===== 沉浸版 Phase-N: NPC 年度推进（年龄/亲疏/属性成长/偶发破境/偶发寿终）=====
    // 之前 store.tickNpcsForYear 全工程没人调——advance 推进后 npcs 不更新；
    // 这里在 finalState 落地前强制推一年，与 advance-sse 同源。
    try {
      const safeAgeBefore = Number(state.age ?? 0);
      const safeAgeAfter = Number(finalState.age ?? safeAgeBefore);
      const yearsAdvanced = Math.max(1, safeAgeAfter - safeAgeBefore);
      const prevNpcs = Array.isArray(finalState.npcs) ? finalState.npcs : [];
      if (prevNpcs.length > 0) {
        const npcResult = tickAllNpcsForYear(prevNpcs, yearsAdvanced, safeAgeAfter);
        if (npcResult && Array.isArray(npcResult.nextNpcs)) {
          finalState = { ...finalState, npcs: npcResult.nextNpcs };
        }
      }
    } catch (e) {
      console.warn('[advance] tickAllNpcsForYear failed:', e);
    }

    // ===== 后台预热下一岁：玩家点第二次推进时 0 等待 =====
    if (finalState.alive && !finalState.ascended && !aiOutput.causedDeath && !aiOutput.hasChoice && !aiOutput.triggerCombat) {
      setImmediate(() => {
        prepareAdvanceCandidate(char).catch(err => {
          console.warn('[prefetch-next-age] failed:', err?.message);
        });
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
      usedPreload,
      actionProjections: baseActionProjections,
      hasChoice: aiOutput.hasChoice,
      choice: aiOutput.choice,
      died: result.died,
      deathReason: result.deathReason,
      ascended: finalState.ascended,
      // Task 20: 是否触发战斗（前端据此打开 CombatModal）
      triggeredCombat: !!finalState.combatSession,
      // Task: fallback 生成标记——通知前端 AI 调用失败，用了模板生成
      fallbackGenerated: Boolean(aiOutput.isFallbackGenerated),
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
