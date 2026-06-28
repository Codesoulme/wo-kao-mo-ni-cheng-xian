// POST /api/game/restriction/check
// AI-70: 禁制开启检查
// P1 step2: 收 where: { id, userId }（dev 模式 userId: undefined，Prisma 自动忽略 → 不破 dev/smoke）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, checkRestrictionAccess } from '@/lib/xianxia/engine';
import type { Restriction } from '@/lib/xianxia/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 10;

const schema = z.object({
  characterId: z.string(),
  restriction: z.any(),
  providedPassword: z.string().optional(),
  currentTiming: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  const { characterId, restriction, providedPassword, currentTiming } = parsed.data;

  const isProdMode = !!process.env.ADMIN_TOKEN;
  let user: { id: string } | null = null;
  if (isProdMode) {
    user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  const dbChar = await db.character.findUnique({ where: { id: characterId, userId: user?.id } });
  if (!dbChar) return NextResponse.json({ ok: false, error: '角色不存在' }, { status: 404 });
  const state = dbToState(dbChar);

  const result = checkRestrictionAccess(
    restriction as Restriction,
    { inventory: state.inventory, realm: state.realm, faction: state.faction },
    providedPassword,
    currentTiming,
  );
  // restriction/check 是只读检查：不 append event（无 state change）。
  return NextResponse.json({ ok: true, result });
}
