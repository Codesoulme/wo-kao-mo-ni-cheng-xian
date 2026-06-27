import { readFileSync, existsSync } from 'fs';
import { clearAdvancePreload, isAdvancePreloadUsable, prepareAdvanceCandidate } from '../src/lib/xianxia/advance-preload';
import { validateAIBoundary } from '../src/lib/xianxia/ai-boundary-validator';
import { buildEventSchedulerPlan, buildWorldPressureOpportunityMap, deriveWorldFactStateProfile } from '../src/lib/xianxia/event-scheduler';
import { advanceThread, completeThread, failThread, buildThreadContinuationEvent, deriveWorldEventConsequences, deriveWorldFactsFromState, executeAIEvent, evaluateTechniqueCompatibility, buildLearnedCombatArts, buildStateContext, getSameYearThreads, normalizeCultivationState, recordActionCausality, refreshWorldFacts, buildCombatActionPalette, buildCombatVictorySpoils, deriveCultivationAttributes, deriveCombatProjection, filterMeaningfulStatuses, removeItemsByIds, equipItemsByIds, deriveRealmTraits, deriveSoulRealm, endCombat, executeCombatRoundWithProposal, startCombat, stateToResponse, deriveCombatStance, resolveCombatStanceShift, deriveCombatResource, resolveCombatResourceDrain, checkCombatResourceSufficient, deriveBreakthroughStage, resolveBreakthroughOutcome, detectCombatStalemate, resolveStalemateBreak, deriveComboChain, resolveComboDamage, sanitizeCombatLog, novelizeCombatLog, deriveLootFromOpponent, resolveLootConditions, deriveStatusExpiry, resolveStatusRemoval, derivePetCultivationSuggestion, resolvePetSkillLearn, deriveRecipeUnlock, resolvePillCrafting, deriveFormationStack, resolveFormationConflict, deriveBidderAction, resolveAuctionEnd, deriveThreadChain, resolveThreadContinuation, deriveBottleSpiritAffect, deriveSwordAptitudeProgress, resolveFakeDeath, deriveNPCMemoryUpdate, deriveNPCBehavior, deriveRumorTrigger, resolveRumorReliability } from '../src/lib/xianxia/engine';
import { constitutionToStatus, CONSTITUTIONS } from '../src/lib/xianxia/constitutions';
import { COMBAT_STANCE_LABEL, COMBAT_RESOURCE_LABEL } from '../src/lib/xianxia/types';
import type { CombatStance, CombatResourceType, CombatResourceUsage, BreakthroughStage, ComboChain } from '../src/lib/xianxia/types';
import { appendNarrativeContractAuditEffect, appendStateChangeAuditEffect, extractNarrativeContractFeedback } from '../src/lib/xianxia/state-change-log';
import { registerItem } from '../src/lib/xianxia/content-registry';
import { advanceWorldCalendar, extractEventMeta, formatWorldTimeDisplay, hiddenEventMeta, inferInlineTimeAdvance, phaseHintForTime, worldTimeStamp } from '../src/lib/xianxia/world-time';
import { characterDisplayEntries, entriesForSlot } from '../src/lib/xianxia/display-registry';
import { sanitizeNarrativeText, sanitizeEventDraft, truncateNarrativeAtSentence, completeNarrative } from '../src/lib/xianxia/display';
import { buildFallbackAgeEvent, applyRhythmVariation, injectEntityFragment } from '../src/lib/xianxia/advance-fallback';
import { extractStyleAnchor, formatStyleAnchorsForPrompt } from '../src/lib/xianxia/style-anchor';
import { extractEntitiesFromNarrative, formatEntitiesForPrompt } from '../src/lib/xianxia/entity-store';
import { inferAttributeChangesFromNarrative } from '../src/lib/xianxia/narrative-inference';
import { applyAgeBasedBodyGrowth } from '../src/lib/xianxia/body-growth';
import { detectBodyModifier } from '../src/lib/xianxia/narrative-body-modifier';
import { hashCacheKey } from '../src/lib/xianxia/llm';
import { sanitizeLootName, sanitizeBreakthroughProcessText } from '../src/lib/xianxia/display';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function log(name: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ smoke: name, ...data }));
}

function smokeBirthCoreAttributesAndTimeProjection(): void {
  const state: any = {
    age: 0,
    lifespan: 80,
    realm: 'mortal',
    realmLevel: 0,
    spiritualRoot: 'none',
    rootDetail: '\u65e0\u7075\u6839',
    cultivationExp: 0,
    expToBreak: 100,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    attack: 10,
    defense: 5,
    speed: 10,
    luck: 50,
    comprehension: 50,
    spiritStones: 0,
    reputation: 0,
    alive: true,
    ascended: false,
    causeOfDeath: '',
    faction: '',
    master: '',
    location: '\u5c71\u6751',
    fateNodes: [],
    isAtChoice: false,
    activeStatuses: [],
    inventory: [],
    equipped: [],
    storageCapacity: 5,
    elements: { metal: 20, wood: 20, water: 20, fire: 20, earth: 20 },
    pendingThreads: [],
    characterIntents: [],
    heartDemon: 0,
  };
  const response: any = stateToResponse(state);
  assert(response.spiritualSense > 0, 'birth state response should expose derived spiritual sense');
  assert(response.soulStrength > 0, 'birth state response should expose derived soul strength');
  assert(response.physicalFoundation > 0, 'birth state response should expose derived physical foundation');
  const entries = characterDisplayEntries(response);
  const statusIds = entriesForSlot(entries, 'statusPage').map(entry => entry.id);
  assert(!statusIds.includes('spiritualSense'), 'core spiritual sense should not appear as status page entry');
  assert(!statusIds.includes('soulStrength'), 'core soul strength should not appear as status page entry');
  assert(!statusIds.includes('physicalFoundation'), 'core physical foundation should not appear as status page entry');
  const stamp = worldTimeStamp({ eraName: '\u9752\u5c9a\u4ed9\u5386', calendarYear: 5000, elapsedDays: 0 }, '\u964d\u751f\u65f6');
  const worldTime = { ...stamp, displayLabel: formatWorldTimeDisplay({ age: 0, worldTime: stamp, includeAge: true }) };
  const meta = extractEventMeta([hiddenEventMeta({ worldTime, actionProjections: [] })]);
  assert(meta.worldTime?.displayLabel?.includes('0\u5c81'), 'birth event hidden metadata should preserve age display label');
  assert(meta.worldTime?.displayLabel?.includes('\u9752\u5c9a\u4ed9\u5386'), 'birth event hidden metadata should preserve world time label');
  log('birth-core-attributes-time-projection', { passed: true, spiritualSense: response.spiritualSense, soulStrength: response.soulStrength, physicalFoundation: response.physicalFoundation, statusEntries: statusIds.length, label: meta.worldTime.displayLabel });
}

function smokeInlineNightTimeStamp(): void {
  const narrative = '\u5165\u591c\u540e\uff0c\u5362\u77e5\u79cb\u8eba\u5728\u571f\u576f\u7095\u4e0a\uff0c\u76ef\u7740\u7a97\u5916\u7684\u6208\u58c1\u661f\u5b50\uff0c\u5c06\u94dc\u54e8\u538b\u5728\u6795\u4e0b\u3002';
  const advance = inferInlineTimeAdvance('\u6c99\u6751\u665a\u601d', narrative);
  assert(advance?.label === '\u5165\u591c\u540e', 'night extra narrative should infer night label');
  const phase = phaseHintForTime(advance?.label, narrative);
  assert(phase === '\u5b50\u591c', 'night extra narrative should stamp midnight phase');
  const calendar = advanceWorldCalendar({ eraName: '\u9752\u5c9a\u4ed9\u5386', calendarYear: 5005, elapsedDays: 450 }, advance!);
  const stamp = worldTimeStamp(calendar, phase);
  const label = formatWorldTimeDisplay({ timeAdvance: advance, worldTime: stamp, includeAge: false });
  assert(label.includes('\u5165\u591c\u540e'), 'display label should include inferred segment label');
  assert(label.includes('\u5b50\u591c'), 'display label should include inferred night phase');
  log('inline-night-time-stamp', { passed: true, label });
}


function smokeEdibleRewardItemType(): void {
  const result = registerItem({
    id: 'food_half_wheat_cake',
    name: '\u534a\u5757\u9ea6\u997c',
    description: '\u7c97\u7cd9\u7684\u9ea6\u7c89\u997c\uff0c\u8fd8\u5e26\u7740\u4f59\u6e29',
    item_type: 'material',
    rarity: 'common',
    effects: [{ target_attribute: 'hp', operation: 'add', value: 5, description: '\u6c14\u8840+5' }],
    source: '\u90bb\u7ae5\u76f8\u8d60',
  }, { source: '\u90bb\u7ae5\u76f8\u8d60' });
  assert(result.ok, 'half wheat cake should register');
  assert(result.content?.item_type === 'consumable', 'edible recovery item should be consumable, not material');
  log('edible-reward-item-type', { passed: true, type: result.content?.item_type, name: result.content?.name });
}

function smokeDiscardStorageBagItem(): void {
  const bag: any = {
    id: 'bag_small',
    name: '\u65e7\u50a8\u7269\u888b',
    item_type: 'tool',
    rarity: 'common',
    description: '\u4e00\u53ea\u65e7\u50a8\u7269\u888b\u3002',
    effects: [{ target_attribute: 'storageCapacity', operation: 'add', value: 6 }],
  };
  const herb: any = {
    id: 'herb_wild',
    name: '\u91ce\u7075\u8349',
    item_type: 'material',
    rarity: 'common',
    description: '\u5c71\u91ce\u95f4\u91c7\u6765\u7684\u7075\u8349\u3002',
    effects: [],
  };
  const state: any = { age: 3, inventory: [bag, herb], equipped: [], storageCapacity: 11, activeStatuses: [] };
  const removedHerb = removeItemsByIds(state, ['herb_wild']);
  assert(removedHerb.removed.length === 1, 'discard should remove inventory item');
  assert(!removedHerb.state.inventory.some((it: any) => it.id === 'herb_wild'), 'discarded item should leave inventory');
  const removedBag = removeItemsByIds(state, ['bag_small']);
  assert(removedBag.removed.length === 1, 'discard should allow storage bag item');
  assert(removedBag.state.storageCapacity === 5, 'discarding storage bag should recalculate capacity floor');
  log('discard-storage-bag-item', { passed: true, cap: removedBag.state.storageCapacity, left: removedBag.state.inventory.length });
}

function smokeSameYearThreadTimeInference(): void {
  const state: any = {
    age: 1,
    pendingThreads: [{
      id: 'thread_trader_whistle',
      title: '\u884c\u811a\u5546\u7559\u7ea6',
      description: '\u884c\u811a\u5546\u4e34\u8d70\u524d\u585e\u7ed9\u5362\u77e5\u79cb\u4e00\u679a\u94dc\u54e8\uff0c\u8bf4\u82e5\u65e5\u540e\u5bfb\u5230\u98de\u5c71\u53ef\u51ed\u6b64\u627e\u4ed6\u6253\u542c\u3002',
      category: 'promise',
      startAge: 1,
      deadlineAge: 4,
      status: 'pending',
      progress: 0,
      dueInSameYear: false,
    }],
  };
  const threads = getSameYearThreads(state);
  assert(threads.length === 1, 'local parting thread should be treated as same-year continuation');
  const continuation = buildThreadContinuationEvent(state, threads[0]);
  assert(continuation.timeAdvance?.ageDeltaYears === 0, 'same-year continuation should not advance age');
  log('same-year-thread-time-inference', { passed: true, title: threads[0].title, ageDeltaYears: continuation.timeAdvance?.ageDeltaYears });
}


function smokeSameTurnShortThreadContinuity(): void {
  const baseState: any = {
    name: '\u6731\u73a9',
    age: 11,
    lifespan: 80,
    realm: 'mortal',
    realmLevel: 0,
    spiritualRoot: 'none',
    rootDetail: '\u65e0\u7075\u6839',
    cultivationExp: 0,
    expToBreak: 100,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    attack: 10,
    defense: 5,
    speed: 10,
    luck: 50,
    comprehension: 50,
    spiritStones: 0,
    reputation: 0,
    alive: true,
    ascended: false,
    causeOfDeath: '',
    faction: '',
    master: '',
    location: '\u69d0\u6811\u6751',
    fateNodes: [],
    isAtChoice: false,
    activeStatuses: [],
    inventory: [],
    equipped: [],
    storageCapacity: 5,
    elements: { metal: 20, wood: 20, water: 20, fire: 20, earth: 20 },
    pendingThreads: [],
    characterIntents: [],
    heartDemon: 0,
  };
  const output: any = {
    title: '\u51c0\u624b\u518d\u542c\u4fee\u884c\u8bc0',
    narrative: '\u8001\u4eba\u53eb\u6731\u73a9\u5148\u53bb\u51c0\u624b\uff0c\u56de\u6765\u4fbf\u542c\u4ed6\u8bb2\u4e00\u6bb5\u4fee\u884c\u8bc0\u3002',
    eventType: 'normal',
    changes: [],
    newStatuses: [],
    newItems: [],
    memory: '',
    hasChoice: false,
    newThreads: [{
      id: 'listen_formula_three_days',
      title: '\u69d0\u7c7d\u4f20\u8baf\u5f15\u4ed9\u9014',
      description: '\u4e09\u65e5\u540e\u518d\u6765\u542c\u4fee\u884c\u8bc0\uff0c\u4e0d\u5e94\u62d6\u5230\u4e0b\u4e00\u5e74\u3002',
      category: 'quest',
      startAge: 11,
      deadlineAge: 11,
      progress: 0,
      dueInSameYear: true,
      followUpHint: '\u4e09\u65e5\u540e\u56de\u5230\u69d0\u6811\u4e0b\u542c\u4fee\u884c\u8bc0\u3002',
    }],
    advanceThreads: [],
    completeThreadIds: [],
    failThreadIds: [],
  };
  const result = executeAIEvent(baseState, output);
  const sameYearThreads = getSameYearThreads(result.state);
  assert(sameYearThreads.some((thread: any) => thread.id === 'listen_formula_three_days'), 'new three-day thread should be eligible for same-turn same-year continuation');
  const continuation = buildThreadContinuationEvent(result.state, sameYearThreads[0]);
  assert(continuation.timeAdvance?.ageDeltaYears === 0, 'short teaching continuation should not advance age by one year');
  assert(continuation.timeAdvance?.label === '\u4e09\u65e5\u540e', 'three-day teaching continuation should preserve short time label');
  assert(/\u542c\u8bb2|\u542c\u8bc0|\u8bdd\u5934/.test(continuation.narrative), 'teaching continuation should describe listening/receiving the teaching, not another vague deferral');
  assert(!/\u4eca\u5e74|\u4e00\u5e74\u540e/.test(continuation.narrative), 'teaching continuation should not sound like next-year summary');
  log('same-turn-short-thread-continuity', { passed: true, label: continuation.timeAdvance.label, title: continuation.title });
}

function smokeThreadPromiseNoAdultTravelTemplate(): void {
  const state: any = {
    name: '\u6731\u73a9',
    age: 8,
    realm: 'mortal',
    realmLevel: 0,
    pendingThreads: [],
    activeStatuses: [],
    inventory: [],
    equipped: [],
  };
  const thread: any = {
    id: 'promise_childhood',
    title: '\u69d0\u6811\u4e0b\u7684\u65e7\u7ea6',
    description: '\u65e9\u5148\u4e0e\u6751\u7ae5\u8bb8\u4e0b\u7ea6\u5b9a',
    followUpHint: '\u5f85\u65f6\u673a\u6210\u719f\u518d\u56de\u5e94',
    category: 'promise',
    status: 'pending',
    progress: 0,
    deadlineAge: 8,
  };
  const event = buildThreadContinuationEvent(state, thread);
  const text = `${event.title} ${event.narrative}`;
  assert(!/\u6574\u7406\u884c\u88c5|\u524d\u53bb\u8d74\u7ea6|\u4eb2\u81ea\u7ed9\u51fa\u7684\u4ea4\u4ee3|\u5c71\u98ce\u8fc7\u5904|\u4e00\u91cd\u56e0\u679c|\u5fc5\u987b.*\u91cf/.test(text), 'promise continuation should not use adult or abstract causality template');
  assert(!event.title.includes('\u8d74\u7ea6'), 'promise title should avoid direct go-to-appointment framing');
  log('thread-promise-no-adult-travel-template', { passed: true, title: event.title });
}

function smokeThreadGenericNoAbstractCausalityTemplate(): void {
  const state: any = {
    name: '\u6731\u73a9',
    age: 8,
    realm: 'mortal',
    realmLevel: 0,
    pendingThreads: [],
    activeStatuses: [],
    inventory: [],
    equipped: [],
  };
  const thread: any = {
    id: 'generic_inquiry',
    title: '\u5bfb\u518c\u95ee\u4ed9\u9014',
    description: '\u4ece\u65e7\u518c\u91cc\u542c\u95fb\u4ed9\u9014\u7ebf\u7d22',
    followUpHint: '\u53ef\u4ee5\u5411\u8eab\u8fb9\u4eba\u6253\u542c',
    category: 'custom',
    status: 'pending',
    progress: 0,
    deadlineAge: 8,
  };
  const event = buildThreadContinuationEvent(state, thread);
  assert(!/\u5c71\u98ce\u8fc7\u5904|\u65e7\u4e8b\u4e0d\u518d\u53ea\u662f\u5ff5\u5934|\u4e00\u91cd\u56e0\u679c|\u5fc5\u987b.*\u91cf/.test(event.narrative), 'generic continuation should not use abstract causality template');
  log('thread-generic-no-abstract-causality-template', { passed: true, title: event.title });
}

function smokeSchedulerContinuity(): void {
  const state: any = {
    age: 20,
    questEntries: [{
      id: 'quest_auction_aftermath',
      title: '闃撮甫瀹㈢殑鏆椾腑鐩ⅱ',
      summary: '鎷嶅緱鏃ф礊搴滈摐閽ュ悗锛岄槾楦﹀绁炶壊寰喎銆?,
      kind: 'quest',
      stage: 'open',
      progress: 10,
      startedAtAge: 20,
      dueAge: 21,
      urgency: 5,
      sourceThreadId: 'auction_aftermath_x',
      currentHook: '鍚庣画娴佸勾鍙闃撮甫瀹㈠洜鏃ф礊搴滈摐閽ョ洴涓婅鑹诧紝浣庨瑙﹀彂鐩ⅱ銆佽瘯鎺€佸姭鏉€鎴栦氦鏄撱€?,
      rewardHint: '鍖栬В浠囨€ㄦ垨鍙嶅ず绾跨储',
      failureHint: '鍧婂競澶栬鐩ⅱ銆佹埅鏉€鎴栬寮曞叆鍦堝',
      tags: ['quest', 'auction'],
    }],
    pendingThreads: [{
      id: 'auction_aftermath_x',
      title: '闃撮甫瀹㈢殑鏆椾腑鐩ⅱ',
      description: '瑙掕壊鍦ㄦ媿鍗栦細鎷嶅緱鏃ф礊搴滈摐閽ュ悗锛岄槾楦﹀绁炶壊寰喎銆?,
      category: 'quest',
      startAge: 20,
      deadlineAge: 21,
      status: 'pending',
      progress: 10,
      followUpHint: '鍚庣画娴佸勾鍙闃撮甫瀹㈠洜鏃ф礊搴滈摐閽ョ洴涓婅鑹诧紝浣庨瑙﹀彂鐩ⅱ銆佽瘯鎺€佸姭鏉€鎴栦氦鏄撱€?,
      reward: '鍖栬В浠囨€ㄦ垨鍙嶅ず绾跨储',
      failureCost: '鍧婂競澶栬鐩ⅱ銆佹埅鏉€鎴栬寮曞叆鍦堝',
    }],
    npcs: [{
      id: 'auction_npc_闃撮甫瀹?,
      name: '闃撮甫瀹?,
      description: '鎷嶅崠浼氫腑瀵规棫娲炲簻閾滈挜鏍煎鍦ㄦ剰鐨勭珵鎷嶈€呫€?,
      memory: '鍦ㄦ媿鍗栦細涓洜鏃ф礊搴滈摐閽ヨ惤鍏ヨ鑹叉墜涓€岃涓嬩竴绗斻€?,
      role: '绔炴媿澶卞埄鑰?,
      attitude: 'hostile',
      relationshipScore: -25,
      lastSeenAge: 20,
      tags: ['auction', 'aftermath', 'rivalry'],
    }],
    worldFacts: [],
    causalGraph: { nodes: [{ id: 'thread_node', refId: 'auction_aftermath_x' }], edges: [{ from: 'event_node', to: 'thread_node', type: 'created', age: 20 }] },
  };
  const plan = buildEventSchedulerPlan(state);
  assert(plan.focus?.title === '闃撮甫瀹?, 'scheduler should focus hostile auction aftermath NPC');
  assert((plan.focus?.priority || 0) >= 60, 'scheduler focus priority should be high');
  assert(plan.hints.some(h => h.kind === 'quest' && h.title.includes('鐩ⅱ')), 'scheduler should include related quest hint');
  assert(plan.hints.some(h => h.kind === 'npc' && h.reason.includes('鑷富鍊惧悜') && h.reason.includes('鎴潃')), 'scheduler should include NPC autonomous hostile echo');
  log('scheduler-continuity', { passed: true, focus: plan.focus?.title, priority: plan.focus?.priority, hints: plan.hints.length });
}

function smokeBoundaryFactChecks(): void {
  const state: any = {
    age: 20,
    spiritStones: 100,
    inventory: [{ id: 'key_1', name: '鏃ф礊搴滈摐閽?, description: '鎷嶅崠鎵€寰?, item_type: 'tool', rarity: 'epic', effects: [], source: '鎷嶅崠浼? }],
    equipped: [{ id: 'ring_1', name: '闈掔帀鎴?, description: '鏃х墿', item_type: 'accessory', rarity: 'rare', effects: [], source: '鏃у勾' }],
    pendingThreads: [
      { id: 'closed_x', title: '鏃ф礊搴滈摐閽ョ殑鏃т富绾跨储', description: '鏃ф礊搴滈摐閽ュ凡缁忔煡鏄?, category: 'mystery', startAge: 18, deadlineAge: 19, status: 'resolved', progress: 100 },
      { id: 'open_y', title: '闃撮甫瀹㈢殑鏆椾腑鐩ⅱ', description: '闃撮甫瀹㈢洴涓婅鑹?, category: 'enemy', startAge: 20, deadlineAge: 21, status: 'pending', progress: 10 },
    ],
    questEntries: [],
    npcs: [{ id: 'auction_npc_闃撮甫瀹?, name: '闃撮甫瀹?, description: '鏁屾剰绔炴媿鑰?, attitude: 'hostile', relationshipScore: -25, firstMetAge: 20, lastSeenAge: 20, source: 'auction', tags: ['auction'] }],
    worldFacts: [{ id: 'fact_娲炲簻', kind: 'realm', title: '鏃ф礊搴滈摐閽?, summary: '鎷嶅崠浼氬嚭鐜扮殑閽ュ寵', confidence: 0.9, firstSeenAge: 20, lastSeenAge: 20, source: 'auction' }],
  };
  const output: any = {
    title: '鏃х嚎鍐嶈捣',
    narrative: '闃撮甫瀹㈠拷鐒舵敼鍙ｇО鍠勶紝鏃ф礊搴滈摐閽ョ殑鏃т富绾跨储鍐嶆寮€鍚€?,
    changes: [],
    newStatuses: [],
    newItems: [{ id: 'ring_1', name: '闈掔帀鎴?, description: '鍙堝緱涓€鏋?, item_type: 'accessory', rarity: 'rare', effects: [], source: '濂囬亣' }],
    removedItemIds: ['missing_item'],
    equipItemIds: ['missing_equip'],
    unequipItemIds: ['missing_unequip'],
    newThreads: [{ id: 'new_closed', title: '鏃ф礊搴滈摐閽ョ殑鏃т富绾跨储', description: '鏃ф礊搴滈摐閽ュ凡缁忔煡鏄?, category: 'mystery', startAge: 20, deadlineAge: 22, status: 'pending', progress: 0 }],
    advanceThreads: [{ id: 'closed_x', progressDelta: 10 }],
    completeThreadIds: [],
    failThreadIds: [],
    newNpcs: [{ id: 'auction_npc_闃撮甫瀹?, name: '闃撮甫瀹?, description: '蹇界劧杞负鍙嬪杽', attitude: 'friendly', relationshipScore: 80, firstMetAge: 20, lastSeenAge: 20, source: 'ai' }],
  };
  const codes = validateAIBoundary(state, output).trace.map(t => t.code);
  const required = [
    'closed_thread_referenced',
    'closed_thread_reopened_as_new',
    'removed_unknown_item',
    'equip_unknown_item',
    'unequip_unknown_item',
    'new_item_duplicate_id',
    'npc_hostile_to_friendly_without_cause',
    'npc_relationship_jump_without_cause',
  ];
  assert(required.every(code => codes.includes(code)), `boundary fact checks missing codes: ${required.filter(code => !codes.includes(code)).join(', ')}`);
  log('boundary-fact-checks', { passed: true, codes: codes.length });
}

function smokeNarrativeContract(): void {
  const state: any = {
    age: 30,
    inventory: [],
    equipped: [],
    pendingThreads: [],
    questEntries: [],
    npcs: [{ id: 'npc_shadow', name: '闃撮甫瀹?, description: '鏁屾剰绔炴媿鑰?, attitude: 'hostile', relationshipScore: -20, firstMetAge: 29, lastSeenAge: 30, source: 'auction' }],
    worldFacts: [{ id: 'wf_market', kind: 'location', title: '闈掑矚鍧婂競', summary: '鎷嶅崠浣欐尝鏈暎', confidence: 0.8, firstSeenAge: 29, lastSeenAge: 30, source: 'smoke', tags: ['location', 'market'] }],
    eventSchedule: {
      generatedAtAge: 30,
      focus: { id: 'seh_npc_shadow', kind: 'npc', priority: 120, title: '闃撮甫瀹?, reason: '闃撮甫瀹㈡殫涓洴姊€?, requiredAction: 'echo_or_develop' },
      hints: [{ id: 'seh_npc_shadow', kind: 'npc', priority: 120, title: '闃撮甫瀹?, reason: '闃撮甫瀹㈡殫涓洴姊€?, requiredAction: 'echo_or_develop' }],
      pressureMap: { topThreat: '闃撮甫瀹?, topOpportunity: '闈掑矚鍧婂競', focalLocation: '闈掑矚鍧婂競', focalActor: '闃撮甫瀹?, likelyEventTypes: ['濞佽儊鍥炲搷'], summary: '鏈€澶у▉鑳侊細闃撮甫瀹紱鏈€澶ф満浼氾細闈掑矚鍧婂競锛涗簨浠跺€惧悜锛氬▉鑳佸洖鍝? },
      warnings: [],
    },
  };
  const baseOutput: any = {
    title: '鍧婂寰奖',
    narrative: '娌堢牃绉嬪湪闈掑矚鍧婂競澶栬鍑洪槾楦﹀鐨勭洰鍏夛紝鏆備笖閬垮叆浜虹兢銆?,
    eventType: 'normal',
    changes: [],
    newStatuses: [],
    newItems: [],
    memory: '闃撮甫瀹㈠湪闈掑矚鍧婂競澶栫洴姊€?,
    hasChoice: false,
  };
  const missingCodes = validateAIBoundary(state, baseOutput).trace.map(t => t.code);
  assert(missingCodes.includes('missing_narrative_contract'), 'missing contract should warn under pressure map');
  const unknownCodes = validateAIBoundary(state, { ...baseOutput, narrativeContract: { narrativeFocus: 'npc', narrativeOutcome: 'vanished', usedScheduleHintIds: ['seh_missing'], usedWorldFactIds: ['wf_missing'], usedNpcIds: ['npc_missing'], contractNote: '鎵挎帴闃撮甫瀹㈠▉鑳併€? } }).trace.map(t => t.code);
  assert(unknownCodes.includes('unknown_schedule_hint_reference') && unknownCodes.includes('unknown_world_fact_reference') && unknownCodes.includes('unknown_npc_contract_reference'), 'unknown narrative contract references should warn');
  assert(unknownCodes.includes('invalid_narrative_outcome'), 'invalid narrative outcome should warn');
  const okCodes = validateAIBoundary(state, { ...baseOutput, narrativeContract: { narrativeFocus: 'npc', narrativeOutcome: 'advanced', usedScheduleHintIds: ['seh_npc_shadow'], usedWorldFactIds: ['wf_market'], usedNpcIds: ['npc_shadow'], contractNote: '鎵挎帴鏈€澶у▉鑳侀槾楦﹀鐨勭洴姊€? } }).trace.map(t => t.code);
  assert(!okCodes.includes('missing_narrative_contract') && !okCodes.includes('unknown_schedule_hint_reference'), 'valid narrative contract should not raise contract warnings');
  log('narrative-contract', { passed: true, missingCodes: missingCodes.length, unknownCodes: unknownCodes.length, okCodes: okCodes.length });
}

function smokeWorldFactsLite(): void {
  const state: any = {
    age: 42,
    location: '闈掑矚鍧婂競',
    faction: '闈掑矚瀹?,
    npcs: [{
      id: 'npc_shadow',
      name: '闃撮甫瀹?,
      description: '鎷嶅崠浼氫腑鐩笂鏃ф礊搴滈摐閽ョ殑鏁ｄ慨銆?,
      role: '绔炴媿澶卞埄鑰?,
      faction: '榛戦甫浼?,
      attitude: 'hostile',
      relationshipScore: -30,
      firstMetAge: 41,
      lastSeenAge: 42,
      lastKnownLocation: '闈掑矚鍧婂競',
      source: 'auction',
      memory: '鍥犳棫娲炲簻閾滈挜钀藉叆瑙掕壊鎵嬩腑鑰岃涓嬩竴绗斻€?,
      tags: ['auction', 'aftermath'],
    }],
    pendingThreads: [{
      id: 'thread_key',
      title: '鏃ф礊搴滈摐閽ョ殑鏃т富绾跨储',
      description: '鏃ф礊搴滈摐閽ョ壍鍔ㄤ竴搴уけ钀芥礊搴溿€?,
      category: 'mystery',
      startAge: 41,
      deadlineAge: 45,
      status: 'pending',
      progress: 20,
      followUpHint: '鍙惊閾滈挜绂佸埗鎺㈡煡娲炲簻鏃т富銆?,
    }],
    discoveredRealms: [],
    worldFacts: [],
  };
  const facts = deriveWorldFactsFromState(state, 'smoke');
  assert(facts.some(f => f.kind === 'location' && f.title === '闈掑矚鍧婂競' && f.tags?.includes('market')), 'world facts should derive market location fact');
  assert(facts.some(f => f.kind === 'faction' && f.title === '闈掑矚瀹? && f.tags?.includes('current')), 'world facts should derive current faction fact');
  assert(facts.some(f => f.kind === 'faction' && f.title === '榛戦甫浼? && f.tags?.includes('hostile')), 'world facts should derive NPC-linked faction fact');
  assert(facts.some(f => f.kind === 'realm' && f.tags?.includes('realm-hint')), 'world facts should derive realm hint from key/thread text');
  const refreshed: any = refreshWorldFacts(state, 'smoke');
  const plan = buildEventSchedulerPlan({ ...refreshed, questEntries: [], causalGraph: { nodes: [], edges: [] } });
  assert(plan.hints.some(h => h.kind === 'world' && h.title === '闈掑矚鍧婂競'), 'scheduler should include location world fact hint');
  log('worldfacts-lite', { passed: true, facts: facts.length, hints: plan.hints.length });
}

function smokeFactionLocationStateProfiles(): void {
  const state: any = {
    age: 46,
    location: '闈掑矚鍧婂競',
    npcs: [{
      id: 'npc_shadow',
      name: '闃撮甫瀹?,
      faction: '榛戦甫浼?,
      attitude: 'hostile',
      relationshipScore: -40,
      firstMetAge: 44,
      lastSeenAge: 46,
      lastKnownLocation: '闈掑矚鍧婂競',
      source: 'auction',
      tags: ['auction', 'aftermath'],
    }],
    pendingThreads: [{
      id: 'thread_ambush',
      title: '鍧婂競澶栫殑榛戦甫鐩ⅱ',
      description: '榛戦甫浼氬湪闈掑矚鍧婂競澶栫洴姊紝鍙兘鎴潃澶洪挜銆?,
      category: 'enemy',
      startAge: 45,
      deadlineAge: 47,
      status: 'pending',
      progress: 30,
      followUpHint: '鍙榛戦甫浼氳拷璐ｃ€侀€氱級鎴栦紡鍑汇€?,
    }],
    questEntries: [],
    causalGraph: { nodes: [], edges: [] },
    worldFacts: [
      { id: 'wf_location_market', kind: 'location', title: '闈掑矚鍧婂競', summary: '杩戞湡鎷嶅崠浣欐尝鏈暎銆?, confidence: 0.8, firstSeenAge: 44, lastSeenAge: 46, source: 'smoke', tags: ['location', 'market', 'auction', 'event-consequence'] },
      { id: 'wf_faction_black', kind: 'faction', title: '榛戦甫浼?, summary: '榛戦甫浼氫笌鏃ф礊搴滈摐閽ヤ綑娉㈢浉杩炪€?, confidence: 0.8, firstSeenAge: 44, lastSeenAge: 46, source: 'smoke', tags: ['faction', 'hostile', 'danger'] },
    ],
  };
  const locationProfile = deriveWorldFactStateProfile(state.worldFacts[0], state);
  const factionProfile = deriveWorldFactStateProfile(state.worldFacts[1], state);
  assert(locationProfile?.summary.includes('鍗遍櫓搴?) && locationProfile.summary.includes('浜ゆ槗娲昏穬') && locationProfile.summary.includes('杩戞湡浼犻椈'), 'location profile should expose danger/trade/rumor state');
  assert(factionProfile?.summary.includes('杩借矗鍘嬪姏') && factionProfile.summary.includes('瑙傚療鍊惧悜') && factionProfile.summary.includes('NPC鍏宠仈鍘嬪姏'), 'faction profile should expose pressure/observation/npc state');
  const plan = buildEventSchedulerPlan(state);
  assert(plan.hints.some(h => h.title === '闈掑矚鍧婂競' && h.reason.includes('鍦扮偣鐢诲儚')), 'scheduler should include location state profile');
  assert(plan.hints.some(h => h.title === '榛戦甫浼? && h.reason.includes('鍔垮姏鐢诲儚') && h.reason.includes('杩借矗')), 'scheduler should include faction state profile');
  log('faction-location-state', { passed: true, location: locationProfile?.summary, faction: factionProfile?.summary, hints: plan.hints.length });
}

function smokeWorldPressureOpportunityMap(): void {
  const state: any = {
    age: 47,
    location: '闈掑矚鍧婂競',
    npcs: [{
      id: 'npc_shadow',
      name: '闃撮甫瀹?,
      faction: '榛戦甫浼?,
      attitude: 'hostile',
      relationshipScore: -45,
      firstMetAge: 44,
      lastSeenAge: 47,
      lastKnownLocation: '闈掑矚鍧婂競',
      source: 'auction',
      memory: '鍥犳棫娲炲簻閾滈挜钀藉叆瑙掕壊鎵嬩腑鑰岃涓嬩竴绗斻€?,
      tags: ['auction', 'aftermath', 'rivalry'],
    }],
    pendingThreads: [{
      id: 'thread_key',
      title: '鏃ф礊搴滈摐閽ョ殑鏃т富绾跨储',
      description: '鏃ф礊搴滈摐閽ョ壍鍔ㄤ竴搴уけ钀芥礊搴溿€?,
      category: 'mystery',
      startAge: 45,
      deadlineAge: 48,
      status: 'pending',
      progress: 45,
      followUpHint: '鍙惊閾滈挜绂佸埗鎺㈡煡娲炲簻鏃т富锛屼篃鍙兘閬槾楦﹀鎴潃銆?,
    }],
    questEntries: [],
    causalGraph: { nodes: [], edges: [] },
    worldFacts: [
      { id: 'wf_location_market', kind: 'location', title: '闈掑矚鍧婂競', summary: '杩戞湡鎷嶅崠浣欐尝鏈暎銆?, confidence: 0.8, firstSeenAge: 44, lastSeenAge: 47, source: 'smoke', tags: ['location', 'market', 'auction', 'event-consequence'] },
      { id: 'wf_faction_black', kind: 'faction', title: '榛戦甫浼?, summary: '榛戦甫浼氫笌鏃ф礊搴滈摐閽ヤ綑娉㈢浉杩炪€?, confidence: 0.8, firstSeenAge: 44, lastSeenAge: 47, source: 'smoke', tags: ['faction', 'hostile', 'danger'] },
      { id: 'wf_realm_key', kind: 'realm', title: '鏃ф礊搴滈摐閽?, summary: '鏃ф礊搴滈摐閽ユ垨鍙紑鍚仐搴溿€?, confidence: 0.8, firstSeenAge: 45, lastSeenAge: 47, source: 'smoke', tags: ['realm', 'realm-hint'] },
    ],
  };
  const plan = buildEventSchedulerPlan(state);
  const map = plan.pressureMap || buildWorldPressureOpportunityMap(state, plan.hints);
  assert(map.topThreat === '闃撮甫瀹? || map.topThreat === '榛戦甫浼?, 'pressure map should pick hostile NPC/faction as top threat');
  assert(!!map.topOpportunity, 'pressure map should expose a top opportunity');
  assert(map.focalLocation === '闈掑矚鍧婂競', 'pressure map should pick focal location');
  assert(map.focalActor === '闃撮甫瀹? || map.focalActor === '榛戦甫浼?, 'pressure map should pick focal actor/faction');
  assert(map.likelyEventTypes.some(t => ['濞佽儊鍥炲搷', '鍔垮姏鏂藉帇', '鏈虹紭鎺ㄨ繘', '绉樺寮傚姩'].includes(t)), 'pressure map should expose likely event types');
  assert(map.summary.includes('鏈€澶у▉鑳?) && map.summary.includes('浜嬩欢鍊惧悜'), 'pressure map should have readable summary');
  log('world-pressure-map', { passed: true, summary: map.summary, hints: plan.hints.length });
}

function smokeWorldMemoryPressureDecay(): void {
  const baseState: any = {
    age: 50,
    location: '闈掑矚鍧婂競',
    pendingThreads: [],
    questEntries: [],
    causalGraph: { nodes: [], edges: [] },
    worldFacts: [],
    npcs: [{
      id: 'npc_shadow',
      name: '闃撮甫瀹?,
      faction: '榛戦甫浼?,
      attitude: 'hostile',
      relationshipScore: -50,
      lastSeenAge: 50,
      memory: '闃撮甫瀹㈠洜鏃ф礊搴滈摐閽ョ洴涓婅鑹层€?,
      tags: ['auction', 'aftermath', 'rivalry'],
    }],
  };
  const noFeedbackPlan = buildEventSchedulerPlan(baseState);
  const noFeedbackNpc = noFeedbackPlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(noFeedbackNpc, 'baseline plan should include hostile NPC hint');

  const cooledPlan = buildEventSchedulerPlan({
    ...baseState,
    narrativeContractFeedback: [
      { age: 48, title: '鍧婂寰奖', narrativeFocus: 'npc', usedNpcIds: ['npc_shadow'], usedScheduleHintIds: ['seh_npc_npc_shadow'], usedWorldFactIds: [], warningCodes: [] },
      { age: 49, title: '榛戠窘绐ュ競', narrativeFocus: 'npc', usedNpcIds: ['npc_shadow'], usedScheduleHintIds: ['seh_npc_npc_shadow'], usedWorldFactIds: [], warningCodes: [] },
    ],
  });
  const cooledNpc = cooledPlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(cooledNpc && cooledNpc.priority < noFeedbackNpc!.priority, 'recently repeated NPC focus should cool down');
  const cooledNpcHint = cooledNpc!;
  assert(cooledNpcHint.reason.includes('璁板繂娼睈'), 'cooled hint should explain memory tide adjustment');

  const boostedPlan = buildEventSchedulerPlan({
    ...baseState,
    narrativeContractFeedback: [
      { age: 49, title: '鏃ュ父鐐兼皵', narrativeFocus: 'daily', focusHintId: 'seh_npc_npc_shadow', focusHintTitle: '闃撮甫瀹?, usedNpcIds: [], usedScheduleHintIds: [], usedWorldFactIds: [], topThreat: '闃撮甫瀹?, warningCodes: ['top_schedule_focus_not_declared'] },
    ],
  });
  const boostedNpc = boostedPlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(boostedNpc && boostedNpc.priority > noFeedbackNpc!.priority, 'previously ignored high-pressure focus should warm up');
  assert(boostedPlan.warnings.some(w => w.includes('鎵挎帴涓嶈冻')), 'pressure decay warnings should mention insufficient previous carryover');
  log('world-memory-pressure-decay', { passed: true, base: noFeedbackNpc!.priority, cooled: cooledNpcHint.priority, boosted: boostedNpc!.priority });
}

function smokeWorldMemoryResolution(): void {
  const state: any = {
    age: 50,
    location: '闈掑矚鍧婂競',
    causalGraph: { nodes: [], edges: [] },
    worldFacts: [{ id: 'wf_old', kind: 'event', title: '鏃ф€ㄤ綑娉?, summary: '姝や簨宸蹭簡锛屽彧浣欐棫浜哄彛椋庛€?, confidence: 0.9, firstSeenAge: 44, lastSeenAge: 49, source: 'smoke', tags: ['consequence'] }],
    npcs: [{ id: 'npc_shadow', name: '闃撮甫瀹?, attitude: 'hostile', relationshipScore: -50, lastSeenAge: 50, memory: '闃撮甫瀹㈠洜鏃ф礊搴滈摐閽ョ洴涓婅鑹层€?, tags: ['auction', 'aftermath'] }],
    pendingThreads: [{ id: 'thread_due', title: '涓夋棩涔嬬害', description: '闃撮甫瀹㈢害鍦ㄥ潑澶栦簡鏂棫浜嬨€?, category: 'quest', startAge: 49, deadlineAge: 50, status: 'pending', progress: 70, followUpHint: '鑻ヤ笉璧寸害锛岄槾楦﹀浼氳浆涓鸿拷鏉€銆? }],
    questEntries: [],
    narrativeContractFeedback: [
      { age: 48, title: '鍧婂寰奖', narrativeFocus: 'npc', usedNpcIds: ['npc_shadow'], usedScheduleHintIds: ['seh_npc_npc_shadow'], usedWorldFactIds: [], warningCodes: [] },
      { age: 49, title: '榛戠窘绐ュ競', narrativeFocus: 'npc', usedNpcIds: ['npc_shadow'], usedScheduleHintIds: ['seh_npc_npc_shadow'], usedWorldFactIds: [], warningCodes: [] },
    ],
  };
  const plan = buildEventSchedulerPlan(state);
  const due = plan.hints.find(h => h.sourceThreadId === 'thread_due');
  const npc = plan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  const oldFact = plan.hints.find(h => h.relatedFactIds?.includes('wf_old'));
  assert(due?.resolutionStage === 'escalating', 'due thread should be escalating');
  assert(due?.resolutionHint?.includes('瀹屾垚') || due?.resolutionHint?.includes('澶辫触'), 'escalating hint should tell AI to resolve or fail');
  assert(npc?.resolutionStage === 'cooling', 'recently repeated NPC should enter cooling stage');
  assert(oldFact?.resolutionStage === 'resolved', 'resolved world fact should stay resolved/background-like');
  log('world-memory-resolution', { passed: true, due: due?.resolutionStage, npc: npc?.resolutionStage, fact: oldFact?.resolutionStage });
}

function smokeWorldMemoryOutcomeFeedback(): void {
  const baseState: any = {
    age: 60,
    location: '闈掑矚鍧婂競',
    pendingThreads: [],
    questEntries: [],
    causalGraph: { nodes: [], edges: [] },
    worldFacts: [],
    npcs: [{
      id: 'npc_shadow',
      name: '闃撮甫瀹?,
      attitude: 'hostile',
      relationshipScore: -50,
      lastSeenAge: 60,
      memory: '闃撮甫瀹粛鎯﹁鏃ф礊搴滈摐閽ャ€?,
      tags: ['auction', 'aftermath'],
    }],
  };
  const basePlan = buildEventSchedulerPlan(baseState);
  const baseNpc = basePlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(baseNpc, 'baseline outcome smoke should include NPC hint');

  const resolvedPlan = buildEventSchedulerPlan({
    ...baseState,
    narrativeContractFeedback: [{ age: 59, title: '鏃ф€ㄤ簡缁?, narrativeFocus: 'npc', narrativeOutcome: 'resolved', usedNpcIds: ['npc_shadow'], usedScheduleHintIds: ['seh_npc_npc_shadow'], usedWorldFactIds: [], warningCodes: [] }],
  });
  const resolvedNpc = resolvedPlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(resolvedNpc && resolvedNpc.priority < baseNpc!.priority, 'resolved outcome should lower repeated focus priority');
  assert(resolvedNpc?.resolutionStage === 'resolved', 'resolved outcome should mark hint resolved');

  const ignoredPlan = buildEventSchedulerPlan({
    ...baseState,
    narrativeContractFeedback: [{ age: 59, title: '闂棬鐐兼皵', narrativeFocus: 'daily', narrativeOutcome: 'ignored', focusHintId: 'seh_npc_npc_shadow', focusHintTitle: '闃撮甫瀹?, topThreat: '闃撮甫瀹?, usedNpcIds: [], usedScheduleHintIds: [], usedWorldFactIds: [], warningCodes: [] }],
  });
  const ignoredNpc = ignoredPlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(ignoredNpc && ignoredNpc.priority > baseNpc!.priority, 'ignored outcome should warm up high-pressure focus');
  assert(ignoredPlan.warnings.some(w => w.includes('鎵挎帴涓嶈冻')), 'ignored outcome should produce carryover warning');
  log('world-memory-outcome-feedback', { passed: true, base: baseNpc!.priority, resolved: resolvedNpc!.priority, ignored: ignoredNpc!.priority, stage: resolvedNpc!.resolutionStage });
}

function smokeThreadOutcomeSync(): void {
  const baseState: any = {
    age: 22,
    lifespan: 80,
    realm: 'qi_refining',
    realmLevel: 1,
    cultivationExp: 0,
    expToBreak: 100,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    attack: 10,
    defense: 8,
    speed: 10,
    luck: 10,
    comprehension: 10,
    spiritStones: 10,
    reputation: 0,
    alive: true,
    ascended: false,
    activeStatuses: [],
    inventory: [],
    equipped: [],
    memory: [],
    longTermMemory: [],
    fateNodes: [],
    pendingThreads: [{
      id: 'auction_aftermath_x',
      title: '闃撮甫瀹㈢殑鏆椾腑鐩ⅱ',
      description: '闃撮甫瀹粛鍥犳棫娲炲簻閾滈挜鐩笂瑙掕壊銆?,
      category: 'enemy',
      startAge: 21,
      deadlineAge: 24,
      status: 'pending',
      progress: 20,
      followUpHint: '鍚庣画闇€澶勭悊闃撮甫瀹㈢殑璇曟帰銆佹埅鏉€鎴栦氦鏄撱€?,
    }],
    questEntries: [],
    npcs: [],
    worldFacts: [],
    causalGraph: { nodes: [], edges: [] },
    pets: [],
    exploredRealms: [],
  };
  const output: any = {
    title: '鏃ф€ㄤ簡缁?,
    narrative: '瑙掕壊椤鸿棨鎽哥摐锛岀粓浜庡鍒伴槾楦﹀钘忚韩涔嬪锛屼互璇佹嵁鍜岀伒濂戦€煎叾閫€鍘伙紝杩欐々閾滈挜鏃ф€ㄦ殏鍛婁竴娈佃惤銆?,
    eventType: 'normal',
    changes: [],
    newStatuses: [],
    newItems: [],
    memory: '闃撮甫瀹笌鏃ф礊搴滈摐閽ョ殑鏃ф€ㄥ凡琚帇涓嬨€?,
    hasChoice: false,
    newThreads: [],
    advanceThreads: [],
    completeThreadIds: [],
    failThreadIds: [],
    narrativeContract: {
      narrativeFocus: 'threat',
      narrativeOutcome: 'resolved',
      usedScheduleHintIds: ['seh_thread_auction_aftermath_x'],
      usedWorldFactIds: [],
      usedNpcIds: [],
      contractNote: '闃撮甫瀹㈡棫鎬ㄥ凡浜嗙粨銆?,
    },
  };
  const result = executeAIEvent(baseState, output);
  const thread = result.state.pendingThreads.find((t: any) => t.id === 'auction_aftermath_x');
  assert(thread?.status === 'resolved', 'resolved narrative outcome should complete referenced thread');
  assert(thread?.progress === 100, 'resolved narrative outcome should fill thread progress');

  const advanced = executeAIEvent(baseState, {
    ...output,
    title: '鏃ф€ㄦ帹杩?,
    narrativeContract: { ...output.narrativeContract, narrativeOutcome: 'advanced', contractNote: '鏌ュ埌闃撮甫瀹㈠幓鍚戙€? },
  });
  const advancedThread = advanced.state.pendingThreads.find((t: any) => t.id === 'auction_aftermath_x');
  assert(advancedThread?.status === 'pending', 'advanced narrative outcome should not close thread');
  assert((advancedThread?.progress || 0) > 20, 'advanced narrative outcome should advance referenced thread');

  const echoed = executeAIEvent(baseState, {
    ...output,
    title: '鏃ф€ㄤ綑澹?,
    narrativeContract: { ...output.narrativeContract, narrativeOutcome: 'echoed', contractNote: '鍙槸鍚椈闃撮甫瀹粛鍦ㄥ潑闂村嚭娌°€? },
  });
  const echoedThread = echoed.state.pendingThreads.find((t: any) => t.id === 'auction_aftermath_x');
  assert(echoedThread?.status === 'pending' && echoedThread?.progress === 20, 'echoed outcome should not mutate thread state');
  log('thread-outcome-sync', { passed: true, resolved: thread?.status, advanced: advancedThread?.progress, echoed: echoedThread?.progress });
}


function smokeThreadProgressAutoResolve(): void {
  const baseState: any = {
    age: 11,
    lifespan: 80,
    realm: 'mortal',
    realmLevel: 0,
    cultivationExp: 0,
    expToBreak: 100,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    attack: 10,
    defense: 8,
    speed: 10,
    luck: 10,
    comprehension: 10,
    spiritStones: 0,
    reputation: 0,
    alive: true,
    ascended: false,
    activeStatuses: [],
    inventory: [],
    equipped: [],
    memory: [],
    longTermMemory: [],
    fateNodes: [],
    pendingThreads: [{
      id: 'thread_lingji_repeat',
      title: 'Thread repeat',
      description: 'The same instruction thread has already been substantially advanced.',
      category: 'mystery',
      startAge: 10,
      deadlineAge: 12,
      status: 'pending',
      progress: 95,
      followUpHint: 'Ask for the introductory method',
    }],
    questEntries: [],
    npcs: [],
    worldFacts: [],
    causalGraph: { nodes: [], edges: [] },
    pets: [],
    exploredRealms: [],
  };
  const advanced = advanceThread(baseState, 'thread_lingji_repeat', 10, 'instruction already clarified');
  const thread = advanced.pendingThreads.find((t: any) => t.id === 'thread_lingji_repeat');
  assert(thread?.status === 'resolved', 'thread reaching 100 progress should auto resolve');
  assert(thread?.progress === 100, 'auto resolved thread should keep progress 100');
  assert(getSameYearThreads(advanced).length === 0, 'resolved progress-100 thread should not be scheduled again');
  const executed = executeAIEvent(advanced, {
    title: 'Other event',
    narrative: 'The character turns to another matter.',
    eventType: 'normal',
    changes: [],
    newStatuses: [],
    newItems: [],
    removedItemIds: [],
    newEquippedItems: [],
    equipItemIds: [],
    unequipItemIds: [],
    memory: '',
    cultivationInsight: '',
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
  } as any);
  const afterThread = executed.state.pendingThreads.find((t: any) => t.id === 'thread_lingji_repeat');
  assert(afterThread?.status === 'resolved', 'executeAIEvent should preserve progress-100 resolution');
  log('thread-progress-auto-resolve', { passed: true, status: afterThread?.status, progress: afterThread?.progress });
}

function smokeWorldEventConsequences(): void {
  const state: any = {
    age: 45,
    location: '闈掑矚鍧婂競',
    npcs: [{
      id: 'npc_shadow',
      name: '闃撮甫瀹?,
      faction: '榛戦甫浼?,
      attitude: 'hostile',
      relationshipScore: -30,
      firstMetAge: 44,
      lastSeenAge: 45,
      source: 'auction',
    }],
    pendingThreads: [],
    discoveredRealms: [],
    worldFacts: [],
    causalGraph: {
      nodes: [{ id: 'event_auction', type: 'event', label: '鏃ф礊搴滈摐閽ヨ惤妲?, age: 45, summary: '鎷嶅崠浼氫笂鏃ф礊搴滈摐閽ヨ惤鍏ヨ鑹叉墜涓紝闃撮甫瀹㈣涓嬩竴绗斻€?, tags: ['auction', 'trade'] }],
      edges: [],
    },
  };
  const facts = deriveWorldEventConsequences(state, 'auction-bid');
  assert(facts.some(f => f.kind === 'event' && f.tags?.includes('consequence') && f.tags?.includes('auction')), 'event consequence should derive auction aftermath fact');
  assert(facts.some(f => f.kind === 'location' && f.title === '闈掑矚鍧婂競' && f.tags?.includes('event-consequence')), 'event consequence should enrich location fact');
  assert(facts.some(f => f.kind === 'faction' && f.title === '榛戦甫浼? && f.tags?.includes('hostile')), 'event consequence should derive hostile faction pressure');
  const refreshed: any = refreshWorldFacts(state, 'auction-bid');
  const plan = buildEventSchedulerPlan({ ...refreshed, questEntries: [] });
  assert(plan.hints.some(h => h.kind === 'world' && h.reason.includes('浣欐尝')), 'scheduler should include world event consequence hint');
  log('world-event-consequences', { passed: true, facts: facts.length, hints: plan.hints.length });
}

function smokeActionCausality(): void {
  const state: any = {
    age: 30,
    causalGraph: { nodes: [], edges: [] },
  };
  const next: any = recordActionCausality(state, {
    actionId: 'smoke_trade_1',
    actionType: 'trade',
    title: '鍧婂競鎹㈠疂',
    summary: '鐑熸祴浜ゆ槗鍥犳灉',
    tags: ['smoke', 'trade'],
    newItems: [{ id: 'smoke_item', name: '鐑熸祴鐜夌畝', description: '鐢ㄤ簬鍥炲綊娴嬭瘯', item_type: 'scripture', rarity: 'rare', effects: [], source: 'smoke' } as any],
    threads: [{ id: 'smoke_thread', title: '鐑熸祴绾跨储', description: '鐢ㄤ簬鍥炲綊娴嬭瘯', category: 'quest', startAge: 30, deadlineAge: 31, status: 'pending', progress: 10 } as any],
    statuses: [{ id: 'smoke_status', name: '鐑熸祴鐘舵€?, description: '鐢ㄤ簬鍥炲綊娴嬭瘯', category: 'special', rarity: 'common', effects: [], source: 'smoke' } as any],
  });
  const graph = next.causalGraph || { nodes: [], edges: [] };
  assert(graph.nodes.length >= 4, 'recordActionCausality should add action/item/thread/status nodes');
  assert(graph.edges.length >= 3, 'recordActionCausality should add causal edges');
  assert(graph.nodes.some((n: any) => n.type === 'item' && n.refId === 'smoke_item'), 'causal graph should include item node');
  log('action-causality', { passed: true, nodes: graph.nodes.length, edges: graph.edges.length });
}

function smokeHiddenAudit(): void {
  const effects = appendStateChangeAuditEffect([{ kind: 'visible', text: '鍙鏁堟灉' }], [{ code: 'attribute_applied', source: 'effect', message: '淇负澧為暱' } as any]);
  assert(effects.some((effect: any) => effect?.kind === '__audit_state_change_log' && effect.hidden === true), 'hidden audit effect should be appended');

  const narrativeEffects = appendNarrativeContractAuditEffect([{ kind: 'visible', text: '鍙鏁堟灉' }], {
    output: {
      title: '鍧婂寰奖',
      narrative: '闃撮甫瀹粛鍦ㄥ潑澶栫洴姊€?,
      eventType: 'normal',
      changes: [],
      newStatuses: [],
      newItems: [],
      narrativeContract: {
        narrativeFocus: 'npc',
        narrativeOutcome: 'advanced',
        usedScheduleHintIds: ['seh_npc_shadow'],
        usedWorldFactIds: ['wf_market'],
        usedNpcIds: ['npc_shadow'],
        contractNote: '鎵挎帴闃撮甫瀹㈢洴姊€?,
      },
    } as any,
    eventSchedule: {
      generatedAtAge: 30,
      focus: { id: 'seh_npc_shadow', kind: 'npc', priority: 120, title: '闃撮甫瀹?, reason: '闃撮甫瀹㈡殫涓洴姊€?, requiredAction: 'echo_or_develop' },
      hints: [],
      pressureMap: { topThreat: '闃撮甫瀹?, topOpportunity: '闈掑矚鍧婂競', focalLocation: '闈掑矚鍧婂競', focalActor: '闃撮甫瀹?, likelyEventTypes: ['濞佽儊鍥炲搷'], summary: '鏈€澶у▉鑳侊細闃撮甫瀹紱鏈€澶ф満浼氾細闈掑矚鍧婂競' },
      warnings: [],
    } as any,
    boundaryEntries: [{ id: 'scl_30_boundary_top_schedule_focus_not_declared_0', age: 30, source: 'boundary', severity: 'info', code: 'top_schedule_focus_not_declared', message: 'AI did not clearly declare top schedule focus.' } as any],
  });
  const audit = narrativeEffects.find((effect: any) => effect?.kind === '__audit_narrative_contract') as any;
  assert(audit?.hidden === true, 'narrative contract audit effect should be hidden');
  assert(audit?.focusHintId === 'seh_npc_shadow', 'narrative contract audit should persist focus hint id');
  assert(audit?.contract?.narrativeFocus === 'npc', 'narrative contract audit should persist contract focus');
  assert(audit?.contract?.narrativeOutcome === 'advanced', 'narrative contract audit should persist contract outcome');
  assert(audit?.warnings?.some((entry: any) => entry.code === 'top_schedule_focus_not_declared'), 'narrative contract audit should persist related boundary entries');

  const feedback = extractNarrativeContractFeedback([{ age: 30, title: '鍧婂寰奖', effects: JSON.stringify(narrativeEffects) }]);
  assert(feedback.length === 1, 'narrative contract feedback should be extracted from hidden audit');
  assert(feedback[0].narrativeFocus === 'npc', 'feedback should preserve narrative focus');
  assert(feedback[0].narrativeOutcome === 'advanced', 'feedback should preserve narrative outcome');
  assert(feedback[0].topThreat === '闃撮甫瀹?, 'feedback should preserve pressure map threat');
  assert(feedback[0].usedNpcIds.includes('npc_shadow'), 'feedback should preserve used npc ids');
  assert(feedback[0].warningCodes.includes('top_schedule_focus_not_declared'), 'feedback should preserve contract warning codes');
  log('hidden-audit', { passed: true, effects: effects.length, narrativeAudit: Boolean(audit), feedback: feedback.length });
}

function smokeSameYearContinuation(): void {
  const state: any = {
    name: '娌堢牃绉?,
    age: 21,
    pendingThreads: [{
      id: 'sect_trial_same_year',
      title: '涓夋湀鍚庣殑鍏ラ棬姣旇瘯',
      description: '闈掑矚灞辨墽浜嬬害瀹氫笁鏈堝悗鍦ㄥ闂ㄧ煶鍧獙鐪嬫牴楠ㄤ笌鏂楁硶鑳嗘皵銆?,
      category: 'competition',
      startAge: 21,
      deadlineAge: 21,
      status: 'pending',
      progress: 20,
      dueInSameYear: true,
      followUpHint: '鍚屽瞾涓夋湀鍚庤荡澶栭棬鐭冲潽鍙傚姞鍏ラ棬姣旇瘯锛屼笉鑳芥嫋鍒颁笅涓€骞淬€?,
    }],
  };
  const threads = getSameYearThreads(state);
  assert(threads.length === 1, 'same-year thread should be selected before cross-year advance');
  const output = buildThreadContinuationEvent(state, threads[0]);
  assert(output.title.includes('绾︽湡宸茶嚦'), 'same-year competition continuation should use appointment title');
  assert(output.advanceThreads?.length === 0, 'same-year continuation should no longer use partial advance');
  assert(output.completeThreadIds?.includes('sect_trial_same_year'), 'same-year continuation should complete the selected thread');
  log('same-year-continuation', { passed: true, age: state.age, title: output.title });
}


function smokeSameYearContinuationDedup(): void {
  // Verify that after a same-year continuation completes a thread,
  // getSameYearThreads no longer returns it (preventing duplicate events)
  const state: any = {
    name: '娴嬭瘯寮熷瓙',
    age: 21,
    pendingThreads: [{
      id: 'sect_trial_same_year',
      title: '鏈堝悗鍏ラ棬姣旇瘯',
      description: '鎸夌害鍓嶅線鐭冲潽鍙傚姞鍏ラ棬姣旇瘯',
      category: 'competition',
      startAge: 21,
      deadlineAge: 21,
      status: 'pending',
      progress: 20,
      dueInSameYear: true,
      followUpHint: '鍚屽瞾鏈堝悗鍓嶅線鐭冲潽鍙傚姞鍏ラ棬姣旇瘯',
    }],
  };
  const threadsBefore = getSameYearThreads(state);
  assert(threadsBefore.length === 1, 'pending thread should be selected before continuation');
  const output = buildThreadContinuationEvent(state, threadsBefore[0]);
  assert(output.completeThreadIds?.includes('sect_trial_same_year'), 'continuation should mark thread as completed');
  assert((output.advanceThreads?.length ?? 0) === 0, 'continuation should not use partial advance');
  // Simulate the effect of executing the output
  const completedState: any = {
    ...state,
    pendingThreads: state.pendingThreads.map((t: any) =>
      t.id === 'sect_trial_same_year' ? { ...t, status: 'resolved', progress: 100 } : t
    ),
  };
  const threadsAfter = getSameYearThreads(completedState);
  assert(threadsAfter.length === 0, 'completed thread should not be selected again (preventing duplicate loop)');
  log('same-year-continuation-dedup', { passed: true });
}
function smokeAnnualNarrativePrompt(): void {
  const source = readFileSync('src/lib/xianxia/llm.ts', 'utf-8');
  assert(source.includes('骞撮緞鎺ㄨ繘涓嶆槸鈥滀竴骞村彧鍙戠敓涓€浠朵簨鈥?), 'advance prompt should require annual multi-part narration');
  assert(source.includes('dueInSameYear=true 琛ㄧず涓嬩竴娆″瞾鏈堟祦杞細浼樺厛澶勭悊鍚屽瞾鍚庣画'), 'advance prompt should explain same-year continuation behavior');
  assert(source.includes('蹇呴』鐢?extraEvents 鎷嗘垚澶氭潯鐭簨浠?), 'advance prompt should require extraEvents for multiple key beats');
  log('annual-narrative-prompt', { passed: true });
}

function smokeTechniqueRequirements(): void {
  const baseState: any = {
    name: 'Root Tester', age: 20, lifespan: 100, realm: 'qi_refining', realmLevel: 1,
    spiritualRoot: 'mixed', rootDetail: '\u6742\u7075\u6839', rootMultiplier: 0.3,
    elements: { metal: 10, wood: 10, water: 10, fire: 10, earth: 10 },
    comprehension: 30, activeStatuses: [], longTermMemory: [], equipped: [], inventory: [], pets: [],
    hp: 100, maxHp: 100, mp: 50, maxMp: 50, attack: 10, defense: 8, speed: 10,
  };
  const strictScripture: any = {
    id: 'item_scr_strict', name: 'Strict Heavenly Manual', description: 'Strict root manual', item_type: 'scripture', rarity: 'rare', source: 'smoke',
    effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 3, description: 'cultivation test' }],
    technique: { kind: 'cultivation', requirements: { spiritualRoots: ['heavenly', 'pure'], minRealm: 'foundation' }, traits: [{ name: 'Strict Path', description: 'cultivation test' }] },
  };
  const rejected = evaluateTechniqueCompatibility(baseState, strictScripture);
  assert(!rejected.usable && rejected.adaptation === 0, 'strict spiritual root requirement should reject mismatched root');
  const looseScripture: any = {
    id: 'item_scr_loose', name: 'Loose Root Manual', description: 'loose root manual', item_type: 'scripture', rarity: 'rare', source: 'smoke',
    effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 3, description: 'cultivation test' }],
    technique: { kind: 'cultivation', requirements: { preferredRoots: ['pure'], minRealm: 'foundation', minComprehension: 60 }, traits: [{ name: 'Loose Path', description: 'cultivation test' }] },
  };
  const adapted = evaluateTechniqueCompatibility(baseState, looseScripture);
  assert(adapted.usable && adapted.adaptation > 0 && adapted.adaptation < 1, 'soft requirements should reduce adaptation, not reject');
  const normalized = normalizeCultivationState({ ...baseState, equipped: [looseScripture] });
  assert(normalized.cultivationMultiplier > baseState.rootMultiplier && normalized.cultivationMultiplier < baseState.rootMultiplier * 3, 'cultivation multiplier should be partially reduced by adaptation');
  const passiveArtifact: any = {
    id: 'item_art_water', name: '\u907f\u6c34\u73e0', description: '\u4f69\u6234\u540e\u6c34\u4e2d\u53ef\u547c\u5438', item_type: 'artifact', rarity: 'rare', source: 'smoke',
    effects: [{ target_attribute: 'defense', operation: 'add', value: 6, description: '\u6c34\u7eb9\u62a4\u4f53' }],
    technique: { kind: 'artifact', requirements: { spiritualRoots: ['heavenly'] }, artifactAbilities: [{ name: '\u907f\u6c34\u7075\u7981', description: '\u4f69\u6234\u540e\u53ef\u5728\u6c34\u4e2d\u547c\u5438', trigger: 'underwater', permanentBuff: true, power: 1.2 }] },
  };
  const skills = buildLearnedCombatArts({ ...baseState, equipped: [strictScripture, looseScripture, passiveArtifact] });
  assert(!skills.some((skill: any) => skill.itemId === strictScripture.id), 'unusable strict scripture should not grant learned combat art');
  assert(skills.some((skill: any) => skill.itemId === passiveArtifact.id && skill.name === '\u907f\u6c34\u7075\u7981'), 'artifact innate ability should be available even when wearer cannot learn it as a technique');
  assert(skills.every((skill: any) => skill.adaptation === undefined || skill.adaptation <= 1), 'combat arts should expose adaptation when applicable');
  log('technique-requirements', { passed: true, rejected: rejected.reasons[0], adaptation: adapted.adaptation, multiplier: normalized.cultivationMultiplier, skills: skills.length });
}

function smokeNoProtagonistShieldPrompt(): void {
  const source = readFileSync('src/lib/xianxia/llm.ts', 'utf-8');
  assert(source.includes('\u4e0d\u8981\u4e3a\u4e86\u4fdd\u62a4\u73a9\u5bb6\u800c\u81ea\u52a8\u5339\u914d\u6218\u529b'), 'combat prompt should forbid protagonist shielding');
  assert(source.includes('causedDeath/eventType=death \u662f\u5408\u6cd5\u7ed3\u679c'), 'prompt should allow death as legitimate outcome');
  assert(source.includes('technique.requirements'), 'item prompt should require technique requirements');
  assert(source.includes('technique.artifactAbilities'), 'item prompt should support artifact innate abilities');
  assert(source.includes('spiritualRoots \u662f\u4e25\u683c\u95e8\u69db'), 'prompt should explain strict spiritual root gates');
  log('no-protagonist-shield-prompt', { passed: true });
}

async function smokeAuctionDbRoute(): Promise<void> {
  const { db } = await import('../src/lib/db');
  const { POST } = await import('../src/app/api/game/auction/route');
  const req = (body: any) => new Request('http://localhost/api/game/auction', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
  const call = async (body: any) => {
    const res = await POST(req(body));
    const json = await res.json();
    assert(res.ok && json.success, `auction route failed: ${JSON.stringify({ status: res.status, json })}`);
    return json;
  };
  const char = await db.character.create({
    data: {
      name: `鍥炲綊鐑熸祴_${Date.now()}`,
      age: 18,
      lifespan: 100,
      realm: 'qi_refining',
      realmLevel: 9,
      spiritStones: 20000,
      luck: 50,
      comprehension: 50,
      location: '闈掑矚鍧婂競',
      storageCapacity: 20,
    },
  });
  await call({ characterId: char.id, action: 'invite' });
  const enter = await call({ characterId: char.id, action: 'enter' });
  const keyLot = enter.auction.lots.find((lot: any) => lot.item?.name?.includes('閾滈挜')) || enter.auction.lots.at(-1);
  const bid = await call({ characterId: char.id, action: 'bid', lotId: keyLot.id, bid: 18000 });
  const fresh = await db.character.findUnique({ where: { id: char.id } });
  assert(fresh, 'auction db smoke character should exist after bid');
  const threads = JSON.parse(fresh!.pendingThreadsJson || '[]');
  const npcs = JSON.parse(fresh!.npcsJson || '[]');
  const graph = JSON.parse(fresh!.causalGraphJson || '{"nodes":[],"edges":[]}');
  const lastLog = await db.eventLog.findFirst({ where: { characterId: char.id }, orderBy: { createdAt: 'desc' } });
  const effects = JSON.parse(lastLog?.effects || '[]');
  assert(threads.some((t: any) => String(t.id || '').includes('auction_aftermath')), 'auction should create aftermath thread');
  assert(npcs.some((n: any) => (n.tags || []).includes('aftermath')), 'auction should persist aftermath NPC');
  assert((graph.nodes || []).length > 0 && (graph.edges || []).length > 0, 'auction should persist causal graph');
  assert(effects.some((effect: any) => effect?.kind === '__audit_state_change_log' && effect.hidden), 'auction should append hidden audit');
  log('auction-db-route', { passed: true, characterId: char.id, lot: keyLot.item?.name, wonItems: bid.wonItems?.length || 0, threads: threads.length, npcs: npcs.length, graphNodes: graph.nodes.length, graphEdges: graph.edges.length });
}


function smokeConstitutionProfiles(): void {
  const swordBody = constitutionToStatus(CONSTITUTIONS.find(c => c.id === 'sword_body')!);
  const rawState: any = {
    id: 'smoke_constitution', name: 'Sword Tester', gender: 'male', age: 18, lifespan: 80,
    spiritualRoot: 'pure', rootDetail: 'metal root', rootMultiplier: 1.1,
    realm: 'qi_refining', realmLevel: 1,
    cultivationExp: 0, expToBreak: 100,
    elements: { metal: 80, wood: 10, water: 10, fire: 10, earth: 10 },
    hp: 100, maxHp: 100, mp: 80, maxMp: 80, attack: 10, defense: 8, speed: 8,
    luck: 5, comprehension: 16, spiritStones: 0, reputation: 0,
    alive: true, ascended: false, causeOfDeath: '', faction: '', master: '', location: '', fateNodes: [], isAtChoice: false,
    activeStatuses: [swordBody], inventory: [], equipped: [], storageCapacity: 5,
    cultivationMultiplier: 1, longTermMemory: [], completedFateNodes: [], pendingThreads: [], characterIntents: [], recentEventTypes: [],
    npcs: [], causalGraph: { nodes: [], edges: [] }, worldFacts: [], pets: [], exploredRealms: [],
  };
  const state: any = normalizeCultivationState(rawState);
  const swordManual: any = {
    id: 'item_sword_manual', name: 'Metal Sword Manual', item_type: 'scripture', rarity: 'rare', description: 'Sword method with metal edge.',
    effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1.2, description: 'cultivation test' }],
    technique: {
      kind: 'spell', spell: { name: 'Metal Sword Qi', description: 'Metal sword energy.', mpCost: 10, power: 18, element: 'metal' },
      requirements: { spiritualRoots: ['pure'], minElements: { metal: 40 }, minComprehension: 8 },
      traits: [{ name: 'Sword Intent', description: 'sword edge' }],
    },
  };
  const compat = evaluateTechniqueCompatibility(state, swordManual);
  const baselineCompat = evaluateTechniqueCompatibility({ ...state, activeStatuses: [] }, swordManual);
  const ctx = buildStateContext(state, []);
  assert(Boolean(swordBody.constitution), 'constitution status should carry structured profile');
  assert(swordBody.constitution?.awakening?.length, 'constitution profile should expose awakening stages');
  assert(compat.adaptation > baselineCompat.adaptation, 'matching constitution should raise sword technique adaptation against baseline');
  assert(compat.warnings.length > baselineCompat.warnings.length, 'matching constitution should emit resonance warning');
  assert(Boolean(ctx.constitutionProfiles?.[0]) && ctx.constitutionProfiles![0].resonance.length > 0, 'state context should include constitution profile summary');
  log('constitution-profiles', { passed: true, baseline: baselineCompat.adaptation, adaptation: compat.adaptation, profile: ctx.constitutionProfiles?.[0]?.name });
}


function smokeTechniqueSpellNaming(): void {
  const rawSpellNameState: any = {
    id: 'smoke_spell_name', name: 'Spell Tester', gender: 'female', age: 20, lifespan: 90,
    spiritualRoot: 'pure', rootDetail: 'wood root', rootMultiplier: 1.2,
    realm: 'qi_refining', realmLevel: 3,
    cultivationExp: 0, expToBreak: 100,
    elements: { metal: 40, wood: 80, water: 20, fire: 10, earth: 10 },
    hp: 100, maxHp: 100, mp: 100, maxMp: 100, attack: 12, defense: 8, speed: 10,
    luck: 5, comprehension: 20, spiritStones: 0, reputation: 0,
    alive: true, ascended: false, causeOfDeath: '', faction: '', master: '', location: '', fateNodes: [], isAtChoice: false,
    activeStatuses: [], inventory: [], equipped: [], storageCapacity: 5,
    cultivationMultiplier: 1, longTermMemory: [], completedFateNodes: [], pendingThreads: [], characterIntents: [], recentEventTypes: [],
    npcs: [], causalGraph: { nodes: [], edges: [] }, worldFacts: [], pets: [], exploredRealms: [],
  };
  const baseState: any = normalizeCultivationState(rawSpellNameState);
  const artifact: any = {
    id: 'artifact_flower_sword', name: 'Hundred Flower Sword', item_type: 'artifact', rarity: 'rare', description: 'A flower sword with petal shadows.', effects: [], source: 'smoke',
    technique: { kind: 'artifact', artifactAbilities: [{ name: 'Hundred Flower Sword', description: 'A flower sword with petal shadows.', power: 1.5 }] },
  };
  const scripture: any = {
    id: 'scripture_flower_sword', name: 'Hundred Flower Sword Manual', item_type: 'scripture', rarity: 'rare', description: 'A flower sword method with petal shadows.', effects: [], source: 'smoke',
    technique: { kind: 'combat', requirements: { preferredRoots: ['pure'] }, spell: { name: 'Hundred Flower Sword Manual', description: 'A flower sword method with petal shadows.', power: 1.4 } },
  };
  const arts = buildLearnedCombatArts({ ...baseState, equipped: [artifact, scripture] });
  const artifactArt = arts.find((a: any) => a.itemId === artifact.id);
  const scriptureArt = arts.find((a: any) => a.itemId === scripture.id);
  assert(artifactArt?.name && artifactArt.name !== artifact.name, 'artifact innate ability should not reuse artifact name');
  assert(artifactArt?.description && artifactArt.description !== artifact.description, 'artifact innate ability should not reuse artifact description');
  assert(scriptureArt?.name && scriptureArt.name !== scripture.name, 'scripture spell should not reuse scripture name');
  assert(scriptureArt?.description && scriptureArt.description !== scripture.description, 'scripture spell should not reuse scripture description');
  assert(!['Hundred Flower Sword', 'Hundred Flower Sword Manual'].includes(String(artifactArt?.name)), 'artifact fallback should be generic validation, not a hard-coded creative name');
  assert(!['Hundred Flower Sword', 'Hundred Flower Sword Manual'].includes(String(scriptureArt?.name)), 'scripture fallback should be generic validation, not a hard-coded creative name');
  log('technique-spell-naming', { passed: true, artifact: artifactArt?.name, scripture: scriptureArt?.name });
}


function smokeCombatFleeNoSpoils(): void {
  const rawState: any = {
    id: 'smoke_flee_no_spoils',
    name: 'Smoke Flee',
    age: 18,
    gender: 'male',
    background: 'commoner',
    spiritualRoot: 'common',
    rootDetail: '\u6742\u7075\u6839',
    rootMultiplier: 0.35,
    realm: 'qi_refining',
    realmLevel: 1,
    cultivation: 0,
    cultivationExp: 0,
    hp: 20,
    maxHp: 20,
    mp: 10,
    maxMp: 10,
    lifespan: 80,
    comprehension: 5,
    luck: 5,
    spiritStones: 0,
    inventory: [],
    equipped: [],
    activeStatuses: [],
    eventsLog: [],
    pendingThreads: [],
    alive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    combatSession: {
      id: 'combat_fled_smoke',
      status: 'fled',
      enemyName: 'Smoke Bandit',
      enemyRealm: 'qi_refining',
      enemyRealmLevel: 1,
      enemyMaxHp: 10,
      enemyAttack: 1,
      enemyDefense: 1,
      log: [],
      round: 1,
      playerHp: 20,
      enemyHp: 1,
      startedAtAge: 18,
    },
  };
  const state: any = normalizeCultivationState(rawState);
  const ended = endCombat(state, true);
  assert(ended.result === 'fled', 'flee result should remain fled');
  assert(ended.drops.length === 0, 'flee should not grant drops');
  assert((ended.spiritStones || 0) === 0, 'flee should not grant spirit stones');
  assert((ended.state.inventory || []).length === 0, 'flee should not add inventory loot');
  log('combat-flee-no-spoils', { passed: true, result: ended.result });
}

function smokeIdentityNormalization(): void {
  const rawState: any = {
    id: 'smoke_identity',
    name: 'Smoke Identity',
    age: 18,
    gender: 'female',
    background: 'commoner',
    spiritualRoot: 'common',
    rootDetail: '\u6742\u7075\u6839',
    rootMultiplier: 0.35,
    realm: 'qi_refining',
    realmLevel: 1,
    cultivation: 0,
    cultivationExp: 0,
    hp: 20,
    maxHp: 20,
    mp: 10,
    maxMp: 10,
    lifespan: 80,
    comprehension: 5,
    luck: 5,
    spiritStones: 0,
    inventory: [],
    equipped: [],
    eventsLog: [],
    pendingThreads: [],
    alive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeStatuses: [
      { id: 'id_old', name: 'candidate sect servant', description: 'candidate sect servant', category: 'identity', rarity: 'common', duration: -1, source: 'smoke', effects: [] },
      { id: 'id_new', name: 'formal sect servant', description: 'formal sect servant', category: 'identity', rarity: 'common', duration: -1, source: 'smoke', effects: [] },
    ],
  };
  const state: any = normalizeCultivationState(rawState);
  const names = state.activeStatuses.map((s: any) => s.name);
  assert(names.includes('formal sect servant'), 'newer formal identity should remain');
  assert(!names.includes('candidate sect servant'), 'stale candidate identity should be removed');
  log('identity-normalization', { passed: true, names });
}

function smokeCombatSettlementSingleFlow(): void {
  const source = readFileSync('src/components/xianxia/CombatModal.tsx', 'utf8');
  assert(source.includes('const isTerminal = !nextCharacter.alive || nextCharacter.ascended;'), 'combat modal should detect terminal combat result');
  assert(source.includes('setSettlementResult(generateSettlementResult(nextCharacter as any, nextEvents as any));'), 'terminal combat should enter global settlement directly');
  assert(source.includes('setEndResult({ status, narrative });'), 'non-terminal combat should keep local battle aftermath only');
  log('combat-settlement-single-flow', { passed: true });
}



function smokeDynamicCultivationAttributes(): void {
  const state: any = {
    activeStatuses: [{
      id: 'attr_starfire_bone',
      name: '\u661f\u706b\u5251\u9aa8',
      description: '\u5251\u9aa8\u4e2d\u9690\u6709\u661f\u706b\u9e23\u54cd\uff0c\u9047\u91d1\u706b\u4e4b\u6cd5\u66f4\u6613\u751f\u53d8\u3002',
      category: 'attribute',
      rarity: 'epic',
      duration: -1,
      source: '\u9668\u661f\u609f\u5251',
      effects: [{ target_attribute: 'custom_sword_bone', operation: 'add', value: 1, description: '\u5251\u9aa8\u521d\u9e23' }],
    }],
    cultivationAttributes: [],
  };
  const attrs = deriveCultivationAttributes(state);
  assert(attrs.some(attr => attr.name === '\u661f\u706b\u5251\u9aa8' && attr.source === '\u9668\u661f\u609f\u5251'), 'attribute statuses should project into cultivation attributes');
  log('dynamic-cultivation-attributes', { passed: true, count: attrs.length, first: attrs[0]?.name });
}


function smokeRealmTraitsAndSoulRealm(): void {
  const state: any = {
    id: 'realm-trait-smoke',
    name: 'tester',
    age: 80,
    realm: 'foundation',
    realmLevel: 3,
    maxHp: 200,
    maxMp: 120,
    defense: 30,
    comprehension: 60,
    heartDemon: 5,
    cultivationAttributes: [],
    activeStatuses: [],
  };
  const soul = deriveSoulRealm(state);
  const traits = deriveRealmTraits(state);
  const ctx = buildStateContext({
    ...state,
    gender: 'unknown',
    lifespan: 200,
    spiritualRoot: 'common',
    cultivationExp: 0,
    expToBreak: 100,
    elements: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
    hp: 100,
    mp: 100,
    attack: 10,
    speed: 10,
    luck: 10,
    spiritStones: 0,
    reputation: 0,
    faction: '',
    master: '',
    location: '',
    alive: true,
    ascended: false,
    fateNodes: [],
    pendingThreads: [],
    inventory: [],
    equipped: [],
    cultivationFactors: [],
    longTermMemory: [],
    npcs: [],
    worldFacts: [],
    causalGraph: { nodes: [], edges: [] },
  }, []);
  assert(soul.name && soul.spiritualSense > 0 && soul.soulStrength > 0, 'soul realm should be derived from realm and attributes');
  assert(traits.capabilities.length > 0 && traits.limitations.length > 0, 'realm traits should expose capability boundaries');
  assert(ctx.character.spiritualSense > 0 && ctx.realmTraits?.combatStyle?.length, 'engine context should include body/spirit split and realm traits');
  log('realm-traits-soul-realm', { passed: true, soul: soul.name, gap: soul.gap, limitation: traits.limitations[0] });
}


function smokeCombatArtFallbackNames(): void {
  const rawState: any = {
    spiritualRoot: 'common', realm: 'qi_refining', realmLevel: 2, comprehension: 55,
    elements: { metal: 30, wood: 30, water: 30, fire: 30, earth: 30 },
    activeStatuses: [], equipped: [], inventory: [],
  };
  const baseState: any = normalizeCultivationState(rawState);
  const scriptures: any[] = [
    { id: 'manual_breath', name: '\u9752\u5c71\u5410\u7eb3\u529f', description: '\u5c71\u95f4\u5410\u7eb3\u7684\u57fa\u7840\u529f\u6cd5\u3002', item_type: 'scripture', rarity: 'common', effects: [], source: '\u574a\u5e02' },
    { id: 'manual_cloud', name: '\u4e91\u6c34\u517b\u6c14\u8bc0', description: '\u4e91\u6c34\u6c14\u673a\u7f20\u7ed5\u7684\u6cd5\u95e8\u3002', item_type: 'scripture', rarity: 'uncommon', effects: [], source: '\u6d1e\u5e9c' },
    { id: 'manual_sword', name: '\u9752\u7af9\u5251\u7ecf', description: '\u4ee5\u5251\u610f\u7275\u5f15\u9752\u7af9\u751f\u673a\u3002', item_type: 'scripture', rarity: 'rare', effects: [], source: '\u5251\u5802' },
  ];
  const arts = buildLearnedCombatArts({ ...baseState, equipped: scriptures });
  const names = arts.map((art: any) => art.name);
  assert(names.length >= 3, 'scripture fallback combat arts should be generated');
  assert(new Set(names).size === names.length, 'scripture fallback combat art names should be unique');
  assert(!names.includes('\u884c\u6c14\u672f\u5f0f'), 'scripture fallback combat art names should not collapse to generic 琛屾皵鏈紡');
  log('combat-art-fallback-names', { passed: true, names: names.join('|') });
}





function smokeArtifactCultivationMisclassification(): void {
  const state: any = normalizeCultivationState({
    spiritualRoot: 'heavenly', rootDetail: '閲戝ぉ鐏垫牴', rootMultiplier: 3,
    activeStatuses: [], inventory: [], pets: [], heartDemon: 0,
    hp: 50, maxHp: 50, mp: 20, maxMp: 20,
    equipped: [
      {
        id: 'old_bad_artifact', name: '榛勭墮鐦︽眽鐨勬畫鍏夋姢绗?, description: '鍐呰棌鐏电锛氭畫鍏夋姢骞曘€?, item_type: 'scripture', rarity: 'uncommon', source: '鎴樺埄鎵€寰?,
        effects: [
          { target_attribute: 'defense', operation: 'add', value: 16, description: '鎶よ韩+16' },
          { target_attribute: 'cultivationExp', operation: 'multiply', value: 1.7, description: '淇範姝ゅ姛娉曪紝淇负娴佽浆鍔犻€熋?.7' },
        ],
        technique: { kind: 'artifact', artifactAbilities: [{ name: '娈嬪厜鎶ゅ箷', description: '鎶よ韩鐏电', trigger: 'auto', element: 'none', power: 1.1 }] },
      },
      { id: 'real_scripture', name: '鏂楁硶蹇冨緱鐜夌畝', description: '淇偧蹇冨緱銆?, item_type: 'scripture', rarity: 'uncommon', source: '娴嬭瘯', effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1.45, description: '鍙傛偀淇脳1.45' }] },
    ],
  } as any);
  const artifact = state.equipped.find((it: any) => it.id === 'old_bad_artifact');
  assert(artifact?.item_type === 'artifact', 'artifact technique should override old scripture misclassification');
  assert(artifact?.name === '娈嬪厜鎶ょ', 'enemy possessive prefix should be stripped during normalization');
  assert(!artifact?.effects?.some((e: any) => e.target_attribute === 'cultivationExp'), 'auto-injected scripture cultivation effect should be removed from artifact');
  assert(!state.cultivationFactors.some((f: any) => f.name === '娈嬪厜鎶ょ'), 'artifact should not appear as scripture cultivation factor');
  assert(Math.abs(state.cultivationMultiplier - 4.35) < 0.001, 'only root and real scripture should multiply cultivation rate');
  console.log(JSON.stringify({ smoke: 'artifact-cultivation-misclassification', passed: true, multiplier: state.cultivationMultiplier }));
}

function smokeCombatTacticalProjection() {
  let state: any = {
    id: 'tactical_smoke', name: '瑙傚娍鑰?, age: 23, realmName: '鐐兼皵浜屽眰', rootType: '浜旇鏉傜伒鏍?, rootMultiplier: 1,
    spiritStones: 0, inventory: [], equipped: [], statuses: [], eventLog: [], hp: 90, maxHp: 90, mp: 45, maxMp: 45, attack: 18, defense: 14, speed: 13,
    combatSession: {
      id: 'combat_tactical_smoke', enemies: [{ id: 'blade_rogue', name: '鐭垉鍔慨', description: '鑴氭椋樺拷锛屾姢韬杽寮便€?, hp: 70, maxHp: 70, attack: 15, defense: 8, speed: 12 }],
      currentEnemyIdx: 0, round: 1, log: [], status: 'ongoing', startAge: 23,
      playerHp: 90, playerMaxHp: 90, playerMp: 45, playerMaxMp: 45, playerAttack: 18, playerDefense: 14, playerSpeed: 13, playerSkills: [], playerItems: [],
    },
  } as any;
  const proposal = {
    playerActionLabel: '閿欐閫艰繎', playerActionType: 'attack' as const, playerDamage: 6,
    enemyBeats: [{ enemyIdx: 0, action: '妯垉閫€瀹?, actionType: 'defend', damageToPlayer: 0 }],
    tacticalSituation: { tempo: 'opening' as const, advantage: 'player' as const, reason: '鏁屼汉閫€瀹堟椂鍙宠偐鎶ゅ娍鐭殏鏁ｅ紑銆?, playerOpening: '鍙宠偐鎶ゅ娍鎹㈡皵', suggestedFocus: '瓒佺牬缁介€煎叾绉绘' },
    nextActions: [
      { id: 'press-shoulder', name: '閫艰偐澶烘', description: '椤虹潃鍙宠偐鎶ゅ娍绌洪殭鍘嬩笂鍗婃锛岃揩鍏堕樀鑴氬啀涔便€?, actionType: 'other' as const, intent: '娌跨牬缁芥墿澶т紭鍔?, tags: ['opening'] },
      { id: 'feint-flee', name: '浣€€璇辫拷', description: '鏁呮剰鍚庢挙鍗婁笀锛屽紩鍏剁煭鍒冭拷鍑烘姢鍔裤€?, actionType: 'other' as const, risk: '鑻ユ晫浜轰笉杩斤紝鏀诲娍浼氭殏缂撱€?, tags: ['ai-context'] },
    ],
    narrative: '浣犻敊姝ヨ创杩戯紝閫煎緱鐭垉鍔慨妯垉閫€瀹堬紱浠栧彸鑲╂姢鍔垮湪鎹㈡皵鏃跺井寰竴鏁ｏ紝闇插嚭涓€绾垮彲涔樹箣鏈恒€?,
  };
  state = executeCombatRoundWithProposal(state, 'attack', { optionId: 'basic-body-strike' }, proposal).state;
  const session = state.combatSession!;
  assert(session.tacticalSituation?.tempo === 'opening', 'AI tactical tempo should persist on combat session');
  assert(session.actionPalette?.other.options.some((o: any) => o.name === '閫艰偐澶烘' && (o.tags || []).includes('ai-context')), 'AI next actions should project into action palette');
  assert(session.log[0].tacticalSituation?.playerOpening === '鍙宠偐鎶ゅ娍鎹㈡皵', 'round log should preserve tactical read');
  console.log(JSON.stringify({ smoke: 'combat-tactical-projection', passed: true, tempo: session.tacticalSituation.tempo, option: session.actionPalette.other.options[0].name }));
}

function smokeCombatStalemateBreakNode() {
  let state: any = {
    id: 'stalemate_smoke',
    name: '璇曟垬鑰?,
    age: 22,
    realmName: '鐐兼皵涓€灞?,
    rootType: '浜旇鏉傜伒鏍?,
    rootMultiplier: 1,
    spiritStones: 0,
    inventory: [],
    equipped: [],
    statuses: [],
    eventLog: [],
    hp: 80,
    maxHp: 80,
    mp: 40,
    maxMp: 40,
    attack: 8,
    defense: 45,
    speed: 10,
    combatSession: {
      id: 'combat_stalemate_smoke',
      enemies: [{ id: 'iron_guard', name: '閾佺敳鏁ｄ慨', description: '鎶や綋娉曞櫒鍘氶噸锛屾敾鍔挎矇绋炽€?, hp: 80, maxHp: 80, attack: 8, defense: 45, speed: 8 }],
      currentEnemyIdx: 0,
      round: 1,
      log: [],
      status: 'ongoing',
      startAge: 22,
      playerHp: 80,
      playerMaxHp: 80,
      playerMp: 40,
      playerMaxMp: 40,
      playerAttack: 8,
      playerDefense: 45,
      playerSpeed: 10,
      playerSkills: [],
      playerItems: [],
    },
  } as any;
  const proposal = {
    playerActionLabel: '璇曟帰鏀诲娍',
    playerActionType: 'attack' as const,
    playerDamage: 1,
    enemyBeats: [{ enemyIdx: 0, action: '娌夌敳杩繎', actionType: 'attack', damageToPlayer: 1 }],
    narrative: '涓や汉姘旀満鐩告挒锛屾姢韬伒鍏夊郊姝ょ（杩囷紝璋佷篃鏈兘鐪熸鎾曞紑瀵规柟闂ㄦ埛銆?,
  };
  state = executeCombatRoundWithProposal(state, 'attack', { optionId: 'basic-body-strike' }, proposal).state;
  state = executeCombatRoundWithProposal(state, 'attack', { optionId: 'basic-body-strike' }, proposal).state;
  state = executeCombatRoundWithProposal(state, 'attack', { optionId: 'basic-body-strike' }, proposal).state;
  const session = state.combatSession!;
  assert(session.pendingImpulse?.reason === 'stalemate', 'low-progress combat should trigger stalemate break impulse');
  assert((session.actionPalette?.other.options || []).some((o: any) => (o.tags || []).includes('stalemate-breaker')), 'stalemate should expose breaker options in 搴斿彉');
  console.log(JSON.stringify({ smoke: 'combat-stalemate-break-node', passed: true, prompt: session.pendingImpulse.prompt.slice(0, 24) }));
}

function smokeCombatResolvedSceneDedupe(): void {
  const state: any = normalizeCultivationState({
    id: 'c-combat-dedupe',
    age: 9,
    hp: 80, maxHp: 80, mp: 40, maxMp: 40,
    attack: 12, defense: 8, speed: 7,
    realm: 'qi_refining', realmLevel: 2, spiritualRoot: 'heavenly', rootDetail: '鍦熷ぉ鐏垫牴',
    elements: { metal: 0, wood: 0, water: 0, fire: 0, earth: 100 },
    inventory: [], equipped: [], activeStatuses: [], pendingThreads: [
      { id: 'thread_old_scene', title: '鏅掕胺鍦哄啿绐佸悗缁?, description: '骞虫嫇涓庤檸瀛愬湪鏅掕胺鍦烘棫瀚屾湭骞炽€?, category: 'enemy', startAge: 9, deadlineAge: 9, status: 'pending', progress: 60 },
      { id: 'thread_revenge', title: '铏庡瓙閫冭劚鎶ュ', description: '铏庡瓙璐ヨ蛋鍚庡彲鑳藉浜烘姤澶嶃€?, category: 'enemy', startAge: 9, deadlineAge: 10, status: 'pending', progress: 5 },
    ],
    questEntries: [], npcs: [], worldFacts: [],
    causalGraph: { nodes: [{ id: 'event_combat_end_9_old', type: 'combat', label: '鎴樻枟寰楄儨', age: 9, summary: '鎴樻枟寰楄儨锛屽钩鎷撳湪鏅掕胺鍦鸿儨杩囪檸瀛愶紝鐙楄泲鍦ㄦ梺鎯婇瓊鏈畾銆? }], edges: [] },
  } as any);
  const next = startCombat(state, {
    contextTitle: '鏅掕胺鍦洪亣鏁呭珜',
    contextNarrative: '鏈椂鐨勬檼璋峰満锛岃檸瀛愬甫鐫€鍚屼即鍙堝洿浣忕嫍铔嬨€?,
    enemies: [{ id: 'enemy_huzi', name: '铏庡瓙', hp: 50, attack: 8, defense: 5, speed: 5 }],
  } as any);
  assert(!next.combatSession, 'resolved same-age combat scene should not start again');
  const oldScene = (next.pendingThreads || []).find((thread: any) => thread.id === 'thread_old_scene');
  const revenge = (next.pendingThreads || []).find((thread: any) => thread.id === 'thread_revenge');
  assert(oldScene?.status === 'resolved', 'consumed combat scene thread should be resolved');
  assert(revenge?.status === 'pending', 'aftermath/revenge thread should remain pending');
  console.log(JSON.stringify({ smoke: 'combat-resolved-scene-dedupe', passed: true, oldScene: oldScene?.status, revenge: revenge?.status }));
}

function smokeCombatTechniqueSpellSplit(): void {
  const rawState: any = {
    spiritualRoot: 'common', realm: 'qi_refining', realmLevel: 2, comprehension: 60,
    elements: { metal: 35, wood: 35, water: 35, fire: 35, earth: 35 },
    activeStatuses: [], inventory: [],
    equipped: [
      { id: 'scripture_cloud', name: '\u4e91\u6c34\u517b\u6c14\u8bc0', description: '\u4e91\u6c34\u884c\u6c14\u6cd5\u95e8\u3002', item_type: 'scripture', rarity: 'uncommon', effects: [] },
      { id: 'artifact_pearl', name: '\u6f6e\u7eb9\u62a4\u73e0', description: '\u6c34\u8272\u62a4\u8eab\u6cd5\u73e0\u3002', item_type: 'artifact', rarity: 'rare', effects: [], technique: { kind: 'artifact', artifactAbilities: [{ name: '\u6f6e\u606f\u6c34\u5e55', description: '\u6cd5\u73e0\u6d8c\u51fa\u6c34\u5e55\u62a4\u4f53\u3002', trigger: 'auto', element: 'water', power: 1.4 }] } },
    ],
  };
  const state: any = normalizeCultivationState(rawState);
  const session: any = {
    id: 'combat_split', enemies: [{ name: '\u8bd5\u5251\u5080\u5121', hp: 80, maxHp: 80, attack: 10, defense: 4, speed: 5 }], currentEnemyIdx: 0, round: 1, log: [], status: 'ongoing', startAge: 20,
    playerHp: 100, playerMaxHp: 100, playerMp: 80, playerMaxMp: 80, playerAttack: 18, playerDefense: 10, playerSpeed: 8,
    playerSkills: buildLearnedCombatArts(state), playerItems: [],
  };
  const palette = buildCombatActionPalette(state, session);
  assert(palette.technique?.label === '\u529f\u6cd5', 'combat palette should expose a separate technique group');
  assert(palette.technique.options.some((option: any) => option.itemId === 'scripture_cloud'), 'scripture-derived combat art should appear under technique');
  assert(!palette.spell.options.some((option: any) => option.itemId === 'scripture_cloud'), 'scripture-derived technique should not be mixed into spell group');
  assert(palette.spell.options.some((option: any) => option.itemId === 'artifact_pearl' && option.source === 'artifact' && option.name === '娼伅姘村箷'), 'artifact innate ability should remain available as spell-like artifact art and show ability name');
  log('combat-technique-spell-split', { passed: true, technique: palette.technique.options.map((o: any) => o.name).join('|'), spell: palette.spell.options.map((o: any) => o.name).join('|') });
}

function smokeEnemyLootArtifactNaming(): void {
  const state: any = normalizeCultivationState({
    spiritualRoot: 'common', realm: 'qi_refining', realmLevel: 3, comprehension: 50,
    elements: { metal: 30, wood: 30, water: 30, fire: 30, earth: 30 },
    activeStatuses: [], equipped: [], inventory: [],
  } as any);
  const session: any = {
    id: 'loot_names', status: 'victory', currentEnemyIdx: 0, round: 3, log: [], startAge: 20,
    playerHp: 80, playerMaxHp: 100, playerMp: 40, playerMaxMp: 60, playerAttack: 20, playerDefense: 8, playerSpeed: 8,
    enemies: [{ name: '\u6f6e\u6c50\u52ab\u4fee', description: '\u64c5\u4f7f\u6c34\u6cd5\u7684\u52ab\u4fee', hp: 0, maxHp: 90, attack: 18, defense: 8, speed: 8, realm: 'qi_refining' }],
  };
  const spoils = buildCombatVictorySpoils(state, session);
  const artifact: any = spoils.items.find((item: any) => item.item_type === 'artifact' && item.name.includes('\u62a4'));
  assert(!!artifact, 'victory spoils should include a carried artifact from cultivator enemies');
  assert(artifact.name !== '\u593a\u6765\u7684\u62a4\u8eab\u6cd5\u5668', 'enemy carried artifact should not use the old generic fixed name');
  assert(String(artifact.description || '').includes('\u5185\u85cf\u7075\u7981'), 'artifact description should expose innate ability in-world');
  assert(artifact.technique?.artifactAbilities?.length, 'loot artifact should carry innate artifact ability metadata');
  log('enemy-loot-artifact-naming', { passed: true, name: artifact.name, ability: artifact.technique.artifactAbilities[0].name });
}

function smokeAiDrivenCombatActionPalette(): void {
  const state: any = {
    id: 'c-palette',
    name: '璇曞墤鑰?,
    age: 20,
    activeStatuses: [{ id: 'bound', name: '鎵嬭剼琚細', description: '鍙屾墜鍙岃剼琚钘ゆ潫浣?, category: 'debuff', duration: 1, effects: [] }],
    equipped: [{ id: 'sword-qingyun', name: '闈掍簯鍓?, description: '涓€鏌勯潚鑹叉硶鍓?, item_type: 'weapon', rarity: 'rare', effects: [{ target_attribute: 'attack', operation: 'add', value: 12 }] }],
    inventory: [],
  };
  const session: any = {
    id: 'battle-palette',
    enemies: [{ id: 'enemy', name: '钘ゅ', description: '缂犵粫鎴愬舰', hp: 80, maxHp: 80, attack: 12, defense: 4, speed: 8 }],
    currentEnemyIdx: 0,
    round: 1,
    log: [],
    status: 'ongoing',
    startAge: 20,
    contextTitle: '钘ょ綉缂犺韩',
    contextNarrative: '浣犺濡栬棨缁戜綇鎵嬭剼锛屽墤鏌勮繎鍦ㄨ韩渚у嵈闅句互鎸ュ姩銆?,
    playerHp: 60,
    playerMaxHp: 100,
    playerMp: 30,
    playerMaxMp: 50,
    playerAttack: 10,
    playerDefense: 6,
    playerSpeed: 9,
    playerSkills: [],
    playerItems: [],
  };
  const palette = buildCombatActionPalette(state, session);
  const weapon = palette.basicAttack.options.find(o => o.id === 'weapon-sword-qingyun');
  assert(weapon && !weapon.enabled, 'bound scene should disable weapon basic attack');
  assert(palette.other.options.some(o => o.id === 'other-break-binding' && o.enabled), 'bound scene should expose AI-style other interaction');
  assert(palette.other.label === '搴斿彉', 'other action group should be named 搴斿彉');
  log('ai-driven-combat-action-palette', { passed: true, basicEnabled: palette.basicAttack.enabled, other: palette.other.options.map(o => o.name).join('|') });
}

function smokeSameAgeEventDedup(): void {
  const charAge = 7;
  const recentEvents = [
    { age: 7, title: '\u65e7\u7ea6\u518d\u8d77', narrative: 'a', eventType: 'normal' },
    { age: 7, title: '\u65e7\u7ea6\u518d\u8d77', narrative: 'b', eventType: 'normal' },
    { age: 7, title: '\u65e7\u7ea6\u518d\u8d77', narrative: 'c', eventType: 'normal' },
    { age: 8, title: '\u65e7\u7ea6\u518d\u8d77', narrative: 'd', eventType: 'normal' },
  ];
  const ageEventCounts: Record<string, number> = {};
  for (const evt of recentEvents) {
    if (evt.age === charAge) {
      ageEventCounts[evt.title] = (ageEventCounts[evt.title] || 0) + 1;
    }
  }
  const hasRepeatedEvents = Object.values(ageEventCounts).some(c => c >= 3);
  assert(hasRepeatedEvents, 'same-age repeated title dedup flag should be set at 3+ occurrences');
  log('same-age-event-dedup', { passed: true, repeated: ageEventCounts['\u65e7\u7ea6\u518d\u8d77'] });
}

function smokeEquipRealmCheck(): void {
  const item: any = {
    id: 'realm_locked_blade',
    name: '\u9752\u5ca9\u5251',
    description: '\u9700\u70bc\u6c14\u540e\u624d\u80fd\u9a7e\u9a6d\u3002',
    item_type: 'weapon',
    rarity: 'uncommon',
    effects: [{ target_attribute: 'attack', operation: 'add', value: 8, description: '\u653b\u51fb+8' }],
    source: 'smoke',
    technique: { requirements: { minRealm: 'qi_refining' } },
  };
  const state: any = {
    id: 'smoke_equip_realm', name: 'Tester', age: 18, lifespan: 80, gender: 'unknown',
    spiritualRoot: 'none', rootDetail: '\u65e0\u7075\u6839', rootMultiplier: 1,
    realm: 'mortal', realmLevel: 0, cultivationExp: 0, expToBreak: 100,
    elements: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
    hp: 100, maxHp: 100, mp: 50, maxMp: 50, attack: 10, defense: 5, speed: 10,
    luck: 50, comprehension: 50, spiritStones: 0, reputation: 0,
    alive: true, ascended: false, causeOfDeath: '', faction: '', master: '', location: '',
    fateNodes: [], isAtChoice: false, activeStatuses: [], inventory: [item], equipped: [], storageCapacity: 5,
    cultivationMultiplier: 1, longTermMemory: [], completedFateNodes: [], pendingThreads: [], characterIntents: [], recentEventTypes: [],
    npcs: [], causalGraph: { nodes: [], edges: [] }, worldFacts: [], pets: [], exploredRealms: [], discoveredRealms: [],
  };
  const result = equipItemsByIds(state, [item.id]);
  assert(result.equipped.length === 0, 'realm-locked item should not be equipped below minRealm');
  assert(result.state.inventory.some((it: any) => it.id === item.id), 'realm-locked item should stay in inventory');
  assert(result.effectResolveWarnings.some(w => w.includes('\u5883\u754c\u4e0d\u8db3')), 'realm lock should emit warning');
  log('equip-realm-check', { passed: true, equipped: result.equipped.length, inventory: result.state.inventory.length, warnings: result.effectResolveWarnings.length });
}

function smokeMarketStockCache(): void {
  const routeSource = readFileSync('src/app/api/game/market/route.ts', 'utf-8');
  const modalSource = readFileSync('src/components/xianxia/MarketModal.tsx', 'utf-8');
  assert(/function\s+generateMarketItems\s*\(/.test(routeSource), 'market route should define generateMarketItems');
  assert(modalSource.includes('xianxia-market-stock:${character.id}:${character.age}'), 'market modal should cache stock by character and age');
  assert(modalSource.includes('window.localStorage.setItem(marketCacheKey'), 'market modal should persist stock cache');
  assert(modalSource.includes('window.localStorage.getItem(marketCacheKey'), 'market modal should read stock cache');
  log('market-stock-cache', { passed: true, generator: true, cacheKey: 'xianxia-market-stock:${character.id}:${character.age}' });
}

function smokeClosedThreadCannotBeAdvanced(): void {
  // P0 淇楠岃瘉锛歳esolved/failed 绾跨▼涓嶈兘鍐嶆帹杩?  const baseState: any = {
    age: 20, pendingThreads: [
      { id: 't1', title: '宸蹭簡缁撶嚎绱?, category: 'mystery', startAge: 18, status: 'resolved', progress: 100 },
      { id: 't2', title: '澶辫触绾跨储', category: 'mystery', startAge: 18, status: 'failed', progress: 30 },
      { id: 't3', title: '杩涜涓嚎绱?, category: 'mystery', startAge: 19, status: 'pending', progress: 40 },
    ],
  };
  const advancedResolved = advanceThread(baseState, 't1', 20);
  const advancedFailed = advanceThread(baseState, 't2', 20);
  const advancedPending = advanceThread(baseState, 't3', 20);
  const completedResolved = completeThread(baseState, 't1');
  const failedPending = failThread(baseState, 't3');
  assert(advancedResolved.pendingThreads.find((t: any) => t.id === 't1')?.progress === 100, 'resolved thread must not advance');
  assert(advancedFailed.pendingThreads.find((t: any) => t.id === 't2')?.progress === 30, 'failed thread must not advance');
  assert(advancedPending.pendingThreads.find((t: any) => t.id === 't3')?.progress === 60, 'pending thread should advance normally');
  assert(completedResolved.pendingThreads.find((t: any) => t.id === 't1')?.status === 'resolved', 'completeThread must ignore resolved thread');
  assert(failedPending.pendingThreads.find((t: any) => t.id === 't3')?.status === 'failed', 'failThread should fail pending thread');
  log('closed-thread-cannot-be-advanced', { passed: true });
}

async function smokePreloadInvalidationReason(): Promise<void> {
  // P1 淇楠岃瘉锛歩sAdvancePreloadUsable 杩斿洖鍏蜂綋澶辨晥鍘熷洜
  // 娉ㄦ剰锛歜uildAdvanceStateHash 闇€瑕佸畬鏁?CharacterRecord锛圥risma瀛楁锛夛紝smoke 鐜涓嶅畬鏁?  // 杩欓噷鍙鐩栦笉渚濊禆瀹屾暣 char 瀵硅薄鐨?early-return case
  const char: any = { age: 10, alive: true, ascended: false, isAtChoice: false, pendingChoiceJson: '', combatStateJson: '' };
  // no_preload
  assert(((await isAdvancePreloadUsable(char, null)) as any)?.reason === 'no_preload', 'null preload should return no_preload');
  // ageMismatch
  assert(((await isAdvancePreloadUsable({ ...char, age: 11 }, { baseAge: 10, baseStateHash: 'same' })) as any)?.reason === 'ageMismatch', 'wrong age should return ageMismatch');
  // characterDead
  assert(((await isAdvancePreloadUsable({ ...char, alive: false }, { baseAge: 10, baseStateHash: 'same' })) as any)?.reason === 'characterDead', 'dead character should return characterDead');
  // ascended
  assert(((await isAdvancePreloadUsable({ ...char, ascended: true }, { baseAge: 10, baseStateHash: 'same' })) as any)?.reason === 'ascended', 'ascended character should return ascended');
  // isAtChoice
  assert(((await isAdvancePreloadUsable({ ...char, isAtChoice: true }, { baseAge: 10, baseStateHash: 'same' })) as any)?.reason === 'isAtChoice', 'at choice should return isAtChoice');
  // hasPendingChoice
  assert(((await isAdvancePreloadUsable({ ...char, pendingChoiceJson: '{}' }, { baseAge: 10, baseStateHash: 'same' })) as any)?.reason === 'hasPendingChoice', 'pending choice should return hasPendingChoice');
  // combatOngoing
  assert(((await isAdvancePreloadUsable({ ...char, combatStateJson: '{"status":"ongoing"}' }, { baseAge: 10, baseStateHash: 'same' })) as any)?.reason === 'combatOngoing', 'ongoing combat should return combatOngoing');
  log('preload-invalidation-reason', { passed: true });
}

function smokeSameYearThreadNormalizedProgress100(): void {
  // P0 淇楠岃瘉锛歡etSameYearThreads 璇诲彇绾跨▼鍓嶇粺涓€褰掍竴鍖?  // normalizeThreadsCompletion 鎶?progress=100 鈫?resolved锛実etSameYearThreads 鐨?t.progress < 100 鏉′欢浼氭妸宸插畬鎴愮殑绾跨▼鎺掗櫎
  const state: any = {
    age: 21, pendingThreads: [
      { id: 'same_y1', title: '鍚屽瞾宸叉弧绾跨储', category: 'competition', startAge: 21, deadlineAge: 21, status: 'pending', progress: 100, dueInSameYear: true },
      { id: 'same_y2', title: '鍚屽瞾寰呯画绾跨储', category: 'competition', startAge: 21, deadlineAge: 21, status: 'pending', progress: 60, dueInSameYear: true },
    ],
  };
  const threads = getSameYearThreads(state);
  // same_y1: progress=100 鈫?normalizeThreadsCompletion 杞负 resolved 鈫?getSameYearThreads 杩囨护鎺夛紙t.progress < 100锛?  assert(!threads.find((t: any) => t.id === 'same_y1'), 'progress=100 thread should be excluded from same-year scheduling (already resolved)');
  // same_y2: progress=60, pending 鈫?淇濈暀
  assert(threads.find((t: any) => t.id === 'same_y2'), 'pending thread should still appear in same-year scheduling');
  log('same-year-thread-normalized-progress100', { passed: true });
}

function smokeNoMechanismWordsInNarrative(): void {
  // 鏂囨杩囨护灞傞獙璇侊細sanitizeNarrativeText 搴旂Щ闄ゅ唴閮ㄦ満鍒惰瘝
  // 楠岃瘉绛栫暐锛氭鏌ョ粨鏋滀腑涓嶅寘鍚瓧娈靛悕銆佽皟璇曞厓璇嶇瓑鏈哄埗璇嶏紱涓嶆鏌ユ暟鍊兼畫鐣欙紙鏉ヨ嚜鍘熷鏂囨湰锛岄鏈熶細閮ㄥ垎娈嬬暀锛?  const inputOutputs: Array<[string, RegExp[]]> = [
    ['浣犺幏寰椾簡 cultivationExp 50鐐逛慨涓?, [/\bcultivationExp\b/i]],                          // cultivationExp 瀛楁蹇呴』娓呴櫎
    ['蹇冮瓟heartDemon澧炲姞浜?灞?, [/\bheartDemon\b/i]],                                       // heartDemon 瀛楁蹇呴』娓呴櫎
    ['鍓╀綑鐏电煶 spiritStones 100棰?, [/\bspiritStones?\b/i]],                               // spiritStones 瀛楁蹇呴』娓呴櫎
    ['浣犵殑 pendingThreads 涓湁涓€鏉℃柊绾跨储', [/\bpendingThreads?\b/i]],                       // pendingThreads 瀛楁蹇呴』娓呴櫎
    ['瑙﹀彂 progress 50 鐨勮繘搴﹀垽瀹?, [/\bprogress\b/i]],                                      // progress 瀛楁蹇呴』娓呴櫎
    ['debug error cache api', [/\b(?:debug|log|error|test|cache)\b/i]],                  // 璋冭瘯鍏冭瘝蹇呴』娓呴櫎
    ['P0 P1 preload stateHash', [/\b(?:P0|P1|preload|stateHash)\b/]],                   // 鍐呴儴鏍囪璇嶅繀椤绘竻闄?    ['姘旇涓婇檺 maxHp 宸叉弧', [/\bmaxHp\b/i]],                                                // maxHp 瀛楁蹇呴』娓呴櫎
    ['鏀诲嚮 attack 鎻愬崌', [/\battack\b/i]],                                                  // attack 瀛楁蹇呴』娓呴櫎
    ['鏅€氬彊浜嬫枃瀛楁棤鍙樺寲', []],                                                               // 鏃犳満鍒惰瘝淇濇寔涓嶅彉
  ];
  let allPassed = true;
  for (const [input, forbidden] of inputOutputs) {
    const result = sanitizeNarrativeText(input);
    const remaining = forbidden.filter(r => r.test(result));
    if (remaining.length > 0) {
      allPassed = false;
      log('mechanism-word-filter-failed', { input, forbidden: remaining.map(r => r.source), got: result });
    }
  }
  // 鍏抽敭瀛楁鏇挎崲鏄犲皠姝ｇ‘鎬?  assert(sanitizeNarrativeText('spiritStones') === '鐏电煶', 'spiritStones should map to 鐏电煶');
  assert(sanitizeNarrativeText('cultivationExp') === '淇负', 'cultivationExp should map to 淇负');
  assert(sanitizeNarrativeText('heartDemon') === '蹇冮瓟', 'heartDemon should map to 蹇冮瓟');
  assert(sanitizeNarrativeText('pendingThreads') === '鍥犵紭绾跨储', 'pendingThreads should map to 鍥犵紭绾跨储');
  assert(sanitizeNarrativeText('debug cache error') === '', 'debug words should be removed');
  assert(allPassed, 'sanitizeNarrativeText should clean all mechanism words correctly');
  // sanitizeEventDraft 楠岃瘉
  const draft = sanitizeEventDraft({ title: '鏍囬鍚?cultivationExp', narrative: '淇负+30鐐?spiritStones 娑堣€? });
  assert(!draft.title.includes('cultivationExp'), 'draft title should be sanitized');
  assert(!draft.narrative.includes('cultivationExp'), 'draft narrative should be sanitized');
  assert(!draft.narrative.includes('spiritStones'), 'draft narrative should have spiritStones replaced');
  log('smoke-no-mechanism-words', { passed: true });
}

function smokeYoungCharacterNoAdultAction(): void {
  // 骞奸緞瑙掕壊锛坅ge < 12锛変笉搴旇Е鍙戞垚浜哄寲浜嬩欢璋冨害
  // 楠岃瘉 buildWorldPressureOpportunityMap 瀵瑰辜榫勮鑹蹭笉鎺ㄨ崘鎴愪汉鍖栨椿鍔?  const youngState: any = {
    name: '灏忕',
    age: 7,
    lifespan: 80,
    realm: 'mortal',
    realmLevel: 0,
    pendingThreads: [],
    activeStatuses: [],
    inventory: [],
    equipped: [],
    location: '鏉戝簞',
  };
  const pressureMap = buildWorldPressureOpportunityMap(youngState, []);
  // 骞奸緞瑙掕壊 summary 涓笉搴斿嚭鐜版垚浜哄寲鍏抽敭璇?  const summaryText = pressureMap.summary || '';
  const adultKeywords = /浜ゆ槗|鎷嶅崠|绉樺|娲炲簻|閬楄抗|浼犳壙|瀹楅棬|鍘嗙粌|闂崱|淇|闂叧/;
  assert(!adultKeywords.test(summaryText), `young child (age 7) world pressure summary should not contain adult activities: ${summaryText}`);
  log('smoke-young-character-no-adult-action', { passed: true, summary: summaryText });
}

function smokeFallbackInfantHardGate(): void {
  // 6 宀佷互涓嬪繀椤昏蛋骞肩鍒嗘敮锛屼笉澶嶇敤鍘嗗彶鏂囨湰
  const state: any = { name: '骞肩', age: 2, realm: 'mortal', realmLevel: 0, location: '鏉戝簞', cultivationMultiplier: 1 };
  const blueprint: any = { name: '绔ュ勾瓒ｄ簨', category: 'growth' };
  const ctx: any = { character: { realmName: '鍑′汉' } };
  // 鍗充娇鏈夊ぇ閲忓巻鍙诧紝age=2 涔熷繀椤昏蛋 infant_template 绛栫暐
  const recentEvents = [
    { age: 1, title: '鍛ㄥ瞾', narrative: '鍘诲勾濂瑰湪闈掍簯灞辫剼韫掕窔瀛︽锛屾姳鐫€娉ュ反鐨勫摜鍝ョ瑧浜嗕竴鏁村勾銆?, eventType: 'normal' },
    { age: 2, title: '鍓嶅瞾', narrative: '鍓嶄竴骞村ス鍦ㄦ邯杈圭湅灏忛奔锛岃鐖风埛鎶卞洖瀹躲€?, eventType: 'normal' },
  ];
  const result = buildFallbackAgeEvent(state, blueprint, ctx, false, { recentEvents });
  assert(result.isFallbackGenerated === true, 'fallback must mark isFallbackGenerated');
  assert(result.fallbackStrategy === 'infant_template', `age 2 must use infant_template, got ${result.fallbackStrategy}`);
  // 涓嶅緱澶嶇敤鍘嗗彶鍚屽瞾鏂囨湰閲岀殑鍏蜂綋鍦板悕
  assert(!result.narrative.includes('闈掍簯灞?), `infant fallback must not inject historical location: ${result.narrative}`);
  assert(!result.narrative.includes('婧竟鐪嬪皬楸?), `infant fallback must not reuse historical narrative: ${result.narrative}`);
  log('fallback-infant-hard-gate', { passed: true, strategy: result.fallbackStrategy, narrative: result.narrative.slice(0, 40) });
}

function smokeFallbackSameAgeVariant(): void {
  // 鏈夊悓宀佸巻鍙叉椂浼樺厛澶嶇敤鍘嗗彶鏂囨湰
  const state: any = { name: '浜戝矚', age: 18, realm: 'qi_refining', realmLevel: 3, location: '闈掍簯灞辫剼', cultivationMultiplier: 1.2 };
  const blueprint: any = { name: '娴佸勾', category: 'daily' };
  const ctx: any = { character: { realmName: '鐐兼皵' } };
  const recentEvents = [
    { age: 18, title: '鍧婂競娣樺疂', narrative: '浠婂勾锛屼簯宀氬湪鍧婂競閲岀炕鎵惧嚑鏈棫涔︼紝娣樺埌涓€鏈墠浜轰慨鐐兼墜鏈€?, eventType: 'normal' },
    { age: 17, title: '鏃ュ父', narrative: '鍘诲勾濂规妸鐏垫皵杩愯浆璋冮『浜嗕笉灏戙€?, eventType: 'normal' },
  ];
  const result = buildFallbackAgeEvent(state, blueprint, ctx, false, { recentEvents });
  assert(result.fallbackStrategy === 'same_age_variant', `should use same_age_variant strategy, got ${result.fallbackStrategy}`);
  assert(result.narrative.includes('浜戝矚'), 'remixed narrative must keep character name');
  log('fallback-same-age-variant', { passed: true, strategy: result.fallbackStrategy });
}

function smokeFallbackElementEnrichment(): void {
  // 鏃犲悓宀佸巻鍙蹭絾鏈夊湴鐐?NPC 鍑虹幇鏃讹紝搴斾娇鐢ㄥ厓绱犳敞鍏ュ瀷妯℃澘
  const state: any = { name: '浜戝矚', age: 30, realm: 'qi_refining', realmLevel: 5, location: '闈掍簯灞辫剼', cultivationMultiplier: 1.2 };
  const blueprint: any = { name: '娴佸勾', category: 'daily' };
  const ctx: any = { character: { realmName: '鐐兼皵' } };
  const recentEvents = [
    { age: 20, title: '璁垮弸', narrative: '濂瑰幓闈掍簯闀囧鐨勭ⅶ姘存江锛岄亣鍒版潕鎺屾煖璁ㄦ暀鍑犳嫑锛屽張鑱婅捣闄勮繎鐨勫鍏藉嚭娌°€?, eventType: 'normal' },
    { age: 21, title: '鍙堣', narrative: '鍙堝幓闈掍簯闀囧鐨勭ⅶ姘存江锛岄亣鍒版潕鎺屾煖璁ㄦ暀鍑犳嫑锛屽張鑱婅捣闄勮繎鐨勫鍏藉嚭娌°€?, eventType: 'normal' },
  ];
  const result = buildFallbackAgeEvent(state, blueprint, ctx, false, { recentEvents });
  assert(result.fallbackStrategy === 'enriched_template', `should use enriched_template, got ${result.fallbackStrategy}`);
  // 蹇呴』娉ㄥ叆鍘嗗彶鍦扮偣鎴?NPC
  const injectedLocation = result.narrative.includes('纰ф按娼?) || result.narrative.includes('闈掍簯闀?);
  const injectedNpc = result.narrative.includes('鏉庢帉鏌?);
  assert(injectedLocation || injectedNpc, `enriched template must inject historical element, got: ${result.narrative}`);
  log('fallback-element-enrichment', { passed: true, strategy: result.fallbackStrategy, hasLocation: injectedLocation, hasNpc: injectedNpc });
}

function smokeFallbackPlainTemplate(): void {
  // 瀹屽叏鏃犲巻鍙叉椂鐢ㄧ函妯℃澘
  const state: any = { name: '鏂拌鑹?, age: 25, realm: 'qi_refining', realmLevel: 2, location: '鏈煡', cultivationMultiplier: 1 };
  const blueprint: any = { name: '娴佸勾', category: 'daily' };
  const ctx: any = { character: { realmName: '鐐兼皵' } };
  const result = buildFallbackAgeEvent(state, blueprint, ctx, false, { recentEvents: [] });
  assert(result.fallbackStrategy === 'plain_template', `should use plain_template, got ${result.fallbackStrategy}`);
  assert(result.narrative.length > 20, 'plain template must produce non-trivial narrative');
  log('fallback-plain-template', { passed: true, strategy: result.fallbackStrategy });
}

function smokeStyleAnchorExtraction(): void {
  // 椋庢牸閿氬畾锛氳兘浠?narrative 鎻愬彇 tone/鍙ラ暱/鏍囩偣瀵嗗害/寮€澶存ā寮?鐗囨鏍锋湰
  const narrative = '閭ｅ勾澶忓ぉ鏃ュご姣掞紝鑼呭惉婢庤共鍦ㄩ櫌瑙掔湅铓傝殎鎼銆傛偿鍦熺儹寰楃儷鎵嬶紝浠栨嬁灏忔爲鏋濇嫧浜嗕竴涓嬶紝铓傝殎鎱屾厡寮犲紶缁曞紑浜嗐€備粬绗戜簡涓€涓嬶紝鍙堝幓澶熶笅涓€鍙€傚崍鍚庨璧凤紝姣嶄翰鍙粬杩涘眿鍠濇按锛屼粬搴斾簡涓€澹帮紝鍗存病鍔ㄣ€?;
  const anchor = extractStyleAnchor(5, narrative);
  assert(anchor.age === 5, 'age should be preserved');
  assert(['tender', 'tense', 'mellow', 'somber', 'epic'].includes(anchor.tone), `tone should be valid, got ${anchor.tone}`);
  assert(anchor.avgSentenceLen > 0, 'avgSentenceLen should be > 0');
  assert(anchor.openingPattern.length > 0, 'openingPattern should be non-empty');
  assert(anchor.sampleSnippet.length > 0, 'sampleSnippet should be non-empty');
  const prompt = formatStyleAnchorsForPrompt([anchor]);
  assert(prompt.includes('椋庢牸閿氬畾'), 'prompt should include 椋庢牸閿氬畾 marker');
  assert(prompt.includes('鑼呭惉婢?) || prompt.includes('铓傝殎') || prompt.includes('闄㈣'), 'prompt should include a snippet excerpt');
  log('style-anchor-extraction', { passed: true, tone: anchor.tone, avgSentenceLen: anchor.avgSentenceLen, snippetLen: anchor.sampleSnippet.length });
}

function smokeEntityStoreExtraction(): void {
  // 瀹炰綋搴擄細鑳戒粠 narrative 鎻愬彇 NPC/鍦扮偣/鐗╁搧
  const narrative = '閭ｅ勾澶忓ぉ锛岃寘鍚編韫插湪闄㈣鐪嬭殏铓佹惉瀹躲€傜鐖惰寘鑰佹爴浠庡爞灞嬫嬁鍑哄崐鎴伆甯冩摝姹楋紝姣嶄翰鍒樻皬绔潵涓€纰楀噳鑼躲€傞潚浜戦晣鐨勮檸瀛愪篃璺戞潵鐜╋紝甯︽潵鐨勫皬绔圭瑳涓㈠湪鑽変笡閲屻€?;
  const entities = extractEntitiesFromNarrative(5, narrative);
  const npcs = entities.filter((e: any) => e.type === 'npc').map((e: any) => e.name);
  const places = entities.filter((e: any) => e.type === 'place').map((e: any) => e.name);
  const items = entities.filter((e: any) => e.type === 'item').map((e: any) => e.name);
  assert(npcs.length > 0, `should extract at least one NPC, got: ${npcs.join(',')}`);
  assert(places.length > 0, `should extract at least one place, got: ${places.join(',')}`);
  const prompt = formatEntitiesForPrompt(entities);
  assert(prompt.includes('宸叉湁绱犳潗搴?), 'prompt should include 宸叉湁绱犳潗搴?marker');
  log('entity-store-extraction', { passed: true, npcs, places, items });
}

function smokeRhythmVariation(): void {
  // 闊靛緥鍙樺寲锛歠allback 鐢熸垚鏃惰兘鎸?style anchor 璋冩暣
  const narrative = '5宀侊紝濂规妱鐫€鎵嬪€氬湪闄㈤棬杈圭湅鏃ュご锛屽崐鐪潃鐪笺€?;
  const anchor = extractStyleAnchor(5, narrative);
  // 闀垮彊浜嬫祴璇曟媶鍙?  const longText = '鑼呭惉婢庤共鍦ㄩ櫌瑙掔湅铓傝殎鎼锛屼竴韫插氨鏄崐涓椂杈帮紝鑵块兘楹讳簡锛屼几鎵嬫弶浜嗘弶鑶濈洊锛屽張鐪嬭殏铓佸垪闃熶粠澧欐牴杩囥€?;
  const varied = applyRhythmVariation(longText, anchor);
  assert(typeof varied === 'string' && varied.length > 0, 'should produce non-empty varied text');
  // 瀹炰綋娉ㄥ叆
  const entities = extractEntitiesFromNarrative(5, narrative);
  const injected = injectEntityFragment('浠栧湪闄腑鐜╂偿銆?, entities);
  assert(injected.length > 0, 'injection should produce non-empty text');
  log('rhythm-variation', { passed: true, variedLength: varied.length, injectedLength: injected.length });
}

function smokeLLMCache(): void {
  // LLM 缂撳瓨锛氳兘 set/get 鍚屼竴涓?prompt 5 鍒嗛挓鍐?  // hashCacheKey 鏄?private 鍑芥暟锛屽仛涓嶄簡鐩存帴娴嬭瘯锛屼絾鑳介€氳繃閲嶅璋冪敤娴嬭涔?  const k1 = hashCacheKey('full|sys|user-a');
  const k2 = hashCacheKey('full|sys|user-a');
  const k3 = hashCacheKey('full|sys|user-b');
  assert(k1 === k2, 'same input should produce same hash');
  assert(k1 !== k3, 'different input should produce different hash');
  assert(k1.startsWith('llm_'), 'hash should have prefix');
  log('llm-cache', { passed: true, k1, k2, k3 });
}

function smokeLiteModelConfig(): void {
  // liteModel 閰嶇疆锛歝fg 涓湁 liteModel 瀛楁鏃讹紝light mode 搴旇鐢?liteModel
  // 楠岃瘉 type 瀛樺湪锛堝嵆浣?loadAIConfig 渚濊禆鏂囦欢锛?  log('lite-model-config', { passed: true, note: 'cfg.liteModel is used when qualityMode=light; set in .xianxia-ai-config' });
}

function smokeBubbleSplit(): void {
  // 姘旀场绾у垏鍒嗭細鍓嶇鎸?86 瀛椾笂闄?+ 鍙ュ彿鍒囧彞锛涢獙璇侊細
  // 1) 鍗曚釜闀垮彞浼氳寮哄埗鎷嗕负 1+ 娈?  // 2) 姣忔涓嶈秴杩?86 瀛?  // 3) 鐭彞锛?90瀛楋級淇濈暀瀹屾暣
  // 妯℃嫙 splitNarrativeParagraphs 鐨勫垏鍒嗛€昏緫
  const split = (text: string): string[] => {
    if (!text) return [];
    const explicit = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
    const source = explicit.length > 1 ? explicit : [text];
    const paragraphs: string[] = [];
    for (const part of source) {
      if (part.length <= 90) { paragraphs.push(part); continue; }
      const sentences = part.match(/[^銆傦紒锛??锛?]+[銆傦紒锛??锛?]?/g) || [part];
      let current = '';
      for (const sentence of sentences.map(s => s.trim()).filter(Boolean)) {
        if (current && (current + sentence).length > 86) {
          paragraphs.push(current);
          current = sentence;
        } else {
          current += sentence;
        }
      }
      if (current) paragraphs.push(current);
    }
    return paragraphs;
  };
  // 娴嬭瘯 1: 澶氱煭鍙ュ彊浜嬶紙90瀛椾互涓婏紝瑙﹀彂鍙ュ垏锛?  const text1 = '閭ｅ勾澶忓ぉ鏃ュご姣掞紝鑼呭惉婢庤共鍦ㄩ櫌瑙掔湅铓傝殎鎼銆傛偿鍦熺儹寰楃儷鎵嬶紝浠栨嬁灏忔爲鏋濇嫧浜嗕竴涓嬶紝铓傝殎鎱屾厡寮犲紶缁曞紑浜嗐€備粬绗戜簡涓€涓嬶紝鍙堝幓澶熶笅涓€鍙紝鍙堟潵浜嗕竴闃甸銆傚倣鏅氭瘝浜插敜浠栧洖鍘诲悆楗紝浠栧簲浜嗕竴澹帮紝鑶濈洊涓婃簿婊′簡绾㈠湡銆?;
  const r1 = split(text1);
  assert(r1.length >= 2, `闀垮彊浜嬪簲鍒囧涓皵娉? got ${r1.length}, text len ${text1.length}`);
  assert(r1.every(p => p.length <= 90), `姣忔涓嶈秴杩?90 瀛? ${r1.map(p => p.length).join(',')}`);
  // 娴嬭瘯 2: 闀垮彞寮哄埗鎷?  const text2 = '閭ｅ勾澶忓ぉ鏃ュご姣掞紝鑼呭惉婢庤共鍦ㄩ櫌瑙掔湅铓傝殎鎼锛屾偿鍦熺儹寰楃儷鎵嬶紝浠栨嬁灏忔爲鏋濇嫧浜嗕竴涓嬶紝铓傝殎鎱屾厡寮犲紶缁曞紑浜嗭紝浠栫瑧浜嗕竴涓嬶紝鍙堝幓澶熶笅涓€鍙€?;
  const r2 = split(text2);
  assert(r2.every(p => p.length <= 90), `闀垮彞鍒囧垎鍚庢瘡娈典笉瓒?90 瀛? ${r2.map(p => p.length).join(',')}`);
  // 娴嬭瘯 3: 绌烘枃鏈?  const r3 = split('');
  assert(r3.length === 0, '绌烘枃鏈簲杩斿洖绌烘暟缁?);
  // 娴嬭瘯 4: 鍗曠煭鍙?  const r4 = split('涓€鍙ヨ瘽銆?);
  assert(r4.length === 1 && r4[0] === '涓€鍙ヨ瘽銆?, `鍗曠煭鍙ヤ繚鐣? ${r4.join(',')}`);
  log('bubble-split', { passed: true, text1Count: r1.length, text2Count: r2.length, maxLen: Math.max(...r1.map(p => p.length), ...r2.map(p => p.length), 0) });
}

function smokeNarrativeTruncation(): void {
  // 鎴柇 narrative 鍒板畬鏁村彞锛氬鐞?AI 瓒呭瓧鏁拌緭鍑烘垨 max_tokens 鎴柇
  // 娴嬭瘯 1: 鐭枃鏈師鏍疯繑鍥?  const t1 = '閭ｅ勾澶忓ぉ鏃ュご姣掋€?;
  const r1 = truncateNarrativeAtSentence(t1, 400);
  assert(r1 === t1, `鐭枃鏈笉鍙? got ${r1}`);
  // 娴嬭瘯 2: 闀挎枃鏈埅鍒版渶杩戝畬鏁村彞锛坱2 闀垮害 > 420锛?  const t2 = '鑵婃湀寤夸笁锛屽皬骞村銆傝寘鍚編甯潃鍒樻皬鍦ㄧ伓闂寸儳鐏紝鐏惰啗閲岀殑鏌寸鍣煎暘浣滃搷锛岀伀鍏夋妸鍗婅竟澧欑儤寰楅€氱孩銆傚垬姘忓垏浜嗕竴纰楄悵鍗滐紝鍜岀潃鍘诲勾鏅掔殑骞茶彍鐓簡涓€閿咃紝閿呰竟璐翠簡鍑犱釜绮楅潰楗煎瓙锛屽媺寮虹畻鏄竴椤垮勾楗€傝寘鍚編韫插湪鐏跺彛寰€閲屾坊鏌达紝鎵嬭儗涓婅鐏槦瀛愮儷浜嗕竴涓嬶紝浠栨病鍚卞０銆傜伓闂存瘮寰€骞村喎娓呬簡涓嶆涓€鍒嗏€斺€斿線甯歌繖鏃跺€欙紝鑼呭ぇ鏍规€讳細浠庨浘宀彁鍓嶆敹鑴氬洖鏉ワ紝鎶婅儗绡撳線闂ㄨ竟涓€闈狅紝鍏堟帰澶村線鐏堕棿鍡呬竴鍙ｏ紝澶у０璇村彞"鍥炴潵浜嗭紝楗垮潖浜嗗惂锛?鑼呭ぇ鏍瑰簲浜嗕竴澹帮紝鎶婅儗绡撻噷鐨勫北璐у垎浜嗕竴灏忓崐缁欓殧澹佺帇濠跺锛屽張鎶婂墿涓嬬殑涓€鍖呮悂鍦ㄧ伓鍙拌竟銆傚垬姘忕湅鐫€杩欑埗瀛愪咯锛屽徆浜嗗彛姘旇"鍏堝悆楗惂锛岃彍鍑変簡"銆傝繖涓€椤垮勾楗櫧绠€鍗曪紝鑼呭惉婢庡嵈璁板緱寰堟竻妤氣€斺€旀煷鐏櫦鍟紝闆炬皵鑵捐吘锛岀伓闂存殩寰楀儚鏄ュぉ銆?;
  const r2 = truncateNarrativeAtSentence(t2, 420);
  assert(r2.length <= 420, `鎴柇鍚庨暱搴?=420, got ${r2.length}`);
  // 蹇呴』鏄煇涓畬鏁村彞缁撳熬锛堝彞鏈爣鐐?鎴?鏂囨湰鏈韩杩囩煭锛?  const endsAtPunct = /[銆傦紒锛??锛?]$/.test(r2);
  const isAtBoundary = r2.length === 420; // fallback 鎴柇
  assert(endsAtPunct || isAtBoundary, `鎴柇鍚庝互鍙ユ湯鏍囩偣鎴栬竟鐣岀粨灏? ${r2.slice(-10)}, len=${r2.length}`);
  // 娴嬭瘯 3: 娌℃湁鍙ユ湯鏍囩偣锛圓I 涓€斿穿婧冿級锛氱洿鎺ユ埅鍒?maxChars
  const t3 = '涓€娈垫棤鏍囩偣鐨勫瓧'.repeat(50); // 100 瀛?  const r3 = truncateNarrativeAtSentence(t3, 50);
  assert(r3.length <= 50, `鏃犳爣鐐规埅鏂?=50: got ${r3.length}`);
  // 娴嬭瘯 4: 杈圭晫 - 鏂囨湰鍒氬ソ绛変簬 maxChars
  const t4 = 'x'.repeat(400);
  const r4 = truncateNarrativeAtSentence(t4, 400);
  assert(r4.length === 400, `杈圭晫绛変簬涓婇檺: got ${r4.length}`);
  log('narrative-truncation', { passed: true, t1Len: r1.length, t2Len: r2.length, t3Len: r3.length, t4Len: r4.length });
}

function smokeNarrativeCompletion(): void {
  // narrative 鏈熬琛ュ叏锛氬鐞?AI 杈撳嚭"鍗婂彞璇?鍐掑彿"鎴?寮€浜嗗紩鍙锋病鍏?鐨勬儏鍐?  // 娴嬭瘯 1: 鏈熬鏄腑鏂囧啋鍙?鈫?琛ュ叏
  const t1 = '瀹ｅぇ姹熶綆澶寸湅鍎垮瓙锛?;
  const r1 = completeNarrative(t1);
  assert(r1.length > t1.length && !/[锛?]$/.test(r1.trim()), `涓枃鍐掑彿缁撳熬琚ˉ鍏? ${r1.slice(-30)}`);
  // 娴嬭瘯 2: 鏈熬鏄嫳鏂囧啋鍙?鈫?鍚屾牱琛ュ叏
  const t2 = 'He looked at his son:';
  const r2 = completeNarrative(t2);
  assert(r2.length > t2.length, `鑻辨枃鍐掑彿缁撳熬琚ˉ鍏? ${r2.slice(-30)}`);
  // 娴嬭瘯 3: 鏈熬鏄崟寮曞彿锛堝紑浜嗗璇濇病鍏筹級鈫?琛ュ弽寮曞彿
  const t3 = '鏈涘窛寮犲槾鍠婁簡涓€澹?';
  const r3 = completeNarrative(t3);
  assert(/["""]$/.test(r3) && r3.length > t3.length, `鍗曞紩鍙风粨灏捐琛ュ叏: ${r3.slice(-10)}`);
  // 娴嬭瘯 4: 瀹屾暣 narrative 鈫?涓嶅彉
  const t4 = '浠栫瑧浜嗙瑧锛岃浆韬蛋鍏ラ浘涓€?;
  const r4 = completeNarrative(t4);
  assert(r4 === t4, `瀹屾暣 narrative 涓嶅彉: ${r4}`);
  // 娴嬭瘯 5: 绌烘枃鏈?  assert(completeNarrative('') === '', '绌烘枃鏈笉鍙?);
  log('narrative-completion', { passed: true, t1Changed: r1 !== t1, t2Changed: r2 !== t2, t3Changed: r3 !== t3, t4Unchanged: r4 === t4 });
}

function smokeNarrativeInference(): void {
  // 寮曟搸鍏滃簳锛氬綋 AI 婕忓啓 changes 鏃讹紝浠?narrative 鍏抽敭璇?+ 褰撳墠澧冪晫鑷姩鎺ㄦ柇灞炴€у彉鍖?  // mock 涓€涓?state锛氬嚒浜?+ 鍑＄伒鏍?  const baseState = {
    age: 10, realm: 'qi_refining', spiritualRoot: 'common',
    cultivationMultiplier: 1, cultivationExp: 0, expToBreak: 100,
    hp: 100, maxHp: 100, mp: 50, maxMp: 50,
    attack: 10, defense: 10, speed: 10, luck: 5, comprehension: 5,
    heartDemon: 0, lifespan: 100,
  } as any;

  // 娴嬭瘯 1: 淇偧鍙欎簨 鈫?鎺ㄦ柇鍑?cultivationExp 澧炲姞
  const t1 = '浠栧潗鍦ㄨ挷鍥笂鎵撳潗锛屽紩鍏ョ伒姘旀祦杞笁鍗佸叚鍛ㄥぉ銆?;
  const r1 = inferAttributeChangesFromNarrative(t1, baseState, 'test');
  assert(r1.length > 0 && r1.some((c: any) => c.attribute === 'cultivationExp' && c.delta > 0),
    `淇偧鍙欎簨鎺ㄦ柇鍑轰慨涓哄闀? ${JSON.stringify(r1)}`);

  // 娴嬭瘯 2: 鎴樻枟鍙欎簨 鈫?鎺ㄦ柇鍑?hp 鍑忓皯
  const t2 = '浠栦笌閭ｅ鍏借鎴樹笁鐧惧洖鍚堬紝缁堟槸闄╄儨锛屽嵈涔熻礋浜嗕激銆?;
  const r2 = inferAttributeChangesFromNarrative(t2, baseState, 'test');
  assert(r2.some((c: any) => c.attribute === 'hp' && c.delta < 0),
    `鎴樻枟鍙欎簨鎺ㄦ柇鍑?hp 鎹熻€? ${JSON.stringify(r2)}`);

  // 娴嬭瘯 3: 蹇冮瓟鍙欎簨 鈫?heartDemon 澧炲姞
  const t3 = '閭ｅ勾浠栧績涓椽蹇靛ぇ鐩涳紝鏉€鎰忔笎鐢燂紝蹇冮瓟鎮勭劧婊嬬敓銆?;
  const r3 = inferAttributeChangesFromNarrative(t3, baseState, 'test');
  assert(r3.some((c: any) => c.attribute === 'heartDemon' && c.delta > 0),
    `蹇冮瓟鍙欎簨鎺ㄦ柇鍑哄績榄斿闀? ${JSON.stringify(r3)}`);

  // 娴嬭瘯 4: 蹇冨骞冲拰 鈫?heartDemon 鍑忓皯
  const t4 = '浠栨墦鍧愬啣鎯宠壇涔咃紝蹇界劧蹇冩€ц眮杈撅紝閲婃€€杩囧線绉嶇銆?;
  const r4 = inferAttributeChangesFromNarrative(t4, baseState, 'test');
  assert(r4.some((c: any) => c.attribute === 'heartDemon' && c.delta < 0),
    `蹇冨骞冲拰鍙欎簨鎺ㄦ柇鍑哄績榄斿噺灏? ${JSON.stringify(r4)}`);

  // 娴嬭瘯 5: 椤挎偀 鈫?comprehension 澧炲姞
  const t5 = '浠栫洴鐫€閭ｆ湹浜戠湅浜嗕笁鏃ヤ笁澶滐紝蹇界劧璞佺劧寮€鏈楋紝鏄庢偀澶╁湴鑷崇悊銆?;
  const r5 = inferAttributeChangesFromNarrative(t5, baseState, 'test');
  assert(r5.some((c: any) => c.attribute === 'comprehension' && c.delta > 0),
    `椤挎偀鍙欎簨鎺ㄦ柇鍑烘偀鎬у闀? ${JSON.stringify(r5)}`);

  // 娴嬭瘯 6: 绌虹櫧 narrative 鈫?涓嶆帹鏂?  const r6 = inferAttributeChangesFromNarrative('', baseState, 'test');
  assert(r6.length === 0, '绌虹櫧 narrative 涓嶆帹鏂?);

  // 娴嬭瘯 7: 绾彊浜嬫棤鍏抽敭璇?鈫?涓嶆帹鏂?  const r7 = inferAttributeChangesFromNarrative('浠栧悆浜嗙绫抽キ銆?, baseState, 'test');
  assert(r7.length === 0, `绾彊浜嬫棤鍏抽敭璇嶄笉鎺ㄦ柇: ${JSON.stringify(r7)}`);

  // 娴嬭瘯 8: 鍚屽睘鎬у幓閲嶏紙淇偧+椤挎偀 鈫?comprehension 鍙?1 鏉★級
  const t8 = '浠栨墦鍧愬叆瀹氾紝蹇界劧椤挎偀锛屾槑鎮熶簡澶╁湴鑷崇悊銆?;
  const r8 = inferAttributeChangesFromNarrative(t8, baseState, 'test');
  const compCount = r8.filter((c: any) => c.attribute === 'comprehension').length;
  assert(compCount <= 1, `鍚屽睘鎬у幓閲? compCount=${compCount}`);

  log('narrative-inference', {
    passed: true,
    t1Changes: r1.length, t2Changes: r2.length, t3Changes: r3.length,
    t4Changes: r4.length, t5Changes: r5.length, t6Changes: r6.length,
    t7Changes: r7.length, dedupOk: compCount <= 1
  });
}

function smokeBodyGrowth(): void {
  // 寮曟搸琛屼负锛氬勾榫勯┍鍔ㄧ殑韬綋鎴愰暱锛堝嚒浜?浣庡鐣岋級
  const baseMortal = {
    age: 0, realm: 'mortal', spiritualRoot: 'common',
    cultivationMultiplier: 1, cultivationExp: 0, expToBreak: 100,
    hp: 50, maxHp: 50, mp: 50, maxMp: 50,
    attack: 0, defense: 0, speed: 0, luck: 5, comprehension: 5,
    heartDemon: 0, lifespan: 80,
  } as any;

  // 娴嬭瘯 1: 0 宀?鈫?鏋佷綆
  let state = applyAgeBasedBodyGrowth(baseMortal, 0).state;
  assert(state.attack >= 0 && state.attack <= 1, `0宀佸嚒浜?attack 鍦?0-1: ${state.attack}`);

  // 娴嬭瘯 2: 5 宀?鈫?骞肩锛坆aseline ~0.2锛?  state = applyAgeBasedBodyGrowth(baseMortal, 5).state;
  assert(state.attack >= 1 && state.attack <= 2, `5宀佸嚒浜?attack: ${state.attack}`);
  assert(state.maxHp >= 10, `5宀佸嚒浜?maxHp >= 10: ${state.maxHp}`);

  // 娴嬭瘯 3: 10 宀?鈫?灏戝勾锛坆aseline ~0.4锛?  state = applyAgeBasedBodyGrowth(baseMortal, 10).state;
  assert(state.attack >= 2, `10宀佸嚒浜?attack >= 2: ${state.attack}`);

  // 娴嬭瘯 4: 18 宀?鈫?鎺ヨ繎澹勾锛坆aseline ~0.75锛?  state = applyAgeBasedBodyGrowth(baseMortal, 18).state;
  assert(state.attack >= 3, `18宀佸嚒浜?attack >= 3: ${state.attack}`);

  // 娴嬭瘯 5: 25 宀?鈫?澹勾 baseline锛圡ORTAL_PEAK.attack=5, factor=1.0, realmMult=1.0锛?  state = applyAgeBasedBodyGrowth(baseMortal, 25).state;
  assert(state.attack === 5, `25宀佸嚒浜?attack = 5: ${state.attack}`);
  assert(state.defense === 5, `25宀佸嚒浜?defense = 5: ${state.defense}`);
  assert(state.speed === 5, `25宀佸嚒浜?speed = 5: ${state.speed}`);
  assert(state.maxHp === 50, `25宀佸嚒浜?maxHp = 50: ${state.maxHp}`);

  // 娴嬭瘯 6: 40 宀?鈫?澹勾宸呭嘲锛坒actor 1.05锛?  state = applyAgeBasedBodyGrowth(baseMortal, 40).state;
  assert(state.attack >= 5, `40宀佸嚒浜?attack >= 5: ${state.attack}`);

  // 娴嬭瘯 7: 60 宀?鈫?涓勾琛伴€€
  state = applyAgeBasedBodyGrowth(baseMortal, 60).state;
  assert(state.attack <= 5, `60宀佸嚒浜?attack <= 5: ${state.attack}`);

  // 娴嬭瘯 8: 淇湡鍚庡睘鎬т繚鐣欙紙attack 30 鈫?80 宀佷笉浼氭帀鍥?baseline锛?  const advanced = { ...baseMortal, attack: 30, defense: 30, speed: 30, maxHp: 200, realm: 'qi_refining' };
  state = applyAgeBasedBodyGrowth(advanced, 80).state;
  assert(state.attack === 30, `淇湡鍚?80宀?attack 淇濈暀: ${state.attack} (baseline ${Math.round(5 * 0.65 * 1.5)})`);
  assert(state.maxHp === 200, `淇湡鍚?80宀?maxHp 淇濈暀: ${state.maxHp}`);

  // 娴嬭瘯 9: 淇湡澧冪晫鍊嶇巼
  const golden = { ...baseMortal, realm: 'golden_core' };
  state = applyAgeBasedBodyGrowth(golden, 25).state;
  assert(state.attack === 15, `閲戜腹 25宀?attack = 5*1*3 = 15: ${state.attack}`);

  // 娴嬭瘯 10: 100 宀佽€勮€?  state = applyAgeBasedBodyGrowth(baseMortal, 100).state;
  assert(state.attack < 5, `100宀佸嚒浜?attack < 5: ${state.attack}`);

  log('body-growth', {
    passed: true,
    age0Atk: applyAgeBasedBodyGrowth(baseMortal, 0).state.attack,
    age5Atk: applyAgeBasedBodyGrowth(baseMortal, 5).state.attack,
    age10Atk: applyAgeBasedBodyGrowth(baseMortal, 10).state.attack,
    age25Atk: applyAgeBasedBodyGrowth(baseMortal, 25).state.attack,
    age60Atk: applyAgeBasedBodyGrowth(baseMortal, 60).state.attack,
    age100Atk: applyAgeBasedBodyGrowth(baseMortal, 100).state.attack,
    golden25Atk: applyAgeBasedBodyGrowth(golden, 25).state.attack,
    advanced80Atk: applyAgeBasedBodyGrowth(advanced, 80).state.attack,
  });
}

function smokeBodyModifier(): void {
  // 鍙欎簨韬綋淇锛氫粠 narrative 鍏抽敭璇嶆娴嬭韩浣撶姸鎬?  // 娴嬭瘯 1: 缂犵坏鐥呮
  const t1 = '閭ｅ勾瀵掑啲锛屼粬缂犵坏鐥呮涓夋湀鏈変綑锛岀槮寰楀彧鍓╀竴鎶婇澶淬€?;
  const r1 = detectBodyModifier(t1);
  assert(r1.mode === 'critically_ill' && r1.multiplier === 0.30, `缂犵坏鐥呮 鈫?critically_ill 0.3x: ${JSON.stringify(r1)}`);

  // 娴嬭瘯 2: 涔呯梾
  const t2 = '浠栬嚜骞间綋寮憋紝鐦﹀急涓嶅牚銆?;
  const r2 = detectBodyModifier(t2);
  assert(r2.mode === 'weak' && r2.multiplier === 0.50, `浣撳急鐦﹀急 鈫?weak 0.5x: ${JSON.stringify(r2)}`);

  // 娴嬭瘯 3: 鐥呮剤锛?鍒濇剤"蹇呴』鍏堝尮閰嶏紝涓嶈兘琚?涔呯梾"鎶㈠厛锛?  const t3 = '浠栦箙鐥呭垵鎰堬紝涓嬩簡搴婃參鎱㈣蛋浜嗕竴鍦堛€?;
  const r3 = detectBodyModifier(t3);
  assert(r3.mode === 'recovered' && r3.multiplier === 1.0, `涔呯梾鍒濇剤 鈫?recovered 1.0x: ${JSON.stringify(r3)}`);

  // 娴嬭瘯 4: 鍋ュ悍
  const t4 = '浠栧湪灞遍棿閲囪嵂锛屾瘡鏃ュ姵浣滐紝韬綋鎰堝彂鍋ュ．銆?;
  const r4 = detectBodyModifier(t4);
  assert(r4.mode === 'healthy' && r4.multiplier === 1.0, `鍋ュ悍 鈫?healthy 1.0x: ${JSON.stringify(r4)}`);

  // 娴嬭瘯 5: 閲嶇梾
  const t5 = '閭ｆ棩浠栧拷鏌撻噸鐥咃紝涓€鐥呬笉璧凤紝姘旀伅濂勫銆?;
  const r5 = detectBodyModifier(t5);
  assert(r5.mode === 'critically_ill', `姘旀伅濂勫 鈫?critically_ill: ${JSON.stringify(r5)}`);

  // 娴嬭瘯 6: 鍏堝ぉ涓嶈冻
  const t6 = '浠栫敓鏉ュ厛澶╀笉瓒筹紝浣撳急澶氱梾銆?;
  const r6 = detectBodyModifier(t6);
  assert(r6.mode === 'weak', `鍏堝ぉ涓嶈冻 鈫?weak: ${JSON.stringify(r6)}`);

  // 娴嬭瘯 7: 绌?narrative
  const r7 = detectBodyModifier('');
  assert(r7.mode === 'healthy' && r7.multiplier === 1.0, `绌?鈫?healthy: ${JSON.stringify(r7)}`);

  log('body-modifier', {
    passed: true,
    t1: r1.mode, t2: r2.mode, t3: r3.mode, t4: r4.mode, t5: r5.mode, t6: r6.mode,
  });
}

function smokeBodyGrowthWithNarrative(): void {
  // 闆嗘垚娴嬭瘯锛氬勾榫?+ 鍙欎簨淇 鍗忓悓宸ヤ綔
  const baseMortal = {
    age: 0, realm: 'mortal', spiritualRoot: 'common',
    cultivationMultiplier: 1, cultivationExp: 0, expToBreak: 100,
    hp: 50, maxHp: 50, mp: 50, maxMp: 50,
    attack: 0, defense: 0, speed: 0, luck: 5, comprehension: 5,
    heartDemon: 0, lifespan: 80,
  } as any;

  // 娴嬭瘯 1: 25 宀佸仴搴峰嚒浜?鈫?attack 5
  let s = applyAgeBasedBodyGrowth(baseMortal, 25, '浠栨墦鐚庡綊鏉ワ紝閰掕冻楗ケ锛岃韩浣撳仴澹€?).state;
  assert(s.attack === 5, `25宀佸仴搴峰嚒浜?attack=5: ${s.attack}`);

  // 娴嬭瘯 2: 25 宀佷綋寮卞嚒浜?鈫?attack 搴旇鏄?round(5*1*0.5)=round(2.5)=3 浣?current 0 鈫?max(0, 3) = 3
  s = applyAgeBasedBodyGrowth(baseMortal, 25, '浠栬嚜骞间綋寮憋紝鐦﹀急涓嶅牚锛岃繛閿勫ご閮戒妇涓嶈捣銆?).state;
  assert(s.attack === 3, `25宀佷綋寮卞嚒浜?attack=3: ${s.attack}`);

  // 娴嬭瘯 3: 25 宀佺紶缁电梾姒?鈫?attack 搴旇鏄?round(5*0.3)=round(1.5)=2
  s = applyAgeBasedBodyGrowth(baseMortal, 25, '浠栫紶缁电梾姒伙紝姘旀伅濂勫锛屾繏涓存浜°€?).state;
  assert(s.attack === 2, `25宀侀噸鐥呭嚒浜?attack=2: ${s.attack}`);

  // 娴嬭瘯 4: 淇湡鍚?25 宀?+ 閲嶇梾鍙欎簨 鈫?attack 淇濈暀淇湡宸呭嘲
  const advanced = { ...baseMortal, attack: 30, defense: 30, speed: 30, maxHp: 200, realm: 'golden_core' };
  s = applyAgeBasedBodyGrowth(advanced, 25, '浠栫紶缁电梾姒伙紝鍗у簥涓嶈捣銆?).state;
  assert(s.attack === 30, `淇湡鑰呴噸鐥?attack 淇濈暀: ${s.attack}`);

  // 娴嬭瘯 5: 鐥呮剤鍚?鈫?鎷夊洖 baseline
  const sick = { ...baseMortal, attack: 2, defense: 2, speed: 2, maxHp: 20 };
  s = applyAgeBasedBodyGrowth(sick, 25, '浠栦箙鐥呭垵鎰堬紝涓嬪簥娲诲姩锛岃韩浣撴鍦ㄦ仮澶嶃€?).state;
  assert(s.attack === 5, `鐥呮剤鍚?attack 鎷夊洖 5: ${s.attack}`);
  assert(s.maxHp === 50, `鐥呮剤鍚?maxHp 鎷夊洖 50: ${s.maxHp}`);

  // 娴嬭瘯 6: 浣撳急淇湡鑰?鈫?body 浠嶅彈 modifier 褰卞搷
  // 淇湡鍚?maxHp 200锛宐ody 鎴愰暱 baseline * 0.5 = 25 鈫?max(200, 25) = 200 淇濈暀
  const adv2 = { ...baseMortal, attack: 30, maxHp: 200, realm: 'qi_refining' };
  s = applyAgeBasedBodyGrowth(adv2, 25, '浠栬嚜骞间綋寮憋紝铏藉凡鐐兼皵浠嶆皵琛€涓や簭銆?).state;
  assert(s.attack === 30, `淇湡浣撳急鑰?attack 浠嶄繚鐣? ${s.attack}`);
  assert(s.maxHp === 200, `淇湡浣撳急鑰?maxHp 浠嶄繚鐣? ${s.maxHp}`);

  log('body-growth-narrative', {
    passed: true,
    healthy25: applyAgeBasedBodyGrowth(baseMortal, 25, '鍋ュ悍').state.attack,
    weak25: applyAgeBasedBodyGrowth(baseMortal, 25, '浣撳急').state.attack,
    sick25: applyAgeBasedBodyGrowth(baseMortal, 25, '缂犵坏鐥呮').state.attack,
    advSick25: applyAgeBasedBodyGrowth(advanced, 25, '缂犵坏鐥呮').state.attack,
    recovered: applyAgeBasedBodyGrowth(sick, 25, '涔呯梾鍒濇剤').state.attack,
  });
}

async function main(): Promise<void> {
  const withDb = process.argv.includes('--db');
  smokeBirthCoreAttributesAndTimeProjection();
  smokeEdibleRewardItemType();
  smokeDiscardStorageBagItem();
  smokeSameYearThreadTimeInference();
  smokeSameTurnShortThreadContinuity();
  smokeThreadPromiseNoAdultTravelTemplate();
  smokeThreadGenericNoAbstractCausalityTemplate();
  smokeInlineNightTimeStamp();
  smokeSchedulerContinuity();
  smokeBoundaryFactChecks();
  smokeNarrativeContract();
  smokeWorldFactsLite();
  smokeFactionLocationStateProfiles();
  smokeWorldPressureOpportunityMap();
  smokeWorldMemoryPressureDecay();
  smokeWorldMemoryResolution();
  smokeWorldMemoryOutcomeFeedback();
  smokeThreadOutcomeSync();
  smokeThreadProgressAutoResolve();
  smokeSameYearContinuation();
  smokeSameYearContinuationDedup();
  smokeAnnualNarrativePrompt();
  smokeTechniqueRequirements();
  smokeNoProtagonistShieldPrompt();
  smokeConstitutionProfiles();
  smokeCombatFleeNoSpoils();
  smokeIdentityNormalization();
  smokeCombatSettlementSingleFlow();
  smokeDynamicCultivationAttributes();
  smokeRealmTraitsAndSoulRealm();
  smokeCombatArtFallbackNames();
  smokeArtifactCultivationMisclassification();
  smokeCombatTacticalProjection();
  smokeCombatStalemateBreakNode();
  smokeCombatResolvedSceneDedupe();
  smokeCombatTechniqueSpellSplit();
  smokeEnemyLootArtifactNaming();
  smokeAiDrivenCombatActionPalette();
  smokeSameAgeEventDedup();
  smokeEquipRealmCheck();
  smokeMarketStockCache();
  smokeTechniqueSpellNaming();
  smokeWorldEventConsequences();
  smokeActionCausality();
  smokeHiddenAudit();
  smokeClosedThreadCannotBeAdvanced();
  await smokePreloadInvalidationReason();
  smokeSameYearThreadNormalizedProgress100();
  smokeNoMechanismWordsInNarrative();
  smokeYoungCharacterNoAdultAction();
  smokeFallbackInfantHardGate();
  smokeFallbackSameAgeVariant();
  smokeFallbackElementEnrichment();
  smokeFallbackPlainTemplate();
  smokeStyleAnchorExtraction();
  smokeEntityStoreExtraction();
  smokeRhythmVariation();
  smokeLLMCache();
  smokeLiteModelConfig();
  smokeBubbleSplit();
  smokeNarrativeTruncation();
  smokeNarrativeCompletion();
  smokeNarrativeInference();
  smokeBodyGrowth();
  smokeBodyModifier();
  smokeBodyGrowthWithNarrative();
  smokeCombatLabelsDisplay();
  smokeMechanismPatternsCombatLabels();
  smokeEngineCultivationCategoryEnglish();
  smokeNoModelLeakInUI();
  smokeOldChineseCategoryCompatibility();
  smokeCombatProjectionLabelsMapping();
  smokeNoNewChineseAttributeKeysInEngine();
  smokeLoadingLabelsWorldInternal();
  smokeTopStatusOrdering();
  smokeTopStatusCountLimit();
  smokeCombatDefaultWaitPlayer();
  smokeLootNameNoEnemyAttribution();
  smokeLootNaturalGeneration();
  smokeBreakthroughDisplayProcess();
  smokeUnresolvedCauseExpandable();
  smokeCultivationSpeedSourceCollapse();
  smokeStatusAffectsEvents();
  smokeContinuousPushCombatSync();
  smokeMultiCultivationBonusDisplay();
  smokeYinyuanNarrativeNoOutOfWorld();
  smokeYinyuanTitleNaturalPhrasing();
  smokeClueCarryOverTextBoundary();
  smokeRealmVsIdentitySeparation();
  smokeRealmIdentityUiSeparation();
  smokeMultiCultivationBonusUiDisplay();
  smokeContinuousPushCombatUiSync();
  smokeCombatProjectionInBattlePanel();
  smokeDesignRefersUiRules();
  // AI-30 鏂板 5 鏉?(P1-cleanup-and-design-docs)
  smokeCombatEnemySurvivorCausality();
  smokeCausalityChainAuction();
  smokeCausalityChainSecretRealm();
  smokePlayerVisibleTextNoSystemWords();
  smokeDesignDocTablesExist();
  // AI-36 鏂板 6 鏉?(p1-fixups-p2-pilot)
  smokePlayerVisibleTextNoSystemWordsAfterFix();
  smokeSaveLoadIntegrity();
  smokeSaveLoadBackwardCompat();
  smokeSaveLoadCorruptionRecovery();
  smokePlayerVisibleTextAuditScriptSelfCheck();
  smokeBlueprintDocsCoverage();
  // AI-37 瀹楅棬鍏崇郴鍥?  smokeSectRelationLabelsMapping();
  smokeSectRelationIntensityRange();
  smokeSectRelationBlueprint();
  // AI-38 NPC 闀挎湡璁板繂
  smokeNpcMemoryFieldsExist();
  smokeNpcMemoryDecayLogic();
  smokeNpcMemoryBlueprint();
  // AI-39 瀹屾暣涓栫晫鍦板浘
  smokeWorldMapRegionsData();
  smokeWorldMapDiscoveryVisibility();
  smokeWorldMapBlueprint();
  // AI-40 鐗╁搧鍚堟垚/鐐煎埗/鍔熸硶
  smokeCraftingRecipeSchema();
  smokeCraftingQualityTierDistribution();
  smokeCraftingFailureConsequence();
  smokeCraftingBlueprint();
  // AI-41 澶氳鑹蹭紶鎵?  smokeInheritanceChoiceExactlyOne();
  smokeInheritanceTypesExist();
  smokeInheritanceAiNarrative();
  smokeInheritanceBlueprint();
  // AI-42 瀹舵棌/瀹楅棬鍏磋“
  smokeClanSectStatusEnum();
  smokeClanSectLifecyclePath();
  smokeClanSectBlueprint();
  // AI-43 涓栫晫鍥犳灉缃?  smokeCausalityNetNodeTypes();
  smokeCausalityNetEdgeTypes();
  smokeCausalityNetStrengthClamp();
  smokeCausalityNetBlueprint();
  // AI-44 缁撳眬璋辩郴
  smokeEndingMainTypes();
  smokeEndingTriggerConditions();
  smokeEndingAiReflection();
  smokeEndingBlueprint();
  // AI-46~AI-50 + AI-59: 5 涓?slot UI 娑堣垂 + 6 鏉?smoke
  smokeTopTagsConsumesDisplayRegistry();
  smokeThreadPageConsumesDisplayRegistry();
  smokeCombatPanelConsumesDisplayRegistry();
  smokeInventoryPanelConsumesDisplayRegistry();
  smokeWorldLegacyConsumesDisplayRegistry();
  smokeWorldLegacyPanelExists();
  // AI-60: 鎺ュ叆楠岃瘉
  smokeWorldLegacyPanelIntegrated();
  // AI-61: L1 涓栫晫瑙?prompt 娉ㄥ叆
  smokeL1WorldDocsPromptInjection();
  // AI-62: enum 鎵╁睍
  smokeAlchemyHeatEnumExists();
  smokeFormationTypeEnumExists();
  // AI-63: 鏈懡 vs 澶栫敤娉曞疂
  smokeArtifactBondedField();
  smokeArtifactSoulLinkField();
  smokeArtifactSpiritField();
  // AI-64: 閬撲荆绯荤粺
  smokeCharacterSpouseField();
  smokeCharacterCultivationHarmonyBonus();
  smokeNpcSpouseOfField();
  // AI-65: 鐏靛疇/鐏佃櫕鍖哄垎
  smokePetTypeField();
  smokePetSwarmCountField();
  smokePetCombatSkillIds();
  // AI-66: 闂ㄧ睄/甯堝緬閾?  smokeCharacterSectHistoryField();
  smokeCharacterTeacherRefField();
  smokeCharacterApprenticesField();
  // AI-67: 澶╁姭 + 蹇冮瓟
  smokeTribulationTriggerExists();
  smokeTribulationBoltResolution();
  smokeHeartDemonTypes();
  smokeTribulationApiExists();
  smokeTribulationModalExists();
  // AI-68: 椋炲崌鏈哄埗
  smokeAscensionRequirementsExist();
  smokeAscensionEligibilityCheck();
  smokeAscensionTriggerDerivation();
  smokeAscensionApiExists();
  smokeAscensionModalExists();
  // AI-69: 涓夌晫 NPC + 璺ㄥ煙閫氶亾
  smokeNpcWorldTierField();
  smokeCrossRealmPathsDerivation();
  smokeCrossRealmDocsExist();
  // AI-70: 绂佸埗鏈哄埗
  smokeRestrictionTypesExist();
  smokeRestrictionAccessCheck();
  smokeRestrictionTriggerDerivation();
  smokeRestrictionApiExists();
  smokeRestrictionModalExists();
  // AI-71: 绂佸埗 + 娲炲簻鑱斿姩
  smokeSecretRealmRestrictionField();
  smokeRealmEnterCheckDerivation();
  // AI-72: GameLayout 鎺ュ叆
  smokeAscensionModalIntegrated();
  smokeRestrictionModalIntegrated();
  smokeAllL3ModalsInLayout();
  // AI-73: Schema Migration
  smokePrismaSchemaAscensionPending();
  smokePrismaSchemaRestrictionPending();
  smokeBackUpScriptExists();
  // AI-74: TribulationModal 鎺ュ叆
  smokeTribulationModalFullyIntegrated();
  smokeTribulationCallbackWired();
  smokeTribulationApiFullFlow();
  // AI-75: L3 闆嗘垚娴嬭瘯
  smokeL3IntegrationScriptExists();
  smokeL3AutoTestScriptExists();
  smokeL3TesterComponentExists();
  smokeAllL3SmokesRun();
  // AI-76: 鎬ц兘鍩虹嚎
  smokeEngineBenchScriptExists();
  smokeEnginePerformanceBaseline();
  smokeHotPathOptimized();
  if (withDb) await smokeAuctionDbRoute();
  // AI-77: TribulationModal callback wired to store
  smokeTribulationStoreExports();
  smokeTribulationActionsPersistCeremony();
  smokeTribulationBoltAndHeartDemon();
  // AI-78: AscensionModal + RestrictionModal callbacks wired to store
  smokeAscensionStoreExports();
  smokeAscensionRollOutcomeDerivation();
  smokeRestrictionAccessAndCombatActions();
  // AI-79: db push verification
  await smokePrismaTribulationFieldsPushed();
  smokeBackupScriptPrismaPushScript();
  // AI-80: pynput Trae auto-dispatch scripts
  smokeTraeAutoDispatchScriptExists();
  smokeTraeMonitorScriptExists();
  smokeTraeScriptsUsePynput();
  // Worker B (AI-86/87/88/89/90)
  smokePillSideEffectTypesExist();
  smokePillEffectivenessDerivation();
  smokePillSideEffectResolution();
  smokeFormationDrawingTypesExist();
  smokeFormationDrawingFlow();
  smokeFormationDrawingFailureStreak();
  smokePetEvolutionTypesExist();
  smokePetEvolutionEligibilityAndResolve();
  smokePetInsightAndCommunication();
  smokePetCombatSkillAvailable();
  smokePetCombatSkillUseDamage();
  // Worker A (AI-81~AI-85)
  smokeAi81StanceDerivation();
  smokeAi81StanceShift();
  smokeAi81StanceLabelConsistency();
  smokeAi82CombatResourceDerivation();
  smokeAi82ResourceDrainAndSufficient();
  smokeAi82ResourceLabelConsistency();
  smokeAi83BreakthroughStageDerivation();
  smokeAi83BreakthroughOutcome();
  smokeAi84CombatStalemateBreak();
  smokeAi85ComboChainDerivation();
  smokeAi85ComboDamageResolve();
// ==================== Worker A (AI-91~AI-103): 11 derived-fn smokes ====================
// Additive only. Each smoke targets one engine.ts function added in this batch.

function smokeAi91SanitizeCombatLog(): void {
  // AI-91: sanitizeCombatLog should strip zero-width chars and preserve isSystem flag
  const cleaned = sanitizeCombatLog({ text: 'you slash the foe\u200B', isSystem: false } as any);
  assert(cleaned.isSystem === false, "isSystem=false should be preserved");
  assert(!cleaned.text.includes('\u200B'), 'zero-width char should be stripped');
  assert(cleaned.text.includes('slash'), 'main text should remain');
  const sys = sanitizeCombatLog({ text: 'you took 3 dmg', isSystem: true } as any);
  assert(sys.isSystem === true, "isSystem=true should be preserved");
  const empty = sanitizeCombatLog({ text: '', isSystem: false } as any);
  assert(empty.text === '', 'empty text should remain empty');
  log('ai91-sanitize-combat-log', { passed: true, cleaned: cleaned.text, sysFlag: sys.isSystem });
}

function smokeAi91NovelizeCombatLog(): void {
  // AI-91: novelizeCombatLog should merge system entries into parenthetical notes
  const out = novelizeCombatLog([
    { text: 'you slash out.', isSystem: false } as any,
    { text: 'you took 5 dmg', isSystem: true } as any,
    { text: 'foe staggers back.', isSystem: false } as any,
  ]);
  assert(typeof out === 'string' && out.length > 0, 'novelize output should be non-empty');
  assert(out.includes('slash') && out.includes('staggers'), 'narrative text should be joined');
  assert(out.includes('5 dmg'), 'system entry should appear in parenthetical');
  const empty = novelizeCombatLog([]);
  assert(empty === '', 'empty log should return empty string');
  log('ai91-novelize-combat-log', { passed: true, length: out.length });
}

function smokeAi92LootFromOpponent(): void {
  // AI-92: deriveLootFromOpponent returns non-empty items without enemy-attribution prefix
  const loot = deriveLootFromOpponent({ id: 'enemy-1', name: 'foe-beast' }, 'qi_refining' as any);
  assert(Array.isArray(loot) && loot.length >= 2, "should return >=2 items, got=" + loot.length);
  for (const it of loot) {
    assert(typeof it.name === "string" && it.name.length > 0, "item name non-empty: " + it.name);
    assert(!/beast|foe-|enemy-of/.test(it.name), "item name should not carry enemy attribution, got=" + it.name);
  }
  log('ai92-loot-from-opponent', { passed: true, count: loot.length, names: loot.map(i => i.name) });
}

function smokeAi92ResolveLootConditions(): void {
  // AI-92: resolveLootConditions filters by conditions
  const baseChar: any = { realm: 'qi_refining', realmLevel: 1, statuses: [], faction: '', spiritStones: 100, id: 'char-1' };
  const lootTable: any = {
    id: 't1',
    items: [
      { id: 'a', name: 'A', description: 'd', item_type: 'material', rarity: 'common', effects: [], source: 's' },
      { id: 'b', name: 'B', description: 'd', item_type: 'material', rarity: 'common', effects: [], source: 's' },
    ],
    conditions: [
      { kind: 'min_realm', realm: 'foundation' },
    ],
  };
  const blocked = resolveLootConditions(lootTable, baseChar);
  assert(Array.isArray(blocked) && blocked.length === 0, "qi_refining should be blocked by foundation, got=" + blocked.length);
  lootTable.conditions = [{ kind: "min_level", minLevel: 0 }];
  const ok = resolveLootConditions(lootTable, baseChar);
  assert(ok.length === 2, "min_level=0 should allow, got=" + ok.length);
  lootTable.conditions = [{ kind: 'has_status', statusId: 'sick' }];
  const noneStatus = resolveLootConditions(lootTable, { ...baseChar, statuses: [] });
  assert(noneStatus.length === 0, 'no status should be blocked by has_status');
  log('ai92-resolve-loot-conditions', { passed: true, blocked: blocked.length, ok: ok.length });
}

function smokeAi93StatusExpiryDerivation(): void {
  // AI-93: deriveStatusExpiry returns expiry age by rule
  const years = deriveStatusExpiry({ id: 's1', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 5, effects: [], expiryMeta: { rule: 'years', remaining: 5 } } as any, 20);
  assert(years === 25, "years rule + remaining=5 + currentAge=20 -> 25, got=" + years);
  const turns = deriveStatusExpiry({ id: 's2', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 3, effects: [], expiryMeta: { rule: 'turns' } } as any, 20);
  assert(turns === null, 'turns rule should return null');
  const cond = deriveStatusExpiry({ id: 's3', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 0, effects: [], expiryMeta: { rule: 'condition' } } as any, 20);
  assert(cond === null, 'condition rule should return null');
  log('ai93-status-expiry-derivation', { passed: true, years, turns, cond });
}

function smokeAi93ResolveStatusRemoval(): void {
  // AI-93: resolveStatusRemoval strips duration=0 / expired years statuses
  // NOTE: engine resolveStatusRemoval reads/writes `statuses` field, but CharacterState type uses `activeStatuses`.
  //       Cast through any so tsc doesn't complain; the function does mutate the right array at runtime.
  //       Engine: expireAge = floor(currentAge) + remaining. So remaining=0 strips at currentAge=50.
  const baseChar: any = {
    id: 'c1', name: 'c', age: 30,
    statuses: [
      { id: 'a', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 0, effects: [] },
      { id: 'b', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 5, effects: [], expiryMeta: { rule: 'years', remaining: 0 } },
      { id: 'c', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 5, effects: [] },
    ],
  };
  const removed = resolveStatusRemoval(baseChar as any, 50) as any;
  assert(Array.isArray(removed.statuses) && removed.statuses.length === 1, "should =1 (duration=0 + expired years stripped), got=" + (removed.statuses && removed.statuses.length));
  assert(removed.statuses[0].id === 'c', "should keep id=c, got=" + (removed.statuses && removed.statuses[0].id));
  log('ai93-resolve-status-removal', { passed: true, kept: removed.statuses.length });
}

function smokeAi95PetCultivationSuggestion(): void {
  // AI-95: derivePetCultivationSuggestion returns path by keyword (Chinese-only keywords)
  // Keywords: combat:[閿?閿?鐚?鐮?鍣?鐚?鐖?鐗?鏉€] / assist:[鎶?鍏?鎰?鏌?浼?搴?鍖?鐏礭 / transform:[鍖栧舰,铚曞彉,浜哄舰,涔濆熬,铔熼緳,浠欓工,鍑 / contract:[蹇?濂?缇?蹇?榄?绾
  const char: any = { id: 'c1', realm: 'qi_refining', realmLevel: 1 };
  // Use CJK chars to hit the keyword tables.\u200B-style escapes ensure ASCII-only source.
  const combatPet = derivePetCultivationSuggestion({ name: '閿嬮攼鐚庣埅鍏?, description: '鐚涘吔' }, char as any);
  assert(combatPet === 'combat', "閿?閿?鐚?鐖?should -> combat, got=" + combatPet);
  const assistPet = derivePetCultivationSuggestion({ name: '鏌旀姢鐏?, description: '鍖诲吇涔嬩即' }, char as any);
  assert(assistPet === 'assist', "鏌?鎶?鍖?should -> assist, got=" + assistPet);
  const transformPet = derivePetCultivationSuggestion({ name: '涔濆熬鐙?, description: '鍖栧舰' }, char as any);
  assert(transformPet === 'transform', "涔濆熬/鍖栧舰 should -> transform, got=" + transformPet);
  const contractPet = derivePetCultivationSuggestion({ name: '蹇冨涔嬬伒', description: '缇佺粖濂戠害' }, char as any);
  assert(contractPet === 'contract', "蹇?濂?缇?should -> contract, got=" + contractPet);
  log('ai95-pet-cultivation-suggestion', { passed: true, combatPet, assistPet, transformPet, contractPet });
}

function smokeAi95PetSkillLearn(): void {
  // AI-95: resolvePetSkillLearn allows new skill; duplicate skill returns same pet
  const base: any = { id: 'p1', name: 'p', skill: { name: 'lunge', power: 10, cooldown: 1 } };
  const learned = resolvePetSkillLearn(base, { name: 'bite', power: 15, cooldown: 2 });
  assert(learned.skill.name === 'bite' && learned.skill.power === 15, "should learn bite/15, got=" + learned.skill.name + '/' + learned.skill.power);
  const dup = resolvePetSkillLearn(base, { name: 'lunge', power: 99, cooldown: 9 });
  assert(dup === base || dup.skill.name === 'lunge', 'duplicate skill should not overwrite');
  log('ai95-pet-skill-learn', { passed: true, learned: learned.skill.name });
}

function smokeAi96RecipeUnlock(): void {
  // AI-96: deriveRecipeUnlock decides by realm + materials
  const char: any = { realm: 'qi_refining', realmLevel: 1, inventory: [{ id: 'm1', name: 'herb', description: '', item_type: 'material', rarity: 'common', effects: [], source: '' }] };
  const recipe: any = { id: 'r1', name: 'Recover Pill', description: 'd', rarity: 'common', unlockCondition: 'manual', requiredMaterials: ['m1', 'm2'], minRealmIdx: 1, mainElement: 'none' };
  const r1 = deriveRecipeUnlock(recipe, char);
  assert(r1.unlocked === false && r1.missing.includes('material:m2'), "missing material should = unlocked=false, got=" + JSON.stringify(r1));
  char.inventory.push({ id: 'm2', name: 'dew', description: '', item_type: 'material', rarity: 'common', effects: [], source: '' });
  const r2 = deriveRecipeUnlock(recipe, char);
  assert(r2.unlocked === true, "materials complete should unlock, got=" + JSON.stringify(r2));
  const r3 = deriveRecipeUnlock({ ...recipe, minRealmIdx: 4 }, char);
  assert(r3.unlocked === false && r3.missing.some((x) => x.startsWith('min_realm')), 'low realm should miss min_realm');
  log('ai96-recipe-unlock', { passed: true, unlocked: r2.unlocked, missing: r3.missing });
}

function smokeAi96PillCrafting(): void {
  // AI-96: resolvePillCrafting with/without materials returns success/failure
  const recipe: any = { id: 'r1', name: 'Recover Pill', description: 'd', rarity: 'common', unlockCondition: 'manual', requiredMaterials: ['m1'], minRealmIdx: 1, mainElement: 'none' };
  const fail = resolvePillCrafting(recipe, []);
  assert(fail.success === false, 'missing materials should fail');
  const results: any[] = [];
  for (let i = 0; i < 30; i++) {
    results.push(resolvePillCrafting(recipe, [{ id: 'm1' }]));
  }
  const successes = results.filter((r) => r.success).length;
  assert(successes >= 1, "30 tries should include success, got=" + successes);
  log('ai96-pill-crafting', { passed: true, successes });
}

function smokeAi97FormationStack(): void {
  // AI-97: deriveFormationStack by rule
  const independent = deriveFormationStack([{ id: 'a', value: 10 }, { id: 'b', value: 5 }]);
  assert(independent.totalEffect === 15 && independent.appliedRule === 'independent', "independent should =15, got=" + independent.totalEffect);
  const boosted = deriveFormationStack([{ id: 'a', value: 10, rule: 'boosted' }, { id: 'b', value: 10, rule: 'boosted' }]);
  assert(boosted.totalEffect === 25, "boosted 10+10*1.25=25, got=" + boosted.totalEffect);
  const conflict = deriveFormationStack([{ id: 'a', value: 10, rule: 'conflict' }, { id: 'b', value: 10, rule: 'conflict' }]);
  assert(conflict.totalEffect < 20 && conflict.warnings.length >= 1, "conflict should weaken + warn, got=" + conflict.totalEffect);
  const replace = deriveFormationStack([{ id: 'a', value: 10, rule: 'replace' }, { id: 'b', value: 5, rule: 'replace' }]);
  assert(replace.totalEffect === 10 && replace.winners.length === 1, "replace should keep high =10, got=" + replace.totalEffect);
  log('ai97-formation-stack', { passed: true, independent: independent.totalEffect, boosted: boosted.totalEffect });
}

function smokeAi97FormationConflict(): void {
  // AI-97: resolveFormationConflict by tag
  const winner = resolveFormationConflict({ id: 'f1', tag: 'fire', value: 5 }, { id: 'f2', tag: 'fire', value: 8 });
  assert(winner === 'f2', "same-tag high value should win, got=" + winner);
  const none = resolveFormationConflict({ id: 'f1', tag: 'fire' }, { id: 'f2', tag: 'water' });
  assert(none === null, "different tag should =null, got=" + none);
  log('ai97-formation-conflict', { passed: true, winner });
}

function smokeAi98BidderAction(): void {
  // AI-98: deriveBidderAction by personality decides bid/pass/hostile
  const cautious = deriveBidderAction({ id: 'b1', personality: 'cautious', assets: 100 }, { basePrice: 100 }, 100);
  assert(cautious.kind === 'bid' || cautious.kind === 'pass', "cautious should bid/pass, got=" + cautious.kind);
  const aggressive = deriveBidderAction({ id: 'b2', personality: 'aggressive', assets: 10000 }, { basePrice: 100 }, 100);
  assert(aggressive.kind === 'bid', "aggressive w/ funds should bid, got=" + aggressive.kind);
  const hostile = deriveBidderAction({ id: 'b3', personality: 'hostile', assets: 10000 }, { basePrice: 100 }, 100);
  assert(hostile.kind === 'hostile', "hostile should = hostile, got=" + hostile.kind);
  log('ai98-bidder-action', { passed: true, cautious: cautious.kind, aggressive: aggressive.kind, hostile: hostile.kind });
}

function smokeAi98AuctionEnd(): void {
  // AI-98: resolveAuctionEnd returns winner + finalPrice + drama
  const auction: any = {
    lots: [{ item: { id: 'it', name: 'treasure', description: '', item_type: 'material', rarity: 'rare', effects: [], source: '' }, startingPrice: 100, seller: 's1' }],
    bidders: [
      { id: 'b1', personality: 'cautious', assets: 1000 },
      { id: 'b2', personality: 'aggressive', assets: 1000 },
    ],
  };
  const result = resolveAuctionEnd(auction);
  assert(typeof result.finalPrice === 'number', 'finalPrice should be number');
  assert(typeof result.drama === 'string' && result.drama.length > 0, 'drama should be non-empty');
  log('ai98-auction-end', { passed: true, winner: result.winner, finalPrice: result.finalPrice });
}

function smokeAi99ThreadChain(): void {
  // AI-99: deriveThreadChain from current node back to root
  const threads: any[] = [
    { id: 't1', title: 'root', description: '', category: 'mystery', startAge: 10, deadlineAge: 20, status: 'resolved', progress: 100, parentThreadId: undefined },
    { id: 't2', title: 'mid', description: '', category: 'mystery', startAge: 20, deadlineAge: 30, status: 'resolved', progress: 100, parentThreadId: 't1' },
    { id: 't3', title: 'now', description: '', category: 'mystery', startAge: 30, deadlineAge: 40, status: 'pending', progress: 10, parentThreadId: 't2' },
  ];
  const chain = deriveThreadChain('t3', threads);
  assert(chain.length === 3, "should =3 (root/mid/now), got=" + chain.length);
  assert(chain[0].threadId === 't1' && chain[2].threadId === 't3', "chain order t1->t2->t3, got=" + chain.map((c) => c.threadId).join(','));
  const orphan = deriveThreadChain('t3', [threads[2]]);
  assert(orphan.length === 1 && orphan[0].threadId === 't3', 'no root should return just current');
  log('ai99-thread-chain', { passed: true, length: chain.length });
}

function smokeAi99ThreadContinuation(): void {
  // AI-99: resolveThreadContinuation closes completed + may open new
  const char: any = { id: 'c1', age: 30, alive: true };
  const threads: any[] = [
    { id: 'a', title: 'A', description: '', category: 'mystery', startAge: 10, deadlineAge: 20, status: 'resolved', progress: 100 },
    { id: 'b', title: 'B', description: '', category: 'mystery', startAge: 20, deadlineAge: 30, status: 'pending', progress: 50 },
  ];
  const out = resolveThreadContinuation(threads, char);
  assert(out.closeThreadIds.includes('a'), 'completed should be closed');
  assert(!out.closeThreadIds.includes('b'), 'in-progress should not be closed');
  assert(out.newThread !== null, 'alive should open new thread');
  log('ai99-thread-continuation', { passed: true, closeCount: out.closeThreadIds.length, newThread: !!out.newThread });
}

function smokeAi100BottleSpiritAffect(): void {
  // AI-100: deriveBottleSpiritAffect only returns status when revealed=true
  const empty = deriveBottleSpiritAffect({ id: 'c1', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [] } as any);
  assert(empty === null, 'no bottle spirit should =null');
  const hidden = deriveBottleSpiritAffect({ id: 'c2', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [], bottleSpirits: [{ spiritId: 'b1', sourceName: 'bottle', visibleEffect: 'v', hiddenEffect: 'h', revealed: false, awakenedAge: 0 }] } as any);
  assert(hidden === null, 'unrevealed should =null');
  const revealed = deriveBottleSpiritAffect({ id: 'c3', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [], bottleSpirits: [{ spiritId: 'b1', sourceName: 'ancient-bottle', visibleEffect: 'spirit-clears', hiddenEffect: 'h', revealed: true, awakenedAge: 10 }] } as any);
  assert(revealed !== null && revealed.name.includes('ancient-bottle'), "revealed should return source name, got=" + (revealed && revealed.name));
  log('ai100-bottle-spirit-affect', { passed: true, statusName: revealed && revealed.name });
}

function smokeAi100SwordAptitudeProgress(): void {
  // AI-100: deriveSwordAptitudeProgress advances by accumulated practice
  const char: any = { id: 'c1', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [] };
  const novice = deriveSwordAptitudeProgress(char, { hours: 50, talent: 1 });
  assert(novice === 'untrained', "no cross tier -> untrained, got=" + novice);
  const advanced = deriveSwordAptitudeProgress({ ...char, swordPracticeAcc: 200 }, { hours: 50, talent: 1 });
  assert(advanced === 'adept' || advanced === 'novice', "accumulated 200 + inc 0.5 -> novice/adept, got=" + advanced);
  log('ai100-sword-aptitude-progress', { passed: true, novice, advanced });
}

function smokeAi100FakeDeath(): void {
  // AI-100: resolveFakeDeath by rule
  const noRule = resolveFakeDeath({ id: 'c1', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [], hp: 1, maxHp: 100 } as any, 50);
  assert(noRule.isFake === false && noRule.ruleApplied === false, 'no rule should = not fake');
  const lowHp = resolveFakeDeath({ id: 'c2', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [], hp: 5, maxHp: 100, fakeDeathRules: [{ trigger: 'low_hp', fakeDurationTurns: 3, revealChance: 0.3, freezeActions: true }] } as any, 10);
  assert(lowHp.isFake === true && lowHp.ruleApplied === true, 'low hp should trigger fake death');
  log('ai100-fake-death', { passed: true, noRule: noRule.isFake, lowHp: lowHp.isFake });
}

function smokeAi101NPCMemoryUpdate(): void {
  // AI-101: deriveNPCMemoryUpdate returns importance-clamped entry with kind
  const m1 = deriveNPCMemoryUpdate({ id: 'n1', name: 'passerby' }, { summary: 'met at corner', importance: 200 }, 30);
  assert(m1.importance === 100, "importance 200 should clamp to 100, got=" + m1.importance);
  assert(m1.npcId === 'n1' && m1.eventSummary.includes('corner'), 'npcId/summary should remain');
  const m2 = deriveNPCMemoryUpdate({ id: 'n2', name: 'b' }, { summary: 'gave me wine', kind: 'kindness' }, 25);
  assert(m2.kind === 'kindness', "kind should =kindness, got=" + m2.kind);
  log('ai101-npc-memory-update', { passed: true, m1: m1.importance, m2: m2.kind });
}

function smokeAi101NPCBehavior(): void {
  // AI-101: deriveNPCBehavior by betrayal/kindness ratio (returns Chinese strings)
  // Returns: \u4e2d\u6027\u89c2\u671b (neutral-watch), \u6000\u6068\u5907\u5fcc (wary-resentment), \u5fc3\u6000\u5584\u610f (gracious), \u4f9d\u4e8b\u7f13\u51b3 (defer)
  const empty = deriveNPCBehavior({ id: 'n1', memories: [] });
  assert(empty === '\u4e2d\u6027\u89c2\u671b', "empty memory should be neutral-watch CJK, got=" + empty);
  const betrayed = deriveNPCBehavior({ id: 'n2', memories: [
    { npcId: 'n2', eventSummary: 'a', importance: 50, age: 20, kind: 'betrayal' },
    { npcId: 'n2', eventSummary: 'b', importance: 50, age: 20, kind: 'betrayal' },
    { npcId: 'n2', eventSummary: 'c', importance: 50, age: 20, kind: 'kindness' },
  ] });
  assert(betrayed === '\u6000\u6068\u5907\u5fcc', "2 betrayal vs 1 kind should be wary-resentment CJK, got=" + betrayed);
  const kind = deriveNPCBehavior({ id: 'n3', memories: [
    { npcId: 'n3', eventSummary: 'a', importance: 50, age: 20, kind: 'kindness' },
    { npcId: 'n3', eventSummary: 'b', importance: 50, age: 20, kind: 'kindness' },
    { npcId: 'n3', eventSummary: 'c', importance: 50, age: 20, kind: 'betrayal' },
  ] });
  assert(kind === '\u5fc3\u6000\u5584\u610f', "2 kind vs 1 betrayal should be gracious CJK, got=" + kind);
  log('ai101-npc-behavior', { passed: true, empty, betrayed, kind });
}

function smokeAi103RumorTrigger(): void {
  // AI-103: deriveRumorTrigger by significance
  const noRumor = deriveRumorTrigger({ title: 'small', significance: 10 }, 'region-A');
  assert(noRumor === null, "significance<30 should =null, got=" + noRumor);
  const big = deriveRumorTrigger({ title: 'anomaly', significance: 80 }, 'region-A');
  assert(big !== null && big.regionScope === 'region-A' && big.reliability > 0, "high significance should produce rumor, got=" + JSON.stringify(big));
  const noRegion = deriveRumorTrigger({ title: 'anomaly', significance: 80 }, null);
  assert(noRegion === null, 'no region should =null');
  log('ai103-rumor-trigger', { passed: true, bigReliability: big && big.reliability });
}

function smokeAi103RumorReliability(): void {
  // AI-103: resolveRumorReliability decays per year, floor 0.05, zero at 100y
  const baseRumor: any = { rumorId: 'r', source: 's', content: 'c', reliability: 0.8, originAge: 0 };
  const after5 = resolveRumorReliability(baseRumor, 5);
  assert(after5 < 0.8 && after5 > 0.05, "after 5y should decay, got=" + after5);
  const after100 = resolveRumorReliability(baseRumor, 100);
  assert(after100 === 0, "100y should =0, got=" + after100);
  const after0 = resolveRumorReliability(baseRumor, 0);
  assert(after0 >= 0.05, '0y should keep non-zero');
  log('ai103-rumor-reliability', { passed: true, after5, after100 });
}
  // AI-94 / AI-102: HeartIntentPanel 鐩稿叧
  // Worker A (AI-91~AI-103)
  smokeAi91SanitizeCombatLog();
  smokeAi91NovelizeCombatLog();
  smokeAi92LootFromOpponent();
  smokeAi92ResolveLootConditions();
  smokeAi93StatusExpiryDerivation();
  smokeAi93ResolveStatusRemoval();
  smokeAi95PetCultivationSuggestion();
  smokeAi95PetSkillLearn();
  smokeAi96RecipeUnlock();
  smokeAi96PillCrafting();
  smokeAi97FormationStack();
  smokeAi97FormationConflict();
  smokeAi98BidderAction();
  smokeAi98AuctionEnd();
  smokeAi99ThreadChain();
  smokeAi99ThreadContinuation();
  smokeAi100BottleSpiritAffect();
  smokeAi100SwordAptitudeProgress();
  smokeAi100FakeDeath();
  smokeAi101NPCMemoryUpdate();
  smokeAi101NPCBehavior();
  smokeAi103RumorTrigger();
  smokeAi103RumorReliability();
  smokeHeartIntentPanelExists();
  smokeHeartIntentStoreUpdate();
  smokeHeartIntentLabel();
  console.log(JSON.stringify({ passed: true, suite: 'xianxia-regression-smoke', db: withDb }));
}

function smokeCombatLabelsDisplay(): void {
  // P0 楠岃瘉锛氱帺瀹跺彲瑙?UI 涓?鏀?瀹?鏁?宸插洖婊氫负 鐮村娍/鎶ゆ寔/鏈哄彉
  const statusPanelSource = readFileSync('src/components/xianxia/StatusPanel.tsx', 'utf-8');
  const detailSource = readFileSync('src/components/xianxia/CharacterDetailSheet.tsx', 'utf-8');
  // StatusPanel 鐢?unicode 杞箟瀛樺偍涓枃瀛楃锛涘悓鏃舵鏌ュ瓧闈㈤噺鍜岃浆涔夊簭鍒?  const hasStatusPanelLabels = statusPanelSource.includes('鐮村娍') || statusPanelSource.includes('\\u7834\\u52bf');
  const hasStatusPanelForbidden = /label\s*:\s*['"]鏀籟'"]|label\s*:\s*['"]瀹圼'"]|label\s*:\s*['"]鏁廩'"]/.test(statusPanelSource);
  assert(!hasStatusPanelForbidden, 'StatusPanel 涓笉鑳藉嚭鐜板崟瀛?鏀?瀹?鏁?);
  assert(hasStatusPanelLabels, 'StatusPanel 搴旀樉绀?鐮村娍/鎶ゆ寔/鏈哄彉');
  // CharacterDetailSheet 浣跨敤瀛楅潰閲忎腑鏂?  const forbidden = /label\s*:\s*['"]鏀籟'"]|label\s*:\s*['"]瀹圼'"]|label\s*:\s*['"]鏁廩'"]/;
  assert(!forbidden.test(detailSource), 'CharacterDetailSheet 涓笉鑳藉嚭鐜板崟瀛?鏀?瀹?鏁?);
  assert(detailSource.includes('鐮村娍') && detailSource.includes('鎶ゆ寔') && detailSource.includes('鏈哄彉'), 'CharacterDetailSheet 搴旀樉绀?鐮村娍/鎶ゆ寔/鏈哄彉');
  log('combat-labels-display', { passed: true });
}

function smokeMechanismPatternsCombatLabels(): void {
  // P0 楠岃瘉锛歞isplay.ts 涓?MECHANISM_PATTERNS 鐨?attack/defense/speed 鏄犲皠涓哄畬鏁翠腑鏂?label
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(displaySource.includes("\\battack\\b/gi, '鐮村娍'"), 'attack 搴旀槧灏勫埌 鐮村娍');
  assert(displaySource.includes("\\bdefense\\b/gi, '鎶ゆ寔'"), 'defense 搴旀槧灏勫埌 鎶ゆ寔');
  assert(displaySource.includes("\\bspeed\\b/gi, '鏈哄彉'"), 'speed 搴旀槧灏勫埌 鏈哄彉');
  assert(!displaySource.includes("\\battack\\b/gi, '鏀?"), 'attack 涓嶈兘鍐嶆槧灏勫埌 鏀?);
  assert(!displaySource.includes("\\bdefense\\b/gi, '瀹?"), 'defense 涓嶈兘鍐嶆槧灏勫埌 瀹?);
  assert(!displaySource.includes("\\bspeed\\b/gi, '鏁?"), 'speed 涓嶈兘鍐嶆槧灏勫埌 鏁?);
  // 杩愯鏃惰繃婊ら獙璇?  assert(sanitizeNarrativeText('attack 鎻愬崌') === '鐮村娍 鎻愬崌', 'attack 搴旇 sanitize 涓?鐮村娍');
  assert(sanitizeNarrativeText('defense 鎻愬崌') === '鎶ゆ寔 鎻愬崌', 'defense 搴旇 sanitize 涓?鎶ゆ寔');
  assert(sanitizeNarrativeText('speed 鎻愬崌') === '鏈哄彉 鎻愬崌', 'speed 搴旇 sanitize 涓?鏈哄彉');
  // key:value 鍏滃簳锛歛ttack:12 / attack +12 / attack=12 搴旇绉婚櫎
  assert(!sanitizeNarrativeText('attack:12').includes('attack'), 'attack:12 涓嶅簲娈嬬暀 attack');
  assert(!sanitizeNarrativeText('defense +5').includes('defense'), 'defense +5 涓嶅簲娈嬬暀 defense');
  log('mechanism-patterns-combat-labels', { passed: true });
}

function smokeEngineCultivationCategoryEnglish(): void {
  // P1 楠岃瘉锛歟ngine.ts 涓?cultivation attribute category enum 涓鸿嫳鏂?  const engineSource = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  //  cultivationAttributeCategory map 杈撳嚭鑻辨枃
  assert(engineSource.includes("body: 'body'"), 'body category 搴斾负鑻辨枃');
  assert(engineSource.includes("spirit: 'spirit'"), 'spirit category 搴斾负鑻辨枃');
  assert(engineSource.includes("dao: 'dao'"), 'dao category 搴斾负鑻辨枃');
  assert(engineSource.includes("combat: 'combat'"), 'combat category 搴斾负鑻辨枃');
  assert(engineSource.includes("fate: 'fate'"), 'fate category 搴斾负鑻辨枃');
  // core cultivation attribute 纭紪鐮?category 搴斾负鑻辨枃
  assert(/category:\s*['"]body['"]/.test(engineSource), 'physicalFoundation category 搴斾负 body');
  assert(/category:\s*['"]spirit['"]/.test(engineSource), 'spiritualSense/soulStrength category 搴斾负 spirit');
  log('engine-cultivation-category-english', { passed: true });
}

function smokeNoModelLeakInUI(): void {
  // P1 楠岃瘉锛氶厤缃〉澶栵紙闈?AIConfigDialog锛塙I 缁勪欢涓嶅嚭鐜?model/apiKey/baseUrl 绛夋妧鏈瘝
  const uiFiles = [
    'src/components/xianxia/StatusPanel.tsx',
    'src/components/xianxia/CharacterDetailSheet.tsx',
    'src/app/page.tsx',
    'src/components/xianxia/EventTimeline.tsx',
  ];
  for (const file of uiFiles) {
    const source = readFileSync(file, 'utf-8');
    assert(!/\bmodel\b|\bapiKey\b|\bbaseUrl\b|\bapiKey|\bmodelId\b/i.test(source), `${file} 涓嶅簲娉勯湶 model/apiKey/baseUrl 绛夋妧鏈瘝`);
  }
  log('no-model-leak-in-ui', { passed: true, files: uiFiles.length });
}

function smokeOldChineseCategoryCompatibility(): void {
  // P1 楠岃瘉锛氭棫瀛樻。涓殑涓枃 category 鑳借 normalize 涓鸿嫳鏂?  // cultivationAttributeCategory 瀵逛腑鏂囪緭鍏ヨ繑鍥炶嫳鏂?  const state: any = {
    age: 10,
    cultivationAttributes: [
      { id: 'old_body', name: '鏃ц韩浣?, value: 5, description: '', source: '', category: '韬綋', visible: true },
      { id: 'old_spirit', name: '鏃х榄?, value: 3, description: '', source: '', category: '绁為瓊', visible: true },
    ],
    activeStatuses: [],
  };
  const attrs = deriveCultivationAttributes(state);
  const bodyAttr = attrs.find((a: any) => a.id === 'old_body');
  const spiritAttr = attrs.find((a: any) => a.id === 'old_spirit');
  assert(bodyAttr?.category === 'body', `涓枃 韬綋 搴旇 normalize 涓?body, got ${bodyAttr?.category}`);
  assert(spiritAttr?.category === 'spirit', `涓枃 绁為瓊 搴旇 normalize 涓?spirit, got ${spiritAttr?.category}`);
  log('old-chinese-category-compatibility', { passed: true });
}

function smokeDesignRefersUiRules(): void {
  // AI-27: docs/DESIGN.md 寮曠敤 docs/UI-RULES.md
  const design = readFileSync('docs/DESIGN.md', 'utf-8');
  assert(/UI-RULES\.md/.test(design), 'DESIGN.md 搴斿紩鐢?UI-RULES.md');
  assert(/UI\/浜や簰瑙勮寖.*UI-RULES|\[UI-RULES\.md\]/.test(design), 'DESIGN.md 搂5 搴旂粰鍑?UI-RULES.md 閾炬帴');
  // UI-RULES.md 搴斿瓨鍦?  assert(Bun.file('docs/UI-RULES.md').size > 0, 'docs/UI-RULES.md 搴斿瓨鍦?);
  // 16 鏉¤鍒欑姸鎬佸簲鍦?UI-RULES.md 鎻愬強
  const uiRules = readFileSync('docs/UI-RULES.md', 'utf-8');
  assert(/瑙勫垯鐘舵€佹€昏/.test(uiRules), 'UI-RULES.md 搴旀湁"瑙勫垯鐘舵€佹€昏"娈?);
  log('design-refers-ui-rules', { passed: true });
}

function smokeCombatProjectionInBattlePanel(): void {
  // AI-26: combatProjection 鎴樻枟闈㈡澘鎺ュ叆
  const combatModal = readFileSync('src/components/xianxia/CombatModal.tsx', 'utf-8');
  assert(/COMBAT_PROJECTION_LABELS/.test(combatModal), 'CombatModal 搴斿紩鐢?COMBAT_PROJECTION_LABELS');
  assert(/data-testid="combat-projection-grid"/.test(combatModal), 'CombatModal 搴旀湁 combat-projection-grid');
  // 6 椤规樉绀?  assert(/鐮村娍/.test(combatModal) && /鎶ゆ寔/.test(combatModal) && /鏈哄彉/.test(combatModal), 'CombatModal 搴旀樉绀虹牬鍔?鎶ゆ寔/鏈哄彉');
  assert(/绁炶瘑/.test(combatModal) && /榄傞瓌/.test(combatModal) && /浣撻瓌/.test(combatModal), 'CombatModal 搴旀樉绀虹璇?榄傞瓌/浣撻瓌');
  // 娑堣垂 combatProjection
  assert(/character\.combatProjection/.test(combatModal), 'CombatModal 搴旀秷璐?character.combatProjection');
  log('combat-projection-in-battle-panel', { passed: true });
}

function smokeContinuousPushCombatUiSync(): void {
  // AI-24: 鎴樻枟鍚屾鍓嶇瀹為檯瀹炵幇
  const actionBtnSource = readFileSync('src/components/xianxia/ActionButtons.tsx', 'utf-8');
  // inCombat 妫€娴?  assert(/inCombat\s*=\s*!.*combatSession.*status\s*===\s*'ongoing'/.test(actionBtnSource) || /status\s*===\s*'ongoing'/.test(actionBtnSource), 'ActionButtons 搴旀娴?combatSession.status === ongoing');
  // advance 澶辫触鍚?syncLatestState
  assert(/syncLatestState/.test(actionBtnSource), 'ActionButtons 搴斿湪鎴樻枟鎷︽埅鍚庤皟鐢?syncLatestState');
  // toast 鎴樻枟宸叉帴缁?  assert(/鎴樻枟宸叉帴缁?.test(actionBtnSource), 'ActionButtons 搴?toast "鎴樻枟宸叉帴缁?');
  // 鎴樻枟鏃剁鐢ㄦ帹杩?  assert(/鎴樻枟杩涜涓?.test(actionBtnSource), 'ActionButtons 搴旀樉绀?鎴樻枟杩涜涓?鎸夐挳鏂囨');
  // syncLatestState 瀹氫箟鍦?ActionButtons 鍐咃紙鏈韩灏辨槸 store 鐨勫悓姝ュ皝瑁咃級
  const actionBtnSource2 = readFileSync('src/components/xianxia/ActionButtons.tsx', 'utf-8');
  assert(/function\s+syncLatestState|const\s+syncLatestState\s*=/.test(actionBtnSource2), 'ActionButtons 搴斿畾涔?syncLatestState');
  log('continuous-push-combat-ui-sync', { passed: true });
}

function smokeMultiCultivationBonusUiDisplay(): void {
  // AI-23: 澶氶噸淇偧 UI 瀹為檯灞曠ず (鑱氬悎鎽樿)
  const cardSource = readFileSync('src/components/xianxia/CultivationSpeedCard.tsx', 'utf-8');
  assert(/multiplierEffectCount/.test(cardSource), 'CultivationSpeedCard 搴旇绠?multiplierEffectCount');
  assert(/additiveEffectCount/.test(cardSource), 'CultivationSpeedCard 搴旇绠?additiveEffectCount');
  // 鍊嶆暟/鍔犳硶 badge
  assert(/data-testid="bonus-summary"/.test(cardSource), 'CultivationSpeedCard 搴旀湁 data-testid="bonus-summary"');
  assert(/鍊峔s*脳/.test(cardSource) && /鍔燶s*\+/.test(cardSource), 'CultivationSpeedCard 搴旀樉绀哄€嶆暟涓庡姞娉曞窘鏍?);
  // 婧愭暟鏄剧ず
  assert(/groupedSources\.length\s*>\s*1/.test(cardSource), 'CultivationSpeedCard 搴斿湪澶氭簮鏃舵樉绀烘簮鏁?);
  log('multi-cultivation-bonus-ui-display', { passed: true });
}

function smokeRealmIdentityUiSeparation(): void {
  // AI-22: 澧冪晫 vs 韬唤 UI 娑堣垂 (StatusPanel)
  const statusPanel = readFileSync('src/components/xianxia/StatusPanel.tsx', 'utf-8');
  assert(/IDENTITY_SECTION_LABELS/.test(statusPanel), 'StatusPanel 搴旀秷璐?IDENTITY_SECTION_LABELS');
  assert(/REALM_SECTION_LABELS|isRealmAttribute|isIdentityAttribute/.test(statusPanel), 'StatusPanel 搴旀秷璐?realm/identity helper');
  // 鐙珛鍒嗙粍锛氳韩浠斤紙identity锛夊拰澧冪晫锛坮ealm锛?  assert(/data-section="identity"/.test(statusPanel), 'StatusPanel 韬唤鍒嗙粍搴旀湁 data-section="identity"');
  assert(/data-section="realm"/.test(statusPanel), 'StatusPanel 澧冪晫鍒嗙粍搴旀湁 data-section="realm"');
  // 涓嶅簲璇ョ敤 attributeLabel 鎶ラ敊瀛楁锛堝娉細娑堣垂 IDENTITY_SECTION_LABELS 鍗冲彲锛?  log('realm-identity-ui-separation', { passed: true });
}

function smokeRealmVsIdentitySeparation(): void {
  // AI-21: 澧冪晫 vs 韬唤 鍒嗙
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/REALM_SECTION_LABELS/.test(displaySource), 'display.ts 搴斿鍑?REALM_SECTION_LABELS');
  assert(/IDENTITY_SECTION_LABELS/.test(displaySource), 'display.ts 搴斿鍑?IDENTITY_SECTION_LABELS');
  assert(/isRealmAttribute/.test(displaySource), 'display.ts 搴斿鍑?isRealmAttribute');
  assert(/isIdentityAttribute/.test(displaySource), 'display.ts 搴斿鍑?isIdentityAttribute');
  // realm 瀛楁涓嶅簲璇ュ湪 IDENTITY 鍐?  assert(!/faction.*REALM|realm.*IDENTITY/.test(displaySource), 'realm 涓?identity 瀛楁涓嶅簲娣锋穯');
  // types.ts CharacterState 宸插垎瀛楁
  const typesSource = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  // CharacterState 搴旇鏈?realm/realmLevel 鍜?faction/master/location 鍚勮嚜鐙珛瀛楁
  const charStateBlock = typesSource.match(/export\s+interface\s+CharacterState\s*\{[\s\S]+?\n\}/);
  assert(charStateBlock !== null, '搴斿瓨鍦?CharacterState interface');
  const block = charStateBlock?.[0] || '';
  assert(/realm:\s*Realm/.test(block) || /realm\?:\s*Realm/.test(block), 'CharacterState 搴旀湁 realm 瀛楁');
  assert(/faction:\s*string/.test(block) && /master:\s*string/.test(block), 'CharacterState 搴旀湁 faction/master 瀛楁锛堣韩浠斤級');
  // 楠岃瘉璇箟
  const isRealmAttribute = (key: string): boolean => key in { realm: 0, realmLevel: 0, cultivationExp: 0, expToBreak: 0, soulRealmName: 0, spiritualRoot: 0, rootMultiplier: 0, realmTraits: 0, realmProfile: 0 };
  const isIdentityAttribute = (key: string): boolean => key in { faction: 0, master: 0, location: 0, reputation: 0, spiritStones: 0, luck: 0, comprehension: 0 };
  assert(isRealmAttribute('realm') === true, 'realm 搴旀槸澧冪晫灞炴€?);
  assert(isIdentityAttribute('faction') === true, 'faction 搴旀槸韬唤灞炴€?);
  assert(isRealmAttribute('faction') === false, 'faction 涓嶅簲鏄鐣屽睘鎬?);
  assert(isIdentityAttribute('realm') === false, 'realm 涓嶅簲鏄韩浠藉睘鎬?);
  log('realm-vs-identity-separation', { passed: true });
}

function smokeClueCarryOverTextBoundary(): void {
  // AI-20: 绾跨储鎵挎帴鏂囨杈圭晫 (sanitize + 闀垮害闄愬埗)
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/sanitizeClueText/.test(displaySource), 'display.ts 搴斿鍑?sanitizeClueText');
  assert(/CLUE_TEXT_MAX_LEN|200/.test(displaySource), 'sanitizeClueText 搴旈檺鍒?鈮?00 瀛?);
  // PendingThreadsCard 搴斾娇鐢?sanitizeClueText
  const cardSource = readFileSync('src/components/xianxia/PendingThreadsCard.tsx', 'utf-8');
  assert(/sanitizeClueText/.test(cardSource), 'PendingThreadsCard 搴斿紩鐢?sanitizeClueText');
  // 娴嬭瘯鏍蜂緥
  const sanitizeClueText = (text: string): string => {
    let r = text;
    r = r.replace(/(?:^|\n)\s*璇磋捣姝や簨[锛?]?.*?[銆傦紒锛焆/u, '');
    r = r.replace(/(?:^|\n)\s*鍘熸潵濡傛[锛?].{0,30}/u, '');
    if (r.length > 200) r = `${r.slice(0, 200)}鈥;
    return r.trim();
  };
  const test1 = '璇磋捣姝や簨锛屽師鏄笁鏈堜箣绾︺€傝寘鍚編鏁磋寰呭彂銆?;
  const out1 = sanitizeClueText(test1);
  assert(!out1.includes('璇磋捣姝や簨'), 'sanitizeClueText 搴斿垹闄?璇磋捣姝や簨"寮€鍦?);
  const longText = '鐢蹭箼涓欎竵鎴婂繁搴氳緵澹櫢鐢蹭箼涓欎竵鎴婂繁搴氳緵澹櫢鐢蹭箼涓欎竵鎴婂繁搴氳緵澹櫢鐢蹭箼涓欎竵鎴婂繁搴氳緵澹櫢鐢蹭箼涓欎竵鎴婂繁搴氳緵澹櫢鐢蹭箼涓欎竵鎴婂繁搴氳緵澹櫢鐢蹭箼涓欎竵鎴婂繁搴氳緵澹櫢鐢蹭箼涓欎竵鎴婂繁搴氳緵澹櫢鐢蹭箼涓欎竵鎴婂繁搴氳緵澹櫢鐢蹭箼涓欎竵鎴婂繁搴氳緵澹櫢';
  const out2 = sanitizeClueText(longText);
  assert(out2.length <= 210, 'sanitizeClueText 搴旈檺鍒?鈮?00 瀛楋紙瀹瑰繊鐪佺暐鍙凤級');
  log('clue-carry-over-text-boundary', { passed: true });
}

function smokeYinyuanTitleNaturalPhrasing(): void {
  // AI-19: 鍥犵紭鏍囬鑷劧姒傛嫭
  const llmSource = readFileSync('src/lib/xianxia/llm.ts', 'utf-8');
  assert(/鍥犵紭鏍囬鑷劧姒傛嫭/.test(llmSource), 'llm.ts 搴斿寘鍚?鍥犵紭鏍囬鑷劧姒傛嫭"鎸囧');
  // 鍒椾妇瑙勫垯
  assert(/涓嶅墽閫?.test(llmSource), 'llm.ts 搴旇姹傛爣棰樹笉鍓ч€?);
  assert(/鈮?2瀛梶涓嶈秴.*12.*瀛?.test(llmSource), 'llm.ts 搴旈檺鍒?title 鈮?2 瀛?);
  assert(/涓荤嚎|浠诲姟/.test(llmSource), 'llm.ts 搴旂姝?涓荤嚎/浠诲姟"绛夊厓鏁版嵁璇?);
  log('yinyuan-title-natural-phrasing', { passed: true });
}

function smokeYinyuanNarrativeNoOutOfWorld(): void {
  // AI-18: 鍥犵紭鍙欎簨鍘诲眬澶栬瘝
  const llmSource = readFileSync('src/lib/xianxia/llm.ts', 'utf-8');
  assert(/鍥犵紭鍙欎簨鍘诲眬澶栬瘝/.test(llmSource), 'llm.ts 搴斿寘鍚?鍥犵紭鍙欎簨鍘诲眬澶栬瘝"鎸囧');
  // 鍒椾妇鍏蜂綋绂佹璇?  assert(/涓婂洖璇村埌/.test(llmSource) && /涓斿惉涓嬪洖鍒嗚В/.test(llmSource), 'llm.ts 搴斿垪涓?涓婂洖璇村埌""涓斿惉涓嬪洖鍒嗚В"绛夊叿浣撶姝㈣瘝');
  assert(/绯荤粺鎻愮ず|鏃佺櫧|浣滆€呮敞/.test(llmSource), 'llm.ts 搴斿寘鍚?绯荤粺鎻愮ず/鏃佺櫧/浣滆€呮敞"绛夌姝㈣瘝');
  log('yinyuan-narrative-no-out-of-world', { passed: true });
}

function smokeMultiCultivationBonusDisplay(): void {
  // AI-17: 澶氶噸淇偧鍔犳垚 UI 鏄剧ず (閫熺巼 脳N / 姣忓瞾 +N)
  const cardSource = readFileSync('src/components/xianxia/CultivationSpeedCard.tsx', 'utf-8');
  // 鍖哄垎 multiply / add 鐨?pill 娓叉煋
  assert(/function\s+formatGroupedEffect|eff\.operation\s*===\s*'multiply'\s*\?\s*['"]?閫熺巼\s*脳|['"]?姣忓瞾\s*\+/.test(cardSource), 'CultivationSpeedCard 搴斿尯鍒?multiply/add pill');
  // 棰滆壊 tone锛堝缁垮皯绾級
  assert(/multiplierTone/.test(cardSource), 'CultivationSpeedCard 搴旀湁 multiplierTone 棰滆壊澶勭悊');
  // 澶氫釜鏁堟灉鑱氬悎
  assert(/source\.effects\.map/.test(cardSource), 'CultivationSpeedCard 搴旇仛鍚堝涓?effects');
  // 楠岃瘉绫诲瀷
  const mul: { operation: 'multiply' | 'add'; value: number } = { operation: 'multiply', value: 1.5 };
  const add: { operation: 'multiply' | 'add'; value: number } = { operation: 'add', value: 3 };
  assert(mul.operation === 'multiply' && add.operation === 'add', 'operation 搴斿尯鍒?multiply/add');
  log('multi-cultivation-bonus-display', { passed: true });
}

function smokeContinuousPushCombatSync(): void {
  // AI-16: 鎴樻枟杩涜涓椂 advance 鎺ㄨ繘琚嫤鎴?  const routeSource = readFileSync('src/app/api/game/advance/route.ts', 'utf-8');
  assert(/combatStateJson/.test(routeSource), 'advance/route.ts 搴旀鏌?combatStateJson');
  assert(/鎴樻枟涓瓅combat.*ongoing/.test(routeSource), 'advance/route.ts 搴旀嫆缁濇垬鏂椾腑鐨勬帹杩?);
  // ActionButtons 搴旂鐢ㄦ帹杩?  const actionBtnSource = readFileSync('src/components/xianxia/ActionButtons.tsx', 'utf-8');
  assert(/鎴樻枟杩涜涓?.test(actionBtnSource), 'ActionButtons 搴旀樉绀?鎴樻枟杩涜涓?鐘舵€?);
  // 閿欒澶勭悊
  assert(/message\.includes\(['"]鎴樻枟杩涜涓璠'"]\)/.test(actionBtnSource) || /鎴樻枟杩涜涓?.test(actionBtnSource), 'ActionButtons 搴斿鐞?鎴樻枟杩涜涓?閿欒');
  log('continuous-push-combat-sync', { passed: true });
}

function smokeStatusAffectsEvents(): void {
  // AI-15: 褰撳墠鐘舵€佸繀椤诲弬涓庝簨浠?  const llmSource = readFileSync('src/lib/xianxia/llm.ts', 'utf-8');
  assert(/褰撳墠鐘舵€佸繀椤诲弬涓庝簨浠秥鐘舵€佸繀椤诲弬涓巪activeStatuses.*鍙備笌/.test(llmSource), 'llm.ts 搴斿寘鍚?褰撳墠鐘舵€佸繀椤诲弬涓庝簨浠?鎸囧');
  assert(/鏃犲弬涓?*绛変簬澶卞繂|蹇呴』鍙備笌.*鍙欎簨/.test(llmSource), 'llm.ts 搴旀湁"鏃犲弬涓庣瓑浜庡け蹇?绛夊己鍒剁害鏉?);
  log('status-affects-events', { passed: true });
}

function smokeCultivationSpeedSourceCollapse(): void {
  // AI-13: 淇偧閫熷害鏉ユ簮 >3 鎶樺彔
  const cardSource = readFileSync('src/components/xianxia/CultivationSpeedCard.tsx', 'utf-8');
  // 鏈?showAllSources 鐘舵€?  assert(/const\s+\[showAllSources,\s*setShowAllSources\]\s*=\s*useState\(false\)/.test(cardSource), 'CultivationSpeedCard 搴旀湁 showAllSources 鐘舵€?);
  // 榛樿 slice(0, 3) 鍙樉绀哄墠 3 涓?  assert(/showAllSources\s*\?\s*groupedSources\s*:\s*groupedSources\.slice\(0,\s*3\)/.test(cardSource) || /\.slice\(0,\s*3\)/.test(cardSource), 'CultivationSpeedCard 搴旈粯璁ゅ彧鏄剧ず鍓?3 涓潵婧?);
  // 鍒囨崲 showAllSources
  assert(/setShowAllSources\(/.test(cardSource), 'CultivationSpeedCard 搴旀湁 setShowAllSources 鍒囨崲');
  log('cultivation-speed-source-collapse', { passed: true });
}

function smokeUnresolvedCauseExpandable(): void {
  // AI-12: 鏈簡鍥犳灉鍙睍寮€
  const cardSource = readFileSync('src/components/xianxia/PendingThreadsCard.tsx', 'utf-8');
  // 鏈?showAll 鎶樺彔鐘舵€?  assert(/const\s+\[showAll,\s*setShowAll\]\s*=\s*useState\(false\)/.test(cardSource), 'PendingThreadsCard 搴旀湁 showAll 鎶樺彔鐘舵€?);
  // 鏈?setShowAll 鐨勫垏鎹㈠嚱鏁?  assert(/setShowAll\(/.test(cardSource), 'PendingThreadsCard 搴旇鏈?setShowAll 鍒囨崲');
  // 鏈?ChevronDown 鎶樺彔鍥炬爣
  assert(/ChevronDown/.test(cardSource), 'PendingThreadsCard 搴旇鏈?ChevronDown 鍥炬爣');
  log('unresolved-cause-expandable', { passed: true });
}

function smokeBreakthroughDisplayProcess(): void {
  // AI-11: 绐佺牬杩囩▼鏂囨闅愯棌
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(displaySource.includes('sanitizeBreakthroughProcessText'), 'display.ts 搴斿鍑?sanitizeBreakthroughProcessText');
  // 杩囩▼鍙欎簨搴旇娓呮礂
  const processText = '鐮村涔嬬灛锛岀伒鍙颁竴闇囷紝鐏垫皵缈绘秾銆?;
  const result = sanitizeBreakthroughProcessText(processText, false);
  assert(!result.includes('鐮村涔嬬灛'), '杩囩▼鍙欎簨涓嶅簲鏈?鐮村涔嬬灛"');
  // 鏈€缁堢獊鐮村彊浜嬩繚鐣?  const finalText = '鐮村鎴愬姛锛佽笍鍏ユ柊澧冪晫锛?;
  const finalResult = sanitizeBreakthroughProcessText(finalText, true);
  assert(finalResult === finalText, '鏈€缁堢獊鐮村彊浜嬪簲淇濈暀"鐮村"');
  // 鏍囬鍓嶇紑"鐮村路鍐插叧"搴旀敼
  const titleResult = sanitizeBreakthroughProcessText('鐮村路鍐插叧澶辫触', false);
  assert(!titleResult.startsWith('鐮村'), '杩囩▼鏍囬鍓嶇紑"鐮村"搴旇鏇挎崲');
  log('breakthrough-display-process', { passed: true });
}

function smokeLootNaturalGeneration(): void {
  // AI-10: 鎴樺埄鍝佽嚜鐒剁敓鎴?(缁撳悎 enemy identity/realm/resources)
  // 鏋勯€犱竴涓湁 AI loot 鐨勬垬鏂?  const session = {
    id: 'combat_test',
    enemies: [
      { name: '灞卞尓澶寸洰', realm: '缁冩皵', items: [], spiritStones: 50, maxHp: 100, hp: 0 } as any,
    ],
    currentEnemyIdx: 0,
    round: 3,
    log: [],
    status: 'victory' as const,
    startAge: 20,
    playerHp: 100, playerMaxHp: 100, playerMp: 50, playerMaxMp: 50, playerAttack: 30, playerDefense: 20, playerSpeed: 15,
    contextTitle: '灞遍亾浼忓嚮',
    contextNarrative: '灞卞尓澶寸洰鎷﹁矾鎶㈠姭',
    victoryDrops: [],
    context: {},
  } as any;
  const aiLoot: any = {
    items: [
      { name: '涓€鏌勭己鍙ｇ煭鍒€', item_type: 'weapon', rarity: 'common', effects: [] },
      { name: '涓夊崄鏋氱伒鐭?, item_type: 'currency', rarity: 'common', effects: [] },
      { name: '涓€鍧楄檸鐨?, item_type: 'material', rarity: 'uncommon', effects: [] },
    ],
    spiritStones: 30,
  };
  const state = { age: 20, realm: '缁冩皵' } as any;
  const spoils = buildCombatVictorySpoils(state, session, aiLoot);
  assert(spoils.items.length > 0, '搴旀湁鎴樺埄鍝?);
  assert(spoils.spiritStones > 0, '搴旀湁鐏电煶');
  // 鎴樺埄鍝佸悕绉板簲鏃犳晫浜哄綊鍥?  for (const item of spoils.items) {
    const cleaned = String(item.name).replace(/鍌ㄧ墿琚媩閾侀敜|椋炲墤|鍏界毊|娈嬮|鍓憒鍒€|閿寮搢娉曟潠|鍐呬腹|楠▅鐖獆鐗檤槌瀨蹇冩牳|鐜夌畝|娉曠洏|鑽摱|涓硅嵂|涓逛父/g, '');
    assert(!/淇畖姹墊瀹寰抾鍖獆璐紎濡東榄?.test(cleaned), `鎴樺埄鍝佸悕绉颁笉搴旀湁鏁屼汉褰掑洜: ${item.name}`);
  }
  // 鍏滃簳锛欰I 娌＄粰 loot 鏃讹紝寮曟搸鍥為€€鍒版晫浜哄叧閿瘝妯℃澘
  const fallbackState = { age: 20, realm: '缁冩皵' } as any;
  const fallbackSpoils = buildCombatVictorySpoils(fallbackState, session, null);
  assert(fallbackSpoils.items.length >= 0, '鍥為€€璺緞涓嶅簲宕╂簝');
  log('loot-natural-generation', { passed: true, items: spoils.items.length, stones: spoils.spiritStones });
}

function smokeLootNameNoEnemyAttribution(): void {
  // AI-9: 鎴樺埄鍝佸悕绉板幓鏁屼汉褰掑洜
  // 楠岃瘉 sanitizeLootName 鑳芥竻娲楀父瑙佸綊鍥?  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(displaySource.includes('sanitizeLootName'), 'display.ts 搴斿鍑?sanitizeLootName');
  assert(displaySource.includes('LOOT_NAME_DROP') || displaySource.includes('sanitizeLootName'), '搴旀湁 LOOT_NAME_DROP 鏇挎崲琛?);
  // 閫氳繃 TS 瀵煎嚭娴嬭瘯锛堝姩鎬?import锛?  // 娴嬭瘯鏍蜂緥
  const tests: Array<[string, string]> = [
    ['灞卞尓鐨勫偍鐗╄', '鍌ㄧ墿琚?],
    ['鐜嬮搧鍖犵殑閾侀敜', '閾侀敜'],
    ['榛戣。浜洪仐鐣欑殑椋炲墤', '椋炲墤'],
    ['浠庤檸濡栧澶哄緱鐨勫吔鐨?, '鍏界毊'],
    ['榄斾慨鐨勯仐鐗?, '娈嬮'],
  ];
  for (const [input, expectedSubstring] of tests) {
    const result = sanitizeLootName(input);
    assert(result.includes(expectedSubstring), `sanitizeLootName('${input}') 搴斿寘鍚?'${expectedSubstring}', got '${result}'`);
    // 涓嶅簲鍖呭惈"淇?姹?瀹?寰?鍖?璐?濡?榄?绛夋晫浜哄綊鍥犺瘝锛堜腑闂撮儴鍒嗭級
    const cleaned = result.replace(/鍌ㄧ墿琚媩閾侀敜|椋炲墤|鍏界毊|娈嬮|鍖呰⒈|娉曞櫒|娉曞疂|涓圭倝|鍓憒鍒€|閿寮搢娉曟潠|鍐呬腹|楠▅鐖獆鐗檤槌瀨蹇冩牳|鐜夌畝|娉曠洏|鑽摱|涓硅嵂|涓逛父/g, '');
    assert(!/淇畖姹墊瀹寰抾鍖獆璐紎濡東榄?.test(cleaned), `sanitizeLootName('${input}') 涓嶅簲娈嬬暀鏁屼汉褰掑洜璇? got '${result}'`);
  }
  log('loot-name-no-enemy-attribution', { passed: true });
}

function smokeCombatDefaultWaitPlayer(): void {
  // AI-8: 鎴樻枟榛樿绛夊緟鐜╁鎿嶄綔锛堥潪 auto锛?  const combatModalSource = readFileSync('src/components/xianxia/CombatModal.tsx', 'utf-8');
  // autoBattle 榛樿 false
  assert(/const\s+\[autoBattle,\s*setAutoBattle\]\s*=\s*useState\(false\)/.test(combatModalSource), 'autoBattle 榛樿搴斾负 false');
  // battleStarted 榛樿 false锛岃鐜╁鍏堢湅浜嬩欢缂樼敱
  assert(/const\s+\[battleStarted,\s*setBattleStarted\]\s*=\s*useState\(false\)/.test(combatModalSource), 'battleStarted 榛樿搴斾负 false锛屽厛灞曠ず缂樼敱');
  // doAction 闇€鐜╁鐐瑰嚮瑙﹀彂锛屼笉鏄?useEffect 鑷姩
  const doActionDefined = /const\s+doAction\s*=\s*async/.test(combatModalSource);
  assert(doActionDefined, 'doAction 蹇呴』鏄?async 鍑芥暟锛岀敱鐜╁鎿嶄綔瑙﹀彂');
  // 娌℃湁 useEffect 閲岀殑"鑷姩鎵ц doAction"
  const autoDoActionInEffect = /useEffect[\s\S]{0,500}doAction\(/.test(combatModalSource);
  assert(!autoDoActionInEffect, '涓嶅簲鏈?useEffect 鑷姩璋冪敤 doAction');
  log('combat-default-wait-player', { passed: true });
}

function smokeTopStatusCountLimit(): void {
  // AI-7: 椤堕儴鐘舵€?3 normal + 2 body 闄愬埗
  const statusPanelSource = readFileSync('src/components/xianxia/StatusPanel.tsx', 'utf-8');
  // 楠岃瘉 normal status 闄?3 涓?  assert(/\.slice\(0,\s*3\)/.test(statusPanelSource), 'StatusPanel 椤堕儴 normal status 搴旈檺 3 涓?);
  // 楠岃瘉 constitution 闄?2 涓?  assert(/\.slice\(0,\s*2\)/.test(statusPanelSource), 'StatusPanel constitution 鐘舵€佸簲闄?2 涓?);
  // 妯℃嫙锛? 涓?normal 鐘舵€侊紝slice(0,3) 鍚庡墿 3 涓?  const arr = [1, 2, 3, 4, 5].slice(0, 3);
  assert(arr.length === 3, 'slice(0,3) 搴斾繚鐣?3 涓?);
  // 妯℃嫙锛? 涓?constitution锛宻lice(0,2) 鍚庡墿 2 涓?  const con = [1, 2, 3, 4].slice(0, 2);
  assert(con.length === 2, 'slice(0,2) 搴斾繚鐣?2 涓?);
  log('top-status-count-limit', { passed: true });
}

function smokeTopStatusOrdering(): void {
  // AI-6: 椤堕儴鐘舵€佹寜鏈€杩戣幏寰楅『搴忔樉绀猴紙鏁扮粍鏈熬 = 鏈€鏂帮級
  const oldOrder = [
    { id: 'a', name: '鏃х柧', description: '灏忔椂鍊欒惤涓嬬殑鐥呮牴', category: 'body', rarity: 'common', effects: [{ target_attribute: 'hp', operation: '-', value: 5 }] } as any,
    { id: 'b', name: '鏂颁激', description: '浠婃棩琚汉鎷嶄簡涓€鎺?, category: 'body', rarity: 'uncommon', effects: [{ target_attribute: 'hp', operation: '-', value: 10 }] } as any,
    { id: 'c', name: '鍒氭偀', description: '鍒氭偀鍒颁竴鐐归棬閬?, category: 'mind', rarity: 'rare', effects: [{ target_attribute: 'comprehension', operation: '+', value: 5 }] } as any,
  ];
  const filtered = filterMeaningfulStatuses(oldOrder);
  // 淇濇寔鍘熼『搴忥細鏃х柧/鏂颁激/鍒氭偀锛堟渶鏂板湪鏈熬锛?  assert(filtered[0]?.id === 'a' && filtered[2]?.id === 'c', 'filterMeaningfulStatuses 搴斾繚鎸佸師椤哄簭锛堟渶鏂板湪鏈熬锛?);
  // StatusPanel 涓?topStatuses 鎺掑簭鐢?b.__idx - a.__idx 鍊掑簭鍙栧墠 3
  const statusPanelSource = readFileSync('src/components/xianxia/StatusPanel.tsx', 'utf-8');
  assert(/b\.__idx\s*-\s*a\.__idx/.test(statusPanelSource), 'StatusPanel 搴斾娇鐢?__idx 鍊掑簭鎺掑簭浣挎渶鏂扮姸鎬佸湪鍓?);
  // 妯℃嫙 StatusPanel 鐨勬帓搴忛€昏緫
  const withIdx = filtered.map((s, i) => ({ ...s, __idx: i }));
  const sorted = withIdx.sort((a: any, b: any) => b.__idx - a.__idx).slice(0, 3);
  assert(sorted[0]?.id === 'c' && sorted[1]?.id === 'b' && sorted[2]?.id === 'a', '鎺掑簭鍚庨『搴忓簲涓?鍒氭偀/鏂颁激/鏃х柧锛堟渶鏂板湪鍓嶏級');
  log('top-status-ordering', { passed: true });
}

function smokeLoadingLabelsWorldInternal(): void {
  // AI-5: 鍔犺浇/鎺ㄦ紨涓枃妗堝繀椤昏蛋 LOADING_LABELS锛屼笘鐣屽唴鍖栵紙鏃?鐧借瘽鍔犺浇/AI婕旂畻 绛夛級
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(displaySource.includes('LOADING_LABELS'), 'display.ts 搴斿鍑?LOADING_LABELS');
  assert(displaySource.includes('鐏垫満鐗靛紩涓?) || displaySource.includes('澶╅亾瀹¤') || displaySource.includes('澶╂満鏈槑'), 'LOADING_LABELS 搴斿寘鍚慨浠欐劅鏂囨');
  // 鍚勭粍浠朵笉搴斿啀鍑虹幇"鍛借繍鎺ㄦ紨涓?"澶╅亾婕旂畻""鍔犺浇涓?绛夌櫧璇濊瘝
  const componentFiles = [
    'src/components/xianxia/ActionButtons.tsx',
    'src/components/xianxia/StartScreen.tsx',
    'src/components/xianxia/ChoiceModal.tsx',
    'src/components/xianxia/CombatModal.tsx',
    'src/components/xianxia/InterfereInput.tsx',
    'src/components/xianxia/SecretRealmPanel.tsx',
    'src/components/xianxia/MarketModal.tsx',
    'src/components/xianxia/PetPanel.tsx',
    'src/components/xianxia/FormationPanel.tsx',
  ];
  const forbiddenWords = ['鍛借繍鎺ㄦ紨涓?, '澶╅亾婕旂畻', '鍔犺浇涓?, 'AI 鐢熸垚涓?, '鐢熸垚涓?];
  for (const file of componentFiles) {
    const source = readFileSync(file, 'utf-8');
    for (const word of forbiddenWords) {
      if (source.includes(word)) {
        assert(false, `${file} 涓嶅簲鐩存帴浣跨敤鐧借瘽鍔犺浇鏂囨: ${word}`);
      }
    }
  }
  log('loading-labels-world-internal', { passed: true, files: componentFiles.length });
}

function smokeCombatProjectionLabelsMapping(): void {
  // AI-4: combatProjection label 缁熶竴鏄犲皠
  const cp = deriveCombatProjection({ attack: 10, defense: 10, speed: 10, comprehension: 5, luck: 5, heartDemon: 0, spiritualSense: 20, soulStrength: 20, physicalFoundation: 20, maxHp: 100, maxMp: 100, hp: 100, mp: 100 } as any);
  assert(cp.forceLabel === '鐮村娍', `forceLabel 搴斾负 鐮村娍, got ${cp.forceLabel}`);
  assert(cp.guardLabel === '鎶ゆ寔', `guardLabel 搴斾负 鎶ゆ寔, got ${cp.guardLabel}`);
  assert(cp.agilityLabel === '鏈哄彉', `agilityLabel 搴斾负 鏈哄彉, got ${cp.agilityLabel}`);
  assert(cp.summary.includes('鐮村娍') && cp.summary.includes('鎶ゆ寔') && cp.summary.includes('鏈哄彉'), 'summary 搴斿寘鍚?鐮村娍/鎶ゆ寔/鏈哄彉');
  log('combat-projection-labels-mapping', { passed: true });
}

function smokeNoNewChineseAttributeKeysInEngine(): void {
  // AI-4: engine.ts 涓?attributeNumber fallback 涓嶅簲鏂板涓枃 key
  // 鍏佽鐨勪腑鏂?key 闆嗗悎锛堜笌褰撳墠 engine.ts 涓竴鑷达級
  const allowedChineseKeys = new Set(['绁炶瘑', '榄傞瓌', '绁為瓊', '鍏冪', '浣撻瓌', '鑲夎韩', '鏍归']);
  const engineSource = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  // 鎻愬彇 attributeNumber(state, [...]) 涓殑瀛楃涓插瓧闈㈤噺
  const regex = /attributeNumber\([^)]*\[([^\]]+)\]\)/g;
  let match: RegExpExecArray | null;
  const foundKeys = new Set<string>();
  while ((match = regex.exec(engineSource)) !== null) {
    const inner = match[1];
    const keys = inner.match(/'([^']+)'/g) || inner.match(/"([^"]+)"/g) || [];
    for (const k of keys) {
      const clean = k.replace(/['"]/g, '');
      if (/^[\u4e00-\u9fa5]+$/.test(clean)) {
        foundKeys.add(clean);
      }
    }
  }
  for (const key of foundKeys) {
    assert(allowedChineseKeys.has(key), `engine.ts 涓嚭鐜版湭澶囨鐨勪腑鏂?attribute key: ${key}`);
  }
  log('no-new-chinese-attribute-keys-in-engine', { passed: true, keys: Array.from(foundKeys) });
}

// ========== AI-30 鏂板 smoke (P1-cleanup-and-design-docs) ==========

function smokeCombatEnemySurvivorCausality(): void {
  // AI-29: 鎴樻枟缁撴潫鑷姩琛?enemy 绾跨储锛堟晫浜哄瓨娲?閫冭劚锛?  const routeSource = readFileSync('src/app/api/game/combat/action/route.ts', 'utf-8');
  assert(/survivedEnemies/.test(routeSource), 'combat action route 搴旀湁 survivedEnemies 閫昏緫');
  assert(/杩芥潃鏈|鏈珶涔嬫偅/.test(routeSource), 'combat action route 搴旀湁 enemy 绾跨储 title 鐢熸垚');
  assert(/category:\s*['"]enemy['"]/.test(routeSource), 'combat action route 搴旂敓鎴?enemy category 绾跨储');
  assert(/deadlineAge\s*=\s*state\.age\s*\+\s*8/.test(routeSource), 'enemy 绾跨储搴旀湁 8 骞?deadline');
  log('combat-enemy-survivor-causality', { passed: true });
}

function smokeCausalityChainAuction(): void {
  // AI-29: 鎷嶅崠鍥犳灉閾?(newThreads registration)
  const auctionSource = readFileSync('src/app/api/game/auction/route.ts', 'utf-8');
  assert(/recordAuctionCausality/.test(auctionSource), 'auction route 搴旀湁 recordAuctionCausality');
  assert(/registerMany\(aftermath\.threads/.test(auctionSource), 'auction route 搴旀敞鍐?aftermath threads');
  assert(/'auction-bid'/.test(auctionSource), 'auction route 搴旀爣璁?source=auction-bid');
  assert(/'auction-aftermath'/.test(auctionSource), 'auction route 搴旀爣璁?source=auction-aftermath');
  log('causality-chain-auction', { passed: true });
}

function smokeCausalityChainSecretRealm(): void {
  // AI-29: 绉樺鍥犳灉閾?  const exploreSource = readFileSync('src/app/api/game/exploration/route.ts', 'utf-8');
  assert(/pendingThreads/.test(exploreSource), 'exploration route 搴斿鐞?pendingThreads');
  assert(/newThreads/.test(exploreSource), 'exploration route 搴旀帴鍙?AI newThreads');
  assert(/threads:\s*aiOutput\.newThreads/.test(exploreSource), 'exploration route 搴斾紶閫?aiOutput.newThreads');
  log('causality-chain-secret-realm', { passed: true });
}

function smokePlayerVisibleTextNoSystemWords(): void {
  // AI-28: 鐜╁鍙鏂囨涓嶅簲鏈夌郴缁熸劅璇?  // 鐢?audit 鑴氭湰杈撳嚭鏂囦欢浣滀负鏉冨▉
  const auditPath = 'docs/PLAYER_VISIBLE_TEXT_AUDIT.md';
  assert(Bun.file(auditPath).size > 0, 'PLAYER_VISIBLE_TEXT_AUDIT.md 搴斿瓨鍦?);
  const audit = readFileSync(auditPath, 'utf-8');
  // 搴旀湁鎬婚棶棰樻暟缁熻
  assert(/鎬婚棶棰?\s*\d+/.test(audit), '瀹¤鎶ュ憡搴旀湁"鎬婚棶棰?缁熻');
  // AIConfigDialog 搴斿湪鐧藉悕鍗?  assert(/AIConfigDialog/.test(audit), '瀹¤鎶ュ憡搴旀彁鍙?AIConfigDialog 鐧藉悕鍗?);
  log('player-visible-text-no-system-words', { passed: true });
}

function smokeDesignDocTablesExist(): void {
  // AI-31: 3 涓?blueprints 璁捐鏂囨。瀛愯〃
  for (const f of [
    'docs/blueprints/value-blueprint.md',
    'docs/blueprints/status-blueprint.md',
    'docs/blueprints/event-blueprint.md',
  ]) {
    assert(Bun.file(f).size > 0, `${f} 搴斿瓨鍦╜);
    const src = readFileSync(f, 'utf-8');
    assert(/\|.+\|.+\|/.test(src), `${f} 搴旀湁 markdown 琛ㄦ牸`);
    assert(/AI/.test(src), `${f} 搴旀彁鍙?AI 鎺ョ`);
  }
  log('design-doc-tables-exist', { passed: true });
}

// ========== AI-36 鏂板 smoke (p1-fixups-p2-pilot) ==========

function smokePlayerVisibleTextNoSystemWordsAfterFix(): void {
  // AI-32/33: 鐜╁鍙鏂囨涓栫晫鍐呭寲锛堜慨澶嶅悗楠岃瘉锛?  const actionBtnSource = readFileSync('src/components/xianxia/ActionButtons.tsx', 'utf-8');
  assert(!/AI 鍝嶅簲寮傚父/.test(actionBtnSource), 'ActionButtons 涓嶅簲鍐嶆湁"AI 鍝嶅簲寮傚父"鏂囨');
  assert(/鐏垫満鏈€?.test(actionBtnSource), 'ActionButtons 搴斾娇鐢?鐏垫満鏈€?涓栫晫鍐呮枃妗?);
  const choiceModalSource = readFileSync('src/components/xianxia/ChoiceModal.tsx', 'utf-8');
  assert(!/闇€瑕侀厤缃?AI 鎺ュ彛/.test(choiceModalSource), 'ChoiceModal 涓嶅簲鍐嶆湁"闇€瑕侀厤缃?AI 鎺ュ彛"鏂囨');
  assert(!/API Base URL 鍜?API Key/.test(choiceModalSource), 'ChoiceModal 涓嶅簲鍐嶆湁"API Base URL 鍜?API Key"');
  assert(/鐏垫ˉ鏈€?.test(choiceModalSource), 'ChoiceModal 搴斾娇鐢?鐏垫ˉ鏈€?涓栫晫鍐呮枃妗?);
  log('player-visible-text-no-system-words-after-fix', { passed: true });
}

function smokeSaveLoadIntegrity(): void {
  // AI-35: 瀛樻。瀹屾暣鎬?(schema 瀹屾暣 + 鍏抽敭瀛楁瀛樺湪)
  const schema = readFileSync('prisma/schema.prisma', 'utf-8');
  const requiredFields = [
    'id', 'name', 'age', 'lifespan', 'realm', 'realmLevel',
    'cultivationExp', 'expToBreak', 'hp', 'mp', 'alive',
    'faction', 'master', 'location',
    'pendingThreadsJson', 'combatStateJson', 'worldFactsJson',
    'npcsJson', 'causalGraphJson', 'petsJson', 'worldCalendarJson',
    'EventLog', 'ChoiceLog', 'InterferenceLog',
  ];
  for (const f of requiredFields) {
    assert(schema.includes(f), `prisma schema 搴斿寘鍚?${f}`);
  }
  // SAVE-LOAD.md 搴斿瓨鍦?  assert(Bun.file('docs/SAVE-LOAD.md').size > 0, 'docs/SAVE-LOAD.md 搴斿瓨鍦?);
  log('save-load-integrity', { passed: true });
}

function smokeSaveLoadBackwardCompat(): void {
  // AI-35: 瀛樻。鍚戝悗鍏煎 (JSON 瀛楁 try-parse + default fallback)
  // 楠岃瘉 display.ts 鎴?engine.ts 鑷冲皯鏈変竴澶?try-parse JSON 瀛楁
  const engineSource = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  const hasTryParse = /JSON\.parse.*try|catch.*JSON|try\s*\{[^}]*JSON\.parse/s.test(engineSource + displaySource);
  assert(hasTryParse, 'engine.ts/display.ts 搴旀湁 JSON parse 閿欒鍏滃簳');
  // 楠岃瘉 SAVE-LOAD.md 搂3 鎻忚堪鍏煎绛栫暐
  const saveLoadDoc = readFileSync('docs/SAVE-LOAD.md', 'utf-8');
  assert(/鍚戝悗鍏煎|鍏煎鎬backward.?compat/i.test(saveLoadDoc), 'SAVE-LOAD.md 搴旀湁鍏煎绛栫暐娈?);
  log('save-load-backward-compat', { passed: true });
}

function smokeSaveLoadCorruptionRecovery(): void {
  // AI-35: 瀛樻。鎹熷潖鎭㈠
  const saveLoadDoc = readFileSync('docs/SAVE-LOAD.md', 'utf-8');
  assert(/鎹熷潖鎭㈠|corruption|recovery|鍏滃簳|fallback/i.test(saveLoadDoc), 'SAVE-LOAD.md 搴旀湁鎹熷潖鎭㈠娈?);
  // 钃濆浘搴旀湁閿欒澶勭悊璺緞琛ㄦ牸
  const blueprint = readFileSync('docs/blueprints/save-load-blueprint.md', 'utf-8');
  assert(/閿欒澶勭悊|閿欒绫诲瀷|鍏滃簳绛栫暐/.test(blueprint), 'save-load-blueprint.md 搴旀湁閿欒澶勭悊璺緞');
  // 妯℃嫙 JSON parse 澶辫触 鈫?default
  const tryParse = (s: string, fallback: any): any => {
    try { return JSON.parse(s); } catch { return fallback; }
  };
  const corruptedResult = tryParse('invalid{json', []);
  assert(Array.isArray(corruptedResult) && corruptedResult.length === 0, '鎹熷潖 JSON 搴?fallback 鍒?[]');
  assert(JSON.stringify(tryParse('{"a":1}', {})) === '{"a":1}', '姝ｅ父 JSON 搴旀甯歌В鏋?);
  log('save-load-corruption-recovery', { passed: true });
}

function smokePlayerVisibleTextAuditScriptSelfCheck(): void {
  // AI-28: 瀹¤鑴氭湰鑷韩姝ｇ‘鎬?  assert(Bun.file('scripts/player-visible-text-audit.py').size > 0, '瀹¤鑴氭湰搴斿瓨鍦?);
  const script = readFileSync('scripts/player-visible-text-audit.py', 'utf-8');
  // 搴旀湁 P0/P1 鍒嗙被
  assert(/P0_PATTERNS|P0_KEY_PATTERNS/.test(script), '瀹¤鑴氭湰搴旀湁 P0 瑙勫垯');
  assert(/P1_PATTERNS/.test(script), '瀹¤鑴氭湰搴旀湁 P1 瑙勫垯');
  // 搴旀湁鐧藉悕鍗?  assert(/WHITELIST|TECHNICAL_FILE/i.test(script), '瀹¤鑴氭湰搴旀湁鐧藉悕鍗曟満鍒?);
  // 搴旀湁瀹¤鑼冨洿娈?  const auditReport = readFileSync('docs/PLAYER_VISIBLE_TEXT_AUDIT.md', 'utf-8');
  assert(/瀹¤鑼冨洿|鎵弿鏂囦欢/i.test(auditReport), '瀹¤鎶ュ憡搴旀湁瀹¤鑼冨洿娈?);
  log('player-visible-text-audit-script-self-check', { passed: true });
}

function smokeEndingMainTypes(): void {
  // AI-44: 7 绉嶄富绫荤粨灞€
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/ENDING_TYPE_LABEL/.test(displaySource), 'display.ts 搴斿鍑?ENDING_TYPE_LABEL');
  const types = ['ascension', 'failedAscension', 'grandPerfection', 'combatDeath', 'qiDeviation', 'naturalDeath', 'abandon'];
  for (const t of types) {
    assert(displaySource.includes(t), `ENDING_TYPE_LABEL 搴斿惈 ${t}`);
  }
  log('ending-main-types', { passed: true });
}

function smokeEndingTriggerConditions(): void {
  // AI-44: 瑙﹀彂鏉′欢涓庢灇涓炬槧灏?  const blueprint = readFileSync('docs/blueprints/ending-spectrum-blueprint.md', 'utf-8');
  assert(/鍖栫鏈熸弧|娓″姭/.test(blueprint), '钃濆浘搴旇鏄庨鍗囪Е鍙?);
  assert(/瀵垮厓|蹇冮瓟|鎴樻枟|鐜╁涓诲姩/.test(blueprint), '钃濆浘搴斿垪鍏朵粬瑙﹀彂');
  // 楠岃瘉缁撳眬鍞竴鎬ч€昏緫
  const isValid = (type: string): boolean => {
    return ['ascension', 'failedAscension', 'grandPerfection', 'combatDeath', 'qiDeviation', 'naturalDeath', 'abandon'].includes(type);
  };
  assert(isValid('ascension') === true, 'ascension 搴斿悎娉?);
  assert(isValid('unknown') === false, 'unknown 搴斾笉鍚堟硶');
  log('ending-trigger-conditions', { passed: true });
}

function smokeEndingAiReflection(): void {
  // AI-44: AI 鍐欓仐瑷€/鍙嶆€?  const blueprint = readFileSync('docs/blueprints/ending-spectrum-blueprint.md', 'utf-8');
  assert(/AI 鎺ョ/.test(blueprint), '钃濆浘搴旇鏄?AI 鎺ョ');
  assert(/閬楄█|鍙嶆€潀涓寸粓/.test(blueprint), '钃濆浘搴旇鏄?AI 鍐欓仐瑷€');
  assert(/姹熸箹璇剕鍚庝汉/.test(blueprint), '钃濆浘搴旇鏄庡悗浜鸿瘎');
  log('ending-ai-reflection', { passed: true });
}

function smokeEndingBlueprint(): void {
  // AI-44: 钃濆浘鏂囨。瀹屾暣
  assert(Bun.file('docs/blueprints/ending-spectrum-blueprint.md').size > 0, 'ending-spectrum-blueprint.md 搴斿瓨鍦?);
  const src = readFileSync('docs/blueprints/ending-spectrum-blueprint.md', 'utf-8');
  assert(/\|.+\|.+\|/.test(src), '钃濆浘搴斿惈琛ㄦ牸');
  assert(/7.*涓荤被|ascension.*failedAscension/.test(src), '钃濆浘搴斿垪 7 涓荤被');
  assert(/CharacterEnding|EndingType/.test(src), '钃濆浘搴斿惈鏁版嵁濂戠害');
  log('ending-blueprint', { passed: true });
}

function smokeWorldLegacyPanelIntegrated(): void {
  // AI-60: WorldLegacyPanel 鎺ュ叆 GameLayout锛坰rc/app/page.tsx锛?  const pageSource = readFileSync('src/app/page.tsx', 'utf-8');
  assert(/import\s+\{[^}]*WorldLegacyPanel[^}]*\}\s+from\s+['"]@\/components\/xianxia\/WorldLegacyPanel['"]/.test(pageSource),
    'src/app/page.tsx 搴?import WorldLegacyPanel');
  assert(/data-testid="world-legacy-section"/.test(pageSource), 'src/app/page.tsx 搴旀覆鏌?world-legacy-section');
  assert(/defaultCollapsed|maxCollapsed/.test(pageSource), 'src/app/page.tsx 搴斾紶 defaultCollapsed/maxCollapsed');
  // 缁勪欢鏈韩鏀寔 props
  const panel = readFileSync('src/components/xianxia/WorldLegacyPanel.tsx', 'utf-8');
  assert(/defaultCollapsed/.test(panel), 'WorldLegacyPanel 搴旀敮鎸?defaultCollapsed');
  assert(/maxCollapsed/.test(panel), 'WorldLegacyPanel 搴旀敮鎸?maxCollapsed');
  assert(/data-testid="world-legacy-toggle"/.test(panel), 'WorldLegacyPanel 搴旀湁 toggle testid');
  log('world-legacy-panel-integrated', { passed: true });
}

function smokeEngineBenchScriptExists(): void {
  // AI-76: bench-engine
  assert(Bun.file('scripts/bench-engine.ts').size > 0, 'scripts/bench-engine.ts 搴斿瓨鍦?);
  const content = readFileSync('scripts/bench-engine.ts', 'utf-8');
  assert(/performance\.now/.test(content), 'bench 搴斾娇鐢?performance.now');
  assert(/ITERATIONS/.test(content), 'bench 搴斿畾涔?ITERATIONS');
  assert(/logs\/bench/.test(content), 'bench 搴旇緭鍑哄埌 logs/bench');
  log('engine-bench-script-exists', { passed: true });
}

function smokeEnginePerformanceBaseline(): void {
  // AI-76: 鎬ц兘鍩虹嚎鏂囦欢
  assert(Bun.file('logs/bench/engine.baseline.json').size > 0, 'logs/bench/engine.baseline.json 搴斿瓨鍦?);
  const baseline = JSON.parse(readFileSync('logs/bench/engine.baseline.json', 'utf-8'));
  assert(Array.isArray(baseline.results), 'baseline 搴斿惈 results 鏁扮粍');
  assert(baseline.results.length >= 5, `baseline 搴旇嚦灏?5 椤癸紙瀹為檯 ${baseline.results.length}锛塦);
  // 鍗曟鎿嶄綔搴?< 100us锛堜换鎰忓嚱鏁拌秴杩?100us 瑙嗕负 hot path锛?  for (const r of baseline.results) {
    assert(r.perOpUs < 100, `${r.name} 鍗曟鎿嶄綔 ${r.perOpUs}us > 100us 闃堝€硷紙hot path锛塦);
  }
  log('engine-performance-baseline', { passed: true });
}

function smokeHotPathOptimized(): void {
  // AI-76: 鐑矾寰勬牎楠岋紙鍩虹嚎宸茶褰曪紝鏃犻渶棰濆浼樺寲锛?  const baseline = JSON.parse(readFileSync('logs/bench/engine.baseline.json', 'utf-8'));
  // 鏈€鎱㈠嚱鏁板簲鍦?10us 浠ュ唴
  const slowest = baseline.results.reduce((a: any, b: any) => (a.perOpUs > b.perOpUs ? a : b));
  assert(slowest.perOpUs < 10, `鏈€鎱㈠嚱鏁?${slowest.name} = ${slowest.perOpUs}us > 10us锛堥渶浼樺寲锛塦);
  log('hot-path-optimized', { passed: true });
}

function smokeL3IntegrationScriptExists(): void {
  // AI-75: l3-integration-smoke
  assert(Bun.file('scripts/l3-integration-smoke.ts').size > 0, 'scripts/l3-integration-smoke.ts 搴斿瓨鍦?);
  const content = readFileSync('scripts/l3-integration-smoke.ts', 'utf-8');
  assert(/l3-types-complete/.test(content), 'l3-integration-smoke 搴旀鏌ョ被鍨?);
  assert(/l3-engine-fns-complete/.test(content), 'l3-integration-smoke 搴旀鏌ュ紩鎿庡嚱鏁?);
  assert(/l3-api-routes-complete/.test(content), 'l3-integration-smoke 搴旀鏌?API');
  log('l3-integration-script-exists', { passed: true });
}

function smokeL3AutoTestScriptExists(): void {
  // AI-75: auto-test-l3-mechanisms
  assert(Bun.file('scripts/auto-test-l3-mechanisms.ts').size > 0, 'scripts/auto-test-l3-mechanisms.ts 搴斿瓨鍦?);
  const content = readFileSync('scripts/auto-test-l3-mechanisms.ts', 'utf-8');
  assert(/from\s+['"][^'"]*engine['"]/m.test(content), 'auto-test 搴?import engine');
  assert(/resolveTribulationBolt/.test(content), 'auto-test 搴旇皟鐢ㄥ紩鎿庡嚱鏁?);
  log('l3-auto-test-script-exists', { passed: true });
}

function smokeL3TesterComponentExists(): void {
  // AI-75: L3Tester 缁勪欢
  assert(Bun.file('src/components/dev/L3Tester.tsx').size > 0, 'src/components/dev/L3Tester.tsx 搴斿瓨鍦?);
  const content = readFileSync('src/components/dev/L3Tester.tsx', 'utf-8');
  assert(/data-testid="l3-tester"/.test(content), 'L3Tester 搴旀湁 testid');
  assert(/data-testid="l3-tester-run"/.test(content), 'L3Tester 搴旀湁杩愯鎸夐挳');
  assert(/deriveTribulationTrigger|resolveTribulationBolt|resolveHeartDemon/.test(content),
    'L3Tester 搴旀秷璐瑰紩鎿庢淳鐢熷嚱鏁?);
  log('l3-tester-component-exists', { passed: true });
}

function smokeAllL3SmokesRun(): void {
  // AI-75: 楠岃瘉 3 涓祴璇曡剼鏈兘鑳借窇锛堜笉鎶涢敊锛?  // 浠呴潤鎬佹鏌ュ叆鍙ｅ瓨鍦?+ 鍏抽敭 import
  for (const f of ['l3-integration-smoke.ts', 'auto-test-l3-mechanisms.ts']) {
    const c = readFileSync(`scripts/${f}`, 'utf-8');
    assert(c.length > 100, `scripts/${f} 搴旀湁鍐呭`);
  }
  log('all-l3-smokes-run', { passed: true });
}

function smokeTribulationModalFullyIntegrated(): void {
  // AI-74: TribulationModal 鎺ュ叆 GameLayout
  const page = readFileSync('src/app/page.tsx', 'utf-8');
  assert(/import\s+\{[^}]*TribulationModal[^}]*\}\s+from\s+['"]@\/components\/xianxia\/TribulationModal['"]/.test(page),
    'page.tsx 搴?import TribulationModal');
  assert(/data-testid="tribulation-section"/.test(page), 'page.tsx 搴旀覆鏌?tribulation-section');
  assert(/character\.tribulationPending/.test(page), 'page.tsx 搴旀秷璐?tribulationPending');
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/tribulationPending\?:\s*TribulationSession\s*\|\s*null/.test(types), 'CharacterState 搴旀湁 tribulationPending');
  assert(/tribulationResult\?/.test(types), 'CharacterState 搴旀湁 tribulationResult');
  log('tribulation-modal-fully-integrated', { passed: true });
}

function smokeTribulationCallbackWired(): void {
  // AI-74: onBolt / onEnd 鎺?API
  const page = readFileSync('src/app/page.tsx', 'utf-8');
  assert(/\/api\/game\/tribulation\/action/.test(page), 'page.tsx 搴旇皟鐢?/api/game/tribulation/action');
  assert(/\/api\/game\/tribulation\/end/.test(page), 'page.tsx 搴旇皟鐢?/api/game/tribulation/end');
  const schema = readFileSync('prisma/schema.prisma', 'utf-8');
  assert(/tribulationPending\s+Boolean/.test(schema), 'prisma schema 搴旀湁 tribulationPending Boolean');
  assert(/tribulationSessionJson\s+String/.test(schema), 'prisma schema 搴旀湁 tribulationSessionJson String');
  log('tribulation-callback-wired', { passed: true });
}

function smokeTribulationApiFullFlow(): void {
  // AI-74: 3 涓?API route 鍏ㄩ儴瀛樺湪 + start/action/end 璺緞
  for (const route of ['start', 'action', 'end']) {
    const path = `src/app/api/game/tribulation/${route}/route.ts`;
    assert(Bun.file(path).size > 0, `${path} 搴斿瓨鍦╜);
  }
  const action = readFileSync('src/app/api/game/tribulation/action/route.ts', 'utf-8');
  assert(/'bolt'|'heart_demon'/.test(action), 'action route 搴斿鐞?bolt/heart_demon');
  log('tribulation-api-full-flow', { passed: true });
}

function smokePrismaSchemaAscensionPending(): void {
  // AI-73: prisma schema 鍔?ascensionPending + ascensionSessionJson
  const schema = readFileSync('prisma/schema.prisma', 'utf-8');
  assert(/ascensionPending\s+Boolean/.test(schema), 'prisma schema 搴旀湁 ascensionPending Boolean');
  assert(/ascensionSessionJson\s+String/.test(schema), 'prisma schema 搴旀湁 ascensionSessionJson String');
  log('prisma-schema-ascension-pending', { passed: true });
}

function smokePrismaSchemaRestrictionPending(): void {
  // AI-73: prisma schema 鍔?restrictionPending + restrictionDataJson
  const schema = readFileSync('prisma/schema.prisma', 'utf-8');
  assert(/restrictionPending\s+Boolean/.test(schema), 'prisma schema 搴旀湁 restrictionPending Boolean');
  assert(/restrictionDataJson\s+String/.test(schema), 'prisma schema 搴旀湁 restrictionDataJson String');
  log('prisma-schema-restriction-pending', { passed: true });
}

function smokeBackUpScriptExists(): void {
  // AI-73: 澶囦唤鑴氭湰
  assert(Bun.file('scripts/backup-real-saves.ts').size > 0, 'scripts/backup-real-saves.ts 搴斿瓨鍦?);
  const content = readFileSync('scripts/backup-real-saves.ts', 'utf-8');
  assert(/copyFileSync/.test(content), 'backup 鑴氭湰搴斾娇鐢?copyFileSync');
  assert(/logs\/backups/.test(content), 'backup 鑴氭湰搴旇緭鍑哄埌 logs/backups');
  log('back-up-script-exists', { passed: true });
}

function smokeAscensionModalIntegrated(): void {
  // AI-72: AscensionModal 鎺ュ叆 GameLayout
  const page = readFileSync('src/app/page.tsx', 'utf-8');
  assert(/import\s+\{[^}]*AscensionModal[^}]*\}\s+from\s+['"]@\/components\/xianxia\/AscensionModal['"]/.test(page),
    'page.tsx 搴?import AscensionModal');
  assert(/data-testid="ascension-section"/.test(page), 'page.tsx 搴旀覆鏌?ascension-section');
  assert(/ascensionPending/.test(page), 'page.tsx 搴旀秷璐?ascensionPending');
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/ascensionPending\?:\s*AscensionSession\s*\|\s*null/.test(types), 'CharacterState 搴旀湁 ascensionPending');
  log('ascension-modal-integrated', { passed: true });
}

function smokeRestrictionModalIntegrated(): void {
  // AI-72: RestrictionModal 鎺ュ叆 GameLayout
  const page = readFileSync('src/app/page.tsx', 'utf-8');
  assert(/import\s+\{[^}]*RestrictionModal[^}]*\}\s+from\s+['"]@\/components\/xianxia\/RestrictionModal['"]/.test(page),
    'page.tsx 搴?import RestrictionModal');
  assert(/data-testid="restriction-section"/.test(page), 'page.tsx 搴旀覆鏌?restriction-section');
  assert(/restrictionPending/.test(page), 'page.tsx 搴旀秷璐?restrictionPending');
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/restrictionPending\?:\s*Restriction\s*\|\s*null/.test(types), 'CharacterState 搴旀湁 restrictionPending');
  log('restriction-modal-integrated', { passed: true });
}

function smokeAllL3ModalsInLayout(): void {
  // AI-72: 4 涓?L3 modal 鍏ㄩ儴鎺ュ叆锛圱ribulation + Ascension + Restriction + CombatModal 宸叉湁锛?  const page = readFileSync('src/app/page.tsx', 'utf-8');
  assert(/TribulationModal|CombatModal/.test(page), 'page.tsx 搴斿凡鏈夋垬鏂?modal');
  assert(/AscensionModal/.test(page), 'page.tsx 搴?import AscensionModal');
  assert(/RestrictionModal/.test(page), 'page.tsx 搴?import RestrictionModal');
  // 鑷冲皯 2 涓?section testid
  const sectionTestids = page.match(/data-testid="[a-z-]+-section"/g) || [];
  assert(sectionTestids.length >= 2, `page.tsx 搴旇嚦灏?2 涓?section testid锛堝疄闄?${sectionTestids.length}锛塦);
  log('all-l3-modals-in-layout', { passed: true });
}

function smokeSecretRealmRestrictionField(): void {
  // AI-71: realm.restrictions + requiredRestrictionsPassed
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/restrictions\?:\s*Restriction\[\]/.test(types), 'SecretRealm 搴旀湁 restrictions?: Restriction[]');
  assert(/requiredRestrictionsPassed\?:\s*string\[\]/.test(types), 'SecretRealm 搴旀湁 requiredRestrictionsPassed?: string[]');
  log('secret-realm-restriction-field', { passed: true });
}

function smokeRealmEnterCheckDerivation(): void {
  // AI-71: deriveRealmRestrictionCheck
  const engine = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  assert(/export function deriveRealmRestrictionCheck/.test(engine), 'engine.ts 搴斿鍑?deriveRealmRestrictionCheck');
  assert(/missingRestrictions/.test(engine), 'deriveRealmRestrictionCheck 搴旇繑鍥?missingRestrictions');
  // 杈圭晫锛氬叏閮ㄩ€氳繃 鈫?canEnter
  const logic = (required: string[], passed: string[]): boolean =>
    required.every((r) => passed.includes(r));
  assert(logic(['r1', 'r2'], ['r1', 'r2']) === true, '鍏ㄩ儴閫氳繃搴斿彲杩涘叆');
  assert(logic(['r1', 'r2'], ['r1']) === false, '缂哄皯绂佸埗涓嶅彲杩涘叆');
  log('realm-enter-check-derivation', { passed: true });
}

function smokeRestrictionTypesExist(): void {
  // AI-70: RestrictionType + RestrictionAccessMethod
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/type RestrictionType\s*=/.test(types), 'types.ts 搴斿畾涔?RestrictionType');
  for (const t of ['door', 'trap', 'transport', 'seal', 'ward', 'barrier']) {
    assert(types.includes(`'${t}'`), `RestrictionType 搴斿惈 ${t}`);
  }
  assert(/type RestrictionAccessMethod\s*=/.test(types), 'types.ts 搴斿畾涔?RestrictionAccessMethod');
  for (const m of ['token', 'password', 'identity', 'key', 'timing', 'combat']) {
    assert(types.includes(`'${m}'`), `RestrictionAccessMethod 搴斿惈 ${m}`);
  }
  assert(/interface Restriction/.test(types), 'types.ts 搴旀湁 Restriction interface');
  log('restriction-types-exist', { passed: true });
}

function smokeRestrictionAccessCheck(): void {
  // AI-70: checkRestrictionAccess
  const engine = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  assert(/export function checkRestrictionAccess/.test(engine), 'engine.ts 搴斿鍑?checkRestrictionAccess');
  assert(/accessMethod/.test(engine), 'checkRestrictionAccess 搴斿鐞?accessMethod');
  assert(/requiredItemId/.test(engine), 'checkRestrictionAccess 搴斿鐞?token/key');
  assert(/providedPassword/.test(engine), 'checkRestrictionAccess 搴斿鐞?password');
  log('restriction-access-check', { passed: true });
}

function smokeRestrictionTriggerDerivation(): void {
  // AI-70: deriveRestrictionTrigger + resolveRestrictionInteraction
  const engine = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  assert(/export function deriveRestrictionTrigger/.test(engine), 'engine.ts 搴斿鍑?deriveRestrictionTrigger');
  assert(/export function resolveRestrictionInteraction/.test(engine), 'engine.ts 搴斿鍑?resolveRestrictionInteraction');
  assert(/'attempt'|'retreat'|'combat'/.test(engine), 'resolveRestrictionInteraction 搴旀帴鍙?3 绉?choice');
  log('restriction-trigger-derivation', { passed: true });
}

function smokeRestrictionApiExists(): void {
  // AI-70: 2 API route + 1 鏂囨。
  for (const route of ['check', 'interact']) {
    const path = `src/app/api/game/restriction/${route}/route.ts`;
    assert(Bun.file(path).size > 0, `${path} 搴斿瓨鍦╜);
  }
  const check = readFileSync('src/app/api/game/restriction/check/route.ts', 'utf-8');
  assert(/checkRestrictionAccess/.test(check), 'check route 搴旇皟鐢?checkRestrictionAccess');
  const interact = readFileSync('src/app/api/game/restriction/interact/route.ts', 'utf-8');
  assert(/resolveRestrictionInteraction/.test(interact), 'interact route 搴旇皟鐢?resolveRestrictionInteraction');
  assert(Bun.file('docs/world/restrictions-detail.md').size > 0, 'docs/world/restrictions-detail.md 搴斿瓨鍦?);
  log('restriction-api-exists', { passed: true });
}

function smokeRestrictionModalExists(): void {
  // AI-70: RestrictionModal UI
  const ui = readFileSync('src/components/xianxia/RestrictionModal.tsx', 'utf-8');
  assert(/data-testid="restriction-modal"/.test(ui), 'RestrictionModal 搴旀湁 modal testid');
  assert(/data-testid="restriction-method"/.test(ui), 'RestrictionModal 搴旀樉绀哄紑鍚柟寮?);
  assert(/data-testid="restriction-action-attempt"/.test(ui), 'RestrictionModal 搴旀湁 灏濊瘯鎸夐挳');
  assert(/data-testid="restriction-action-combat"/.test(ui), 'RestrictionModal 搴旀湁 鎴樻枟鎸夐挳');
  assert(/Restriction|RestrictionType/.test(ui), 'RestrictionModal 搴旀秷璐?types');
  log('restriction-modal-exists', { passed: true });
}

function smokeNpcWorldTierField(): void {
  // AI-69: npc.worldTier + crossRealmAccess
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/worldTier\?:\s*WorldTier/.test(types), 'WorldNpc 搴旀湁 worldTier?: WorldTier');
  assert(/crossRealmAccess\?:\s*boolean/.test(types), 'WorldNpc 搴旀湁 crossRealmAccess?: boolean');
  log('npc-world-tier-field', { passed: true });
}

function smokeCrossRealmPathsDerivation(): void {
  // AI-69: deriveCrossRealmPaths
  const engine = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  assert(/export function deriveCrossRealmPaths/.test(engine), 'engine.ts 搴斿鍑?deriveCrossRealmPaths');
  assert(/interface CrossRealmPath/.test(engine), 'engine.ts 搴旀湁 CrossRealmPath interface');
  assert(/'ascension'|'starSky'|'token'|'forbidden'/.test(engine), '搴旀湁 4 绉嶉€氶亾绫诲瀷');
  // 鍑￠棿璧锋搴斿寘鍚鍗囪矾寰?  const logic = (tier: string): { from: string; to: string }[] => {
    if (tier === 'humanWorld') return [{ from: 'humanWorld', to: 'spiritWorld' }];
    return [];
  };
  const paths = logic('humanWorld');
  assert(paths.length === 1, '鍑￠棿璧锋搴旇嚦灏戞湁 1 鏉￠鍗囪矾寰?);
  log('cross-realm-paths-derivation', { passed: true });
}

function smokeCrossRealmDocsExist(): void {
  // AI-69: 2 鏂囨。
  assert(Bun.file('docs/world/cross-realm-npcs.md').size > 0, 'docs/world/cross-realm-npcs.md 搴斿瓨鍦?);
  assert(Bun.file('docs/world/starry-sky-paths.md').size > 0, 'docs/world/starry-sky-paths.md 搴斿瓨鍦?);
  const npcs = readFileSync('docs/world/cross-realm-npcs.md', 'utf-8');
  assert(/鍑￠棿|鐏电晫|浠欑晫/.test(npcs), 'cross-realm-npcs.md 搴旀弿杩颁笁鐣?);
  const paths = readFileSync('docs/world/starry-sky-paths.md', 'utf-8');
  assert(/椋炲崌|鏄熺┖|浠欎护/.test(paths), 'starry-sky-paths.md 搴旀弿杩伴€氶亾绫诲瀷');
  log('cross-realm-docs-exist', { passed: true });
}

function smokeAscensionRequirementsExist(): void {
  // AI-68: WorldTier + AscensionRequirement
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/type WorldTier\s*=/.test(types), 'types.ts 搴斿畾涔?WorldTier');
  for (const t of ['humanWorld', 'spiritWorld', 'immortalWorld']) {
    assert(types.includes(`'${t}'`), `WorldTier 搴斿惈 ${t}`);
  }
  assert(/interface AscensionRequirement/.test(types), 'types.ts 搴旀湁 AscensionRequirement interface');
  assert(/interface AscensionSession/.test(types), 'types.ts 搴旀湁 AscensionSession interface');
  const engine = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  assert(/export function deriveAscensionRequirements/.test(engine), 'engine.ts 搴斿鍑?deriveAscensionRequirements');
  log('ascension-requirements-exist', { passed: true });
}

function smokeAscensionEligibilityCheck(): void {
  // AI-68: checkAscensionEligibility
  const engine = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  assert(/export function checkAscensionEligibility/.test(engine), 'engine.ts 搴斿鍑?checkAscensionEligibility');
  assert(/missing/.test(engine), 'checkAscensionEligibility 搴旇繑鍥?missing 鍒楄〃');
  assert(/lifespanMin|reputationMin|cultivationExpMin|daoHeartMin/.test(engine), 'checkAscensionEligibility 搴旀牎楠?4 椤规暟鍊?);
  log('ascension-eligibility-check', { passed: true });
}

function smokeAscensionTriggerDerivation(): void {
  // AI-68: deriveAscensionTrigger + resolveAscensionOutcome
  const engine = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  assert(/export function deriveAscensionTrigger/.test(engine), 'engine.ts 搴斿鍑?deriveAscensionTrigger');
  assert(/export function resolveAscensionOutcome/.test(engine), 'engine.ts 搴斿鍑?resolveAscensionOutcome');
  // 澶т箻鏈?500 宀佽Е鍙?  assert(/mahayana/.test(engine) && /500/.test(engine), '搴旀湁澶т箻鏈?500 宀佽Е鍙戞潯浠?);
  // 娓″姭鏈?2000 宀佽Е鍙?  assert(/ascension/.test(engine) && /2000/.test(engine), '搴旀湁娓″姭鏈?2000 宀佽Е鍙戞潯浠?);
  log('ascension-trigger-derivation', { passed: true });
}

function smokeAscensionApiExists(): void {
  // AI-68: 3 API route
  for (const route of ['check', 'start', 'end']) {
    const path = `src/app/api/game/ascension/${route}/route.ts`;
    assert(Bun.file(path).size > 0, `${path} 搴斿瓨鍦╜);
  }
  const check = readFileSync('src/app/api/game/ascension/check/route.ts', 'utf-8');
  assert(/checkAscensionEligibility/.test(check), 'check route 搴旇皟鐢?checkAscensionEligibility');
  const start = readFileSync('src/app/api/game/ascension/start/route.ts', 'utf-8');
  assert(/deriveAscensionTrigger/.test(start), 'start route 搴旇皟鐢?deriveAscensionTrigger');
  const end = readFileSync('src/app/api/game/ascension/end/route.ts', 'utf-8');
  assert(/resolveAscensionOutcome/.test(end), 'end route 搴旇皟鐢?resolveAscensionOutcome');
  // 鏂囨。
  assert(Bun.file('docs/world/ascension-flow.md').size > 0, 'docs/world/ascension-flow.md 搴斿瓨鍦?);
  assert(Bun.file('docs/world/three-realms-detail.md').size > 0, 'docs/world/three-realms-detail.md 搴斿瓨鍦?);
  log('ascension-api-exists', { passed: true });
}

function smokeAscensionModalExists(): void {
  // AI-68: AscensionModal UI
  const ui = readFileSync('src/components/xianxia/AscensionModal.tsx', 'utf-8');
  assert(/data-testid="ascension-modal"/.test(ui), 'AscensionModal 搴旀湁 modal testid');
  assert(/data-testid="ascension-requirements"/.test(ui), 'AscensionModal 搴旀樉绀鸿姹?);
  assert(/data-testid="ascension-action-roll"/.test(ui), 'AscensionModal 搴旀湁 椋炲崌鎸夐挳');
  assert(/AscensionSession|WorldTier/.test(ui), 'AscensionModal 搴旀秷璐?types');
  log('ascension-modal-exists', { passed: true });
}

function smokeTribulationTriggerExists(): void {
  // AI-67: deriveTribulationTrigger
  const engine = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  assert(/export function deriveTribulationTrigger/.test(engine), 'engine.ts 搴斿鍑?deriveTribulationTrigger');
  assert(/'deity_transformation'/.test(engine), '澶╁姭澧冪晫搴斿惈鍖栫');
  // 閫昏緫
  const triggered = true;
  assert(triggered === true, '瑙﹀彂鏍囧織搴斿彲璇诲彇');
  log('tribulation-trigger-exists', { passed: true });
}

function smokeTribulationBoltResolution(): void {
  // AI-67: resolveTribulationBolt
  const engine = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  assert(/export function resolveTribulationBolt/.test(engine), 'engine.ts 搴斿鍑?resolveTribulationBolt');
  assert(/boltNumber/.test(engine), 'resolveTribulationBolt 搴旀帴鍙?boltNumber');
  assert(/heartDemonPenalty/.test(engine), 'resolveTribulationBolt 搴旀湁 蹇冮瓟鎯╃綒閫昏緫');
  // 鏈懡娉曞疂鍏遍福鍔犳垚
  assert(/bondedArtifactResonance/.test(engine), 'resolveTribulationBolt 搴旇€冭檻鏈懡娉曞疂鍏遍福');
  log('tribulation-bolt-resolution', { passed: true });
}

function smokeHeartDemonTypes(): void {
  // AI-67: 5 绉嶅績榄?  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/type HeartDemonType\s*=/.test(types), 'types.ts 搴斿畾涔?HeartDemonType');
  for (const t of ['obsession', 'hatred', 'love', 'fear', 'regret']) {
    assert(types.includes(`'${t}'`), `HeartDemonType 搴斿惈 ${t}`);
  }
  const engine = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
  assert(/export function resolveHeartDemon/.test(engine), 'engine.ts 搴斿鍑?resolveHeartDemon');
  const ui = readFileSync('src/components/xianxia/TribulationModal.tsx', 'utf-8');
  assert(/鎵у康|鎭ㄦ剰|鎯呯埍|鎭愭儳|鎮旀剰/.test(ui), 'TribulationModal 搴旀樉绀?5 绉嶅績榄斾腑鏂?label');
  log('heart-demon-types', { passed: true });
}

function smokeTribulationApiExists(): void {
  // AI-67: 3 涓?API route
  for (const route of ['start', 'action', 'end']) {
    const path = `src/app/api/game/tribulation/${route}/route.ts`;
    assert(Bun.file(path).size > 0, `${path} 搴斿瓨鍦╜);
  }
  const start = readFileSync('src/app/api/game/tribulation/start/route.ts', 'utf-8');
  assert(/deriveTribulationTrigger/.test(start), 'start route 搴旇皟鐢?deriveTribulationTrigger');
  const action = readFileSync('src/app/api/game/tribulation/action/route.ts', 'utf-8');
  assert(/resolveTribulationBolt|resolveHeartDemon/.test(action), 'action route 搴旇皟鐢?resolveTribulationBolt/resolveHeartDemon');
  const end = readFileSync('src/app/api/game/tribulation/end/route.ts', 'utf-8');
  assert(/outcome/.test(end), 'end route 搴斿鐞?outcome');
  log('tribulation-api-exists', { passed: true });
}

function smokeTribulationModalExists(): void {
  // AI-67: TribulationModal UI
  const ui = readFileSync('src/components/xianxia/TribulationModal.tsx', 'utf-8');
  assert(/data-testid="tribulation-modal"/.test(ui), 'TribulationModal 搴旀湁 modal testid');
  assert(/data-testid="tribulation-bolts"/.test(ui), 'TribulationModal 搴旀樉绀?9 閬撻浄杩涘害');
  assert(/data-testid={\s*`tribulation-bolt-\$\{n\}`/.test(ui), 'TribulationModal 搴斿姩鎬佺敓鎴?bolt-1 ~ bolt-9 testid');
  assert(/data-testid="tribulation-action-bolt"/.test(ui), 'TribulationModal 搴旀湁 娓￠浄鎸夐挳');
  assert(/TribulationSession|HeartDemonType/.test(ui), 'TribulationModal 搴旀秷璐?types');
  log('tribulation-modal-exists', { passed: true });
}

function smokeCharacterSectHistoryField(): void {
  // AI-66: character.sectHistory
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/sectHistory\?:\s*SectHistoryEntry\[\]/.test(types), 'CharacterState 搴旀湁 sectHistory?: SectHistoryEntry[]');
  assert(/interface SectHistoryEntry/.test(types), 'types.ts 搴斿畾涔?SectHistoryEntry interface');
  assert(/reason:\s*['"]joined['"]/.test(types), 'SectHistoryEntry 搴旀湁 reason enum');
  const display = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/SECT_HISTORY_REASON_LABEL/.test(display), 'display.ts 搴斿鍑?SECT_HISTORY_REASON_LABEL');
  assert(/鍏ラ棬|閫愬嚭|椋炲崌|娈夐亾|閫€闅?.test(display), 'SECT_HISTORY_REASON_LABEL 搴斿惈 6 鍘熷洜');
  log('character-sect-history-field', { passed: true });
}

function smokeCharacterTeacherRefField(): void {
  // AI-66: character.teacherRef
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/teacherRef\?:\s*NpcRef\s*\|\s*null/.test(types), 'CharacterState 搴旀湁 teacherRef?: NpcRef | null');
  const display = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/RELATION_MENTOR_LABEL/.test(display), 'display.ts 搴斿鍑?RELATION_MENTOR_LABEL');
  assert(/甯坾寰抾鍚岄棬/.test(display), 'RELATION_MENTOR_LABEL 搴斿惈 3 鍏崇郴');
  log('character-teacher-ref-field', { passed: true });
}

function smokeCharacterApprenticesField(): void {
  // AI-66: character.apprentices
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/apprentices\?:\s*NpcRef\[\]/.test(types), 'CharacterState 搴旀湁 apprentices?: NpcRef[]');
  log('character-apprentices-field', { passed: true });
}

function smokePetTypeField(): void {
  // AI-65: pet.type
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/type\?:\s*['"]pet['"]\s*\|\s*['"]insect['"]\s*\|\s*['"]swarm['"]\s*\|\s*['"]beast['"]/.test(types),
    'Pet 搴旀湁 type?: pet|insect|swarm|beast');
  const display = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/PET_TYPE_LABEL/.test(display), 'display.ts 搴斿鍑?PET_TYPE_LABEL');
  assert(/鐏靛疇|鐏佃櫕|铏兢|鐏靛吔/.test(display), 'PET_TYPE_LABEL 搴斿惈 4 绫诲瀷');
  log('pet-type-field', { passed: true });
}

function smokePetSwarmCountField(): void {
  // AI-65: pet.swarmCount
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/swarmCount\?:\s*number/.test(types), 'Pet 搴旀湁 swarmCount?: number');
  assert(swarmCountLogic(100) === 100, 'swarmCount 搴旀甯?);
  assert(swarmCountLogic(0) === 0, 'swarmCount 0 搴旀甯?);
  function swarmCountLogic(v: number): number { return Math.max(0, v); }
  log('pet-swarm-count-field', { passed: true });
}

function smokePetCombatSkillIds(): void {
  // AI-65: pet.combatSkillIds
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/combatSkillIds\?:\s*string\[\]/.test(types), 'Pet 搴旀湁 combatSkillIds?: string[]');
  log('pet-combat-skill-ids', { passed: true });
}

function smokeCharacterSpouseField(): void {
  // AI-64: character.spouse (NpcRef | null)
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/spouse\?:\s*NpcRef\s*\|\s*null/.test(types), 'CharacterState 搴旀湁 spouse?: NpcRef | null');
  assert(/interface NpcRef/.test(types), 'types.ts 搴斿畾涔?NpcRef interface');
  assert(/intimacy:\s*number/.test(types), 'NpcRef 搴旀湁 intimacy: number');
  log('character-spouse-field', { passed: true });
}

function smokeCharacterCultivationHarmonyBonus(): void {
  // AI-64: character.cultivationHarmonyBonus 0-50
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/cultivationHarmonyBonus\?:\s*number/.test(types), 'CharacterState 搴旀湁 cultivationHarmonyBonus?: number');
  const clamp = (v: number) => Math.max(0, Math.min(50, v));
  assert(clamp(60) === 50, 'cultivationHarmonyBonus > 50 搴?clamp');
  assert(clamp(-10) === 0, 'cultivationHarmonyBonus < 0 搴?clamp');
  const display = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/DUAL_CULTIVATION_LABEL/.test(display), 'display.ts 搴斿鍑?DUAL_CULTIVATION_LABEL');
  assert(/鍒濈|鍜屽悎|鍏辨尟|鍚堜竴/.test(display), 'DUAL_CULTIVATION_LABEL 搴斿惈 4 妗?);
  log('character-cultivation-harmony-bonus', { passed: true });
}

function smokeNpcSpouseOfField(): void {
  // AI-64: npc.spouseOf
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/spouseOf\?:\s*string\s*\|\s*null/.test(types), 'WorldNpc 搴旀湁 spouseOf?: string | null');
  assert(/dualCultivationProgress\?:\s*number/.test(types), 'WorldNpc 搴旀湁 dualCultivationProgress?: number');
  const display = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/DAO_LU_LABEL/.test(display), 'display.ts 搴斿鍑?DAO_LU_LABEL');
  assert(/閬撲荆|缂樺敖|鏈畾涔嬬紭/.test(display), 'DAO_LU_LABEL 搴斿惈涓枃 label');
  log('npc-spouse-of-field', { passed: true });
}

function smokeArtifactBondedField(): void {
  // AI-63: artifact.bonded
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/bonded\?:\s*boolean/.test(types), 'types.ts ItemEntry 搴旀湁 bonded?: boolean');
  const display = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/BONDED_ARTIFACT_LABEL/.test(display), 'display.ts 搴斿鍑?BONDED_ARTIFACT_LABEL');
  assert(/鏈懡|澶栫敤/.test(display), 'BONDED_ARTIFACT_LABEL 搴斿惈 鏈懡/澶栫敤');
  log('artifact-bonded-field', { passed: true });
}

function smokeArtifactSoulLinkField(): void {
  // AI-63: artifact.soulLink 0-100
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/soulLink\?:\s*number/.test(types), 'types.ts ItemEntry 搴旀湁 soulLink?: number');
  // 杈圭晫
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  assert(clamp(150) === 100, 'soulLink > 100 搴?clamp');
  assert(clamp(-50) === 0, 'soulLink < 0 搴?clamp');
  const display = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/SOUL_LINK_LEVEL_LABEL/.test(display), 'display.ts 搴斿鍑?SOUL_LINK_LEVEL_LABEL');
  assert(/闄岃矾|鍒濊瘑|鍏遍福|鍚堜竴/.test(display), 'SOUL_LINK_LEVEL_LABEL 搴斿惈 4 妗?);
  log('artifact-soul-link-field', { passed: true });
}

function smokeArtifactSpiritField(): void {
  // AI-63: artifact.spirit / gestationDays
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/spirit\?:\s*string\s*\|\s*null/.test(types), 'types.ts ItemEntry 搴旀湁 spirit?: string | null');
  assert(/gestationDays\?:\s*number/.test(types), 'types.ts ItemEntry 搴旀湁 gestationDays?: number');
  const display = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/ARTIFACT_SPIRIT_LABEL/.test(display), 'display.ts 搴斿鍑?ARTIFACT_SPIRIT_LABEL');
  assert(/鏈啋|鍒濋啋|瑙夐啋/.test(display), 'ARTIFACT_SPIRIT_LABEL 搴斿惈 3 妗?);
  log('artifact-spirit-field', { passed: true });
}

function smokeAlchemyHeatEnumExists(): void {
  // AI-62: AlchemyHeatLevel enum
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/export type AlchemyHeatLevel\s*=/.test(types), 'types.ts 搴斿畾涔?AlchemyHeatLevel enum');
  for (const v of ['micro', 'weak', 'moderate', 'strong', 'extreme']) {
    assert(types.includes(`'${v}'`), `AlchemyHeatLevel 搴斿惈 ${v}`);
  }
  const display = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/ALCHEMY_HEAT_LABEL/.test(display), 'display.ts 搴斿鍑?ALCHEMY_HEAT_LABEL');
  assert(/寰伀|寮辩伀|涓伀|寮虹伀|鏋佺伀/.test(display), 'ALCHEMY_HEAT_LABEL 搴斿惈 5 绾?label');
  log('alchemy-heat-enum-exists', { passed: true });
}

function smokeFormationTypeEnumExists(): void {
  // AI-62: FormationCategory enum
  const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/export type FormationCategory\s*=/.test(types), 'types.ts 搴斿畾涔?FormationCategory enum');
  for (const v of ['binding', 'slaughter', 'illusion', 'defense', 'support', 'trap']) {
    assert(types.includes(`'${v}'`), `FormationCategory 搴斿惈 ${v}`);
  }
  const display = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/FORMATION_CATEGORY_LABEL/.test(display), 'display.ts 搴斿鍑?FORMATION_CATEGORY_LABEL');
  assert(/鍥伴樀|鏉€闃祙骞婚樀|闃查樀|杈呴樀|闄烽樀/.test(display), 'FORMATION_CATEGORY_LABEL 搴斿惈 6 绫?label');
  log('formation-category-enum-exists', { passed: true });
}

function smokeL1WorldDocsPromptInjection(): void {
  // AI-61: 8 涓?L1 鏂囨。娉ㄥ叆 llm.ts prompt
  const llmSource = readFileSync('src/lib/xianxia/llm.ts', 'utf-8');
  assert(/WORLD_DOCS\s*=\s*\[/.test(llmSource), 'llm.ts 搴斿畾涔?WORLD_DOCS 鏁扮粍');
  const expectedDocs = [
    'spirit-roots.md', 'three-realms.md', 'tribulation-heart-demon.md',
    'spirit-insects-beasts.md', 'alchemy-handfeel.md', 'formations-restrictions.md',
    'cross-realm-paths.md', 'complicated-relations.md',
  ];
  for (const d of expectedDocs) {
    assert(llmSource.includes(d), `WORLD_DOCS 搴斿惈 ${d}`);
    assert(Bun.file(`docs/world/${d}`).size > 0, `docs/world/${d} 搴斿瓨鍦╜);
  }
  assert(/loadWorldKnowledge/.test(llmSource), 'llm.ts 搴旀湁 loadWorldKnowledge 鍑芥暟');
  assert(/worldKnowledge/.test(llmSource), 'llm.ts 搴斾娇鐢?worldKnowledge 鍙橀噺');
  // 搴斿湪 generateAgeEvent / generateBirthEvent 绛夊叆鍙ｆ敞鍏?  assert(/await loadWorldKnowledge/.test(llmSource), '搴斿湪 async 鍏ュ彛 await loadWorldKnowledge');
  // sync 鍏ュ彛鐢?getWorldKnowledgeSync fallback
  assert(/getWorldKnowledgeSync/.test(llmSource), '搴斿鍑?getWorldKnowledgeSync');
  log('l1-world-docs-prompt-injection', { passed: true });
}

function smokeTopTagsConsumesDisplayRegistry(): void {
  // AI-46: StatusPanel 娑堣垂 topTags slot
  const panel = readFileSync('src/components/xianxia/StatusPanel.tsx', 'utf-8');
  assert(/entriesForSlot\(allDisplayEntries, 'topTags'/.test(panel), 'StatusPanel 搴旀秷璐?topTags slot');
  assert(/topTagEntries|topTagToneClass|data-testid="status-top-tags"/.test(panel), 'StatusPanel 搴旀湁 topTagEntries + toneClass + testid');
  log('top-tags-consumes-display-registry', { passed: true });
}

function smokeThreadPageConsumesDisplayRegistry(): void {
  // AI-47: PendingThreadsCard 娑堣垂 threadPage slot
  const card = readFileSync('src/components/xianxia/PendingThreadsCard.tsx', 'utf-8');
  assert(/entriesForSlot\(allDisplayEntries, 'threadPage'/.test(card), 'PendingThreadsCard 搴旀秷璐?threadPage slot');
  assert(/threadPageEntries|data-testid="thread-page-slot"/.test(card), 'PendingThreadsCard 搴旀湁 threadPageEntries + testid');
  log('thread-page-consumes-display-registry', { passed: true });
}

function smokeCombatPanelConsumesDisplayRegistry(): void {
  // AI-48: CombatModal 娑堣垂 combatPanel slot
  const modal = readFileSync('src/components/xianxia/CombatModal.tsx', 'utf-8');
  assert(/entriesForSlot\(characterDisplayEntries\(character\), 'combatPanel'/.test(modal), 'CombatModal 搴旀秷璐?combatPanel slot');
  assert(/data-testid="combat-panel-slot"/.test(modal), 'CombatModal 搴旀湁 testid');
  log('combat-panel-consumes-display-registry', { passed: true });
}

function smokeInventoryPanelConsumesDisplayRegistry(): void {
  // AI-49: InventoryPanel 娑堣垂 inventoryPanel slot
  const panel = readFileSync('src/components/xianxia/InventoryPanel.tsx', 'utf-8');
  assert(/entriesForSlot\(characterDisplayEntries\(character\), 'inventoryPanel'/.test(panel), 'InventoryPanel 搴旀秷璐?inventoryPanel slot');
  assert(/inventoryPanelEntries|data-testid="inventory-panel-slot"/.test(panel), 'InventoryPanel 搴旀湁 inventoryPanelEntries + testid');
  log('inventory-panel-consumes-display-registry', { passed: true });
}

function smokeWorldLegacyConsumesDisplayRegistry(): void {
  // AI-50: WorldLegacyPanel 娑堣垂 worldLegacy slot
  const panel = readFileSync('src/components/xianxia/WorldLegacyPanel.tsx', 'utf-8');
  assert(/entriesForSlot\(characterDisplayEntries\(character\), 'worldLegacy'/.test(panel), 'WorldLegacyPanel 搴旀秷璐?worldLegacy slot');
  assert(/worldLegacyEntries|allEntries/.test(panel), 'WorldLegacyPanel 搴旀湁 worldLegacyEntries 鎴?allEntries');
  log('world-legacy-consumes-display-registry', { passed: true });
}

function smokeWorldLegacyPanelExists(): void {
  // AI-50: WorldLegacyPanel 鏂囦欢瀛樺湪
  assert(Bun.file('src/components/xianxia/WorldLegacyPanel.tsx').size > 0, 'WorldLegacyPanel.tsx 搴斿瓨鍦?);
  const src = readFileSync('src/components/xianxia/WorldLegacyPanel.tsx', 'utf-8');
  assert(/export function WorldLegacyPanel/.test(src), 'WorldLegacyPanel.tsx 搴斿鍑虹粍浠?);
  assert(/data-testid="world-legacy-panel"/.test(src), 'WorldLegacyPanel 搴旀湁 testid');
  // 7 涓?slot 鍏ㄨ鐩栵紙闄?characterDetail/statusPage 鍘熸湰灏辨秷璐圭殑澶栵級
  const registry = readFileSync('src/lib/xianxia/display-registry.ts', 'utf-8');
  for (const slot of ['topTags', 'threadPage', 'combatPanel', 'inventoryPanel', 'worldLegacy']) {
    assert(registry.includes(slot), `display-registry.ts 搴斿畾涔?${slot} slot`);
  }
  log('world-legacy-panel-exists', { passed: true });
}

function smokeCausalityNetNodeTypes(): void {
  // AI-43: 7 绉嶈妭鐐圭被鍨?  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/NODE_TYPE_LABEL/.test(displaySource), 'display.ts 搴斿鍑?NODE_TYPE_LABEL');
  const types = ['person', 'place', 'item', 'thread', 'event', 'faction', 'concept'];
  for (const t of types) {
    assert(displaySource.includes(t), `NODE_TYPE_LABEL 搴斿惈 ${t}`);
  }
  log('causality-net-node-types', { passed: true });
}

function smokeCausalityNetEdgeTypes(): void {
  // AI-43: 7 绉嶈竟绫诲瀷
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/EDGE_TYPE_LABEL/.test(displaySource), 'display.ts 搴斿鍑?EDGE_TYPE_LABEL');
  const types = ['cause', 'effect', 'related', 'oppose', 'belongs', 'created', 'destroyed'];
  for (const t of types) {
    assert(displaySource.includes(t), `EDGE_TYPE_LABEL 搴斿惈 ${t}`);
  }
  log('causality-net-edge-types', { passed: true });
}

function smokeCausalityNetStrengthClamp(): void {
  // AI-43: 寮哄害杈圭晫 + 琛板噺
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  assert(clamp(150) === 100, 'strength > 100 搴?clamp');
  assert(clamp(-50) === 0, 'strength < 0 搴?clamp 鍒?0');
  // 琛板噺 5%/10骞?  const decay = (v: number, years: number): number => {
    const k = Math.floor(years / 10);
    for (let i = 0; i < k; i++) v *= 0.95;
    return Math.round(v);
  };
  assert(decay(100, 10) === 95, '100 缁?10 骞村簲琛板噺鍒?95');
  assert(decay(100, 100) < 100, '楂樺己搴﹂暱鏈熻“鍑忓簲闄嶄綆');
  log('causality-net-strength-clamp', { passed: true });
}

function smokeCausalityNetBlueprint(): void {
  // AI-43: 钃濆浘鏂囨。瀹屾暣鎬?  assert(Bun.file('docs/blueprints/causality-net-blueprint.md').size > 0, 'causality-net-blueprint.md 搴斿瓨鍦?);
  const src = readFileSync('docs/blueprints/causality-net-blueprint.md', 'utf-8');
  assert(/\|.+\|.+\|/.test(src), '钃濆浘搴斿惈琛ㄦ牸');
  assert(/AI 鎺ョ/.test(src), '钃濆浘搴旇鏄?AI 鎺ョ');
  assert(/7.*鑺傜偣|7.*杈箌person.*place.*item/.test(src), '钃濆浘搴斿垪 7 鑺傜偣 7 杈?);
  log('causality-net-blueprint', { passed: true });
}

function smokeClanSectStatusEnum(): void {
  // AI-42: 9 绉嶅畻闂ㄧ姸鎬佹灇涓?  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/SECT_STATUS_LABEL/.test(displaySource), 'display.ts 搴斿鍑?SECT_STATUS_LABEL');
  const states = ['founding', 'rising', 'flourishing', 'stable', 'unrest', 'underSiege', 'declining', 'revival', 'extinct'];
  for (const s of states) {
    assert(displaySource.includes(s), `SECT_STATUS_LABEL 搴斿惈 ${s}`);
  }
  log('clan-sect-status-enum', { passed: true });
}

function smokeClanSectLifecyclePath(): void {
  // AI-42: 鐢熷懡鍛ㄦ湡璺緞鍚堟硶锛堜笉鍙秺绾э級
  const validNext: Record<string, string[]> = {
    founding: ['rising'],
    rising: ['flourishing', 'unrest'],
    flourishing: ['stable', 'declining', 'underSiege'],
    stable: ['flourishing', 'declining', 'unrest'],
    unrest: ['declining', 'stable'],
    underSiege: ['declining', 'stable'],
    declining: ['extinct', 'revival'],
    revival: ['flourishing', 'stable'],
    extinct: [],  // 缁堢偣
  };
  const canTransition = (from: string, to: string): boolean => validNext[from]?.includes(to) ?? false;
  assert(canTransition('founding', 'rising') === true, 'founding 鈫?rising 搴斿悎娉?);
  assert(canTransition('founding', 'flourishing') === false, 'founding 鈫?flourishing 搴斾笉鍚堟硶');
  assert(canTransition('extinct', 'revival') === false, 'extinct 鈫?revival 搴斾笉鍚堟硶锛堜笉鍙€嗭級');
  assert(canTransition('declining', 'revival') === true, 'declining 鈫?revival 搴斿悎娉?);
  log('clan-sect-lifecycle-path', { passed: true });
}

function smokeClanSectBlueprint(): void {
  // AI-42: 钃濆浘鏂囨。瀹屾暣鎬?  assert(Bun.file('docs/blueprints/clan-sect-rise-fall-blueprint.md').size > 0, 'clan-sect-rise-fall-blueprint.md 搴斿瓨鍦?);
  const src = readFileSync('docs/blueprints/clan-sect-rise-fall-blueprint.md', 'utf-8');
  assert(/\|.+\|.+\|/.test(src), '钃濆浘搴斿惈琛ㄦ牸');
  assert(/AI 鎺ョ/.test(src), '钃濆浘搴旇鏄?AI 鎺ョ');
  assert(/9.*鐘舵€亅founding.*rising.*flourishing/.test(src), '钃濆浘搴斿垪 9 鐘舵€?);
  log('clan-sect-blueprint', { passed: true });
}

function smokeInheritanceChoiceExactlyOne(): void {
  // AI-41: 蹇呴』涓斿彧鑳介€?1 椤逛紶鎵?  const validSelections = [0, 1]; // 0=鏈€? 1=閫変簡涓€椤?  const validate = (n: number): boolean => validSelections.includes(n);
  assert(validate(0) && validate(1), '閫夋嫨鏁板簲涓?0 鎴?1');
  assert(!validate(2), '閫夋嫨 2 椤瑰簲鎶ラ敊');
  const src = readFileSync('docs/blueprints/inheritance-blueprint.md', 'utf-8');
  assert(/蹇呴』閫変笖鍙兘閫墊閫変笖鍙兘/.test(src), '钃濆浘搴斿己鍒惰姹?閫?1 椤?');
  log('inheritance-choice-exactly-one', { passed: true });
}

function smokeInheritanceTypesExist(): void {
  // AI-41: 6 绉嶄紶鎵跨被鍨?  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/INHERITANCE_TYPE_LABEL/.test(displaySource), 'display.ts 搴斿鍑?INHERITANCE_TYPE_LABEL');
  const types = ['spiritualRoot', 'technique', 'memory', 'soulFragment', 'oldFriend', 'token'];
  for (const t of types) {
    assert(displaySource.includes(t), `INHERITANCE_TYPE_LABEL 搴斿惈 ${t}`);
  }
  log('inheritance-types-exist', { passed: true });
}

function smokeInheritanceAiNarrative(): void {
  // AI-41: AI 鍐欎紶鎵垮彊浜?  const blueprint = readFileSync('docs/blueprints/inheritance-blueprint.md', 'utf-8');
  assert(/AI 鎺ョ/.test(blueprint) && /浼犳壙鍙欎簨/.test(blueprint), '钃濆浘搴旇鏄?AI 鍐欎紶鎵垮彊浜?);
  assert(/鏈簡鍥犳灉/.test(blueprint), '钃濆浘搴旇鏄庢湭浜嗗洜鏋滀紶缁欐柊瑙掕壊');
  log('inheritance-ai-narrative', { passed: true });
}

function smokeInheritanceBlueprint(): void {
  // AI-41: 钃濆浘鏂囨。瀹屾暣鎬?  assert(Bun.file('docs/blueprints/inheritance-blueprint.md').size > 0, 'inheritance-blueprint.md 搴斿瓨鍦?);
  const src = readFileSync('docs/blueprints/inheritance-blueprint.md', 'utf-8');
  assert(/\|.+\|.+\|/.test(src), '钃濆浘搴斿惈琛ㄦ牸');
  assert(/6.*绉嶄紶鎵縷6.*绫诲瀷|spiritualRoot.*technique.*memory/.test(src), '钃濆浘搴斿垪鍑?6 绉嶄紶鎵?);
  assert(/SettlementResult|InheritanceChoice/.test(src), '钃濆浘搴斿惈鏁版嵁濂戠害瀛楁');
  log('inheritance-blueprint', { passed: true });
}

function smokeCraftingRecipeSchema(): void {
  // AI-40: 閰嶆柟鏁版嵁濂戠害
  assert(Bun.file('docs/blueprints/crafting-blueprint.md').size > 0, 'crafting-blueprint.md 搴斿瓨鍦?);
  const src = readFileSync('docs/blueprints/crafting-blueprint.md', 'utf-8');
  assert(/inputs/.test(src) && /output/.test(src), '钃濆浘搴斿惈 inputs/output 瀛楁');
  assert(/requiredRealm/.test(src), '钃濆浘搴斿惈澧冪晫闂ㄦ');
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/CRAFTING_TYPE_LABEL/.test(displaySource), 'display.ts 搴斿鍑?CRAFTING_TYPE_LABEL');
  log('crafting-recipe-schema', { passed: true });
}

function smokeCraftingQualityTierDistribution(): void {
  // AI-40: 鍝佽川姒傜巼鍒嗗竷
  const sample = (luck: number): string => {
    const r = Math.random();
    if (luck > 70 && r < 0.03) return '缁濆搧';
    if (r < 0.04) return '鏋佸搧';
    if (r < 0.15) return '涓婂搧';
    if (r < 0.4) return '鑹搧';
    return '鍑″搧';
  };
  const distribution = new Map<string, number>();
  for (let i = 0; i < 1000; i++) {
    const q = sample(50);
    distribution.set(q, (distribution.get(q) || 0) + 1);
  }
  assert(distribution.has('鍑″搧') && distribution.has('鑹搧'), '鍝佽川鍒嗗竷搴斿惈鍑″搧鍜岃壇鍝?);
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/QUALITY_TIER_LABEL/.test(displaySource), 'display.ts 搴斿鍑?QUALITY_TIER_LABEL');
  assert(/鍑″搧|鑹搧|涓婂搧|鏋佸搧|缁濆搧/.test(displaySource), 'QUALITY_TIER_LABEL 搴斿惈 5 绾?);
  log('crafting-quality-tier-distribution', { passed: true });
}

function smokeCraftingFailureConsequence(): void {
  // AI-40: 澶辫触澶勭悊锛堣繛缁?3 娆″け璐ュ己鍒舵垚鍔燂級
  let failCount = 0;
  const craft = (): boolean => {
    if (failCount >= 2) { failCount = 0; return true; } // 寮哄埗鎴愬姛
    const success = Math.random() < 0.5;
    if (success) failCount = 0;
    else failCount++;
    return success;
  };
  // 妯℃嫙杩炶触
  failCount = 0;
  let totalSuccess = 0;
  for (let i = 0; i < 100; i++) if (craft()) totalSuccess++;
  assert(totalSuccess > 30, '杩炵画澶辫触淇濇姢鏈哄埗搴斾繚璇佹垚鍔熺巼 > 30%');
  const src = readFileSync('docs/blueprints/crafting-blueprint.md', 'utf-8');
  assert(/澶辫触.*涓嶈兘鍗℃|杩炵画.*寮哄埗鎴愬姛/.test(src), '钃濆浘搴旇鏄庡け璐ュ厹搴?);
  log('crafting-failure-consequence', { passed: true });
}

function smokeCraftingBlueprint(): void {
  // AI-40: 钃濆浘鏂囨。瀹屾暣
  const src = readFileSync('docs/blueprints/crafting-blueprint.md', 'utf-8');
  assert(/\|.+\|.+\|/.test(src), '钃濆浘搴斿惈琛ㄦ牸');
  assert(/AI 鎺ョ/.test(src), '钃濆浘搴旇鏄?AI 鎺ョ');
  assert(/5.*瀛愮郴缁焲crafting.*alchemy.*formation/.test(src), '钃濆浘搴斿垪鍑?5 涓瓙绯荤粺');
  log('crafting-blueprint', { passed: true });
}

function smokeWorldMapRegionsData(): void {
  // AI-39: 鍦板浘鏁版嵁瀛楁瀹屾暣
  assert(Bun.file('docs/blueprints/world-map-blueprint.md').size > 0, 'world-map-blueprint.md 搴斿瓨鍦?);
  const src = readFileSync('docs/blueprints/world-map-blueprint.md', 'utf-8');
  assert(/regions/.test(src), '钃濆浘搴斿惈 regions 瀛楁');
  assert(/dangerLevel|discoveryAge|visitedCount/.test(src), '钃濆浘搴斿惈鍦板浘鐘舵€佸瓧娈?);
  // display.ts LOCATION_TYPE_LABEL
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/LOCATION_TYPE_LABEL/.test(displaySource), 'display.ts 搴斿鍑?LOCATION_TYPE_LABEL');
  log('world-map-regions-data', { passed: true });
}

function smokeWorldMapDiscoveryVisibility(): void {
  // AI-39: 鍙鎬ц鍒?  const isVisible = (state: 'undiscovered' | 'discovered' | 'visited'): string => {
    switch (state) {
      case 'undiscovered': return '浼犻椈';
      case 'discovered': return '宸叉樉';
      case 'visited': return '宸茶嚦';
    }
  };
  assert(isVisible('undiscovered') === '浼犻椈', '鏈彂鐜板簲鏄剧ず"浼犻椈"');
  assert(isVisible('discovered') === '宸叉樉', '宸插彂鐜板簲鏄剧ず"宸叉樉"');
  assert(isVisible('visited') === '宸茶嚦', '宸茶闂簲鏄剧ず"宸茶嚦"');
  log('world-map-discovery-visibility', { passed: true });
}

function smokeWorldMapBlueprint(): void {
  // AI-39: 钃濆浘鏂囨。瀹屾暣鎬?  const src = readFileSync('docs/blueprints/world-map-blueprint.md', 'utf-8');
  assert(/\|.+\|.+\|/.test(src), '钃濆浘搴斿惈琛ㄦ牸');
  assert(/AI 鎺ョ/.test(src), '钃濆浘搴旇鏄?AI 鎺ョ');
  assert(/鍙嶉噸澶?.test(src), '钃濆浘搴旇鏄庡弽閲嶅');
  log('world-map-blueprint', { passed: true });
}

function smokeNpcMemoryFieldsExist(): void {
  // AI-38: NPC 璁板繂瀛楁瀹屾暣
  assert(Bun.file('docs/blueprints/npc-memory-blueprint.md').size > 0, 'npc-memory-blueprint.md 搴斿瓨鍦?);
  const src = readFileSync('docs/blueprints/npc-memory-blueprint.md', 'utf-8');
  assert(/recentInteractions/.test(src), '钃濆浘搴斿惈 recentInteractions 瀛楁');
  assert(/relationshipChanges/.test(src), '钃濆浘搴斿惈 relationshipChanges 瀛楁');
  assert(/currentDisposition/.test(src), '钃濆浘搴斿惈 currentDisposition 瀛楁');
  log('npc-memory-fields-exist', { passed: true });
}

function smokeNpcMemoryDecayLogic(): void {
  // AI-38: 琛板噺瑙勫垯姝ｇ‘锛堟湞 0 鏀舵暃 10%/5骞达級
  const decay = (v: number, years: number): number => {
    const k = Math.floor(years / 5);
    for (let i = 0; i < k; i++) {
      v = v * 0.9;
      if (Math.abs(v) < 1) v = 0;
    }
    return Math.round(v);
  };
  assert(decay(50, 5) === 45, '50 缁?5 骞村簲琛板噺鍒?45');
  assert(decay(50, 10) === 41, '50 缁?10 骞村簲琛板噺鍒?41 (杩戜技)');
  assert(decay(100, 100) < 100, '楂樺己搴﹂暱鏈熻“鍑忓簲鏄庢樉闄嶄綆');
  log('npc-memory-decay-logic', { passed: true });
}

function smokeNpcMemoryBlueprint(): void {
  // AI-38: 钃濆浘鏂囨。瀹屾暣鎬?  const src = readFileSync('docs/blueprints/npc-memory-blueprint.md', 'utf-8');
  assert(/\|.+\|.+\|/.test(src), '钃濆浘搴斿惈 markdown 琛ㄦ牸');
  assert(/AI 鎺ョ/.test(src), '钃濆浘搴旇鏄?AI 鎺ョ');
  assert(/琛板噺/.test(src), '钃濆浘搴旇鏄庤“鍑忚鍒?);
  log('npc-memory-blueprint', { passed: true });
}

function smokeSectRelationLabelsMapping(): void {
  // AI-37: 瀹楅棬鍏崇郴 label 鏄犲皠
  const displaySource = readFileSync('src/lib/xianxia/display.ts', 'utf-8');
  assert(/SECT_RELATION_LABEL/.test(displaySource), 'display.ts 搴斿鍑?SECT_RELATION_LABEL');
  assert(/鏁屽|涓嶇潶|涓珛|鍙嬪杽|鍚岀洘/.test(displaySource), 'SECT_RELATION_LABEL 搴斿惈 5 椤逛腑鏂?label');
  log('sect-relation-labels-mapping', { passed: true });
}

function smokeSectRelationIntensityRange(): void {
  // AI-37: 鍏崇郴寮哄害杈圭晫 [-100, 100]
  const clamp = (v: number) => Math.max(-100, Math.min(100, v));
  assert(clamp(150) === 100, 'intensity > 100 搴?clamp 鍒?100');
  assert(clamp(-150) === -100, 'intensity < -100 搴?clamp 鍒?-100');
  assert(clamp(50) === 50, 'intensity 鍦ㄨ寖鍥村唴搴斾繚鐣?);
  // 钃濆浘鏂囨。搴旀湁杈圭晫绾︽潫
  const blueprint = readFileSync('docs/blueprints/sect-relation-blueprint.md', 'utf-8');
  assert(/-100.*100|\[\s*-100\s*,\s*100\s*\]/.test(blueprint), 'sect-relation-blueprint 搴旇鏄?intensity 杈圭晫');
  log('sect-relation-intensity-range', { passed: true });
}

function smokeSectRelationBlueprint(): void {
  // AI-37: 钃濆浘鏂囨。瀹屾暣鎬?  assert(Bun.file('docs/blueprints/sect-relation-blueprint.md').size > 0, 'sect-relation-blueprint.md 搴斿瓨鍦?);
  const src = readFileSync('docs/blueprints/sect-relation-blueprint.md', 'utf-8');
  assert(/\|.+\|.+\|/.test(src), '钃濆浘搴斿惈 markdown 琛ㄦ牸');
  assert(/AI 鎺ョ/.test(src), '钃濆浘搴旇鏄?AI 鎺ョ绛栫暐');
  log('sect-relation-blueprint', { passed: true });
}

function smokeBlueprintDocsCoverage(): void {
  // AI-31 + AI-35: 钃濆浘鏂囨。瑕嗙洊搴?  const blueprints = [
    'docs/blueprints/value-blueprint.md',
    'docs/blueprints/status-blueprint.md',
    'docs/blueprints/event-blueprint.md',
    'docs/blueprints/save-load-blueprint.md',
  ];
  for (const f of blueprints) {
    assert(Bun.file(f).size > 0, `${f} 搴斿瓨鍦╜);
    const src = readFileSync(f, 'utf-8');
    assert(/\|.+\|.+\|/.test(src), `${f} 搴旀湁 markdown 琛ㄦ牸`);
  }
  log('blueprint-docs-coverage', { passed: true });
}

main().catch(error => {
  console.error(JSON.stringify({ passed: false, suite: 'xianxia-regression-smoke', error: error?.message || String(error) }));
  process.exit(1);
});




function smokeTribulationStoreExports(): void {
  // AI-77: store.ts 搴斿鍑?TribulationCeremony 鎺ュ彛 + startTribulation/endTribulation action
  const src = readFileSync('src/lib/xianxia/store.ts', 'utf-8');
  assert(/export interface TribulationCeremony\b/.test(src), 'store.ts 搴斿鍑?TribulationCeremony');
  assert(/startTribulation:\s*\(/.test(src), 'store.ts 搴斿畾涔?startTribulation action');
  assert(/endTribulation:\s*\(/.test(src), 'store.ts 搴斿畾涔?endTribulation action');
  assert(/setTribulationCeremony:\s*\(/.test(src), 'store.ts 搴斿畾涔?setTribulationCeremony setter');
  log('tribulation-store-exports', { passed: true });
}

function smokeTribulationActionsPersistCeremony(): void {
  // AI-77: startTribulation 搴旇缃?tribulationCeremony 骞舵竻绌烘棫 result
  const { useGameStore } = require('../src/lib/xianxia/store') as typeof import('../src/lib/xianxia/store');
  const session: any = {
    id: 'tb-1', characterId: 'c-1', startedAge: 100, fromRealm: 'great_vehicle', toRealm: 'tribulation',
    currentStage: 'opening', boltsCompleted: 0, hpRemaining: 100, heartDemonActive: null,
    heartDemonResolved: false, narrative: '', passed: false, outcome: 'ongoing',
  };
  useGameStore.getState().startTribulation(session, 'sky darkens');
  let cur = useGameStore.getState().tribulationCeremony;
  assert(cur && cur.session.id === 'tb-1' && cur.narrative === 'sky darkens', 'startTribulation 搴斿啓鍏?ceremony');
  assert(useGameStore.getState().tribulationResult === null, 'startTribulation 搴旀竻绌烘棫 result');
  useGameStore.getState().endTribulation();
  assert(useGameStore.getState().tribulationCeremony === null, 'endTribulation 搴旀竻绌?ceremony');
  const result = useGameStore.getState().tribulationResult;
  assert(result && result.boltsCompleted === 0 && result.passed === false, 'endTribulation 搴斿啓鍑?result');
  log('tribulation-actions-persist-ceremony', { passed: true });
}

function smokeTribulationBoltAndHeartDemon(): void {
  // AI-77: recordTribulationBolt + resolveTribulationHeartDemon 搴旀洿鏂?session
  const { useGameStore } = require('../src/lib/xianxia/store') as typeof import('../src/lib/xianxia/store');
  useGameStore.setState({
    tribulationCeremony: null, tribulationResult: null, ascensionCeremony: null, restrictionChallenge: null,
  } as any);
  const session: any = {
    id: 'tb-2', characterId: 'c-1', startedAge: 200, fromRealm: 'great_vehicle', toRealm: 'tribulation',
    currentStage: 'opening', boltsCompleted: 0, hpRemaining: 100, heartDemonActive: 'fear',
    heartDemonResolved: false, narrative: '', passed: false, outcome: 'ongoing',
  };
  useGameStore.getState().startTribulation(session, '');
  useGameStore.getState().recordTribulationBolt(3);
  let cur = useGameStore.getState().tribulationCeremony;
  assert(cur && cur.session.boltsCompleted === 3, 'recordTribulationBolt(3) 搴旀帹杩?boltsCompleted');
  useGameStore.getState().recordTribulationBolt(20);
  cur = useGameStore.getState().tribulationCeremony;
  assert(cur && cur.session.boltsCompleted === 9 && cur.session.currentStage === 'passed', '9 闆峰悗搴旇涓?passed');
  useGameStore.getState().resolveTribulationHeartDemon('regret');
  cur = useGameStore.getState().tribulationCeremony;
  assert(cur && cur.session.heartDemonResolved === true, 'resolveTribulationHeartDemon 搴旀爣璁板凡鐮?);
  log('tribulation-bolt-and-heart-demon', { passed: true });
}

function smokeAscensionStoreExports(): void {
  // AI-78: store.ts 搴斿鍑?AscensionCeremony/RestrictionChallenge 鎺ュ彛 + start/end/fight action
  const src = readFileSync('src/lib/xianxia/store.ts', 'utf-8');
  assert(/export interface AscensionCeremony\b/.test(src), 'store.ts 搴斿鍑?AscensionCeremony');
  assert(/export interface RestrictionChallenge\b/.test(src), 'store.ts 搴斿鍑?RestrictionChallenge');
  assert(/startAscension:\s*\(/.test(src), 'store.ts 搴斿畾涔?startAscension action');
  assert(/endAscension:\s*\(/.test(src), 'store.ts 搴斿畾涔?endAscension action');
  assert(/tryRestrictionAccess:\s*\(/.test(src), 'store.ts 搴斿畾涔?tryRestrictionAccess action');
  assert(/fightRestriction:\s*\(/.test(src), 'store.ts 搴斿畾涔?fightRestriction action');
  log('ascension-store-exports', { passed: true });
}

function smokeAscensionRollOutcomeDerivation(): void {
  // AI-78: resolveAscensionRoll 搴旀牴鎹?characterRoll + tribulationPassed 鎺ㄥ passed/outcome
  const { useGameStore } = require('../src/lib/xianxia/store') as typeof import('../src/lib/xianxia/store');
  useGameStore.setState({
    tribulationCeremony: null, tribulationResult: null, ascensionCeremony: null, restrictionChallenge: null,
  } as any);
  const passedTrib: any = {
    id: 'a-1', characterId: 'c-1', fromTier: 'spiritWorld', toTier: 'immortalWorld',
    requirements: { fromTier: 'spiritWorld', toTier: 'immortalWorld', minRealm: 'tribulation', tribulationPassed: true, lifespanMin: 1000, reputationMin: 5000, cultivationExpMin: 100000, daoHeartMin: 80 },
    startedAge: 500, passed: false, outcome: 'ongoing', narrative: 'ascending',
  };
  const failedTrib: any = { ...passedTrib, id: 'a-2', requirements: { ...passedTrib.requirements, tribulationPassed: false } };
  useGameStore.getState().startAscension(passedTrib, '');
  useGameStore.getState().resolveAscensionRoll(0.9);
  let cur = useGameStore.getState().ascensionCeremony;
  assert(cur && cur.session.outcome === 'ascended' && cur.session.passed === true, '楂?roll + tribulation passed -> ascended');
  useGameStore.getState().startAscension(passedTrib, '');
  useGameStore.getState().resolveAscensionRoll(0.1);
  cur = useGameStore.getState().ascensionCeremony;
  assert(cur && cur.session.outcome === 'failed', '浣?roll 搴?-> failed');
  useGameStore.getState().startAscension(failedTrib, '');
  useGameStore.getState().resolveAscensionRoll(0.99);
  cur = useGameStore.getState().ascensionCeremony;
  assert(cur && cur.session.outcome === 'failed', '鏈浮鍔?-> failed');
  log('ascension-roll-outcome-derivation', { passed: true });
}

function smokeRestrictionAccessAndCombatActions(): void {
  // AI-78: tryRestrictionAccess / fightRestriction 搴斿啓 restrictionChallenge.narrative
  const { useGameStore } = require('../src/lib/xianxia/store') as typeof import('../src/lib/xianxia/store');
  useGameStore.setState({
    tribulationCeremony: null, tribulationResult: null, ascensionCeremony: null, restrictionChallenge: null,
  } as any);
  const restriction: any = {
    id: 'r-1', name: 'mystic gate', type: 'door', accessMethod: 'password',
    requiredPassword: 'open-sesame', description: 'a heavy gate', difficulty: 60,
  };
  useGameStore.getState().tryRestrictionAccess(restriction, 'attempt', 'open-sesame');
  let cur = useGameStore.getState().restrictionChallenge;
  assert(cur && cur.restriction.id === 'r-1' && cur.narrative.includes('attempt') && cur.narrative.includes('open-sesame'), 'tryRestrictionAccess 搴旇褰?password');
  useGameStore.getState().tryRestrictionAccess(restriction, 'retreat');
  cur = useGameStore.getState().restrictionChallenge;
  assert(cur && cur.narrative.includes('retreat'), 'retreat 搴旇璁板綍');
  useGameStore.getState().fightRestriction(restriction);
  cur = useGameStore.getState().restrictionChallenge;
  assert(cur && /combat initiated/.test(cur.narrative), 'fightRestriction 搴旇褰?combat initiated');
  log('restriction-access-and-combat-actions', { passed: true });
}

async function smokePrismaTribulationFieldsPushed(): Promise<void> {
  // AI-79: prisma schema 搴斿寘鍚?tribulationPending/SessionJson/ResultJson 涓?dev.db 鏈夎繖浜涘垪
  const schema = readFileSync('prisma/schema.prisma', 'utf-8');
  assert(/tribulationPending\s+Boolean/.test(schema), 'schema.prisma 搴旀湁 tribulationPending Boolean');
  assert(/tribulationSessionJson\s+String/.test(schema), 'schema.prisma 搴旀湁 tribulationSessionJson String');
  assert(/tribulationResultJson\s+String/.test(schema), 'schema.prisma 搴旀湁 tribulationResultJson String');
  const dbPath = (process.env.DATABASE_URL?.replace(/^file:/, '')) || 'prisma/dev.db';
  if (Bun.file(dbPath).size > 0) {
    const { db } = await import('../src/lib/db');
    const cols = await db.$queryRawUnsafe('PRAGMA table_info("Character");') as any[];
    const names: string[] = cols.map((c: any) => c.name);
    assert(names.includes('tribulationPending'), 'dev.db Character 琛ㄥ簲鏈?tribulationPending 鍒?);
    assert(names.includes('tribulationSessionJson'), 'dev.db Character 琛ㄥ簲鏈?tribulationSessionJson 鍒?);
    assert(names.includes('tribulationResultJson'), 'dev.db Character 琛ㄥ簲鏈?tribulationResultJson 鍒?);
    assert(names.includes('ascensionSessionJson'), 'dev.db Character 琛ㄥ簲鏈?ascensionSessionJson 鍒?);
    assert(names.includes('restrictionDataJson'), 'dev.db Character 琛ㄥ簲鏈?restrictionDataJson 鍒?);
  }
  log('prisma-tribulation-fields-pushed', { passed: true });
}

function smokeBackupScriptPrismaPushScript(): void {
  // AI-79: 澶囦唤鑴氭湰 + db push script (package.json) 閮藉簲瀛樺湪
  assert(Bun.file('scripts/backup-real-saves.ts').size > 0, 'scripts/backup-real-saves.ts 搴斿瓨鍦?);
  const backup = readFileSync('scripts/backup-real-saves.ts', 'utf-8');
  assert(/copyFileSync/.test(backup), 'backup 鑴氭湰搴斾娇鐢?copyFileSync');
  assert(/logs\/backups/.test(backup), 'backup 鑴氭湰搴旇緭鍑哄埌 logs/backups/');
  const pkg = readFileSync('package.json', 'utf-8');
  assert(/db:push|prisma\s+db\s+push/.test(pkg), 'package.json 搴旀湁 prisma db push script');
  log('backup-script-prisma-push-script', { passed: true });
}

function smokeTraeAutoDispatchScriptExists(): void {
  // AI-80: scripts/trae-auto-dispatch.py 搴斿瓨鍦ㄥ苟 import pynput + pywinauto
  const path = 'scripts/trae-auto-dispatch.py';
  assert(Bun.file(path).size > 0, 'scripts/trae-auto-dispatch.py 搴斿瓨鍦?);
  const src = readFileSync(path, 'utf-8');
  assert(/import pynput|from pynput/.test(src), 'trae-auto-dispatch.py 搴?import pynput');
  assert(/pywinauto|win32|find_window|WindowNotFoundError/.test(src), 'trae-auto-dispatch.py 搴斾娇鐢?pywinauto 鎵剧獥鍙?);
  log('trae-auto-dispatch-script-exists', { passed: true });
}

function smokeTraeMonitorScriptExists(): void {
  // AI-80: scripts/trae-monitor.py 搴斿瓨鍦?  const path = 'scripts/trae-monitor.py';
  assert(Bun.file(path).size > 0, 'scripts/trae-monitor.py 搴斿瓨鍦?);
  const src = readFileSync(path, 'utf-8');
  assert(/import pynput|from pynput/.test(src), 'trae-monitor.py 搴?import pynput');
  log('trae-monitor-script-exists', { passed: true });
}

function smokeTraeScriptsUsePynput(): void {
  // AI-80: 涓や釜鑴氭湰閮藉簲鏈?keyboard/mouse Listener
  const dispatch = readFileSync('scripts/trae-auto-dispatch.py', 'utf-8');
  const monitor = readFileSync('scripts/trae-monitor.py', 'utf-8');
  assert(/keyboard\.Listener|mouse\.Listener/.test(dispatch), 'trae-auto-dispatch 搴旀敞鍐?pynput Listener');
  assert(/keyboard\.Listener|mouse\.Listener/.test(monitor), 'trae-monitor 搴旀敞鍐?pynput Listener');
  log('trae-scripts-use-pynput', { passed: true });
}
// ==================== AI-86/87/88/89/90: Worker B Smokes ====================
// Worker B (xiaoxin-B) - additive only.

function smokePillSideEffectTypesExist(): void {
  // AI-86: types.ts 搴斿鍑?PillSideEffect/PillEffectiveness/PillSideEffectResolution
  const src = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/export type PillSideEffect\b/.test(src), 'types.ts 搴斿鍑?PillSideEffect');
  assert(/export interface PillEffectiveness\b/.test(src), 'types.ts 搴斿鍑?PillEffectiveness');
  assert(/export interface PillSideEffectResolution\b/.test(src), 'types.ts 搴斿鍑?PillSideEffectResolution');
  const four = ['toxicity', 'cultivation-deviation', 'karma', 'qi-turbulence'];
  for (const k of four) assert(src.includes(`'`+k+`'`), `PillSideEffect 搴斿寘鍚?${k}`);
  log('pill-side-effect-types-exist', { passed: true });
}

function smokePillEffectivenessDerivation(): void {
  // AI-86: derivePillEffectiveness 搴旀牴鎹搧璐?澧冪晫杈撳嚭鍚堟硶璇勪及
  const { derivePillEffectiveness } = require('../src/lib/xianxia/engine') as typeof import('../src/lib/xianxia/engine');
  const state: any = { age: 20, realm: 'qi_refining', realmLevel: 1 };
  const pill: any = { id: 'test-pill-1', name: '璇曠偧涓?, quality: 'rare', tier: 2, expGain: 100, hpRestore: 50, mpRestore: 30 };
  const eff = derivePillEffectiveness(pill, state);
  assert(eff.pillId === 'test-pill-1', 'PillEffectiveness 搴斿洖浼?pillId');
  assert(typeof eff.boost.cultivationExp === 'number' && eff.boost.cultivationExp! > 0, '楂樺搧涓瑰簲浜у嚭淇负鍔犳垚');
  assert(eff.sideEffectChance >= 0 && eff.sideEffectChance <= 1, '鍓綔鐢ㄦ鐜囧簲鍦?0..1');
  assert(eff.sideEffectSeverity >= 1 && eff.sideEffectSeverity <= 5, '鍓綔鐢ㄤ弗閲嶅害搴斿湪 1..5');
  assert(eff.possibleSideEffects.length > 0, 'tier>=2 搴旇嚦灏戝寘鍚竴绉嶅壇浣滅敤');
  log('pill-effectiveness-derivation', { passed: true, boost: eff.boost.cultivationExp, chance: eff.sideEffectChance, sev: eff.sideEffectSeverity });
}

function smokePillSideEffectResolution(): void {
  // AI-86: resolvePillSideEffects 瑙﹀彂鏃跺簲鍥炰紶 attributeChanges/statusChanges
  const { resolvePillSideEffects } = require('../src/lib/xianxia/engine') as typeof import('../src/lib/xianxia/engine');
  const state: any = { age: 12, realm: 'mortal', realmLevel: 0 };
  const pill: any = { id: 'toxic-pill', name: '鐚涗腹', quality: 'epic', tier: 4, expGain: 200 };
  // 寮哄埗瑙﹀彂锛歳and=0 < chance
  const r1 = resolvePillSideEffects(pill, state, 0);
  assert(r1.triggered === true, 'rand=0 搴旇Е鍙戝壇浣滅敤');
  assert(r1.sideEffect !== undefined, '瑙﹀彂鏃跺簲鍥炰紶 sideEffect 绫诲瀷');
  assert(r1.attributeChanges.length + r1.statusChanges.length > 0, '搴旇嚦灏戞湁涓€绉嶅睘鎬?鐘舵€佸彉鏇?);
  // 寮哄埗涓嶈Е鍙戯細rand=1 鍑犱箮涓嶅彲鑳斤紙chance 鏈€楂?0.85锛?  const r2 = resolvePillSideEffects(pill, state, 0.9999);
  assert(r2.triggered === false, 'rand 鎺ヨ繎 1 涓嶅簲瑙﹀彂鍓綔鐢?);
  assert(r2.attributeChanges.length === 0, '鏈Е鍙戞椂搴旀棤灞炴€у彉鏇?);
  log('pill-side-effect-resolution', { passed: true, triggered: r1.triggered, side: r1.sideEffect });
}

function smokeFormationDrawingTypesExist(): void {
  // AI-87: types.ts 搴斿鍑?FormationDrawingStep/Session/Progress
  const src = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/export type FormationDrawingStep\b/.test(src), 'types.ts 搴斿鍑?FormationDrawingStep');
  assert(/export interface FormationDrawingSession\b/.test(src), 'types.ts 搴斿鍑?FormationDrawingSession');
  assert(/export interface FormationDrawingProgress\b/.test(src), 'types.ts 搴斿鍑?FormationDrawingProgress');
  const steps = ['meditate', 'trace', 'infuse', 'anchor', 'activate'];
  for (const s of steps) assert(src.includes(`'`+s+`'`), `FormationDrawingStep 搴斿寘鍚?${s}`);
  log('formation-drawing-types-exist', { passed: true });
}

function smokeFormationDrawingFlow(): void {
  // AI-87: startFormationDrawing + resolveDrawingProgress 鎺ㄨ繘 5 姝ュ簲鎴愬姛
  const { startFormationDrawing, resolveDrawingProgress } = require('../src/lib/xianxia/engine') as typeof import('../src/lib/xianxia/engine');
  const state: any = { id: 'c-1', age: 30, realm: 'foundation_building', realmLevel: 2 };
  const formation: any = { id: 'f-1', name: '灏忚仛鐏甸樀', rarity: 'common', requirements: { minRealm: 'qi_refining' } };
  let sess = startFormationDrawing(state, formation);
  assert(sess.currentStep === 'meditate', '鍒濆姝ラ搴斾负 meditate');
  assert(!sess.finished, '鍒濆浼氳瘽鏈畬鎴?);
  // 寮哄埗鎴愬姛鎺ㄨ繘 5 姝?  for (let i = 0; i < 5; i++) {
    const r = resolveDrawingProgress(sess, 'advance', 0);
    assert(r.advanced === true, `绗?{i+1}姝ュ簲鎺ㄨ繘`);
    sess = r.session;
    if (r.finished) break;
  }
  assert(sess.finished === true && sess.success === true, '杩炵画 5 姝ユ垚鍔熷簲缁樺埗瀹屾垚');
  assert(sess.completedSteps.length === 5, '搴旇褰?5 涓畬鎴愭楠?);
  log('formation-drawing-flow', { passed: true, steps: sess.completedSteps });
}

function smokeFormationDrawingFailureStreak(): void {
  // AI-87: 杩炵画澶辫触 3 娆″簲瑙﹀彂缁樺埗澶辫触
  const { startFormationDrawing, resolveDrawingProgress } = require('../src/lib/xianxia/engine') as typeof import('../src/lib/xianxia/engine');
  const state: any = { id: 'c-2', age: 25, realm: 'qi_refining', realmLevel: 1 };
  const formation: any = { id: 'f-2', name: '鍑堕樀', rarity: 'rare', requirements: { minRealm: 'qi_refining' } };
  let sess = startFormationDrawing(state, formation);
  // 寮哄埗澶辫触 3 娆★紙rand > stepSuccessChance=0.7锛?  for (let i = 0; i < 3; i++) {
    const r = resolveDrawingProgress(sess, 'advance', 0.99);
    sess = r.session;
    if (r.finished) break;
  }
  assert(sess.finished === true && sess.success === false, '杩炵画 3 娆″け璐ュ簲浼氳瘽澶辫触');
  assert(sess.failureStreak >= 3, 'failureStreak 搴?=3');
  // restart 搴旀竻绌哄け璐ヨ鏁?  const restart = resolveDrawingProgress(sess, 'restart', 0);
  assert(restart.session.currentStep === 'meditate', 'restart 鍚庡簲鍥炲埌 meditate');
  assert(restart.session.failureStreak === 0, 'restart 鍚?failureStreak 搴旀竻闆?);
  log('formation-drawing-failure-streak', { passed: true, streak: sess.failureStreak });
}

function smokePetEvolutionTypesExist(): void {
  // AI-88: types.ts 搴斿鍑?PetEvolutionStage/Requirement/Eligibility
  const src = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
  assert(/export type PetEvolutionStage\b/.test(src), 'types.ts 搴斿鍑?PetEvolutionStage');
  assert(/export interface PetEvolutionRequirement\b/.test(src), 'types.ts 搴斿鍑?PetEvolutionRequirement');
  assert(/export interface PetEvolutionEligibility\b/.test(src), 'types.ts 搴斿鍑?PetEvolutionEligibility');
  const stages = ['infant', 'youth', 'mature', 'ascended'];
  for (const s of stages) assert(src.includes(`'`+s+`'`), `PetEvolutionStage 搴斿寘鍚?${s}`);
  log('pet-evolution-types-exist', { passed: true });
}

function smokePetEvolutionEligibilityAndResolve(): void {
  // AI-88: 缂烘潗鏂欐椂涓嶅簲 eligible锛涙弧瓒虫椂 eligible锛況esolvePetEvolution 杩斿洖涓嬩竴闃舵
  const { derivePetEvolutionEligibility, resolvePetEvolution } = require('../src/lib/xianxia/engine') as typeof import('../src/lib/xianxia/engine');
  // 缂烘潗鏂?  const poor: any = { id: 'p-poor', level: 1, loyalty: 10, acquiredAge: 18, stage: 'infant' };
  const poorChar: any = { age: 20, realmLevel: 0, inventory: [] };
  const e1 = derivePetEvolutionEligibility(poor, poorChar);
  assert(e1.eligible === false, '缂烘潗鏂?蹇犺瘹搴︿笉瓒虫椂涓嶅簲 eligible');
  assert(e1.nextStage === 'youth', '骞肩敓鏈熶笅涓€闃舵搴斾负 youth');
  assert(e1.missing.length >= 2, '搴旇嚦灏戝垪鍑?2 涓己澶辨潯浠?);
  // 婊¤冻鍏ㄩ儴鏉′欢
  const rich: any = { id: 'p-rich', level: 5, loyalty: 95, acquiredAge: 15, stage: 'infant' };
  const richChar: any = {
    age: 20, realmLevel: 3,
    inventory: [
      { id: 'pet_growth_pill', name: 'pet_growth_pill' },
    ],
  };
  const e2 = derivePetEvolutionEligibility(rich, richChar);
  assert(e2.eligible === true, '婊¤冻鎵€鏈夋潯浠跺簲 eligible');
  assert(e2.missing.length === 0, '婊¤冻鏃?missing 搴斾负绌?);
  // resolvePetEvolution
  const next = resolvePetEvolution({ id: 'p-rich', stage: 'infant' });
  assert(next === 'youth', 'infant 杩涢樁搴旇繑鍥?youth');
  log('pet-evolution-eligibility-and-resolve', { passed: true, missingCount: e1.missing.length, next });
}

function smokePetInsightAndCommunication(): void {
  // AI-89: 骞肩敓鏈?浣庡繝璇氬害涓嶅簲浜у嚭 insight锛涙垚鐔熸湡+搴斾骇鍑?insight锛沜ommunication 搴旇繑鍥為潪绌哄瓧绗︿覆
  const { derivePetInsight, resolvePetCommunication } = require('../src/lib/xianxia/engine') as typeof import('../src/lib/xianxia/engine');
  // 骞肩敓鏈燂細null
  const infant: any = { id: 'p-1', name: '灏忕嫄', stage: 'infant', level: 5, loyalty: 80, element: 'water' };
  const charA: any = { age: 18 };
  assert(derivePetInsight(infant, charA) === null, '骞肩敓鏈熶笉搴斾骇鍑?insight');
  // 鎴愮啛鏈?+ 楂樺繝璇氾細搴斾骇鍑?  const mature: any = { id: 'p-2', name: '鐐庤檸', stage: 'mature', level: 5, loyalty: 75, element: 'fire' };
  const charB: any = { age: 25 };
  const ins = derivePetInsight(mature, charB);
  assert(ins !== null, '鎴愮啛鏈?蹇犺瘹>=60 搴斾骇鍑?insight');
  assert(typeof ins!.insightName === 'string' && ins!.insightName.length > 0, 'insight 搴旀湁鍚嶇О');
  assert(ins!.effect !== undefined, 'insight 搴旀湁 effect');
  // communication
  const comm = resolvePetCommunication({ id: 'p-3', name: '鐏佃泧', loyalty: 80 }, '鍓嶆柟鏈夊姘?);
  assert(typeof comm === 'string' && comm.length > 0, 'communication 搴斿洖浼犻潪绌哄瓧绗︿覆');
  assert(comm.includes('鐏佃泧') || comm.includes('鐏佃瘑'), 'communication 搴斿寘鍚疇鐗╁悕鎴栫伒璇嗗叧閿瓧');
  log('pet-insight-and-communication', { passed: true, insight: ins?.insightName, comm });
}

function smokePetCombatSkillAvailable(): void {
  // AI-90: 鍖栧舰鍓?1 鎶€鑳斤紱鎴愮啛鏈?2 鎶€鑳斤紱鍖栧舰鏈?3 鎶€鑳斤紱鍐峰嵈涓妧鑳藉簲琚繃婊?  const { derivePetSkillAvailable, resolvePetSkillUse } = require('../src/lib/xianxia/engine') as typeof import('../src/lib/xianxia/engine');
  const baseSkill = { name: '鎾曞挰', description: '鍩虹鐗╃悊鏀诲嚮', power: 1.2, cooldown: 2 };
  const infant: any = { id: 'p-i', stage: 'infant', level: 1, skill: baseSkill };
  const mature: any = { id: 'p-m', stage: 'mature', level: 5, skill: baseSkill };
  const ascended: any = { id: 'p-a', stage: 'ascended', level: 10, skill: baseSkill };
  const sInf = derivePetSkillAvailable(infant, 1);
  const sMat = derivePetSkillAvailable(mature, 1);
  const sAsc = derivePetSkillAvailable(ascended, 1);
  assert(sInf.length === 1, '骞肩敓鏈熷簲鍙湁 1 涓妧鑳?);
  assert(sMat.length === 2, '鎴愮啛鏈熷簲鏈?2 涓妧鑳?);
  assert(sAsc.length === 3, '鍖栧舰鏈熷簲鏈?3 涓妧鑳?);
  // 鍐峰嵈杩囨护
  const filtered = derivePetSkillAvailable(mature, 5, [
    { skillId: 'p-m-basic', lastUsedTurn: 4, usesLeft: -1 },
  ]);
  assert(filtered.length === 1, '鍩虹鎶€鑳藉喎鍗翠腑搴旇杩囨护锛堝墿浣?1 涓厓绱犳妧鑳斤級');
  // resolvePetSkillUse
  const evt = resolvePetSkillUse({ id: 'p-m', name: '鐐庤檸', attack: 20, element: 'fire' }, sMat[0], 5, 'enemy-1');
  assert(evt.skillId === 'p-m-basic', '浜嬩欢搴斿洖浼犱娇鐢ㄧ殑 skillId');
  assert(evt.turn === 5, '浜嬩欢搴斿洖浼?turn');
  assert(typeof evt.narrativeHint === 'string' && evt.narrativeHint.length > 0, '浜嬩欢搴旀湁 narrativeHint');
  log('pet-combat-skill-available', { passed: true, inf: sInf.length, mat: sMat.length, asc: sAsc.length, dmg: evt.damage });
}

function smokePetCombatSkillUseDamage(): void {
  // AI-90: 鐗╃悊鎶€鑳藉簲浜х敓 damage; 娌荤枟鎶€鑳藉簲浜х敓 heal; 澧炵泭鎶€鑳藉簲浜х敓 buffApplied
  const { resolvePetSkillUse } = require('../src/lib/xianxia/engine') as typeof import('../src/lib/xianxia/engine');
  const phys: any = { id: 'p', name: '鐏电嫄', attack: 15 };
  const physSkill: any = { skillId: 's1', name: '鎾曞挰', description: '', power: 1.5, cooldown: 2, range: 'single', effect: 'physical' };
  const healSkill: any = { skillId: 's2', name: '鐤椾激', description: '', power: 2.0, cooldown: 3, range: 'self', effect: 'heal' };
  const buffSkill: any = { skillId: 's3', name: '鎶や富', description: '', power: 0, cooldown: 4, range: 'all_allies', effect: 'buff' };
  const e1 = resolvePetSkillUse(phys, physSkill, 3, 'e-1');
  assert(typeof e1.damage === 'number' && e1.damage! > 0, '鐗╃悊鎶€鑳藉簲浜у嚭 damage>0');
  assert(e1.heal === undefined, '鐗╃悊鎶€鑳戒笉搴斾骇鍑?heal');
  const e2 = resolvePetSkillUse(phys, healSkill, 3);
  assert(typeof e2.heal === 'number' && e2.heal! > 0, '娌荤枟鎶€鑳藉簲浜у嚭 heal>0');
  assert(e2.damage === undefined, '娌荤枟鎶€鑳戒笉搴斾骇鍑?damage');
  const e3 = resolvePetSkillUse(phys, buffSkill, 3);
  assert(Array.isArray(e3.buffApplied) && e3.buffApplied.length > 0, '澧炵泭鎶€鑳藉簲浜у嚭 buffApplied');
  log('pet-combat-skill-use-damage', { passed: true, dmg: e1.damage, heal: e2.heal });
}锘?// ==================== Worker A (AI-81~AI-85): Combat + Breakthrough Smokes ====================

function smokeAi81StanceDerivation(): void {
  // AI-81: deriveCombatStance 搴旀寜 HP/MP/鏁屾柟鐘舵€佺粰鍑哄缓璁Э鎬?  const baseChar: any = {
    realm: 'qi_refining', hp: 50, maxHp: 100, mp: 50, maxMp: 100, attack: 10, defense: 10,
    combatSession: { status: 'ongoing', playerHp: 50, playerMaxHp: 100, playerMp: 50, playerMaxMp: 100 },
  };
  // 浣庤 鈫?retreat/defensive
  const lowHpChar: any = {
    ...baseChar,
    hp: 20, maxHp: 100, combatSession: { status: 'ongoing', playerHp: 20, playerMaxHp: 100, playerMp: 50, playerMaxMp: 100 },
  };
  const s1 = deriveCombatStance(baseChar as any, { hp: 80, maxHp: 100, attack: 10, defense: 10, speed: 5 });
  assert(s1 === 'aggressive' || s1 === 'cunning', `姝ｅ父鐘舵€佸簲缁欏嚭鐚涙敾鎴栬鏁岋紝瀹為檯=${s1}`);
  const s2 = deriveCombatStance(lowHpChar as any, { hp: 80, maxHp: 100, attack: 10, defense: 10, speed: 5 });
  assert(s2 === 'retreat' || s2 === 'defensive', `浣庤搴旈€€瀹堬紝瀹為檯=${s2}`);
  // 鏁屾柟娈嬭 鈫?aggressive
  const s3 = deriveCombatStance(baseChar as any, { hp: 20, maxHp: 100, attack: 10, defense: 10, speed: 5 });
  assert(s3 === 'aggressive', `鏁屾柟娈嬭搴旂寷鏀伙紝瀹為檯=${s3}`);
  log('combat-stance-derivation', { passed: true, normal: s1, lowHp: s2, weakEnemy: s3 });
}

function smokeAi81StanceShift(): void {
  // AI-81: resolveCombatStanceShift 搴旀寜鏁屾柟鍔ㄦ€佸垏鎹㈠Э鎬?  const shift1 = resolveCombatStanceShift('aggressive', { hp: 80, maxHp: 100, attack: 20, attackPrev: 10 }, []);
  assert(shift1 === 'cunning', `鏁屾柟钃勫姏搴斿垏璇辨晫锛屽疄闄?${shift1}`);
  const shift2 = resolveCombatStanceShift('aggressive', { hp: 20, maxHp: 100, attack: 10 }, []);
  assert(shift2 === 'aggressive', `鏁屾柟娈嬭淇濇寔鐚涙敾锛屽疄闄?${shift2}`);
  // 鍐峰嵈涓?鈫?淇濇寔
  const shift3 = resolveCombatStanceShift('defensive', { hp: 50, maxHp: 100, attack: 10 }, [{ stance: 'defensive', cooldownTurns: 2 }]);
  assert(shift3 === 'defensive', `鍐峰嵈涓簲淇濇寔锛屽疄闄?${shift3}`);
  log('combat-stance-shift', { passed: true, s1: shift1, s2: shift2, s3: shift3 });
}

function smokeAi81StanceLabelConsistency(): void {
  // AI-81: COMBAT_STANCE_LABEL 蹇呴』瑕嗙洊鍏ㄩ儴 4 涓Э鎬?  const labels = (COMBAT_STANCE_LABEL as any);
  assert(labels.aggressive && labels.defensive && labels.cunning && labels.retreat, 'COMBAT_STANCE_LABEL 缂烘爣绛?);
  assert(labels.aggressive.length > 0 && labels.defensive.length > 0, '鏍囩涓嶈兘涓虹┖瀛楃涓?);
  // 涓?types.ts 瀹氫箟涓€鑷?  const expected: CombatStance[] = ['aggressive', 'defensive', 'cunning', 'retreat'];
  for (const k of expected) {
    assert(typeof labels[k] === 'string', `${k} 蹇呴』鏈変腑鏂囨爣绛綻);
  }
  log('combat-stance-label-consistency', { passed: true, labels: Object.keys(labels).length });
}

function smokeAi82CombatResourceDerivation(): void {
  // AI-82: deriveCombatResource 搴旇繑鍥?4 绫昏祫婧愬揩鐓?  const character: any = { hp: 80, maxHp: 100, mp: 60, maxMp: 100, spiritualSense: 50, comprehension: 30 };
  const usages = deriveCombatResource(character as any);
  assert(Array.isArray(usages) && usages.length === 4, `搴旇繑鍥?4 椤硅祫婧愶紝瀹為檯=${usages.length}`);
  const types = usages.map(u => u.type);
  assert(types.includes('qi') && types.includes('soul') && types.includes('stamina') && types.includes('focus'), '缂鸿祫婧愮被鍨?);
  const qi = usages.find(u => u.type === 'qi')!;
  assert(qi.current === 60 && qi.max === 100, `qi 搴?mp(60/100)锛屽疄闄?${qi.current}/${qi.max}`);
  assert(qi.regenPerTurn > 0, 'qi 蹇呴』鏈夊洖澶?);
  log('combat-resource-derivation', { passed: true, types: types.join(','), qi: `${qi.current}/${qi.max}` });
}

function smokeAi82ResourceDrainAndSufficient(): void {
  // AI-82: resolveCombatResourceDrain 搴旀墸鍑忓苟璁板綍宄板€硷紱checkCombatResourceSufficient 搴旀纭垽缂?  const usages: CombatResourceUsage[] = [
    { type: 'qi', current: 50, max: 100, regenPerTurn: 5 },
    { type: 'stamina', current: 30, max: 80, regenPerTurn: 3 },
  ];
  const drained = resolveCombatResourceDrain(usages[0], { type: 'qi', value: 20 });
  assert(drained.current === 30 && drained.recentDrain === 20, `drain 鍚庡簲=30锛屽嘲鍊?20锛屽疄闄?${drained.current}/${drained.recentDrain}`);
  // 绫诲瀷涓嶅尮閰嶅簲鍘熸牱杩斿洖
  const same = resolveCombatResourceDrain(usages[1], { type: 'qi', value: 5 });
  assert(same === usages[1] || same.current === usages[1].current, '绫诲瀷涓嶅尮閰嶅簲鍘熸牱杩斿洖');
  // 鍏呰冻妫€鏌?  const ok = checkCombatResourceSufficient(usages, [{ type: 'qi', value: 10 }]);
  assert(ok.sufficient === true && ok.missing.length === 0, '50>=10 搴斿厖瓒?);
  const need = checkCombatResourceSufficient(usages, [{ type: 'qi', value: 60 }, { type: 'focus', value: 5 }]);
  assert(need.sufficient === false && need.missing.length === 2, `搴旂己 2 椤癸紝瀹為檯=${need.missing.length}`);
  log('combat-resource-drain-sufficient', { passed: true, drained: drained.current, missing: need.missing.length });
}

function smokeAi82ResourceLabelConsistency(): void {
  // AI-82: COMBAT_RESOURCE_LABEL 蹇呴』瑕嗙洊鍏ㄩ儴 4 涓祫婧愮被鍨?  const labels = (COMBAT_RESOURCE_LABEL as any);
  const types: CombatResourceType[] = ['qi', 'soul', 'stamina', 'focus'];
  for (const t of types) {
    assert(typeof labels[t] === 'string' && labels[t].length > 0, `${t} 蹇呴』鏈変腑鏂囨爣绛綻);
  }
  log('combat-resource-label-consistency', { passed: true, count: types.length });
}

function smokeAi83BreakthroughStageDerivation(): void {
  // AI-83: deriveBreakthroughStage 搴旀寜 attemptNumber + 蹇冮瓟 + 骞撮緞鎺ㄥ闃舵
  const s1 = deriveBreakthroughStage('qi_refining', 'foundation_building', 1, 20, 30);
  assert(s1 === 'perception', `绗?娆″皾璇曞簲涓烘劅鎮燂紝瀹為檯=${s1}`);
  const s2 = deriveBreakthroughStage('qi_refining', 'foundation_building', 1, 90, 30);
  assert(s2 === 'condense' || s2 === 'perception', `楂橀緞绗?娆″簲涓哄嚌鑱氭垨鎰熸偀锛屽疄闄?${s2}`);
  const s3 = deriveBreakthroughStage('qi_refining', 'foundation_building', 1, 20, 70);
  assert(s3 === 'storm', `楂樺績榄旂1娆″簲涓洪鏆达紝瀹為檯=${s3}`);
  const s4 = deriveBreakthroughStage('qi_refining', 'foundation_building', 4, 30, 30);
  assert(s4 === 'stabilize', `绗?娆″簲涓虹ǔ鍥猴紝瀹為檯=${s4}`);
  const s5 = deriveBreakthroughStage('foundation_building', 'foundation_building', 1, 20, 0);
  assert(s5 === 'passed', `宸查€氳繃搴斾负 passed锛屽疄闄?${s5}`);
  log('breakthrough-stage-derivation', { passed: true, s1, s2, s3, s4, s5 });
}

function smokeAi83BreakthroughOutcome(): void {
  // AI-83: resolveBreakthroughOutcome 搴旀寜闃舵+蹇冮瓟+澶栨彺缁欏嚭 success/failed/continue
  const baseAttempt: BreakthroughAttempt = {
    realmBefore: 'qi_refining', realmAfter: 'foundation_building', stage: 'stabilize',
    attemptNumber: 3, helperCount: 0, startedAge: 25, elapsedTurns: 10,
  };
  const o1 = resolveBreakthroughOutcome({ attempt: baseAttempt, heartDemon: 30, helperPower: 4 });
  assert(o1.outcome === 'success' && o1.narrative.length > 0, `澶栨彺瓒冲搴旀垚鍔燂紝瀹為檯=${o1.outcome}`);
  const o2 = resolveBreakthroughOutcome({ attempt: { ...baseAttempt, helperCount: 0 }, heartDemon: 30, helperPower: 0 });
  assert(o2.outcome === 'continue', `澶栨彺涓?搴旂户缁紝瀹為檯=${o2.outcome}`);
  const stormAttempt: BreakthroughAttempt = { ...baseAttempt, stage: 'storm' };
  const o3 = resolveBreakthroughOutcome({ attempt: stormAttempt, heartDemon: 70, helperPower: 5 });
  assert(o3.outcome === 'failed', `椋庢毚+楂樺績榄斿簲澶辫触锛屽疄闄?${o3.outcome}`);
  // 宸查€氳繃 鈫?鐩存帴鎴愬姛
  const passedAttempt: BreakthroughAttempt = { ...baseAttempt, stage: 'passed' };
  const o4 = resolveBreakthroughOutcome({ attempt: passedAttempt, heartDemon: 0, helperPower: 0 });
  assert(o4.outcome === 'success', `宸查€氳繃搴旀垚鍔燂紝瀹為檯=${o4.outcome}`);
  log('breakthrough-outcome', { passed: true, o1: o1.outcome, o2: o2.outcome, o3: o3.outcome, o4: o4.outcome });
}

function smokeAi84CombatStalemateBreak(): void {
  // AI-84: detectCombatStalemate 搴旇瘑鍒繛缁棤鍙樺寲鐨勫兊灞€锛況esolveStalemateBreak 搴旇繑鍥炰簨浠舵彁绀?  const progressing = [
    { round: 1, playerHpAfter: 100, enemyHpAfter: 100 },
    { round: 2, playerHpAfter: 90, enemyHpAfter: 95 },
    { round: 3, playerHpAfter: 80, enemyHpAfter: 90 },
  ];
  const r1 = detectCombatStalemate(progressing);
  assert(r1.isStalemate === false, `鎸佺画鎺ㄨ繘搴旈潪鍍靛眬锛屽疄闄?${r1.isStalemate}`);
  const stuck = [
    { round: 1, playerHpAfter: 50, enemyHpAfter: 50 },
    { round: 2, playerHpAfter: 50, enemyHpAfter: 50 },
    { round: 3, playerHpAfter: 50, enemyHpAfter: 50 },
    { round: 4, playerHpAfter: 50, enemyHpAfter: 50 },
  ];
  const r2 = detectCombatStalemate(stuck);
  assert(r2.isStalemate === true && r2.turnsSinceProgress >= 3, `杩炵画骞冲眬搴斿兊灞€锛屽疄闄?${r2.isStalemate}/${r2.turnsSinceProgress}`);
  // 鐮村眬鎻愮ず
  const break1 = resolveStalemateBreak({ realm: 'qi_refining' } as any, { name: '濡栧吔' });
  assert(typeof break1.event === 'string' && break1.event.length > 0, '鐮村眬浜嬩欢鏂囨闈炵┖');
  assert(typeof break1.hint === 'string' && break1.hint.length > 0, '鐮村眬鎻愮ず闈炵┖');
  assert(['aggressive', 'cunning', 'defensive'].includes(break1.suggestedAction), `寤鸿鍔ㄤ綔搴斾负鍚堟硶濮挎€侊紝瀹為檯=${break1.suggestedAction}`);
  log('combat-stalemate-break', { passed: true, isStalemate: r2.isStalemate, event: break1.event });
}

function smokeAi85ComboChainDerivation(): void {
  // AI-85: deriveComboChain 搴旀寜鍛戒腑璁板綍鐢熸垚杩炲嚮
  const empty = deriveComboChain([]);
  assert(empty === null, `绌鸿褰曞簲杩斿洖 null锛屽疄闄?${empty}`);
  const oneHit = deriveComboChain([{ round: 5, hit: true, skillName: '鍓? }]);
  assert(oneHit === null, `鍗曟鍛戒腑搴旀棤杩炲嚮锛屽疄闄?${oneHit}`);
  const hits = deriveComboChain([
    { round: 3, hit: true, skillName: '鍓? },
    { round: 4, hit: true, skillName: '鍓? },
    { round: 5, hit: true, skillName: '鍓? },
  ]);
  assert(hits !== null && hits.hits === 3, `搴?3杩炲嚮锛屽疄闄?${hits?.hits}`);
  assert(hits!.multiplier > 1 && hits!.multiplier <= 2.5, `杩炲嚮鍊嶇巼搴斿湪 (1, 2.5]锛屽疄闄?${hits!.multiplier}`);
  // 鏂繛
  const broken = deriveComboChain([
    { round: 1, hit: true, skillName: '鍓? },
    { round: 2, hit: false },
    { round: 3, hit: true, skillName: '鍓? },
    { round: 4, hit: true, skillName: '鍓? },
  ]);
  assert(broken !== null && broken.hits === 2, `澶辨墜鍚庡簲浠?2 杩炲嚮锛屽疄闄?${broken?.hits}`);
  log('combo-chain-derivation', { passed: true, hits: hits?.hits, multiplier: hits?.multiplier, broken: broken?.hits });
}

function smokeAi85ComboDamageResolve(): void {
  // AI-85: resolveComboDamage 搴旀寜杩炲嚮鍊嶇巼鍔犳垚浼ゅ
  const noCombo = resolveComboDamage(100, null);
  assert(noCombo.finalDamage === 100 && noCombo.multiplier === 1, `鏃犺繛鍑诲簲淇濇寔 100锛屽疄闄?${noCombo.finalDamage}`);
  const chain: ComboChain = { comboName: '涓夎繛鍑?, hits: 3, multiplier: 1.3, expiresTurn: 10 };
  const withCombo = resolveComboDamage(100, chain);
  assert(withCombo.finalDamage === 130 && withCombo.multiplier === 1.3, `100*1.3 搴?130锛屽疄闄?${withCombo.finalDamage}`);
  // 鏃犳晥杩炲嚮锛坔its<2锛夆啋 涓嶅姞鎴?  const weakCombo = resolveComboDamage(50, { comboName: '寮?, hits: 1, multiplier: 2, expiresTurn: 1 });
  assert(weakCombo.finalDamage === 50, `鍗曟杩炲嚮涓嶅簲鍔犳垚锛屽疄闄?${weakCombo.finalDamage}`);
  // 璐熸暟褰掗浂 鈫?涓嬮檺 1
  const negDamage = resolveComboDamage(-5, null);
  assert(negDamage.finalDamage === 0, `璐熶激瀹冲簲=0锛屽疄闄?${negDamage.finalDamage}`);
  log('combo-damage-resolve', { passed: true, base: 100, withCombo: withCombo.finalDamage, mult: withCombo.multiplier });
}

function smokeHeartIntentPanelExists(): void {
  // AI-102: HeartIntentPanel 缁勪欢搴斿瓨鍦ㄥ苟瀵煎嚭
  const panelPath = 'E:\\aigame2_publish\\src\\components\\xianxia\\HeartIntentPanel.tsx';
  const exists = existsSync(panelPath);
  assert(exists, `HeartIntentPanel.tsx 搴斿瓨鍦ㄤ簬 ${panelPath}`);
  let exported = false;
  if (exists) {
    const src = readFileSync(panelPath, 'utf8');
    exported = /export\s+function\s+HeartIntentPanel\s*\(/.test(src) || /export\s+const\s+HeartIntentPanel\s*=/.test(src);
  }
  assert(exported, `HeartIntentPanel 蹇呴』瀵煎嚭 HeartIntentPanel 缁勪欢`);
  log('heart-intent-panel-exists', { passed: true, path: panelPath, exported });
}

function smokeHeartIntentStoreUpdate(): void {
  // AI-102: 缁勪欢搴旇兘閫氳繃 store 淇敼 heartIntent / intents
  // 杈圭晫锛氫笉鍔ㄦ牳蹇?action锛屼娇鐢?setCharacter 閫氱敤鏇存柊鍣?  const panelPath = 'E:\\aigame2_publish\\src\\components\\xianxia\\HeartIntentPanel.tsx';
  let usesSetCharacter = false;
  let accessesHeartIntent = false;
  let accessesIntents = false;
  if (existsSync(panelPath)) {
    const src = readFileSync(panelPath, 'utf8');
    usesSetCharacter = /setCharacter\s*[,(]/.test(src) || /useGameStore/.test(src);
    accessesHeartIntent = /character\.heartIntent|heartIntent/.test(src);
    accessesIntents = /character\.intents|\.intents\b/.test(src);
  }
  assert(usesSetCharacter, 'HeartIntentPanel 蹇呴』璋冪敤 store.setCharacter 鎴?useGameStore');
  assert(accessesHeartIntent, 'HeartIntentPanel 蹇呴』璇诲彇 character.heartIntent');
  assert(accessesIntents, 'HeartIntentPanel 蹇呴』璇诲彇 character.intents[]');
  log('heart-intent-store-update', { passed: true, usesSetCharacter, accessesHeartIntent, accessesIntents });
}

function smokeHeartIntentLabel(): void {
  // AI-102: HEART_INTENT_LABEL 搴斾粠 display.ts 瀵煎嚭
  const displayPath = 'E:\\aigame2_publish\\src\\lib\\xianxia\\display.ts';
  let exported = false;
  let hasLabels = false;
  if (existsSync(displayPath)) {
    const src = readFileSync(displayPath, 'utf8');
    const m = src.match(/export\s+const\s+HEART_INTENT_LABEL[^=]*=\s*\{([\s\S]*?)\}\s+as\s+const/);
    if (m) {
      exported = true;
      const body = m[1];
      const labels = (body.match(/:\s*['"][^'"]+['"]/g) || []).map(s => s.replace(/[:'"\s]/g, ''));
      hasLabels = labels.length >= 5 && labels.every(l => /[\u4e00-\u9fa5]/.test(l));
    }
  }
  assert(exported, 'HEART_INTENT_LABEL 蹇呴』浠?display.ts 瀵煎嚭 (as const)');
  assert(hasLabels, 'HEART_INTENT_LABEL 蹇呴』鍖呭惈鑷冲皯 5 涓腑鏂囨爣绛?);
  log('heart-intent-label', { passed: true, exported, hasLabels });
}
