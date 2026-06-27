// POST /api/game/restriction/interact
// AI-70: 禁制交互判定
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

  const result = resolveRestrictionInteraction(restriction as Restriction, choice, characterPower);
  return NextResponse.json({ ok: true, result });
}