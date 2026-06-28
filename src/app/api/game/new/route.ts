// POST /api/game/new
// 创建新角色，AI 生成出生事件
// P1 step2: 创建新 character 时设 userId = user?.id（dev 模式 null 不破）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateBirthEvent } from '@/lib/xianxia/llm';
import { rollBirthConstitution, heritageToStatus } from '@/lib/xianxia/constitutions';
import { formatWorldTimeDisplay, hiddenEventMeta, normalizeWorldCalendar, worldTimeStamp } from '@/lib/xianxia/world-time';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const customName: string | undefined = body?.name ? String(body.name).slice(0, 12) : undefined;
    const rawHeritage = Array.isArray(body?.heritage)
      ? body.heritage
      : Array.isArray(body?.selectedHeritage)
        ? body.selectedHeritage
        : body?.selectedHeritage && typeof body.selectedHeritage === 'object'
          ? Object.values(body.selectedHeritage).flat()
          : [];
    const selectedHeritage = rawHeritage.slice(0, 6).map((h: any) => ({ ...h, kind: h?.type || h?.category, payload: h?.payload || h }));
    const worldCalendar = normalizeWorldCalendar(body?.worldCalendar);
    const worldTimeBase = worldTimeStamp(worldCalendar, '\u964d\u751f\u65f6');
    const worldTime = { ...worldTimeBase, displayLabel: formatWorldTimeDisplay({ age: 0, worldTime: worldTimeBase, includeAge: true }) };
    const previousWorldLegacies = Array.isArray(body?.previousWorldLegacies) ? body.previousWorldLegacies.slice(0, 6) : [];

    const birth = await generateBirthEvent(customName);

    // 五行初始值由后端 roll（依据灵根类型），不再固定 20/20/20/20/20
    const el = birth.elements;

    const birthConstitution = rollBirthConstitution();
    const inheritedStatuses = selectedHeritage.map(heritageToStatus).filter(Boolean);
    const statusList = [birthConstitution, ...inheritedStatuses].filter(Boolean);
    const inheritedItems = selectedHeritage.filter((h: any) => h && ['scripture','artifact','item','weapon','armor','accessory','treasure'].includes(h.kind)).map((h: any, idx: number) => ({
      id: `item_herit_${Date.now().toString(36)}_${idx}`,
      name: String(h.name || '轮回遗物').slice(0, 16),
      description: String(h.description || h.payload?.description || '上一世因果带入此生之物。').slice(0, 120),
      item_type: h.kind === 'scripture' ? 'scripture' : h.kind === 'artifact' ? 'artifact' : (h.payload?.item_type || 'accessory'),
      rarity: ['common','uncommon','rare','epic','legendary','mythic'].includes(h.rarity) ? h.rarity : 'rare',
      effects: Array.isArray(h.payload?.effects) ? h.payload.effects : [{ target_attribute: 'luck', operation: 'add', value: 2, description: '轮回余泽' }],
      source: '轮回带入',
      equipNote: h.kind === 'scripture' ? '识海传承' : '天生伴随',
    }));

    const inheritedPets = selectedHeritage.filter((h: any) => h?.kind === 'pet').map((h: any, idx: number) => ({
      id: `pet_herit_${Date.now().toString(36)}_${idx}`,
      name: String(h.name || '伴生灵宠').slice(0, 16),
      species: h.payload?.species || h.species || 'fox',
      description: String(h.description || h.payload?.description || '随轮回因果而来的灵宠。').slice(0, 120),
      rarity: ['common','uncommon','rare','epic','legendary','mythic'].includes(h.rarity) ? h.rarity : 'rare',
      realm: 'mortal', hp: 45, maxHp: 45, attack: 8, defense: 4, speed: 12,
      element: h.payload?.element || h.element || 'wood', loyalty: 75, satiety: 80, level: 1, exp: 0, expToLevel: 100,
      sourceAcquired: '轮回带入', acquiredAge: 0,
      skill: { name: '护主', description: '危急时护持主人', power: 1.1, cooldown: 3 },
    }));

    // P1 step2: 创建角色时绑定当前 user（dev 模式 user=null → userId 写入 null）
    const isProdMode = !!process.env.ADMIN_TOKEN;
    let user: { id: string } | null = null;
    if (isProdMode) {
      user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const character = await db.character.create({
      data: {
        userId: user?.id ?? null,
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
        statusJson: JSON.stringify(statusList),
        inventoryJson: JSON.stringify(inheritedItems),
        memoryJson: JSON.stringify([`${birth.name}降生于${birth.birthplace}，${birth.family}。${birth.rootDetail}。${statusList.length ? `天生或轮回带有${statusList.map((s: any) => s.name).join('、')}。` : ''}`]),
        petsJson: JSON.stringify(inheritedPets),
        worldCalendarJson: JSON.stringify(normalizeWorldCalendar(worldCalendar)),
      },
    });

    // 写入出生事件
    const event = await db.eventLog.create({
      data: {
        characterId: character.id,
        age: 0,
        title: '降生于世',
        narrative: `${birth.background}${statusList.length ? `

此生命数另有异处：${statusList.map((s: any) => `${s.name}，${s.description}`).join('；')}。` : ''}${inheritedItems.length ? `

轮回余泽随身而来：${inheritedItems.map((i: any) => i.name).join('、')}。` : ''}${inheritedPets.length ? `

尚有灵宠因果相随：${inheritedPets.map((p: any) => p.name).join('、')}。` : ''}`,
        eventType: 'normal',
        effects: JSON.stringify([hiddenEventMeta({ worldTime, actionProjections: [] })]),
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
        worldTime,
        actionProjections: [],
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
