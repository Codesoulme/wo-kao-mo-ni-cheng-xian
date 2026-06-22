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
  displayLabel?: string;
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
  const rawLabel = String(raw?.label || fb.label || '').slice(0, 36);
  const label = cleanTimeSegmentLabel(rawLabel) || defaultTimeLabel(unit, amount);
  const reason = String(raw?.reason || fb.reason || '\u56e0\u7f18\u81ea\u7136\u63a8\u8fdb').slice(0, 120);
  return { amount, unit, label, reason, ageDeltaYears, elapsedDays };
}

export function defaultTimeLabel(unit: TimeAdvanceUnit, amount: number) {
  if (unit === 'moment') return '片刻后';
  if (unit === 'hour') return amount <= 2 ? '少顷' : `${amount}个时辰后`;
  if (unit === 'day') return amount === 1 ? '翌日' : `${amount}日后`;
  if (unit === 'month') return amount === 1 ? '一月后' : `${amount}月后`;
  if (unit === 'season') return amount === 1 ? '一季后' : `${amount}季后`;
  if (unit === 'year') return amount === 1 ? '一年后' : `${amount}年后`;
  if (unit === 'decade') return amount === 1 ? '十年后' : `${amount * 10}年后`;
  return amount === 1 ? '百年后' : `${amount}百年后`;
}


export function inferInlineTimeAdvance(title?: string, narrative?: string): TimeAdvance | undefined {
  const text = `${title || ''} ${narrative || ''}`;
  if (/\u5165\u591c\u540e|\u5f53\u591c|\u591c\u91cc|\u591c\u534a|\u5b50\u591c|\u661f\u5b50|\u68a6\u91cc|\u6795\u4e0b/.test(text)) return { amount: 12, unit: 'hour', label: '\u5165\u591c\u540e', reason: '\u540c\u65e5\u591c\u95f4\u4f59\u6ce2', ageDeltaYears: 0, elapsedDays: 0 };
  if (/\u9ec4\u660f|\u508d\u665a|\u66ae\u8272|\u66ae\u9f13|\u65e5\u843d/.test(text)) return { amount: 6, unit: 'hour', label: '\u9ec4\u660f', reason: '\u540c\u65e5\u66ae\u95f4\u4f59\u6ce2', ageDeltaYears: 0, elapsedDays: 0 };
  if (/\u5348\u540e|\u664c\u5348|\u65e5\u4e2d/.test(text)) return { amount: 4, unit: 'hour', label: '\u5348\u540e', reason: '\u540c\u65e5\u65e5\u4e2d\u4f59\u6ce2', ageDeltaYears: 0, elapsedDays: 0 };
  if (/\u6e05\u6668|\u6668\u8d77|\u5929\u4eae|\u6668\u5149|\u6668\u949f/.test(text)) return { amount: 1, unit: 'hour', label: '\u6e05\u6668', reason: '\u540c\u65e5\u6e05\u6668\u4f59\u6ce2', ageDeltaYears: 0, elapsedDays: 0 };
  if (/\u7fcc\u65e5|\u6b21\u65e5|\u660e\u65e5|\u7b2c\u4e8c\u65e5|\u8f6c\u65e5/.test(text)) return { amount: 1, unit: 'day', label: '\u7fcc\u65e5', reason: '\u540e\u7eed\u4f59\u6ce2', ageDeltaYears: 0, elapsedDays: 1 };
  if (/\u6570\u65e5\u540e|\u51e0\u65e5\u540e|\u4e09\u65e5\u540e/.test(text)) return { amount: 3, unit: 'day', label: '\u6570\u65e5\u540e', reason: '\u540e\u7eed\u4f59\u6ce2', ageDeltaYears: 0, elapsedDays: 3 };
  return undefined;
}

export function phaseHintForTime(label?: string, narrative?: string): string | undefined {
  const text = `${label || ''} ${narrative || ''}`;
  if (/\u5165\u591c|\u5f53\u591c|\u591c\u91cc|\u591c\u534a|\u5b50\u591c|\u661f\u5b50|\u68a6\u91cc|\u6795\u4e0b/.test(text)) return '\u5b50\u591c';
  if (/\u9ec4\u660f|\u508d\u665a|\u66ae\u8272|\u66ae\u9f13|\u65e5\u843d/.test(text)) return '\u66ae\u9f13\u65f6';
  if (/\u5348\u540e|\u664c\u5348|\u65e5\u4e2d/.test(text)) return '\u65e5\u4e2d';
  if (/\u6e05\u6668|\u6668\u8d77|\u5929\u4eae|\u6668\u5149|\u6668\u949f/.test(text)) return '\u6668\u949f\u540e';
  return undefined;
}

export function suggestTimeAdvance(args: { age: number; pendingThreads?: PendingThread[]; sameYearThread?: PendingThread | null; blueprint?: EventBlueprint | null }): TimeAdvance {
  const { age, pendingThreads = [], sameYearThread, blueprint } = args;
  if (sameYearThread?.dueInSameYear) {
    return { amount: 3, unit: 'month', label: '\u6570\u6708\u540e', reason: `\u627f\u63a5\u540c\u5e74\u56e0\u7f18\uff1a${sameYearThread.title}`, ageDeltaYears: 0, elapsedDays: 90 };
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

function cleanTimeSegmentLabel(value?: string) {
  const text = String(value || '').trim();
  if (!text) return '';
  const internalOrAction = /\u540c\u5e74\u7eed\u7bc7|\u7eed\u7bc7|\u6d41\u5e74\u56e0|\u547d\u8282\u70b9|\u6267\u884c\u7ea6\u5b9a|\u524d\u5f80|\u8ffd\u67e5|\u8ffd\u5bfb|\u63a2\u5165|\u5165\u5e02|\u8d74\u7ea6|\u6253\u542c|\u53ef\u5411|\u8be2\u95ee|\u5bfb\u8bbf|\u62dc\u8bbf|\u4fee\u58eb/.test(text);
  if (internalOrAction) return '';
  const hasTimeSignal = /\u540e|\u524d|\u95f4|\u65e5|\u591c|\u6668|\u66ae|\u6708|\u5e74|\u8f7d|\u5b63|\u65ec|\u7247\u523b|\u5c11\u9877|\u987b\u81fe|\u7fcc\u65e5|\u5f53\u591c|\u5b50\u65f6|\u5348\u65f6|\u6668\u949f|\u66ae\u9f13/.test(text);
  if (!hasTimeSignal) return '';
  return text.slice(0, 24);
}

export function formatWorldTimeDisplay(args: { age?: number; timeAdvance?: Partial<TimeAdvance>; worldTime?: Partial<WorldTimeStamp>; includeAge?: boolean }) {
  const worldLabel = String(args.worldTime?.label || '').trim();
  const segmentLabel = cleanTimeSegmentLabel(args.timeAdvance?.label);
  const ageText = args.includeAge && Number.isFinite(Number(args.age)) ? `${Number(args.age)}\u5c81` : '';
  const open = '\u3010';
  const close = '\u3011';
  if (worldLabel && segmentLabel) return ageText ? `${ageText} \u00b7 ${segmentLabel}${open}${worldLabel}${close}` : `${segmentLabel}${open}${worldLabel}${close}`;
  if (worldLabel) return ageText ? `${ageText}${open}${worldLabel}${close}` : `${open}${worldLabel}${close}`;
  if (segmentLabel) return ageText ? `${ageText} \u00b7 ${segmentLabel}` : segmentLabel;
  return ageText;
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
