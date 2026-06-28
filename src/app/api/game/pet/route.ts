// @ts-nocheck - api route, types not critical

﻿// POST /api/game/pet
// 灵宠操作：喂养 / 放归 / 召唤，并写入隐藏审计。
// P1 step2: 收 where: { id, userId }（dev 模式 userId: undefined，Prisma 自动忽略 → 不破 dev/smoke）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import {
  addPet,
  buildStateContext,
  createPet,
  dbToState,
  dismissPet,
  feedPet,
  normalizeCultivationState,
  recordActionCausality,
  refreshWorldFacts,
  stateToResponse,
} from '@/lib/xianxia/engine';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { generatePetBond, generatePetCareOutcome } from '@/lib/xianxia/llm';
import { appendStateChangeAuditEffect, buildStateChangeLog } from '@/lib/xianxia/state-change-log';
import { appendEvent } from '@/lib/xianxia/events/store';
import type { AttributeChange, CharacterState, Pet, PetBondAIOutcome, PetCareAIOutcome } from '@/lib/xianxia/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 15;

function persistablePetStateData(state: ReturnType<typeof dbToState>) {
  return {
    age: state.age,
    lifespan: state.lifespan,
    realm: state.realm,
    realmLevel: state.realmLevel,
    cultivationExp: state.cultivationExp,
    expToBreak: state.expToBreak,
    elementMetal: state.elements.metal,
    elementWood: state.elements.wood,
    elementWater: state.elements.water,
    elementFire: state.elements.fire,
    elementEarth: state.elements.earth,
    hp: state.hp,
    maxHp: state.maxHp,
    mp: state.mp,
    maxMp: state.maxMp,
    attack: state.attack,
    defense: state.defense,
    speed: state.speed,
    luck: state.luck,
    comprehension: state.comprehension,
    spiritStones: state.spiritStones,
    reputation: state.reputation,
    alive: state.alive,
    ascended: state.ascended,
    causeOfDeath: state.causeOfDeath || '',
    faction: state.faction,
    master: state.master,
    location: state.location,
    fateNodes: state.fateNodes.join(','),
    isAtChoice: state.isAtChoice,
    lastEventAge: state.lastEventAge,
    statusJson: JSON.stringify(state.activeStatuses),
    inventoryJson: JSON.stringify(state.inventory || []),
    equippedJson: JSON.stringify(state.equipped || []),
    storageCapacity: state.storageCapacity ?? 5,
    cultivationMultiplier: state.cultivationMultiplier ?? 1.0,
    cultivationInsight: state.cultivationInsight || '',
    cultivationFactorsJson: JSON.stringify(state.cultivationFactors || []),
    memoryJson: JSON.stringify(state.longTermMemory || []),
    pendingThreadsJson: JSON.stringify(state.pendingThreads || []),
    characterIntentsJson: JSON.stringify(state.characterIntents || []),
    combatStateJson: state.combatSession ? JSON.stringify(state.combatSession) : '',
    npcsJson: JSON.stringify(state.npcs || []),
    causalGraphJson: JSON.stringify(state.causalGraph || { nodes: [], edges: [] }),
    worldFactsJson: JSON.stringify(state.worldFacts || []),
    heartDemon: state.heartDemon ?? 0,
    petsJson: JSON.stringify(state.pets || []),
    exploredRealmsJson: JSON.stringify(state.exploredRealms || []),
  };
}

function snapshotState(state: ReturnType<typeof dbToState>): CharacterState {
  return {
    ...state,
    inventory: [...(state.inventory || [])],
    equipped: [...(state.equipped || [])],
    activeStatuses: [...(state.activeStatuses || [])],
    pendingThreads: [...(state.pendingThreads || [])],
    worldFacts: [...(state.worldFacts || [])],
    pets: [...(state.pets || [])],
  };
}

function petDiffChanges(beforePet: Pet | undefined, afterPet: Pet | undefined, reason: string): AttributeChange[] {
  const changes: AttributeChange[] = [];
  if (!beforePet || !afterPet) return changes;
  const push = (attribute: string, beforeValue: number, afterValue: number) => {
    const delta = Number(afterValue || 0) - Number(beforeValue || 0);
    if (delta !== 0) changes.push({ attribute: `pet.${attribute}`, delta, reason });
  };
  push('satiety', beforePet.satiety, afterPet.satiety);
  push('loyalty', beforePet.loyalty, afterPet.loyalty);
  push('level', beforePet.level, afterPet.level);
  push('exp', beforePet.exp, afterPet.exp);
  push('attack', beforePet.attack, afterPet.attack);
  push('defense', beforePet.defense, afterPet.defense);
  push('maxHp', beforePet.maxHp, afterPet.maxHp);
  push('hp', beforePet.hp, afterPet.hp);
  return changes;
}

function eventAndResponseTitle(action: string, name: string) {
  if (action === 'feed') return { title: `灵宠·喂养${name}`, message: `${name}已得喂养` };
  if (action === 'dismiss') return { title: `灵宠·放归${name}`, message: `${name}已归山野` };
  return { title: `灵宠·结缘${name}`, message: `${name}已随行` };
}

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
      return NextResponse.json({ success: false, error: '参数有误' }, { status: 400 });
    }
    const { characterId, action, petId, itemId, species, rarity } = parsed.data;

    const isProdMode = !!process.env.ADMIN_TOKEN;
    let user: { id: string } | null = null;
    if (isProdMode) {
      user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const char = await db.character.findUnique({ where: { id: characterId, userId: user?.id } });
    await clearAdvancePreload(characterId);
    if (!char) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });
    if (char.combatStateJson) {
      try {
        const cs = JSON.parse(char.combatStateJson);
        if (cs && cs.status === 'ongoing') {
          return NextResponse.json({ success: false, error: '战斗尚未结束，无法照料灵宠' }, { status: 400 });
        }
      } catch { /* ignore */ }
    }
    if (char.isAtChoice) {
      return NextResponse.json({ success: false, error: '当前仍有抉择未定，请先作出选择' }, { status: 400 });
    }

    let state = dbToState(char as any);
    const before = snapshotState(state);
    const appliedChanges: AttributeChange[] = [];
    let pet: Pet | undefined;
    let narrative = '';
    let removedItemIds: string[] = [];

    if (action === 'feed') {
      if (!itemId || !petId) {
        return NextResponse.json({ success: false, error: '喂养需指定物品 id 与灵宠 id' }, { status: 400 });
      }
      const beforePet = state.pets.find(p => p.id === petId);
      const item = state.inventory.find(it => it.id === itemId);
      let aiCare: PetCareAIOutcome | null = null;
      if (beforePet && item) {
        try {
          const recentDb = await db.eventLog.findMany({ where: { characterId }, orderBy: { age: 'desc' }, take: 3 });
          const recent = recentDb.reverse().map(e => ({ age: e.age, title: e.title, narrative: e.narrative, eventType: e.eventType }));
          aiCare = await generatePetCareOutcome(buildStateContext(state, recent), beforePet, item);
        } catch (err: any) { console.error('pet care AI failed, fallback to rarity formula:', err?.message || err); }
      }
      const r = feedPet(state, petId, itemId, aiCare);
      if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400 });
      state = normalizeCultivationState(refreshWorldFacts(r.state, 'pet-feed'));
      pet = r.pet;
      removedItemIds = [itemId];
      appliedChanges.push({ attribute: 'inventory', delta: -1, reason: `喂养${pet?.name || '灵宠'}` } as any);
      appliedChanges.push(...petDiffChanges(beforePet, pet, `喂养${pet?.name || '灵宠'}`));
      narrative = `${state.name}以“${item?.name || '灵物'}”喂养${pet?.name || '灵宠'}，灵宠饱食之后亲近了几分。${pet?.level && beforePet && pet.level > beforePet.level ? `其气息更盛，已至 ${pet.level} 阶。` : ''}`;
    } else if (action === 'dismiss') {
      pet = (state.pets || []).find(p => p.id === petId);
      if (!pet) return NextResponse.json({ success: false, error: '灵宠不存在' }, { status: 400 });
      state = normalizeCultivationState(refreshWorldFacts(dismissPet(state, petId!), 'pet-dismiss'));
      appliedChanges.push({ attribute: 'pets', delta: -1, reason: `放归${pet.name}` } as any);
      narrative = `${state.name}将${pet.name}放归山野，自此各循其缘。`;
    } else if (action === 'summon') {
      const validSpecies = ['fox','wolf','snake','turtle','eagle','ape','spider','butterfly','fish','tiger','phoenix','dragon'] as const;
      const validRarities = ['common','uncommon','rare','epic','legendary','mythic'] as const;
      const sp = (validSpecies as readonly string[]).includes(species || '') ? species as any : 'fox';
      const ra = (validRarities as readonly string[]).includes(rarity || '') ? rarity as any : 'uncommon';
      let aiBond: PetBondAIOutcome | null = null;
      try {
        const recentDb = await db.eventLog.findMany({ where: { characterId }, orderBy: { age: 'desc' }, take: 3 });
        const recent = recentDb.reverse().map(e => ({ age: e.age, title: e.title, narrative: e.narrative, eventType: e.eventType }));
        aiBond = await generatePetBond(buildStateContext(state, recent), { species, rarity });
      } catch (err: any) { console.error('pet bond AI failed, fallback to species template:', err?.message || err); }
      const newPet = createPet(sp, ra, state.realm as any, aiBond?.name || '', aiBond?.description || '', aiBond?.sourceAcquired || '灵缘结契', state.age, aiBond?.skill, aiBond);
      state = normalizeCultivationState(refreshWorldFacts(addPet(state, newPet), 'pet-summon'));
      pet = newPet;
      appliedChanges.push({ attribute: 'pets', delta: 1, reason: `结缘${newPet.name}` } as any);
      narrative = aiBond?.narrative || `林间灵机微动，一只${newPet.name}循缘而至，与${state.name}结下同行之约。`;
    }

    state = recordActionCausality(state, {
      actionId: `pet_${action}_${state.age}_${pet?.id || petId || 'new'}`,
      actionType: 'pet',
      title: eventAndResponseTitle(action, pet?.name || '灵宠').title,
      summary: narrative,
      tags: ['pet', action],
      usedItems: action === 'feed' && itemId ? before.inventory.filter(item => item.id === itemId) : [],
      consumedItems: action === 'feed' && itemId ? before.inventory.filter(item => item.id === itemId) : [],
      pets: action === 'dismiss' ? [] : (pet ? [pet] : []),
      removedPets: action === 'dismiss' && pet ? [pet] : [],
    });

    const stateChangeLog = buildStateChangeLog({
      before,
      after: state,
      appliedChanges,
      rejectedChanges: [],
      contentRegistryTrace: [],
      effectResolveTrace: [],
      aiBoundaryTrace: [],
    });
    const displayEffects = buildEventDisplayEffects({ before, after: state, changes: appliedChanges, removedItemIds });
    const effectsWithAudit = appendStateChangeAuditEffect(displayEffects, stateChangeLog);
    const name = pet?.name || '灵宠';
    const titleMeta = eventAndResponseTitle(action, name);

    // Event Sourcing（PoC17）：pet 路由接 appendEvent。
    // 语义映射：
    //   summon → 结缘灵宠（state.pets 新增） → character.item.added（kind=pet）
    //   dismiss → 放归灵宠（state.pets 移除） → character.item.removed
    //   feed → 喂养消耗物品 → character.item.removed（消耗的物品 id）
    // appendEvent 失败用 try/catch 兜底——不能影响主流程。
    try {
      if (action === 'summon' && pet && pet.id) {
        await appendEvent({
          characterId,
          type: 'character.item.added',
          data: {
            type: 'character.item.added',
            itemId: pet.id,
            item: { kind: 'pet', ...pet },
          },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: state.age,
        });
      } else if (action === 'dismiss' && petId) {
        await appendEvent({
          characterId,
          type: 'character.item.removed',
          data: {
            type: 'character.item.removed',
            itemId: petId,
            reason: 'release-pet',
          },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: state.age,
        });
      } else if (action === 'feed' && itemId) {
        // 喂养消耗物品 → item.removed
        await appendEvent({
          characterId,
          type: 'character.item.removed',
          data: {
            type: 'character.item.removed',
            itemId,
            reason: 'feed-pet',
          },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: state.age,
        });
      }
    } catch (evtErr: any) {
      console.error('[pet] appendEvent failed (non-fatal):', evtErr?.message || evtErr);
    }

    await db.character.update({ where: { id: characterId, userId: user?.id }, data: persistablePetStateData(state) });

    await db.eventLog.create({
      data: {
        characterId,
        age: state.age,
        title: titleMeta.title,
        narrative,
        eventType: 'normal',
        effects: JSON.stringify(effectsWithAudit),
      },
    });

    return NextResponse.json({
      success: true,
      message: titleMeta.message,
      pet,
      stateChangeLog,
      state: stateToResponse(state),
    });
  } catch (err: any) {
    console.error('pet action error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '灵宠操作失败' },
      { status: 500 }
    );
  }
}
