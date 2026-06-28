// POST /api/auth/register
// body: { email, password, displayName? }
// 注册新用户（PoC；生产应加邮箱验证、限频、reCAPTCHA）
import { NextRequest, NextResponse } from 'next/server';
import { createUser, loginUser, setSessionCookie } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const displayName = body.displayName ? String(body.displayName).trim() : undefined;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'invalid_email' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'password_too_short', message: '密码至少 6 位' },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await createUser(email, password, displayName);
    } catch (e: any) {
      // 邮箱冲突（Prisma 唯一约束）
      if (e?.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'email_taken', message: '该邮箱已注册' },
          { status: 409 }
        );
      }
      throw e;
    }

    // 注册成功 → 直接发 session cookie
    const token = await loginUser(email, password);
    if (token) setSessionCookie(token);

    return NextResponse.json({ success: true, user });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: 'internal', message: e?.message ?? 'register failed' },
      { status: 500 }
    );
  }
}
