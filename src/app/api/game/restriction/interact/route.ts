// POST /api/game/restriction/interact
// AI-70: 禁制交互判定
// P1 step2: 此 route 是纯函数调用（无 characterId/db），但仍加 auth gate 防滥用
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { resolveRestrictionInteraction } from '@/lib/xianxia/engine';
import type { Restriction } from '@/lib/xianxia/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 10;

const schema = z.object({
  restriction: z.any(),
  choice: z.enum(['attempt', 'retreat', 'combat']),
  characterPower: z.number().min(0),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  const { restriction, choice, characterPower } = parsed.data;

  const isProdMode = !!process.env.ADMIN_TOKEN;
  if (isProdMode) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  const result = resolveRestrictionInteraction(restriction as Restriction, choice, characterPower);
  return NextResponse.json({ ok: true, result });
}
