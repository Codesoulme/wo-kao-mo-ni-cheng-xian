// POST /api/game/ascension/end
// AI-68: 飞升结算
import { NextRequest, NextResponse } from 'next/server';
import { resolveAscensionOutcome } from '@/lib/xianxia/engine';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 10;

const schema = z.object({
  sessionId: z.string(),
  characterRoll: z.number().min(0).max(1),
  daoHeart: z.number().min(0).max(100),
  tribulationPassed: z.boolean(),
  requirements: z.any(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  const data = parsed.data;
  const result = resolveAscensionOutcome({
    characterRoll: data.characterRoll,
    daoHeart: data.daoHeart,
    tribulationPassed: data.tribulationPassed,
    requirements: data.requirements,
  });
  return NextResponse.json({
    ok: true,
    settlement: {
      sessionId: data.sessionId,
      passed: result.passed,
      narrative: result.narrative,
    },
  });
}