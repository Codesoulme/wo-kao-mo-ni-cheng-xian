import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload, isAdvancePreloadUsable, prepareAdvanceCandidate, saveAdvanceCandidate } from '@/lib/xianxia/advance-preload';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    if (!characterId) return NextResponse.json({ success: false }, { status: 400 });

    const char = await db.character.findUnique({ where: { id: characterId } });
    if (!char || !char.alive || char.ascended || char.isAtChoice || char.pendingChoiceJson) {
      if (characterId) await clearAdvancePreload(characterId).catch(() => undefined);
      return NextResponse.json({ success: false });
    }

    if (char.combatStateJson) {
      try {
        const cs = JSON.parse(char.combatStateJson);
        if (cs && cs.status === 'ongoing') {
          await clearAdvancePreload(characterId).catch(() => undefined);
          return NextResponse.json({ success: false });
        }
      } catch {
        await clearAdvancePreload(characterId).catch(() => undefined);
        return NextResponse.json({ success: false });
      }
    }

    const existing = await db.advancePreload.findUnique({ where: { characterId } });
    if (existing && await isAdvancePreloadUsable(char, existing)) {
      return NextResponse.json({ success: true });
    }
    if (existing) await clearAdvancePreload(characterId);

    const candidate = await prepareAdvanceCandidate(char);
    await saveAdvanceCandidate(characterId, candidate);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('advance prepare error:', err);
    return NextResponse.json({ success: false });
  }
}
