import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
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
