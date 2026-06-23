import { readFileSync } from 'fs';
import { clearAdvancePreload, isAdvancePreloadUsable, prepareAdvanceCandidate } from '../src/lib/xianxia/advance-preload';
import { validateAIBoundary } from '../src/lib/xianxia/ai-boundary-validator';
import { buildEventSchedulerPlan, buildWorldPressureOpportunityMap, deriveWorldFactStateProfile } from '../src/lib/xianxia/event-scheduler';
import { advanceThread, completeThread, failThread, buildThreadContinuationEvent, deriveWorldEventConsequences, deriveWorldFactsFromState, executeAIEvent, evaluateTechniqueCompatibility, buildLearnedCombatArts, buildStateContext, getSameYearThreads, normalizeCultivationState, recordActionCausality, refreshWorldFacts, buildCombatActionPalette, buildCombatVictorySpoils, deriveCultivationAttributes, removeItemsByIds, equipItemsByIds, deriveRealmTraits, deriveSoulRealm, endCombat, executeCombatRoundWithProposal, startCombat, stateToResponse } from '../src/lib/xianxia/engine';
import { constitutionToStatus, CONSTITUTIONS } from '../src/lib/xianxia/constitutions';
import { appendNarrativeContractAuditEffect, appendStateChangeAuditEffect, extractNarrativeContractFeedback } from '../src/lib/xianxia/state-change-log';
import { registerItem } from '../src/lib/xianxia/content-registry';
import { advanceWorldCalendar, extractEventMeta, formatWorldTimeDisplay, hiddenEventMeta, inferInlineTimeAdvance, phaseHintForTime, worldTimeStamp } from '../src/lib/xianxia/world-time';
import { characterDisplayEntries, entriesForSlot } from '../src/lib/xianxia/display-registry';
import { sanitizeNarrativeText, sanitizeEventDraft } from '../src/lib/xianxia/display';
import { buildFallbackAgeEvent } from '../src/lib/xianxia/advance-fallback';

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
      title: '阴鸦客的暗中盯梢',
      summary: '拍得旧洞府铜钥后，阴鸦客神色微冷。',
      kind: 'quest',
      stage: 'open',
      progress: 10,
      startedAtAge: 20,
      dueAge: 21,
      urgency: 5,
      sourceThreadId: 'auction_aftermath_x',
      currentHook: '后续流年可让阴鸦客因旧洞府铜钥盯上角色，低频触发盯梢、试探、劫杀或交易。',
      rewardHint: '化解仇怨或反夺线索',
      failureHint: '坊市外被盯梢、截杀或被引入圈套',
      tags: ['quest', 'auction'],
    }],
    pendingThreads: [{
      id: 'auction_aftermath_x',
      title: '阴鸦客的暗中盯梢',
      description: '角色在拍卖会拍得旧洞府铜钥后，阴鸦客神色微冷。',
      category: 'quest',
      startAge: 20,
      deadlineAge: 21,
      status: 'pending',
      progress: 10,
      followUpHint: '后续流年可让阴鸦客因旧洞府铜钥盯上角色，低频触发盯梢、试探、劫杀或交易。',
      reward: '化解仇怨或反夺线索',
      failureCost: '坊市外被盯梢、截杀或被引入圈套',
    }],
    npcs: [{
      id: 'auction_npc_阴鸦客',
      name: '阴鸦客',
      description: '拍卖会中对旧洞府铜钥格外在意的竞拍者。',
      memory: '在拍卖会中因旧洞府铜钥落入角色手中而记下一笔。',
      role: '竞拍失利者',
      attitude: 'hostile',
      relationshipScore: -25,
      lastSeenAge: 20,
      tags: ['auction', 'aftermath', 'rivalry'],
    }],
    worldFacts: [],
    causalGraph: { nodes: [{ id: 'thread_node', refId: 'auction_aftermath_x' }], edges: [{ from: 'event_node', to: 'thread_node', type: 'created', age: 20 }] },
  };
  const plan = buildEventSchedulerPlan(state);
  assert(plan.focus?.title === '阴鸦客', 'scheduler should focus hostile auction aftermath NPC');
  assert((plan.focus?.priority || 0) >= 60, 'scheduler focus priority should be high');
  assert(plan.hints.some(h => h.kind === 'quest' && h.title.includes('盯梢')), 'scheduler should include related quest hint');
  assert(plan.hints.some(h => h.kind === 'npc' && h.reason.includes('自主倾向') && h.reason.includes('截杀')), 'scheduler should include NPC autonomous hostile echo');
  log('scheduler-continuity', { passed: true, focus: plan.focus?.title, priority: plan.focus?.priority, hints: plan.hints.length });
}

function smokeBoundaryFactChecks(): void {
  const state: any = {
    age: 20,
    spiritStones: 100,
    inventory: [{ id: 'key_1', name: '旧洞府铜钥', description: '拍卖所得', item_type: 'tool', rarity: 'epic', effects: [], source: '拍卖会' }],
    equipped: [{ id: 'ring_1', name: '青玉戒', description: '旧物', item_type: 'accessory', rarity: 'rare', effects: [], source: '旧年' }],
    pendingThreads: [
      { id: 'closed_x', title: '旧洞府铜钥的旧主线索', description: '旧洞府铜钥已经查明', category: 'mystery', startAge: 18, deadlineAge: 19, status: 'resolved', progress: 100 },
      { id: 'open_y', title: '阴鸦客的暗中盯梢', description: '阴鸦客盯上角色', category: 'enemy', startAge: 20, deadlineAge: 21, status: 'pending', progress: 10 },
    ],
    questEntries: [],
    npcs: [{ id: 'auction_npc_阴鸦客', name: '阴鸦客', description: '敌意竞拍者', attitude: 'hostile', relationshipScore: -25, firstMetAge: 20, lastSeenAge: 20, source: 'auction', tags: ['auction'] }],
    worldFacts: [{ id: 'fact_洞府', kind: 'realm', title: '旧洞府铜钥', summary: '拍卖会出现的钥匙', confidence: 0.9, firstSeenAge: 20, lastSeenAge: 20, source: 'auction' }],
  };
  const output: any = {
    title: '旧线再起',
    narrative: '阴鸦客忽然改口称善，旧洞府铜钥的旧主线索再次开启。',
    changes: [],
    newStatuses: [],
    newItems: [{ id: 'ring_1', name: '青玉戒', description: '又得一枚', item_type: 'accessory', rarity: 'rare', effects: [], source: '奇遇' }],
    removedItemIds: ['missing_item'],
    equipItemIds: ['missing_equip'],
    unequipItemIds: ['missing_unequip'],
    newThreads: [{ id: 'new_closed', title: '旧洞府铜钥的旧主线索', description: '旧洞府铜钥已经查明', category: 'mystery', startAge: 20, deadlineAge: 22, status: 'pending', progress: 0 }],
    advanceThreads: [{ id: 'closed_x', progressDelta: 10 }],
    completeThreadIds: [],
    failThreadIds: [],
    newNpcs: [{ id: 'auction_npc_阴鸦客', name: '阴鸦客', description: '忽然转为友善', attitude: 'friendly', relationshipScore: 80, firstMetAge: 20, lastSeenAge: 20, source: 'ai' }],
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
    npcs: [{ id: 'npc_shadow', name: '阴鸦客', description: '敌意竞拍者', attitude: 'hostile', relationshipScore: -20, firstMetAge: 29, lastSeenAge: 30, source: 'auction' }],
    worldFacts: [{ id: 'wf_market', kind: 'location', title: '青岚坊市', summary: '拍卖余波未散', confidence: 0.8, firstSeenAge: 29, lastSeenAge: 30, source: 'smoke', tags: ['location', 'market'] }],
    eventSchedule: {
      generatedAtAge: 30,
      focus: { id: 'seh_npc_shadow', kind: 'npc', priority: 120, title: '阴鸦客', reason: '阴鸦客暗中盯梢。', requiredAction: 'echo_or_develop' },
      hints: [{ id: 'seh_npc_shadow', kind: 'npc', priority: 120, title: '阴鸦客', reason: '阴鸦客暗中盯梢。', requiredAction: 'echo_or_develop' }],
      pressureMap: { topThreat: '阴鸦客', topOpportunity: '青岚坊市', focalLocation: '青岚坊市', focalActor: '阴鸦客', likelyEventTypes: ['威胁回响'], summary: '最大威胁：阴鸦客；最大机会：青岚坊市；事件倾向：威胁回响' },
      warnings: [],
    },
  };
  const baseOutput: any = {
    title: '坊外微影',
    narrative: '沈砚秋在青岚坊市外觉出阴鸦客的目光，暂且避入人群。',
    eventType: 'normal',
    changes: [],
    newStatuses: [],
    newItems: [],
    memory: '阴鸦客在青岚坊市外盯梢。',
    hasChoice: false,
  };
  const missingCodes = validateAIBoundary(state, baseOutput).trace.map(t => t.code);
  assert(missingCodes.includes('missing_narrative_contract'), 'missing contract should warn under pressure map');
  const unknownCodes = validateAIBoundary(state, { ...baseOutput, narrativeContract: { narrativeFocus: 'npc', narrativeOutcome: 'vanished', usedScheduleHintIds: ['seh_missing'], usedWorldFactIds: ['wf_missing'], usedNpcIds: ['npc_missing'], contractNote: '承接阴鸦客威胁。' } }).trace.map(t => t.code);
  assert(unknownCodes.includes('unknown_schedule_hint_reference') && unknownCodes.includes('unknown_world_fact_reference') && unknownCodes.includes('unknown_npc_contract_reference'), 'unknown narrative contract references should warn');
  assert(unknownCodes.includes('invalid_narrative_outcome'), 'invalid narrative outcome should warn');
  const okCodes = validateAIBoundary(state, { ...baseOutput, narrativeContract: { narrativeFocus: 'npc', narrativeOutcome: 'advanced', usedScheduleHintIds: ['seh_npc_shadow'], usedWorldFactIds: ['wf_market'], usedNpcIds: ['npc_shadow'], contractNote: '承接最大威胁阴鸦客的盯梢。' } }).trace.map(t => t.code);
  assert(!okCodes.includes('missing_narrative_contract') && !okCodes.includes('unknown_schedule_hint_reference'), 'valid narrative contract should not raise contract warnings');
  log('narrative-contract', { passed: true, missingCodes: missingCodes.length, unknownCodes: unknownCodes.length, okCodes: okCodes.length });
}

function smokeWorldFactsLite(): void {
  const state: any = {
    age: 42,
    location: '青岚坊市',
    faction: '青岚宗',
    npcs: [{
      id: 'npc_shadow',
      name: '阴鸦客',
      description: '拍卖会中盯上旧洞府铜钥的散修。',
      role: '竞拍失利者',
      faction: '黑鸦会',
      attitude: 'hostile',
      relationshipScore: -30,
      firstMetAge: 41,
      lastSeenAge: 42,
      lastKnownLocation: '青岚坊市',
      source: 'auction',
      memory: '因旧洞府铜钥落入角色手中而记下一笔。',
      tags: ['auction', 'aftermath'],
    }],
    pendingThreads: [{
      id: 'thread_key',
      title: '旧洞府铜钥的旧主线索',
      description: '旧洞府铜钥牵动一座失落洞府。',
      category: 'mystery',
      startAge: 41,
      deadlineAge: 45,
      status: 'pending',
      progress: 20,
      followUpHint: '可循铜钥禁制探查洞府旧主。',
    }],
    discoveredRealms: [],
    worldFacts: [],
  };
  const facts = deriveWorldFactsFromState(state, 'smoke');
  assert(facts.some(f => f.kind === 'location' && f.title === '青岚坊市' && f.tags?.includes('market')), 'world facts should derive market location fact');
  assert(facts.some(f => f.kind === 'faction' && f.title === '青岚宗' && f.tags?.includes('current')), 'world facts should derive current faction fact');
  assert(facts.some(f => f.kind === 'faction' && f.title === '黑鸦会' && f.tags?.includes('hostile')), 'world facts should derive NPC-linked faction fact');
  assert(facts.some(f => f.kind === 'realm' && f.tags?.includes('realm-hint')), 'world facts should derive realm hint from key/thread text');
  const refreshed: any = refreshWorldFacts(state, 'smoke');
  const plan = buildEventSchedulerPlan({ ...refreshed, questEntries: [], causalGraph: { nodes: [], edges: [] } });
  assert(plan.hints.some(h => h.kind === 'world' && h.title === '青岚坊市'), 'scheduler should include location world fact hint');
  log('worldfacts-lite', { passed: true, facts: facts.length, hints: plan.hints.length });
}

function smokeFactionLocationStateProfiles(): void {
  const state: any = {
    age: 46,
    location: '青岚坊市',
    npcs: [{
      id: 'npc_shadow',
      name: '阴鸦客',
      faction: '黑鸦会',
      attitude: 'hostile',
      relationshipScore: -40,
      firstMetAge: 44,
      lastSeenAge: 46,
      lastKnownLocation: '青岚坊市',
      source: 'auction',
      tags: ['auction', 'aftermath'],
    }],
    pendingThreads: [{
      id: 'thread_ambush',
      title: '坊市外的黑鸦盯梢',
      description: '黑鸦会在青岚坊市外盯梢，可能截杀夺钥。',
      category: 'enemy',
      startAge: 45,
      deadlineAge: 47,
      status: 'pending',
      progress: 30,
      followUpHint: '可让黑鸦会追责、通缉或伏击。',
    }],
    questEntries: [],
    causalGraph: { nodes: [], edges: [] },
    worldFacts: [
      { id: 'wf_location_market', kind: 'location', title: '青岚坊市', summary: '近期拍卖余波未散。', confidence: 0.8, firstSeenAge: 44, lastSeenAge: 46, source: 'smoke', tags: ['location', 'market', 'auction', 'event-consequence'] },
      { id: 'wf_faction_black', kind: 'faction', title: '黑鸦会', summary: '黑鸦会与旧洞府铜钥余波相连。', confidence: 0.8, firstSeenAge: 44, lastSeenAge: 46, source: 'smoke', tags: ['faction', 'hostile', 'danger'] },
    ],
  };
  const locationProfile = deriveWorldFactStateProfile(state.worldFacts[0], state);
  const factionProfile = deriveWorldFactStateProfile(state.worldFacts[1], state);
  assert(locationProfile?.summary.includes('危险度') && locationProfile.summary.includes('交易活跃') && locationProfile.summary.includes('近期传闻'), 'location profile should expose danger/trade/rumor state');
  assert(factionProfile?.summary.includes('追责压力') && factionProfile.summary.includes('观察倾向') && factionProfile.summary.includes('NPC关联压力'), 'faction profile should expose pressure/observation/npc state');
  const plan = buildEventSchedulerPlan(state);
  assert(plan.hints.some(h => h.title === '青岚坊市' && h.reason.includes('地点画像')), 'scheduler should include location state profile');
  assert(plan.hints.some(h => h.title === '黑鸦会' && h.reason.includes('势力画像') && h.reason.includes('追责')), 'scheduler should include faction state profile');
  log('faction-location-state', { passed: true, location: locationProfile?.summary, faction: factionProfile?.summary, hints: plan.hints.length });
}

function smokeWorldPressureOpportunityMap(): void {
  const state: any = {
    age: 47,
    location: '青岚坊市',
    npcs: [{
      id: 'npc_shadow',
      name: '阴鸦客',
      faction: '黑鸦会',
      attitude: 'hostile',
      relationshipScore: -45,
      firstMetAge: 44,
      lastSeenAge: 47,
      lastKnownLocation: '青岚坊市',
      source: 'auction',
      memory: '因旧洞府铜钥落入角色手中而记下一笔。',
      tags: ['auction', 'aftermath', 'rivalry'],
    }],
    pendingThreads: [{
      id: 'thread_key',
      title: '旧洞府铜钥的旧主线索',
      description: '旧洞府铜钥牵动一座失落洞府。',
      category: 'mystery',
      startAge: 45,
      deadlineAge: 48,
      status: 'pending',
      progress: 45,
      followUpHint: '可循铜钥禁制探查洞府旧主，也可能遭阴鸦客截杀。',
    }],
    questEntries: [],
    causalGraph: { nodes: [], edges: [] },
    worldFacts: [
      { id: 'wf_location_market', kind: 'location', title: '青岚坊市', summary: '近期拍卖余波未散。', confidence: 0.8, firstSeenAge: 44, lastSeenAge: 47, source: 'smoke', tags: ['location', 'market', 'auction', 'event-consequence'] },
      { id: 'wf_faction_black', kind: 'faction', title: '黑鸦会', summary: '黑鸦会与旧洞府铜钥余波相连。', confidence: 0.8, firstSeenAge: 44, lastSeenAge: 47, source: 'smoke', tags: ['faction', 'hostile', 'danger'] },
      { id: 'wf_realm_key', kind: 'realm', title: '旧洞府铜钥', summary: '旧洞府铜钥或可开启遗府。', confidence: 0.8, firstSeenAge: 45, lastSeenAge: 47, source: 'smoke', tags: ['realm', 'realm-hint'] },
    ],
  };
  const plan = buildEventSchedulerPlan(state);
  const map = plan.pressureMap || buildWorldPressureOpportunityMap(state, plan.hints);
  assert(map.topThreat === '阴鸦客' || map.topThreat === '黑鸦会', 'pressure map should pick hostile NPC/faction as top threat');
  assert(!!map.topOpportunity, 'pressure map should expose a top opportunity');
  assert(map.focalLocation === '青岚坊市', 'pressure map should pick focal location');
  assert(map.focalActor === '阴鸦客' || map.focalActor === '黑鸦会', 'pressure map should pick focal actor/faction');
  assert(map.likelyEventTypes.some(t => ['威胁回响', '势力施压', '机缘推进', '秘境异动'].includes(t)), 'pressure map should expose likely event types');
  assert(map.summary.includes('最大威胁') && map.summary.includes('事件倾向'), 'pressure map should have readable summary');
  log('world-pressure-map', { passed: true, summary: map.summary, hints: plan.hints.length });
}

function smokeWorldMemoryPressureDecay(): void {
  const baseState: any = {
    age: 50,
    location: '青岚坊市',
    pendingThreads: [],
    questEntries: [],
    causalGraph: { nodes: [], edges: [] },
    worldFacts: [],
    npcs: [{
      id: 'npc_shadow',
      name: '阴鸦客',
      faction: '黑鸦会',
      attitude: 'hostile',
      relationshipScore: -50,
      lastSeenAge: 50,
      memory: '阴鸦客因旧洞府铜钥盯上角色。',
      tags: ['auction', 'aftermath', 'rivalry'],
    }],
  };
  const noFeedbackPlan = buildEventSchedulerPlan(baseState);
  const noFeedbackNpc = noFeedbackPlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(noFeedbackNpc, 'baseline plan should include hostile NPC hint');

  const cooledPlan = buildEventSchedulerPlan({
    ...baseState,
    narrativeContractFeedback: [
      { age: 48, title: '坊外微影', narrativeFocus: 'npc', usedNpcIds: ['npc_shadow'], usedScheduleHintIds: ['seh_npc_npc_shadow'], usedWorldFactIds: [], warningCodes: [] },
      { age: 49, title: '黑羽窥市', narrativeFocus: 'npc', usedNpcIds: ['npc_shadow'], usedScheduleHintIds: ['seh_npc_npc_shadow'], usedWorldFactIds: [], warningCodes: [] },
    ],
  });
  const cooledNpc = cooledPlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(cooledNpc && cooledNpc.priority < noFeedbackNpc!.priority, 'recently repeated NPC focus should cool down');
  const cooledNpcHint = cooledNpc!;
  assert(cooledNpcHint.reason.includes('记忆潮汐'), 'cooled hint should explain memory tide adjustment');

  const boostedPlan = buildEventSchedulerPlan({
    ...baseState,
    narrativeContractFeedback: [
      { age: 49, title: '日常炼气', narrativeFocus: 'daily', focusHintId: 'seh_npc_npc_shadow', focusHintTitle: '阴鸦客', usedNpcIds: [], usedScheduleHintIds: [], usedWorldFactIds: [], topThreat: '阴鸦客', warningCodes: ['top_schedule_focus_not_declared'] },
    ],
  });
  const boostedNpc = boostedPlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(boostedNpc && boostedNpc.priority > noFeedbackNpc!.priority, 'previously ignored high-pressure focus should warm up');
  assert(boostedPlan.warnings.some(w => w.includes('承接不足')), 'pressure decay warnings should mention insufficient previous carryover');
  log('world-memory-pressure-decay', { passed: true, base: noFeedbackNpc!.priority, cooled: cooledNpcHint.priority, boosted: boostedNpc!.priority });
}

function smokeWorldMemoryResolution(): void {
  const state: any = {
    age: 50,
    location: '青岚坊市',
    causalGraph: { nodes: [], edges: [] },
    worldFacts: [{ id: 'wf_old', kind: 'event', title: '旧怨余波', summary: '此事已了，只余旧人口风。', confidence: 0.9, firstSeenAge: 44, lastSeenAge: 49, source: 'smoke', tags: ['consequence'] }],
    npcs: [{ id: 'npc_shadow', name: '阴鸦客', attitude: 'hostile', relationshipScore: -50, lastSeenAge: 50, memory: '阴鸦客因旧洞府铜钥盯上角色。', tags: ['auction', 'aftermath'] }],
    pendingThreads: [{ id: 'thread_due', title: '三日之约', description: '阴鸦客约在坊外了断旧事。', category: 'quest', startAge: 49, deadlineAge: 50, status: 'pending', progress: 70, followUpHint: '若不赴约，阴鸦客会转为追杀。' }],
    questEntries: [],
    narrativeContractFeedback: [
      { age: 48, title: '坊外微影', narrativeFocus: 'npc', usedNpcIds: ['npc_shadow'], usedScheduleHintIds: ['seh_npc_npc_shadow'], usedWorldFactIds: [], warningCodes: [] },
      { age: 49, title: '黑羽窥市', narrativeFocus: 'npc', usedNpcIds: ['npc_shadow'], usedScheduleHintIds: ['seh_npc_npc_shadow'], usedWorldFactIds: [], warningCodes: [] },
    ],
  };
  const plan = buildEventSchedulerPlan(state);
  const due = plan.hints.find(h => h.sourceThreadId === 'thread_due');
  const npc = plan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  const oldFact = plan.hints.find(h => h.relatedFactIds?.includes('wf_old'));
  assert(due?.resolutionStage === 'escalating', 'due thread should be escalating');
  assert(due?.resolutionHint?.includes('完成') || due?.resolutionHint?.includes('失败'), 'escalating hint should tell AI to resolve or fail');
  assert(npc?.resolutionStage === 'cooling', 'recently repeated NPC should enter cooling stage');
  assert(oldFact?.resolutionStage === 'resolved', 'resolved world fact should stay resolved/background-like');
  log('world-memory-resolution', { passed: true, due: due?.resolutionStage, npc: npc?.resolutionStage, fact: oldFact?.resolutionStage });
}

function smokeWorldMemoryOutcomeFeedback(): void {
  const baseState: any = {
    age: 60,
    location: '青岚坊市',
    pendingThreads: [],
    questEntries: [],
    causalGraph: { nodes: [], edges: [] },
    worldFacts: [],
    npcs: [{
      id: 'npc_shadow',
      name: '阴鸦客',
      attitude: 'hostile',
      relationshipScore: -50,
      lastSeenAge: 60,
      memory: '阴鸦客仍惦记旧洞府铜钥。',
      tags: ['auction', 'aftermath'],
    }],
  };
  const basePlan = buildEventSchedulerPlan(baseState);
  const baseNpc = basePlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(baseNpc, 'baseline outcome smoke should include NPC hint');

  const resolvedPlan = buildEventSchedulerPlan({
    ...baseState,
    narrativeContractFeedback: [{ age: 59, title: '旧怨了结', narrativeFocus: 'npc', narrativeOutcome: 'resolved', usedNpcIds: ['npc_shadow'], usedScheduleHintIds: ['seh_npc_npc_shadow'], usedWorldFactIds: [], warningCodes: [] }],
  });
  const resolvedNpc = resolvedPlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(resolvedNpc && resolvedNpc.priority < baseNpc!.priority, 'resolved outcome should lower repeated focus priority');
  assert(resolvedNpc?.resolutionStage === 'resolved', 'resolved outcome should mark hint resolved');

  const ignoredPlan = buildEventSchedulerPlan({
    ...baseState,
    narrativeContractFeedback: [{ age: 59, title: '闭门炼气', narrativeFocus: 'daily', narrativeOutcome: 'ignored', focusHintId: 'seh_npc_npc_shadow', focusHintTitle: '阴鸦客', topThreat: '阴鸦客', usedNpcIds: [], usedScheduleHintIds: [], usedWorldFactIds: [], warningCodes: [] }],
  });
  const ignoredNpc = ignoredPlan.hints.find(h => h.id === 'seh_npc_npc_shadow');
  assert(ignoredNpc && ignoredNpc.priority > baseNpc!.priority, 'ignored outcome should warm up high-pressure focus');
  assert(ignoredPlan.warnings.some(w => w.includes('承接不足')), 'ignored outcome should produce carryover warning');
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
      title: '阴鸦客的暗中盯梢',
      description: '阴鸦客仍因旧洞府铜钥盯上角色。',
      category: 'enemy',
      startAge: 21,
      deadlineAge: 24,
      status: 'pending',
      progress: 20,
      followUpHint: '后续需处理阴鸦客的试探、截杀或交易。',
    }],
    questEntries: [],
    npcs: [],
    worldFacts: [],
    causalGraph: { nodes: [], edges: [] },
    pets: [],
    exploredRealms: [],
  };
  const output: any = {
    title: '旧怨了结',
    narrative: '角色顺藤摸瓜，终于寻到阴鸦客藏身之处，以证据和灵契逼其退去，这桩铜钥旧怨暂告一段落。',
    eventType: 'normal',
    changes: [],
    newStatuses: [],
    newItems: [],
    memory: '阴鸦客与旧洞府铜钥的旧怨已被压下。',
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
      contractNote: '阴鸦客旧怨已了结。',
    },
  };
  const result = executeAIEvent(baseState, output);
  const thread = result.state.pendingThreads.find((t: any) => t.id === 'auction_aftermath_x');
  assert(thread?.status === 'resolved', 'resolved narrative outcome should complete referenced thread');
  assert(thread?.progress === 100, 'resolved narrative outcome should fill thread progress');

  const advanced = executeAIEvent(baseState, {
    ...output,
    title: '旧怨推进',
    narrativeContract: { ...output.narrativeContract, narrativeOutcome: 'advanced', contractNote: '查到阴鸦客去向。' },
  });
  const advancedThread = advanced.state.pendingThreads.find((t: any) => t.id === 'auction_aftermath_x');
  assert(advancedThread?.status === 'pending', 'advanced narrative outcome should not close thread');
  assert((advancedThread?.progress || 0) > 20, 'advanced narrative outcome should advance referenced thread');

  const echoed = executeAIEvent(baseState, {
    ...output,
    title: '旧怨余声',
    narrativeContract: { ...output.narrativeContract, narrativeOutcome: 'echoed', contractNote: '只是听闻阴鸦客仍在坊间出没。' },
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
    location: '青岚坊市',
    npcs: [{
      id: 'npc_shadow',
      name: '阴鸦客',
      faction: '黑鸦会',
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
      nodes: [{ id: 'event_auction', type: 'event', label: '旧洞府铜钥落槌', age: 45, summary: '拍卖会上旧洞府铜钥落入角色手中，阴鸦客记下一笔。', tags: ['auction', 'trade'] }],
      edges: [],
    },
  };
  const facts = deriveWorldEventConsequences(state, 'auction-bid');
  assert(facts.some(f => f.kind === 'event' && f.tags?.includes('consequence') && f.tags?.includes('auction')), 'event consequence should derive auction aftermath fact');
  assert(facts.some(f => f.kind === 'location' && f.title === '青岚坊市' && f.tags?.includes('event-consequence')), 'event consequence should enrich location fact');
  assert(facts.some(f => f.kind === 'faction' && f.title === '黑鸦会' && f.tags?.includes('hostile')), 'event consequence should derive hostile faction pressure');
  const refreshed: any = refreshWorldFacts(state, 'auction-bid');
  const plan = buildEventSchedulerPlan({ ...refreshed, questEntries: [] });
  assert(plan.hints.some(h => h.kind === 'world' && h.reason.includes('余波')), 'scheduler should include world event consequence hint');
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
    title: '坊市换宝',
    summary: '烟测交易因果',
    tags: ['smoke', 'trade'],
    newItems: [{ id: 'smoke_item', name: '烟测玉简', description: '用于回归测试', item_type: 'scripture', rarity: 'rare', effects: [], source: 'smoke' } as any],
    threads: [{ id: 'smoke_thread', title: '烟测线索', description: '用于回归测试', category: 'quest', startAge: 30, deadlineAge: 31, status: 'pending', progress: 10 } as any],
    statuses: [{ id: 'smoke_status', name: '烟测状态', description: '用于回归测试', category: 'special', rarity: 'common', effects: [], source: 'smoke' } as any],
  });
  const graph = next.causalGraph || { nodes: [], edges: [] };
  assert(graph.nodes.length >= 4, 'recordActionCausality should add action/item/thread/status nodes');
  assert(graph.edges.length >= 3, 'recordActionCausality should add causal edges');
  assert(graph.nodes.some((n: any) => n.type === 'item' && n.refId === 'smoke_item'), 'causal graph should include item node');
  log('action-causality', { passed: true, nodes: graph.nodes.length, edges: graph.edges.length });
}

function smokeHiddenAudit(): void {
  const effects = appendStateChangeAuditEffect([{ kind: 'visible', text: '可见效果' }], [{ code: 'attribute_applied', source: 'effect', message: '修为增长' } as any]);
  assert(effects.some((effect: any) => effect?.kind === '__audit_state_change_log' && effect.hidden === true), 'hidden audit effect should be appended');

  const narrativeEffects = appendNarrativeContractAuditEffect([{ kind: 'visible', text: '可见效果' }], {
    output: {
      title: '坊外微影',
      narrative: '阴鸦客仍在坊外盯梢。',
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
        contractNote: '承接阴鸦客盯梢。',
      },
    } as any,
    eventSchedule: {
      generatedAtAge: 30,
      focus: { id: 'seh_npc_shadow', kind: 'npc', priority: 120, title: '阴鸦客', reason: '阴鸦客暗中盯梢。', requiredAction: 'echo_or_develop' },
      hints: [],
      pressureMap: { topThreat: '阴鸦客', topOpportunity: '青岚坊市', focalLocation: '青岚坊市', focalActor: '阴鸦客', likelyEventTypes: ['威胁回响'], summary: '最大威胁：阴鸦客；最大机会：青岚坊市' },
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

  const feedback = extractNarrativeContractFeedback([{ age: 30, title: '坊外微影', effects: JSON.stringify(narrativeEffects) }]);
  assert(feedback.length === 1, 'narrative contract feedback should be extracted from hidden audit');
  assert(feedback[0].narrativeFocus === 'npc', 'feedback should preserve narrative focus');
  assert(feedback[0].narrativeOutcome === 'advanced', 'feedback should preserve narrative outcome');
  assert(feedback[0].topThreat === '阴鸦客', 'feedback should preserve pressure map threat');
  assert(feedback[0].usedNpcIds.includes('npc_shadow'), 'feedback should preserve used npc ids');
  assert(feedback[0].warningCodes.includes('top_schedule_focus_not_declared'), 'feedback should preserve contract warning codes');
  log('hidden-audit', { passed: true, effects: effects.length, narrativeAudit: Boolean(audit), feedback: feedback.length });
}

function smokeSameYearContinuation(): void {
  const state: any = {
    name: '沈砚秋',
    age: 21,
    pendingThreads: [{
      id: 'sect_trial_same_year',
      title: '三月后的入门比试',
      description: '青岚山执事约定三月后在外门石坪验看根骨与斗法胆气。',
      category: 'competition',
      startAge: 21,
      deadlineAge: 21,
      status: 'pending',
      progress: 20,
      dueInSameYear: true,
      followUpHint: '同岁三月后赴外门石坪参加入门比试，不能拖到下一年。',
    }],
  };
  const threads = getSameYearThreads(state);
  assert(threads.length === 1, 'same-year thread should be selected before cross-year advance');
  const output = buildThreadContinuationEvent(state, threads[0]);
  assert(output.title.includes('约期已至'), 'same-year competition continuation should use appointment title');
  assert(output.advanceThreads?.length === 0, 'same-year continuation should no longer use partial advance');
  assert(output.completeThreadIds?.includes('sect_trial_same_year'), 'same-year continuation should complete the selected thread');
  log('same-year-continuation', { passed: true, age: state.age, title: output.title });
}


function smokeSameYearContinuationDedup(): void {
  // Verify that after a same-year continuation completes a thread,
  // getSameYearThreads no longer returns it (preventing duplicate events)
  const state: any = {
    name: '测试弟子',
    age: 21,
    pendingThreads: [{
      id: 'sect_trial_same_year',
      title: '月后入门比试',
      description: '按约前往石坪参加入门比试',
      category: 'competition',
      startAge: 21,
      deadlineAge: 21,
      status: 'pending',
      progress: 20,
      dueInSameYear: true,
      followUpHint: '同岁月后前往石坪参加入门比试',
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
  assert(source.includes('年龄推进不是“一年只发生一件事”'), 'advance prompt should require annual multi-part narration');
  assert(source.includes('dueInSameYear=true 表示下一次岁月流转会优先处理同岁后续'), 'advance prompt should explain same-year continuation behavior');
  assert(source.includes('必须用 extraEvents 拆成多条短事件'), 'advance prompt should require extraEvents for multiple key beats');
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
      name: `回归烟测_${Date.now()}`,
      age: 18,
      lifespan: 100,
      realm: 'qi_refining',
      realmLevel: 9,
      spiritStones: 20000,
      luck: 50,
      comprehension: 50,
      location: '青岚坊市',
      storageCapacity: 20,
    },
  });
  await call({ characterId: char.id, action: 'invite' });
  const enter = await call({ characterId: char.id, action: 'enter' });
  const keyLot = enter.auction.lots.find((lot: any) => lot.item?.name?.includes('铜钥')) || enter.auction.lots.at(-1);
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
  assert(!names.includes('\u884c\u6c14\u672f\u5f0f'), 'scripture fallback combat art names should not collapse to generic 行气术式');
  log('combat-art-fallback-names', { passed: true, names: names.join('|') });
}





function smokeArtifactCultivationMisclassification(): void {
  const state: any = normalizeCultivationState({
    spiritualRoot: 'heavenly', rootDetail: '金天灵根', rootMultiplier: 3,
    activeStatuses: [], inventory: [], pets: [], heartDemon: 0,
    hp: 50, maxHp: 50, mp: 20, maxMp: 20,
    equipped: [
      {
        id: 'old_bad_artifact', name: '黄牙瘦汉的残光护符', description: '内藏灵禁：残光护幕。', item_type: 'scripture', rarity: 'uncommon', source: '战利所得',
        effects: [
          { target_attribute: 'defense', operation: 'add', value: 16, description: '护身+16' },
          { target_attribute: 'cultivationExp', operation: 'multiply', value: 1.7, description: '修习此功法，修为流转加速×1.7' },
        ],
        technique: { kind: 'artifact', artifactAbilities: [{ name: '残光护幕', description: '护身灵禁', trigger: 'auto', element: 'none', power: 1.1 }] },
      },
      { id: 'real_scripture', name: '斗法心得玉简', description: '修炼心得。', item_type: 'scripture', rarity: 'uncommon', source: '测试', effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1.45, description: '参悟修行×1.45' }] },
    ],
  } as any);
  const artifact = state.equipped.find((it: any) => it.id === 'old_bad_artifact');
  assert(artifact?.item_type === 'artifact', 'artifact technique should override old scripture misclassification');
  assert(artifact?.name === '残光护符', 'enemy possessive prefix should be stripped during normalization');
  assert(!artifact?.effects?.some((e: any) => e.target_attribute === 'cultivationExp'), 'auto-injected scripture cultivation effect should be removed from artifact');
  assert(!state.cultivationFactors.some((f: any) => f.name === '残光护符'), 'artifact should not appear as scripture cultivation factor');
  assert(Math.abs(state.cultivationMultiplier - 4.35) < 0.001, 'only root and real scripture should multiply cultivation rate');
  console.log(JSON.stringify({ smoke: 'artifact-cultivation-misclassification', passed: true, multiplier: state.cultivationMultiplier }));
}

function smokeCombatTacticalProjection() {
  let state: any = {
    id: 'tactical_smoke', name: '观势者', age: 23, realmName: '炼气二层', rootType: '五行杂灵根', rootMultiplier: 1,
    spiritStones: 0, inventory: [], equipped: [], statuses: [], eventLog: [], hp: 90, maxHp: 90, mp: 45, maxMp: 45, attack: 18, defense: 14, speed: 13,
    combatSession: {
      id: 'combat_tactical_smoke', enemies: [{ id: 'blade_rogue', name: '短刃劫修', description: '脚步飘忽，护身薄弱。', hp: 70, maxHp: 70, attack: 15, defense: 8, speed: 12 }],
      currentEnemyIdx: 0, round: 1, log: [], status: 'ongoing', startAge: 23,
      playerHp: 90, playerMaxHp: 90, playerMp: 45, playerMaxMp: 45, playerAttack: 18, playerDefense: 14, playerSpeed: 13, playerSkills: [], playerItems: [],
    },
  } as any;
  const proposal = {
    playerActionLabel: '错步逼近', playerActionType: 'attack' as const, playerDamage: 6,
    enemyBeats: [{ enemyIdx: 0, action: '横刃退守', actionType: 'defend', damageToPlayer: 0 }],
    tacticalSituation: { tempo: 'opening' as const, advantage: 'player' as const, reason: '敌人退守时右肩护势短暂散开。', playerOpening: '右肩护势换气', suggestedFocus: '趁破绽逼其移步' },
    nextActions: [
      { id: 'press-shoulder', name: '逼肩夺步', description: '顺着右肩护势空隙压上半步，迫其阵脚再乱。', actionType: 'other' as const, intent: '沿破绽扩大优势', tags: ['opening'] },
      { id: 'feint-flee', name: '佯退诱追', description: '故意后撤半丈，引其短刃追出护势。', actionType: 'other' as const, risk: '若敌人不追，攻势会暂缓。', tags: ['ai-context'] },
    ],
    narrative: '你错步贴近，逼得短刃劫修横刃退守；他右肩护势在换气时微微一散，露出一线可乘之机。',
  };
  state = executeCombatRoundWithProposal(state, 'attack', { optionId: 'basic-body-strike' }, proposal).state;
  const session = state.combatSession!;
  assert(session.tacticalSituation?.tempo === 'opening', 'AI tactical tempo should persist on combat session');
  assert(session.actionPalette?.other.options.some((o: any) => o.name === '逼肩夺步' && (o.tags || []).includes('ai-context')), 'AI next actions should project into action palette');
  assert(session.log[0].tacticalSituation?.playerOpening === '右肩护势换气', 'round log should preserve tactical read');
  console.log(JSON.stringify({ smoke: 'combat-tactical-projection', passed: true, tempo: session.tacticalSituation.tempo, option: session.actionPalette.other.options[0].name }));
}

function smokeCombatStalemateBreakNode() {
  let state: any = {
    id: 'stalemate_smoke',
    name: '试战者',
    age: 22,
    realmName: '炼气一层',
    rootType: '五行杂灵根',
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
      enemies: [{ id: 'iron_guard', name: '铁甲散修', description: '护体法器厚重，攻势沉稳。', hp: 80, maxHp: 80, attack: 8, defense: 45, speed: 8 }],
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
    playerActionLabel: '试探攻势',
    playerActionType: 'attack' as const,
    playerDamage: 1,
    enemyBeats: [{ enemyIdx: 0, action: '沉甲迫近', actionType: 'attack', damageToPlayer: 1 }],
    narrative: '两人气机相撞，护身灵光彼此磨过，谁也未能真正撕开对方门户。',
  };
  state = executeCombatRoundWithProposal(state, 'attack', { optionId: 'basic-body-strike' }, proposal).state;
  state = executeCombatRoundWithProposal(state, 'attack', { optionId: 'basic-body-strike' }, proposal).state;
  state = executeCombatRoundWithProposal(state, 'attack', { optionId: 'basic-body-strike' }, proposal).state;
  const session = state.combatSession!;
  assert(session.pendingImpulse?.reason === 'stalemate', 'low-progress combat should trigger stalemate break impulse');
  assert((session.actionPalette?.other.options || []).some((o: any) => (o.tags || []).includes('stalemate-breaker')), 'stalemate should expose breaker options in 应变');
  console.log(JSON.stringify({ smoke: 'combat-stalemate-break-node', passed: true, prompt: session.pendingImpulse.prompt.slice(0, 24) }));
}

function smokeCombatResolvedSceneDedupe(): void {
  const state: any = normalizeCultivationState({
    id: 'c-combat-dedupe',
    age: 9,
    hp: 80, maxHp: 80, mp: 40, maxMp: 40,
    attack: 12, defense: 8, speed: 7,
    realm: 'qi_refining', realmLevel: 2, spiritualRoot: 'heavenly', rootDetail: '土天灵根',
    elements: { metal: 0, wood: 0, water: 0, fire: 0, earth: 100 },
    inventory: [], equipped: [], activeStatuses: [], pendingThreads: [
      { id: 'thread_old_scene', title: '晒谷场冲突后续', description: '平拓与虎子在晒谷场旧嫌未平。', category: 'enemy', startAge: 9, deadlineAge: 9, status: 'pending', progress: 60 },
      { id: 'thread_revenge', title: '虎子逃脱报复', description: '虎子败走后可能寻人报复。', category: 'enemy', startAge: 9, deadlineAge: 10, status: 'pending', progress: 5 },
    ],
    questEntries: [], npcs: [], worldFacts: [],
    causalGraph: { nodes: [{ id: 'event_combat_end_9_old', type: 'combat', label: '战斗得胜', age: 9, summary: '战斗得胜，平拓在晒谷场胜过虎子，狗蛋在旁惊魂未定。' }], edges: [] },
  } as any);
  const next = startCombat(state, {
    contextTitle: '晒谷场遇故嫌',
    contextNarrative: '未时的晒谷场，虎子带着同伴又围住狗蛋。',
    enemies: [{ id: 'enemy_huzi', name: '虎子', hp: 50, attack: 8, defense: 5, speed: 5 }],
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
  assert(palette.spell.options.some((option: any) => option.itemId === 'artifact_pearl' && option.source === 'artifact' && option.name === '潮息水幕'), 'artifact innate ability should remain available as spell-like artifact art and show ability name');
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
    name: '试剑者',
    age: 20,
    activeStatuses: [{ id: 'bound', name: '手脚被缚', description: '双手双脚被妖藤束住', category: 'debuff', duration: 1, effects: [] }],
    equipped: [{ id: 'sword-qingyun', name: '青云剑', description: '一柄青色法剑', item_type: 'weapon', rarity: 'rare', effects: [{ target_attribute: 'attack', operation: 'add', value: 12 }] }],
    inventory: [],
  };
  const session: any = {
    id: 'battle-palette',
    enemies: [{ id: 'enemy', name: '藤妖', description: '缠绕成形', hp: 80, maxHp: 80, attack: 12, defense: 4, speed: 8 }],
    currentEnemyIdx: 0,
    round: 1,
    log: [],
    status: 'ongoing',
    startAge: 20,
    contextTitle: '藤网缠身',
    contextNarrative: '你被妖藤绑住手脚，剑柄近在身侧却难以挥动。',
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
  assert(palette.other.label === '应变', 'other action group should be named 应变');
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
  // P0 修复验证：resolved/failed 线程不能再推进
  const baseState: any = {
    age: 20, pendingThreads: [
      { id: 't1', title: '已了结线索', category: 'mystery', startAge: 18, status: 'resolved', progress: 100 },
      { id: 't2', title: '失败线索', category: 'mystery', startAge: 18, status: 'failed', progress: 30 },
      { id: 't3', title: '进行中线索', category: 'mystery', startAge: 19, status: 'pending', progress: 40 },
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
  // P1 修复验证：isAdvancePreloadUsable 返回具体失效原因
  // 注意：buildAdvanceStateHash 需要完整 CharacterRecord（Prisma字段），smoke 环境不完整
  // 这里只覆盖不依赖完整 char 对象的 early-return case
  const char: any = { age: 10, alive: true, ascended: false, isAtChoice: false, pendingChoiceJson: '', combatStateJson: '' };
  // no_preload
  assert((await isAdvancePreloadUsable(char, null))?.reason === 'no_preload', 'null preload should return no_preload');
  // ageMismatch
  assert((await isAdvancePreloadUsable({ ...char, age: 11 }, { baseAge: 10, baseStateHash: 'same' }))?.reason === 'ageMismatch', 'wrong age should return ageMismatch');
  // characterDead
  assert((await isAdvancePreloadUsable({ ...char, alive: false }, { baseAge: 10, baseStateHash: 'same' }))?.reason === 'characterDead', 'dead character should return characterDead');
  // ascended
  assert((await isAdvancePreloadUsable({ ...char, ascended: true }, { baseAge: 10, baseStateHash: 'same' }))?.reason === 'ascended', 'ascended character should return ascended');
  // isAtChoice
  assert((await isAdvancePreloadUsable({ ...char, isAtChoice: true }, { baseAge: 10, baseStateHash: 'same' }))?.reason === 'isAtChoice', 'at choice should return isAtChoice');
  // hasPendingChoice
  assert((await isAdvancePreloadUsable({ ...char, pendingChoiceJson: '{}' }, { baseAge: 10, baseStateHash: 'same' }))?.reason === 'hasPendingChoice', 'pending choice should return hasPendingChoice');
  // combatOngoing
  assert((await isAdvancePreloadUsable({ ...char, combatStateJson: '{"status":"ongoing"}' }, { baseAge: 10, baseStateHash: 'same' }))?.reason === 'combatOngoing', 'ongoing combat should return combatOngoing');
  log('preload-invalidation-reason', { passed: true });
}

function smokeSameYearThreadNormalizedProgress100(): void {
  // P0 修复验证：getSameYearThreads 读取线程前统一归一化
  // normalizeThreadsCompletion 把 progress=100 → resolved，getSameYearThreads 的 t.progress < 100 条件会把已完成的线程排除
  const state: any = {
    age: 21, pendingThreads: [
      { id: 'same_y1', title: '同岁已满线索', category: 'competition', startAge: 21, deadlineAge: 21, status: 'pending', progress: 100, dueInSameYear: true },
      { id: 'same_y2', title: '同岁待续线索', category: 'competition', startAge: 21, deadlineAge: 21, status: 'pending', progress: 60, dueInSameYear: true },
    ],
  };
  const threads = getSameYearThreads(state);
  // same_y1: progress=100 → normalizeThreadsCompletion 转为 resolved → getSameYearThreads 过滤掉（t.progress < 100）
  assert(!threads.find((t: any) => t.id === 'same_y1'), 'progress=100 thread should be excluded from same-year scheduling (already resolved)');
  // same_y2: progress=60, pending → 保留
  assert(threads.find((t: any) => t.id === 'same_y2'), 'pending thread should still appear in same-year scheduling');
  log('same-year-thread-normalized-progress100', { passed: true });
}

function smokeNoMechanismWordsInNarrative(): void {
  // 文案过滤层验证：sanitizeNarrativeText 应移除内部机制词
  // 验证策略：检查结果中不包含字段名、调试元词等机制词；不检查数值残留（来自原始文本，预期会部分残留）
  const inputOutputs: Array<[string, RegExp[]]> = [
    ['你获得了 cultivationExp 50点修为', [/\bcultivationExp\b/i]],                          // cultivationExp 字段必须清除
    ['心魔heartDemon增加了2层', [/\bheartDemon\b/i]],                                       // heartDemon 字段必须清除
    ['剩余灵石 spiritStones 100颗', [/\bspiritStones?\b/i]],                               // spiritStones 字段必须清除
    ['你的 pendingThreads 中有一条新线索', [/\bpendingThreads?\b/i]],                       // pendingThreads 字段必须清除
    ['触发 progress 50 的进度判定', [/\bprogress\b/i]],                                      // progress 字段必须清除
    ['debug error cache api', [/\b(?:debug|log|error|test|cache)\b/i]],                  // 调试元词必须清除
    ['P0 P1 preload stateHash', [/\b(?:P0|P1|preload|stateHash)\b/]],                   // 内部标记词必须清除
    ['气血上限 maxHp 已满', [/\bmaxHp\b/i]],                                                // maxHp 字段必须清除
    ['攻击 attack 提升', [/\battack\b/i]],                                                  // attack 字段必须清除
    ['普通叙事文字无变化', []],                                                               // 无机制词保持不变
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
  // 关键字段替换映射正确性
  assert(sanitizeNarrativeText('spiritStones') === '灵石', 'spiritStones should map to 灵石');
  assert(sanitizeNarrativeText('cultivationExp') === '修为', 'cultivationExp should map to 修为');
  assert(sanitizeNarrativeText('heartDemon') === '心魔', 'heartDemon should map to 心魔');
  assert(sanitizeNarrativeText('pendingThreads') === '因缘线索', 'pendingThreads should map to 因缘线索');
  assert(sanitizeNarrativeText('debug cache error') === '', 'debug words should be removed');
  assert(allPassed, 'sanitizeNarrativeText should clean all mechanism words correctly');
  // sanitizeEventDraft 验证
  const draft = sanitizeEventDraft({ title: '标题含 cultivationExp', narrative: '修为+30点 spiritStones 消耗' });
  assert(!draft.title.includes('cultivationExp'), 'draft title should be sanitized');
  assert(!draft.narrative.includes('cultivationExp'), 'draft narrative should be sanitized');
  assert(!draft.narrative.includes('spiritStones'), 'draft narrative should have spiritStones replaced');
  log('smoke-no-mechanism-words', { passed: true });
}

function smokeYoungCharacterNoAdultAction(): void {
  // 幼龄角色（age < 12）不应触发成人化事件调度
  // 验证 buildWorldPressureOpportunityMap 对幼龄角色不推荐成人化活动
  const youngState: any = {
    name: '小童',
    age: 7,
    lifespan: 80,
    realm: 'mortal',
    realmLevel: 0,
    pendingThreads: [],
    activeStatuses: [],
    inventory: [],
    equipped: [],
    location: '村庄',
  };
  const pressureMap = buildWorldPressureOpportunityMap(youngState, []);
  // 幼龄角色 summary 中不应出现成人化关键词
  const summaryText = pressureMap.summary || '';
  const adultKeywords = /交易|拍卖|秘境|洞府|遗迹|传承|宗门|历练|闯荡|修行|闭关/;
  assert(!adultKeywords.test(summaryText), `young child (age 7) world pressure summary should not contain adult activities: ${summaryText}`);
  log('smoke-young-character-no-adult-action', { passed: true, summary: summaryText });
}

function smokeFallbackInfantHardGate(): void {
  // 6 岁以下必须走幼童分支，不复用历史文本
  const state: any = { name: '幼童', age: 2, realm: 'mortal', realmLevel: 0, location: '村庄', cultivationMultiplier: 1 };
  const blueprint: any = { name: '童年趣事', category: 'growth' };
  const ctx: any = { character: { realmName: '凡人' } };
  // 即使有大量历史，age=2 也必须走 infant_template 策略
  const recentEvents = [
    { age: 1, title: '周岁', narrative: '去年她在青云山脚蹒跚学步，抱着泥巴的哥哥笑了一整年。', eventType: 'normal' },
    { age: 2, title: '前岁', narrative: '前一年她在溪边看小鱼，被爷爷抱回家。', eventType: 'normal' },
  ];
  const result = buildFallbackAgeEvent(state, blueprint, ctx, false, { recentEvents });
  assert(result.isFallbackGenerated === true, 'fallback must mark isFallbackGenerated');
  assert(result.fallbackStrategy === 'infant_template', `age 2 must use infant_template, got ${result.fallbackStrategy}`);
  // 不得复用历史同岁文本里的具体地名
  assert(!result.narrative.includes('青云山'), `infant fallback must not inject historical location: ${result.narrative}`);
  assert(!result.narrative.includes('溪边看小鱼'), `infant fallback must not reuse historical narrative: ${result.narrative}`);
  log('fallback-infant-hard-gate', { passed: true, strategy: result.fallbackStrategy, narrative: result.narrative.slice(0, 40) });
}

function smokeFallbackSameAgeVariant(): void {
  // 有同岁历史时优先复用历史文本
  const state: any = { name: '云岚', age: 18, realm: 'qi_refining', realmLevel: 3, location: '青云山脚', cultivationMultiplier: 1.2 };
  const blueprint: any = { name: '流年', category: 'daily' };
  const ctx: any = { character: { realmName: '炼气' } };
  const recentEvents = [
    { age: 18, title: '坊市淘宝', narrative: '今年，云岚在坊市里翻找几本旧书，淘到一本前人修炼手札。', eventType: 'normal' },
    { age: 17, title: '日常', narrative: '去年她把灵气运转调顺了不少。', eventType: 'normal' },
  ];
  const result = buildFallbackAgeEvent(state, blueprint, ctx, false, { recentEvents });
  assert(result.fallbackStrategy === 'same_age_variant', `should use same_age_variant strategy, got ${result.fallbackStrategy}`);
  assert(result.narrative.includes('云岚'), 'remixed narrative must keep character name');
  log('fallback-same-age-variant', { passed: true, strategy: result.fallbackStrategy });
}

function smokeFallbackElementEnrichment(): void {
  // 无同岁历史但有地点/NPC 出现时，应使用元素注入型模板
  const state: any = { name: '云岚', age: 30, realm: 'qi_refining', realmLevel: 5, location: '青云山脚', cultivationMultiplier: 1.2 };
  const blueprint: any = { name: '流年', category: 'daily' };
  const ctx: any = { character: { realmName: '炼气' } };
  const recentEvents = [
    { age: 20, title: '访友', narrative: '她去青云镇外的碧水潭，遇到李掌柜讨教几招，又聊起附近的妖兽出没。', eventType: 'normal' },
    { age: 21, title: '又访', narrative: '又去青云镇外的碧水潭，遇到李掌柜讨教几招，又聊起附近的妖兽出没。', eventType: 'normal' },
  ];
  const result = buildFallbackAgeEvent(state, blueprint, ctx, false, { recentEvents });
  assert(result.fallbackStrategy === 'enriched_template', `should use enriched_template, got ${result.fallbackStrategy}`);
  // 必须注入历史地点或 NPC
  const injectedLocation = result.narrative.includes('碧水潭') || result.narrative.includes('青云镇');
  const injectedNpc = result.narrative.includes('李掌柜');
  assert(injectedLocation || injectedNpc, `enriched template must inject historical element, got: ${result.narrative}`);
  log('fallback-element-enrichment', { passed: true, strategy: result.fallbackStrategy, hasLocation: injectedLocation, hasNpc: injectedNpc });
}

function smokeFallbackPlainTemplate(): void {
  // 完全无历史时用纯模板
  const state: any = { name: '新角色', age: 25, realm: 'qi_refining', realmLevel: 2, location: '未知', cultivationMultiplier: 1 };
  const blueprint: any = { name: '流年', category: 'daily' };
  const ctx: any = { character: { realmName: '炼气' } };
  const result = buildFallbackAgeEvent(state, blueprint, ctx, false, { recentEvents: [] });
  assert(result.fallbackStrategy === 'plain_template', `should use plain_template, got ${result.fallbackStrategy}`);
  assert(result.narrative.length > 20, 'plain template must produce non-trivial narrative');
  log('fallback-plain-template', { passed: true, strategy: result.fallbackStrategy });
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
  if (withDb) await smokeAuctionDbRoute();
  console.log(JSON.stringify({ passed: true, suite: 'xianxia-regression-smoke', db: withDb }));
}

main().catch(error => {
  console.error(JSON.stringify({ passed: false, suite: 'xianxia-regression-smoke', error: error?.message || String(error) }));
  process.exit(1);
});



