// @ts-nocheck - api route, types not critical

// POST /api/game/new
// 创建新角色，AI 生成出生事件
// P1 step2: 创建新 character 时设 userId = user?.id（dev 模式 null 不破）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateBirthEvent, buildPreviousLifeBackground } from '@/lib/xianxia/llm';
import { rollBirthConstitution, heritageToStatus } from '@/lib/xianxia/constitutions';
import { formatWorldTimeDisplay, hiddenEventMeta, normalizeWorldCalendar, worldTimeStamp } from '@/lib/xianxia/world-time';
import { rollOrigin, type Ethnicity, type Lineage } from '@/lib/xianxia/origins';

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

    // 角色背景多样性：族裔 / 出身 / 伴生灵物 / 先天封印
    const origin = rollOrigin({
      ethnicity: (body?.ethnicity as Ethnicity) || undefined,
      lineage: (body?.lineage as Lineage) || undefined,
      companionItems: body?.companionItems !== false,
      sealedFate: body?.sealedFate !== false,
      previousLivesCount: typeof body?.previousLivesCount === 'number' ? body.previousLivesCount : 1,
    });

    const birth = await generateBirthEvent(customName, previousWorldLegacies, origin);

    // 双保险：即使 LLM 漏掉前世暗示，narrative 也至少拼一段前世背景兜底
    const previousLifeNarrative = buildPreviousLifeBackground(previousWorldLegacies);

    // 五行初始值由后端 roll（依据灵根类型），不再固定 20/20/20/20/20
    const el = birth.elements;

    const birthConstitution = rollBirthConstitution();
    const inheritedStatuses = selectedHeritage.map(heritageToStatus).filter(Boolean);
    const statusList = [birthConstitution, ...inheritedStatuses].filter(Boolean);

    // 伴生灵物 → 写入 inventory；先天封印/命格 → 写入 status
    const originItems = origin.companionItems.map((c, idx) => ({
      id: `item_origin_${Date.now().toString(36)}_${idx}`,
      name: c.name.slice(0, 16),
      description: `${c.description}（${c.origin}）`.slice(0, 120),
      item_type: c.category === 'sword_shard' ? 'weapon'
        : c.category === 'spirit_seal' ? 'artifact'
        : c.category === 'spirit_egg' ? 'accessory'
        : 'accessory',
      rarity: 'epic',
      effects: [{ target_attribute: 'luck', operation: 'add', value: 3, description: '伴生灵物之缘' }],
      source: '天生伴随',
      equipNote: '胎里带来',
    }));
    // 先天封印/命格 → 入 status（避免和 LLM 自报重复，去重同名）
    if (origin.sealedFate) {
      const sealedName = origin.sealedFate.name;
      const alreadyHasSealed = statusList.some((s: any) => s?.name === sealedName && s?.source === '先天封印');
      if (!alreadyHasSealed) {
        statusList.push({
          id: `status_sealed_${Date.now().toString(36)}`,
          name: sealedName,
          description: origin.sealedFate.description,
          category: 'special',
          rarity: 'legendary',
          duration: -1,
          source: '先天封印',
          effects: [{ target_attribute: 'comprehension', operation: 'add', value: 4, description: '命格暗伏' }],
        });
      }
    }
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
        inventoryJson: JSON.stringify([...inheritedItems, ...originItems]),
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

轮回余泽随身而来：${inheritedItems.map((i: any) => i.name).join('、')}。` : ''}${originItems.length ? `

伴生灵物随胎而至：${originItems.map((i: any) => i.name).join('、')}。` : ''}${origin.sealedFate ? `

先天封印暗伏：${origin.sealedFate.name}，${origin.sealedFate.unlockHint}` : ''}${inheritedPets.length ? `

尚有灵宠因果相随：${inheritedPets.map((p: any) => p.name).join('、')}。` : ''}${previousLifeNarrative ? `

前世因果暗合：${previousLifeNarrative}` : ''}`,
        eventType: 'normal',
        effects: JSON.stringify([hiddenEventMeta({ worldTime, actionProjections: [] })]),
      },
    });

    return NextResponse.json({
      success: true,
      characterId: character.id,
      name: character.name,
      birth,
      origin,
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
