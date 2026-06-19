import { validateAIBoundary } from '../src/lib/xianxia/ai-boundary-validator';
import { buildEventSchedulerPlan, buildWorldPressureOpportunityMap, deriveWorldFactStateProfile } from '../src/lib/xianxia/event-scheduler';
import { deriveWorldEventConsequences, deriveWorldFactsFromState, recordActionCausality, refreshWorldFacts } from '../src/lib/xianxia/engine';
import { appendNarrativeContractAuditEffect, appendStateChangeAuditEffect } from '../src/lib/xianxia/state-change-log';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function log(name: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ smoke: name, ...data }));
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
  const unknownCodes = validateAIBoundary(state, { ...baseOutput, narrativeContract: { narrativeFocus: 'npc', usedScheduleHintIds: ['seh_missing'], usedWorldFactIds: ['wf_missing'], usedNpcIds: ['npc_missing'], contractNote: '承接阴鸦客威胁。' } }).trace.map(t => t.code);
  assert(unknownCodes.includes('unknown_schedule_hint_reference') && unknownCodes.includes('unknown_world_fact_reference') && unknownCodes.includes('unknown_npc_contract_reference'), 'unknown narrative contract references should warn');
  const okCodes = validateAIBoundary(state, { ...baseOutput, narrativeContract: { narrativeFocus: 'npc', usedScheduleHintIds: ['seh_npc_shadow'], usedWorldFactIds: ['wf_market'], usedNpcIds: ['npc_shadow'], contractNote: '承接最大威胁阴鸦客的盯梢。' } }).trace.map(t => t.code);
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
  assert(audit?.warnings?.some((entry: any) => entry.code === 'top_schedule_focus_not_declared'), 'narrative contract audit should persist related boundary entries');
  log('hidden-audit', { passed: true, effects: effects.length, narrativeAudit: Boolean(audit) });
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
  const bid = await call({ characterId: char.id, action: 'bid', lotId: keyLot.id, bid: 5000 });
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

async function main(): Promise<void> {
  const withDb = process.argv.includes('--db');
  smokeSchedulerContinuity();
  smokeBoundaryFactChecks();
  smokeNarrativeContract();
  smokeWorldFactsLite();
  smokeFactionLocationStateProfiles();
  smokeWorldPressureOpportunityMap();
  smokeWorldEventConsequences();
  smokeActionCausality();
  smokeHiddenAudit();
  if (withDb) await smokeAuctionDbRoute();
  console.log(JSON.stringify({ passed: true, suite: 'xianxia-regression-smoke', db: withDb }));
}

main().catch(error => {
  console.error(JSON.stringify({ passed: false, suite: 'xianxia-regression-smoke', error: error?.message || String(error) }));
  process.exit(1);
});
