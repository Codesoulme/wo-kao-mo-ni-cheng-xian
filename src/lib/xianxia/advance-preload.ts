import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { dbToState, buildStateContext, tickStatusDurations, tickNaturalRecovery, checkFateNode, pickEventBlueprint, tickFormations, tickHeartDemon, tickPets, getSameYearThreads, buildThreadContinuationEvent } from '@/lib/xianxia/engine';
import { generateAgeEvent } from '@/lib/xianxia/llm';
import { FATE_NODES, EventBlueprint } from '@/lib/xianxia/types';
import { clampTimeAdvance, suggestTimeAdvance, extractEventMeta } from '@/lib/xianxia/world-time';
import { buildFallbackAgeEvent } from '@/lib/xianxia/advance-fallback';
import { extractNarrativeContractFeedback } from '@/lib/xianxia/state-change-log';

type CharacterRecord = Awaited<ReturnType<typeof db.character.findUnique>>;

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
}

export function buildAdvanceStateHash(char: NonNullable<CharacterRecord>): string {
  let normalizedPendingThreadsJson = char.pendingThreadsJson;
  try {
    normalizedPendingThreadsJson = JSON.stringify(dbToState(char as any).pendingThreads || []);
  } catch {
    normalizedPendingThreadsJson = char.pendingThreadsJson;
  }
  const payload = {
    age: char.age,
    lifespan: char.lifespan,
    gender: char.gender,
    spiritualRoot: char.spiritualRoot,
    rootDetail: char.rootDetail,
    realm: char.realm,
    realmLevel: char.realmLevel,
    cultivationExp: char.cultivationExp,
    expToBreak: char.expToBreak,
    elements: [char.elementMetal, char.elementWood, char.elementWater, char.elementFire, char.elementEarth],
    stats: [char.hp, char.maxHp, char.mp, char.maxMp, char.attack, char.defense, char.speed, char.luck, char.comprehension],
    resources: [char.spiritStones, char.reputation],
    flags: [char.alive, char.ascended, char.isAtChoice],
    causeOfDeath: char.causeOfDeath,
    faction: char.faction,
    master: char.master,
    location: char.location,
    fateNodes: char.fateNodes,
    statusJson: char.statusJson,
    inventoryJson: char.inventoryJson,
    equippedJson: char.equippedJson,
    storageCapacity: char.storageCapacity,
    cultivationMultiplier: char.cultivationMultiplier,
    cultivationInsight: char.cultivationInsight,
    cultivationFactorsJson: char.cultivationFactorsJson,
    pendingChoiceJson: char.pendingChoiceJson,
    memoryJson: char.memoryJson,
    pendingThreadsJson: normalizedPendingThreadsJson,
    characterIntentsJson: char.characterIntentsJson,
    combatStateJson: char.combatStateJson,
    recentEventTypesJson: char.recentEventTypesJson,
    recentBlueprintCategoriesJson: char.recentBlueprintCategoriesJson,
    heartDemon: char.heartDemon,
    petsJson: char.petsJson,
    exploredRealmsJson: char.exploredRealmsJson,
  };
  return createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex');
}

export async function clearAdvancePreload(characterId: string) {
  await db.advancePreload.deleteMany({ where: { characterId } });
}

export type PreloadUsableResult = { usable: true } | { usable: false; reason: string };

export async function isAdvancePreloadUsable(char: NonNullable<CharacterRecord>, preload: any): Promise<PreloadUsableResult> {
  if (!preload) return { usable: false, reason: 'no_preload' };
  if (preload.baseAge !== char.age) return { usable: false, reason: 'ageMismatch' };
  if (!char.alive) return { usable: false, reason: 'characterDead' };
  if (char.ascended) return { usable: false, reason: 'ascended' };
  if (char.isAtChoice) return { usable: false, reason: 'isAtChoice' };
  if (char.pendingChoiceJson) return { usable: false, reason: 'hasPendingChoice' };
  if (char.combatStateJson) {
    try {
      const cs = JSON.parse(char.combatStateJson);
      if (cs && cs.status === 'ongoing') return { usable: false, reason: 'combatOngoing' };
    } catch { return { usable: false, reason: 'combatStateParseFailed' }; }
  }
  if (preload.baseStateHash !== buildAdvanceStateHash(char)) return { usable: false, reason: 'stateHashMismatch' };
  return { usable: true };
}

async function getRecentEvents(characterId: string) {
  const recentEventsDb = await db.eventLog.findMany({
    where: { characterId },
    // 2026-08-31：补 createdAt 次序键。原先只按 age 排，而缺省成连续态后同岁能堆十几条，
    //   同岁之间的先后就成了随机的——reverse() 之后"末尾"未必是最新一条，
    //   连续态计数因此虚高（实跑里闸门第 8 幕才响，本该第 5 幕），
    //   喂给模型的近期上下文也是乱序的。
    orderBy: [{ age: 'desc' }, { createdAt: 'desc' }],
    take: 20,
  });
  return recentEventsDb.reverse().map(e => ({
    age: e.age,
    title: e.title,
    narrative: e.narrative,
    eventType: e.eventType,
    // 2026-08-31：带上 effects，供连续态计数用（时间元信息藏在 hiddenEventMeta 里）。
    effects: e.effects,
  }));
}

/**
 * 数一数末尾连着几条是连续态。
 * 时序改制后缺省是「接着刚才」，若一直没人报时，角色会永远停在同一天；
 * 这个计数喂给 suggestTimeAdvance 的防冻结闸门。
 */
function countTrailingContinuous(events: Array<{ effects?: string }>): number {
  let n = 0;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    let unit: string | undefined;
    try {
      unit = extractEventMeta(JSON.parse(events[i]?.effects || '[]'))?.timeAdvance?.unit;
    } catch {
      // 老数据/脏 JSON 不算连续态，就此打住——宁可少推，不要误推。
      break;
    }
    if (unit === 'continuous') n += 1;
    else break;
  }
  return n;
}

async function getNarrativeContractFeedback(characterId: string) {
  const auditEvents = await db.eventLog.findMany({
    where: { characterId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { age: true, title: true, effects: true },
  });
  return extractNarrativeContractFeedback(auditEvents.reverse());
}

function buildSameYearContinuationBlueprint(threadTitle: string): EventBlueprint {
  return {
    category: 'thread_resolve',
    name: '同年续篇',
    description: `今年内未竟之事仍在牵动：${threadTitle}。本轮不跨年，优先补完同岁关键后续。`,
    weight: 1,
    minRealm: 0,
    maxRealm: 8,
    minAge: 0,
    maxAge: 9999,
    examples: ['同岁三月后赴约', '今年内补完旧事后续', '入夜后承接前文因果'],
  };
}

export async function prepareAdvanceCandidate(char: NonNullable<CharacterRecord>, options: { qualityMode?: 'full' | 'light'; worldCalendar?: any; previousWorldLegacies?: any[]; skipLlm?: boolean } = {}) {
  const qualityMode = options.qualityMode || 'full';
  const recentEvents = await getRecentEvents(char.id);
  // Dedup: detect repeated event titles at current age
  const ageEventCounts: Record<string, number> = {};
  for (const evt of recentEvents) {
    if (evt.age === char.age) {
      ageEventCounts[evt.title] = (ageEventCounts[evt.title] || 0) + 1;
    }
  }
  const hasRepeatedEvents = Object.values(ageEventCounts).some(c => c >= 3);
  const narrativeContractFeedback = qualityMode === 'light' ? [] : await getNarrativeContractFeedback(char.id);
  let state = dbToState(char);
  const recentBlueprintCategories = (state as any)._recentBlueprintCategories || [];
  const sameYearThreads = getSameYearThreads(state);
  const sameYearThread = sameYearThreads[0];
  let blueprint: EventBlueprint | null = sameYearThread
    ? buildSameYearContinuationBlueprint(sameYearThread.title)
    : pickEventBlueprint(state, recentBlueprintCategories);

  const rawSuggestedTimeAdvance = suggestTimeAdvance({
    age: state.age,
    pendingThreads: state.pendingThreads || [],
    sameYearThread,
    blueprint,
    // 2026-08-31：连续态防冻结闸门的入参。
    consecutiveContinuous: countTrailingContinuous(recentEvents),
  });
  // 2026-07-12\uff1a\u53bb\u6389\u201c\u6709\u91cd\u590d\u4e8b\u4ef6\u5c31\u5f3a\u5236\u8986\u76d6\u4e3a 1 \u5e74\u201d\u7684\u903b\u8f91\u2014\u2014\u4e4b\u524d dedup \u68c0\u6d4b\u628a\u65f6\u95f4\u8de8\u5ea6\u4e5f\u4e00\u8d77\u6539\uff0c
  // \u662f\u201c\u90a3\u51e0\u4e2a\u6708\u5462\u5e73\u4f9d\u8df3\u4e86\u201d\u7684\u5143\u51f6\u4e4b\u4e00\u3002\u65f6\u95f4\u8de8\u5ea6\u7531 suggestTimeAdvance / blueprint / sameYearThread 
  // \u51b3\u5b9a\uff1b\u4e8b\u4ef6\u53bb\u91cd\u8ba9 AI \u81ea\u5df1\u5904\u7406\uff08\u901a\u8fc7 sameYearThread \u7b49\u673a\u5236\uff09\uff0c\u4e0d\u5e94\u7eb1\u67b6\u65f6\u95f4\u3002
  const timeAdvance = clampTimeAdvance(rawSuggestedTimeAdvance);

  if (!sameYearThread) {
    state.age += timeAdvance.ageDeltaYears;
    const yearlyTicks = Math.max(0, timeAdvance.ageDeltaYears);
    for (let i = 0; i < yearlyTicks; i += 1) {
      state = tickStatusDurations(state);
      state = tickNaturalRecovery(state);
      const formationTick = tickFormations(state);
      state = formationTick.state;
      state = tickHeartDemon(state);
      state = tickPets(state);
    }
    if (yearlyTicks === 0 && timeAdvance.elapsedDays > 0) {
      state = tickNaturalRecovery(state);
    }
  }

  const fateNodeIdx = sameYearThread || timeAdvance.ageDeltaYears <= 0 ? null : checkFateNode(state);
  const referenceFateNode = fateNodeIdx !== null ? FATE_NODES.find(n => n.index === fateNodeIdx) : null;
  const isFateNode = false;
  const ctx = buildStateContext(state, recentEvents.slice(qualityMode === 'light' ? -3 : -5), narrativeContractFeedback.slice(-3));
  ctx.blueprint = blueprint;
  ctx.suggestedTimeAdvance = timeAdvance;
  if (options.worldCalendar) ctx.worldCalendar = options.worldCalendar;
  if (Array.isArray(options.previousWorldLegacies)) ctx.previousWorldLegacies = options.previousWorldLegacies;

  // ===== 风格锚定 + 实体库：把历史 AI 风格与已用实体喂给 AI 续写（并行加载） =====
  const [styleAnchorMod, entityStoreMod] = await Promise.all([
    import('./style-anchor'),
    import('./entity-store'),
  ]);
  const { formatStyleAnchorsForPrompt, extractStyleAnchor, mergeStyleAnchor } = styleAnchorMod;
  const { getEntityEntries, formatEntitiesForPrompt, extractEntitiesFromNarrative, mergeEntities } = entityStoreMod;
  // 重新导出别名供下方使用
  const extractStyleAnchorForAge = extractStyleAnchor;
  const styleAnchors: any[] = (() => {
    try { return JSON.parse((char as any).styleAnchorsJson || '[]'); } catch { return []; }
  })();
  const entityEntries = getEntityEntries(char as any);
  ctx.styleAnchorsPrompt = formatStyleAnchorsForPrompt(styleAnchors);
  ctx.entityEntriesPrompt = formatEntitiesForPrompt(entityEntries);

  let aiOutput;
  if (sameYearThread) {
    aiOutput = buildThreadContinuationEvent(state, sameYearThread);
    aiOutput.narrativeContract = {
      narrativeFocus: 'thread',
      usedScheduleHintIds: [`seh_thread_${sameYearThread.id}`],
      usedWorldFactIds: [],
      usedNpcIds: [],
      narrativeOutcome: sameYearThread.category === 'competition' ? 'resolved' : 'advanced',
      contractNote: `同年续写：${sameYearThread.title}`,
    };
  } else if (options.skipLlm) {
    // 流式路由调用：跳过 LLM，留着空 aiOutput 让上层手动生成
    aiOutput = null;
  } else {
    try {
      aiOutput = await generateAgeEvent(ctx, isFateNode, qualityMode);
    } catch (llmErr: any) {
      console.error('LLM advance prepare failed, using fallback:', llmErr?.message || llmErr);
      // 风格锚定 + 实体库喂给 fallback：让 fallback 文本"读起来像 AI 写的"
      const styleAnchorsRaw: any[] = (() => {
        try { return JSON.parse((char as any).styleAnchorsJson || '[]'); } catch { return []; }
      })();
      const fallbackAnchor = styleAnchorsRaw.length ? styleAnchorsRaw[styleAnchorsRaw.length - 1] : null;
      const fallbackEntities = entityEntries;
      aiOutput = buildFallbackAgeEvent(state, blueprint, ctx, isFateNode, { recentEvents, styleAnchor: fallbackAnchor, entityEntries: fallbackEntities });
      // fallback 路径：清掉 blueprint 标签，避免 "因缘：线索推进" 这类与 narrative 不匹配的标签
      // BlueprintChip 看到 null 时不渲染
      blueprint = null;
    }
  }

  // ===== 写回：把本次 AI 输出的风格 + 实体合并到 character =====
  if (aiOutput && aiOutput.narrative && typeof aiOutput.narrative === 'string' && !aiOutput.isFallbackGenerated) {
    try {
      const newAnchor = extractStyleAnchorForAge(state.age, aiOutput.narrative);
      const newEntities = extractEntitiesFromNarrative(state.age, aiOutput.narrative);
      const anchorJson = mergeStyleAnchor(char as any, newAnchor);
      const entityJson = mergeEntities(char as any, newEntities);
      await db.character.update({
        where: { id: char.id },
        data: { styleAnchorsJson: anchorJson, entityEntriesJson: entityJson },
      });
    } catch (e) {
      console.warn('Failed to persist style anchor / entity entries:', (e as any)?.message);
    }
  }

  return {
    preparedState: state,
    blueprint,
    aiOutput: { ...aiOutput, timeAdvance: clampTimeAdvance(aiOutput?.timeAdvance, timeAdvance) },
    isFateNode,
    fateNode: referenceFateNode,
    recentEvents,
    narrativeContractFeedback,
    recentBlueprintCategories,
    baseAge: char.age,
    baseStateHash: buildAdvanceStateHash(char),
    timeAdvance,
  };
}

export async function saveAdvanceCandidate(characterId: string, candidate: Awaited<ReturnType<typeof prepareAdvanceCandidate>>) {
  await db.advancePreload.upsert({
    where: { characterId },
    create: {
      characterId,
      baseAge: candidate.baseAge,
      baseStateHash: candidate.baseStateHash,
      preparedStateJson: JSON.stringify(candidate.preparedState),
      blueprintJson: JSON.stringify(candidate.blueprint),
      aiOutputJson: JSON.stringify(candidate.aiOutput),
    },
    update: {
      baseAge: candidate.baseAge,
      baseStateHash: candidate.baseStateHash,
      preparedStateJson: JSON.stringify(candidate.preparedState),
      blueprintJson: JSON.stringify(candidate.blueprint),
      aiOutputJson: JSON.stringify(candidate.aiOutput),
    },
  });
}
