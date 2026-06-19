import type { AIEventOutput, CharacterState, QuestEntry, AttributeChange } from './types';

export type BoundarySeverity = 'info' | 'warning' | 'error';

export interface BoundaryValidationTrace {
  severity: BoundarySeverity;
  code: string;
  message: string;
  refId?: string;
  field?: string;
}

export interface BoundaryValidationResult {
  trace: BoundaryValidationTrace[];
  warnings: string[];
  errors: string[];
}

function pushTrace(
  trace: BoundaryValidationTrace[],
  severity: BoundarySeverity,
  code: string,
  message: string,
  extra: Partial<BoundaryValidationTrace> = {},
): void {
  trace.push({ severity, code, message, ...extra });
}

function changedThreadIds(output: AIEventOutput): Set<string> {
  return new Set([
    ...(output.advanceThreads || []).map(t => t.id).filter(Boolean),
    ...(output.completeThreadIds || []),
    ...(output.failThreadIds || []),
  ]);
}

function referencedThreadIds(output: AIEventOutput): string[] {
  return [
    ...(output.advanceThreads || []).map(t => t.id).filter(Boolean),
    ...(output.completeThreadIds || []),
    ...(output.failThreadIds || []),
  ];
}

function isHighPriorityQuest(q: QuestEntry): boolean {
  return (q.stage === 'urgent' || q.urgency >= 8) && q.stage !== 'completed' && q.stage !== 'failed';
}

function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function hasMeaningfulOverlap(a: unknown, b: unknown): boolean {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const tokens = [...new Set((left.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9_]{3,}/g) || []).filter(t => t.length >= 2))];
  return tokens.some(token => right.includes(token));
}

function outputStoryText(output: AIEventOutput): string {
  return [
    output.title,
    output.narrative,
    output.memory,
    output.cultivationInsight,
    ...(output.newThreads || []).flatMap(t => [t.title, t.description, t.followUpHint, t.reward, t.failureCost]),
    ...(output.newNpcs || []).flatMap(n => [n.name, n.description, n.memory, n.role]),
    ...(output.newStatuses || []).flatMap(s => [s.name, s.description, s.source]),
    ...(output.newItems || []).flatMap(i => [i.name, i.description, i.source]),
  ].filter(Boolean).join('；');
}

function explainsRelationshipShift(text: string): boolean {
  return /化解|和解|救命|相助|结盟|立誓|赔罪|交易|互利|误会|解开|道歉|投诚|恩情|托付|冲突|背叛|夺宝|截杀|袭击|翻脸|结怨/.test(text);
}

function isFriendly(attitude: string | undefined): boolean {
  return attitude === 'ally' || attitude === 'friendly';
}

function isHostile(attitude: string | undefined): boolean {
  return attitude === 'enemy' || attitude === 'hostile';
}

function validateThreadContinuity(state: CharacterState, output: AIEventOutput, trace: BoundaryValidationTrace[]): void {
  const existingThreads = new Set((state.pendingThreads || []).map(t => t.id));
  const touched = changedThreadIds(output);
  const touchedExisting = new Set([...touched].filter(id => existingThreads.has(id)));

  for (const id of referencedThreadIds(output)) {
    if (!existingThreads.has(id)) {
      pushTrace(trace, 'warning', 'unknown_thread_reference', `AI attempted to update unknown thread id: ${id}`, { refId: id, field: 'threads' });
    }
  }

  const newThreadIds = new Set<string>();
  for (const thread of output.newThreads || []) {
    if (!thread?.id) continue;
    if (existingThreads.has(thread.id)) {
      pushTrace(trace, 'warning', 'duplicate_thread_id', `AI created a thread using an existing id: ${thread.id}`, { refId: thread.id, field: 'newThreads' });
    }
    if (newThreadIds.has(thread.id)) {
      pushTrace(trace, 'warning', 'duplicate_new_thread_id', `AI repeated a new thread id in one output: ${thread.id}`, { refId: thread.id, field: 'newThreads' });
    }
    newThreadIds.add(thread.id);
    if (thread.deadlineAge < state.age && thread.status !== 'resolved' && thread.status !== 'failed') {
      pushTrace(trace, 'warning', 'past_deadline_new_thread', `AI created an active thread with a past deadline: ${thread.title}`, { refId: thread.id, field: 'newThreads.deadlineAge' });
    }
  }

  const closedThreads = (state.pendingThreads || []).filter(t => t.status === 'resolved' || t.status === 'failed');
  const activeThreadIds = new Set((state.pendingThreads || []).filter(t => t.status !== 'resolved' && t.status !== 'failed').map(t => t.id));
  for (const id of referencedThreadIds(output)) {
    const closed = closedThreads.find(t => t.id === id);
    if (closed) {
      pushTrace(trace, 'warning', 'closed_thread_referenced', `AI tried to mutate a closed thread: ${closed.title}`, { refId: id, field: 'threads' });
    }
  }

  for (const thread of output.newThreads || []) {
    const similarClosed = closedThreads.find(old => hasMeaningfulOverlap(old.title, thread.title) || hasMeaningfulOverlap(old.description, thread.description));
    if (similarClosed) {
      pushTrace(trace, 'warning', 'closed_thread_reopened_as_new', `AI may be reopening a closed thread as new: ${thread.title}`, { refId: thread.id, field: 'newThreads' });
    }
    if (thread.sourceEventTitle && closedThreads.some(old => hasMeaningfulOverlap(old.sourceEventTitle, thread.sourceEventTitle))) {
      pushTrace(trace, 'info', 'new_thread_from_closed_source', `AI created a thread from a previously closed source event: ${thread.title}`, { refId: thread.id, field: 'newThreads.sourceEventTitle' });
    }
    if (thread.status !== 'resolved' && thread.status !== 'failed' && thread.id && activeThreadIds.has(thread.id)) {
      pushTrace(trace, 'warning', 'active_thread_duplicate_reference', `AI created a new active thread with an id already active: ${thread.id}`, { refId: thread.id, field: 'newThreads.id' });
    }
  }

  const highPriority = (state.questEntries || []).filter(isHighPriorityQuest);
  const hasThreadMutation = touchedExisting.size > 0 || Boolean(output.newThreads?.length);
  const narrativeText = `${output.title || ''} ${output.narrative || ''}`;
  for (const quest of highPriority.slice(0, 5)) {
    const mentioned = narrativeText.includes(quest.title) || narrativeText.includes(quest.sourceThreadId);
    if (!touched.has(quest.sourceThreadId) && !mentioned && !hasThreadMutation) {
      pushTrace(trace, 'warning', 'unaddressed_high_priority_quest', `High-priority quest was not addressed by AI output: ${quest.title}`, { refId: quest.sourceThreadId, field: 'questEntries' });
    }
  }
}

function validateAttributeChanges(output: AIEventOutput, trace: BoundaryValidationTrace[]): void {
  for (const change of output.changes || []) {
    const c = change as AttributeChange;
    if (!Number.isFinite(Number(c.delta))) {
      pushTrace(trace, 'warning', 'non_numeric_attribute_delta', `AI emitted non-numeric attribute delta for ${c.attribute}`, { field: 'changes' });
      continue;
    }
    const delta = Math.abs(Number(c.delta));
    if (delta >= 100000) {
      pushTrace(trace, 'warning', 'extreme_attribute_delta', `AI emitted an extreme attribute delta: ${c.attribute} ${c.delta}`, { field: 'changes', refId: c.attribute });
    }
    if (!c.reason || String(c.reason).trim().length < 2) {
      pushTrace(trace, 'info', 'missing_change_reason', `AI attribute change lacks a clear reason: ${c.attribute}`, { field: 'changes.reason', refId: c.attribute });
    }
  }
}

function validateItemConsistency(state: CharacterState, output: AIEventOutput, trace: BoundaryValidationTrace[]): void {
  const inventory = state.inventory || [];
  const equipped = state.equipped || [];
  const heldIds = new Set([...inventory, ...equipped].map(i => i.id).filter(Boolean));
  const inventoryIds = new Set(inventory.map(i => i.id).filter(Boolean));
  const equippedIds = new Set(equipped.map(i => i.id).filter(Boolean));
  const knownNames = [...inventory, ...equipped].map(i => normalizeText(i.name)).filter(Boolean);

  for (const id of output.removedItemIds || []) {
    if (!heldIds.has(id)) {
      pushTrace(trace, 'warning', 'removed_unknown_item', `AI attempted to remove an item not currently held: ${id}`, { refId: id, field: 'removedItemIds' });
    }
  }
  for (const id of output.equipItemIds || []) {
    if (!inventoryIds.has(id) && !equippedIds.has(id)) {
      pushTrace(trace, 'warning', 'equip_unknown_item', `AI attempted to equip an item not currently available: ${id}`, { refId: id, field: 'equipItemIds' });
    }
  }
  for (const id of output.unequipItemIds || []) {
    if (!equippedIds.has(id)) {
      pushTrace(trace, 'warning', 'unequip_unknown_item', `AI attempted to unequip an item not currently equipped: ${id}`, { refId: id, field: 'unequipItemIds' });
    }
  }
  for (const item of [...(output.newItems || []), ...(output.newEquippedItems || [])]) {
    if (item.id && heldIds.has(item.id)) {
      pushTrace(trace, 'warning', 'new_item_duplicate_id', `AI created an item using an existing held id: ${item.id}`, { refId: item.id, field: 'newItems.id' });
    }
    const name = normalizeText(item.name);
    if (name && knownNames.includes(name)) {
      pushTrace(trace, 'info', 'new_item_duplicate_name', `AI created another item with an existing held name: ${item.name}`, { refId: item.id, field: 'newItems.name' });
    }
  }
}

function validateNpcConsistency(state: CharacterState, output: AIEventOutput, trace: BoundaryValidationTrace[]): void {
  const existing = state.npcs || [];
  const text = outputStoryText(output);
  for (const npc of output.newNpcs || []) {
    const old = existing.find(n => (npc.id && n.id === npc.id) || hasMeaningfulOverlap(n.name, npc.name));
    if (!old) continue;
    const nextAttitude = String(npc.attitude || old.attitude || 'unknown');
    if (isHostile(old.attitude) && isFriendly(nextAttitude) && !explainsRelationshipShift(text)) {
      pushTrace(trace, 'warning', 'npc_hostile_to_friendly_without_cause', `AI changed hostile NPC toward friendly without clear narrative cause: ${old.name}`, { refId: old.id, field: 'newNpcs.attitude' });
    }
    if (isFriendly(old.attitude) && isHostile(nextAttitude) && !explainsRelationshipShift(text)) {
      pushTrace(trace, 'warning', 'npc_friendly_to_hostile_without_cause', `AI changed friendly NPC toward hostile without clear narrative cause: ${old.name}`, { refId: old.id, field: 'newNpcs.attitude' });
    }
    const scoreDelta = Math.abs(Number(npc.relationshipScore ?? old.relationshipScore) - Number(old.relationshipScore || 0));
    if (scoreDelta >= 50 && !explainsRelationshipShift(text)) {
      pushTrace(trace, 'warning', 'npc_relationship_jump_without_cause', `AI changed NPC relationship score sharply without clear narrative cause: ${old.name}`, { refId: old.id, field: 'newNpcs.relationshipScore' });
    }
  }

  for (const enemy of output.triggerCombat?.enemies || []) {
    const old = existing.find(n => hasMeaningfulOverlap(n.name, enemy.name));
    if (old && isFriendly(old.attitude) && !explainsRelationshipShift(text)) {
      pushTrace(trace, 'warning', 'friendly_npc_used_as_enemy_without_cause', `AI used a friendly NPC as combat enemy without clear conflict cause: ${old.name}`, { refId: old.id, field: 'triggerCombat.enemies' });
    }
  }
}

function validateWorldFactConsistency(state: CharacterState, output: AIEventOutput, trace: BoundaryValidationTrace[]): void {
  const text = outputStoryText(output);
  const closedThreadTitles = (state.pendingThreads || [])
    .filter(t => t.status === 'resolved' || t.status === 'failed')
    .map(t => t.title)
    .filter(Boolean);
  for (const title of closedThreadTitles.slice(0, 20)) {
    if (hasMeaningfulOverlap(text, title) && !/旧事|余波|传闻|后果|清算|回忆|遗留|残波|复盘/.test(text)) {
      pushTrace(trace, 'info', 'closed_thread_mentioned_without_aftermath_frame', `AI mentioned a closed thread without clearly framing it as aftermath: ${title}`, { field: 'narrative' });
    }
  }

  const factTitles = (state.worldFacts || []).map(f => normalizeText(f.title)).filter(Boolean);
  const newWorldObjects = [
    ...(output.newItems || []).map(i => i.name),
    ...(output.newStatuses || []).map(st => st.name),
    ...(output.newThreads || []).map(t => t.title),
    ...(output.newNpcs || []).map(n => n.name),
  ].filter(Boolean);
  for (const name of newWorldObjects) {
    const normalized = normalizeText(name);
    if (normalized && factTitles.includes(normalized)) {
      pushTrace(trace, 'info', 'generated_name_matches_existing_world_fact', `AI generated content whose name matches an existing world fact: ${name}`, { field: 'worldFacts' });
    }
  }
}

function validateNarrativeContract(state: CharacterState, output: AIEventOutput, trace: BoundaryValidationTrace[]): void {
  const contract = output.narrativeContract;
  const schedule = (state as any).eventSchedule;
  const focus = schedule?.focus;
  const pressureMap = schedule?.pressureMap;
  const hasStrongPressure = Boolean(pressureMap?.summary) || Boolean(focus && focus.priority >= 80);
  const story = outputStoryText(output);

  if (!contract) {
    if (hasStrongPressure) {
      pushTrace(trace, 'warning', 'missing_narrative_contract', 'AI did not declare narrativeContract despite available world pressure/scheduler focus.', { field: 'narrativeContract' });
    }
    return;
  }

  const validFocus = new Set(['threat', 'opportunity', 'location', 'npc', 'faction', 'realm', 'daily']);
  if (contract.narrativeFocus && !validFocus.has(contract.narrativeFocus)) {
    pushTrace(trace, 'warning', 'invalid_narrative_focus', `AI declared invalid narrative focus: ${contract.narrativeFocus}`, { field: 'narrativeContract.narrativeFocus' });
  }

  const validOutcome = new Set(['advanced', 'resolved', 'failed', 'deferred', 'echoed', 'ignored']);
  if (contract.narrativeOutcome && !validOutcome.has(contract.narrativeOutcome)) {
    pushTrace(trace, 'warning', 'invalid_narrative_outcome', `AI declared invalid narrative outcome: ${contract.narrativeOutcome}`, { field: 'narrativeContract.narrativeOutcome' });
  }

  const knownHintIds = new Set((schedule?.hints || []).map(h => h.id));
  for (const id of contract.usedScheduleHintIds || []) {
    if (!knownHintIds.has(id)) {
      pushTrace(trace, 'warning', 'unknown_schedule_hint_reference', `AI narrativeContract referenced unknown schedule hint id: ${id}`, { refId: id, field: 'narrativeContract.usedScheduleHintIds' });
    }
  }

  const knownFactIds = new Set((state.worldFacts || []).map(f => f.id));
  for (const id of contract.usedWorldFactIds || []) {
    if (!knownFactIds.has(id)) {
      pushTrace(trace, 'warning', 'unknown_world_fact_reference', `AI narrativeContract referenced unknown world fact id: ${id}`, { refId: id, field: 'narrativeContract.usedWorldFactIds' });
    }
  }

  const knownNpcIds = new Set((state.npcs || []).map(n => n.id));
  for (const id of contract.usedNpcIds || []) {
    if (!knownNpcIds.has(id)) {
      pushTrace(trace, 'warning', 'unknown_npc_contract_reference', `AI narrativeContract referenced unknown NPC id: ${id}`, { refId: id, field: 'narrativeContract.usedNpcIds' });
    }
  }

  const usedSomething = Boolean(
    contract.narrativeFocus ||
    contract.narrativeOutcome ||
    contract.contractNote ||
    contract.usedScheduleHintIds?.length ||
    contract.usedWorldFactIds?.length ||
    contract.usedNpcIds?.length
  );
  if (hasStrongPressure && !usedSomething) {
    pushTrace(trace, 'warning', 'empty_narrative_contract_under_pressure', 'AI emitted an empty narrativeContract despite strong pressure/opportunity context.', { field: 'narrativeContract' });
  }

  if (focus && focus.priority >= 90) {
    const focusUsed = (contract.usedScheduleHintIds || []).includes(focus.id) || hasMeaningfulOverlap(story, focus.title) || hasMeaningfulOverlap(contract.contractNote, focus.title);
    if (!focusUsed) {
      pushTrace(trace, 'info', 'top_schedule_focus_not_declared', `AI did not clearly declare or mention the top schedule focus: ${focus.title}`, { refId: focus.id, field: 'narrativeContract.usedScheduleHintIds' });
    }
  }

  if (pressureMap && contract.narrativeFocus === 'daily' && (pressureMap.topThreat || pressureMap.topOpportunity)) {
    const mentionsPressure = hasMeaningfulOverlap(story, pressureMap.topThreat) || hasMeaningfulOverlap(story, pressureMap.topOpportunity) || hasMeaningfulOverlap(contract.contractNote, pressureMap.summary);
    if (!mentionsPressure) {
      pushTrace(trace, 'info', 'daily_focus_ignores_pressure_map', 'AI chose daily focus while pressure/opportunity map has stronger anchors.', { field: 'narrativeContract.narrativeFocus' });
    }
  }
}

function validateRewardsAndCombat(state: CharacterState, output: AIEventOutput, trace: BoundaryValidationTrace[]): void {
  const totalNewItems = (output.newItems?.length || 0) + (output.newEquippedItems?.length || 0) + (output.triggerCombat?.victoryDrops?.length || 0);
  if (totalNewItems > 12) {
    pushTrace(trace, 'warning', 'excessive_item_rewards', `AI output contains many item rewards at once: ${totalNewItems}`, { field: 'newItems' });
  }

  const spiritStoneChange = (output.changes || []).find(c => c.attribute === 'spiritStones');
  if (spiritStoneChange && Math.abs(Number(spiritStoneChange.delta || 0)) > Math.max(10000, (state.spiritStones || 0) * 20 + 1000)) {
    pushTrace(trace, 'warning', 'extreme_spirit_stone_delta', `AI emitted a very large spirit stone change: ${spiritStoneChange.delta}`, { field: 'changes.spiritStones' });
  }

  const combat = output.triggerCombat;
  if (combat?.enemies?.length) {
    if (output.hasChoice) {
      pushTrace(trace, 'info', 'combat_deferred_by_choice', 'AI output has both choice and combat; engine will defer combat until choice resolution.', { field: 'triggerCombat' });
    }
    if (!combat.contextTitle || !combat.contextNarrative) {
      pushTrace(trace, 'warning', 'combat_missing_context', 'AI combat trigger lacks context title or narrative.', { field: 'triggerCombat' });
    }
    for (const enemy of combat.enemies) {
      if (!enemy.name || enemy.hp <= 0 || enemy.attack < 0 || enemy.defense < 0) {
        pushTrace(trace, 'warning', 'invalid_combat_enemy', `AI emitted an invalid combat enemy: ${enemy.name || '(unnamed)'}`, { field: 'triggerCombat.enemies', refId: enemy.id });
      }
    }
  }
}

export function validateAIBoundary(state: CharacterState, output: AIEventOutput): BoundaryValidationResult {
  const trace: BoundaryValidationTrace[] = [];

  validateThreadContinuity(state, output, trace);
  validateItemConsistency(state, output, trace);
  validateNpcConsistency(state, output, trace);
  validateWorldFactConsistency(state, output, trace);
  validateNarrativeContract(state, output, trace);
  validateAttributeChanges(output, trace);
  validateRewardsAndCombat(state, output, trace);

  return {
    trace,
    warnings: trace.filter(t => t.severity === 'warning').map(t => t.message),
    errors: trace.filter(t => t.severity === 'error').map(t => t.message),
  };
}

