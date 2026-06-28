// POST /api/auth/logout
// 清 session cookie + 删服务端 session 记录
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearSessionCookie, logoutUser } from '@/lib/auth-helpers';

const SESSION_COOKIE_NAME = 'xianxia_session';

export async function POST(_req: NextRequest) {
  try {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (token) await logoutUser(token);
    clearSessionCookie();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: 'internal', message: e?.message ?? 'logout failed' },
      { status: 500 }
    );
  }
}
