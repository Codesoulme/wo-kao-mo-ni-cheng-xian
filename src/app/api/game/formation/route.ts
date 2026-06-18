// POST /api/game/formation
// body: { characterId, action: 'activate' | 'deactivate' | 'list', diskItemId?, formationId? }
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import { dbToState, activateFormation, deactivateFormation, stateToResponse } from '@/lib/xianxia/engine';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId = body?.characterId;
    const action = body?.action;
    const diskItemId = body?.diskItemId;
    const formationId = body?.formationId;

    if (!characterId || !action) {
      return NextResponse.json({ success: false, error: 'characterId 和 action 必填' }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    await clearAdvancePreload(characterId);
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });

    let state = dbToState(char as any);

    if (action === 'list') {
      // 返回玩家背包中的阵盘物品 + 已激活的阵法
      const disks = state.inventory.filter(it =>
        it.item_type === 'tool' &&
        (it.effects || []).some(e => e.target_attribute === 'formationType')
      );
      const activeFormations = state.activeStatuses.filter(s => s.name.startsWith('[阵法]'));
      return NextResponse.json({
        success: true,
        disks,
        activeFormations: activeFormations.map(s => ({
          id: s.id,
          name: s.name.replace('[阵法]', ''),
          description: s.description,
          rarity: s.rarity,
          effects: s.effects,
        })),
      });
    }

    if (action === 'activate') {
      if (!diskItemId) return NextResponse.json({ success: false, error: 'diskItemId 必填' }, { status: 400 });
      const result = activateFormation(state, diskItemId);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      state = result.state;
      await db.character.update({
        where: { id: characterId },
        data: {
          statusJson: JSON.stringify(state.activeStatuses),
          attack: state.attack, defense: state.defense, speed: state.speed,
          luck: state.luck, comprehension: state.comprehension,
          elementMetal: state.elements.metal, elementWood: state.elements.wood,
          elementWater: state.elements.water, elementFire: state.elements.fire,
          elementEarth: state.elements.earth,
          cultivationMultiplier: state.cultivationMultiplier,
        },
      });
      return NextResponse.json({
        success: true,
        message: `激活阵法：${result.formation?.name}`,
        formation: result.formation,
        state: stateToResponse(state),
      });
    }

    if (action === 'deactivate') {
      if (!formationId) return NextResponse.json({ success: false, error: 'formationId 必填' }, { status: 400 });
      const result = deactivateFormation(state, formationId);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      state = result.state;
      await db.character.update({
        where: { id: characterId },
        data: {
          statusJson: JSON.stringify(state.activeStatuses),
          attack: state.attack, defense: state.defense, speed: state.speed,
          luck: state.luck, comprehension: state.comprehension,
          elementMetal: state.elements.metal, elementWood: state.elements.wood,
          elementWater: state.elements.water, elementFire: state.elements.fire,
          elementEarth: state.elements.earth,
          cultivationMultiplier: state.cultivationMultiplier,
        },
      });
      return NextResponse.json({
        success: true,
        message: `阵法已关闭`,
        state: stateToResponse(state),
      });
    }

    return NextResponse.json({ success: false, error: '无效的 action' }, { status: 400 });
  } catch (err: any) {
    console.error('formation error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process formation action' },
      { status: 500 }
    );
  }
}
