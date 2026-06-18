// GET /api/game/state?characterId=xxx
// 获取当前角色完整状态 + 历史事件

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, computeEffectiveCultivationRate } from '@/lib/xianxia/engine';
import { REALMS, FATE_NODES, SPIRITUAL_ROOTS } from '@/lib/xianxia/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get('characterId');
    if (!characterId) {
      return NextResponse.json({ success: false, error: 'characterId required' }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });

    const events = await db.eventLog.findMany({
      where: { characterId },
      orderBy: { age: 'asc' },
    });
    const choices = await db.choiceLog.findMany({
      where: { characterId },
      orderBy: { age: 'asc' },
    });

    const state = dbToState(char as any);
    const realmInfo = REALMS.find(r => r.id === state.realm);
    const rootInfo = SPIRITUAL_ROOTS[state.spiritualRoot];
    const rate = computeEffectiveCultivationRate(state);

    // 解析 pendingChoice（若有）：让前端页面刷新后能恢复 ChoiceModal
    let pendingChoice: any = null;
    if (char.isAtChoice && char.pendingChoiceJson) {
      try {
        pendingChoice = JSON.parse(char.pendingChoiceJson);
      } catch { pendingChoice = null; }
    }

    return NextResponse.json({
      success: true,
      character: {
        id: char.id,
        name: char.name,
        gender: char.gender,
        age: char.age,
        lifespan: char.lifespan,
        spiritualRoot: char.spiritualRoot,
        rootDetail: char.rootDetail,
        rootMultiplier: rootInfo?.multiplier ?? 0,
        realm: char.realm,
        realmName: realmInfo?.name ?? '凡人',
        realmColor: realmInfo?.color ?? '#6b7280',
        realmLevel: char.realmLevel,
        realmMaxLevel: realmInfo?.levels ?? 0,
        cultivationExp: char.cultivationExp,
        expToBreak: char.expToBreak,
        elements: state.elements,
        hp: char.hp, maxHp: char.maxHp,
        mp: char.mp, maxMp: char.maxMp,
        attack: char.attack, defense: char.defense, speed: char.speed,
        luck: char.luck, comprehension: char.comprehension,
        spiritStones: char.spiritStones, reputation: char.reputation,
        alive: char.alive, ascended: char.ascended,
        causeOfDeath: char.causeOfDeath,
        faction: char.faction, master: char.master, location: char.location,
        fateNodes: state.fateNodes,
        isAtChoice: char.isAtChoice,
        activeStatuses: state.activeStatuses,
        inventory: state.inventory,
        equipped: state.equipped,
        storageCapacity: state.storageCapacity,
        cultivationMultiplier: rate.multiplier,
        cultivationFlatBonus: rate.flatBonus,
        cultivationInsight: state.cultivationInsight || '',
        cultivationFactors: state.cultivationFactors || [],
        // Task 20 新字段
        pendingThreads: state.pendingThreads || [],
        characterIntents: state.characterIntents || [],
        combatSession: state.combatSession || null,
      },
      pendingChoice,
      events: events.map(e => ({
        id: e.id,
        age: e.age,
        title: e.title,
        narrative: e.narrative,
        eventType: e.eventType,
        effects: JSON.parse(e.effects || '[]'),
        createdAt: e.createdAt,
      })),
      choices: choices.map(c => ({
        id: c.id,
        age: c.age,
        prompt: c.prompt,
        options: JSON.parse(c.options || '[]'),
        chosenIndex: c.chosenIndex,
        chosenText: c.chosenText,
        result: c.result,
      })),
      fateNodes: FATE_NODES.map(n => ({
        index: n.index,
        name: n.name,
        realm: n.realm,
        theme: n.theme,
        triggerAge: n.triggerAge,
        completed: state.fateNodes.includes(n.index),
      })),
    });
  } catch (err: any) {
    console.error('state error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to get state' },
      { status: 500 }
    );
  }
}
