// @ts-nocheck - api route, types not critical

// POST /api/game/interfere
// 玩家在任意时刻输入"干扰模拟"

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import { dbToState, buildStateContext, applyChanges, addStatuses, addItems, addMemory, checkLifespan, stateToResponse, removeItemsByIds, equipItemsByIds, unequipItemsByIds, recalcCultivationMultiplier, applyItemEffects, ensureUniqueIds, computeCultivationFactors, applySpiritualRootChange, addThreads, advanceThread, completeThread, failThread, startCombat, addPet, upsertNpcs, recordActionCausality, applyCultivationInsight } from '@/lib/xianxia/engine';
import { generateInterfereResponse } from '@/lib/xianxia/llm';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { sanitizeNarrativeText } from '@/lib/xianxia/display';
import { appendStateChangeAuditEffect, buildStateChangeLog } from '@/lib/xianxia/state-change-log';
import { registerMany, registerNpc } from '@/lib/xianxia/content-registry';
import type { ValidationTrace } from '@/lib/xianxia/content-registry';
import { getCurrentUser } from '@/lib/auth-helpers';
import { generateEntityId } from '@/lib/xianxia/engine';

// P1 step2 worker A: 生产模式下强制 userId 检查；dev 模式保持原行为。

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const isProdMode = !!process.env.ADMIN_TOKEN;
    let user: { id: string } | null = null;
    if (isProdMode) {
      user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    const input: string | undefined = body?.input;

    if (!characterId || !input || !input.trim()) {
      return NextResponse.json({ success: false, error: 'characterId 和 input 必填' }, { status: 400 });
    }

    const char = await db.character.findUnique({
      where: isProdMode ? { id: characterId, userId: user!.id } : { id: characterId },
    });
    await clearAdvancePreload(characterId);
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });

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

    let state = dbToState(char);
    const stateBeforeInterfere = {
      ...state,
      inventory: [...(state.inventory || [])],
      equipped: [...(state.equipped || [])],
      activeStatuses: [...(state.activeStatuses || [])],
      pendingThreads: [...(state.pendingThreads || [])],
      npcs: [...(state.npcs || [])],
      pets: [...(state.pets || [])],
      worldFacts: [...(state.worldFacts || [])],
    };
    const contentRegistryTrace: ValidationTrace[] = [];
    const contentRegistryWarnings: string[] = [];
    const ctx = buildStateContext(state, recentEvents);

    const result = await generateInterfereResponse(ctx, input.trim());
    const safeNarrative = sanitizeNarrativeText(result.narrative);

    // 仅当 accepted 时应用变更
    let died = false;
    let deathReason: string | undefined;
    if (result.accepted) {
      state = applyChanges(state, result.changes || []);
      state = addStatuses(state, result.newStatuses || []);
      state = addItems(state, result.newItems || []);
      if (result.removedItemIds && result.removedItemIds.length) {
        state = removeItemsByIds(state, result.removedItemIds).state;
      }
      // AI 联动：创造性装备（玩家干扰“把储物戒指串成项链”等）
      if (result.newEquippedItems && result.newEquippedItems.length) {
        const ensured = ensureUniqueIds([], result.newEquippedItems).items;
        state = { ...state, equipped: [...(state.equipped || []), ...ensured] };
        for (const it of ensured) state = applyItemEffects(state, it, 1);
        state = recalcCultivationMultiplier(state);
      }
      if (result.equipItemIds && result.equipItemIds.length) {
        state = equipItemsByIds(state, result.equipItemIds).state;
      }
      if (result.unequipItemIds && result.unequipItemIds.length) {
        state = unequipItemsByIds(state, result.unequipItemIds).state;
      }
      if (result.memory) state = addMemory(state, result.memory);
      // 应用修炼心得文本（仅当 AI 输出了非空文本时覆盖；P1-10 走 sanitizeNarrativeText 清洗内部机制词）
      state = applyCultivationInsight(state, result.cultivationInsight);
      // 引擎权威：cultivationFactors 完全由引擎从 state 计算（灵根 + 功法 + 状态词条）
      // 不再合并 AI 输出——避免条目忽隐忽现 + 数字与 multiplier 脱节
      state = applySpiritualRootChange(state, result.spiritualRootChange).state;
      state.cultivationFactors = computeCultivationFactors(state);
      // Task 20: 应用未决线索变更
      if (result.newThreads && result.newThreads.length) state = addThreads(state, result.newThreads);
      if (result.newNpcs && result.newNpcs.length) {
        const registeredNpcs = registerMany(result.newNpcs, registerNpc, {
          source: 'interfere',
          age: state.age,
          existingIds: (state.npcs || []).map(n => n.id),
        });
        contentRegistryTrace.push(...registeredNpcs.trace);
        contentRegistryWarnings.push(...registeredNpcs.warnings);
        state = upsertNpcs(state, registeredNpcs.accepted);
      }
      if (result.advanceThreads && result.advanceThreads.length) {
        for (const adv of result.advanceThreads) {
          if (adv.id) state = advanceThread(state, adv.id, adv.progressDelta || 0, adv.note);
        }
      }
      if (result.completeThreadIds && result.completeThreadIds.length) {
        for (const id of result.completeThreadIds) state = completeThread(state, id);
      }
      if (result.failThreadIds && result.failThreadIds.length) {
        for (const id of result.failThreadIds) state = failThread(state, id);
      }
      // Task 20: 触发战斗
      if (result.triggerCombat && result.triggerCombat.enemies?.length) {
        state = startCombat(state, {
          ...result.triggerCombat,
          contextTitle: '干扰·天道回响',
          contextNarrative: safeNarrative || result.triggerCombat.contextNarrative,
        });
      }
      // 干扰连续性兜底：只要玩家干扰被接受且不是纯数值小动作，写入一条余波线索，
      // 让下一次正常流年必须承接本次因果，而不是自顾自换方向。
      const hasThreadMutation = Boolean(
        (result.newThreads && result.newThreads.length) ||
        (result.advanceThreads && result.advanceThreads.length) ||
        (result.completeThreadIds && result.completeThreadIds.length) ||
        (result.failThreadIds && result.failThreadIds.length)
      );
      const shouldCreateInterfereEcho = result.accepted && !hasThreadMutation && (
        result.classification === 'action' ||
        Boolean(result.memory) ||
        Boolean(result.triggerCombat) ||
        (result.newItems && result.newItems.length > 0) ||
        (result.newStatuses && result.newStatuses.length > 0)
      );
      if (shouldCreateInterfereEcho) {
        const titleBase = input.trim().replace(/[，。！？\s]/g, '').slice(0, 8) || '干扰余波';
        state = addThreads(state, [{
          id: `thread_interfere_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          title: `${titleBase}余波`,
          description: `${String(safeNarrative || input).slice(0, 90)}。此事尚有余绪未平，${state.name}存了继续追究之心，未敢轻易搁下。`,
          category: 'quest',
          startAge: state.age,
          deadlineAge: state.age + 1,
          status: 'pending',
          progress: 20,
          followUpHint: '其中关节仍待理清，或牽出后续因果。',
          sourceEventTitle: '前事余绪',
        } as any]);
      }

      // Task 23: 应用 AI 授予的灵宠
      if ((result as any).newPets && (result as any).newPets.length) {
        for (const pet of (result as any).newPets) {
          state = addPet(state, pet);
        }
      }

      // 干扰可能消耗时间
      if (result.ageAdvance && result.ageAdvance > 0) {
        state.age += result.ageAdvance;
        // 检查寿元
        const life = checkLifespan(state);
        if (life.died) {
          state = life.state;
          died = true;
          deathReason = life.reason;
        }
      }
    }
    if (result.accepted) {
      const removedItems = (result.removedItemIds || [])
        .map(id => stateBeforeInterfere.inventory.find(item => item.id === id))
        .filter(Boolean) as any[];
      const equippedItems = (result.equipItemIds || [])
        .map(id => state.equipped.find(item => item.id === id) || stateBeforeInterfere.inventory.find(item => item.id === id))
        .filter(Boolean) as any[];
      const unequippedItems = (result.unequipItemIds || [])
        .map(id => state.inventory.find(item => item.id === id) || stateBeforeInterfere.equipped.find(item => item.id === id))
        .filter(Boolean) as any[];
      state = recordActionCausality(state, {
        actionId: `interference_${state.age}_${Date.now().toString(36)}`,
        actionType: 'interference',
        title: '干扰·天道回响',
        summary: safeNarrative,
        tags: ['interference', result.classification || 'unknown'],
        newItems: result.newItems || [],
        removedItems,
        equippedItems: [...(result.newEquippedItems || []), ...equippedItems],
        unequippedItems,
        threads: result.newThreads || [],
        statuses: result.newStatuses || [],
        pets: (result as any).newPets || [],
      });
    }
    const stateChangeLog = result.accepted ? buildStateChangeLog({
      before: stateBeforeInterfere,
      after: state,
      appliedChanges: result.changes || [],
      rejectedChanges: [],
      contentRegistryTrace,
      effectResolveTrace: [],
      aiBoundaryTrace: [],
    }) : [];


    // 持久化
    // P1-3 修复：interfere 路由加幂等保护——与 advance 路由风格一致，用 updateMany + age 条件做乐观锁。
    // P1-4 加固：把 updateMany + InterferenceLog.create + EventLog.create 包到 $transaction 里，
    // 防止 updateMany 成功但 log 写入失败（或乐观锁挡住第二次但第一次 log 漏写）的 race。
    // 事务内 updateMany count=0 → 自动回滚，连带两个 log 都不会写——这就是要的 race-safe 语义。
    const displayEffects = result.accepted ? buildEventDisplayEffects({
      before: stateBeforeInterfere,
      after: state,
      changes: result.changes || [],
      newStatuses: result.newStatuses,
      newItems: result.newItems,
      newEquippedItems: result.newEquippedItems,
      newPets: result.newPets,
      removedItemIds: result.removedItemIds,
    }) : [];
    const effectsWithAudit = appendStateChangeAuditEffect(displayEffects, stateChangeLog);

    type PersistResult =
      | { ok: true }
      | { ok: false; error: 'IDEMPOTENT_DUPLICATE' };
    const persistResult: PersistResult = await db.$transaction(async (tx) => {
      const updateResult = await tx.character.updateMany({
        where: {
          id: characterId,
          ...(isProdMode ? { userId: user!.id } : {}),
          age: char.age, // 乐观锁：age 没变说明还没被其他 interfere / advance 抢先
          isAtChoice: char.isAtChoice, // 双重保险：正在选择时不允许 interfere
        },
        data: {
          age: state.age,
          lifespan: state.lifespan,
          realm: state.realm,
          spiritualRoot: state.spiritualRoot,
          rootDetail: state.rootDetail,
          realmLevel: state.realmLevel,
          cultivationExp: state.cultivationExp,
          expToBreak: state.expToBreak,
          elementMetal: state.elements.metal,
          elementWood: state.elements.wood,
          elementWater: state.elements.water,
          elementFire: state.elements.fire,
          elementEarth: state.elements.earth,
          hp: state.hp, maxHp: state.maxHp,
          mp: state.mp, maxMp: state.maxMp,
          attack: state.attack, defense: state.defense, speed: state.speed,
          luck: state.luck, comprehension: state.comprehension,
          spiritStones: state.spiritStones, reputation: state.reputation,
          alive: state.alive, ascended: state.ascended,
          causeOfDeath: state.causeOfDeath || '',
          faction: state.faction, master: state.master, location: state.location,
          statusJson: JSON.stringify(state.activeStatuses),
          inventoryJson: JSON.stringify(state.inventory),
          equippedJson: JSON.stringify(state.equipped || []),
          storageCapacity: state.storageCapacity ?? 5,
          cultivationMultiplier: state.cultivationMultiplier ?? 1.0,
          cultivationInsight: state.cultivationInsight || '',
          cultivationFactorsJson: JSON.stringify(state.cultivationFactors || []),
          memoryJson: JSON.stringify(state.longTermMemory),
          // Task 20 新字段
          pendingThreadsJson: JSON.stringify(state.pendingThreads || []),
          characterIntentsJson: JSON.stringify(state.characterIntents || []),
          combatStateJson: state.combatSession ? JSON.stringify(state.combatSession) : '',
          npcsJson: JSON.stringify(state.npcs || []),
          causalGraphJson: JSON.stringify(state.causalGraph || { nodes: [], edges: [] }),
          worldFactsJson: JSON.stringify(state.worldFacts || []),
          // Task 22: 心魔值
          heartDemon: state.heartDemon ?? 0,
          // Task 23: 灵宠
          petsJson: JSON.stringify(state.pets || []),
          // Task 24: 秘境探索记录
          exploredRealmsJson: JSON.stringify(state.exploredRealms || []),
        },
      });
      if (updateResult.count === 0) {
        // 乐观锁失败 → 抛错让事务回滚（连 log 也不会写）
        throw new Error('IDEMPOTENT_DUPLICATE');
      }

      // ===== Event Sourcing PoC（PoC14）：updateMany 成功后、同事务内 append event =====
      // 读最新 state（事务内 updateMany 已提交，读到的是 after 状态）。
      // 与事务前的 `char` 做 diff——只有真变化的字段才 append event，避免噪音。
      const charAfter = await tx.character.findUnique({ where: { id: characterId } });
      if (!charAfter) {
        // 极端兜底：updateMany 刚成功却读不到（不太可能，但防御一下）。
        throw new Error('CHARACTER_GONE_AFTER_UPDATE');
      }

      // 查该 character 最新 event（用于 previousEventId + aggregateVersion 乐观锁）。
      // 注意：必须用事务内的 tx.event（不是 db.event），否则拿不到本次事务里刚 append 的 event。
      const latestEvent = await tx.event.findFirst({
        where: { characterId },
        orderBy: { aggregateVersion: 'desc' },
        select: { id: true, aggregateVersion: true },
      });
      let nextAggregateVersion = (latestEvent?.aggregateVersion ?? -1) + 1;
      const previousEventId = latestEvent?.id ?? null;

      // 修为变更
      if (result.accepted && charAfter.cultivationExp !== char.cultivationExp) {
        await tx.event.create({
          data: {
            id: generateEntityId('evt'),
            characterId,
            type: 'character.cultivation-exp.changed',
            data: {
              type: 'character.cultivation-exp.changed',
              delta: charAfter.cultivationExp - char.cultivationExp,
              newValue: charAfter.cultivationExp,
              reason: 'interfere',
            },
            previousEventId,
            aggregateVersion: nextAggregateVersion,
            source: 'user-action',
            triggerActor: 'player',
            createdAtAge: charAfter.age,
          },
        });
        nextAggregateVersion += 1;
      }

      // 境界变更
      if (result.accepted && charAfter.realm !== char.realm) {
        await tx.event.create({
          data: {
            id: generateEntityId('evt'),
            characterId,
            type: 'character.realm.changed',
            data: {
              type: 'character.realm.changed',
              from: char.realm,
              to: charAfter.realm,
              method: 'set',
            },
            previousEventId: previousEventId, // 简化 PoC：不再追 complex chain（multiple events in one tx）
            aggregateVersion: nextAggregateVersion,
            source: 'user-action',
            triggerActor: 'player',
            createdAtAge: charAfter.age,
          },
        });
        nextAggregateVersion += 1;
      }

      // 写入干扰日志
      await tx.interferenceLog.create({
        data: {
          characterId,
          age: state.age,
          input: input.trim(),
          classification: result.classification,
          response: safeNarrative,
          effects: JSON.stringify(effectsWithAudit),
          accepted: result.accepted,
        },
      });

      // 干扰也算一次事件，写入事件日志
      await tx.eventLog.create({
        data: {
          characterId,
          age: state.age,
          title: result.accepted ? '干扰·天道回响' : '干扰·世界如常',
          narrative: safeNarrative,
          eventType: 'interference',
          effects: JSON.stringify(effectsWithAudit),
        },
      });

      return { ok: true as const };
    }).catch((err: any) => {
      if (err?.message === 'IDEMPOTENT_DUPLICATE') {
        return { ok: false as const, error: 'IDEMPOTENT_DUPLICATE' as const };
      }
      throw err;
    });

    if (!persistResult.ok) {
      return NextResponse.json(
        { success: false, error: '请求已被处理，请刷新页面', code: 'IDEMPOTENT_DUPLICATE' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      classification: result.classification,
      accepted: result.accepted,
      narrative: safeNarrative,
      changes: result.accepted ? result.changes : [],
      newStatuses: result.accepted ? result.newStatuses : [],
      newItems: result.accepted ? result.newItems : [],
      ageAdvance: result.ageAdvance,
      died,
      deathReason,
      // Task 20: 是否触发战斗（前端据此打开 CombatModal）
      triggeredCombat: !!state.combatSession,
      state: stateToResponse(state),
    });
  } catch (err: any) {
    console.error('interfere error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process interference' },
      { status: 500 }
    );
  }
}
