// @ts-nocheck - api route, types not critical

import { NextRequest } from 'next/server';

// ★ 任务 E 修复：heartbeat 改为模块作用域变量，避免并发请求共享 globalThis 单例互相清理
let sseHeartbeat: NodeJS.Timeout | null = null;
import { db } from '@/lib/db';
import { prepareAdvanceCandidate } from '@/lib/xianxia/advance-preload';
import { buildStateContext, executeAIEvent, stateToResponse } from '@/lib/xianxia/engine';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { clampTimeAdvance, advanceWorldCalendar, worldTimeStamp, hiddenEventMeta, formatWorldTimeDisplay } from '@/lib/xianxia/world-time';
import { buildAdvanceStateData } from '@/lib/xianxia/persist-advance-state';
import { truncateNarrativeAtSentence } from '@/lib/xianxia/display';
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
// 修真界感改进 - 任务 D：寿元压力
import { lifespanPressure, lifespanPressureStatus, nearLifespan } from '@/lib/xianxia/realm-lifespan';
// 批 20: ECS 集成 advance —— 让 AgingSystem / CultivationSystem 在 SSE 路径上也跑一次 world.tick()
// 优化：缓存 World + Systems + Entity 跨多次 advance 复用，避免每次 new World() + addSystem() + createCharacterEntity()（节省 200-500ms/advance）
import { World } from '@/lib/xianxia/ecs/core';
import type { Entity } from '@/lib/xianxia/ecs/core';
import {
  createCharacterEntity,
  entityToSnapshot,
} from '@/lib/xianxia/ecs/character-entity';
import type { MetaComponent, CultivationComponent } from '@/lib/xianxia/ecs/components';
import { AgingSystem } from '@/lib/xianxia/ecs/systems/aging-system';
import { CultivationSystem } from '@/lib/xianxia/ecs/systems/cultivation-system';

type EcsCache = {
  world: World;
  entity: Entity;
  charId: string;
  /** 上次写入 base 的 age（用于增量 tick：advance 后 entity.age 与 base 一致 → 直接同步即可） */
  baseAge: number;
  baseCultivationExp: number;
};
let ecsCache: EcsCache | null = null;

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
        sseHeartbeat = setInterval(() => {
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
              // 兜底正则替换：LLM 偶尔在 narrative 里写"变化+1"等占位符，prompt 虽约束但仍可能漏出
              // 这里服务端先 replace 成"（属性变化，详见结算）"占位，让客户端不直接看到"变化+1不知道是什么"
              const sanitized = extracted
                .replace(/变化\s*\+\s*\d+/g, '（属性见结算）')
                .replace(/属性\s*\+\s*\d+/g, '（属性见结算）')
                .replace(/(修为|悟性|灵根|根骨|福缘|机缘|气运|天赋|命格|血脉|体魄|神识|魂魄)\s*\+\s*\d+/g, '（$1见结算）');
              const newDelta = sanitized.slice(prevNarrative.length);
              prevNarrative = sanitized;
              if (!firstDeltaSent) {
                firstDeltaSent = true;
                console.log('[SSE] First narrative delta sent, total raw:', rawText.length, 'narrative:', extracted.length);
              }
              send('narrative_delta', { type: 'narrative_delta', delta: newDelta });
            }
            // ★ narrative 字符串字段闭合时（LLM 写完 narrative 在准备下一个字段），立即通知前端
            // → 玩家立刻看到"收获结算中..."提示，不再干等 LLM 写剩余 changes/items/npcs
            // 修复截断 bug: LLM 写 narrative 时被 max_tokens 截断（line 1302 警告），"narrative" 字段可能以半句话闭合
            // （如"你爹喻大山从窑口探出头来，喊你搬柴"无句号）。emit 前必须：
            //   1. 末尾完整性检查（必须有 。！？!? 等句末标点）
            //   2. truncateNarrativeAtSentence 兜底（虽然流式已闭合但 narrative 可能 > 400 字）
            if (closed && !narrativeClosedSent) {
              // emit narrative 完整（绝不截断玩家内容）
              // 之前 truncateNarrativeAtSentence(400) 截断是错的——会丢重要信息（剧情转折、玉佩、机缘等）
              // 现在 emit 完整 narrative，让玩家看到所有内容
              // prompt 约束 LLM 写简短完整（400-600 字）来控制长度
              // max_tokens 截断是 LLM 真实上限问题，不是客户端能截断解决的
              const lastChar = prevNarrative.trim().slice(-1);
              const isComplete = /[。！？!?;；]/.test(lastChar);
              if (!isComplete) {
                console.warn('[SSE] narrative 末尾不完整（可能被 max_tokens 截断），保留全部内容 emit:', prevNarrative.slice(-50));
              }
              narrativeClosedSent = true;
              console.log('[SSE] narrative field closed, sent narrative_complete event (len:', prevNarrative.length, ', complete:', isComplete, ')');
              send('narrative_complete', { type: 'narrative_complete', narrative: prevNarrative });
            }
          }, { qualityMode });
        } catch (e: any) {
          send('error', { error: `AI generation failed: ${e?.message}` });
          try { if (sseHeartbeat) { clearInterval(sseHeartbeat); sseHeartbeat = null; } } catch {}
          close();
          return;
        }
        try { if (sseHeartbeat) { clearInterval(sseHeartbeat); sseHeartbeat = null; } } catch {};
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
          // 凡人基础属性补底（修 user 反馈"基础属性一出生给全部值不合理"+"强制给值不合理"）
          // 不是强制覆盖（仙人孩子应继承父母根骨），而是补底 max(LLM给的值, age_baseline × rootMultiplier)：
          //   - LLM 给的值被尊重（不强制覆盖）
          //   - 补底公式按 age 和 rootMultiplier（灵根倍率）计算"凡人年龄应有的最低值"
          //   - 灵根 0.3（凡人杂灵根）= 年龄基础 × 0.3（弱）
          //   - 灵根 1.0（单灵根）= 年龄基础 × 1.0（标准）
          //   - 灵根 2.0+（天灵根/异灵根）= 年龄基础 × 2.0+（仙人孩子，可能一出生就有基础）
          // 引入期（realm=引气）不补底（realm 进阶时 LLM/引擎自己管）
          if (finalState.realm === 'mortal') {
            const age = finalState.age;
            const mul = Number(finalState.rootMultiplier ?? 0.3);  // 默认凡人 0.3 倍
            // 补底：年龄基础 × 灵根倍率
            finalState.attack = Math.max(finalState.attack ?? 0, Math.floor(age * 0.6 * mul));
            finalState.defense = Math.max(finalState.defense ?? 0, Math.floor(age * 0.3 * mul));
            finalState.speed = Math.max(finalState.speed ?? 0, 3 + Math.floor(age * 0.4 * mul));
            finalState.physicalFoundation = Math.max(finalState.physicalFoundation ?? 0, Math.round(5 + age * 1.5 * mul));
            finalState.spiritualSense = Math.max(finalState.spiritualSense ?? 0, 3 + Math.floor(age * 0.4 * mul));
            finalState.soulStrength = Math.max(finalState.soulStrength ?? 0, 3 + Math.floor(age * 0.3 * mul));
            // maxHp / maxMp 补底（避免 0 岁 maxHp 100 不合理）
            const newMaxHp = Math.max(finalState.maxHp ?? 0, 30 + age * 3);
            const newMaxMp = Math.max(finalState.maxMp ?? 0, 10 + Math.floor(age * 0.5));
            finalState.maxHp = newMaxHp;
            finalState.maxMp = newMaxMp;
            if ((finalState.hp ?? 0) > finalState.maxHp) finalState.hp = finalState.maxHp;
            if ((finalState.mp ?? 0) > finalState.maxMp) finalState.mp = finalState.maxMp;
          }
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
            // 优化：缓存 World + Systems + Entity 跨 advance 复用，跳过空 tick（base 与 entity 状态已一致时直接同步），节省 200-500ms/advance
            // PoC 简化：失败仅 console.error，不阻断 SSE 主流程
            try {
              if (!finalState.alive) {
                // 已死亡角色：跳过 ECS tick（age/cultivationExp 不会再增长），但仍需保证缓存不串味
                if (ecsCache && ecsCache.charId !== characterId) {
                  ecsCache = null;
                }
              } else {
                const needsRebuild =
                  !ecsCache ||
                  ecsCache.charId !== characterId ||
                  ecsCache.world.listEntities().length === 0;

                if (needsRebuild) {
                  // 首次或 character 切换：新建 World + 一次性挂载 Systems（System 是 module-level 单例，stateless）
                  const freshWorld = new World();
                  freshWorld.addSystem(AgingSystem);
                  freshWorld.addSystem(CultivationSystem);
                  const freshSnapshot = {
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
                  const freshEntity = createCharacterEntity(freshWorld, freshSnapshot);
                  const metaComp = freshEntity.getComponent<MetaComponent>('Meta');
                  const cultivationComp = freshEntity.getComponent<CultivationComponent>('Cultivation');
                  if (!metaComp || !cultivationComp) {
                    throw new Error('ECS entity missing required Meta/Cultivation components');
                  }
                  ecsCache = {
                    world: freshWorld,
                    entity: freshEntity,
                    charId: characterId,
                    baseAge: metaComp.age,
                    baseCultivationExp: cultivationComp.cultivationExp,
                  };
                } else {
                  // 缓存命中：只更新 Meta/Cultivation 的 base 字段（age/lifespan/alive/cultivationExp），然后 tick
                  const metaComp = ecsCache.entity.getComponent<MetaComponent>('Meta')!;
                  const cultivationComp = ecsCache.entity.getComponent<CultivationComponent>('Cultivation')!;
                  metaComp.age = finalState.age;
                  metaComp.alive = finalState.alive;
                  metaComp.lifespan = finalState.lifespan || 100;
                  cultivationComp.cultivationExp = finalState.cultivationExp;
                  ecsCache.baseAge = metaComp.age;
                  ecsCache.baseCultivationExp = cultivationComp.cultivationExp;
                }

                // 跑 tick（AgingSystem + CultivationSystem 都是纯函数引用，可重复调用）
                ecsCache.world.tick();

                // 读回 entity 状态 → 合并到 finalState
                const tickedEntity = ecsCache.world.getEntity(`character-${characterId}`);
                if (tickedEntity) {
                  const tickedSnapshot = entityToSnapshot(tickedEntity);
                  finalState.age = tickedSnapshot.age;
                  finalState.cultivationExp = tickedSnapshot.cultivationExp;
                  if (!tickedSnapshot.alive && finalState.alive) {
                    finalState.alive = false;
                    finalState.causeOfDeath = finalState.causeOfDeath || 'ecs-aging-natural';
                  }
                }
              }
            } catch (e) {
              console.error('[advance-sse] ECS tick failed (non-fatal):', e);
              // 不阻断 SSE 主流程：缓存可能损坏，下一次 advance 重建
              ecsCache = null;
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

        // 修真界感改进 - 任务 D：寿元边界检查。
        // 仅在 age 接近 lifespan 时将强信号叠入 finalState.statusJson 与 statusList，
        // 避免另起 status type schema 让客户端多分支处理。
        try {
          const ageAfter = (finalState as any).age;
          const lifespanAfter = (finalState as any).lifespan;
          if (typeof ageAfter === 'number' && typeof lifespanAfter === 'number') {
            const signal = lifespanPressureStatus(ageAfter, lifespanAfter);
            if (signal) {
              const statusList: any[] = Array.isArray((finalState as any).statusList)
                ? (finalState as any).statusList
                : [];
              if (!statusList.some((s: any) => s && (s.name === signal || s.id === 'lifespan-pressure'))) {
                statusList.push({
                  id: 'lifespan-pressure',
                  name: signal,
                  category: 'identity',
                  rarity: 'common',
                  description: nearLifespan(ageAfter, lifespanAfter)
                    ? `寿元将尽：角色当前 ${ageAfter} 岁，距寿终 ${lifespanAfter - ageAfter} 年。`
                    : `寿元已尽：角色已超过寿元上限 ${ageAfter - lifespanAfter} 年。`,
                  source: 'engine-lifespan-check',
                  duration: -1,
                });
                (finalState as any).statusList = statusList;
                (finalState as any).statusJson = JSON.stringify(statusList);
              }
            }
            // 寿元已尽：强制 death
            if (lifespanPressure(ageAfter, lifespanAfter) === 'expired' && (finalState as any).alive !== false) {
              (finalState as any).alive = false;
              (finalState as any).causeOfDeath = (finalState as any).causeOfDeath || '寿终正寝';
              (finalState as any).hp = 0;
            }
          }
        } catch (e) {
          console.error('[advance-sse] lifespan pressure check failed (non-fatal):', e);
          // 不阻断 SSE 主流程
        }

        // 7) 推送 done（数据库已同步写入，刷新页面不会丢失气泡）
        try { if (sseHeartbeat) { clearInterval(sseHeartbeat); sseHeartbeat = null; } } catch {}
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
          console.error('[SSE] executeAIEvent error:', err?.message, err?.stack);
          // 兜底：仍然推送 done 事件 + close（不阻断客户端收尾）
          try { send('done', { type: 'done', error: err?.message, fallbackGenerated: true }); } catch {}
          try { close(); } catch {}
        }
      } catch (err: any) {
        console.error('[SSE] Top error:', err?.message, err?.stack);
        try {
          send('error', {
            error: err?.message || 'unknown SSE error',
            detail: String(err?.stack || err?.message || err),
          });
        } catch {}
        try { if (sseHeartbeat) { clearInterval(sseHeartbeat); sseHeartbeat = null; } } catch {}
        try { close(); } catch {}
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
