import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const active = await db.character.findFirst({
      where: { alive: true, ascended: false },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, age: true, realm: true, realmLevel: true, location: true, updatedAt: true },
    });
    const latest = active || await db.character.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, age: true, realm: true, realmLevel: true, location: true, updatedAt: true, alive: true, ascended: true },
    });

    if (!latest) {
      return NextResponse.json({ success: true, hasSave: false });
    }

    return NextResponse.json({
      success: true,
      hasSave: true,
      character: latest,
    });
  } catch (err: any) {
    console.error('latest save error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to find latest save' },
      { status: 500 }
    );
  }
}
