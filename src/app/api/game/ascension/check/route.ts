// @ts-nocheck - api route, types not critical

// POST /api/game/ascension/check
// AI-68: 检查飞升资格
// P1 step2: 收 where: { id, userId }（dev 模式 userId: undefined，Prisma 自动忽略 → 不破 dev/smoke）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, deriveAscensionRequirements, checkAscensionEligibility } from '@/lib/xianxia/engine';
import type { WorldTier } from '@/lib/xianxia/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 10;

const schema = z.object({
  characterId: z.string(),
  currentTier: z.enum(['humanWorld', 'spiritWorld', 'immortalWorld']),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  const { characterId, currentTier } = parsed.data;

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
  const requirements = deriveAscensionRequirements(currentTier as WorldTier);
  const result = checkAscensionEligibility(state, requirements);
  return NextResponse.json({ ok: true, requirements, eligibility: result });
}
