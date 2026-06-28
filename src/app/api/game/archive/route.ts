// @ts-nocheck - api route, types not critical

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  // P0: archive 直接 deleteMany 角色，是破坏性操作，必须鉴权。
  const auth = requireAuth(req as any);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const characterId = String(body?.characterId || '').trim();
    if (!characterId) {
      return NextResponse.json({ success: false, error: 'characterId required' }, { status: 400 });
    }

    await db.character.deleteMany({ where: { id: characterId } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('archive character error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to archive character' },
      { status: 500 }
    );
  }
}
