// POST /api/game/tribulation/end
// AI-67: 渡劫结束——结算结果（passed/failed/abandoned）

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 10;

const schema = z.object({
  sessionId: z.string(),
  outcome: z.enum(['ascended', 'failed', 'abandoned']),
  boltsCompleted: z.number().int().min(0).max(9),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  }
  const { sessionId, outcome, boltsCompleted } = parsed.data;
  // 纯结算——返回结构化结果，调用方负责持久化
  return NextResponse.json({
    ok: true,
    settlement: {
      sessionId,
      outcome,
      boltsCompleted,
      passed: outcome === 'ascended' && boltsCompleted === 9,
      summary:
        outcome === 'ascended'
          ? `渡过 ${boltsCompleted}/9 道天雷，飞升成仙。`
          : outcome === 'failed'
            ? `天劫反噬，兵解。`
            : '放弃渡劫，退回原境。',
    },
  });
}