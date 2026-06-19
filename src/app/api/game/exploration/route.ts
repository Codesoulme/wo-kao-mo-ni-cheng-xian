// POST /api/game/exploration
// 秘境探索系统：玩家主动选择秘境探索，触发独特事件链
// 请求体：{ characterId, action: 'start', realmId }
// 流程：
//   1. canExploreRealm 校验（境界/年龄/灵石/冷却/战斗/选择）
//   2. startExploration 扣灵石 + 标记 _currentExploration
//   3. buildStateContext 透传 _currentExploration 给 LLM
//   4. generateAgeEvent 生成秘境探索事件（不推进年龄）
//   5. executeAIEvent 应用 AI 输出
//   6. recordExploration 写入探索记录 + 清除 _currentExploration
//   7. 持久化 + 写 EventLog

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import {
  dbToState,
  buildStateContext,
  executeAIEvent,
  stateToResponse,
  canExploreRealm,
  startExploration,
  recordExploration,
} from '@/lib/xianxia/engine';
import { generateAgeEvent } from '@/lib/xianxia/llm';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { appendStateChangeAuditEffect } from '@/lib/xianxia/state-change-log';
import type { SecretRealm } from '@/lib/xianxia/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

function buildFallbackExplorationEvent(state: any, realm: SecretRealm, ctx: any, error?: any) {
  const hints = realm.encounterHints || [];
  const hint = hints[(state.age + realm.id.length) % Math.max(1, hints.length)] || '秘境气机变化';
  const danger = realm.dangerLevel >= 7;
  const gain = Math.max(6, Math.round(10 * realm.rewardMultiplier + state.comprehension * 0.12));
  const mpCost = Math.min(state.mp || 0, danger ? 10 : 5);
  const luckGain = realm.themeTags?.some((t: string) => ['treasure', 'inheritance', 'spiritual_energy'].includes(t)) ? 1 : 0;
  const title = danger ? `秘境险归·${realm.name}` : `秘境探幽·${realm.name}`;
  const warning = error?.message ? '天机紊乱，秘境中诸象难以尽录；' : '';
  return {
    title,
    narrative: `${state.name}备好符箓与干粮，循着地脉裂隙入了「${realm.name}」。${realm.description}\n\n${warning}行至深处，${hint}忽然应在眼前。${state.name}不敢贪功，借地势遮掩气息，或采灵机，或避杀阵，终在天色将明时折返。此行虽未惊动大势，却也让经脉多了一分磨砺，对此地的虚实记下几处关窍。`,
    eventType: danger ? 'danger' : 'exploration',
    changes: [
      { attribute: 'cultivationExp', delta: gain, reason: `${realm.name}探幽所得` },
      ...(mpCost ? [{ attribute: 'mp', delta: -mpCost, reason: '入境探路消耗灵力' }] : []),
      ...(luckGain ? [{ attribute: 'luck', delta: luckGain, reason: '窥得秘境灵机' }] : []),
    ],
    newStatuses: danger ? [{
      id: `realm-wary-${realm.id}-${Date.now()}`,
      name: '秘境余悸',
      type: 'debuff',
      description: `刚从${realm.name}险地归来，心神尚未完全平复。`,
      duration: 1,
      effects: [{ attribute: 'heartDemon', operation: 'add', value: 1 }],
      source: realm.name,
    }] : [],
    newItems: [],
    removedItemIds: [],
    newEquippedItems: [],
    equipItemIds: [],
    unequipItemIds: [],
    memory: `${state.age}岁探索${realm.name}，记下${hint}`,
    cultivationInsight: ctx.cultivationInsight || `${realm.name}地脉复杂，行走其间亦是一场修行。`,
    hasChoice: false,
    choice: null,
    triggeredBreakthrough: false,
    causedDeath: false,
    causedAscension: false,
    newThreads: [],
    advanceThreads: [],
    completeThreadIds: [],
    failThreadIds: [],
    triggerCombat: null,
    newPets: [],
  };
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    const action: string = body?.action || 'start';
    const realmId: string | undefined = body?.realmId;

    if (!characterId) {
      return NextResponse.json({ success: false, error: 'characterId required' }, { status: 400 });
    }
    if (action !== 'start') {
      return NextResponse.json({ success: false, error: '未知 action，目前仅支持 start' }, { status: 400 });
    }
    if (!realmId) {
      return NextResponse.json({ success: false, error: 'realmId required' }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    await clearAdvancePreload(characterId);
    if (!char) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });
    if (char.ascended) return NextResponse.json({ success: false, error: '角色已飞升' }, { status: 400 });
    if (char.isAtChoice) {
      return NextResponse.json({ success: false, error: '当前有待选择，请先完成选择' }, { status: 400 });
    }
    if (char.combatStateJson) {
      try {
        const cs = JSON.parse(char.combatStateJson);
        if (cs && cs.status === 'ongoing') {
          return NextResponse.json({ success: false, error: '战斗进行中，无法探索秘境' }, { status: 400 });
        }
      } catch { /* ignore */ }
    }

    let state = dbToState(char);

    // 校验探索条件
    const check = canExploreRealm(state, realmId);
    if (!check.ok || !check.realm) {
      return NextResponse.json({ success: false, error: check.error || '无法探索此秘境' }, { status: 400 });
    }
    const realm = check.realm;

    // 扣灵石 + 标记 _currentExploration
    state = startExploration(state, realm);

    // 取最近事件用于上下文
    const recentEventsDb = await db.eventLog.findMany({
      where: { characterId },
      orderBy: { age: 'desc' },
      take: 5,
    });
    const recentEvents = recentEventsDb.reverse().map(e => ({
      age: e.age,
      title: e.title,
      narrative: e.narrative,
      eventType: e.eventType,
    }));

    // 构建上下文（_currentExploration 已设置，会透传给 LLM）
    const ctx = buildStateContext(state, recentEvents);
    // 探索事件不需要蓝图主题（秘境本身就是主题），但保留 blueprint 字段供 prompt 用
    ctx.blueprint = {
      category: 'exploration',
      name: `秘境探索·${realm.name}`,
      description: `玩家主动探索剧情秘境「${realm.name}」。必须承接该秘境的 description、entryRequirement、entryAlternatives 与前文线索，不得改成其他秘境或收费副本。`,
      weight: 0, minRealm: 0, maxRealm: 99, minAge: 0, maxAge: 99999,
      examples: [realm.description, ...(realm.entryRequirement ? [`入境关窍：${realm.entryRequirement}`] : []), ...(realm.entryAlternatives || []), ...realm.encounterHints],
    };

    // 调用 LLM 生成探索事件（不推进年龄）
    let aiOutput;
    try {
      aiOutput = await generateAgeEvent(ctx, false);
    } catch (llmErr: any) {
      console.error('LLM exploration failed, using fallback:', llmErr?.message || llmErr);
      aiOutput = buildFallbackExplorationEvent(state, realm, ctx, llmErr);
    }

    // 引擎执行 AI 输出
    const stateBeforeExploration = { ...state };
    const result = executeAIEvent(state, aiOutput);
    let finalState = result.state;

    // 寿元检查（探索中可能因陷阱/强敌扣血致死）
    if (!result.died && !finalState.ascended) {
      if (!finalState.alive) {
        result.died = true;
        result.deathReason = `殒落于${realm.name}`;
        aiOutput.causedDeath = true;
        aiOutput.deathReason = result.deathReason;
        aiOutput.eventType = 'death';
      }
    }

    // 提取最佳奖励描述（用于探索记录）
    const bestReward = (aiOutput.newItems && aiOutput.newItems.length > 0)
      ? aiOutput.newItems.map(i => `${i.name}(${i.rarity})`).join('、')
      : (aiOutput.changes && aiOutput.changes.length > 0
          ? aiOutput.changes.filter(c => c.delta > 0).map(c => `${c.attribute}+${c.delta}`).join('、')
          : undefined);

    // 记录探索（更新 exploredRealms + 清除 _currentExploration）
    finalState = recordExploration(finalState, realm.id, bestReward);

    // 持久化（不推进年龄，不修改 fateNodes/lastEventAge）
    await db.character.update({
      where: { id: characterId },
      data: {
        hp: finalState.hp,
        maxHp: finalState.maxHp,
        mp: finalState.mp,
        maxMp: finalState.maxMp,
        attack: finalState.attack,
        defense: finalState.defense,
        speed: finalState.speed,
        luck: finalState.luck,
        comprehension: finalState.comprehension,
        spiritStones: finalState.spiritStones,
        reputation: finalState.reputation,
        alive: finalState.alive,
        causeOfDeath: finalState.causeOfDeath,
        location: finalState.location,
        statusJson: JSON.stringify(finalState.activeStatuses),
        inventoryJson: JSON.stringify(finalState.inventory),
        equippedJson: JSON.stringify(finalState.equipped || []),
        cultivationMultiplier: finalState.cultivationMultiplier ?? 1.0,
        cultivationInsight: finalState.cultivationInsight || '',
        cultivationFactorsJson: JSON.stringify(finalState.cultivationFactors || []),
        memoryJson: JSON.stringify(finalState.longTermMemory),
        pendingThreadsJson: JSON.stringify(finalState.pendingThreads || []),
        characterIntentsJson: JSON.stringify(finalState.characterIntents || []),
        combatStateJson: finalState.combatSession ? JSON.stringify(finalState.combatSession) : '',
        npcsJson: JSON.stringify(finalState.npcs || []),
        causalGraphJson: JSON.stringify(finalState.causalGraph || { nodes: [], edges: [] }),
        worldFactsJson: JSON.stringify(finalState.worldFacts || []),
        heartDemon: finalState.heartDemon ?? 0,
        petsJson: JSON.stringify(finalState.pets || []),
        exploredRealmsJson: JSON.stringify(finalState.exploredRealms || []),
      },
    });

    const displayEffects = buildEventDisplayEffects({
      before: stateBeforeExploration,
      after: finalState,
      changes: result.appliedChanges,
      newStatuses: aiOutput.newStatuses,
      newItems: aiOutput.newItems,
      newEquippedItems: aiOutput.newEquippedItems,
      newPets: aiOutput.newPets,
      removedItemIds: aiOutput.removedItemIds,
    });

    // 写入事件日志（eventType='exploration' 便于史册识别）
    const event = await db.eventLog.create({
      data: {
        characterId,
        age: finalState.age,
        title: aiOutput.title,
        narrative: aiOutput.narrative,
        eventType: 'exploration',
        effects: JSON.stringify(appendStateChangeAuditEffect(displayEffects, result.stateChangeLog)),
      },
    });

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        age: event.age,
        title: event.title,
        narrative: event.narrative,
        eventType: 'exploration',
        isFateNode: false,
        realmName: realm.name,
        realmTier: realm.tier,
        realmIcon: realm.icon,
        effects: displayEffects,
      },
      changes: result.appliedChanges,
      rejectedChanges: result.rejectedChanges,
      hasChoice: aiOutput.hasChoice,
      choice: aiOutput.choice,
      died: result.died,
      deathReason: result.deathReason,
      triggeredCombat: !!finalState.combatSession,
      state: stateToResponse(finalState),
    });
  } catch (err: any) {
    console.error('exploration error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '秘境探索失败' },
      { status: 500 }
    );
  }
}
