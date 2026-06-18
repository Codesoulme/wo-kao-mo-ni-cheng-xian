// POST /api/game/alchemy
// 炼丹炉：消耗 2-3 个材料 + 灵石，有概率炼出丹药

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, alchemy, stateToResponse } from '@/lib/xianxia/engine';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    const materialIds: string[] | undefined = body?.materialIds;
    const spiritStoneCost: number | undefined = body?.spiritStoneCost;

    if (!characterId) {
      return NextResponse.json({ success: false, error: 'characterId 必填' }, { status: 400 });
    }
    if (!Array.isArray(materialIds) || materialIds.length < 2 || materialIds.length > 3) {
      return NextResponse.json({ success: false, error: '须选 2-3 件材料入炉' }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });
    if (char.isAtChoice) return NextResponse.json({ success: false, error: '当前有待选择，请先完成命节点抉择' }, { status: 400 });

    const state = dbToState(char as any);

    const cost = typeof spiritStoneCost === 'number' && spiritStoneCost > 0 ? spiritStoneCost : 10;
    const result = alchemy(state, materialIds, cost);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // 持久化
    const finalState = result.state;
    await db.character.update({
      where: { id: characterId },
      data: {
        spiritStones: finalState.spiritStones,
        inventoryJson: JSON.stringify(finalState.inventory),
      },
    });

    // 写入事件日志（炼丹也算一次事件，便于史册追溯）
    await db.eventLog.create({
      data: {
        characterId,
        age: finalState.age,
        title: result.success ? `炼丹·${result.product?.name || '成丹'}` : '炼丹·丹炉炸裂',
        narrative: result.narrative,
        eventType: 'alchemy',
        effects: JSON.stringify(result.success && result.product
          ? [{ attribute: 'inventory', delta: 1, reason: `得 ${result.product.name}` }]
          : [{ attribute: 'spiritStones', delta: -cost, reason: '炼丹消耗' }]),
      },
    });

    return NextResponse.json({
      success: true,
      alchemySuccess: result.success,
      narrative: result.narrative,
      product: result.product,
      consumedMaterials: result.consumedMaterials.map(m => ({ id: m.id, name: m.name })),
      spiritStoneCost: result.spiritStoneCost,
      successRate: Math.round(result.successRate),
      state: stateToResponse(finalState),
    });
  } catch (err: any) {
    console.error('alchemy error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to alchemy' },
      { status: 500 }
    );
  }
}
