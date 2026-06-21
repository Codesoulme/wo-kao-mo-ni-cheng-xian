import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState } from '@/lib/xianxia/engine';
import { generateSettlementResult } from '@/lib/xianxia/settlement';
import { generateSettlementEvaluation } from '@/lib/xianxia/llm';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    const reason: string | undefined = body?.reason;
    if (!characterId) {
      return NextResponse.json({ success: false, error: 'characterId required' }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });

    const eventRows = await db.eventLog.findMany({
      where: { characterId },
      orderBy: { age: 'asc' },
    });
    const events = eventRows.map((event) => ({
      id: event.id,
      age: event.age,
      title: event.title,
      narrative: event.narrative,
      eventType: event.eventType,
      effects: JSON.parse(event.effects || '[]'),
      createdAt: event.createdAt,
    }));

    let state = dbToState(char as any);
    if (reason === 'abandon') {
      state = {
        ...state,
        alive: false,
        causeOfDeath: state.causeOfDeath || '主动放下此世因果',
      };
      if (char.alive || !char.causeOfDeath) {
        await db.character.update({
          where: { id: characterId },
          data: { alive: false, causeOfDeath: state.causeOfDeath },
        });
      }
    }

    const fallback = generateSettlementResult(state as any, events as any);
    let settlementResult = fallback;

    try {
      const ai = await Promise.race([
        generateSettlementEvaluation({
          character: state,
          events,
          candidateOptions: fallback.options,
          fallback: {
            title: fallback.title,
            summary: fallback.summary,
            rank: fallback.rank,
            score: fallback.score,
          },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('settlement ai timeout')), 20000)),
      ]);
      const selected = fallback.options
        .filter((option) => ai.optionIds.includes(option.id))
        .map((option) => ({ ...option, reason: ai.reasons[option.id] || option.reason }));
      settlementResult = {
        ...fallback,
        title: ai.title || fallback.title,
        summary: ai.summary || fallback.summary,
        rank: ai.rank || fallback.rank,
        options: selected,
        hallRecord: {
          ...fallback.hallRecord,
          evaluationTitle: ai.rank || fallback.hallRecord.evaluationTitle,
        },
      };
    } catch (err: any) {
      console.error('settlement ai failed:', err?.message || err);
      settlementResult = { ...fallback, options: fallback.options.slice(0, Math.min(3, fallback.options.length)) };
    }

    return NextResponse.json({ success: true, settlementResult });
  } catch (err: any) {
    console.error('settlement error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to settle character' }, { status: 500 });
  }
}
