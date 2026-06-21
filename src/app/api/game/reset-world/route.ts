// POST /api/game/reset-world
// Clear local test world. Browser localStorage is cleared by the client button.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST() {
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
