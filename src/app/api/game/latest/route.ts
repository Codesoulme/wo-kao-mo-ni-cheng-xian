// @ts-nocheck - api route, types not critical

import { NextResponse } from 'next/server';

// P0 TODO AUTH: 此 route 当前零鉴权，任意能访问 baseUrl 的人可改写任意 characterId。
// 完整鉴权方案（User model + session + where: { userId }）属于 P1。
// 当前已对破坏性 route（reset-world / clean-test-artifacts / ai-config / archive）加 requireAuth；
// 此 route 暂留 TODO，待 P1 引入 User model 后批量加 requireAuth + 收窄 where 条件。
// 参考实现：src/lib/auth.ts

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ success: true, hasSave: false });
}
