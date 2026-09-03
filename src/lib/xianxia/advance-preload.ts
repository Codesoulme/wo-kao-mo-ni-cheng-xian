import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { dbToState, buildStateContext, tickStatusDurations, tickNaturalRecovery, checkFateNode, pickEventBlueprint, tickFormations, tickHeartDemon, tickPets, getSameYearThreads, buildThreadContinuationEvent } from '@/lib/xianxia/engine';
import { generateAgeEvent } from '@/lib/xianxia/llm';
import { FATE_NODES, EventBlueprint } from '@/lib/xianxia/types';
import { clampTimeAdvance, suggestTimeAdvance, extractEventMeta, advanceWorldCalendar } from '@/lib/xianxia/world-time';
import { buildFallbackAgeEvent } from '@/lib/xianxia/advance-fallback';
import { extractNarrativeContractFeedback } from '@/lib/xianxia/state-change-log';
import { listDigests } from '@/lib/xianxia/memory/digest-store';

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

/**
 * 逐字窗口之外的更早经历 + 已生成好的纪要。
 * 2026-08-31：过去只取末尾 20 条、再切 5 条喂模型,前面几百年在提示词里根本不存在。
 * 这里把更早的那些一并取来交给预算选路——它自己决定拼纪要还是列标题。
 * 纪要读失败不算错:那一档本来就允许 miss,落到按重要度列标题即可。
 */
async function getEarlierHistory(characterId: string, verbatimTailCount: number) {
  let rows: Array<{ id: string; age: number; title: string; narrative: string; eventType: string }> = [];
  try {
    const found = await db.eventLog.findMany({
      where: { characterId },
      orderBy: [{ age: 'asc' }, { createdAt: 'asc' }],
      take: 400,
      select: { id: true, age: true, title: true, narrative: true, eventType: true },
    });
    rows = found;
  } catch { rows = []; }
  const earlier = rows.slice(0, Math.max(0, rows.length - Math.max(0, verbatimTailCount)));
  let digests: any[] = [];
  try {
    digests = await listDigests(characterId, { limit: 40 });
  } catch { digests = []; }
  return { earlierEvents: earlier, digests };
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

  // 2026-08-31：此刻的日内时点。挑档要用它——「当晚」和「次日清晨」差别全在这里，
  //   跨度档也要靠它判断该不该拨回清晨（落在后半夜的「月余后」无从下笔）。
  const calendarForHour = (() => {
    if (options.worldCalendar) return options.worldCalendar;
    try { return char.worldCalendarJson ? JSON.parse(char.worldCalendarJson as any) : null; } catch { return null; }
  })();
  const currentDayHour = Number.isFinite(Number(calendarForHour?.dayHour)) ? Number(calendarForHour.dayHour) : undefined;
  const consecutiveContinuous = countTrailingContinuous(recentEvents);

  const rawSuggestedTimeAdvance = suggestTimeAdvance({
    age: state.age,
    pendingThreads: state.pendingThreads || [],
    sameYearThread,
    blueprint,
    // 2026-08-31：连续态防冻结闸门的入参。
    consecutiveContinuous,
    currentDayHour,
  });
  // 2026-07-12\uff1a\u53bb\u6389\u201c\u6709\u91cd\u590d\u4e8b\u4ef6\u5c31\u5f3a\u5236\u8986\u76d6\u4e3a 1 \u5e74\u201d\u7684\u903b\u8f91\u2014\u2014\u4e4b\u524d dedup \u68c0\u6d4b\u628a\u65f6\u95f4\u8de8\u5ea6\u4e5f\u4e00\u8d77\u6539\uff0c
  // \u662f\u201c\u90a3\u51e0\u4e2a\u6708\u5462\u5e73\u4f9d\u8df3\u4e86\u201d\u7684\u5143\u51f6\u4e4b\u4e00\u3002\u65f6\u95f4\u8de8\u5ea6\u7531 suggestTimeAdvance / blueprint / sameYearThread 
  // \u51b3\u5b9a\uff1b\u4e8b\u4ef6\u53bb\u91cd\u8ba9 AI \u81ea\u5df1\u5904\u7406\uff08\u901a\u8fc7 sameYearThread \u7b49\u673a\u5236\uff09\uff0c\u4e0d\u5e94\u7eb1\u67b6\u65f6\u95f4\u3002
  const timeAdvance = clampTimeAdvance(rawSuggestedTimeAdvance);

  if (!sameYearThread) {
    state.age += timeAdvance.ageDeltaYears;
    // 2026-08-31：年度结算改按世界历累计天数计，不再只认 ageDeltaYears。
    //   旧写法 yearlyTicks = ageDeltaYears，而「按月推进」发的 ageDeltaYears 恒为 0，
    //   于是只跑一次自然恢复，状态倒计时 / 灵阵耗材 / 心魔 / 灵宠 一概不动。
    //   只按月推进的玩家，这四样永远冻在原地——心魔不加深也不消解，
    //   带倒计时的状态永不到期，寿元压力也不逼近。
    //   新写法拿累计天数跨没跨过 365 的整数界来判，零头留在日历里下次接着算，
    //   十二次按月推进与一次按年推进结算次数一致，且不需要额外存字段。
    const daysBefore = Math.max(0, Math.round(Number(calendarForHour?.elapsedDays) || 0));
    const daysAfter = Math.max(daysBefore, Math.round(
      Number(advanceWorldCalendar(calendarForHour, timeAdvance)?.elapsedDays) || daysBefore,
    ));
    const accruedTicks = Math.floor(daysAfter / 365) - Math.floor(daysBefore / 365);
    // 日历缺失（极旧存档）时退回旧口径，宁可少结算也不凭空多结算。
    const yearlyTicks = calendarForHour
      ? Math.max(0, accruedTicks)
      : Math.max(0, timeAdvance.ageDeltaYears);
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
  const verbatimTail = qualityMode === 'light' ? 3 : 5;
  const earlierHistory = await getEarlierHistory(char.id, verbatimTail);
  const ctx = buildStateContext(
    state,
    recentEvents.slice(-verbatimTail),
    narrativeContractFeedback.slice(-3),
    { earlierEvents: earlierHistory.earlierEvents, digests: earlierHistory.digests },
  );
  ctx.blueprint = blueprint;
  ctx.suggestedTimeAdvance = timeAdvance;
  if (options.worldCalendar) ctx.worldCalendar = options.worldCalendar;
  // 2026-08-31：入参没给历法就退回角色自己那份，好让提示词能报出此刻时辰。
  //   过去这条通路是空的，模型无从得知天已擦黑，写出来自然全是白日戏。
  else if (calendarForHour) ctx.worldCalendar = calendarForHour;
  // 矛盾体检（引擎判了跨度、正文却当没这回事）要靠它决定能不能把这次跨度撤回。
  (ctx as any).consecutiveContinuous = consecutiveContinuous;
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

  // ===== 开笔复读体检（非流式路径）=====
  //   2026-08-31：这道量尺原先只长在 advance-sse 里，而玩家点「连推」走的是
  //   advance-batch → advance/route.ts → 本函数，一路没人量。连推十年里
  //   起笔一字不差的重灾正出在这条路上。
  //   流式路由传 skipLlm:true、自己生成、自己量，不走这里，不会量两遍。
  //   与风险纠偏同一形状：单轮、不递归、只在新稿确实更不像时才采纳。
  if (!options.skipLlm && !sameYearThread && aiOutput && aiOutput.narrative && !aiOutput.isFallbackGenerated) {
    try {
      const { detectOpeningRepeat, buildRepeatAdvisory, openingClause, bigramSimilarity } = await import('./narrative-repeat');
      const priorNarratives = (recentEvents || []).map((e: any) => String(e?.narrative || ''));
      const verdict = detectOpeningRepeat(String(aiOutput.narrative || ''), priorNarratives);
      if (verdict.repeated) {
        console.log(`[advance-prepare] 开笔撞前文 ratio=${verdict.ratio.toFixed(2)} 「${verdict.opening}」≈「${verdict.against}」`);
        const prevAdvisory = (ctx as any).repeatAdvisoryPrompt;
        (ctx as any).repeatAdvisoryPrompt = buildRepeatAdvisory(verdict);
        try {
          const revised = await generateAgeEvent(ctx, isFateNode, 'light');
          const revisedText = String(revised?.narrative || '').trim();
          if (!revisedText) throw new Error('重写稿无 narrative，弃用');
          const after = bigramSimilarity(openingClause(revisedText), verdict.against);
          if (after < verdict.ratio) {
            console.log(`[advance-prepare] 采纳重写稿 开笔相似 ${verdict.ratio.toFixed(2)} → ${after.toFixed(2)}`);
            aiOutput = revised;
          } else {
            console.log(`[advance-prepare] 弃用重写稿（没更不像 ${verdict.ratio.toFixed(2)} → ${after.toFixed(2)}），沿用原稿`);
          }
        } finally {
          (ctx as any).repeatAdvisoryPrompt = prevAdvisory;
        }
      }
    } catch (e: any) {
      console.warn('[advance-prepare] 开笔复读体检跳过（非致命，沿用原稿）:', e?.message || e);
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
    // 2026-08-31：连续态积压条数。路由做矛盾体检时要凭它设一道止损——
    //   撤回跨度不能无限撤，否则遇上一个始终不肯交代时间的模型，光景就永远停住了。
    consecutiveContinuous,
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
