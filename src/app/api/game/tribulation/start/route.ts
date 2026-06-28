// @ts-nocheck - api route, types not critical

// POST /api/game/tribulation/start
// AI-67: 开劫入口——校验天劫触发条件，返回初始 TribulationSession
// P1 step2: 收 where: { id, userId }（dev 模式 userId: undefined，Prisma 自动忽略 → 不破 dev/smoke）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  dbToState,
  deriveTribulationTrigger,
} from '@/lib/xianxia/engine';
import type { TribulationSession, TribulationStage } from '@/lib/xianxia/types';
import { z } from 'zod';
import { nanoid } from 'nanoid';

export const runtime = 'nodejs';
export const maxDuration = 15;

const schema = z.object({
  characterId: z.string(),
  toRealm: z.string(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  }
  const { characterId, toRealm } = parsed.data;

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
  const trigger = deriveTribulationTrigger(state.realm, toRealm as any);
  if (!trigger.triggered) {
    return NextResponse.json({ ok: true, session: null, reason: trigger.reason });
  }

  const openingStage: TribulationStage = 'opening';
  const session: TribulationSession = {
    id: nanoid(),
    characterId,
    startedAge: state.age,
    fromRealm: state.realm,
    toRealm: toRealm as any,
    currentStage: openingStage,
    boltsCompleted: 0,
    hpRemaining: 100,
    heartDemonActive: null,
    heartDemonResolved: false,
    narrative: '天象异变，乌云压顶，雷声隐隐……',
    passed: false,
    outcome: 'ongoing',
  };
  return NextResponse.json({ ok: true, session, reason: trigger.reason });
}
