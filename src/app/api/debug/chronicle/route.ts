// GET /api/debug/chronicle — 后台自检端点
// 返回 chronicle 全表 JSON（schedule + history + generatedUntilYear + currentYear）
// SKIP_AUTH=1 或匹配 ADMIN_TOKEN 时放行；否则 401。

import { NextRequest, NextResponse } from 'next/server';
import { getChronicle } from '@/lib/xianxia/world-chronicle-store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const skipAuth = process.env.SKIP_AUTH === '1';
  if (!skipAuth) {
    const token = process.env.ADMIN_TOKEN;
    const hdr = req.headers.get('authorization') || req.headers.get('x-admin-token') || '';
    const qs = new URL(req.url).searchParams.get('token') || '';
    const provided = hdr.replace(/^Bearer\s+/i, '').trim() || qs.trim();
    if (!token || provided !== token) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }
  try {
    const c = await getChronicle();
    return NextResponse.json({
      id: c.id,
      eraName: c.eraName,
      currentYear: c.currentYear,
      generatedUntilYear: c.generatedUntilYear,
      scheduleCount: c.schedule.length,
      historyCount: c.history.length,
      schedule: c.schedule,
      history: c.history,
      updatedAt: c.updatedAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'chronicle fetch failed' }, { status: 500 });
  }
}
