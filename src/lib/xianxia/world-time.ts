import type { PendingThread, EventBlueprint } from '@/lib/xianxia/types';

// 2026-08-31 时序改制：新增 'continuous'（连续态）。
// 网文默认是"接着刚才"，只有真的动了才报时。旧版每条都必须合成一个题签，
// 于是条条都标 = 等于没标，玩家反而失去时间感。continuous 的 label 恒为空串，
// 前端据此完全不渲染时间元素，相邻两条视觉上黏成同一场戏。
export type TimeAdvanceUnit = 'continuous' | 'moment' | 'hour' | 'day' | 'month' | 'season' | 'year' | 'decade' | 'century';

export interface TimeAdvance {
  amount: number;
  unit: TimeAdvanceUnit;
  /** 玩家可见的相对时间题签；空串表示连续态，前端不渲染。 */
  label: string;
  reason: string;
  ageDeltaYears: number;
  elapsedDays: number;
  /** 日内推进量（小时，可含小数）。day 及以上单位恒为 0，跨度走 elapsedDays。 */
  elapsedHours?: number;
  /**
   * 0..24 的绝对时点。命中"当晚/入夜/凌晨/清晨"这类词时用它，语义是
   * "跳到同一天的那个时点"，而非"往后推 N 小时"——后者会让"当晚"落到次日午间。
   * 优先级高于 elapsedHours。
   */
  setDayHour?: number;
}

export interface WorldCalendarState {
  eraName: string;
  calendarYear: number;
  elapsedDays: number;
  /** 0..24 日内游标。旧存档缺此字段时回落到 DEFAULT_DAY_HOUR。 */
  dayHour: number;
}

export interface WorldTimeStamp extends WorldCalendarState {
  monthName: string;
  day: number;
  phase: string;
  /** 十二时辰名，如「丑时」。 */
  hourName: string;
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

/** 开局落在辰时前后——晨起开场，是最不需要解释的起点。 */
export const DEFAULT_DAY_HOUR = 7;

export const DEFAULT_WORLD_CALENDAR: WorldCalendarState = {
  eraName: '青岚仙历',
  calendarYear: 5000,
  elapsedDays: 0,
  dayHour: DEFAULT_DAY_HOUR,
};

const MONTHS = ['孟春', '仲春', '暮春', '孟夏', '仲夏', '暮夏', '孟秋', '仲秋', '暮秋', '孟冬', '仲冬', '暮冬'];
/** 十二时辰，索引 = floor(((h + 1) % 24) / 2)。 */
const HOUR_NAMES = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];
const COMBAT_HINTS = ['追杀', '斗法', '袭', '战', '仇'];
const TRADE_HINTS = ['坊市', '市集', '集市', '黑市', '商铺', '店铺', '摊位', '商会', '拍卖', '交易', '买卖', '商人', '货郎', '丹药铺', '法器铺', '灵材铺'];
const EXPLORATION_HINTS = ['秘境', '遗迹', '遗址', '洞府', '古洞', '古墓', '禁地', '洞天', '遗府', '试炼之地', '裂隙', '古阵', '灵脉', '荒谷', '山谷深处'];
const CULTIVATION_HINTS = ['闭关', '修炼', '参悟', '破境', '冲关'];
function hasAny(text: string, hints: string[]) {
  return hints.some((hint) => text.includes(hint));
}

/** 连续态常量：拿不到任何时间线索时的缺省，语义是"接着刚才"。 */
export const CONTINUOUS_TIME: TimeAdvance = {
  amount: 1, unit: 'continuous', label: '', reason: '紧接上一幕，未另起时点',
  ageDeltaYears: 0, elapsedDays: 0, elapsedHours: 0,
};

const UNIT_DAYS: Record<TimeAdvanceUnit, number> = {
  continuous: 0, moment: 0, hour: 0, day: 1, month: 30, season: 90, year: 365, decade: 3650, century: 36500,
};
/** 日内单位换算：一时辰 = 2 小时；片刻按一刻钟算。 */
const UNIT_HOURS: Record<TimeAdvanceUnit, number> = {
  continuous: 0, moment: 0.25, hour: 2, day: 0, month: 0, season: 0, year: 0, decade: 0, century: 0,
};
const UNIT_MAX: Record<TimeAdvanceUnit, number> = {
  continuous: 1, moment: 8, hour: 12, day: 60, month: 24, season: 16, year: 30, decade: 10, century: 3,
};

export function clampTimeAdvance(raw: any, fallback?: TimeAdvance): TimeAdvance {
  // 2026-08-31：缺省从「一年后」翻成连续态。信息不足就跳一年，正是玩家反馈里
  // "上一条还说十万火急，下一条就一年后了"的直接来源；网文的缺省是接着刚才，
  // 跨越才需要理由。
  const fb = fallback || CONTINUOUS_TIME;
  const unit: TimeAdvanceUnit = (Object.keys(UNIT_DAYS) as TimeAdvanceUnit[]).includes(raw?.unit) ? raw.unit : fb.unit;
  const amount = Math.max(1, Math.min(UNIT_MAX[unit], Math.round(Number(raw?.amount || fb.amount || 1))));

  // 绝对时点优先：命中"当晚/凌晨"等词时，语义是跳到同日该时点。
  const rawDayHour = Number(raw?.setDayHour ?? fb.setDayHour);
  const setDayHour = Number.isFinite(rawDayHour) ? Math.max(0, Math.min(23.99, rawDayHour)) : undefined;

  if (unit === 'continuous') {
    // 连续态不接受任何题签与跨度——否则它就不是连续态了。
    return {
      ...CONTINUOUS_TIME,
      reason: String(raw?.reason || fb.reason || CONTINUOUS_TIME.reason).slice(0, 120),
      ...(setDayHour !== undefined ? { setDayHour } : {}),
    };
  }

  const naturalDays = amount * UNIT_DAYS[unit];
  // 优先级：raw 显式给的 elapsedDays > raw 的 unit/amount 算的 naturalDays > fb 的 elapsedDays
  // 这样 AI 传 {unit:'month', amount:3} 不会因为主事件 fallback 是 1 年而被覆盖成 365 天
  const rawHasAnyTimeFields = raw && (
    raw.elapsedDays != null || raw.unit != null || raw.amount != null ||
    raw.label != null || raw.ageDeltaYears != null
  );
  const elapsedDays = rawHasAnyTimeFields
    ? Math.max(0, Math.min(36500 * 3, Math.round(Number(raw?.elapsedDays ?? naturalDays))))
    : Math.max(0, Math.min(36500 * 3, Math.round(Number(fb.elapsedDays ?? naturalDays))));
  const naturalYears = Math.floor(elapsedDays / 365);
  const ageDeltaYears = Math.max(0, Math.min(300, Math.round(Number(raw?.ageDeltaYears ?? fb.ageDeltaYears ?? naturalYears))));
  const naturalHours = amount * UNIT_HOURS[unit];
  const elapsedHours = Math.max(0, Math.min(23.99, Number(raw?.elapsedHours ?? naturalHours) || 0));
  const rawLabel = String(raw?.label || fb.label || '').slice(0, 36);
  const label = cleanTimeSegmentLabel(rawLabel) || defaultTimeLabel(unit, amount);
  const reason = String(raw?.reason || fb.reason || '\u56e0\u7f18\u81ea\u7136\u63a8\u8fdb').slice(0, 120);
  return { amount, unit, label, reason, ageDeltaYears, elapsedDays, elapsedHours, ...(setDayHour !== undefined ? { setDayHour } : {}) };
}

/** 小数目转汉字。题签是玩家可见文本，"3月后"读起来出戏，网文只写"三月后"。 */
const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export function cnNumeral(n: number): string {
  const v = Math.round(Number(n) || 0);
  if (v >= 0 && v <= 10) return CN_NUM[v];
  if (v > 10 && v < 20) return `十${CN_NUM[v - 10]}`;
  if (v >= 20 && v < 100 && v % 10 === 0) return `${CN_NUM[Math.floor(v / 10)]}十`;
  if (v >= 20 && v < 100) return `${CN_NUM[Math.floor(v / 10)]}十${CN_NUM[v % 10]}`;
  return String(v);
}

export function defaultTimeLabel(unit: TimeAdvanceUnit, amount: number) {
  const n = cnNumeral(amount);
  if (unit === 'continuous') return '';
  if (unit === 'moment') return '片刻后';
  if (unit === 'hour') return amount <= 2 ? '少顷' : `${n}个时辰后`;
  if (unit === 'day') return amount === 1 ? '翌日' : `${n}日后`;
  if (unit === 'month') return amount === 1 ? '一月后' : `${n}月后`;
  if (unit === 'season') return amount === 1 ? '一季后' : `${n}季后`;
  if (unit === 'year') return amount === 1 ? '一年后' : `${n}年后`;
  if (unit === 'decade') return amount === 1 ? '十年后' : `${cnNumeral(amount * 10)}年后`;
  return amount === 1 ? '百年后' : `${n}百年后`;
}


/**
 * 从叙事文本推断"绝对时点"。
 * 关键在于这些词是绝对的而非相对的：「当晚」指同一天的夜里，不是"往后 12 小时"。
 * 旧版把它们折算成 elapsedHours 相对量，于是白天出发的"当晚"会落到次日中午。
 */
export function inferDayHourFromText(text?: string): number | undefined {
  const t = String(text || '');
  if (/凌晨|五更|寅时|丑时|后半夜|更深/.test(t)) return 3;
  if (/夜半|子夜|三更|半夜/.test(t)) return 0.5;
  if (/入夜|当夜|当晚|夜里|掌灯|上灯|灯火|戌时|亥时/.test(t)) return 20.5;
  if (/黄昏|傍晚|暮色|暮鼓|日落|日头偏西|太阳落山|酉时/.test(t)) return 18.5;
  if (/午后|晌午|日头当顶|未时|申时/.test(t)) return 14.5;
  if (/日中|正午|午时/.test(t)) return 12;
  if (/清晨|晨起|天亮|晨光|晨风|晨雾|晨钟|卯时|辰时/.test(t)) return 7;
  if (/拂晓|黎明|破晓|天光|蒙蒙亮|天不亮|天色微明|熹微|鸡鸣|鸡叫|头遍鸡/.test(t)) return 5.5;
  return undefined;
}

/** 0..24 → 十二时辰名。子时跨 23-1 点，故整体右移一小时再分桶。 */
export function hourNameOf(dayHour: number): string {
  const h = ((Number(dayHour) || 0) % 24 + 24) % 24;
  return HOUR_NAMES[Math.floor(((h + 1) % 24) / 2)] || '子时';
}

/** 0..24 → 白话时段名。取代旧版由 dayOfYear/7 编出来的假时段。 */
export function phaseOf(dayHour: number): string {
  const h = ((Number(dayHour) || 0) % 24 + 24) % 24;
  if (h < 4) return '夜半';
  if (h < 6.5) return '拂晓';
  if (h < 10) return '晨间';
  if (h < 13) return '日中';
  if (h < 16.5) return '午后';
  if (h < 19.5) return '黄昏';
  if (h < 22) return '入夜';
  return '夜半';
}

export function inferInlineTimeAdvance(title?: string, narrative?: string): TimeAdvance | undefined {
  const text = `${title || ''} ${narrative || ''}`;
  // 2026-07-12：扩到月级/年级关键词——AI narrative 里"三月后再次相见""半年后再来"等更常见，
  // 旧版只识入夜/翌日/数日后，不接住玩家立刻感觉"那几个月呢凭空跳了"。
  // 命中后回滚到对应月/年跨度，ageDeltaYears=0 表示同年不跨岁。
  if (/数年后|几年后|三五年后|三年后|五年后/.test(text)) {
    return { amount: 3, unit: 'year', label: '数年后', reason: 'narrative 提及数年后事件，跨年补完', ageDeltaYears: 3, elapsedDays: 365 * 3 };
  }
  if (/一年后|过年后|去年/.test(text)) {
    return { amount: 1, unit: 'year', label: '一年后', reason: 'narrative 提及一年后', ageDeltaYears: 1, elapsedDays: 365 };
  }
  if (/数月后|几个月后|数月内|几个月内|几月后/.test(text)) {
    return { amount: 3, unit: 'month', label: '数月后', reason: 'narrative 提及数月后事件，同年补完', ageDeltaYears: 0, elapsedDays: 90 };
  }
  if (/三月后|三个月后|三月内|几月后/.test(text)) {
    return { amount: 3, unit: 'month', label: '三月后', reason: 'narrative 提及三月后，同年补完', ageDeltaYears: 0, elapsedDays: 90 };
  }
  if (/半年后|半年内/.test(text)) {
    return { amount: 6, unit: 'month', label: '半年后', reason: 'narrative 提及半年后，同年补完', ageDeltaYears: 0, elapsedDays: 180 };
  }
  if (/半月后|十几日后/.test(text)) {
    return { amount: 15, unit: 'day', label: '半月后', reason: 'narrative 提及半月后，同年补完', ageDeltaYears: 0, elapsedDays: 15 };
  }
  // 日内时点：一律走 setDayHour 绝对定位，elapsedHours 归零避免重复计时。
  if (/凌晨|五更|寅时/.test(text)) return { amount: 1, unit: 'hour', label: '凌晨', reason: '同日凌晨', ageDeltaYears: 0, elapsedDays: 0, elapsedHours: 0, setDayHour: 3 };
  if (/入夜后|当夜|当晚|夜里|夜半|子夜|掌灯|梦里|枕下/.test(text)) return { amount: 1, unit: 'hour', label: '入夜后', reason: '同日夜间余波', ageDeltaYears: 0, elapsedDays: 0, elapsedHours: 0, setDayHour: 20.5 };
  if (/黄昏|傍晚|暮色|暮鼓|日落/.test(text)) return { amount: 1, unit: 'hour', label: '黄昏', reason: '同日暮间余波', ageDeltaYears: 0, elapsedDays: 0, elapsedHours: 0, setDayHour: 18.5 };
  if (/午后|晌午|日中/.test(text)) return { amount: 1, unit: 'hour', label: '午后', reason: '同日日中余波', ageDeltaYears: 0, elapsedDays: 0, elapsedHours: 0, setDayHour: 14.5 };
  if (/清晨|晨起|天亮|晨光|晨钟/.test(text)) return { amount: 1, unit: 'hour', label: '清晨', reason: '同日清晨余波', ageDeltaYears: 0, elapsedDays: 0, elapsedHours: 0, setDayHour: 7 };
  if (/翌日|次日|明日|第二日|转日/.test(text)) return { amount: 1, unit: 'day', label: '翌日', reason: '后续余波', ageDeltaYears: 0, elapsedDays: 1 };
  if (/数日后|几日后|三日后/.test(text)) return { amount: 3, unit: 'day', label: '数日后', reason: '后续余波', ageDeltaYears: 0, elapsedDays: 3 };
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

/**
 * 连续态连着出现多少条之后强制推一把。
 * 缺省翻成连续态之后，若始终不报时，角色会永远停在同一天——这是防冻结闸门。
 */
export const MAX_CONSECUTIVE_CONTINUOUS = 4;

export function suggestTimeAdvance(args: { age: number; pendingThreads?: PendingThread[]; sameYearThread?: PendingThread | null; blueprint?: EventBlueprint | null; consecutiveContinuous?: number }): TimeAdvance {
  const { age, pendingThreads = [], sameYearThread, blueprint, consecutiveContinuous = 0 } = args;
  const bpCat = blueprint?.category || '';
  const bpText = `${blueprint?.name || ''} ${blueprint?.description || ''}`;

  // 闭关是唯一「内容本身就写着跨度」的一档：闭关一年就是一年，读者一眼便知落到哪个时点。
  // 只认「闭关」这个明写的词。修炼 / 参悟 / 破境 这些不必然占掉一年，
  // 一个道者天天在修炼，若照它跳，就又回到「随手做点事，一年没了」。
  if (bpText.includes('闭关')) {
    return { amount: 1, unit: 'year', label: '闭关一年后', reason: '闭关本身就是一段光景', ageDeltaYears: 1, elapsedDays: 365 };
  }

  // 2026-08-31 反转一条要紧的：牵挂与期限只决定「推多远」，不决定「该不该推」。
  //   旧版反着来 —— 手上有急迫牵挂就每一幕都盖「月余后」，于是「老客把青玉包好塞进怀里」
  //   这种紧接着的动作也被推走一个月。期限压着，恰恰说明下一幕就在眼前，不是该跳过去。
  //   该不该推交给连续态积压（防冻结闸门），推多远才轮到牵挂发话。
  if (consecutiveContinuous < MAX_CONSECUTIVE_CONTINUOUS) {
    return { ...CONTINUOUS_TIME, reason: '紧接上一幕，未另起时点' };
  }

  // 以下都是「连续数幕没另起时点，该抬一档了」之后的挑档：期限越近，抬得越轻。
  if (sameYearThread?.dueInSameYear) {
    return { amount: 3, unit: 'day', label: '\u6570\u65e5\u540e', reason: `\u627f\u63a5\u540c\u5e74\u56e0\u7f18\uff1a${sameYearThread.title}`, ageDeltaYears: 0, elapsedDays: 3, elapsedHours: 0, setDayHour: DEFAULT_DAY_HOUR };
  }
  const urgent = pendingThreads
    .filter((t) => t.status === 'urgent' || (t.status === 'pending' && t.deadlineAge - age <= 1))
    .sort((a, b) => a.deadlineAge - b.deadlineAge)[0];
  if (urgent) {
    return { amount: 1, unit: 'day', label: '翌日', reason: `临近因缘关口：${urgent.title}`, ageDeltaYears: 0, elapsedDays: 1, elapsedHours: 0, setDayHour: DEFAULT_DAY_HOUR };
  }
  const cat = bpCat;
  const text = bpText;
  if (cat === 'combat' || hasAny(text, COMBAT_HINTS)) return { amount: 1, unit: 'day', label: '翌日', reason: '争斗因缘迫近，不宜跨年略过', ageDeltaYears: 0, elapsedDays: 1 };
  if (cat === 'trade' || hasAny(text, TRADE_HINTS)) return { amount: 1, unit: 'day', label: '次日入市', reason: '市井机缘多在短期内展开', ageDeltaYears: 0, elapsedDays: 1 };
  if (cat === 'exploration' || hasAny(text, EXPLORATION_HINTS)) return { amount: 10, unit: 'day', label: '旬日后', reason: '循线探查需要数日准备', ageDeltaYears: 0, elapsedDays: 10 };
  if (cat === 'cultivation' || hasAny(text, CULTIVATION_HINTS)) return { amount: 1, unit: 'season', label: '一季后', reason: '打坐参悟不觉时日', ageDeltaYears: 0, elapsedDays: 90, elapsedHours: 0, setDayHour: DEFAULT_DAY_HOUR };
  // 手上一条牵挂都没有，才真是「一段光景就这么过去了」。
  return { amount: 1, unit: 'month', label: '月余后', reason: '连续数幕未另起时点，顺势推过一段光景', ageDeltaYears: 0, elapsedDays: 30, elapsedHours: 0, setDayHour: DEFAULT_DAY_HOUR };
}

export function advanceWorldCalendar(world: Partial<WorldCalendarState> | undefined, time: TimeAdvance): WorldCalendarState {
  const base = normalizeWorldCalendar(world);
  const addDays = Math.max(0, Math.round(Number(time.elapsedDays) || (Number(time.ageDeltaYears) || 0) * 365));
  let dayHour = base.dayHour;
  let carryDays = 0;
  const target = Number(time.setDayHour);
  if (Number.isFinite(target)) {
    // 绝对时点。只有本段没有跨日跨度时，才为"目标时点已过"补一天——
    // 否则"三日后的清晨"会被多算一天。
    if (addDays === 0 && target <= dayHour + 1e-6) carryDays = 1;
    dayHour = Math.max(0, Math.min(23.99, target));
  } else {
    const total = dayHour + Math.max(0, Number(time.elapsedHours) || 0);
    carryDays = Math.floor(total / 24);
    dayHour = total - carryDays * 24;
  }
  const elapsedDays = Math.max(0, base.elapsedDays + addDays + carryDays);
  return { ...base, calendarYear: 5000 + Math.floor(elapsedDays / 365), elapsedDays, dayHour };
}

export function normalizeWorldCalendar(world?: Partial<WorldCalendarState>): WorldCalendarState {
  const elapsedDays = Math.max(0, Math.round(Number(world?.elapsedDays ?? DEFAULT_WORLD_CALENDAR.elapsedDays)));
  const rawHour = Number(world?.dayHour);
  return {
    eraName: String(world?.eraName || DEFAULT_WORLD_CALENDAR.eraName).slice(0, 12),
    calendarYear: Number.isFinite(Number(world?.calendarYear)) ? Math.round(Number(world?.calendarYear)) : 5000 + Math.floor(elapsedDays / 365),
    elapsedDays,
    dayHour: Number.isFinite(rawHour) ? Math.max(0, Math.min(23.99, rawHour)) : DEFAULT_DAY_HOUR,
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
  // 2026-08-31：连续态一个字都不吐。前端拿到空串就整块不渲染，
  // 相邻两条黏成同一场戏——这正是"没提到时间就是现在进行"的落点。
  if (args.timeAdvance?.unit === 'continuous') return '';
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
  // 2026-08-31：时段改由真实日内游标算。旧版是 PHASES[floor(dayOfYear/7)]，
  // 与角色实际在干嘛无关——叙事写了"入夜"，戳上照样可能显示"晨"。
  const phase = String(phaseHint || phaseOf(base.dayHour)).slice(0, 16);
  const hourName = hourNameOf(base.dayHour);
  const monthName = MONTHS[monthIndex] || '岁末';
  return {
    ...base,
    monthName,
    day,
    phase,
    hourName,
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
