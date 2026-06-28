// 简易鉴权中间件（P0 降级方案）
// 项目目前无 User model / session；本文件只做"谁可以调破坏性 API"的最小校验。
//
// 放行优先级（命中任一即放行）：
//   1. process.env.SKIP_AUTH === '1'          —— smoke / CI / 测试模式
//   2. 未设置 process.env.ADMIN_TOKEN         —— 本地 dev 单机模式（保持原行为）
//   3. request header x-admin-token 与 ADMIN_TOKEN 严格相等 —— 生产/多人模式
//
// 不命中 → 返回 401 + 友好 JSON。
//
// 注意：完整鉴权（User model + session + where: { userId }）属于后续 P1，本文件仅做"门锁"。
import { NextRequest, NextResponse } from 'next/server';

export type AuthResult =
  | { ok: true; mode: 'skip' | 'dev' | 'token'; userId?: string }
  | { ok: false; response: NextResponse };

/**
 * 校验请求是否经过授权。
 * @param req NextRequest（仅用于读 header）
 * @param opts.requiredConfirm 设为 'DELETE_ALL' 时，要求额外携带 `x-confirm: DELETE_ALL`
 *                              （仅在 token 模式下生效；skip/dev 模式默认放行）
 */
export function requireAuth(
  req: NextRequest,
  opts: { requiredConfirm?: 'DELETE_ALL' } = {}
): AuthResult {
  // 1) smoke / CI 逃生口
  if (process.env.SKIP_AUTH === '1') {
    return { ok: true, mode: 'skip' };
  }

  const adminToken = process.env.ADMIN_TOKEN;

  // 2) 未配置 ADMIN_TOKEN → 本地 dev 单机模式，直接放行
  //    这是为了不破坏现有 430 smoke 和本地 `bun run dev` 的开发体验
  if (!adminToken || adminToken.length === 0) {
    return { ok: true, mode: 'dev' };
  }

  // 3) 生产 / 多人模式：必须带正确 token
  const headerToken =
    req.headers.get('x-admin-token') ??
    req.headers.get('X-Admin-Token') ??
    '';
  if (headerToken.length === 0 || headerToken !== adminToken) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'unauthorized',
          message: '需要管理员 token（请设置请求头 x-admin-token，或在服务端配置 ADMIN_TOKEN 后用 SKIP_AUTH=1 关闭此校验）',
        },
        { status: 401 }
      ),
    };
  }

  // 二次确认（仅 token 模式 + 配置了 requiredConfirm 时要求）
  if (opts.requiredConfirm) {
    const confirm =
      req.headers.get('x-confirm') ??
      req.headers.get('X-Confirm') ??
      '';
    if (confirm !== opts.requiredConfirm) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'confirmation_required',
            message: `此操作需要 header x-confirm: ${opts.requiredConfirm} 进行二次确认`,
          },
          { status: 412 }
        ),
      };
    }
  }

  return { ok: true, mode: 'token' };
}
