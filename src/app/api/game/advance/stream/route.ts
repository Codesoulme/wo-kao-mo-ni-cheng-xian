// @ts-nocheck - api route, types not critical

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { prepareAdvanceCandidate } from '@/lib/xianxia/advance-preload';
import { buildStateContext } from '@/lib/xianxia/engine';
import { clampTimeAdvance } from '@/lib/xianxia/world-time';
import { generateAgeEventStream } from '@/lib/xianxia/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (obj: any) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
          } catch {}
        };

        const close = () => {
          try { controller.close(); } catch {}
        };

        try {
          const body = await req.json().catch(() => ({}));
          const characterId: string | undefined = body?.characterId;
          const qualityMode: 'full' | 'light' = body?.qualityMode === 'light' ? 'light' : 'full';
          const inputWorldCalendar = body?.worldCalendar;
          const previousWorldLegacies = Array.isArray(body?.previousWorldLegacies) ? body.previousWorldLegacies.slice(0, 8) : [];

          if (!characterId) {
            send({ type: 'error', error: 'characterId required' });
            close();
            return;
          }

          const char = await db.character.findUnique({ where: { id: characterId } });
          if (!char) {
            send({ type: 'error', error: 'Character not found' });
            close();
            return;
          }
          if (!char.alive) {
            send({ type: 'error', error: '角色已陨落' });
            close();
            return;
          }
          if (char.ascended) {
            send({ type: 'error', error: '角色已飞升' });
            close();
            return;
          }
          if (char.isAtChoice) {
            send({ type: 'error', error: '请先完成选择' });
            close();
            return;
          }

          send({ type: 'start', age: char.age, characterId });

          // 1) prepare state & blueprint
          let candidate: any;
          try {
            candidate = await prepareAdvanceCandidate(char as any, {
              qualityMode,
              worldCalendar: inputWorldCalendar,
              previousWorldLegacies,
              skipLlm: true,
            });
          } catch (e: any) {
            send({ type: 'error', error: `prepare failed: ${e?.message}` });
            close();
            return;
          }

          let state = candidate.preparedState;
          if (!state) {
            send({ type: 'error', error: 'prepare returned no state' });
            close();
            return;
          }
          if (state.inventory === undefined) {
            console.error('[stream] State missing inventory:', JSON.stringify(Object.keys(state)));
            send({ type: 'error', error: 'state missing inventory' });
            close();
            return;
          }
          const blueprint = candidate.blueprint;
          const isFateNode = candidate.isFateNode;
          const recentEvents = candidate.recentEvents || [];
          const narrativeContractFeedback = candidate.narrativeContractFeedback || [];
          const timeAdvance = clampTimeAdvance(candidate.timeAdvance);

          // 2) 流式生成 aiOutput - 关键：每个 delta 立即发送
          let aiOutput: any;
          let ctx: any;
          try {
            ctx = buildStateContext(state, recentEvents.slice(qualityMode === 'light' ? -3 : -5), narrativeContractFeedback.slice(-3));
            ctx.blueprint = blueprint;
            ctx.suggestedTimeAdvance = timeAdvance;

            console.log('[stream] Starting LLM stream generation');
            aiOutput = await generateAgeEventStream(ctx, isFateNode, qualityMode, async (delta: string) => {
              // 立即发送每个 delta 块，不等待
              send({ type: 'narrative_delta', delta });
              // 给事件循环时间处理
              await new Promise(r => setImmediate(r));
            });
            console.log('[stream] LLM stream completed, total narrative length:', aiOutput?.narrative?.length);
          } catch (err: any) {
            console.error('[stream] LLM stream failed:', err?.message);
            const { buildFallbackAgeEvent } = await import('@/lib/xianxia/advance-fallback');
            ctx = buildStateContext(state, recentEvents.slice(-5), narrativeContractFeedback.slice(-3));
            ctx.blueprint = blueprint;
            aiOutput = buildFallbackAgeEvent(state, blueprint, ctx, isFateNode, { recentEvents });
            send({ type: 'narrative_delta', delta: aiOutput.narrative });
          }

          // 3) 写回 anchor + entity
          if (aiOutput?.narrative && !aiOutput.isFallbackGenerated) {
            try {
              const { extractStyleAnchor, mergeStyleAnchor } = await import('@/lib/xianxia/style-anchor');
              const { extractEntitiesFromNarrative, mergeEntities } = await import('@/lib/xianxia/entity-store');
              const newAnchor = extractStyleAnchor(state.age, aiOutput.narrative);
              const newEntities = extractEntitiesFromNarrative(state.age, aiOutput.narrative);
              const anchorJson = mergeStyleAnchor(char as any, newAnchor);
              const entityJson = mergeEntities(char as any, newEntities);
              await db.character.update({
                where: { id: characterId },
                data: { styleAnchorsJson: anchorJson, entityEntriesJson: entityJson },
              });
            } catch {}
          }

          // 4) 计算事件效果
          let displayEffects: any[] = [];
          let eventDrafts: any[] = [];
          let worldCalendar = char.worldCalendarJson ? JSON.parse(char.worldCalendarJson) : null;
          let worldTime: any = null;

          try {
            // 检查 aiOutput 有效性
            if (!aiOutput) {
              console.error('[stream] aiOutput is null/undefined');
              send({ type: 'error', error: 'aiOutput is null' });
              close();
              return;
            }
            
            const { executeAIEvent, stateToResponse } = await import('@/lib/xianxia/engine');
            const { buildEventDisplayEffects } = await import('@/lib/xianxia/event-effects');

            console.log('[stream] Before executeAIEvent - state.inventory:', state?.inventory?.length);
            console.log('[stream] State keys:', Object.keys(state || {}));
            
            // 执行 AI 事件效果
            let execResult: any;
            let finalState: any;
            try {
              console.log('[stream] Before executeAIEvent - state.inventory:', state?.inventory?.length);
              execResult = executeAIEvent(state, aiOutput);
              finalState = execResult?.state;
              console.log('[stream] After executeAIEvent - finalState.inventory:', finalState?.inventory?.length);
            } catch (execErr: any) {
              console.error('[stream] executeAIEvent failed:', execErr?.message, execErr?.stack);
              throw execErr;
            }

            // 构建显示效果
            displayEffects = buildEventDisplayEffects({
              before: state,
              after: finalState,
              changes: execResult?.appliedChanges || [],
            });

            // 5) 保存角色
            const ageBefore = char.age;
            console.log('[stream] Before save - finalState.inventory:', finalState?.inventory?.length);
            const shouldSave = finalState && (
              finalState.age > ageBefore || 
              (finalState as any)?.causeOfDeath || 
              (finalState as any)?.deathReason
            );
            if (shouldSave) {
              try {
                await db.character.update({
                  where: { id: characterId, age: ageBefore },
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
                    isAtChoice: finalState.isAtChoice,
                    combatStateJson: finalState.combatStateJson || '',
                    lastEventAge: finalState.age,
                    causeOfDeath: (finalState as any).causeOfDeath || (finalState as any).deathReason || '',
                    worldCalendarJson: worldCalendar ? JSON.stringify(worldCalendar) : char.worldCalendarJson,
                  },
                });
              } catch (dbErr: any) {
                console.error('[stream] DB update error:', dbErr?.message);
              }
            }

            // 6) 发送完成事件
            send({
              type: 'done',
              state: finalState ? stateToResponse(finalState) : null,
              events: eventDrafts,
              changes: displayEffects,
              breakthrough: execResult?.breakthroughHappened ? { newRealm: execResult.newRealm, major: execResult.breakthroughMajor } : null,
              hasChoice: !!aiOutput.hasChoice,
              choice: aiOutput.choice,
              fallbackGenerated: !!aiOutput.isFallbackGenerated,
              worldTime,
              worldCalendar,
            });

            // 7) 预热下一岁
            if (finalState.alive && !finalState.ascended && !aiOutput.causedDeath && !aiOutput.hasChoice && !aiOutput.triggerCombat) {
              setImmediate(() => {
                prepareAdvanceCandidate(char as any).catch(() => {});
              });
            }
          } catch (e: any) {
            console.error('[stream] Outer catch error:', e?.message);
            console.error('[stream] Stack:', e?.stack);
            console.error('[stream] state:', state ? 'exists' : 'undefined', 'inv:', state?.inventory?.length);
            send({ type: 'error', error: `save failed: ${e?.message}` });
            close();
            return;
          }
        } catch (err: any) {
          const msg = err?.message || 'stream failed';
          console.error('[stream] Stream error:', msg);
          send({ type: 'error', error: msg });
        } finally {
          close();
        }
      },
      cancel() {
        console.log('[stream] Client cancelled the request');
      },
    }),
    {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Accel-Buffering': 'no',
      },
    }
  );
}
