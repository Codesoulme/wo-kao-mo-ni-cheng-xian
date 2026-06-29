// 修真界感改进 - 任务 E：世界级事件调度器
// 让世界"活"起来（不只是单 character 在玩）：
//   灵潮枯竭 / 灵潮复苏 / 魔道入侵 / 妖族入侵 / 仙凡通道开 / 古修洞府开 / 大修士飞升
// 触发后注入 character state（statusJson + cultivationMultiplier + lifespan）。
// 状态存 character stateJson（runtime 不依赖 prisma schema）。
//
// 设计原则：
//   1) rollWorldEvent 纯函数：根据 age + Math.random() 决定触发，不依赖外部副作用
//   2) applyWorldEvent 注入 status + 修改变量，副作用小（仅修改 finalState 内存对象）
//   3) decayWorldEvents 按 yearsAdvanced 推进时间，移出已结束事件
//   4) 与 advance-sse route 集成（在 db.character.update 之前）

import type { CharacterState } from './types';

// ========== 类型定义 ==========

export type WorldEventType =
  | 'spirit_tide_low'         // 灵潮枯竭
  | 'spirit_tide_high'        // 灵潮复苏
  | 'demon_invasion'          // 魔道入侵
  | 'beast_invasion'          // 妖族入侵
  | 'mortal_celestial_open'   // 仙凡通道开
  | 'ancient_cave_open'       // 古修洞府开
  | 'great_cultivator_ascend' // 大修士飞升

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  triggeredAge: number;
  triggeredWorldTime: { eraName: string; calendarYear: number; elapsedDays: number };
  duration: number; // years
  effects: {
    cultivationMultiplier?: number;  // 0.3 / 2.0 / 0.5 / 1.5 / 1.1
    lifespanModifier?: number;       // -10
    rootMultiplierBoost?: number;    // +0.1
    threadTitle?: string;            // 古修洞府
    threadSummary?: string;          // 线索摘要
  };
  narrative: string;
  appliedTo: 'this' | 'all';
}

export interface ActiveWorldEvent {
  event: WorldEvent;
  remainingYears: number;
}

export interface WorldEventState {
  lastRollAge: number;
  activeEvents: ActiveWorldEvent[];
  history: WorldEvent[];
}

// ========== 配置：7 种事件 ==========

interface WorldEventConfig {
  type: WorldEventType;
  duration: number;
  cultivationMultiplier?: number;
  lifespanModifier?: number;
  rootMultiplierBoost?: number;
  threadTitle?: string;
  threadSummary?: string;
  statusName: string;
  statusId: string;
  statusDescription: (age: number) => string;
  narrativeTemplate: string;
}

const WORLD_EVENT_CONFIGS: Record<WorldEventType, WorldEventConfig> = {
  spirit_tide_low: {
    type: 'spirit_tide_low',
    duration: 5,
    cultivationMultiplier: 0.3,
    statusName: '灵气枯竭',
    statusId: 'world-event-spirit-tide-low',
    statusDescription: () => '灵潮衰退，灵气稀薄，修炼事倍功半。',
    narrativeTemplate: '灵气如潮水退去，九州天地元气骤然稀薄。修炼者皆感突破艰难，仿佛整片天地都在沉睡。',
  },
  spirit_tide_high: {
    type: 'spirit_tide_high',
    duration: 3,
    cultivationMultiplier: 2.0,
    statusName: '灵潮复苏',
    statusId: 'world-event-spirit-tide-high',
    statusDescription: () => '灵潮复涌，天地元气充沛，修炼一日千里。',
    narrativeTemplate: '沉睡千年的灵脉重新涌动，天降灵雨，万物复苏。修士们奔走相告：这是大世之兆！',
  },
  demon_invasion: {
    type: 'demon_invasion',
    duration: 3,
    cultivationMultiplier: 0.5,
    lifespanModifier: -10,
    statusName: '魔劫',
    statusId: 'world-event-demon-invasion',
    statusDescription: () => '魔道大能兴风作浪，九州血色弥漫。',
    narrativeTemplate: '极北冰原之下，魔道大能破封而出。九州修仙界风云变色，正道与魔道的千年恩怨再次点燃。',
  },
  beast_invasion: {
    type: 'beast_invasion',
    duration: 2,
    cultivationMultiplier: 1.5,
    statusName: '妖劫',
    statusId: 'world-event-beast-invasion',
    statusDescription: () => '妖界动荡，妖王率众南下，弱者被淘汰。',
    narrativeTemplate: '妖界动荡，妖王率众越过万妖山脉南下。山野之间妖兽啸月，弱者被淘汰，强者于血火中诞生。',
  },
  mortal_celestial_open: {
    type: 'mortal_celestial_open',
    duration: 10,
    rootMultiplierBoost: 0.1,
    statusName: '仙凡交融',
    statusId: 'world-event-mortal-celestial-open',
    statusDescription: () => '仙凡通道微启，凡尘之中灵根觉醒者增多。',
    narrativeTemplate: '传说中封印的仙凡通道微微颤动，灵气渗入凡尘。散落人间的灵根开始觉醒，平民少年亦有仙缘。',
  },
  ancient_cave_open: {
    type: 'ancient_cave_open',
    duration: 1,
    threadTitle: '古修洞府',
    threadSummary: '某处古修遗留洞府禁制松动，机缘巧合之下重见天日。',
    statusName: '古修遗府',
    statusId: 'world-event-ancient-cave-open',
    statusDescription: (age) => `古修洞府于 ${age} 岁开启，引得四方云动。`,
    narrativeTemplate: '深山古洞之中，禁制因岁月侵蚀而松动。传闻此地曾为上古大能闭关之所，遗留秘宝无数。',
  },
  great_cultivator_ascend: {
    type: 'great_cultivator_ascend',
    duration: 5,
    cultivationMultiplier: 1.1,
    statusName: '大修士飞升',
    statusId: 'world-event-great-ascend',
    statusDescription: () => '有大能破界飞升，余泽润泽后世。',
    narrativeTemplate: '天际紫气东来三万里，仙音缥缈。有大修士历劫成功，破碎虚空飞升仙界，余泽润泽后世千年。',
  },
};

// ========== 辅助函数 ==========

function makeId(type: WorldEventType, age: number): string {
  return `we-${type}-${age}-${Math.floor(Math.random() * 100000)}`;
}

function buildNarrative(config: WorldEventConfig, age: number): string {
  return `${config.narrativeTemplate}（age ${age}）`;
}

// ========== roll 函数 ==========

export function rollWorldEvent(
  state: any,
  worldTime?: { eraName: string; calendarYear: number; elapsedDays: number },
  randomFn: () => number = Math.random,
): WorldEvent | null {
  const age = Number(state?.age ?? 0);
  if (!Number.isFinite(age) || age < 30) return null;

  // 同一年内若已有 active 事件，跳过 roll（避免密集触发）
  const existing = (state?.worldEvent?.activeEvents ?? []) as ActiveWorldEvent[];
  if (existing.some(a => a.event.triggeredAge >= age - 1)) return null;

  const roll = randomFn();
  const wt = worldTime ?? { eraName: 'default', calendarYear: age, elapsedDays: age * 365 };

  // 灵潮复苏：仅在枯竭之后可触发
  const hasRecentTideLow = existing.some(a => a.event.type === 'spirit_tide_low');

  if (age < 100) {
    if (roll < 0.008) return makeEvent('ancient_cave_open', age, wt);
    if (roll < 0.005 + 0.008) return makeEvent('demon_invasion', age, wt);
    return null;
  }
  if (age < 500) {
    if (roll < 0.005) return makeEvent('ancient_cave_open', age, wt);
    if (roll < 0.005 + 0.003) return makeEvent('demon_invasion', age, wt);
    if (roll < 0.008 + 0.002) return makeEvent('beast_invasion', age, wt);
    if (roll < 0.010 + 0.001) return makeEvent('spirit_tide_low', age, wt);
    if (hasRecentTideLow && roll < 0.012) return makeEvent('spirit_tide_high', age, wt);
    if (roll < 0.012 + 0.0005) return makeEvent('mortal_celestial_open', age, wt);
    return null;
  }
  // age >= 500
  if (roll < 0.002) return makeEvent('demon_invasion', age, wt);
  if (roll < 0.002 + 0.0015) return makeEvent('beast_invasion', age, wt);
  if (roll < 0.0035 + 0.001) return makeEvent('spirit_tide_low', age, wt);
  if (roll < 0.0045 + 0.0005) return makeEvent('great_cultivator_ascend', age, wt);
  if (hasRecentTideLow && roll < 0.0055) return makeEvent('spirit_tide_high', age, wt);
  if (roll < 0.0055 + 0.001) return makeEvent('mortal_celestial_open', age, wt);
  return null;
}

function makeEvent(
  type: WorldEventType,
  age: number,
  worldTime: { eraName: string; calendarYear: number; elapsedDays: number },
): WorldEvent {
  const cfg = WORLD_EVENT_CONFIGS[type];
  return {
    id: makeId(type, age),
    type,
    triggeredAge: age,
    triggeredWorldTime: { ...worldTime },
    duration: cfg.duration,
    effects: {
      cultivationMultiplier: cfg.cultivationMultiplier,
      lifespanModifier: cfg.lifespanModifier,
      rootMultiplierBoost: cfg.rootMultiplierBoost,
      threadTitle: cfg.threadTitle,
      threadSummary: cfg.threadSummary,
    },
    narrative: buildNarrative(cfg, age),
    appliedTo: type === 'demon_invasion' || type === 'beast_invasion' || type === 'spirit_tide_low' || type === 'spirit_tide_high'
      ? 'all'
      : 'this',
  };
}

// ========== apply 函数 ==========

export function applyWorldEvent(state: any, event: WorldEvent): any {
  const newState: any = { ...state };
  const cfg = WORLD_EVENT_CONFIGS[event.type];

  // 1. 注入 worldEvent 状态机
  const existingWE: WorldEventState = newState.worldEvent ?? {
    lastRollAge: 0,
    activeEvents: [],
    history: [],
  };
  // 累计 multiplier（多个 active 事件叠加：取乘积，但避免 0 边界）
  let combinedMultiplier = 1.0;
  const allActive = [...existingWE.activeEvents.map(a => a.event), event];
  for (const ev of allActive) {
    const m = ev.effects.cultivationMultiplier;
    if (typeof m === 'number') combinedMultiplier *= m;
  }

  const newActive: ActiveWorldEvent[] = [
    ...existingWE.activeEvents,
    { event, remainingYears: event.duration },
  ];

  newState.worldEvent = {
    lastRollAge: event.triggeredAge,
    activeEvents: newActive,
    history: existingWE.history,
  };

  // 2. 应用 cultivationMultiplier（直接修改 finalState.cultivationMultiplier，避免双重叠加）
  if (event.effects.cultivationMultiplier !== undefined) {
    const originalBase = Number(newState.cultivationMultiplier ?? 1.0) / combinedMultiplier * (event.effects.cultivationMultiplier === combinedMultiplier ? 1 : 1);
    // 简化策略：用乘法叠加：newMul = base * combined
    // 但我们不知道 base —— 简单方案：newMul = currentMul * ratio
    const currentMul = Number(newState.cultivationMultiplier ?? 1.0);
    // 取当前 activeEvents 不含本事件的乘积作为 base
    const priorCombined = existingWE.activeEvents.reduce((acc, a) => {
      const m = a.event.effects.cultivationMultiplier;
      return typeof m === 'number' ? acc * m : acc;
    }, 1.0);
    const baseMul = priorCombined === 0 ? currentMul : currentMul / priorCombined;
    newState.cultivationMultiplier = baseMul * combinedMultiplier;
  }

  // 3. lifespanModifier
  if (event.effects.lifespanModifier !== undefined && typeof newState.lifespan === 'number') {
    newState.lifespan = Math.max(1, newState.lifespan + event.effects.lifespanModifier);
  }

  // 4. rootMultiplierBoost
  if (event.effects.rootMultiplierBoost !== undefined && typeof newState.rootMultiplier === 'number') {
    newState.rootMultiplier = newState.rootMultiplier + event.effects.rootMultiplierBoost;
  }

  // 5. 注入 statusList / statusJson（与任务 D 同模式）
  const statusList: any[] = Array.isArray(newState.statusList)
    ? [...newState.statusList]
    : (Array.isArray(newState.activeStatuses) ? [...newState.activeStatuses] : []);
  if (!statusList.some((s: any) => s && s.id === cfg.statusId)) {
    statusList.push({
      id: cfg.statusId,
      name: cfg.statusName,
      category: 'world',
      rarity: 'legendary',
      description: cfg.statusDescription(event.triggeredAge),
      source: 'world-event-scheduler',
      duration: event.duration,
      eventType: event.type,
    });
    newState.statusList = statusList;
    newState.statuses = statusList;
    newState.statusJson = JSON.stringify(statusList);
  }

  // 6. 注入 pendingThread（仅古修洞府）
  if (event.effects.threadTitle) {
    const threads: any[] = Array.isArray(newState.pendingThreads) ? [...newState.pendingThreads] : [];
    if (!threads.some((t: any) => t && t.title === event.effects.threadTitle)) {
      threads.push({
        title: event.effects.threadTitle,
        description: event.effects.threadSummary ?? event.narrative,
        category: 'world-event',
        urgency: 'medium',
        deadlineAge: event.triggeredAge + event.duration * 12,
        source: 'world-event-scheduler',
      });
      newState.pendingThreads = threads;
    }
  }

  // 7. 注入 previousWorldLegacies（大修士飞升）
  if (event.type === 'great_cultivator_ascend') {
    const legacies: any[] = Array.isArray(newState.previousWorldLegacies) ? [...newState.previousWorldLegacies] : [];
    legacies.push({
      characterName: `飞升大能 ${event.triggeredAge}`,
      status: `${event.triggeredAge} 岁飞升`,
      summary: event.narrative,
      relicSeeds: ['飞升遗泽'],
      legendSeeds: [`飞升者余泽 +10% 修为 ${event.duration} 年`],
    });
    newState.previousWorldLegacies = legacies;
  }

  return newState;
}

// ========== decay 函数 ==========

export function decayWorldEvents(state: any, yearsAdvanced: number): any {
  if (!state?.worldEvent) return state;
  const newState: any = { ...state };
  const we: WorldEventState = state.worldEvent;
  const dt = Math.max(0, Number(yearsAdvanced) || 0);

  const stillActive: ActiveWorldEvent[] = [];
  const ended: WorldEvent[] = [];

  for (const a of we.activeEvents) {
    const remaining = a.remainingYears - dt;
    if (remaining > 0) {
      stillActive.push({ event: a.event, remainingYears: remaining });
    } else {
      ended.push(a.event);
    }
  }

  // 倒序遍历 ended，按 id 去掉 statusList 中对应的 status
  if (ended.length > 0) {
    const statusList: any[] = Array.isArray(newState.statusList) ? [...newState.statusList] : [];
    for (const ev of ended) {
      const cfg = WORLD_EVENT_CONFIGS[ev.type];
      const idx = statusList.findIndex((s: any) => s && s.id === cfg.statusId);
      if (idx >= 0) statusList.splice(idx, 1);
    }
    newState.statusList = statusList;
    newState.statuses = statusList;
    newState.statusJson = JSON.stringify(statusList);

    // 重置 cultivationMultiplier（移除已结束事件的乘数）
    let combinedMultiplier = 1.0;
    for (const a of stillActive) {
      const m = a.event.effects.cultivationMultiplier;
      if (typeof m === 'number') combinedMultiplier *= m;
    }
    if (stillActive.length < we.activeEvents.length) {
      // 有事件结束，需要重新计算 multiplier
      // base = currentMul / priorCombined
      const priorCombined = we.activeEvents.reduce((acc, a) => {
        const m = a.event.effects.cultivationMultiplier;
        return typeof m === 'number' ? acc * m : acc;
      }, 1.0);
      const currentMul = Number(newState.cultivationMultiplier ?? 1.0);
      const baseMul = priorCombined === 0 ? currentMul : currentMul / priorCombined;
      newState.cultivationMultiplier = baseMul * combinedMultiplier;
    }

    // 回退 lifespanModifier
    for (const ev of ended) {
      if (ev.effects.lifespanModifier !== undefined && typeof newState.lifespan === 'number') {
        newState.lifespan = newState.lifespan - ev.effects.lifespanModifier;
      }
      // 回退 rootMultiplierBoost
      if (ev.effects.rootMultiplierBoost !== undefined && typeof newState.rootMultiplier === 'number') {
        newState.rootMultiplier = Math.max(0, newState.rootMultiplier - ev.effects.rootMultiplierBoost);
      }
    }
  }

  newState.worldEvent = {
    lastRollAge: we.lastRollAge,
    activeEvents: stillActive,
    history: [...we.history, ...ended].slice(-50),
  };

  return newState;
}

// ========== 工具：累计当前 active 倍率 ==========

export function activeCultivationMultiplier(state: any): number {
  const active: ActiveWorldEvent[] = state?.worldEvent?.activeEvents ?? [];
  return active.reduce((acc, a) => {
    const m = a.event.effects.cultivationMultiplier;
    return typeof m === 'number' ? acc * m : acc;
  }, 1.0);
}

// ========== 工具：检查是否处于某事件中 ==========

export function isUnderWorldEvent(state: any, type: WorldEventType): boolean {
  const active: ActiveWorldEvent[] = state?.worldEvent?.activeEvents ?? [];
  return active.some(a => a.event.type === type);
}

export const WORLD_EVENT_TYPES: WorldEventType[] = [
  'spirit_tide_low',
  'spirit_tide_high',
  'demon_invasion',
  'beast_invasion',
  'mortal_celestial_open',
  'ancient_cave_open',
  'great_cultivator_ascend',
];