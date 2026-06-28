// @ts-nocheck - api route, types not critical

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload, isAdvancePreloadUsable, prepareAdvanceCandidate, saveAdvanceCandidate } from '@/lib/xianxia/advance-preload';
import { appendEvent } from '@/lib/xianxia/events/store';

// P1 step2: 收 where: { id, userId }（dev 模式 userId: undefined，Prisma 自动忽略 → 不破 dev/smoke）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    if (!characterId) return NextResponse.json({ success: false }, { status: 400 });

    const isProdMode = !!process.env.ADMIN_TOKEN;
    let user: { id: string } | null = null;
    if (isProdMode) {
      user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const char = await db.character.findUnique({ where: { id: characterId, userId: user?.id } });
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
    const preloadResult = existing ? await isAdvancePreloadUsable(char, existing) : { usable: false };
    if (preloadResult.usable) {
      // 批 16: preload-advance 路由接 Event Sourcing——复用 character.age.advanced 占位事件
      try {
        await appendEvent({
          characterId,
          type: 'character.age.advanced',
          data: { type: 'character.age.advanced', from: 0, to: 0 },
          source: 'system-tick',
          triggerActor: 'system',
        });
      } catch (e) {
        console.error('[preload-advance] event append failed (non-fatal):', e);
      }
      return NextResponse.json({ success: true });
    }
    if (existing) await clearAdvancePreload(characterId);

    const candidate = await prepareAdvanceCandidate(char);
    await saveAdvanceCandidate(characterId, candidate);
    // 批 16: preload-advance 路由接 Event Sourcing——预加载完成占位事件
    try {
      await appendEvent({
        characterId,
        type: 'character.age.advanced',
        data: { type: 'character.age.advanced', from: 0, to: 0 },
        source: 'system-tick',
        triggerActor: 'system',
      });
    } catch (e) {
      console.error('[preload-advance] event append failed (non-fatal):', e);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('advance prepare error:', err);
    return NextResponse.json({ success: false });
  }
}
