// @ts-nocheck - api route, types not critical

// GET /api/game/latest?characterId=xxx
// 拉取角色最新一次 advance 落库后的完整 state（与 /api/game/advance 的 state 字段同构）。
// 用于前端 "刷新页面后恢复最新状态" / "存档预览" / "外部 watchdog 拉状态"。

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, stateToResponse } from '@/lib/xianxia/engine';
import { getCurrentUser } from '@/lib/auth-helpers';

// P0 TODO AUTH: 此 route 当前零鉴权，任意能访问 baseUrl 的人可改写任意 characterId。
// 完整鉴权方案（User model + session + where: { userId }）属于 P1。
// 当前已对破坏性 route（reset-world / clean-test-artifacts / ai-config / archive）加 requireAuth；
// 此 route 暂留 TODO，待 P1 引入 User model 后批量加 requireAuth + 收窄 where 条件。
// 参考实现：src/lib/auth.ts
//
// P1 step2 worker A (latest 复用): 生产模式下强制 userId 检查；dev 模式（ADMIN_TOKEN 未设 / SKIP_AUTH=1）保持原行为。
// 这样 latest 和 advance / state 三端点的鉴权策略保持一致，避免 smoke baseline 被打破。

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // 生产模式（ADMIN_TOKEN 已设）→ 必须登录 + 收窄 where
    // dev 模式（ADMIN_TOKEN 未设 / SKIP_AUTH=1）→ 跳过 userId check，保留旧行为（避免破坏现有 488+ smoke）
    const isProdMode = !!process.env.ADMIN_TOKEN;
    let user: { id: string } | null = null;
    if (isProdMode) {
      user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get('characterId');
    if (!characterId) {
      return NextResponse.json({ success: false, error: 'characterId required' }, { status: 400 });
    }

    // 拉角色（prod 模式收窄 userId；dev 模式只看 id 以兼容旧 smoke）
    const char = await db.character.findUnique({
      where: isProdMode ? { id: characterId, userId: user!.id } : { id: characterId },
    });
    if (!char) {
      return NextResponse.json({ success: false, hasSave: false, error: 'Character not found' }, { status: 404 });
    }

    // 用 dbToState 把 Prisma 行转成 CharacterState，再用 stateToResponse 投影成前端契约
    // 与 /api/game/advance response.state 字段保持一致
    const state = dbToState(char as any);
    const responseState = stateToResponse(state);

    return NextResponse.json({
      success: true,
      hasSave: true,
      characterId: char.id,
      lastEventAge: char.lastEventAge ?? char.age,
      updatedAt: char.updatedAt,
      state: responseState,
    });
  } catch (err: any) {
    console.error('latest error:', err);
    return NextResponse.json(
      { success: false, hasSave: false, error: err?.message || 'Failed to get latest state' },
      { status: 500 }
    );
  }
}