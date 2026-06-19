import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { dbToState, buildStateContext, tickStatusDurations, tickNaturalRecovery, checkFateNode, pickEventBlueprint, tickFormations, tickHeartDemon, tickPets, getSameYearThreads, buildThreadContinuationEvent } from '@/lib/xianxia/engine';
import { generateAgeEvent } from '@/lib/xianxia/llm';
import { FATE_NODES, EventBlueprint } from '@/lib/xianxia/types';
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
    pendingThreadsJson: char.pendingThreadsJson,
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

export async function isAdvancePreloadUsable(char: NonNullable<CharacterRecord>, preload: any): Promise<boolean> {
  if (!preload) return false;
  if (preload.baseAge !== char.age) return false;
  if (!char.alive || char.ascended || char.isAtChoice) return false;
  if (char.pendingChoiceJson) return false;
  if (char.combatStateJson) {
    try {
      const cs = JSON.parse(char.combatStateJson);
      if (cs && cs.status === 'ongoing') return false;
    } catch { return false; }
  }
  return preload.baseStateHash === buildAdvanceStateHash(char);
}

async function getRecentEvents(characterId: string) {
  const recentEventsDb = await db.eventLog.findMany({
    where: { characterId },
    orderBy: { age: 'desc' },
    take: 5,
  });
  return recentEventsDb.reverse().map(e => ({
    age: e.age,
    title: e.title,
    narrative: e.narrative,
    eventType: e.eventType,
  }));
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

export async function prepareAdvanceCandidate(char: NonNullable<CharacterRecord>) {
  const recentEvents = await getRecentEvents(char.id);
  const narrativeContractFeedback = await getNarrativeContractFeedback(char.id);
  let state = dbToState(char);
  const recentBlueprintCategories = (state as any)._recentBlueprintCategories || [];
  const sameYearThreads = getSameYearThreads(state);
  const sameYearThread = sameYearThreads[0];
  const blueprint = sameYearThread
    ? buildSameYearContinuationBlueprint(sameYearThread.title)
    : pickEventBlueprint(state, recentBlueprintCategories);

  if (!sameYearThread) {
    state.age += 1;
    state = tickStatusDurations(state);
    state = tickNaturalRecovery(state);
    const formationTick = tickFormations(state);
    state = formationTick.state;
    state = tickHeartDemon(state);
    state = tickPets(state);
  }

  const fateNodeIdx = sameYearThread ? null : checkFateNode(state);
  const referenceFateNode = fateNodeIdx !== null ? FATE_NODES.find(n => n.index === fateNodeIdx) : null;
  const isFateNode = false;
  const ctx = buildStateContext(state, recentEvents, narrativeContractFeedback);
  ctx.blueprint = blueprint;

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
  } else {
    try {
      aiOutput = await generateAgeEvent(ctx, isFateNode);
    } catch (llmErr: any) {
      console.error('LLM advance prepare failed, using fallback:', llmErr?.message || llmErr);
      aiOutput = buildFallbackAgeEvent(state, blueprint, ctx, isFateNode);
    }
  }

  return {
    preparedState: state,
    blueprint,
    aiOutput,
    isFateNode,
    fateNode: referenceFateNode,
    recentBlueprintCategories,
    baseAge: char.age,
    baseStateHash: buildAdvanceStateHash(char),
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
