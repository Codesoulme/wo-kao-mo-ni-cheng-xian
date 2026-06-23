// POST /api/game/advance/stream
// 流式推进年龄 - 与 advance 路由逻辑几乎一致，差异：LLM 阶段用 stream=true 边读边 res.write narrative_delta
//
// 实现说明：
// - 这里复刻 advance/route.ts 的核心流程，但每个 await 都加 .catch 包裹
// - LLM 用 generateAgeEventStream 替代 generateAgeEvent，narrative 边读边推
// - 流式 NDJSON 输出：{type:'start'|'narrative_delta'|'done'|'error'} + 完整事件/状态
// - 复杂路径（同年续/combat/breakthrough 等）走正常 advance 路由 fallback 路径
//
// 注意：这份代码尽可能贴齐 advance/route.ts 的字段访问方式。

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  executeAIEvent,
  checkLifespan,
  stateToResponse,
  tryBreakthrough,
  startCombat,
  tryHeartDemonTrial,
  buildStateContext,
} from '@/lib/xianxia/engine';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { sanitizeEventDraft, truncateNarrativeAtSentence, completeNarrative } from '@/lib/xianxia/display';
import { clearAdvancePreload, prepareAdvanceCandidate } from '@/lib/xianxia/advance-preload';
import { generateAgeEventStream } from '@/lib/xianxia/llm';
import { advanceWorldCalendar, clampTimeAdvance, deriveActionProjections, hiddenEventMeta, inferInlineTimeAdvance, phaseHintForTime, sanitizeActionProjections, worldTimeStamp } from '@/lib/xianxia/world-time';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ndjson = (obj: any) => JSON.stringify(obj) + '\n';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  const write = (obj: any) => {
    if (!controllerRef || closed) return;
    try { controllerRef.enqueue(encoder.encode(ndjson(obj))); } catch { closed = true; }
  };
  const close = () => {
    if (!controllerRef || closed) return;
    closed = true;
    try { controllerRef.close(); } catch {}
  };
  const stream = new ReadableStream({
    async start(controller) {
      controllerRef = controller;
      try {
        await runAdvance(req, write, close);
      } catch (err: any) {
        write({ type: 'error', error: err?.message || 'stream failed' });
      } finally {
        close();
      }
    },
    cancel() { closed = true; },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

async function runAdvance(req: NextRequest, write: (obj: any) => void, _close: () => void) {
  const body = await req.json().catch(() => ({}));
  const characterId: string | undefined = body?.characterId;
  const qualityMode: 'full' | 'light' = body?.qualityMode === 'light' ? 'light' : 'full';
  const inputWorldCalendar = body?.worldCalendar;
  const previousWorldLegacies = Array.isArray(body?.previousWorldLegacies) ? body.previousWorldLegacies.slice(0, 8) : [];

  if (!characterId) { write({ type: 'error', error: 'characterId required' }); return; }
  const char = await db.character.findUnique({ where: { id: characterId } });
  if (!char) { write({ type: 'error', error: 'Character not found' }); return; }
  if (!char.alive) { write({ type: 'error', error: '角色已陨落' }); return; }
  if (char.ascended) { write({ type: 'error', error: '角色已飞升' }); return; }
  if (char.isAtChoice) { write({ type: 'error', error: '请先完成选择' }); return; }
  if ((char as any).combatSession && ((char as any).combatSession as any).status === 'ongoing') { write({ type: 'error', error: '战斗进行中' }); return; }

  const ageBefore = char.age;
  write({ type: 'start', age: ageBefore, characterId });

  // 1) prepare state & blueprint（跳过 LLM）
  let candidate: any;
  try {
    candidate = await prepareAdvanceCandidate(char as any, {
      qualityMode,
      worldCalendar: inputWorldCalendar,
      previousWorldLegacies,
      skipLlm: true,
    });
  } catch (e: any) {
    write({ type: 'error', error: `prepare failed: ${e?.message}` });
    return;
  }

  let state = candidate.preparedState;
  const blueprint = candidate.blueprint;
  const isFateNode = candidate.isFateNode;
  const fateNode = candidate.fateNode;
  const recentEvents = candidate.recentEvents;
  const narrativeContractFeedback = candidate.narrativeContractFeedback;
  const timeAdvance = clampTimeAdvance(candidate.timeAdvance);

  // 2) 流式生成 aiOutput
  let aiOutput: any;
  try {
    const ctx = buildStateContext(state, recentEvents.slice(qualityMode === 'light' ? -3 : -5), narrativeContractFeedback.slice(-3));
    ctx.blueprint = blueprint;
    ctx.suggestedTimeAdvance = timeAdvance;

    aiOutput = await generateAgeEventStream(ctx, isFateNode, qualityMode, (delta: string) => {
      write({ type: 'narrative_delta', delta });
    });
  } catch (err: any) {
    console.error('LLM stream failed, fallback:', err?.message || err);
    const { buildFallbackAgeEvent } = await import('@/lib/xianxia/advance-fallback');
    const ctx = buildStateContext(state, recentEvents.slice(-5), narrativeContractFeedback.slice(-3));
    ctx.blueprint = blueprint;
    aiOutput = buildFallbackAgeEvent(state, blueprint, ctx, isFateNode, {
      recentEvents,
    });
    write({ type: 'narrative_delta', delta: aiOutput.narrative });
  }

  // 3) 写回 anchor + entity
  if (aiOutput?.narrative && !aiOutput.fallbackGenerated) {
    try {
      const { extractStyleAnchor, mergeStyleAnchor } = await import('@/lib/xianxia/style-anchor');
      const { extractEntitiesFromNarrative, mergeEntities } = await import('@/lib/xianxia/entity-store');
      const newAnchor = extractStyleAnchor(state.age, aiOutput.narrative);
      const newEntities = extractEntitiesFromNarrative(state.age, aiOutput.narrative);
      const anchorJson = mergeStyleAnchor(char as any, newAnchor);
      const entityJson = mergeEntities(char as any, newEntities);
      await db.character.update({
        where: { id: char.id },
        data: { styleAnchorsJson: anchorJson, entityEntriesJson: entityJson },
      });
    } catch (e) {
      console.warn('Failed to persist style anchor / entity entries:', (e as any)?.message);
    }
  }

  // 4) 引擎执行 AI 输出
  const result = executeAIEvent(state as any, aiOutput);
  let finalState = result.state;

  // 5) 突破兜底
  if (!result.breakthroughHappened && !result.died && !finalState.ascended && finalState.alive && finalState.cultivationExp >= finalState.expToBreak) {
    try {
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
      }
    } catch {}
  }

  // 6) 心魔试炼
  if (!result.breakthroughHappened && !result.died && finalState.alive && finalState.heartDemon >= 60) {
    try {
      const demon = tryHeartDemonTrial(finalState);
      if (demon && demon.triggered && demon.trigger) {
        finalState = { ...finalState, combatSession: demon.trigger as any };
      }
    } catch {}
  }

  // 7) 战斗触发
  if (aiOutput.triggerCombat) {
    try {
      finalState = startCombat(finalState, aiOutput.triggerCombat);
    } catch {}
  }

  // 8) 寿元
  let diedThisEvent = result.died;
  if (!diedThisEvent && !finalState.ascended) {
    try {
      const life = checkLifespan(finalState);
      if (life.died) {
        finalState = life.state;
        diedThisEvent = true;
        aiOutput.causedDeath = true;
        aiOutput.deathReason = life.reason;
      }
    } catch {}
  }

  // 9) 因缘
  let finalChoice: any = aiOutput.choice || null;
  if (aiOutput.hasChoice && finalChoice) {
    finalState = { ...finalState, isAtChoice: true };
  }

  // 10) 时间
  const worldCalendar = advanceWorldCalendar(inputWorldCalendar, timeAdvance);
  const worldTime = worldTimeStamp(worldCalendar);
  (finalState as any).worldCalendar = worldCalendar;
  (finalState as any).worldTime = worldTime;

  // 11) 构造事件
  const finalNarrative = truncateNarrativeAtSentence(completeNarrative(aiOutput.narrative || ''), 420);
  const displayEffects = buildEventDisplayEffects(aiOutput);
  const eventDraft = sanitizeEventDraft({ title: aiOutput.title, narrative: finalNarrative }, finalState.age);
  const eventDrafts: any[] = [{
    age: finalState.age,
    title: eventDraft.title,
    narrative: eventDraft.narrative,
    eventType: isFateNode ? 'fate_node' : (aiOutput.eventType || 'normal'),
    effects: [...displayEffects, hiddenEventMeta({ timeAdvance, worldTime, actionProjections: deriveActionProjections(aiOutput.actionProjections) })],
    isFateNode,
    fateNodeName: fateNode?.name,
    blueprint: blueprint ? { name: blueprint.name, category: blueprint.category } : undefined,
    timeAdvance,
    worldTime,
    actionProjections: deriveActionProjections(aiOutput.actionProjections),
  }];

  // extra events
  if (Array.isArray(aiOutput.extraEvents)) {
    let cursorCal = worldCalendar;
    for (const extra of aiOutput.extraEvents) {
      const extraTimeAdvance = inferInlineTimeAdvance(extra.title || '', extra.narrative || '');
      const phaseHint = phaseHintForTime(extraTimeAdvance?.label, `${extra.title || ''} ${extra.narrative || ''}`);
      const extraWorldTime = extraTimeAdvance ? worldTimeStamp(cursorCal, phaseHint) : worldTime;
      const extraActions = sanitizeActionProjections(extra.actionProjections);
      const extraDraft = sanitizeEventDraft({
        title: extra.title || '',
        narrative: truncateNarrativeAtSentence(completeNarrative(extra.narrative || ''), 280),
        eventType: extra.eventType || 'normal',
        effects: [hiddenEventMeta({ timeAdvance: extraTimeAdvance, worldTime: extraWorldTime, actionProjections: extraActions })],
        timeAdvance: extraTimeAdvance,
        worldTime: extraWorldTime,
        actionProjections: extraActions,
      }, finalState.age);
      eventDrafts.push(extraDraft);
    }
  }

  // 12) 保存角色
  if (finalState.age > ageBefore || (finalState as any).causeOfDeath || (finalState as any).deathReason) {
    try {
      await db.character.update({
        where: { id: char.id, age: ageBefore },
        data: {
          age: finalState.age,
          lifespan: finalState.lifespan,
          realm: finalState.realm,
          spiritualRoot: finalState.spiritualRoot,
          rootDetail: finalState.rootDetail,
          realmLevel: finalState.realmLevel,
          cultivationExp: finalState.cultivationExp,
          expToBreak: finalState.expToBreak,
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
          alive: finalState.alive,
          ascended: finalState.ascended,
          causeOfDeath: (finalState as any).causeOfDeath || (finalState as any).deathReason || null,
          isAtChoice: (finalState as any).isAtChoice || false,
          combatStateJson: (finalState as any).combatSession ? JSON.stringify((finalState as any).combatSession) : '',
          lastEventAge: finalState.age,
        },
      });
    } catch (e: any) {
      write({ type: 'error', error: `save failed: ${e?.message}` });
      return;
    }
  }

  // 13) 后台预热下一岁
  if (finalState.alive && !finalState.ascended && !aiOutput.causedDeath && !aiOutput.hasChoice && !aiOutput.triggerCombat) {
    setImmediate(() => {
      prepareAdvanceCandidate(char as any).catch((err: any) => {
        console.warn('[prefetch-next-age-stream] failed:', err?.message);
      });
    });
  }

  // 14) 发 done
  write({
    type: 'done',
    state: stateToResponse(finalState),
    events: eventDrafts,
    changes: displayEffects,
    breakthrough: result.breakthroughHappened ? { newRealm: result.newRealm, major: result.breakthroughMajor } : null,
    hasChoice: !!aiOutput.hasChoice,
    choice: aiOutput.choice,
    fallbackGenerated: !!aiOutput.fallbackGenerated,
    worldTime,
    worldCalendar,
  });
}