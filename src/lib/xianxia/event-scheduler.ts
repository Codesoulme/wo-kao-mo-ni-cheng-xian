// 事件调度器 / 世界舆图（src/lib/xianxia/event-scheduler.ts）
//
// 修真感连续性的"调度层"：把 state 中的 NPC / 未决线索 / 世界事实 / 因果图
// 融合为"事件调度计划（EventSchedulerPlan）" + "世界压力与机会舆图（PressureMap）"，
// 供 AI 在生成事件时承接最高优先级的 NPC 自主倾向、威胁回响、地点/势力画像。
//
// 设计原则：
// 1. **不抛异常** —— 纯函数；state 字段缺失按"宽容通过"返回空骨架。
// 2. **沉浸版** —— reason / summary 用中文修仙叙事口吻；
//    禁止暴露"概率/算法/引擎/字段/枚举/score"等机制词；
//    NPC 自主倾向 echo 用"仇怨未消/暗中筹谋/截杀/劫财/复仇/转移目标"等叙事语。
// 3. **复用 ai-boundary-validator 的 trace pattern** —— warning 字符串遵循中文修真口吻。
// 4. **不修改已有逻辑** —— 仅在新建文件 + 新增依赖方向扩展。
//
// 三个对外函数：
// - buildEventSchedulerPlan(state) → EventSchedulerPlan
// - buildWorldPressureOpportunityMap(state, hints?) → PressureMap
// - deriveWorldFactStateProfile(fact, character) → { summary } | null
//
// — 修真感 AI 项目 by Codesoulme

import type {
  PressureMap,
  PressureEventType,
  ScheduleFocus,
  ScheduleHint,
  ScheduleHintKind,
  NarrativeContractFeedback,
  WorldFact,
  WorldFactKind,
} from './types';

// ==================== 内部小工具 ====================

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function safeStr(v: any): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function safeNum(v: any, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function limitReason(text: string, max = 80): string {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function limitSummary(text: string, max = 80): string {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function npcAttitude(att: any): 'hostile' | 'friendly' | 'neutral' | 'unknown' {
  const a = safeStr(att);
  if (a === 'enemy' || a === 'hostile') return 'hostile';
  if (a === 'ally' || a === 'friendly') return 'friendly';
  if (a === 'neutral' || a === 'cautious') return 'neutral';
  return 'unknown';
}

function threatScore(npc: any): number {
  if (!npc) return 0;
  const att = npcAttitude(npc.attitude);
  const base = att === 'hostile' ? 60 : att === 'unknown' ? 20 : att === 'neutral' ? 10 : 0;
  const rel = Math.abs(safeNum(npc.relationshipScore));
  const recent = safeNum(npc.lastSeenAge) >= 0 ? 6 : 0;
  const tags = Array.isArray(npc.tags) ? npc.tags : [];
  const tagBoost = tags.includes('aftermath') ? 14 : tags.includes('auction') ? 8 : tags.includes('rivalry') ? 12 : 0;
  return base + Math.min(40, rel) + recent + tagBoost;
}

function opportunityScore(fact: any, state: any): number {
  if (!fact) return 0;
  let score = 30;
  if (fact.kind === 'realm') score += 30;
  if (fact.kind === 'location') score += 18;
  if (fact.kind === 'event' && Array.isArray(fact.tags) && fact.tags.includes('auction')) score += 14;
  const tags = Array.isArray(fact.tags) ? fact.tags : [];
  if (tags.includes('market')) score += 12;
  if (tags.includes('realm-hint')) score += 22;
  if (tags.includes('event-consequence')) score += 8;
  const ageDelta = safeNum(state?.age) - safeNum(fact.lastSeenAge);
  if (ageDelta >= 0 && ageDelta <= 5) score += 8;
  return score;
}

function factionPressureScore(fact: any, state: any): number {
  if (!fact || fact.kind !== 'faction') return 0;
  let score = 35;
  const tags = Array.isArray(fact.tags) ? fact.tags : [];
  if (tags.includes('hostile')) score += 35;
  if (tags.includes('danger')) score += 12;
  if (tags.includes('current')) score += 6;
  const npcs = asArray<any>(state?.npcs);
  const linkedNpcs = npcs.filter(n => safeStr(n?.faction) === safeStr(fact.title));
  score += Math.min(30, linkedNpcs.length * 12);
  return score;
}

function locationRiskScore(fact: any, state: any): number {
  if (!fact || fact.kind !== 'location') return 0;
  let score = 25;
  const tags = Array.isArray(fact.tags) ? fact.tags : [];
  if (tags.includes('market')) score += 14;
  if (tags.includes('auction')) score += 10;
  if (tags.includes('event-consequence')) score += 12;
  const hostileNpcsNear = asArray<any>(state?.npcs).filter(n => {
    const att = npcAttitude(n?.attitude);
    return (att === 'hostile' || att === 'unknown') && safeStr(n?.lastKnownLocation) === safeStr(fact.title);
  });
  score += Math.min(25, hostileNpcsNear.length * 10);
  return score;
}

function questUrgency(thread: any, state: any): number {
  if (!thread) return 0;
  const urgency = safeNum(thread.urgency, 50);
  const due = safeNum(thread.dueAge, 0);
  const age = safeNum(state?.age, 0);
  const remaining = due - age;
  const dueBoost = remaining <= 0 ? 30 : remaining <= 2 ? 18 : remaining <= 5 ? 8 : 0;
  const statusBoost = safeStr(thread.status) === 'urgent' ? 16 : 0;
  const progress = safeNum(thread.progress);
  const progressBoost = progress >= 80 ? 8 : progress >= 50 ? 4 : 0;
  return clamp(urgency + dueBoost + statusBoost + progressBoost, 0, 100);
}

function npcAutonomousEchoReason(npc: any): string {
  if (!npc) return '';
  const att = npcAttitude(npc.attitude);
  const faction = safeStr(npc.faction);
  const memory = safeStr(npc.memory);
  const tags = Array.isArray(npc.tags) ? npc.tags : [];
  const auctionTail = tags.includes('auction') || tags.includes('aftermath') || tags.includes('rivalry')
    ? '；拍卖余波可转为盯梢、探价、截杀、交易谈判或借人试探'
    : '';
  if (att === 'hostile') {
    return faction
      ? `自主倾向：背后牵连${faction}，可能盯梢、散播消息、设伏截杀，或因利益暂作交易${auctionTail}`
      : `自主倾向：可能盯梢、散播消息、设伏截杀、暗中复仇，或因利益暂作交易${auctionTail}`;
  }
  if (att === 'friendly') {
    return faction
      ? `自主倾向：背后牵连${faction}，可能递信、引荐、求助、赠予小资源或危急相助`
      : `自主倾向：可能递信、引荐、求助、赠予小资源或危急相助`;
  }
  if (faction) {
    return `自主倾向：背后牵连${faction}，可通过传讯、任务、盘问、邀约、追责或交易需求回响${memory ? `；旧忆：${limitReason(memory, 28)}` : ''}`;
  }
  return `自主倾向：可低频以传闻、偶遇、打听或旁人口风自然回响${memory ? `；旧忆：${limitReason(memory, 28)}` : ''}`;
}

function eventTypeForHint(kind: ScheduleHintKind, hint: any): PressureEventType {
  if (kind === 'quest' && safeStr(hint?.relatedFactIds?.[0])) return '秘境异动';
  if (kind === 'npc') {
    const att = safeStr(hint?._attitude);
    if (att === 'hostile') return '威胁回响';
    if (att === 'friendly') return '机缘推进';
    return '势力施压';
  }
  if (kind === 'world') return '秘境异动';
  if (kind === 'faction') return '势力施压';
  if (kind === 'location') return '日常回响';
  if (kind === 'echo') return '威胁回响';
  return '机缘推进';
}

// ==================== 调度项生成 ====================

function buildThreadHint(thread: any, state: any): ScheduleHint | null {
  if (!thread) return null;
  const id = safeStr(thread.id);
  if (!id) return null;
  const status = safeStr(thread.status) || 'pending';
  if (status === 'resolved' || status === 'failed' || status === 'closed') return null;
  const priority = questUrgency(thread, state);
  const due = safeNum(thread.dueAge, 0);
  const age = safeNum(state?.age, 0);
  const remaining = due - age;
  let stage: ScheduleHint['resolutionStage'] = 'open';
  let resolutionHint: string | undefined;
  if (remaining <= 0) {
    stage = 'escalating';
    resolutionHint = '约期已至：本轮应了结、推进或失败，勿令线索原地踏步';
  } else if (remaining <= 2) {
    stage = 'escalating';
    resolutionHint = '约期将至：本轮应明显推进，完成或失败皆可';
  } else if (status === 'urgent') {
    stage = 'escalating';
    resolutionHint = '已挂 urgent：本轮必须推进、完成或失败';
  } else {
    stage = 'open';
  }
  const followUp = safeStr(thread.followUpHint);
  const reasonCore = followUp
    ? `未决线索回响：${limitReason(followUp, 56)}`
    : `未决线索回响：${limitReason(safeStr(thread.description) || safeStr(thread.title) || '线索尚待承接', 56)}`;
  return {
    id: `seh_thread_${id}`,
    kind: 'quest',
    title: safeStr(thread.title) || id,
    reason: limitReason(reasonCore, 80),
    priority,
    requiredAction: stage === 'escalating' ? 'resolve' : 'advance',
    resolutionStage: stage,
    resolutionHint: resolutionHint ? limitReason(resolutionHint, 80) : undefined,
    sourceThreadId: id,
  };
}

function buildNpcHint(npc: any, _state: any): ScheduleHint | null {
  if (!npc) return null;
  const id = safeStr(npc.id);
  if (!id) return null;
  const name = safeStr(npc.name) || id;
  const baseThreat = threatScore(npc);
  if (baseThreat <= 0) return null;
  const priority = clamp(Math.round(baseThreat * 0.9 + 8), 30, 95);
  const reason = limitReason(npcAutonomousEchoReason(npc), 80);
  const att = npcAttitude(npc.attitude);
  const requiredAction = att === 'hostile' ? 'echo_or_develop' : 'echo';
  const stage: ScheduleHint['resolutionStage'] = baseThreat >= 60 ? 'escalating' : 'open';
  const hint: ScheduleHint = {
    id: `seh_npc_${id}`,
    kind: 'npc',
    title: name,
    reason,
    priority,
    requiredAction,
    resolutionStage: stage,
    sourceThreadId: safeStr(npc.relatedThreadIds?.[0]) || undefined,
    relatedNpcIds: [id],
  };
  // 内部标记，便于 eventTypeForHint 决策
  (hint as any)._attitude = att;
  return hint;
}

function buildWorldFactHint(fact: any, state: any): ScheduleHint | null {
  if (!fact) return null;
  const id = safeStr(fact.id);
  if (!id) return null;
  const tags = Array.isArray(fact.tags) ? fact.tags : [];
  const isConsequence = tags.includes('event-consequence');
  const isLocation = fact.kind === 'location';
  const isFaction = fact.kind === 'faction';
  const title = safeStr(fact.title) || id;
  let reason = '';
  let priority = 35;
  // 注：smoke 中 `kind === 'world'` 期望覆盖 location/realm/event/faction；
  // location/faction 用 reason 区分（"地点画像"/"势力画像"/"秘境异动"/"世界事件余波"）。
  let kind: ScheduleHintKind = 'world';
  if (isLocation) {
    const risk = locationRiskScore(fact, state);
    priority = clamp(Math.round(risk * 0.9 + 12), 30, 80);
    reason = `地点画像：${title}当前危险度可察、交易活跃，近期传闻未散`;
  } else if (isFaction) {
    const fp = factionPressureScore(fact, state);
    priority = clamp(Math.round(fp * 0.85 + 10), 30, 90);
    reason = `势力画像：${title}对角色留有追责压力，观察倾向未消，且关联 NPC 仍有动作`;
  } else if (isConsequence) {
    priority = clamp(Math.round(opportunityScore(fact, state) * 0.8 + 14), 30, 80);
    reason = `世界事件余波：${title}——${limitReason(safeStr(fact.summary) || '余波未散', 48)}`;
  } else if (fact.kind === 'realm') {
    priority = clamp(Math.round(opportunityScore(fact, state) * 0.9 + 14), 35, 85);
    reason = `秘境异动：${title}——${limitReason(safeStr(fact.summary) || '可循此缘探访', 48)}`;
  } else {
    priority = 35;
    reason = `世界事实：${title}——${limitReason(safeStr(fact.summary) || '可承接', 48)}`;
  }
  return {
    id: `seh_fact_${id}`,
    kind,
    title,
    reason: limitReason(reason, 80),
    priority,
    requiredAction: isLocation || isFaction ? 'echo_or_develop' : 'echo',
    resolutionStage: 'open',
    relatedFactIds: [id],
  };
}

// ==================== 反馈调整 ====================

interface FeedbackAdjustments {
  cools: Map<string, number>;       // hintId -> 降温幅度
  warms: Map<string, number>;       // hintId -> 升温幅度
  resolutions: Set<string>;          // 已 resolve 的 hint id
  carryoverWarnings: string[];      // 承接不足 warning
}

function applyNarrativeFeedback(
  hints: ScheduleHint[],
  state: any,
  warnings: string[]
): void {
  const feedback = asArray<NarrativeContractFeedback>(state?.narrativeContractFeedback);
  if (!feedback.length) return;
  const adj: FeedbackAdjustments = { cools: new Map(), warms: new Map(), resolutions: new Set(), carryoverWarnings: [] };
  for (const fb of feedback.slice(-6)) {
    const usedIds = asArray<string>(fb.usedScheduleHintIds);
    const focusHintId = safeStr(fb.focusHintId);
    const warnCodeArr = asArray<string>(fb.warningCodes);
    const warnHasTopFocus = warnCodeArr.some((c: string) => String(c).includes('top_schedule_focus_not_declared'));
    const explicitOutcome = safeStr(fb.narrativeOutcome);
    const outcome = explicitOutcome || (warnHasTopFocus ? 'ignored' : (usedIds.length > 0 ? 'advanced' : 'deferred'));
    for (const hid of usedIds) {
      if (outcome === 'resolved') {
        adj.resolutions.add(hid);
        adj.cools.set(hid, (adj.cools.get(hid) || 0) + 18);
      } else if (outcome === 'advanced' || outcome === 'deferred' || outcome === 'complicated') {
        adj.cools.set(hid, (adj.cools.get(hid) || 0) + 6);
      }
    }
    // 高压焦点未承接（ignored 或 包含 top_schedule_focus_not_declared warning）
    if (focusHintId && (outcome === 'ignored' || warnHasTopFocus)) {
      adj.warms.set(focusHintId, (adj.warms.get(focusHintId) || 0) + 22);
      const warnCodeStr = warnCodeArr.join(',');
      if (warnCodeStr.includes('top_schedule_focus_not_declared') || safeStr(fb.topThreat)) {
        adj.carryoverWarnings.push(`${safeStr(fb.focusHintTitle) || safeStr(fb.topThreat) || '上一焦点'}承接不足，应在本轮补回`);
      }
    }
    // 承接了 schedule hint 但 narrativeOutcome 为 ignored 时仍记为承接不足
    if (outcome === 'ignored' && usedIds.length === 0 && safeStr(fb.topThreat)) {
      adj.carryoverWarnings.push(`${safeStr(fb.topThreat)}承接不足，应在本轮补回`);
    }
  }
  // 应用调整
  for (const hint of hints) {
    const baseReason = hint.reason;
    if (adj.resolutions.has(hint.id)) {
      hint.priority = Math.max(20, hint.priority - 22);
      hint.resolutionStage = 'resolved';
      hint.resolutionHint = '已完成承接：本轮低频回响或换角度承接即可';
      hint.reason = limitReason(`${baseReason}；记忆潮汐：上一轮已了结，权重渐退`, 80);
      continue;
    }
    const cool = adj.cools.get(hint.id);
    if (cool) {
      hint.priority = Math.max(20, hint.priority - cool);
      if (cool >= 12) hint.resolutionStage = 'cooling';
      hint.reason = limitReason(`${baseReason}；记忆潮汐：近期已多次承接，权重渐退`, 80);
    }
    const warm = adj.warms.get(hint.id);
    if (warm) {
      hint.priority = Math.min(98, hint.priority + warm);
      hint.resolutionStage = 'escalating';
      hint.resolutionHint = hint.resolutionHint || '高压焦点前轮未承接：本轮必须明显推进或解释暂缓';
      hint.reason = limitReason(`${baseReason}；记忆潮汐：前轮承接不足，权重回升`, 80);
    }
  }
  // 承接不足警告入栈
  for (const w of adj.carryoverWarnings) {
    if (!warnings.includes(w)) warnings.push(w);
  }
}

function resolveThreadHintsByState(hints: ScheduleHint[], state: any): void {
  // 已 resolved/failed 的线索不出现；若 pendingThreads 状态显示 resolved 也置为 resolved
  const threadStatusById = new Map<string, string>();
  for (const t of asArray<any>(state?.pendingThreads)) {
    const id = safeStr(t?.id);
    if (id) threadStatusById.set(id, safeStr(t?.status) || 'pending');
  }
  for (const h of hints) {
    if (h.kind !== 'quest' || !h.sourceThreadId) continue;
    const st = threadStatusById.get(h.sourceThreadId);
    if (st === 'resolved') {
      h.resolutionStage = 'resolved';
      h.priority = Math.max(20, h.priority - 18);
      h.resolutionHint = '线索已了结：本轮低频回响或换承接对象';
    } else if (st === 'failed') {
      h.resolutionStage = 'failed';
      h.priority = Math.max(20, h.priority - 14);
      h.resolutionHint = '线索已失败：可低频回响残响或另起新线';
    }
  }
  // 标记 wf_old 这种"已确认但已结"worldFact —— 针对 echo/world kind，避免覆盖 NPC cooling
  for (const h of hints) {
    if (h.kind !== 'echo' && h.kind !== 'world') continue;
    if (h.relatedFactIds && h.relatedFactIds.length) {
      const f = asArray<any>(state?.worldFacts).find(w => safeStr(w?.id) === h.relatedFactIds![0]);
      if (f && safeStr(f.kind) === 'event') {
        const tags = Array.isArray(f.tags) ? f.tags : [];
        if (tags.includes('consequence') && !tags.includes('event-consequence')) {
          h.resolutionStage = 'resolved';
          h.priority = Math.max(20, h.priority - 16);
          h.resolutionHint = h.resolutionHint || '此事已了：低频回响旧人口风即可';
        }
      }
    }
  }
}

// ==================== 舆图生成 ====================

export function buildWorldPressureOpportunityMap(
  state: any,
  hints?: ScheduleHint[]
): PressureMap {
  const allHints = hints || [];
  const npcs = asArray<any>(state?.npcs);
  const facts = asArray<any>(state?.worldFacts);

  // 威胁：最 hostile 的 NPC；如 hint 内含 seh_npc_* 也并入
  const hostileNpcs = npcs
    .filter(n => npcAttitude(n?.attitude) === 'hostile')
    .map(n => ({ n, score: threatScore(n) }))
    .sort((a, b) => b.score - a.score);
  let topThreat = hostileNpcs[0]?.n?.name || '';
  // 若 NPC 来自势力（如 黑鸦会）且 NPC 为匿名，优先暴露势力名
  if (!topThreat && hostileNpcs.length === 0) {
    const hostileFaction = facts
      .filter(f => f.kind === 'faction' && Array.isArray(f.tags) && (f.tags as string[]).includes('hostile'))
      .map(f => ({ f, score: factionPressureScore(f, state) }))
      .sort((a, b) => b.score - a.score)[0];
    if (hostileFaction) topThreat = hostileFaction.f.title;
  }
  if (!topThreat) {
    const fallback = facts.find(f => f.kind === 'faction') || hostileNpcs[0]?.n;
    if (fallback) topThreat = safeStr(fallback.title || fallback.name) || '暗中窥伺之人';
  }
  if (!topThreat) topThreat = '暗中窥伺之人';

  // 机会：最 opportunity 的 worldFact
  const oppFacts = facts
    .filter(f => ['location', 'realm', 'event'].includes(f.kind))
    .map(f => ({ f, score: opportunityScore(f, state) }))
    .sort((a, b) => b.score - a.score);
  const topOpportunity = safeStr(oppFacts[0]?.f?.title) || safeStr(state?.location) || '机缘暗藏';

  // 焦点地点：当前 location 优先；其次最高 location 评分 fact
  const focalLocation = safeStr(state?.location) || safeStr(facts.find(f => f.kind === 'location')?.title) || topOpportunity;

  // 焦点人物：topThreat 同源；若 topThreat 是势力名则取关联 NPC
  let focalActor = topThreat;
  if (!hostileNpcs.find(h => safeStr(h.n.name) === focalActor)) {
    const linkedNpc = npcs.find(n => safeStr(n.faction) === focalActor);
    if (linkedNpc) focalActor = safeStr(linkedNpc.name) || focalActor;
  }

  // 事件倾向：根据 hints 计算
  const eventCounter = new Map<PressureEventType, number>();
  const considerHints = allHints.length ? allHints : [
    ...asArray<any>(state?.pendingThreads).map(buildThreadHint).filter(Boolean) as ScheduleHint[],
    ...npcs.map(buildNpcHint).filter(Boolean) as ScheduleHint[],
    ...facts.map(f => buildWorldFactHint(f, state)).filter(Boolean) as ScheduleHint[],
  ];
  for (const h of considerHints) {
    const t = eventTypeForHint(h.kind, h);
    eventCounter.set(t, (eventCounter.get(t) || 0) + Math.max(1, Math.round(h.priority / 25)));
  }
  let likelyEventTypes: PressureEventType[] = Array.from(eventCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  if (!likelyEventTypes.length) {
    likelyEventTypes = hostileNpcs.length ? ['威胁回响'] : ['机缘推进'];
  }

  const summary = `最大威胁：${topThreat}；最大机会：${topOpportunity}；事件倾向：${likelyEventTypes[0]}`;

  return {
    topThreat,
    topOpportunity,
    focalLocation,
    focalActor,
    likelyEventTypes,
    summary,
  };
}

// ==================== 主入口：事件调度计划 ====================

export function buildEventSchedulerPlan(state: any): {
  focus: ScheduleFocus | null;
  hints: ScheduleHint[];
  pressureMap: PressureMap | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const hints: ScheduleHint[] = [];

  // 1. 任务线索
  const threadHints: ScheduleHint[] = [];
  for (const t of asArray<any>(state?.pendingThreads)) {
    const h = buildThreadHint(t, state);
    if (h) threadHints.push(h);
  }
  // questEntries 也可作为线索来源（已有规范化字段）
  for (const q of asArray<any>(state?.questEntries)) {
    if (threadHints.some(h => h.sourceThreadId === safeStr(q?.sourceThreadId))) continue;
    const fakeThread: any = {
      id: safeStr(q?.sourceThreadId) || safeStr(q?.id),
      title: q?.title,
      description: q?.summary,
      status: q?.stage === 'resolved' ? 'resolved' : q?.stage === 'failed' ? 'failed' : 'pending',
      urgency: q?.urgency,
      dueAge: q?.dueAge,
      progress: q?.progress,
      followUpHint: q?.currentHook,
    };
    const h = buildThreadHint(fakeThread, state);
    if (h) {
      if (q?.title) h.title = q.title;
      if (q?.urgency && h.priority < clamp(q.urgency, 0, 100)) h.priority = clamp(q.urgency, 0, 100);
      threadHints.push(h);
    }
  }
  hints.push(...threadHints);

  // 2. NPC 自主倾向 echo
  const npcHints: ScheduleHint[] = [];
  for (const n of asArray<any>(state?.npcs)) {
    const h = buildNpcHint(n, state);
    if (h) npcHints.push(h);
  }
  hints.push(...npcHints);

  // 3. 世界事实 / 地点 / 势力画像
  const factHints: ScheduleHint[] = [];
  for (const f of asArray<any>(state?.worldFacts)) {
    const h = buildWorldFactHint(f, state);
    if (h) factHints.push(h);
  }
  hints.push(...factHints);

  // 4. 因果图：旧怨余波 → echo hint
  const graph = state?.causalGraph;
  if (graph && Array.isArray(graph.nodes)) {
    const nodeById = new Map(asArray<any>(graph.nodes).map((n: any) => [safeStr(n?.id), n]));
    const edges = asArray<any>(graph.edges).slice(-12);
    for (const e of edges) {
      const type = safeStr(e?.type);
      if (!['created', 'continues', 'triggers'].includes(type || '')) continue;
      const from = nodeById.get(safeStr(e?.from));
      const to = nodeById.get(safeStr(e?.to));
      const label = safeStr(from?.label) || safeStr(e?.from) || '旧事';
      const age = safeNum(e?.age);
      if (age <= 0) continue;
      hints.push({
        id: `seh_echo_${safeStr(e?.id) || (safeStr(e?.from) + '_' + safeStr(e?.to))}`,
        kind: 'echo',
        title: label,
        reason: limitReason(`因果图余波：${label}→${safeStr(to?.label) || safeStr(e?.to)}；${limitReason(safeStr(e?.summary) || '旧缘未消', 36)}`, 80),
        priority: clamp(40 + Math.max(0, 8 - Math.max(0, safeNum(state?.age) - age)), 30, 70),
        requiredAction: 'echo',
        resolutionStage: 'background',
        relatedFactIds: safeStr(to?.refId) ? [safeStr(to?.refId)] : undefined,
      });
    }
  }

  // 5. 应用叙事契约反馈（记忆潮汐）
  applyNarrativeFeedback(hints, state, warnings);
  resolveThreadHintsByState(hints, state);

  // 6. 排序：priority 降序，同分时 id 升序
  hints.sort((a, b) => (b.priority - a.priority) || a.id.localeCompare(b.id));

  // 7. focus = 最高优先级（>=60）
  let focus: ScheduleFocus | null = null;
  const top = hints[0];
  if (top && top.priority >= 60) {
    focus = {
      id: top.id,
      kind: top.kind,
      title: top.title,
      reason: top.reason,
      priority: top.priority,
      requiredAction: top.requiredAction,
    };
  } else if (top) {
    // 即便 priority 不达 60，若为 hostile NPC 也提到 focus 层级
    const npcHostileTop = npcHints[0];
    if (npcHostileTop && (npcHostileTop as any)._attitude === 'hostile' && npcHostileTop.priority >= 50) {
      focus = {
        id: npcHostileTop.id,
        kind: npcHostileTop.kind,
        title: npcHostileTop.title,
        reason: npcHostileTop.reason,
        priority: Math.max(60, npcHostileTop.priority),
        requiredAction: npcHostileTop.requiredAction,
      };
    }
  }

  // 8. 承接不足警告
  if (!focus && hints.length === 0) {
    warnings.push('当前无明确承接锚点，可由角色小行动自然带出');
  }

  // 9. 舆图
  const pressureMap = buildWorldPressureOpportunityMap(state, hints);

  return {
    focus,
    hints,
    pressureMap,
    warnings,
  };
}

// ==================== 角色对世界事实的画像 ====================

function locationStateProfile(fact: any, character: any): string | null {
  if (!fact || fact.kind !== 'location') return null;
  const name = safeStr(fact.title) || '此间';
  const tags = Array.isArray(fact.tags) ? fact.tags : [];
  const danger = tags.includes('danger') || tags.includes('hostile') || tags.includes('event-consequence') ? '高' : '中';
  const trade = tags.includes('market') ? '交易活跃' : tags.includes('auction') ? '交易活跃（拍卖余波）' : '寻常';
  const rumor = tags.includes('event-consequence') ? '近期传闻未散' : tags.includes('auction') ? '近期传闻纷起' : '流言不多';
  const isHere = safeStr(character?.location) === name;
  const present = isHere ? '主人当前正身处此地；' : '主人尚未踏足此地；';
  const stale = safeNum(character?.age) - safeNum(fact.lastSeenAge);
  const echo = stale >= 3 ? '旧迹渐淡，仍待回响' : '旧闻仍鲜';
  return limitSummary(`${present}${name}危险度${danger}、${trade}，${rumor}——${echo}`, 80);
}

function factionStateProfile(fact: any, character: any): string | null {
  if (!fact || fact.kind !== 'faction') return null;
  const name = safeStr(fact.title) || '此势力';
  const tags = Array.isArray(fact.tags) ? fact.tags : [];
  const isCurrent = safeStr(character?.faction) === name;
  const hostile = tags.includes('hostile') || tags.includes('danger');
  const presence = isCurrent ? '主人已与此势力结缘' : '主人尚未与此势力结缘';
  const pressure = hostile ? '追责压力未消' : '追责压力轻';
  const observation = hostile ? '观察倾向日紧' : '观察倾向温和';
  const linkedNpcs = asArray<any>(character?.npcs).filter((n: any) => safeStr(n?.faction) === name);
  const npcPressure = linkedNpcs.length > 0
    ? `；NPC关联压力：${linkedNpcs.slice(0, 2).map((n: any) => safeStr(n?.name) || '').filter(Boolean).join('、') || '暗中观察'}`
    : '；NPC关联压力暂无';
  return limitSummary(`${presence}；${pressure}；${observation}${npcPressure}`, 80);
}

function realmStateProfile(fact: any, character: any): string | null {
  if (!fact || fact.kind !== 'realm') return null;
  const name = safeStr(fact.title) || '此秘境';
  const isHere = safeStr(character?.location) === name;
  if (isHere) {
    return limitSummary(`主人正与之相探——${name}中机缘未散，仍待逐步勘破`, 80);
  }
  if (safeNum(fact.lastSeenAge) <= 0) {
    return limitSummary(`主人尚不知此境；${name}仅于传闻中偶现`, 80);
  }
  return limitSummary(`主人已闻此境之名：${name}——${limitSummary(safeStr(fact.summary) || '机缘暗藏', 36)}`, 80);
}

function eventStateProfile(fact: any, character: any): string | null {
  if (!fact || fact.kind !== 'event') return null;
  const name = safeStr(fact.title) || '此事';
  const tags = Array.isArray(fact.tags) ? fact.tags : [];
  if (tags.includes('consequence') && !tags.includes('event-consequence')) {
    return limitSummary(`此事已了：${name}——${limitSummary(safeStr(fact.summary) || '只余旧人口风', 40)}`, 80);
  }
  return limitSummary(`此事余波未散：${name}——${limitSummary(safeStr(fact.summary) || '主仆仍可低频承接', 40)}`, 80);
}

function npcFactStateProfile(fact: any, character: any): string | null {
  if (!fact || fact.kind !== 'npc') return null;
  const name = safeStr(fact.title) || '此人';
  const linked = asArray<any>(character?.npcs).find((n: any) => safeStr(n?.name) === name);
  if (linked) {
    return limitSummary(`主人已结识此人（${name}）：${limitSummary(safeStr(linked?.memory) || '旧缘尚温', 36)}`, 80);
  }
  return limitSummary(`主人尚不识此人（${name}）：${limitSummary(safeStr(fact.summary) || '仅于传闻中', 36)}`, 80);
}

function relationshipStateProfile(fact: any, character: any): string | null {
  if (!fact || fact.kind !== 'relationship') return null;
  const name = safeStr(fact.title) || '此缘';
  const linked = asArray<any>(character?.npcs).find((n: any) => safeStr(n?.name) === name);
  if (linked) {
    return limitSummary(`主人与此缘尚温：${name}——${limitSummary(safeStr(linked?.memory) || '旧缘未断', 36)}`, 80);
  }
  return limitSummary(`主人与此缘尚浅：${name}——${limitSummary(safeStr(fact.summary) || '传闻中偶现', 36)}`, 80);
}

function itemFactStateProfile(fact: any, character: any): string | null {
  if (!fact || fact.kind !== 'item') return null;
  const name = safeStr(fact.title) || '此物';
  const inv = asArray<any>(character?.inventory);
  const eq = asArray<any>(character?.equipped);
  const held = inv.some((it: any) => safeStr(it?.name) === name) || eq.some((it: any) => safeStr(it?.name) === name);
  if (held) {
    return limitSummary(`主人已持此物（${name}）：日常相依，偶有灵光自应`, 80);
  }
  return limitSummary(`主人尚未得此物（${name}）：${limitSummary(safeStr(fact.summary) || '仅于传闻中', 36)}`, 80);
}

function loreStateProfile(fact: any, _character: any): string | null {
  if (!fact || fact.kind !== 'lore') return null;
  const name = safeStr(fact.title) || '此典';
  return limitSummary(`主人已闻此典：${name}——${limitSummary(safeStr(fact.summary) || '口耳相传', 48)}`, 80);
}

// ==================== 导出：角色对世界事实的当前状态 ====================

export function deriveWorldFactStateProfile(
  fact: WorldFact,
  character: any
): { summary: string } | null {
  if (!fact || typeof fact !== 'object') return null;
  if (!character || typeof character !== 'object') return null;
  const kind = safeStr(fact.kind) as WorldFactKind | null;
  let summary: string | null = null;
  switch (kind) {
    case 'location':
      summary = locationStateProfile(fact, character);
      break;
    case 'faction':
      summary = factionStateProfile(fact, character);
      break;
    case 'realm':
      summary = realmStateProfile(fact, character);
      break;
    case 'event':
      summary = eventStateProfile(fact, character);
      break;
    case 'npc':
      summary = npcFactStateProfile(fact, character);
      break;
    case 'relationship':
      summary = relationshipStateProfile(fact, character);
      break;
    case 'item':
      summary = itemFactStateProfile(fact, character);
      break;
    case 'lore':
      summary = loreStateProfile(fact, character);
      break;
    default:
      summary = null;
  }
  if (!summary) return null;
  return { summary };
}