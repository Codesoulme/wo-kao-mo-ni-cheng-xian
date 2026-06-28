// P1 step1: User model + session cookie 鉴权 helper
//
// 设计：
// - 读 session：从 cookie 拿 token → 查 UserSession 表 → 校验过期 → 返回 user
// - 创建 user：scrypt 哈希密码（PoC；生产应换 bcrypt/argon2）
// - 登录：邮箱+密码 → 创建 UserSession → 返回 token
// - 不动 src/lib/auth.ts（保留 ADMIN_TOKEN 模式作为 dev/smoke 逃生口）
// - route 收 where: { id, userId } 留给 step2
import { cookies } from 'next/headers';
import { db } from './db';
import crypto from 'crypto';

const SESSION_COOKIE_NAME = 'xianxia_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string | null;
}

/** 从 cookie 读 session，返回当前 user（无效/过期返回 null） */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.userSession.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    // 过期 session 清掉；不抛错
    await db.userSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
  };
}

/** 强制要求 user（用于 route handler；未登录抛 UNAUTHORIZED） */
export async function requireUserFromSession(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

/** 创建 user（PoC 邮箱密码；邮箱冲突抛错） */
export async function createUser(
  email: string,
  password: string,
  displayName?: string
): Promise<{ id: string; email: string }> {
  const passwordHash = hashPassword(password);
  const user = await db.user.create({
    data: { email, passwordHash, displayName: displayName ?? null },
  });
  return { id: user.id, email: user.email };
}

/** 登录：返回 session token（失败返回 null） */
export async function loginUser(email: string, password: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  const token = crypto.randomBytes(32).toString('hex');
  await db.userSession.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });
  return token;
}

/** 写 session cookie（httpOnly + sameSite=lax） */
export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  });
}

/** 清 session cookie */
export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE_NAME);
}

/** 登出：按 token 删 session */
export async function logoutUser(token: string) {
  await db.userSession.deleteMany({ where: { token } }).catch(() => {});
}

// === 密码哈希（PoC：scrypt；生产应换 bcrypt/argon2） ===

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const computed = crypto.scryptSync(password, salt, 64).toString('hex');
  // 等长才能 timingSafeEqual
  if (hash.length !== computed.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
}
