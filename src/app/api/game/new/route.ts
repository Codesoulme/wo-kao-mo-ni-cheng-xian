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
import { computeBodyBaseline } from '@/lib/xianxia/body-growth';
import { getChronicle, saveChronicle } from '@/lib/xianxia/world-chronicle-store';
import { ensureChronicleCoverage } from '@/lib/xianxia/world-chronicle-generator';
import { getFolkloreContext } from '@/lib/xianxia/world-chronicle-tick';

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

    // ─────────────────────────────────────────────
    // 世界大事年表：出生时确保未来 500 年已排定
    // ─────────────────────────────────────────────
    let folklore: { past: any[]; nowActive: any[]; upcoming: any[] } = { past: [], nowActive: [], upcoming: [] };
    try {
      // chronicle 尚未与 worldCalendar 对齐时，用 worldCalendar 的 currentYear 起手
      const preChron = await getChronicle();
      const currentYear = Math.max(preChron.currentYear || 0, worldCalendar.calendarYear || 5000);
      if (preChron.currentYear !== currentYear || preChron.eraName !== worldCalendar.eraName) {
        await saveChronicle({ currentYear, eraName: worldCalendar.eraName });
      }
      const targetYear = Math.max(preChron.generatedUntilYear, currentYear + 500);
      await ensureChronicleCoverage(targetYear, `pending-${Date.now()}`);
      const c2 = await getChronicle();
      folklore = getFolkloreContext(c2, currentYear, 300, 30);
    } catch (e) {
      console.warn('[new/route] chronicle ensure failed (non-fatal):', (e as any)?.message || e);
    }

    const birth = await generateBirthEvent(customName, previousWorldLegacies, origin, {
      eraName: worldCalendar.eraName,
      calendarYear: worldCalendar.calendarYear,
      worldRecentHistory: folklore.past.map((e: any) => ({
        scheduledYear: e.scheduledYear,
        actualEndYear: e.actualEndYear,
        type: e.type,
        narrativeSeed: e.narrativeSeed,
      })),
      worldNowActive: folklore.nowActive.map((e: any) => ({
        scheduledYear: e.scheduledYear,
        actualStartYear: e.actualStartYear,
        type: e.type,
        narrativeSeed: e.narrativeSeed,
      })),
    });

    // 双保险：即使 LLM 漏掉前世暗示，narrative 也至少拼一段前世背景兜底
    const previousLifeNarrative = buildPreviousLifeBackground(previousWorldLegacies);

    // 五行初始值由后端 roll（依据灵根类型），不再固定 20/20/20/20/20
    const el = birth.elements;

    const birthConstitution = rollBirthConstitution();
    const inheritedStatuses = selectedHeritage.map(heritageToStatus).filter(Boolean);
    // 沉浸版 Phase-Release: fate 类传承（命格）之前无处安放——补入 status
    // 之前 kind='fate' 不匹配 heritageToStatus(仅收 constitution)、也不匹配 inheritedItems(白名单里没有)、更不是 pet，
    // 导致玩家在传承池选了命格却在开档角色状态里完全丢失。
    const inheritedFates = selectedHeritage
      .filter((h: any) => h?.kind === 'fate')
      .map((h: any, idx: number) => ({
        id: `status_fate_${Date.now().toString(36)}_${idx}`,
        name: String(h.name || h.payload?.name || '轮回命格').slice(0, 16),
        description: String(h.description || h.payload?.description || '轮回中带来的命格。').slice(0, 160),
        category: 'special' as const,
        rarity: ['common','uncommon','rare','epic','legendary','mythic'].includes(h.rarity) ? h.rarity : 'rare',
        duration: -1,
        source: '轮回带入',
        effects: Array.isArray(h.payload?.effects) ? h.payload.effects : [{ target_attribute: 'luck', operation: 'add', value: 2, description: '前世余泽' }],
      }));
    const statusList = [birthConstitution, ...inheritedStatuses, ...inheritedFates].filter(Boolean);

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
    // 沉浸版 Phase-Release: SKIP_AUTH=1 时无条件按 dev 模式走，不查 user（单机开发/测试模式）
    const skipAuth = process.env.SKIP_AUTH === '1';
    const isProdMode = !skipAuth && !!process.env.ADMIN_TOKEN;
    let user: { id: string } | null = null;
    if (isProdMode) {
      user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    // 出生属性：按 age=0 的 body-growth 曲线算（考虑族裔/出身差异）
    // 之前是固定 hp:100/attack:10/defense:5/speed:10 — 婴儿一出生就顶着成年数据、没有从小长大体验
    // 现在婴儿是真的婴儿（attack≈1、defense≈1、speed≈1、maxHp≈10-15），随年龄推进由 body-growth 逐年长
    const birthBody = computeBodyBaseline(0, 'mortal', origin.ethnicity as any, origin.lineage as any);
    // mp/maxMp 也按 0 岁婴儿算：50 是成年凡人值，0 岁 factor 0.05 → 保底 5
    const birthMp = Math.max(5, Math.round(50 * 0.05));

    // 2026-07-08 修复：传承池带入的 effects 之前只挂在 status 上，玩家点开状态才能看到影响，
    //   基线值（luck/comprehension/attack/…）却是 route 里重 roll 的固定随机，
    //   导致玩家选了「luck+2 命格」但角色开局 luck 面板值毫无变化——像"传承没生效"。
    //   这里在写库前，把所有传承/命格/伴生灵物 status 的 `add` 类型效果并进基线值。
    //   multiply/cultivationExp 类不并（那是修炼倍率，走 factors 通道，别的位置计算）。
    const BASELINE_ADD_TARGETS = new Set<string>([
      'luck', 'comprehension', 'attack', 'defense', 'speed',
      'maxHp', 'maxMp', 'reputation', 'spiritStones',
      'elementMetal', 'elementWood', 'elementWater', 'elementFire', 'elementEarth',
      'heartDemon',
    ]);
    const baselineDelta: Record<string, number> = {};
    const collectEffects = (effects: any[] | undefined) => {
      if (!Array.isArray(effects)) return;
      for (const eff of effects) {
        if (!eff || typeof eff !== 'object') continue;
        if (eff.operation !== 'add') continue;
        const attr = String(eff.target_attribute || '');
        if (!BASELINE_ADD_TARGETS.has(attr)) continue;
        const val = Number(eff.value);
        if (!Number.isFinite(val)) continue;
        baselineDelta[attr] = (baselineDelta[attr] || 0) + val;
      }
    };
    for (const s of statusList) collectEffects((s as any)?.effects);
    for (const it of [...inheritedItems, ...originItems]) collectEffects((it as any)?.effects);

    // luck / comprehension 是 route 里 roll 的随机值，先保存基线再叠加
    const baseLuck = Math.floor(40 + Math.random() * 40);
    const baseComp = Math.floor(40 + Math.random() * 40);
    const finalLuck = baseLuck + (baselineDelta.luck || 0);
    const finalComp = baseComp + (baselineDelta.comprehension || 0);
    const finalMaxHp = birthBody.maxHp + (baselineDelta.maxHp || 0);
    const finalMaxMp = birthMp + (baselineDelta.maxMp || 0);
    const finalAttack = birthBody.attack + (baselineDelta.attack || 0);
    const finalDefense = birthBody.defense + (baselineDelta.defense || 0);
    const finalSpeed = birthBody.speed + (baselineDelta.speed || 0);
    const finalReputation = 0 + (baselineDelta.reputation || 0);
    const finalSpiritStones = 0 + (baselineDelta.spiritStones || 0);
    const finalHeartDemon = 0 + (baselineDelta.heartDemon || 0);
    const finalElements = {
      metal: el.metal + (baselineDelta.elementMetal || 0),
      wood: el.wood + (baselineDelta.elementWood || 0),
      water: el.water + (baselineDelta.elementWater || 0),
      fire: el.fire + (baselineDelta.elementFire || 0),
      earth: el.earth + (baselineDelta.elementEarth || 0),
    };

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
        elementMetal: finalElements.metal,
        elementWood: finalElements.wood,
        elementWater: finalElements.water,
        elementFire: finalElements.fire,
        elementEarth: finalElements.earth,
        hp: finalMaxHp,
        maxHp: finalMaxHp,
        mp: finalMaxMp,
        maxMp: finalMaxMp,
        attack: finalAttack,
        defense: finalDefense,
        speed: finalSpeed,
        luck: finalLuck,
        comprehension: finalComp,
        spiritStones: finalSpiritStones,
        reputation: finalReputation,
        heartDemon: finalHeartDemon,
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
        originJson: JSON.stringify({ ethnicity: origin.ethnicity, lineage: origin.lineage }),
      },
    });

    // 写入出生事件
    // 沉浸版 Phase-Release: narrative 只保留 AI 写的自然叙事，不再暴露后台"命数/轮回余泽/伴生/封印/前世因果"的元描述
    //   —— 这些数据都在角色状态里（statusList / inventory / sealedFate 已入 status / pet），
    //   玩家从属性弹窗、物品栏、状态标签就能看到；出生正文没必要罗列。
    //   AI 的 birth.background 已经按 origin/legacy 生成了带暗示的叙事，直接用就行。
    const event = await db.eventLog.create({
      data: {
        characterId: character.id,
        age: 0,
        title: '降生于世',
        narrative: birth.background,
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
