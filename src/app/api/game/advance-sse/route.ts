import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { prepareAdvanceCandidate } from '@/lib/xianxia/advance-preload';
import { buildStateContext, executeAIEvent, stateToResponse } from '@/lib/xianxia/engine';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { clampTimeAdvance, advanceWorldCalendar, worldTimeStamp, hiddenEventMeta, formatWorldTimeDisplay } from '@/lib/xianxia/world-time';
import { buildAdvanceStateData } from '@/lib/xianxia/persist-advance-state';
import { appendEvent } from '@/lib/xianxia/events/store';
import {
  callLLMStream,
  buildAdvancePrompt,
  IDENTITY_PROMPT,
  SCENE_PROMPTS,
  parseJSON,
  sanitizeEventOutput,
  cleanNarrativeAge,
} from '@/lib/xianxia/llm';
import { getCurrentUser } from '@/lib/auth-helpers';
// 批 20: ECS 集成 advance —— 让 AgingSystem / CultivationSystem 在 SSE 路径上也跑一次 world.tick()
import { World } from '@/lib/xianxia/ecs/core';
import { createCharacterEntity, entityToSnapshot } from '@/lib/xianxia/ecs/character-entity';
import { AgingSystem } from '@/lib/xianxia/ecs/systems/aging-system';
import { CultivationSystem } from '@/lib/xianxia/ecs/systems/cultivation-system';

// P1 step2 worker A: 生产模式下强制 userId 检查；dev 模式保持原行为。

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

let _cachedAIConfig: any = null;

async function _loadAIConfig() {
  return null;
}

// 工具：从累积的 rawText 中抽取 narrative 字段的当前完整内容
// 返回 { content, closed }：closed=true 表示 narrative 字符串已闭合（LLM 写完 narrative 在准备下一个字段）
function extractNarrativeField(rawText: string): { content: string; closed: boolean } {
  const marker = '"narrative"';
  const idx = rawText.indexOf(marker);
  if (idx < 0) return { content: '', closed: false };
  const colonIdx = rawText.indexOf(':', idx + marker.length);
  if (colonIdx < 0) return { content: '', closed: false };
  const startQuoteIdx = rawText.indexOf('"', colonIdx);
  if (startQuoteIdx < 0) return { content: '', closed: false };
  let i = startQuoteIdx + 1;
  let result = '';
  while (i < rawText.length) {
    const ch = rawText[i];
    if (ch === '\\') {
      const next = rawText[i + 1];
      if (next === '"') { result += '"'; i += 2; continue; }
      if (next === '\\') { result += '\\'; i += 2; continue; }
      if (next === 'n') { result += '\n'; i += 2; continue; }
      if (next === 't') { result += '\t'; i += 2; continue; }
      if (next === 'r') { result += '\r'; i += 2; continue; }
      if (next === '/') { result += '/'; i += 2; continue; }
      if (next === 'u') {
        const hex = rawText.slice(i + 2, i + 6);
        const code = parseInt(hex, 16);
        if (!isNaN(code)) { result += String.fromCharCode(code); }
        i += 6;
        continue;
      }
      result += ch; i += 1; continue;
    }
    if (ch === '"') {
      // 字符串结束
      return { content: result, closed: true };
    }
    result += ch;
    i += 1;
  }
  return { content: result, closed: false };
}

function _extractNarrativeFromRawText(_rawText: string): string | null {
  return null;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const startTotal = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // 控制器已关闭，停止发送
          console.warn('[SSE] send failed, controller closed:', event);
        }
      };

      const close = () => {
        try { controller.close(); } catch {}
      };

      try {
        const isProdMode = !!process.env.ADMIN_TOKEN;
        let user: { id: string } | null = null;
        if (isProdMode) {
          user = await getCurrentUser();
          if (!user) {
            send('error', { error: 'UNAUTHORIZED' });
            close();
            return;
          }
        }

        const body = await req.json().catch(() => ({}));
        const characterId: string | undefined = body?.characterId;
        const qualityMode: 'full' | 'light' = body?.qualityMode === 'light' ? 'light' : 'full';
        const inputWorldCalendar = body?.worldCalendar;

        if (!characterId) {
          send('error', { error: 'characterId required' });
          close();
          return;
        }

        const char = await db.character.findUnique({
          where: isProdMode ? { id: characterId, userId: user!.id } : { id: characterId },
        });
        if (!char) {
          send('error', { error: 'Character not found' });
          close();
          return;
        }
        if (!char.alive) {
          send('error', { error: '角色已陨落' });
          close();
          return;
        }

        // 1) prepare state & blueprint（移到 send(start) 之前，以获取 timeAdvance + worldCalendar）
        let candidate: any;
        try {
          candidate = await prepareAdvanceCandidate(char as any, {
            qualityMode,
            worldCalendar: inputWorldCalendar,
            skipLlm: true,
          });
        } catch (e: any) {
          send('error', { error: `prepare failed: ${e?.message}` });
          close();
          return;
        }

        const state = candidate.preparedState;
        if (!state) {
          send('error', { error: 'prepare returned no state' });
          close();
          return;
        }
        const blueprint = candidate.blueprint;
        const isFateNode = candidate.isFateNode;
        const recentEvents = candidate.recentEvents || [];
        const narrativeContractFeedback = candidate.narrativeContractFeedback || [];
        const timeAdvance = clampTimeAdvance(candidate.timeAdvance);

        // 构建 worldCalendar
        let worldCalendar = char.worldCalendarJson ? JSON.parse(char.worldCalendarJson) : null;
        if (worldCalendar && timeAdvance) {
          // 修复 P0-1：原代码以 3 参调用 → time.elapsedDays 拿到 undefined → NaN 写库 → "青岚仙历 NaN 年"
          worldCalendar = advanceWorldCalendar(worldCalendar, timeAdvance);
        }

        // ★ 先 send(start)，此时已准备好 timeAdvance + worldTime
        const ws = worldTimeStamp(worldCalendar || undefined);
        send('start', {
          type: 'start',
          age: char.age,
          characterId,
          timeAdvance: { label: timeAdvance.label, ageDeltaYears: timeAdvance.ageDeltaYears, elapsedDays: timeAdvance.elapsedDays },
          worldTime: { label: ws.label, displayLabel: ws.label, monthName: ws.monthName, day: ws.day, phase: ws.phase },
        });

        // ★ 心跳：每 3 秒推一个 comment 行（防止 Trae IDE 浏览器 30 秒无数据断开）
        const heartbeat = setInterval(() => {
          try {
            send('heartbeat', { type: 'heartbeat', time: Date.now() });
          } catch {}
        }, 3000);

        // 2) 构建 ctx
        const ctx: any = buildStateContext(state, recentEvents.slice(qualityMode === 'light' ? -3 : -5), narrativeContractFeedback.slice(-3));
        ctx.blueprint = blueprint;
        ctx.suggestedTimeAdvance = timeAdvance;

        // 3) 真流式：直接调 callLLMStream，累积 rawText，实时提取 narrative 字段
        //    LLM 边生成 token，我们边从累积 rawText 中抽出 narrative 字符串推给前端
        const userPrompt = buildAdvancePrompt(ctx, isFateNode, qualityMode);
        const fullSystem = `${IDENTITY_PROMPT}\n\n${SCENE_PROMPTS.advance}`;

        let rawText = '';
        let prevNarrative = '';
        let firstDeltaSent = false;
        let narrativeClosedSent = false;

        try {
          await callLLMStream(fullSystem, userPrompt, async (delta: string) => {
            rawText += delta;
            const { content: extracted, closed } = extractNarrativeField(rawText);
            if (extracted && extracted.length > prevNarrative.length) {
              const newDelta = extracted.slice(prevNarrative.length);
              prevNarrative = extracted;
              if (!firstDeltaSent) {
                firstDeltaSent = true;
                console.log('[SSE] First narrative delta sent, total raw:', rawText.length, 'narrative:', extracted.length);
              }
              send('narrative_delta', { type: 'narrative_delta', delta: newDelta });
            }
            // ★ narrative 字符串字段闭合时（LLM 写完 narrative 在准备下一个字段），立即通知前端
            // → 玩家立刻看到"收获结算中..."提示，不再干等 LLM 写剩余 changes/items/npcs
            if (closed && !narrativeClosedSent) {
              narrativeClosedSent = true;
              console.log('[SSE] narrative field closed, sent narrative_complete event');
              send('narrative_complete', { type: 'narrative_complete', narrative: prevNarrative });
            }
          }, { qualityMode });
        } catch (e: any) {
          send('error', { error: `AI generation failed: ${e?.message}` });
          clearInterval(heartbeat);
          close();
          return;
        }
        clearInterval(heartbeat);
        console.log('[SSE] LLM done, rawText length:', rawText.length, 'extracted narrative:', prevNarrative.length);

        // 解析完整 rawText 为 aiOutput
        let aiOutput: any;
        try {
          const raw = parseJSON(rawText);
          aiOutput = sanitizeEventOutput(raw, ctx.character.age);
          aiOutput.narrative = cleanNarrativeAge(aiOutput.narrative, ctx.character.age, ctx.character.name);
        } catch {
          console.warn('[SSE] Final parse failed, using extracted narrative');
          aiOutput = { narrative: prevNarrative || rawText };
        }
        if (Array.isArray(aiOutput.extraEvents)) {
          aiOutput.extraEvents = aiOutput.extraEvents.map((e: any) => ({
            ...e,
            narrative: cleanNarrativeAge(String(e?.narrative || ''), ctx.character.age, ctx.character.name),
          }));
        }
        if (!aiOutput.narrative) aiOutput.narrative = prevNarrative || rawText;

        // 4) 若 AI 输出包含选择，进入选择状态（和 non-SSE advance 保持一致）
        if (aiOutput.hasChoice) {
          state.isAtChoice = true;
        }

        // 5) 写回 anchor + entity (best-effort)
        try {
          const { extractStyleAnchor, mergeStyleAnchor } = await import('@/lib/xianxia/style-anchor');
          const { extractEntitiesFromNarrative, mergeEntities } = await import('@/lib/xianxia/entity-store');
          if (aiOutput.narrative) {
            const newAnchor = extractStyleAnchor(state.age, aiOutput.narrative);
            const newEntities = extractEntitiesFromNarrative(state.age, aiOutput.narrative);
            const anchorJson = mergeStyleAnchor(char as any, newAnchor);
            const entityJson = mergeEntities(char as any, newEntities);
            await db.character.update({
              where: isProdMode ? { id: characterId, userId: user!.id } : { id: characterId },
              data: { styleAnchorsJson: anchorJson, entityEntriesJson: entityJson },
            });
          }
        } catch {}

        // 6) executeAIEvent + 写库
        let finalState: any;
        let displayEffects: any[] = [];
        let createdEvent: any = null;
        try {
          const execResult = executeAIEvent(state, aiOutput);
          finalState = execResult.state;
          displayEffects = buildEventDisplayEffects({
            before: state,
            after: finalState,
            changes: execResult.appliedChanges || [],
          });

          // executeAIEvent 之前已经 advance 过 worldCalendar，直接使用
          // 构建带 displayLabel 的世界时间戳
          const stampedWorldTime = {
            ...worldTimeStamp(worldCalendar || undefined),
            displayLabel: formatWorldTimeDisplay({ age: finalState.age, timeAdvance, worldTime: worldTimeStamp(worldCalendar || undefined), includeAge: true }),
          };

          // 持久化事件：刷新页面后 state 接口能读到，避免气泡消失
          const eventEffects = [...displayEffects, hiddenEventMeta({ timeAdvance, worldTime: stampedWorldTime })];
          createdEvent = await db.eventLog.create({
            data: {
              characterId,
              age: finalState.age,
              title: aiOutput.title || '天道路漫',
              narrative: aiOutput.narrative || '',
              eventType: aiOutput.eventType || 'normal',
              effects: JSON.stringify(eventEffects),
            },
          });

          // 持久化 pendingChoice（让页面刷新后可恢复）
          const pendingChoiceJson = (aiOutput.hasChoice && aiOutput.choice)
            ? JSON.stringify({
                prompt: aiOutput.choice.prompt,
                options: aiOutput.choice.options,
                contextTitle: aiOutput.title,
                contextNarrative: aiOutput.narrative,
                contextAge: finalState.age,
                contextFateNodeName: undefined,
              })
            : '';

          // 立即写回角色状态（不阻塞 done，但确保 event 保存）
          const ageBefore = char.age;
          if (finalState.age > ageBefore || (finalState as any).causeOfDeath || (finalState as any).deathReason || finalState.isAtChoice) {
            // 批 18 advance-sse-event PoC：写库前先 append 4 类核心事件（age/realm/hp/alive）。
            // 独立 try/catch —— appendEvent 失败不阻断 SSE 主流程。
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
                await appendEvent({
                  characterId,
                  type: 'character.alive.changed',
                  data: { type: 'character.alive.changed', alive: false, cause: (finalState as any).causeOfDeath || 'unknown' },
                  source: 'system-tick',
                  triggerActor: 'system',
                  createdAtAge: finalState.age,
                });
              }
            } catch (e) {
              console.error('[advance-sse] event append failed (non-fatal):', e);
              // 不阻断 SSE 主流程
            }

            // 批 20: ECS 集成 advance —— 额外跑一次 world.tick()，让 AgingSystem / CultivationSystem 处理 age/cultivation
            // PoC 简化：失败仅 console.error，不阻断 SSE 主流程
            try {
              const ecsWorld = new World();
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
              createCharacterEntity(ecsWorld, ecsBaseSnapshot);
              ecsWorld.addSystem(AgingSystem);
              ecsWorld.addSystem(CultivationSystem);
              ecsWorld.tick();
              const tickedEntity = ecsWorld.getEntity(`character-${characterId}`);
              if (tickedEntity) {
                const tickedSnapshot = entityToSnapshot(tickedEntity);
                // PoC：把 ECS tick 的 age + cultivationExp 合并回 finalState
                finalState.age = tickedSnapshot.age;
                finalState.cultivationExp = tickedSnapshot.cultivationExp;
                if (!tickedSnapshot.alive && finalState.alive) {
                  finalState.alive = false;
                  finalState.causeOfDeath = finalState.causeOfDeath || 'ecs-aging-natural';
                }
              }
            } catch (e) {
              console.error('[advance-sse] ECS tick failed (non-fatal):', e);
              // 不阻断 SSE 主流程
            }

            // 修复 P1-1：SSE 路径补齐所有漏写字段——走与 non-SSE 同一个 buildAdvanceStateData
            await db.character.update({
              where: isProdMode
                ? { id: characterId, userId: user!.id, age: ageBefore }
                : { id: characterId, age: ageBefore },
              data: buildAdvanceStateData(finalState, {
                pendingChoiceJson,
                worldCalendar,
                causeOfDeath: finalState.causeOfDeath || '',
                lastEventAge: finalState.age,
              }),
            });
          }

          } catch (e: any) {
          clearInterval(heartbeat);
          console.error('[SSE] executeAIEvent error:', e?.message, e?.stack);
          // 修复：DB 错误不再静默吞，传播给上层 handler 决定（防止 SSE 推 done 但数据未落地）
          send('error', { error: `engine error: ${e?.message}`, detail: String(e?.message || e) });
          close();
          throw e;
        }

        // 7) 推送 done（数据库已同步写入，刷新页面不会丢失气泡）
        clearInterval(heartbeat);
        send('done', {
          type: 'done',
          eventId: createdEvent?.id,
          eventAge: createdEvent?.age,
          eventCreatedAt: createdEvent?.createdAt,
          state: stateToResponse(finalState),
          changes: displayEffects,
          breakthrough: null, // simplified for now
          hasChoice: !!aiOutput.hasChoice,
          choice: aiOutput.choice,
          worldCalendar,
          fallbackGenerated: !!aiOutput.isFallbackGenerated,
          title: aiOutput.title,
          narrative: aiOutput.narrative,
        });

        close();
      } catch (err: any) {
        console.error('[SSE] Top error:', err?.message);
        try {
          send('error', { error: err?.message || 'unknown error' });
        } catch {}
        clearInterval(heartbeat);
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}
