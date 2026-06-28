// @ts-nocheck - api route, types not critical

// GET /api/game/state?characterId=xxx
// 获取当前角色完整状态 + 历史事件

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dbToState, computeEffectiveCultivationRate, stateToResponse } from '@/lib/xianxia/engine';
import { FATE_NODES, SPIRITUAL_ROOTS } from '@/lib/xianxia/types';
import { extractEventMeta, normalizeWorldCalendar } from '@/lib/xianxia/world-time';
import { getCurrentUser } from '@/lib/auth-helpers';

// P1 step2 worker A: 生产模式下强制 userId 检查；dev 模式（ADMIN_TOKEN 未设 / SKIP_AUTH=1）保持原行为，
// 以避免破坏现有 446 smoke。Worker S2 负责收剩余 12 类 route。

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // 生产模式（ADMIN_TOKEN 已设）→ 必须登录 + 收窄 where
    // dev 模式（ADMIN_TOKEN 未设 / SKIP_AUTH=1）→ 跳过 userId check，保留旧行为
    const isProdMode = !!process.env.ADMIN_TOKEN;
    let user: { id: string } | null = null;
    if (isProdMode) {
      user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get('characterId');
    if (!characterId) {
      return NextResponse.json({ success: false, error: 'characterId required' }, { status: 400 });
    }

    const char = await db.character.findUnique({
      where: isProdMode ? { id: characterId, userId: user!.id } : { id: characterId },
    });
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
    const responseState = stateToResponse(state);
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
        realm: responseState.realm,
        realmName: responseState.realmName,
        realmColor: responseState.realmColor,
        realmLevel: responseState.realmLevel,
        realmMaxLevel: responseState.realmMaxLevel,
        realmProfile: responseState.realmProfile,
        spiritualSense: responseState.spiritualSense,
        soulStrength: responseState.soulStrength,
        physicalFoundation: responseState.physicalFoundation,
        soulRealmName: responseState.soulRealmName,
        soulRealmRank: responseState.soulRealmRank,
        soulRealmGap: responseState.soulRealmGap,
        realmTraits: responseState.realmTraits,
        combatProjection: responseState.combatProjection,
        cultivationAttributes: responseState.cultivationAttributes || [],
        cultivationExp: responseState.cultivationExp,
        expToBreak: responseState.expToBreak,
        elements: state.elements,
        hp: char.hp, maxHp: char.maxHp,
        mp: char.mp, maxMp: char.maxMp,
        attack: char.attack, defense: char.defense, speed: char.speed,
        luck: char.luck, comprehension: char.comprehension,
        spiritStones: char.spiritStones, reputation: char.reputation,
        alive: char.alive, ascended: char.ascended,
        causeOfDeath: char.causeOfDeath || '',
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
        questEntries: responseState.questEntries || [],
        characterIntents: state.characterIntents || [],
        combatSession: state.combatSession || null,
        // World continuity internals
        npcs: responseState.npcs || [],
        causalGraph: responseState.causalGraph || { nodes: [], edges: [] },
        worldFacts: responseState.worldFacts || [],
        // Task 22: 心魔值
        heartDemon: state.heartDemon ?? 0,
        // Task 23: 灵宠
        pets: state.pets || [],
        // Task 24: 已探秘境记录
        exploredRealms: state.exploredRealms || [],
        // 世界历
        worldCalendar: normalizeWorldCalendar(char.worldCalendarJson ? JSON.parse(char.worldCalendarJson) : undefined),
      },
      pendingChoice,
      events: events.map(e => ({
        id: e.id,
        age: e.age,
        title: e.title,
        narrative: e.narrative,
        eventType: e.eventType,
        effects: JSON.parse(e.effects || '[]'),
        ...extractEventMeta(JSON.parse(e.effects || '[]')),
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
