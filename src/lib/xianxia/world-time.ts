import type { PendingThread, EventBlueprint } from '@/lib/xianxia/types';

export type TimeAdvanceUnit = 'moment' | 'hour' | 'day' | 'month' | 'season' | 'year' | 'decade' | 'century';

export interface TimeAdvance {
  amount: number;
  unit: TimeAdvanceUnit;
  label: string;
  reason: string;
  ageDeltaYears: number;
  elapsedDays: number;
}

export interface WorldCalendarState {
  eraName: string;
  calendarYear: number;
  elapsedDays: number;
}

export interface WorldTimeStamp extends WorldCalendarState {
  monthName: string;
  day: number;
  phase: string;
  label: string;
}

export type ActionProjectionKind = 'advance' | 'market' | 'exploration' | 'thread' | 'cultivate' | 'trade' | 'rest' | 'combat' | 'choice' | 'custom';

export interface ActionProjection {
  id: string;
  kind: ActionProjectionKind;
  label: string;
  description?: string;
  sourceEventId?: string;
  sourceThreadId?: string;
  requirements?: string[];
  risk?: 'safe' | 'low' | 'medium' | 'high' | 'deadly';
  expiresAtAge?: number;
  expiresAtWorldDay?: number;
  payload?: Record<string, any>;
}

export interface WorldLegacyRecord {
  id: string;
  characterId: string;
  characterName: string;
  age: number;
  highestRealm?: string;
  status: 'dead' | 'ascended' | 'living_autonomous';
  summary: string;
  relicSeeds: string[];
  legendSeeds: string[];
  createdAtWorldLabel?: string;
  updatedAt: string;
}

export const DEFAULT_WORLD_CALENDAR: WorldCalendarState = {
  eraName: '青岚仙历',
  calendarYear: 5000,
  elapsedDays: 0,
};

const MONTHS = ['孟春', '仲春', '暮春', '孟夏', '仲夏', '暮夏', '孟秋', '仲秋', '暮秋', '孟冬', '仲冬', '暮冬'];
const PHASES = ['晨钟后', '日中', '暮鼓时', '子夜'];
const COMBAT_HINTS = ['追杀', '斗法', '袭', '战', '仇'];
const TRADE_HINTS = ['坊市', '市集', '集市', '黑市', '商铺', '店铺', '摊位', '商会', '拍卖', '交易', '买卖', '商人', '货郎', '丹药铺', '法器铺', '灵材铺'];
const EXPLORATION_HINTS = ['秘境', '遗迹', '遗址', '洞府', '古洞', '古墓', '禁地', '洞天', '遗府', '试炼之地', '裂隙', '古阵', '灵脉', '荒谷', '山谷深处'];
const CULTIVATION_HINTS = ['闭关', '修炼', '参悟', '破境', '冲关'];
function hasAny(text: string, hints: string[]) {
  return hints.some((hint) => text.includes(hint));
}

export function clampTimeAdvance(raw: any, fallback?: TimeAdvance): TimeAdvance {
  const fb = fallback || { amount: 1, unit: 'year' as TimeAdvanceUnit, label: '一年后', reason: '顺势流转一段岁月', ageDeltaYears: 1, elapsedDays: 365 };
  const unit: TimeAdvanceUnit = ['moment', 'hour', 'day', 'month', 'season', 'year', 'decade', 'century'].includes(raw?.unit) ? raw.unit : fb.unit;
  const maxByUnit: Record<TimeAdvanceUnit, number> = { moment: 1, hour: 12, day: 60, month: 24, season: 16, year: 30, decade: 10, century: 3 };
  const amount = Math.max(1, Math.min(maxByUnit[unit], Math.round(Number(raw?.amount || fb.amount || 1))));
  const unitDays: Record<TimeAdvanceUnit, number> = { moment: 0, hour: 0, day: 1, month: 30, season: 90, year: 365, decade: 3650, century: 36500 };
  const naturalDays = amount * unitDays[unit];
  const elapsedDays = Math.max(0, Math.min(36500 * 3, Math.round(Number(raw?.elapsedDays ?? fb.elapsedDays ?? naturalDays))));
  const naturalYears = Math.floor(elapsedDays / 365);
  const ageDeltaYears = Math.max(0, Math.min(300, Math.round(Number(raw?.ageDeltaYears ?? fb.ageDeltaYears ?? naturalYears))));
  const label = String(raw?.label || fb.label || defaultTimeLabel(unit, amount)).slice(0, 24);
  const reason = String(raw?.reason || fb.reason || '因缘自然推进').slice(0, 120);
  return { amount, unit, label, reason, ageDeltaYears, elapsedDays };
}

export function defaultTimeLabel(unit: TimeAdvanceUnit, amount: number) {
  if (unit === 'moment') return '片刻后';
  if (unit === 'hour') return amount <= 2 ? '少顷' : `${amount}个时辰后`;
  if (unit === 'day') return amount === 1 ? '??' : `${amount}??`;
  if (unit === 'month') return amount === 1 ? '一月后' : `${amount}月后`;
  if (unit === 'season') return amount === 1 ? '一季后' : `${amount}季后`;
  if (unit === 'year') return amount === 1 ? '一年后' : `${amount}年后`;
  if (unit === 'decade') return amount === 1 ? '十年后' : `${amount * 10}年后`;
  return amount === 1 ? '百年后' : `${amount}百年后`;
}

export function suggestTimeAdvance(args: { age: number; pendingThreads?: PendingThread[]; sameYearThread?: PendingThread | null; blueprint?: EventBlueprint | null }): TimeAdvance {
  const { age, pendingThreads = [], sameYearThread, blueprint } = args;
  if (sameYearThread?.dueInSameYear) {
    return { amount: 3, unit: 'month', label: sameYearThread.followUpHint?.slice(0, 16) || '数月后', reason: `承接同年因缘：${sameYearThread.title}`, ageDeltaYears: 0, elapsedDays: 90 };
  }
  const urgent = pendingThreads
    .filter((t) => t.status === 'urgent' || (t.status === 'pending' && t.deadlineAge - age <= 1))
    .sort((a, b) => a.deadlineAge - b.deadlineAge)[0];
  if (urgent) {
    return { amount: 1, unit: 'month', label: '月余后', reason: `临近因缘关口：${urgent.title}`, ageDeltaYears: 0, elapsedDays: 30 };
  }
  const cat = blueprint?.category || '';
  const text = `${blueprint?.name || ''} ${blueprint?.description || ''}`;
  if (cat === 'combat' || hasAny(text, COMBAT_HINTS)) return { amount: 1, unit: 'day', label: '翌日', reason: '争斗因缘迫近，不宜跨年略过', ageDeltaYears: 0, elapsedDays: 1 };
  if (cat === 'trade' || hasAny(text, TRADE_HINTS)) return { amount: 1, unit: 'day', label: '次日入市', reason: '市井机缘多在短期内展开', ageDeltaYears: 0, elapsedDays: 1 };
  if (cat === 'exploration' || hasAny(text, EXPLORATION_HINTS)) return { amount: 10, unit: 'day', label: '旬日后', reason: '循线探查需要数日准备', ageDeltaYears: 0, elapsedDays: 10 };
  if (cat === 'cultivation' || hasAny(text, CULTIVATION_HINTS)) return { amount: 1, unit: 'year', label: '闭关一年后', reason: '修行沉淀可跨过较长岁月', ageDeltaYears: 1, elapsedDays: 365 };
  return { amount: 1, unit: 'year', label: '一年后', reason: '无急迫牵挂，顺势推过一段岁月', ageDeltaYears: 1, elapsedDays: 365 };
}

export function advanceWorldCalendar(world: Partial<WorldCalendarState> | undefined, time: TimeAdvance): WorldCalendarState {
  const base = normalizeWorldCalendar(world);
  const elapsedDays = Math.max(0, Math.round(base.elapsedDays + Math.max(0, time.elapsedDays || time.ageDeltaYears * 365)));
  return { ...base, calendarYear: 5000 + Math.floor(elapsedDays / 365), elapsedDays };
}

export function normalizeWorldCalendar(world?: Partial<WorldCalendarState>): WorldCalendarState {
  const elapsedDays = Math.max(0, Math.round(Number(world?.elapsedDays ?? DEFAULT_WORLD_CALENDAR.elapsedDays)));
  return {
    eraName: String(world?.eraName || DEFAULT_WORLD_CALENDAR.eraName).slice(0, 12),
    calendarYear: Number.isFinite(Number(world?.calendarYear)) ? Math.round(Number(world?.calendarYear)) : 5000 + Math.floor(elapsedDays / 365),
    elapsedDays,
  };
}

export function worldTimeStamp(world?: Partial<WorldCalendarState>, phaseHint?: string): WorldTimeStamp {
  const base = normalizeWorldCalendar(world);
  const dayOfYear = ((base.elapsedDays % 365) + 365) % 365;
  const monthIndex = Math.min(11, Math.floor(dayOfYear / 30));
  const day = Math.max(1, Math.min(30, (dayOfYear % 30) + 1));
  const phase = String(phaseHint || PHASES[Math.floor(dayOfYear / 7) % PHASES.length]).slice(0, 16);
  const monthName = MONTHS[monthIndex] || '岁末';
  return {
    ...base,
    monthName,
    day,
    phase,
    label: `${base.eraName}${base.calendarYear}年 · ${monthName} · ${day}日 · ${phase}`,
  };
}

export function hiddenEventMeta(meta: Record<string, any>) {
  return { kind: 'eventMeta', meta };
}

export function extractEventMeta(effects: any[]): Record<string, any> {
  const found = (Array.isArray(effects) ? effects : []).find((e) => e?.kind === 'eventMeta' && e.meta && typeof e.meta === 'object');
  return found?.meta || {};
}

export function sanitizeActionProjections(raw: any, fallback: ActionProjection[] = []): ActionProjection[] {
  const arr = Array.isArray(raw) ? raw : fallback;
  const out: ActionProjection[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const kind: ActionProjectionKind = ['advance', 'market', 'exploration', 'thread', 'cultivate', 'trade', 'rest', 'combat', 'choice', 'custom'].includes(item?.kind) ? item.kind : 'custom';
    const label = String(item?.label || '').trim().slice(0, 16);
    if (!label) continue;
    const idSeed = String(item?.id || `${kind}-${label}`).replace(/[^a-zA-Z0-9_\-一-龥]/g, '').slice(0, 48) || `${kind}-${out.length}`;
    const id = seen.has(idSeed) ? `${idSeed}-${out.length}` : idSeed;
    seen.add(id);
    out.push({
      id,
      kind,
      label,
      description: item?.description ? String(item.description).slice(0, 100) : undefined,
      sourceEventId: item?.sourceEventId ? String(item.sourceEventId) : undefined,
      sourceThreadId: item?.sourceThreadId ? String(item.sourceThreadId) : undefined,
      requirements: Array.isArray(item?.requirements) ? item.requirements.map((x: any) => String(x).slice(0, 40)).filter(Boolean).slice(0, 4) : undefined,
      risk: ['safe', 'low', 'medium', 'high', 'deadly'].includes(item?.risk) ? item.risk : undefined,
      expiresAtAge: Number.isFinite(Number(item?.expiresAtAge)) ? Math.round(Number(item.expiresAtAge)) : undefined,
      expiresAtWorldDay: Number.isFinite(Number(item?.expiresAtWorldDay)) ? Math.round(Number(item.expiresAtWorldDay)) : undefined,
      payload: item?.payload && typeof item.payload === 'object' ? item.payload : undefined,
    });
  }
  return out.slice(0, 6);
}

export function deriveActionProjections(args: { title?: string; narrative?: string; eventType?: string; blueprint?: EventBlueprint | { category?: string; name?: string }; threads?: PendingThread[]; realms?: any[] }): ActionProjection[] {
  const text = `${args.title || ''}
${args.narrative || ''}
${args.blueprint?.name || ''}`;
  const category = args.blueprint?.category || '';
  const projections: ActionProjection[] = [];
  if (args.eventType === 'trade' || category === 'trade' || hasAny(text, TRADE_HINTS)) {
    projections.push({ id: 'market-current', kind: 'market', label: '前往坊市', description: '顺着本段因缘去坊市交易、购置或打探消息。', risk: 'low' });
  }
  if (args.eventType === 'exploration' || category === 'exploration' || hasAny(text, EXPLORATION_HINTS)) {
    projections.push({ id: 'explore-current', kind: 'exploration', label: '探入此地', description: '沿着显露的线索进入秘境或遗迹。', risk: 'medium' });
  }
  const thread = (args.threads || []).find((t) => t.status === 'urgent' || t.dueInSameYear || t.realmId);
  if (thread) {
    projections.push({ id: `thread-${thread.id}`, kind: thread.realmId ? 'exploration' : 'thread', label: thread.realmId ? '追寻秘钥' : '追查因缘', description: thread.followUpHint || thread.description, sourceThreadId: thread.id, risk: thread.status === 'urgent' ? 'high' : 'medium', expiresAtAge: thread.deadlineAge });
  }
  return sanitizeActionProjections(projections);
}
