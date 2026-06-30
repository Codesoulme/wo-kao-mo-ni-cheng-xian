// @ts-nocheck - api route, types not critical

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState } from '@/lib/xianxia/engine';
import { generateSettlementResult } from '@/lib/xianxia/settlement';
import { generateSettlementEvaluation } from '@/lib/xianxia/llm';
import { getCurrentUser } from '@/lib/auth-helpers';
// 批 15: Event Sourcing PoC — settlement 路由接 appendEvent。
// appendEvent 失败不影响 settlement 主流程；保留 P0-9/P1-12/S1 已有逻辑。
import { appendEvent } from '@/lib/xianxia/events/store';
// Phase 5 #3: 把 ECS tick-helper 推广到 settlement 路由。
// 结算时 ECS tick（修年龄/修为），与 choose/interfere/advance 风格对齐——tick 放在事务之前（appendEvent 之前），失败 try/catch 不阻断。
import { tickEcsForCharacter, applyEcsTickToState } from '@/lib/xianxia/ecs/tick-helper';

// P1 step2 worker A: 生产模式下强制 userId 检查；dev 模式保持原行为。

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const isProdMode = !!process.env.ADMIN_TOKEN;
    let user: { id: string } | null = null;
    if (isProdMode) {
      user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    const reason: string | undefined = body?.reason;
    if (!characterId) {
      return NextResponse.json({ success: false, error: 'characterId required' }, { status: 400 });
    }

    const char = await db.character.findUnique({
      where: isProdMode ? { id: characterId, userId: user!.id } : { id: characterId },
    });
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });

    const eventRows = await db.eventLog.findMany({
      where: { characterId },
      orderBy: { age: 'asc' },
    });
    const events = eventRows.map((event) => ({
      id: event.id,
      age: event.age,
      title: event.title,
      narrative: event.narrative,
      eventType: event.eventType,
      effects: JSON.parse(event.effects || '[]'),
      createdAt: event.createdAt,
    }));

    let state = dbToState(char as any);
    if (reason === 'abandon') {
      state = {
        ...state,
        alive: false,
        causeOfDeath: state.causeOfDeath || '主动放下此世因果',
      };
      if (char.alive || !char.causeOfDeath) {
        await db.character.update({
          where: isProdMode ? { id: characterId, userId: user!.id } : { id: characterId },
          data: { alive: false, causeOfDeath: state.causeOfDeath || '' },
        });
      }
    }

    const fallback = generateSettlementResult(state as any, events as any);
    let settlementResult = fallback;

    try {
      const ai = await Promise.race([
        generateSettlementEvaluation({
          character: state,
          events,
          candidateOptions: fallback.options,
          fallback: {
            title: fallback.title,
            summary: fallback.summary,
            rank: fallback.rank,
            score: fallback.score,
          },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('settlement ai timeout')), 20000)),
      ]);
      const selected = fallback.options
        .filter((option) => ai.optionIds.includes(option.id))
        .map((option) => ({ ...option, reason: ai.reasons[option.id] || option.reason }));
      settlementResult = {
        ...fallback,
        title: ai.title || fallback.title,
        summary: ai.summary || fallback.summary,
        rank: ai.rank || fallback.rank,
        options: selected,
        hallRecord: {
          ...fallback.hallRecord,
          evaluationTitle: ai.rank || fallback.hallRecord.evaluationTitle,
        },
      };
    } catch (err: any) {
      console.error('settlement ai failed:', err?.message || err);
      settlementResult = { ...fallback, options: fallback.options.slice(0, Math.min(3, fallback.options.length)) };
    }

    // Phase 5 #3: settlement 接 ECS tick（结算时推进 age + 修为沉淀）。
    // 放在 appendEvent 之前——tick 不进 ES 事务；failure 仅 console.error，不阻断 settlement 主流程。
    // deathReason 兜底保留：若 ECS 判死而 state.causeOfDeath 为空，补 'ecs-aging-natural'，不覆盖用户设定的 abandon/ascension 原因。
    try {
      const ecsBaseSnapshot = {
        characterId,
        name: state.name || '',
        age: state.age,
        realm: state.realm,
        cultivationExp: state.cultivationExp,
        hp: state.hp,
        maxHp: state.maxHp,
        spiritStones: state.spiritStones,
        alive: state.alive,
        lifespan: state.lifespan || 100,
        inventory: [],
      };
      const ecsResult = tickEcsForCharacter(characterId, ecsBaseSnapshot, { source: 'settlement' });
      applyEcsTickToState(state, ecsResult);
    } catch (e) {
      console.error('[settlement] ECS tick failed (non-fatal):', e);
    }

    // 批 15: Event Sourcing PoC — settlement 写事件。
    // 仅在 settlementResult 生成成功之后才 append；settlement 失败时（外层 catch）不写。
    // appendEvent 失败不影响 settlement 主流程（保留 P0-9 结算双路径 / P1-12 ending catch / S1 鉴权）。
    // PoC 简化：只看 ending 是否 ascension/state 是否 ascended，不改 settlementResult 生成逻辑。
    if (settlementResult) {
      const isAscension =
        settlementResult.ending === 'ascension' || (state as any).ascended === true;
      const causeLabel = isAscension
        ? 'ascension'
        : (state as any).causeOfDeath || 'death';
      // alive.changed — 每次结算都写一份（ascension/death 都触发 alive=false 终局）。
      try {
        await appendEvent({
          characterId,
          type: 'character.alive.changed',
          data: {
            type: 'character.alive.changed',
            alive: false,
            cause: causeLabel,
          },
          source: 'system-tick',
          triggerActor: 'system',
          createdAtAge: state.age,
        });
      } catch (e: any) {
        console.error('[settlement] alive event append failed (non-fatal):', e?.message || e);
      }
      // realm.changed — 飞升结局额外写一份（method: 'set'，因为 PoC 不算严格突破）。
      if (isAscension) {
        try {
          await appendEvent({
            characterId,
            type: 'character.realm.changed',
            data: {
              type: 'character.realm.changed',
              from: (state as any).realm || 'unknown',
              to: `${(state as any).realm || 'unknown'}-ascended`,
              method: 'set',
            },
            source: 'system-tick',
            triggerActor: 'system',
            createdAtAge: state.age,
          });
        } catch (e: any) {
          console.error('[settlement] realm event append failed (non-fatal):', e?.message || e);
        }
      }
    }

    return NextResponse.json({ success: true, settlementResult });
  } catch (err: any) {
    console.error('settlement error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to settle character' }, { status: 500 });
  }
}
