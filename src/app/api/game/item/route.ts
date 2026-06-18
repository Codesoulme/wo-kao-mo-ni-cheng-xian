// POST /api/game/item
// 物品操作：装备(equip) / 卸下(unequip) / 使用(use)
// 装备/卸下/使用后调用 LLM 生成动作叙事 + 更新 cultivationInsight + cultivationFactors

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, equipItem, unequipItem, consumeItem, stateToResponse, buildStateContext, computeCultivationFactors } from '@/lib/xianxia/engine';
import { generateItemActionNarrative } from '@/lib/xianxia/llm';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({
      characterId: z.string(),
      action: z.enum(['equip', 'unequip', 'use']),
      itemId: z.string().optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }
    const { characterId, action, itemId } = parsed.data;

    const char = await db.character.findUnique({ where: { id: characterId } });
    if (!char) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });

    let state = dbToState(char as any);
    let result: { ok: boolean; error?: string; item?: any };
    let message = '';
    let appliedItem: any = null;

    if (action === 'equip') {
      if (!itemId) return NextResponse.json({ success: false, error: 'itemId 必填' }, { status: 400 });
      const r = equipItem(state, itemId);
      state = r.state; // 关键：equipItem 返回新 state，不修改入参
      result = r;
      message = r.ok ? '装备成功' : (r.error || '装备失败');
      appliedItem = r.item;
    } else if (action === 'unequip') {
      if (!itemId) return NextResponse.json({ success: false, error: 'itemId 必填' }, { status: 400 });
      const r = unequipItem(state, itemId);
      state = r.state; // 关键：unequipItem 返回新 state，不修改入参
      result = r;
      message = r.ok ? '卸下成功' : (r.error || '卸下失败');
      appliedItem = r.item;
    } else {
      // use
      if (!itemId) return NextResponse.json({ success: false, error: 'itemId 必填' }, { status: 400 });
      const r = consumeItem(state, itemId);
      state = r.state; // 关键：consumeItem 返回新 state，不修改入参
      result = r;
      message = r.ok ? '使用成功' : (r.error || '使用失败');
      appliedItem = r.item;
    }

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // 调用 LLM 生成动作叙事 + 更新 cultivationInsight + cultivationFactors
    // 让 AI 知道玩家装备/使用/卸下了什么，并据此修改相关文本
    let narrative = '';
    try {
      const recentEventsDb = await db.eventLog.findMany({
        where: { characterId },
        orderBy: { age: 'desc' },
        take: 3,
      });
      const recentEvents = recentEventsDb.reverse().map(e => ({
        age: e.age,
        title: e.title,
        narrative: e.narrative,
      }));
      const ctx = buildStateContext(state, recentEvents);
      const r = await generateItemActionNarrative(ctx, action, appliedItem);
      narrative = r.narrative;
      if (r.cultivationInsight && r.cultivationInsight.trim()) {
        state.cultivationInsight = r.cultivationInsight.trim();
      }
      // 引擎权威：cultivationFactors 由引擎计算（保证数值准确），AI 的额外因素合并
      const engineFactors = computeCultivationFactors(state);
      const engineNames = new Set(engineFactors.map(f => f.name));
      const aiExtras = (r.cultivationFactors || [])
        .filter(f => f && f.name && typeof f.value === 'number' && !engineNames.has(String(f.name)))
        .slice(0, 6);
      state.cultivationFactors = [...engineFactors, ...aiExtras];
    } catch (err: any) {
      // LLM 失败不阻塞物品操作，仅无叙事；factors 仍由引擎计算
      console.error('item action narrative failed:', err?.message || err);
      state.cultivationFactors = computeCultivationFactors(state);
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
        equippedJson: JSON.stringify(state.equipped || []),
        storageCapacity: state.storageCapacity ?? 5,
        cultivationMultiplier: state.cultivationMultiplier ?? 1.0,
        cultivationInsight: state.cultivationInsight || '',
        cultivationFactorsJson: JSON.stringify(state.cultivationFactors || []),
      },
    });

    // 物品操作也算一次小事件，写入事件日志（让史册可查）
    if (narrative) {
      try {
        await db.eventLog.create({
          data: {
            characterId,
            age: state.age,
            title: `${action === 'equip' ? '装备' : action === 'unequip' ? '卸下' : '使用'}·${(appliedItem?.name || '').slice(0, 8)}`,
            narrative,
            eventType: 'interference',
            effects: JSON.stringify([]),
          },
        });
      } catch {
        // 日志写入失败不影响主流程
      }
    }

    return NextResponse.json({
      success: true,
      message,
      narrative,
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
