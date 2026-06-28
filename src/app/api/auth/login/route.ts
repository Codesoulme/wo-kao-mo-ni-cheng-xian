// POST /api/auth/login
// body: { email, password }
// 登录：返回 user + 设置 session cookie
import { NextRequest, NextResponse } from 'next/server';
import { loginUser, setSessionCookie } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'missing_credentials' },
        { status: 400 }
      );
    }

    const token = await loginUser(email, password);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'invalid_credentials', message: '邮箱或密码错误' },
        { status: 401 }
      );
    }

    setSessionCookie(token);

    const user = await db.user.findUnique({ where: { email } });
    return NextResponse.json({
      success: true,
      user: user ? { id: user.id, email: user.email, displayName: user.displayName } : null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: 'internal', message: e?.message ?? 'login failed' },
      { status: 500 }
    );
  }
}
