// POST /api/game/ascension/check
// AI-68: 检查飞升资格
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

  const dbChar = await db.character.findUnique({ where: { id: characterId } });
  if (!dbChar) return NextResponse.json({ ok: false, error: '角色不存在' }, { status: 404 });

  const state = dbToState(dbChar);
  const requirements = deriveAscensionRequirements(currentTier as WorldTier);
  const result = checkAscensionEligibility(state, requirements);
  return NextResponse.json({ ok: true, requirements, eligibility: result });
}