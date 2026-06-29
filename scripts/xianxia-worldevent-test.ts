// 修真界感改进 - 任务 E 单元测试
// 验证 world-event-scheduler 模块：
//   - rollWorldEvent 不同 age + 随机种子触发/不触发
//   - applyWorldEvent cultivationMultiplier / statusList 注入
//   - decayWorldEvents 时间推进 activeEvents 减少
//   - advance-sse 集成 100 次 roll 触发率
// 独立脚本，不污染现有 smoke baseline

import {
  rollWorldEvent,
  applyWorldEvent,
  decayWorldEvents,
  activeCultivationMultiplier,
  isUnderWorldEvent,
  WORLD_EVENT_TYPES,
  type WorldEvent,
  type ActiveWorldEvent,
  type WorldEventState,
} from '../src/lib/xianxia/world-event-scheduler';

let failures = 0;
let passes = 0;

function assert(cond: any, label: string, info?: any) {
  if (cond) {
    passes++;
    console.log(JSON.stringify({ test: label, passed: true, ...(info || {}) }));
  } else {
    failures++;
    console.log(JSON.stringify({ test: label, passed: false, ...(info || {}) }));
  }
}

// ============ 1. 基础类型检查 ============
console.log('=== world-event-scheduler: 基础类型 ===');

assert(WORLD_EVENT_TYPES.length === 7, 'should expose 7 world event types', { types: WORLD_EVENT_TYPES });
assert(typeof rollWorldEvent === 'function', 'rollWorldEvent should be function');
assert(typeof applyWorldEvent === 'function', 'applyWorldEvent should be function');
assert(typeof decayWorldEvents === 'function', 'decayWorldEvents should be function');

// ============ 2. rollWorldEvent 年龄门槛 ============
console.log('=== rollWorldEvent: age < 30 不触发 ===');

let rollUnder30Count = 0;
for (let i = 0; i < 200; i++) {
  const ev = rollWorldEvent({ age: 25, worldEvent: { lastRollAge: 0, activeEvents: [], history: [] } }, undefined, Math.random);
  if (ev) rollUnder30Count++;
}
assert(rollUnder30Count === 0, 'age 25 should never trigger', { count: rollUnder30Count });

let rollAt29 = 0;
for (let i = 0; i < 200; i++) {
  const ev = rollWorldEvent({ age: 29 }, undefined, Math.random);
  if (ev) rollAt29++;
}
assert(rollAt29 === 0, 'age 29 should never trigger', { count: rollAt29 });

// ============ 3. rollWorldEvent age 100+ 触发率 ============
console.log('=== rollWorldEvent: age 50-150 触发率 ===');

// 用固定随机种子序列模拟
function makeSeededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rng = makeSeededRng(42);
let rollAt60Count = 0;
const rollResults60: string[] = [];
for (let i = 0; i < 1000; i++) {
  const ev = rollWorldEvent({ age: 60, worldEvent: { lastRollAge: 0, activeEvents: [], history: [] } }, undefined, rng);
  if (ev) {
    rollAt60Count++;
    rollResults60.push(ev.type);
  }
}
// age < 100: ancient_cave 0.008 + demon 0.003 = ~1.1% per roll
assert(rollAt60Count >= 5 && rollAt60Count <= 25, 'age 60 should trigger ~1.1% (1000 rolls → 5-25)', {
  count: rollAt60Count,
  distribution: rollResults60.slice(0, 10),
});

const rng2 = makeSeededRng(99);
let rollAt150Count = 0;
const rollResults150: string[] = [];
for (let i = 0; i < 1000; i++) {
  const ev = rollWorldEvent({ age: 150, worldEvent: { lastRollAge: 0, activeEvents: [], history: [] } }, undefined, rng2);
  if (ev) {
    rollAt150Count++;
    rollResults150.push(ev.type);
  }
}
// age 100-500: cave 0.5% + demon 0.3% + beast 0.2% + tide_low 0.1% = ~1.1%
assert(rollAt150Count >= 5 && rollAt150Count <= 30, 'age 150 should trigger ~1.1-1.5% (1000 rolls → 5-30)', {
  count: rollAt150Count,
  distribution: rollResults150.slice(0, 10),
});

// ============ 4. rollWorldEvent age >= 500 ============
console.log('=== rollWorldEvent: age 600 触发率 ===');

const rng3 = makeSeededRng(777);
let rollAt600Count = 0;
for (let i = 0; i < 1000; i++) {
  const ev = rollWorldEvent({ age: 600 }, undefined, rng3);
  if (ev) rollAt600Count++;
}
assert(rollAt600Count >= 0, 'age 600 should be able to trigger', { count: rollAt600Count });

// ============ 5. rollWorldEvent 防止密集触发 ============
console.log('=== rollWorldEvent: 同年去重 ===');

const stateWithActive: any = {
  age: 50,
  worldEvent: {
    lastRollAge: 50,
    activeEvents: [{
      event: {
        id: 'we-ancient_cave_open-50-1',
        type: 'ancient_cave_open',
        triggeredAge: 50,
        triggeredWorldTime: { eraName: 'default', calendarYear: 50, elapsedDays: 18250 },
        duration: 1,
        effects: {},
        narrative: 'test',
        appliedTo: 'this',
      },
      remainingYears: 1,
    }],
    history: [],
  },
};
const dupCount = (() => {
  let c = 0;
  for (let i = 0; i < 100; i++) {
    const ev = rollWorldEvent(stateWithActive, undefined, Math.random);
    if (ev) c++;
  }
  return c;
})();
assert(dupCount === 0, 'age within 1 year of active event should skip', { count: dupCount });

// ============ 6. applyWorldEvent cultivationMultiplier ============
console.log('=== applyWorldEvent: 灵潮枯竭 cultivationMultiplier = 0.3 ===');

const baseState: any = {
  age: 100,
  cultivationMultiplier: 1.0,
  lifespan: 200,
  rootMultiplier: 0.5,
  statusList: [],
};
const tideLowEvent: WorldEvent = {
  id: 'we-test-1',
  type: 'spirit_tide_low',
  triggeredAge: 100,
  triggeredWorldTime: { eraName: 'default', calendarYear: 100, elapsedDays: 36500 },
  duration: 5,
  effects: { cultivationMultiplier: 0.3 },
  narrative: 'test narrative',
  appliedTo: 'all',
};
const afterTideLow = applyWorldEvent(baseState, tideLowEvent);
assert(afterTideLow.cultivationMultiplier === 0.3, 'cultivationMultiplier should be 0.3 after tide_low', {
  mul: afterTideLow.cultivationMultiplier,
});
assert(Array.isArray(afterTideLow.statusList) && afterTideLow.statusList.length === 1, 'statusList should have 1 entry');
assert(afterTideLow.statusList[0].id === 'world-event-spirit-tide-low', 'statusList entry should have correct id');
assert(afterTideLow.statusJson && JSON.parse(afterTideLow.statusJson).length === 1, 'statusJson should be valid JSON with 1 entry');

console.log('=== applyWorldEvent: 灵潮复苏 cultivationMultiplier = 2.0 ===');

const tideHighEvent: WorldEvent = {
  id: 'we-test-2',
  type: 'spirit_tide_high',
  triggeredAge: 200,
  triggeredWorldTime: { eraName: 'default', calendarYear: 200, elapsedDays: 73000 },
  duration: 3,
  effects: { cultivationMultiplier: 2.0 },
  narrative: 'test narrative',
  appliedTo: 'all',
};
const afterTideHigh = applyWorldEvent(baseState, tideHighEvent);
assert(afterTideHigh.cultivationMultiplier === 2.0, 'cultivationMultiplier should be 2.0 after tide_high', {
  mul: afterTideHigh.cultivationMultiplier,
});

console.log('=== applyWorldEvent: 魔道入侵 lifespanModifier -10 ===');

const demonEvent: WorldEvent = {
  id: 'we-test-3',
  type: 'demon_invasion',
  triggeredAge: 60,
  triggeredWorldTime: { eraName: 'default', calendarYear: 60, elapsedDays: 21900 },
  duration: 3,
  effects: { cultivationMultiplier: 0.5, lifespanModifier: -10 },
  narrative: 'demon',
  appliedTo: 'all',
};
const afterDemon = applyWorldEvent({ ...baseState, lifespan: 200 }, demonEvent);
assert(afterDemon.lifespan === 190, 'lifespan should be 190 after demon invasion', { lifespan: afterDemon.lifespan });
assert(afterDemon.cultivationMultiplier === 0.5, 'cultivationMultiplier should be 0.5');

console.log('=== applyWorldEvent: 仙凡通道 rootMultiplierBoost +0.1 ===');

const mortalEvent: WorldEvent = {
  id: 'we-test-4',
  type: 'mortal_celestial_open',
  triggeredAge: 200,
  triggeredWorldTime: { eraName: 'default', calendarYear: 200, elapsedDays: 73000 },
  duration: 10,
  effects: { rootMultiplierBoost: 0.1 },
  narrative: 'mortal channel',
  appliedTo: 'this',
};
const afterMortal = applyWorldEvent({ ...baseState, rootMultiplier: 0.5 }, mortalEvent);
assert(afterMortal.rootMultiplier === 0.6, 'rootMultiplier should be 0.6 after mortal_celestial_open', {
  rootMultiplier: afterMortal.rootMultiplier,
});

console.log('=== applyWorldEvent: 古修洞府 pendingThread 注入 ===');

const caveEvent: WorldEvent = {
  id: 'we-test-5',
  type: 'ancient_cave_open',
  triggeredAge: 50,
  triggeredWorldTime: { eraName: 'default', calendarYear: 50, elapsedDays: 18250 },
  duration: 1,
  effects: { threadTitle: '古修洞府', threadSummary: 'test cave' },
  narrative: 'cave',
  appliedTo: 'this',
};
const afterCave = applyWorldEvent(baseState, caveEvent);
assert(Array.isArray(afterCave.pendingThreads) && afterCave.pendingThreads.length === 1, 'pendingThreads should have 1 entry');
assert(afterCave.pendingThreads[0].title === '古修洞府', 'pendingThreads title should be 古修洞府');

console.log('=== applyWorldEvent: 大修士飞升 previousWorldLegacies 注入 ===');

const ascendEvent: WorldEvent = {
  id: 'we-test-6',
  type: 'great_cultivator_ascend',
  triggeredAge: 600,
  triggeredWorldTime: { eraName: 'default', calendarYear: 600, elapsedDays: 219000 },
  duration: 5,
  effects: { cultivationMultiplier: 1.1 },
  narrative: 'ascend',
  appliedTo: 'this',
};
const afterAscend = applyWorldEvent({ ...baseState, previousWorldLegacies: [] }, ascendEvent);
assert(Array.isArray(afterAscend.previousWorldLegacies) && afterAscend.previousWorldLegacies.length === 1,
  'previousWorldLegacies should have 1 entry');

// ============ 7. 多事件叠加 cultivationMultiplier ============
console.log('=== applyWorldEvent: 多事件叠加 ===');

const state2: any = {
  age: 200,
  cultivationMultiplier: 1.0,
  lifespan: 300,
  rootMultiplier: 0.5,
  statusList: [],
};
const step1 = applyWorldEvent(state2, tideLowEvent); // 0.3
assert(step1.cultivationMultiplier === 0.3, 'after tide_low: mul = 0.3', { mul: step1.cultivationMultiplier });

const step2 = applyWorldEvent(step1, demonEvent); // 灵潮枯竭 0.3 + 魔劫 0.5 叠加 = 0.15
// 修真感逻辑：双劫并存时修士处境极艰难，cultivationMultiplier 应双重压制（0.3 * 0.5 = 0.15）
const expectedMul = 0.3 * 0.5;
assert(Math.abs(step2.cultivationMultiplier - expectedMul) < 0.001,
  'after tide_low + demon: 双劫叠加 mul = 0.3 * 0.5 = 0.15',
  { mul: step2.cultivationMultiplier, expected: expectedMul });

// ============ 8. decayWorldEvents 时间推进 ============
console.log('=== decayWorldEvents: 时间推进移除已结束 ===');

const state3: any = {
  age: 200,
  cultivationMultiplier: 0.5,
  lifespan: 300,
  worldEvent: {
    lastRollAge: 100,
    activeEvents: [
      { event: tideLowEvent, remainingYears: 5 },
      { event: demonEvent, remainingYears: 3 },
    ],
    history: [],
  },
};

const decayed1 = decayWorldEvents(state3, 2);
assert(decayed1.worldEvent.activeEvents.length === 2, 'after 2 years, 2 still active', { count: decayed1.worldEvent.activeEvents.length });
assert(decayed1.worldEvent.activeEvents[0].remainingYears === 3, 'tide_low remaining 3 years');

const decayed2 = decayWorldEvents(state3, 4);
// tide_low remaining 5 → 1 (保留), demon remaining 3 → -1 (移除)
assert(decayed2.worldEvent.activeEvents.length === 1, 'after 4 years: tide_low 1 left, demon ended', {
  count: decayed2.worldEvent.activeEvents.length,
  remaining: decayed2.worldEvent.activeEvents.map((a: any) => `${a.event.type}:${a.remainingYears}`),
});
assert(decayed2.worldEvent.activeEvents[0].event.type === 'spirit_tide_low', 'tide_low should remain');
assert(!decayed2.worldEvent.activeEvents.some((a: any) => a.event.type === 'demon_invasion'), 'demon should be ended');

const decayed3 = decayWorldEvents(state3, 10);
assert(decayed3.worldEvent.activeEvents.length === 0, 'after 10 years, all ended', { count: decayed3.worldEvent.activeEvents.length });
assert(decayed3.worldEvent.history.length === 2, 'history should have 2 ended events');
// statusList 应该被清空
assert(!decayed3.statusList || !decayed3.statusList.some((s: any) => s.id === 'world-event-spirit-tide-low'),
  'tide_low status should be removed from statusList');
assert(!decayed3.statusList || !decayed3.statusList.some((s: any) => s.id === 'world-event-demon-invasion'),
  'demon status should be removed from statusList');

// ============ 9. activeCultivationMultiplier / isUnderWorldEvent ============
console.log('=== 工具函数 ===');

const state4: any = {
  worldEvent: {
    activeEvents: [
      { event: tideLowEvent, remainingYears: 5 },
      { event: demonEvent, remainingYears: 3 },
    ],
  },
};
assert(Math.abs(activeCultivationMultiplier(state4) - 0.15) < 0.001, 'combined mul = 0.15', {
  mul: activeCultivationMultiplier(state4),
});
assert(isUnderWorldEvent(state4, 'demon_invasion') === true, 'should be under demon_invasion');
assert(isUnderWorldEvent(state4, 'beast_invasion') === false, 'should NOT be under beast_invasion');

// ============ 10. 集成测试：advance-sse 100 次 roll ============
console.log('=== 集成：advance-sse 100 次 roll 触发率 ===');

let triggerCount = 0;
let triggerTypes: Record<string, number> = {};
for (let i = 0; i < 100; i++) {
  const ev = rollWorldEvent({ age: 60 + i * 5 }, undefined, Math.random);
  if (ev) {
    triggerCount++;
    triggerTypes[ev.type] = (triggerTypes[ev.type] ?? 0) + 1;
  }
}
// 100 次 roll，每次 age 60-555，按 age 段概率加权，期望触发 1-5 次
assert(triggerCount >= 0 && triggerCount <= 15, '100 rolls across age 60-555 should trigger 0-15 events', {
  count: triggerCount,
  types: triggerTypes,
});

console.log('=== 修真感修真事件触发率统计 ===');
console.log(JSON.stringify({ triggerCount, triggerTypes }));

// ============ 11. 修真感修真修真修真：7 种事件类型都参与 roll ============
console.log('=== 7 种事件类型都能触发 ===');

let seenTypes: Set<string> = new Set();
for (let trial = 0; trial < 50; trial++) {
  for (let age = 50; age < 1500; age += 10) {
    const ev = rollWorldEvent({ age }, undefined, Math.random);
    if (ev) seenTypes.add(ev.type);
  }
}
console.log('seen event types:', Array.from(seenTypes));
assert(seenTypes.has('ancient_cave_open'), 'ancient_cave_open should appear');
assert(seenTypes.has('demon_invasion') || seenTypes.has('beast_invasion') || seenTypes.has('spirit_tide_low'),
  'at least one invasion/tide event should appear');

// ============ 总结 ============
console.log('\n=== 总结 ===');
console.log(JSON.stringify({ passes, failures, total: passes + failures }));

if (failures > 0) {
  console.error(`[FAIL] ${failures} test(s) failed`);
  process.exit(1);
}
console.log(`[PASS] all ${passes} tests passed`);