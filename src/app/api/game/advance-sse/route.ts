// @ts-nocheck - api route, types not critical

import { NextRequest } from 'next/server';

// ★ 任务 E 修复：heartbeat 改为模块作用域变量，避免并发请求共享 globalThis 单例互相清理
let sseHeartbeat: NodeJS.Timeout | null = null;
import { db } from '@/lib/db';
import { prepareAdvanceCandidate } from '@/lib/xianxia/advance-preload';
import { buildStateContext, executeAIEvent, stateToResponse, applyAnnualAttributeGrowth } from '@/lib/xianxia/engine';
import { parseAchievementMarkers, applyAchievements } from '@/lib/xianxia/achievements';
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
  // 2026-07-12：临终 LLM 叙事——避免死亡兜底突兀
  generateDeathNarrative,
} from '@/lib/xianxia/llm';
import { getCurrentUser } from '@/lib/auth-helpers';
// 修仙界感改进 - 任务 D：寿元压力
import { lifespanPressure, lifespanPressureStatus, nearLifespan } from '@/lib/xianxia/realm-lifespan';
import { detectLifespanExtension, deriveLifespanFromState, getLifePhase } from '@/lib/xianxia/realm-lifespan';
// 修仙界感改进 - 任务 E：世界级事件调度器（已废弃 — 保留 import 供旧存档 fallback 读取）
import { applyWorldEvent, decayWorldEvents, type WorldEvent } from '@/lib/xianxia/world-event-scheduler';
// 世界大事年表 · 出生预排 + tick 驱动
import { getChronicle } from '@/lib/xianxia/world-chronicle-store';
import { tickChronicle, getFolkloreContext } from '@/lib/xianxia/world-chronicle-tick';
import { ensureChronicleCoverage } from '@/lib/xianxia/world-chronicle-generator';
import {
  parseInfluenceMarkers,
  applyInfluencesToChronicle,
  stripInfluenceMarkers,
} from '@/lib/xianxia/world-chronicle-influence';
import { applyEventEffectsToCharacter, removeEventStatusFromCharacter } from '@/lib/xianxia/world-event-scheduler';
import { buildAchievementPromptHint } from '@/lib/xianxia/achievements';
import { tickAllNpcsForYear } from '@/lib/xianxia/npc-growth';
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
      // 检查这个 " 是真闭合还是 LLM 在正文里嵌的对话引号
      // 真闭合：后面（跳过空白/换行后）必须紧跟 JSON 结构字符 , } ] 之一
      // 否则视为正文内容里的引号，继续吸收
      let j = i + 1;
      while (j < rawText.length && /[\s\r\n]/.test(rawText[j])) j += 1;
      const nextStruct = rawText[j];
      if (j >= rawText.length) {
        // 流还没到，无法判断——暂时按未闭合处理，等更多 delta
        // 但要把这个 " 也吸收进 result（如果真闭合，下轮 delta 到达时会重新判定）
        // 保守做法：如果流真的结束在这，parseJSON 会在服务端 aiOutput 阶段兜底
        return { content: result, closed: false };
      }
      if (nextStruct === ',' || nextStruct === '}' || nextStruct === ']') {
        // 字符串真结束
        return { content: result, closed: true };
      }
      // 不是结构字符 → 这个 " 是正文里的引号，吸进去继续
      result += ch;
      i += 1;
      continue;
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
        const isProdMode = process.env.SKIP_AUTH !== '1' && !!process.env.ADMIN_TOKEN;
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
        // 2026-07-12：玩家按月推进——SSE 路径也透传 forceTimeAdvance。
        const forceTimeAdvance = body?.forceTimeAdvance && typeof body.forceTimeAdvance === 'object'
          ? body.forceTimeAdvance : null;

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
        const timeAdvance = clampTimeAdvance(
          forceTimeAdvance || candidate.timeAdvance,
          candidate.timeAdvance
        );

        // 构建 worldCalendar
        let worldCalendar = char.worldCalendarJson ? JSON.parse(char.worldCalendarJson) : null;
        const worldCalendarBefore = worldCalendar ? { ...worldCalendar } : null;
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
        // 世界大事年表：把当前世事流转（近百年历史 + 当下发生 + 传闻卜卦）作为 prompt 背景注入
        try {
          const chronicleForPrompt = await getChronicle();
          const currentYear = Number(worldCalendar?.calendarYear ?? chronicleForPrompt.currentYear ?? 5000);
          const folklore = getFolkloreContext(chronicleForPrompt, currentYear, 120, 30);
          const lines: string[] = [];
          lines.push('【天下大势·世事流转】（供 AI 自然融入，可提可不提）');
          lines.push(`当前世界年：${chronicleForPrompt.eraName} ${currentYear} 年`);
          if (folklore.past.length > 0) {
            lines.push('');
            lines.push('近百余年间已发生：');
            for (const e of folklore.past) {
              const y = e.actualEndYear ?? e.scheduledYear;
              const yearsAgo = Math.max(0, currentYear - y);
              lines.push(`- ${y} 年前后，${e.narrativeSeed}（已过 ${yearsAgo} 年）`);
            }
          }
          if (folklore.nowActive.length > 0) {
            lines.push('');
            lines.push('当下正在发生：');
            for (const e of folklore.nowActive) {
              const sy = e.actualStartYear ?? e.scheduledYear;
              const years = Math.max(0, currentYear - sy);
              lines.push(`- 自 ${sy} 年起，${e.narrativeSeed}（已持续 ${years} 年）`);
            }
          }
          if (folklore.upcoming.length > 0) {
            lines.push('');
            lines.push('近年传闻卜卦（未成事实，仅茶肆闲谈/长辈提及）：');
            for (const e of folklore.upcoming) {
              lines.push(`- ${e.narrativeSeed}`);
            }
          }
          lines.push('');
          lines.push('【规则】');
          lines.push('- 这些是世界背景。若剧情自然涉及（茶肆闲谈、长辈提起、路见异象、告示、传闻）可以带出；不涉及也无需强提。');
          lines.push('- 当下正在发生的事件若与角色所在地点/身份相关，请在 narrative 中让角色感知（远方也可通过传闻）。');
          lines.push('- 若角色行为对世界事件有影响（干预、参与、扭转），用 [WORLD_EVENT_INFLUENCE:eventId type=advance|delay|weaken|amplify|cancel reason="..."] 标记。');
          ctx.worldEventAvailablePrompt = lines.join('\n');
        } catch (e) {
          console.warn('[advance-sse] folklore context build failed:', (e as any)?.message || e);
          ctx.worldEventAvailablePrompt = '';
        }

        // 沉浸版 Phase-Z: 成就种子池提示（AI 据 narrative 自主决定是否触发）
        try {
          ctx.achievementPromptHint = buildAchievementPromptHint();
        } catch {
          ctx.achievementPromptHint = '';
        }

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
              // 兜底正则替换：LLM 偶尔在 narrative 里写"变化+1""破势+1"等占位符，prompt 虽约束但仍可能漏出
              // 这里服务端先 replace 掉整段含字段名的"破势+1""护持+2""机变+3""气血上限+8"等占位符
              // 规则从 display.ts MECHANISM_PATTERNS 同步，避免分散两套规则导致漏
              const sanitized = extracted.replace(
                /(?:变化|属性|修为|悟性|灵根|根骨|福缘|机缘|气运|天赋|命格|血脉|体魄|神识|魂魄|破势|护持|机变|气血(?:上限)?|灵力(?:上限)?|声望|寿元)\s*[\+\-±]\s*\d{1,8}/g,
                '',
              );
              // 剥离世界事件干预标记 [WORLD_EVENT_INFLUENCE:...]（引擎元数据，不给玩家看）
              // 流式期间标记可能横跨 chunk 边界：若见到未闭合的 `[WORLD`，把当前 sanitized 截到 `[` 之前，
              // 等 `]` 抵达后再让 emit 追上（后续 chunk 到来时 extracted 变长，sanitized 再计算就能剥完整段）
              let sanitized2 = sanitized.replace(/\[WORLD_EVENT_INFLUENCE:[^\]]*\]/gi, '');
              const openIdx = sanitized2.search(/\[WORLD_EVENT_INFLUENCE:[^\]]*$/i);
              if (openIdx >= 0) sanitized2 = sanitized2.slice(0, openIdx);
              const newDelta = sanitized2.slice(prevNarrative.length);
              prevNarrative = sanitized2;
              if (newDelta.length > 0) {
                if (!firstDeltaSent) {
                  firstDeltaSent = true;
                  console.log('[SSE] First narrative delta sent, total raw:', rawText.length, 'narrative:', extracted.length);
                }
                send('narrative_delta', { type: 'narrative_delta', delta: newDelta });
              }
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
              // narrative_complete 时最后再剥一遍干预标记（overwrite 前端已渲染，保底方案）
              const cleaned = stripInfluenceMarkers(prevNarrative);
              const lastChar = cleaned.trim().slice(-1);
              const isComplete = /[。！？!?;；]/.test(lastChar);
              if (!isComplete) {
                console.warn('[SSE] narrative 末尾不完整（可能被 max_tokens 截断），保留全部内容 emit:', cleaned.slice(-50));
              }
              narrativeClosedSent = true;
              console.log('[SSE] narrative field closed, sent narrative_complete event (len:', cleaned.length, ', complete:', isComplete, ')');
              send('narrative_complete', { type: 'narrative_complete', narrative: cleaned });
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
        // 最终 aiOutput.narrative 剥离世界事件干预标记（引擎元数据不入库/展示）
        if (typeof aiOutput.narrative === 'string') {
          aiOutput.narrative = stripInfluenceMarkers(aiOutput.narrative);
        }
        if (Array.isArray(aiOutput.extraEvents)) {
          aiOutput.extraEvents = aiOutput.extraEvents.map((e: any) => ({
            ...e,
            narrative: stripInfluenceMarkers(cleanNarrativeAge(String(e?.narrative || ''), ctx.character.age, ctx.character.name)),
          }));
        }
        if (!aiOutput.narrative) aiOutput.narrative = stripInfluenceMarkers(prevNarrative || rawText);

        // 3.5) 行动前影子试算 + 高风险单轮自我纠偏
        //   系统 1：拿 aiOutput 在 state 的离线副本上跑一遍 executeAIEvent，把散落的险情原料
        //           （陨落 / 气血 / 心魔 / 寿元 / 边界告警）汇成 0..1 分数。0 次 LLM，个位数毫秒。
        //   系统 2：分数越阈值时，把只讲叙事约束的 advisory 注入 ctx，用轻量档小模型重生成一次，
        //           再试算一次——只在新方案分数确实更低时才采纳，避免修正反噬。
        //   单轮，不递归，不重试；全程 try/catch，任何异常一律沿用原 aiOutput，绝不阻断主流程。
        try {
          const { assessAdvanceRisk, DEFAULT_RISK_THRESHOLD } = await import('@/lib/xianxia/advance-risk');
          const baseline = assessAdvanceRisk(state, aiOutput);
          if (baseline) {
            console.log(`[advance-sse] 风险试算 score=${baseline.score.toFixed(3)} level=${baseline.level} ${baseline.durationMs}ms factors=[${baseline.factors.map((f: any) => f.code).join(',')}]`);
          }
          if (baseline && baseline.score > DEFAULT_RISK_THRESHOLD && baseline.advisoryPrompt) {
            const { callLLMText } = await import('@/lib/xianxia/llm');
            const prevAdvisory = ctx.riskAdvisoryPrompt;
            ctx.riskAdvisoryPrompt = baseline.advisoryPrompt;
            try {
              const revisedPrompt = buildAdvancePrompt(ctx, isFateNode, 'light');
              const revisedRaw = await callLLMText(fullSystem, revisedPrompt, { qualityMode: 'light' });
              let revised: any = sanitizeEventOutput(parseJSON(revisedRaw), ctx.character.age);
              revised.narrative = stripInfluenceMarkers(
                cleanNarrativeAge(revised.narrative, ctx.character.age, ctx.character.name),
              );
              if (Array.isArray(revised.extraEvents)) {
                revised.extraEvents = revised.extraEvents.map((e: any) => ({
                  ...e,
                  narrative: stripInfluenceMarkers(cleanNarrativeAge(String(e?.narrative || ''), ctx.character.age, ctx.character.name)),
                }));
              }
              if (!revised.narrative) throw new Error('修正稿无 narrative，弃用');
              const after = assessAdvanceRisk(state, revised);
              if (after && after.score < baseline.score) {
                console.log(`[advance-sse] 采纳修正稿 ${baseline.score.toFixed(3)} → ${after.score.toFixed(3)}（${baseline.level} → ${after.level}）`);
                aiOutput = revised;
                // 修正稿的 narrative 与流式已推给前端的不同，补推一次让前端覆盖显示。
                send('narrative_complete', { type: 'narrative_complete', narrative: aiOutput.narrative });
              } else {
                console.log(`[advance-sse] 弃用修正稿（未降险 ${baseline.score.toFixed(3)} → ${after ? after.score.toFixed(3) : 'n/a'}），沿用原输出`);
              }
            } finally {
              ctx.riskAdvisoryPrompt = prevAdvisory;
            }
          }
        } catch (e: any) {
          console.warn('[advance-sse] 风险纠偏失败（非致命，沿用原输出）:', e?.message || e);
        }

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
        // 临终追加事件（若本轮死亡才写；提升到外层作用域，让 done 里能带上）
        let deathEvent: any = null;
        let displayEffects: any[] = [];
        let createdEvent: any = null;
        try {
          const execResult = executeAIEvent(state, aiOutput);
          finalState = execResult.state;

          // 沉浸版 Phase-N: 主角年度属性成长（spiritualSense / soulStrength / physicalFoundation / attack / defense / speed / maxHp / maxMp）
          // 派生 force/guard/agility（破势/护持/机变）顺势刷新，让面板可见逐年成长。
          // 修真者 current > baseline 时保留 current；凡人按 age × rootMultiplier 兜底。
          try {
            const growthResult = applyAnnualAttributeGrowth(finalState);
            if (growthResult && growthResult.state) {
              finalState = growthResult.state;
              // 把成长 delta 写进 eventEffects 让 buildEventDisplayEffects 自动渲染到卡片
              (finalState as any).__lastAnnualGrowth = growthResult.growth;
            }
          } catch (e) {
            console.warn('[advance-sse] applyAnnualAttributeGrowth failed:', e);
          }

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
                        // 沉浸版 Phase-Z: 破境事件 → 飘字层自动 emit 全屏过场
              try {
                if (execResult && (execResult as any).breakthroughHappened) {
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

displayEffects = buildEventDisplayEffects({
            before: state,
            after: finalState,
            changes: execResult.appliedChanges || [],
            // 2026-07-12：把引擎真正删的物品 id 透出来，让"失去：XXX"chip 正确显示
            removedItemIds: execResult.removedItemIds || [],
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

          // 沉浸版·临终追加事件（2026-07-12 用户反馈"结局突兀"）：
          // 若本轮跨过 alive=false，紧跟主 event 再多写一条"临终"独立事件（LLM 优先，硬编码兜底），
          // 让当年推进的主叙事保留 + 尾部补上真正的死亡场景。
          if (char.alive === true && finalState.alive === false) {
            const deathCause = (finalState as any).causeOfDeath || (finalState as any).deathReason || '寿元已尽，身隳道消';
            const deathTitles = ['身殒道消', '身隳道消', '道途已尽', '尘世收局'];
            const seedStr = `${characterId}|${finalState.age}`;
            let seed = 0; for (let si = 0; si < seedStr.length; si++) seed = (seed * 31 + seedStr.charCodeAt(si)) >>> 0;
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
              console.error('[advance-sse] death narrative gen failed (non-fatal):', e);
            }
            const fallbackNarrative = `${aiOutput.title ? `${aiOutput.title}之后，` : ''}他的一生走到了尽头。${deathCause}。`;
            try {
              deathEvent = await db.eventLog.create({
                data: {
                  characterId,
                  age: finalState.age,
                  title: deathTitles[seed % deathTitles.length],
                  narrative: deathNarrative || fallbackNarrative,
                  eventType: 'death',
                  effects: '[]',
                },
              });
            } catch (e) {
              console.error('[advance-sse] death event insert failed (non-fatal):', e);
            }
          }

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

            // 世界大事年表 · tick 驱动
            //   1) 读 chronicle
            //   2) tickChronicle(from, to) → justStarted / active / justConcluded
            //   3) 对 justStarted/active 事件应用效应到 finalState；对 justConcluded 事件清 status
            //   4) 若 generatedUntilYear - yearTo < 100 → 后台静默补齐 500 年（fire-and-forget）
            try {
              const ageAfterTick = Number((finalState as any).age ?? 0);
              const yearsAdvanced = Math.max(1, ageAfterTick - Number(ageBefore ?? ageAfterTick));

              // 1. decay 旧存档的 activeEvents（保 backward-compat；新档 worldEvent 字段为空即 noop）
              finalState = decayWorldEvents(finalState, yearsAdvanced);

              // 1.35 沉浸版 Phase-Z: 稀有物品掉落（diff inventory，rare+ emit DropBurst）
              try {
                const prevInv = Array.isArray((state as any)?.inventory) ? (state as any).inventory : [];
                const nextInv = Array.isArray((finalState as any)?.inventory) ? (finalState as any).inventory : [];
                const prevIds = new Set(prevInv.map((it: any) => String(it?.id ?? it?.name ?? '')));
                const drops: any[] = [];
                for (const it of nextInv) {
                  if (!it) continue;
                  const id = String(it.id ?? it.name ?? '');
                  if (prevIds.has(id)) continue;
                  const r = String(it.rarity ?? 'common');
                  if (!['rare', 'epic', 'legendary', 'mythic'].includes(r)) continue;
                  drops.push({ id, name: String(it.name ?? '异宝'), rarity: r, category: String(it.category ?? it.type ?? '') });
                }
                if (drops.length > 0) (finalState as any).__lastDrops = drops;
              } catch {}

              // 沉浸版 Phase-Life: 末尾按当前属性重算 lifespan
              try {
                const { deriveLifespanFromState } = await import('@/lib/xianxia/realm-lifespan');
                const computed = deriveLifespanFromState(finalState);
                const cur = Number((finalState as any).lifespan || 0);
                if (computed > cur) {
                  (finalState as any).lifespan = computed;
                  (finalState as any).__lastLifespanRecalc = { from: cur, to: computed };
                }
              } catch {}

              // 1.4 沉浸版 Phase-Z: AI 成就判定
              try {
                const llmNarrForAch = String((aiOutput as any)?.narrative ?? '');
                const parsedAch = parseAchievementMarkers(llmNarrForAch);
                if (parsedAch.length > 0) {
                  const achResult = applyAchievements(finalState, parsedAch, { triggeredAge: ageAfterTick });
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
                console.warn('[advance-sse] applyAchievements failed:', e);
              }

              // 1.5 沉浸版 Phase-N: NPC 年度推进
              try {
                const prevNpcs = Array.isArray((finalState as any)?.npcs) ? (finalState as any).npcs : [];
                if (prevNpcs.length > 0) {
                  const npcResult = tickAllNpcsForYear(prevNpcs, yearsAdvanced, ageAfterTick);
                  if (npcResult && Array.isArray(npcResult.nextNpcs)) {
                    finalState = { ...finalState, npcs: npcResult.nextNpcs };
                  }
                }
              } catch (e) {
                console.warn('[advance-sse] tickAllNpcsForYear failed:', e);
              }

              // ─── 世界大事年表：tick ───────────────────────────
              try {
                const chronicle = await getChronicle();
                const yearFrom = Number(worldCalendarBefore?.calendarYear ?? worldCalendar?.calendarYear ?? chronicle.currentYear);
                const yearTo = Number(worldCalendar?.calendarYear ?? chronicle.currentYear);

                // 更新 chronicle currentYear 到最新
                if (chronicle.currentYear !== yearTo) {
                  try {
                    await (db as any).worldChronicle.update({ where: { id: 'default' }, data: { currentYear: yearTo } });
                  } catch {}
                }

                const tickResult = await tickChronicle(chronicle, yearFrom, yearTo);

                // 世界大事年表 · 玩家干预标记解析
                // AI 若在 narrative 中打了 [WORLD_EVENT_INFLUENCE:...] 标记，这里解析并落库；
                // 若因 advance 使某 scheduled 事件提前进入 due 窗口，二次 tick 转 active 并追加效应。
                try {
                  const llmNarrative = String((aiOutput as any)?.narrative ?? '');
                  if (llmNarrative) {
                    const influences = parseInfluenceMarkers(llmNarrative);
                    if (influences.length > 0) {
                      const result = await applyInfluencesToChronicle(influences, {
                        currentYear: yearTo,
                        characterId,
                      });
                      console.log('[chronicle] influences parsed:', influences.length, 'applied:', result.applied.length, 'skipped:', result.skipped.length);
                      if (result.skipped.length > 0) {
                        console.log('[chronicle] influences skipped:', result.skipped);
                      }
                      // 应用完再跑一次 tick 以捕获 advance 后进入 due 窗口的事件
                      if (result.applied.length > 0) {
                        try {
                          const chronicleAfter = await getChronicle();
                          const secondTick = await tickChronicle(chronicleAfter, yearFrom, yearTo);
                          for (const ev of secondTick.justStarted) {
                            // 去重：一次 tick 已经处理过的 eventId 不再重复
                            if (tickResult.justStarted.some(x => x.id === ev.id)) continue;
                            finalState = applyEventEffectsToCharacter(finalState, {
                              id: ev.id,
                              type: ev.type,
                              scheduledYear: ev.scheduledYear,
                              actualStartYear: ev.actualStartYear,
                              plannedDuration: ev.plannedDuration,
                              actualDuration: ev.actualDuration,
                              narrativeActual: ev.narrativeActual,
                              narrativeSeed: ev.narrativeSeed,
                            });
                            tickResult.justStarted.push(ev);
                            console.log('[chronicle] justStarted (post-influence):', ev.type, 'at year', ev.actualStartYear);
                          }
                          for (const ev of secondTick.justConcluded) {
                            if (tickResult.justConcluded.some(x => x.id === ev.id)) continue;
                            finalState = removeEventStatusFromCharacter(finalState, ev.type);
                            tickResult.justConcluded.push(ev);
                          }
                        } catch (e2) {
                          console.warn('[chronicle] second tick after influence failed (non-fatal):', (e2 as any)?.message || e2);
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error('[chronicle] influence parse/apply failed (non-fatal):', (e as any)?.message || e);
                }

                // 应用 justStarted 事件效应
                for (const ev of tickResult.justStarted) {
                  finalState = applyEventEffectsToCharacter(finalState, {
                    id: ev.id,
                    type: ev.type,
                    scheduledYear: ev.scheduledYear,
                    actualStartYear: ev.actualStartYear,
                    plannedDuration: ev.plannedDuration,
                    actualDuration: ev.actualDuration,
                    narrativeActual: ev.narrativeActual,
                    narrativeSeed: ev.narrativeSeed,
                  });
                  console.log('[chronicle] justStarted:', ev.type, 'at year', ev.actualStartYear);
                }

                // 处理 concluded 事件（清 status）
                for (const ev of tickResult.justConcluded) {
                  finalState = removeEventStatusFromCharacter(finalState, ev.type);
                  console.log('[chronicle] justConcluded:', ev.type, 'end year', ev.actualEndYear);
                }

                // 把 justStarted / active 事件挂到 aiOutput（供前端展示）
                try {
                  const evt = (aiOutput as any)?.choice ? null : aiOutput;
                  if (evt && typeof evt === 'object' && tickResult.justStarted.length > 0) {
                    (evt as any).worldChronicleEvents = tickResult.justStarted.map((e) => ({
                      id: e.id,
                      type: e.type,
                      narrativeSeed: e.narrativeSeed,
                      actualStartYear: e.actualStartYear,
                    }));
                  }
                } catch {}

                // 后台静默补齐（fire-and-forget）
                if (chronicle.generatedUntilYear - yearTo < 100) {
                  const nextTarget = chronicle.generatedUntilYear + 500;
                  void ensureChronicleCoverage(nextTarget, characterId)
                    .then((r) => console.log('[chronicle] bg fill done:', r))
                    .catch((e) => console.error('[chronicle] bg fill failed:', (e as any)?.message || e));
                }
              } catch (e) {
                console.error('[advance-sse] chronicle tick failed (non-fatal):', (e as any)?.message || e);
              }
            } catch (e) {
              console.error('[advance-sse] world event scheduler failed (non-fatal):', e);
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

        // 修仙界感改进 - 任务 D：寿元边界检查。
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
            // 寿元已尽：第一次标记 nearDeath，第二次才真正坐化
            const pressureNow = lifespanPressure(ageAfter, lifespanAfter);
            if (pressureNow === 'expired' && (finalState as any).alive !== false) {
              const wasNearDeath = (finalState as any).nearDeath === true
                && typeof (finalState as any).nearDeathYear === 'number'
                && ageAfter > (finalState as any).nearDeathYear;
              if (wasNearDeath) {
                (finalState as any).alive = false;
                (finalState as any).causeOfDeath = (finalState as any).causeOfDeath || '寿元已尽，坐化于世';
                (finalState as any).hp = 0;
              } else {
                (finalState as any).nearDeath = true;
                (finalState as any).nearDeathYear = ageAfter;
                (finalState as any).causeOfDeath = (finalState as any).causeOfDeath || '大限将至';
              }
            } else if (pressureNow !== 'expired') {
              // 在寿元内：检测 narrative 延寿
              try {
                const llmNarr = String((aiOutput as any)?.narrative ?? '');
                const ext = detectLifespanExtension(llmNarr);
                if (ext && (finalState as any).nearDeath) {
                  const oldLife = Number((finalState as any).lifespan || 0);
                  (finalState as any).lifespan = oldLife + ext.extended;
                  (finalState as any).nearDeath = false;
                  (finalState as any).nearDeathYear = undefined;
                  (finalState as any).causeOfDeath = undefined;
                  (finalState as any).__lastLifespanExtension = { delta: ext.extended, reason: ext.reason, hint: ext.hint };
                  console.log('[advance-sse] 延寿延命：', ext.reason, '+' + ext.extended, '年');
                }
              } catch {}
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
          // 临终追加事件（若本轮死亡才有；前端可像普通 event 一样气泡显示）
          deathEvent: deathEvent ? {
            id: deathEvent.id,
            age: deathEvent.age,
            title: deathEvent.title,
            narrative: deathEvent.narrative,
            eventType: 'death',
            createdAt: deathEvent.createdAt,
          } : null,
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
