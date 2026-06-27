// POST /api/game/ascension/start
// AI-68: 开飞升会话
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, deriveAscensionRequirements, deriveAscensionTrigger } from '@/lib/xianxia/engine';
import type { AscensionSession, WorldTier } from '@/lib/xianxia/types';
import { z } from 'zod';
import { nanoid } from 'nanoid';

export const runtime = 'nodejs';
export const maxDuration = 15;

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

  const trigger = deriveAscensionTrigger(state.age, state.realm);
  if (!trigger.triggered) return NextResponse.json({ ok: true, session: null, reason: trigger.reason });

  const requirements = deriveAscensionRequirements(currentTier as WorldTier);
  const session: AscensionSession = {
    id: nanoid(),
    characterId,
    fromTier: currentTier as WorldTier,
    toTier: requirements.toTier,
    requirements,
    startedAge: state.age,
    passed: false,
    outcome: 'ongoing',
    narrative: '天门洞开，灵光直冲云霄……',
  };
  return NextResponse.json({ ok: true, session, reason: trigger.reason });
}