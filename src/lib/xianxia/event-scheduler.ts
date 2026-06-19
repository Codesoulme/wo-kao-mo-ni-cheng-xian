import type { CausalGraph, CharacterState, EventSchedulerPlan, ScheduledEventHint } from './types';

function urgencyToPriority(urgency: number | undefined): number {
  return Math.max(0, Math.min(100, Number(urgency) || 0));
}

function hintId(prefix: string, raw: string): string {
  return `seh_${prefix}_${String(raw || 'unknown').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]+/g, '_').slice(0, 60)}`;
}

function relatedCausalCount(graph: CausalGraph | undefined, refId: string | undefined): number {
  if (!graph || !refId) return 0;
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const matchedNodes = nodes.filter(n => n.refId === refId || n.id === refId).map(n => n.id);
  if (!matchedNodes.length) return 0;
  const ids = new Set(matchedNodes);
  return edges.filter(e => ids.has(e.from) || ids.has(e.to)).length;
}

export function buildEventSchedulerPlan(state: CharacterState): EventSchedulerPlan {
  const age = state.age;
  const hints: ScheduledEventHint[] = [];

  for (const q of state.questEntries || []) {
    const stage = q.stage;
    if (stage === 'completed' || stage === 'failed') continue;
    const dueSoon = typeof q.dueAge === 'number' ? q.dueAge - age : undefined;
    const causalBoost = relatedCausalCount(state.causalGraph, q.sourceThreadId);
    const priority = urgencyToPriority(q.urgency) + (dueSoon !== undefined && dueSoon <= 0 ? 30 : dueSoon !== undefined && dueSoon <= 3 ? 15 : 0) + Math.min(10, causalBoost * 2);
    hints.push({
      id: hintId('quest', q.id),
      kind: stage === 'urgent' ? 'deadline' : 'quest',
      priority,
      title: q.title,
      reason: q.currentHook || q.summary,
      sourceThreadId: q.sourceThreadId,
      dueAge: q.dueAge,
      relatedFactIds: q.realmId ? [q.realmId] : [],
      requiredAction: stage === 'urgent' ? 'advance_or_resolve' : 'advance',
    });
  }

  for (const thread of state.pendingThreads || []) {
    if (thread.status === 'resolved' || thread.status === 'failed') continue;
    const dueSoon = thread.deadlineAge - age;
    if (dueSoon <= 3 || thread.dueInSameYear || thread.status === 'urgent') {
      hints.push({
        id: hintId('thread', thread.id),
        kind: dueSoon <= 0 || thread.status === 'urgent' ? 'deadline' : 'quest',
        priority: (thread.status === 'urgent' ? 85 : 55) + (dueSoon <= 0 ? 25 : dueSoon <= 3 ? 10 : 0),
        title: thread.title,
        reason: thread.followUpHint || thread.description,
        sourceThreadId: thread.id,
        dueAge: thread.deadlineAge,
        relatedFactIds: thread.realmId ? [thread.realmId] : [],
        requiredAction: dueSoon <= 0 ? 'resolve_or_fail' : 'advance',
      });
    }
  }

  const recentFacts = (state.worldFacts || []).slice(-20);
  for (const fact of recentFacts) {
    if (fact.kind !== 'realm' && fact.kind !== 'npc' && fact.kind !== 'relationship') continue;
    hints.push({
      id: hintId('fact', fact.id),
      kind: fact.kind === 'realm' ? 'realm' : 'npc',
      priority: 25 + Math.round((fact.confidence || 0) * 20),
      title: fact.title,
      reason: fact.summary,
      relatedFactIds: [fact.id],
      requiredAction: 'echo_or_develop',
    });
  }

  const dedup = new Map<string, ScheduledEventHint>();
  for (const hint of hints) {
    const key = hint.sourceThreadId ? `thread:${hint.sourceThreadId}` : hint.id;
    const old = dedup.get(key);
    if (!old || hint.priority > old.priority) dedup.set(key, hint);
  }

  const ordered = Array.from(dedup.values()).sort((a, b) => b.priority - a.priority || (a.dueAge ?? 9999) - (b.dueAge ?? 9999)).slice(0, 12);
  return {
    generatedAtAge: age,
    focus: ordered[0],
    hints: ordered,
    warnings: ordered.some(h => h.kind === 'deadline' && h.priority >= 100) ? ['存在已经到期或极高优先级的线索，本年必须承接、完成、失败或解释无法执行。'] : [],
  };
}
