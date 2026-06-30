// @ts-nocheck - api route, types not critical

// POST /api/game/tribulation/end
// AI-67: 渡劫结束——结算结果（passed/failed/abandoned）
// P1 step2: 纯结算 route（无 db.character），但加 auth gate 防滥用
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。
// Phase 7 W4: 接入 ECS tick-helper——渡劫结算推进寿元 + 修为沉淀（突破成功修为暴涨，失败/放弃也走同一 tick 修为自然沉淀）。
// tick 放在 appendEvent 之前（不进 ES 事务），failure 仅 console.error，不阻断渡劫结算主流程。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { appendEvent } from '@/lib/xianxia/events/store';
import { tickEcsForCharacter, applyEcsTickToState } from '@/lib/xianxia/ecs/tick-helper';

export const runtime = 'nodejs';
export const maxDuration = 10;

const schema = z.object({
  sessionId: z.string(),
  outcome: z.enum(['ascended', 'failed', 'abandoned']),
  boltsCompleted: z.number().int().min(0).max(9),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  }
  const { sessionId, outcome, boltsCompleted } = parsed.data;

  const isProdMode = !!process.env.ADMIN_TOKEN;
  if (isProdMode) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  // 批 16: tribulation 路由接 Event Sourcing——按 outcome 触发 hp/alive/realm 事件
  // 通过 sessionId 反查 character.tribulationSessionJson 拿 characterId（PoC：扫描式查找）
  let eventedCharacterId: string | null = null;
  // Phase 7 W4: 突破结算前先跑一次 ECS tick（修为 + 寿元推进）。tick 不进事务，failure 仅 console.error。
  // deathReason 兜底：ECS 判死时若 causeOfDeath 为空补 'ecs-aging-natural'，不覆盖渡劫失败/飞升等显式原因。
  let tribulationEcsResult: ReturnType<typeof tickEcsForCharacter> | null = null;
  try {
    const owningChar = await db.character.findFirst({
      where: { tribulationSessionJson: { contains: sessionId } },
      select: { id: true, hp: true, realm: true, age: true, alive: true, name: true, cultivationExp: true, maxHp: true, spiritStones: true, lifespan: true },
    });
    if (owningChar) {
      eventedCharacterId = owningChar.id;
      // 突破结算前先跑一次 ECS tick（修为 + 寿元推进）——tick 不进事务，failure 仅 console.error。
      try {
        const ecsBaseSnapshot = {
          characterId: owningChar.id,
          name: owningChar.name || '',
          age: owningChar.age,
          realm: owningChar.realm,
          cultivationExp: owningChar.cultivationExp ?? 0,
          hp: owningChar.hp ?? 100,
          maxHp: owningChar.maxHp ?? 100,
          spiritStones: owningChar.spiritStones ?? 0,
          alive: owningChar.alive,
          lifespan: owningChar.lifespan || 100,
          inventory: [],
        };
        tribulationEcsResult = tickEcsForCharacter(owningChar.id, ecsBaseSnapshot, {
          source: outcome === 'ascended' ? 'tribulation-pass' : outcome === 'failed' ? 'tribulation-fail' : 'tribulation-abandon',
        });
      } catch (ecsErr) {
        console.error('[tribulation/end] ECS tick failed (non-fatal):', ecsErr);
      }
      const hpDelta = -Math.max(5, boltsCompleted * 5);
      const newHp = Math.max(0, Math.min(100, (owningChar.hp ?? 100) + hpDelta));
      const passed = outcome === 'ascended' && boltsCompleted === 9;

      // hp.changed：每次结算都触发（含 abandoned 也扣点气血）
      if (newHp !== owningChar.hp) {
        await appendEvent({
          characterId: owningChar.id,
          type: 'character.hp.changed',
          data: { type: 'character.hp.changed', delta: newHp - (owningChar.hp ?? 100), newValue: newHp, reason: 'tribulation' },
          source: 'system-tick',
          triggerActor: 'system',
          createdAtAge: owningChar.age,
        });
      }

      // alive.changed：渡劫失败致死
      if (outcome === 'failed' && owningChar.alive) {
        await appendEvent({
          characterId: owningChar.id,
          type: 'character.alive.changed',
          data: { type: 'character.alive.changed', alive: false, cause: 'tribulation-fail' },
          source: 'system-tick',
          triggerActor: 'system',
          createdAtAge: owningChar.age,
        });
      }

      // realm.changed：渡劫成功飞升
      if (passed && owningChar.realm === 'tribulation') {
        await appendEvent({
          characterId: owningChar.id,
          type: 'character.realm.changed',
          data: { type: 'character.realm.changed', from: owningChar.realm, to: 'ascension', method: 'breakthrough' },
          source: 'system-tick',
          triggerActor: 'system',
          createdAtAge: owningChar.age,
        });
      }
    }
  } catch (e) {
    console.error('[tribulation/end] event append failed (non-fatal):', e);
  }

  // Phase 7 W4: 把 ECS tick 结果（age + cultivationExp）持久化到 db.character。
  // tribulation/end 是纯结算 route，但突破结果应反映修为推进——修为暴涨/扣修为由 CultivationSystem 在 tick 里算。
  // 用 applyEcsTickToState merge 到临时 state，再 update db（不进 ES 事务）。failure 仅 console.error 不阻断主流程。
  if (tribulationEcsResult && eventedCharacterId) {
    try {
      const tempState: any = {
        age: 0,
        cultivationExp: 0,
        alive: true,
      };
      applyEcsTickToState(tempState, tribulationEcsResult);
      await db.character.update({
        where: { id: eventedCharacterId },
        data: {
          age: tempState.age,
          cultivationExp: tempState.cultivationExp,
        },
      });
    } catch (persistErr: any) {
      console.error('[tribulation/end] ECS tick persist failed (non-fatal):', persistErr?.message || persistErr);
    }
  }

  // 纯结算——返回结构化结果，调用方负责持久化
  return NextResponse.json({
    ok: true,
    settlement: {
      sessionId,
      outcome,
      boltsCompleted,
      passed: outcome === 'ascended' && boltsCompleted === 9,
      summary:
        outcome === 'ascended'
          ? `渡过 ${boltsCompleted}/9 道天雷，飞升成仙。`
          : outcome === 'failed'
            ? `天劫反噬，兵解。`
            : '放弃渡劫，退回原境。',
    },
    _debug: { eventedCharacterId },
  });
}
