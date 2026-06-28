// @ts-nocheck - api route, types not critical

// POST /api/game/reset-world
// Clear local test world. Browser localStorage is cleared by the client button.
// P0: 加鉴权 + 二次确认，避免被任意调用清库。
//   - dev/skip-auth 模式：默认放行（不破坏 smoke）
//   - 生产（设了 ADMIN_TOKEN）：必须 x-admin-token + x-confirm: DELETE_ALL

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, { requiredConfirm: 'DELETE_ALL' });
  if (!auth.ok) return auth.response;

  try {
    const result = await db.$transaction(async (tx) => {
      const advancePreload = await tx.advancePreload.deleteMany({});
      const interferences = await tx.interferenceLog.deleteMany({});
      const choices = await tx.choiceLog.deleteMany({});
      const events = await tx.eventLog.deleteMany({});
      const characters = await tx.character.deleteMany({});
      return {
        characters: characters.count,
        events: events.count,
        choices: choices.count,
        interferences: interferences.count,
        advancePreload: advancePreload.count,
      };
    });

    return NextResponse.json({ success: true, cleared: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '重置世界失败' }, { status: 500 });
  }
}
