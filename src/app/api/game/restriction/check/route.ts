// POST /api/game/restriction/check
// AI-70: 禁制开启检查
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

  const dbChar = await db.character.findUnique({ where: { id: characterId } });
  if (!dbChar) return NextResponse.json({ ok: false, error: '角色不存在' }, { status: 404 });
  const state = dbToState(dbChar);

  const result = checkRestrictionAccess(
    restriction as Restriction,
    { inventory: state.inventory, realm: state.realm, faction: state.faction },
    providedPassword,
    currentTiming,
  );
  return NextResponse.json({ ok: true, result });
}