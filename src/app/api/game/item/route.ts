// POST /api/game/item
// 物品操作：装备(equip) / 卸下(unequip) / 使用(use)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, equipItem, unequipSlot, consumeItem, stateToResponse } from '@/lib/xianxia/engine';
import { EquipSlot } from '@/lib/xianxia/types';
import { z } from 'zod';

export const runtime = 'nodejs';

const SLOTS: EquipSlot[] = ['weapon', 'armor', 'accessory', 'artifact', 'scripture'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({
      characterId: z.string(),
      action: z.enum(['equip', 'unequip', 'use']),
      itemId: z.string().optional(),
      slot: z.string().optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }
    const { characterId, action, itemId, slot } = parsed.data;

    const char = await db.character.findUnique({ where: { id: characterId } });
    if (!char) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });

    const state = dbToState(char as any);
    let result: { ok: boolean; error?: string };
    let message = '';

    if (action === 'equip') {
      if (!itemId) return NextResponse.json({ success: false, error: 'itemId 必填' }, { status: 400 });
      const r = equipItem(state, itemId);
      result = r;
      message = r.ok ? '装备成功' : (r.error || '装备失败');
    } else if (action === 'unequip') {
      if (!slot || !SLOTS.includes(slot as EquipSlot)) {
        return NextResponse.json({ success: false, error: 'slot 无效' }, { status: 400 });
      }
      const r = unequipSlot(state, slot as EquipSlot);
      result = r;
      message = r.ok ? '卸下成功' : (r.error || '卸下失败');
    } else {
      // use
      if (!itemId) return NextResponse.json({ success: false, error: 'itemId 必填' }, { status: 400 });
      const r = consumeItem(state, itemId);
      result = r;
      message = r.ok ? '使用成功' : (r.error || '使用失败');
    }

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // 持久化
    await db.character.update({
      where: { id: characterId },
      data: {
        hp: state.hp, maxHp: state.maxHp,
        mp: state.mp, maxMp: state.maxMp,
        attack: state.attack, defense: state.defense, speed: state.speed,
        luck: state.luck, comprehension: state.comprehension,
        spiritStones: state.spiritStones, reputation: state.reputation,
        inventoryJson: JSON.stringify(state.inventory),
        equippedJson: JSON.stringify(state.equipped || {}),
        cultivationMultiplier: state.cultivationMultiplier ?? 1.0,
      },
    });

    return NextResponse.json({
      success: true,
      message,
      state: stateToResponse(state),
    });
  } catch (err: any) {
    console.error('item action error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '操作失败' },
      { status: 500 }
    );
  }
}
