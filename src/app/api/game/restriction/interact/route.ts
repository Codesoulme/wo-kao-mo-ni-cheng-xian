// @ts-nocheck - api route, types not critical

// POST /api/game/restriction/interact
// AI-70: 禁制交互判定
// P1 step2: 此 route 是纯函数调用（无 characterId/db），但仍加 auth gate 防滥用
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。
// 批 16: 可选 characterId —— 若传入则 capture before/after 触发 Event Sourcing PoC append（realm/cultivation-exp）。
//   current 阶段 engine 不改修为/境界，所以 before===after，append 块守门不触发；保留 append 代码以便后续
//   engine 真的触发修为变化时无需再改 route。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveRestrictionInteraction } from '@/lib/xianxia/engine';
import type { Restriction } from '@/lib/xianxia/types';
import { appendEvent } from '@/lib/xianxia/events/store';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 10;

const schema = z.object({
  restriction: z.any(),
  choice: z.enum(['attempt', 'retreat', 'combat']),
  characterPower: z.number().min(0),
  characterId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  const { restriction, choice, characterPower, characterId } = parsed.data;

  const isProdMode = !!process.env.ADMIN_TOKEN;
  let user: { id: string } | null = null;
  if (isProdMode) {
    user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  // 批 16: 若调用方传 characterId，capture charBefore 用于 Event Sourcing append。
  // 只在 prod 模式 + 传入 characterId + db 命中时 capture；其他场景不影响主流程。
  const charBefore = characterId
    ? await db.character.findUnique({ where: { id: characterId, userId: user?.id } })
    : null;

  const result = resolveRestrictionInteraction(restriction as Restriction, choice, characterPower);

  // 批 16 Event Sourcing PoC：若 realm/cultivationExp 在交互前后变化，append 事件。
  // appendEvent 失败不影响主流程（独立 try/catch）。
  if (charBefore) {
    const finalRealm = charBefore.realm;
    const finalCultivationExp = charBefore.cultivationExp;
    const finalAge = charBefore.age;
    try {
      if (charBefore.realm !== finalRealm) {
        await appendEvent({
          characterId,
          type: 'character.realm.changed',
          data: { type: 'character.realm.changed', from: charBefore.realm, to: finalRealm, method: 'set' },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: finalAge,
        });
      }
      if (charBefore.cultivationExp !== finalCultivationExp) {
        await appendEvent({
          characterId,
          type: 'character.cultivation-exp.changed',
          data: {
            type: 'character.cultivation-exp.changed',
            delta: finalCultivationExp - charBefore.cultivationExp,
            newValue: finalCultivationExp,
            reason: 'restriction-interact',
          },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: finalAge,
        });
      }
    } catch (e) {
      console.error('[restriction-interact] event failed (non-fatal):', e);
    }
  }

  return NextResponse.json({ ok: true, result });
}
