// POST /api/game/tribulation/action
// AI-67: 渡劫行动——执行一道雷或一次心魔判定

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveTribulationBolt,
  resolveHeartDemon,
} from '@/lib/xianxia/engine';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 15;

const schema = z.object({
  action: z.enum(['bolt', 'heart_demon']),
  boltNumber: z.number().int().min(1).max(9).optional(),
  characterRoll: z.number().min(0).max(1),
  heartDemon: z.number().min(0).max(100),
  soulStrength: z.number().min(0).max(100),
  bondedArtifactResonance: z.boolean().optional(),
  innerState: z
    .object({
      obsession: z.number(),
      hatred: z.number(),
      love: z.number(),
      fear: z.number(),
      regret: z.number(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  }
  const data = parsed.data;

  if (data.action === 'bolt') {
    if (!data.boltNumber) {
      return NextResponse.json({ ok: false, error: 'boltNumber 必填' }, { status: 400 });
    }
    const result = resolveTribulationBolt({
      boltNumber: data.boltNumber,
      characterRoll: data.characterRoll,
      heartDemon: data.heartDemon,
      soulStrength: data.soulStrength,
      bondedArtifactResonance: !!data.bondedArtifactResonance,
    });
    return NextResponse.json({ ok: true, result });
  }

  // heart_demon
  if (!data.innerState) {
    return NextResponse.json({ ok: false, error: 'innerState 必填' }, { status: 400 });
  }
  const result = resolveHeartDemon({
    innerState: data.innerState,
    resolveRoll: data.characterRoll,
  });
  return NextResponse.json({ ok: true, result });
}