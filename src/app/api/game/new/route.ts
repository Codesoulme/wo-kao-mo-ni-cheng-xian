// POST /api/game/new
// 创建新角色，AI 生成出生事件

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateBirthEvent } from '@/lib/xianxia/llm';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const customName: string | undefined = body?.name ? String(body.name).slice(0, 12) : undefined;

    const birth = await generateBirthEvent(customName);

    // 五行初始值由后端 roll（依据灵根类型），不再固定 20/20/20/20/20
    const el = birth.elements;

    // 创建角色
    const character = await db.character.create({
      data: {
        name: birth.name,
        gender: birth.gender,
        age: 0,
        lifespan: 80,
        spiritualRoot: birth.spiritualRoot,
        rootDetail: birth.rootDetail,
        realm: 'mortal',
        realmLevel: 0,
        cultivationExp: 0,
        expToBreak: 100,
        elementMetal: el.metal,
        elementWood: el.wood,
        elementWater: el.water,
        elementFire: el.fire,
        elementEarth: el.earth,
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        attack: 10,
        defense: 5,
        speed: 10,
        luck: Math.floor(40 + Math.random() * 40),
        comprehension: Math.floor(40 + Math.random() * 40),
        spiritStones: 0,
        reputation: 0,
        alive: true,
        ascended: false,
        causeOfDeath: '',
        faction: '',
        master: '',
        location: birth.birthplace,
        fateNodes: '',
        isAtChoice: false,
        lastEventAge: 0,
        statusJson: JSON.stringify([]),
        inventoryJson: JSON.stringify([]),
        memoryJson: JSON.stringify([`${birth.name}降生于${birth.birthplace}，${birth.family}。${birth.rootDetail}。`]),
      },
    });

    // 写入出生事件
    const event = await db.eventLog.create({
      data: {
        characterId: character.id,
        age: 0,
        title: '降生于世',
        narrative: birth.background,
        eventType: 'normal',
        effects: JSON.stringify([]),
      },
    });

    return NextResponse.json({
      success: true,
      characterId: character.id,
      name: character.name,
      birth,
      event: {
        age: 0,
        title: event.title,
        narrative: event.narrative,
        eventType: event.eventType,
      },
    });
  } catch (err: any) {
    console.error('new game error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create new game' },
      { status: 500 }
    );
  }
}
