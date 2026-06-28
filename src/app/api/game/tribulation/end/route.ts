// POST /api/game/tribulation/end
// AI-67: 渡劫结束——结算结果（passed/failed/abandoned）
// P1 step2: 纯结算 route（无 db.character），但加 auth gate 防滥用
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { appendEvent } from '@/lib/xianxia/events/store';

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
  try {
    const owningChar = await db.character.findFirst({
      where: { tribulationSessionJson: { contains: sessionId } },
      select: { id: true, hp: true, realm: true, age: true, alive: true },
    });
    if (owningChar) {
      eventedCharacterId = owningChar.id;
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
