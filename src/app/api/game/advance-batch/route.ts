import { NextRequest, NextResponse } from 'next/server';
import { POST as advanceOne } from '../advance/route';

export const runtime = 'nodejs';
export const maxDuration = 60;

function makeAdvanceRequest(characterId: string, qualityMode: 'full' | 'light', worldCalendar?: any, previousWorldLegacies?: any[]) {
  return new Request('http://localhost/api/game/advance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ characterId, qualityMode, skipPreload: true, worldCalendar, previousWorldLegacies }),
  }) as NextRequest;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    let worldCalendar = body?.worldCalendar;
    const previousWorldLegacies = Array.isArray(body?.previousWorldLegacies) ? body.previousWorldLegacies.slice(0, 8) : [];
    const requested = Number(body?.years || body?.count || 1);
    const years = Math.max(1, Math.min(10, Number.isFinite(requested) ? Math.floor(requested) : 1));
    if (!characterId) return NextResponse.json({ success: false, error: 'characterId required' }, { status: 400 });

    const steps: any[] = [];
    let finalStep: any = null;
    let stoppedReason: string | null = null;

    for (let i = 0; i < years; i++) {
      const qualityMode: 'full' | 'light' = i === 0 ? 'full' : 'light';
      const res = await advanceOne(makeAdvanceRequest(characterId, qualityMode, worldCalendar, previousWorldLegacies));
      const data = await res.json();
      if (!data.success) {
        stoppedReason = data.error || '推进中断';
        if (steps.length === 0) {
          return NextResponse.json({ success: false, error: stoppedReason }, { status: res.status || 400 });
        }
        break;
      }

      steps.push(data);
      finalStep = data;
      if (data.worldCalendar) worldCalendar = data.worldCalendar;

      if (data.hasChoice) { stoppedReason = 'choice'; break; }
      if (data.triggeredCombat) { stoppedReason = 'combat'; break; }
      if (data.died) { stoppedReason = 'death'; break; }
      if (data.ascended) { stoppedReason = 'ascension'; break; }
    }

    return NextResponse.json({
      success: true,
      count: steps.length,
      requested: years,
      stoppedReason,
      steps,
      event: finalStep?.event,
      events: steps.flatMap(step => Array.isArray(step.events) && step.events.length ? step.events : (step.event ? [step.event] : [])),
      changes: finalStep?.changes || [],
      rejectedChanges: finalStep?.rejectedChanges || [],
      breakthrough: finalStep?.breakthrough || null,
      timeAdvance: finalStep?.timeAdvance || null,
      worldCalendar: finalStep?.worldCalendar || worldCalendar,
      worldTime: finalStep?.worldTime || null,
      actionProjections: finalStep?.actionProjections || [],
      hasChoice: Boolean(finalStep?.hasChoice),
      choice: finalStep?.choice || null,
      died: Boolean(finalStep?.died),
      deathReason: finalStep?.deathReason,
      ascended: Boolean(finalStep?.ascended),
      triggeredCombat: Boolean(finalStep?.triggeredCombat),
      state: finalStep?.state,
    });
  } catch (err: any) {
    console.error('advance batch error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to advance batch' }, { status: 500 });
  }
}
