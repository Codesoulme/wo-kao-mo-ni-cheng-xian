import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const latest = await db.character.findFirst({
      where: {
        age: { gt: 0 },
        NOT: [
          { name: { contains: '烟测' } },
          { name: { contains: '测试' } },
          { name: { contains: 'smoke' } },
          { name: { contains: 'Smoke' } },
          { name: { contains: 'test' } },
          { name: { contains: 'Test' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, age: true, realm: true, realmLevel: true, location: true, updatedAt: true, alive: true, ascended: true },
    });

    if (!latest || !latest.alive || latest.ascended) {
      return NextResponse.json({ success: true, hasSave: false });
    }

    const { alive: _alive, ascended: _ascended, ...character } = latest;
    return NextResponse.json({
      success: true,
      hasSave: true,
      character,
    });
  } catch (err: any) {
    console.error('latest save error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to find latest save' },
      { status: 500 }
    );
  }
}
