// POST /api/game/clean-test-artifacts
// 仅清理事件/预加载/干扰日志，保留所有角色存档

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
      return {
        events: events.count,
        choices: choices.count,
        interferences: interferences.count,
        preload: advancePreload.count,
      };
    });

    return NextResponse.json({ success: true, cleared: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '清理测试残留失败' }, { status: 500 });
  }
}
