// @ts-nocheck - api route, types not critical

// POST /api/game/clean-test-artifacts
// 仅清理事件/预加载/干扰日志，保留所有角色存档
// P0: 加鉴权。
//   - dev/skip-auth 模式：默认放行（不破坏 smoke）
//   - 生产（设了 ADMIN_TOKEN）：必须 x-admin-token

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

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
