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

function continuityTextScore(text: string): number {
  const value = String(text || '');
  let score = 0;
  if (/拍卖|竞拍|拍品|落槌|黑市/.test(value)) score += 18;
  if (/盯梢|截杀|劫杀|追踪|报复|仇怨|记下一笔|神色微冷/.test(value)) score += 28;
  if (/钥|信物|秘境|洞府|禁制|旧主|传承|遗府/.test(value)) score += 22;
  if (/阴鸦客|邪修|劫修|魔修|敌|仇/.test(value)) score += 16;
  if (/三月后|半年后|不久后|入夜后|今年内|约期/.test(value)) score += 14;
  return score;
}

function threadContinuityBoost(thread: { title?: string; description?: string; followUpHint?: string; reward?: string; failureCost?: string; category?: string }): number {
  const text = [thread.title, thread.description, thread.followUpHint, thread.reward, thread.failureCost, thread.category].filter(Boolean).join('；');
  return Math.min(45, continuityTextScore(text));
}

function worldFactPriorityBoost(fact: { kind?: string; title?: string; summary?: string; tags?: string[] }): number {
  const tags = fact.tags || [];
  const text = [fact.title, fact.summary, ...tags].filter(Boolean).join('；');
  let boost = 0;
  if (fact.kind === 'faction') boost += 10;
  if (fact.kind === 'location') boost += 8;
  if (tags.includes('current')) boost += 16;
  if (tags.includes('market')) boost += 12;
  if (tags.includes('danger')) boost += 18;
  if (tags.includes('auction')) boost += 10;
  boost += Math.min(24, continuityTextScore(text) * 0.35);
  return boost;
}

export function buildEventSchedulerPlan(state: CharacterState): EventSchedulerPlan {
  const age = state.age;
  const hints: ScheduledEventHint[] = [];

  for (const q of state.questEntries || []) {
    const stage = q.stage;
    if (stage === 'completed' || stage === 'failed') continue;
    const dueSoon = typeof q.dueAge === 'number' ? q.dueAge - age : undefined;
    const causalBoost = relatedCausalCount(state.causalGraph, q.sourceThreadId);
    const continuityBoost = threadContinuityBoost({ title: q.title, description: q.summary, followUpHint: q.currentHook, reward: q.rewardHint, failureCost: q.failureHint, category: q.kind });
    const priority = urgencyToPriority(q.urgency)
      + (dueSoon !== undefined && dueSoon <= 0 ? 30 : dueSoon !== undefined && dueSoon <= 3 ? 15 : 0)
      + Math.min(10, causalBoost * 2)
      + continuityBoost;
    hints.push({
      id: hintId('quest', q.id),
      kind: stage === 'urgent' || (dueSoon !== undefined && dueSoon <= 0) ? 'deadline' : 'quest',
      priority,
      title: q.title,
      reason: [q.currentHook || q.summary, continuityBoost > 0 ? '此线索牵动近期因果，应优先自然回响。' : ''].filter(Boolean).join(' '),
      sourceThreadId: q.sourceThreadId,
      dueAge: q.dueAge,
      relatedFactIds: q.realmId ? [q.realmId] : [],
      requiredAction: stage === 'urgent' ? 'advance_or_resolve' : 'advance',
    });
  }

  for (const thread of state.pendingThreads || []) {
    if (thread.status === 'resolved' || thread.status === 'failed') continue;
    const dueSoon = thread.deadlineAge - age;
    const continuityBoost = threadContinuityBoost(thread);
    if (dueSoon <= 3 || thread.dueInSameYear || thread.status === 'urgent' || continuityBoost >= 20) {
      hints.push({
        id: hintId('thread', thread.id),
        kind: dueSoon <= 0 || thread.status === 'urgent' ? 'deadline' : 'quest',
        priority: (thread.status === 'urgent' ? 85 : 55)
          + (dueSoon <= 0 ? 25 : dueSoon <= 3 ? 10 : 0)
          + continuityBoost,
        title: thread.title,
        reason: [thread.followUpHint || thread.description, continuityBoost > 0 ? '此事牵动近期人事与物件去向，不宜沉没。' : ''].filter(Boolean).join(' '),
        sourceThreadId: thread.id,
        dueAge: thread.deadlineAge,
        relatedFactIds: thread.realmId ? [thread.realmId] : [],
        requiredAction: dueSoon <= 0 ? 'resolve_or_fail' : 'advance',
      });
    }
  }

  const recentNpcs = [...(state.npcs || [])]
    .map((npc: any) => {
      const text = [npc.name, npc.description, npc.memory, npc.role, ...(npc.tags || [])].filter(Boolean).join('；');
      const attitudeBoost = ['enemy', 'hostile'].includes(npc.attitude) ? 32 : ['friendly', 'ally'].includes(npc.attitude) ? 12 : 0;
      const relationBoost = Math.min(20, Math.abs(Number(npc.relationshipScore || 0)) * 0.5);
      const continuityBoost = continuityTextScore(text);
      const recentBoost = Math.max(0, 12 - Math.max(0, age - Number(npc.lastSeenAge || age)) * 3);
      return { npc, priority: 20 + attitudeBoost + relationBoost + continuityBoost + recentBoost };
    })
    .filter(entry => entry.priority >= 45)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
  for (const { npc, priority } of recentNpcs) {
    hints.push({
      id: hintId('npc', npc.id || npc.name),
      kind: 'npc',
      priority,
      title: npc.name,
      reason: [npc.memory || npc.description, ['enemy', 'hostile'].includes(npc.attitude) ? '此人与角色已有敌意或仇怨，适合低频回响、试探、盯梢或冲突。' : '此人与近期因果相连，可自然回响。'].filter(Boolean).join(' '),
      relatedFactIds: npc.id ? [npc.id] : [],
      requiredAction: 'echo_or_develop',
    });
  }

  const recentFacts = (state.worldFacts || []).slice(-30);
  for (const fact of recentFacts) {
    if (!['realm', 'npc', 'relationship', 'location', 'faction', 'event'].includes(fact.kind)) continue;
    const boost = worldFactPriorityBoost(fact);
    const kind = fact.kind === 'realm' ? 'realm' : fact.kind === 'npc' || fact.kind === 'relationship' ? 'npc' : 'world';
    const reasonTail = fact.kind === 'location'
      ? '此地可作为后续遭遇、交易、追踪、历练或休整的空间锚点。'
      : fact.kind === 'faction'
        ? '此势力可作为后续人情、宗门、恩怨或资源网络的背景锚点。'
        : '';
    hints.push({
      id: hintId('fact', fact.id),
      kind,
      priority: 25 + Math.round((fact.confidence || 0) * 20) + boost,
      title: fact.title,
      reason: [fact.summary, reasonTail].filter(Boolean).join(' '),
      relatedFactIds: [fact.id],
      requiredAction: boost >= 18 ? 'echo_or_develop' : 'background',
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
