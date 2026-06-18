// POST /api/game/pet
// 灵宠管理：喂养 / 解雇 / 召唤（QA用，召唤一只测试灵宠）
// 请求体：{ characterId, action: 'feed' | 'dismiss' | 'summon', petId, itemId?, species?, rarity? }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import { dbToState, feedPet, dismissPet, createPet, addPet, stateToResponse } from '@/lib/xianxia/engine';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({
      characterId: z.string(),
      action: z.enum(['feed', 'dismiss', 'summon']),
      petId: z.string().optional(),
      itemId: z.string().optional(),
      species: z.string().optional(),
      rarity: z.string().optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }
    const { characterId, action, petId, itemId, species, rarity } = parsed.data;

    const char = await db.character.findUnique({ where: { id: characterId } });
    await clearAdvancePreload(characterId);
    if (!char) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });
    // 战斗中不可操作灵宠
    if (char.combatStateJson) {
      try {
        const cs = JSON.parse(char.combatStateJson);
        if (cs && cs.status === 'ongoing') {
          return NextResponse.json({ success: false, error: '战斗进行中，无法操作灵宠' }, { status: 400 });
        }
      } catch { /* ignore */ }
    }
    if (char.isAtChoice) {
      return NextResponse.json({ success: false, error: '当前有待选择，请先完成选择' }, { status: 400 });
    }

    let state = dbToState(char as any);

    if (action === 'feed') {
      if (!itemId || !petId) {
        return NextResponse.json({ success: false, error: '喂养需指定物品 id 与灵宠 id' }, { status: 400 });
      }
      const r = feedPet(state, petId, itemId);
      if (!r.ok) {
        return NextResponse.json({ success: false, error: r.error }, { status: 400 });
      }
      state = r.state;
      await db.character.update({
        where: { id: characterId },
        data: {
          inventoryJson: JSON.stringify(state.inventory || []),
          petsJson: JSON.stringify(state.pets || []),
        },
      });
      // 写事件日志（让史册可查）
      await db.eventLog.create({
        data: {
          characterId,
          age: state.age,
          title: `灵宠喂养·${r.pet?.name || ''}`,
          narrative: `${state.name}以物品喂养灵宠${r.pet?.name || ''}，灵宠饱食度与忠诚度提升。${r.pet?.level && r.pet.level > 1 ? `当前等级 ${r.pet.level}。` : ''}`,
          eventType: 'normal',
          effects: JSON.stringify([]),
        },
      });
      return NextResponse.json({
        success: true,
        pet: r.pet,
        state: stateToResponse(state),
      });
    } else if (action === 'dismiss') {
      const pet = (state.pets || []).find(p => p.id === petId);
      if (!pet) {
        return NextResponse.json({ success: false, error: '灵宠不存在' }, { status: 400 });
      }
      state = dismissPet(state, petId!);
      await db.character.update({
        where: { id: characterId },
        data: {
          petsJson: JSON.stringify(state.pets || []),
        },
      });
      await db.eventLog.create({
        data: {
          characterId,
          age: state.age,
          title: `灵宠放生·${pet.name}`,
          narrative: `${state.name}将灵宠${pet.name}放归山野，从此人宠两散。`,
          eventType: 'normal',
          effects: JSON.stringify([]),
        },
      });
      return NextResponse.json({
        success: true,
        state: stateToResponse(state),
      });
    } else if (action === 'summon') {
      // QA/调试用：直接召唤一只测试灵宠（玩家不可见，仅用于 QA 验证）
      const validSpecies = ['fox','wolf','snake','turtle','eagle','ape','spider','butterfly','fish','tiger','phoenix','dragon'] as const;
      const validRarities = ['common','uncommon','rare','epic','legendary','mythic'] as const;
      const sp = (validSpecies as readonly string[]).includes(species || '') ? species as any : 'fox';
      const ra = (validRarities as readonly string[]).includes(rarity || '') ? rarity as any : 'uncommon';
      const newPet = createPet(sp, ra, state.realm as any, '', '', `天道赐予（QA）`, state.age);
      state = addPet(state, newPet);
      await db.character.update({
        where: { id: characterId },
        data: {
          petsJson: JSON.stringify(state.pets || []),
        },
      });
      await db.eventLog.create({
        data: {
          characterId,
          age: state.age,
          title: `灵宠降临·${newPet.name}`,
          narrative: `天道降下一只${newPet.name}，与${state.name}结下契约。`,
          eventType: 'normal',
          effects: JSON.stringify([]),
        },
      });
      return NextResponse.json({
        success: true,
        pet: newPet,
        state: stateToResponse(state),
      });
    }

    return NextResponse.json({ success: false, error: '未知操作' }, { status: 400 });
  } catch (err: any) {
    console.error('pet action error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '灵宠操作失败' },
      { status: 500 }
    );
  }
}
