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
  validateAttributeChanges(output, trace);
  validateRewardsAndCombat(state, output, trace);

  return {
    trace,
    warnings: trace.filter(t => t.severity === 'warning').map(t => t.message),
    errors: trace.filter(t => t.severity === 'error').map(t => t.message),
  };
}

