// 修仙界感改进 - 任务 E v2 单元测试
// 验证 world-event-scheduler 模块：
//   - 30+ 模板完整性、type 覆盖、hints/effects/triggers 字段齐备
//   - getAvailableEvents 按 age/realm/族裔/lineage/cooldown/prerequisites/excludedIf 过滤
//   - parseWorldEventMarkers 解析 [WORLD_EVENT:type] 标记（单 & 完块）
//   - buildAvailableWorldEventsPrompt 文案完整性
//   - fallbackRollWorldEvent 旧 random roll 仍能触发（兼容 7 种历史事件）
//   - 多事件叠加 cultivationMultiplier / decayWorldEvents 推进时间
//   - 修仙界感修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙
// 独立脚本，不污染现有 smoke baseline。

import {
  // 核心 API
  rollWorldEvent,
  fallbackRollWorldEvent,
  applyWorldEvent,
  decayWorldEvents,
  activeCultivationMultiplier,
  isUnderWorldEvent,
  // 新 API
  WORLD_EVENT_TYPES,
  WORLD_EVENT_TEMPLATES,
  getAvailableEvents,
  getWorldEventTemplate,
  isTemplateEligible,
  parseWorldEventMarkers,
  applyEventTemplate,
  buildAvailableWorldEventsPrompt,
  realmRank,
  type WorldEvent,
  type WorldEventTemplate,
  type WorldEventType,
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

// ============================================================
// 1. 模板库：30+ WorldEventType + 字段完整性
// ============================================================
console.log('=== 模板库：30+ 种 WorldEventType ===');

const REQUIRED_TYPES: WorldEventType[] = [
  'spirit_tide_low', 'spirit_tide_high', 'dao_blessing', 'dao_warning',
  'mofa_era_begins', 'mofa_era_ends',
  'demon_invasion', 'demon_pushed_back', 'demonic_sect_rises', 'demonic_sect_destroyed',
  'beast_invasion', 'beast_calmed', 'beast_tide', 'beast_tide_calmed',
  'holy_beast_descends', 'holy_beast_retreats',
  'rare_treasure_surfaces', 'rare_treasure_taken',
  'great_cultivator_ascend', 'great_cultivator_falls',
  'ancient_seal_weakens', 'ancient_seal_strengthened',
  'mortal_celestial_open', 'mortal_celestial_close',
  'mortal_celestial_war', 'mortal_celestial_peace',
  'catastrophe_imminent',
  'sect_tournament', 'sect_civil_war',
  'ancient_cave_open', 'ancient_cave_explored',
];

assert(WORLD_EVENT_TYPES.length >= 30, 'WORLD_EVENT_TYPES 至少 30 种', {
  total: WORLD_EVENT_TYPES.length,
  expected: REQUIRED_TYPES.length,
});
assert(WORLD_EVENT_TEMPLATES.length === WORLD_EVENT_TYPES.length, 'TEMPLATES 与 TYPES 数量一致');
for (const t of REQUIRED_TYPES) {
  assert(WORLD_EVENT_TYPES.includes(t), `模板库含 ${t}`, { has: WORLD_EVENT_TYPES.includes(t) });
}

console.log('=== 模板字段完整性：type/title/category/narrativeTemplate/effects/hints/cooldown/rarity/duration ===');
let allTemplatesValid = true;
const invalidTemplateTypes: string[] = [];
for (const tpl of WORLD_EVENT_TEMPLATES) {
  if (
    !tpl.type ||
    !tpl.title ||
    !tpl.category ||
    !tpl.narrativeTemplate ||
    !tpl.hints ||
    tpl.hints.length === 0 ||
    typeof tpl.triggerConditions.cooldown !== 'number' ||
    !tpl.rarity ||
    typeof tpl.duration !== 'number'
  ) {
    allTemplatesValid = false;
    invalidTemplateTypes.push(tpl.type);
  }
}
assert(allTemplatesValid, '所有模板字段齐备（type/title/category/narrative/hints/cooldown/rarity/duration）', {
  invalid: invalidTemplateTypes,
  total: WORLD_EVENT_TEMPLATES.length,
});

console.log('=== 模板 narrativeTemplate 含可读占位符 ===');
let allHavePlaceholdersOrNatural = true;
const noPlaceholderTypes: string[] = [];
for (const tpl of WORLD_EVENT_TEMPLATES) {
  // narrativeTemplate 不需要必须含占位符，但至少要可读
  if (!tpl.narrativeTemplate || tpl.narrativeTemplate.length < 8) {
    allHavePlaceholdersOrNatural = false;
    noPlaceholderTypes.push(tpl.type);
  }
}
assert(allHavePlaceholdersOrNatural, '所有模板 narrativeTemplate ≥ 8 字', {
  total: WORLD_EVENT_TEMPLATES.length,
  short: noPlaceholderTypes,
});

// ============================================================
// 2. getAvailableEvents：基础 age 过滤
// ============================================================
console.log('=== getAvailableEvents：按 age 过滤 ===');

const youngState: any = {
  age: 10, realm: '炼气期', ethnicity: 'human', lineage: '凡人',
  worldEvent: { activeEvents: [], history: [] },
};
const youngAvailable = getAvailableEvents(youngState, undefined, [], { limit: 50 });
// age 10：低于绝大多数 minAge，应过滤掉大部分；spiritual_root_minAge=16 才开放
const youngTypes = youngAvailable.map(t => t.type);
assert(!youngTypes.includes('spirit_tide_low'), 'age 10 不应触发灵潮枯竭（minAge 16）');
assert(!youngTypes.includes('demon_invasion'), 'age 10 不应触发魔道入侵（minAge 30）');
assert(!youngTypes.includes('mofa_era_begins'), 'age 10 不应触发末法（minAge 100）');

console.log('=== getAvailableEvents：age 50 应触发更多 ===');
const midState: any = {
  age: 50, realm: '筑基期', ethnicity: 'human', lineage: '凡人',
  worldEvent: { activeEvents: [], history: [] },
};
const midAvailable = getAvailableEvents(midState, undefined, [], { limit: 50 });
const midTypes = midAvailable.map(t => t.type);
assert(midTypes.includes('spirit_tide_low'), 'age 50 筑基应包含灵潮枯竭');
assert(midTypes.includes('demon_invasion'), 'age 50 筑基应包含魔道入侵');
assert(midTypes.includes('ancient_cave_open'), 'age 50 筑基应包含古修洞府');
assert(!midTypes.includes('mofa_era_begins'), 'age 50 不应包含末法（minAge 100）');

console.log('=== getAvailableEvents：按 realm 过滤（minRealm=foundation 才开放宗门大比） ===');
const qiState: any = {
  age: 50, realm: '炼气期', ethnicity: 'human', lineage: '凡人',
  worldEvent: { activeEvents: [], history: [] },
};
const qiAvailable = getAvailableEvents(qiState, undefined, [], { limit: 50 });
const qiTypes = qiAvailable.map(t => t.type);
assert(!qiTypes.includes('sect_tournament'), 'realm=炼气 不应包含仙门大比（需 minRealm=foundation）');

const foundationState: any = {
  age: 50, realm: '筑基期', ethnicity: 'human', lineage: '凡人',
  worldEvent: { activeEvents: [], history: [] },
};
const foundationAvailable = getAvailableEvents(foundationState, undefined, [], { limit: 50 });
const foundationTypes = foundationAvailable.map(t => t.type);
assert(foundationTypes.includes('sect_tournament'), 'realm=筑基 应包含仙门大比');

// ============================================================
// 3. getAvailableEvents：族裔 / 出身
// ============================================================
console.log('=== getAvailableEvents：族裔/出身默认 * 通配 ===');
const defaultState: any = {
  age: 30, realm: '炼气期', ethnicity: '', lineage: '',
  worldEvent: { activeEvents: [], history: [] },
};
const defaultAvailable = getAvailableEvents(defaultState, undefined, [], { limit: 100 });
// 多数模板未指定族裔/出身时应全通过
assert(defaultAvailable.length > 5, '默认状态应能匹配多个模板', { count: defaultAvailable.length });

// ============================================================
// 4. getAvailableEvents：cooldown
// ============================================================
console.log('=== getAvailableEvents：cooldown 防刷屏 ===');

const recentTideLow: WorldEvent = {
  id: 'past-1', type: 'spirit_tide_low',
  triggeredAge: 100, triggeredWorldTime: { eraName: 'e', calendarYear: 100, elapsedDays: 36500 },
  duration: 5, effects: { cultivationMultiplier: 0.3 },
  narrative: 'past', appliedTo: 'all',
};
const recentlyTideLowHistory = [recentTideLow];
const stateAfterTideLow: any = {
  age: 105, realm: '炼气期', ethnicity: 'human', lineage: '凡人',
  worldEvent: { activeEvents: [], history: recentlyTideLowHistory },
};
const afterTideLowAvailable = getAvailableEvents(stateAfterTideLow, undefined, recentlyTideLowHistory, { limit: 100 });
const tideLowFiltered = afterTideLowAvailable.find(t => t.type === 'spirit_tide_low');
// cooldown=10, age 105 - last 100 = 5 < 10 → 应被过滤
assert(!tideLowFiltered, 'age 105（最近 5 年有灵潮枯竭）不应再次出现灵潮枯竭（cooldown 10）');

const stateAfterTideLowCooldownOK: any = {
  age: 120, realm: '炼气期', ethnicity: 'human', lineage: '凡人',
  worldEvent: { activeEvents: [], history: recentlyTideLowHistory },
};
const afterCooldownAvailable = getAvailableEvents(stateAfterTideLowCooldownOK, undefined, recentlyTideLowHistory, { limit: 100 });
const tideLowAvailable = afterCooldownAvailable.find(t => t.type === 'spirit_tide_low');
assert(!!tideLowAvailable, 'age 120（最近 20 年）应可再次触发灵潮枯竭（cooldown 已过）');

// ============================================================
// 5. getAvailableEvents：prerequisites 链式触发
// ============================================================
console.log('=== getAvailableEvents：prerequisites 链式触发 ===');

// 灵潮复苏必须在灵潮枯竭之后
const noTideLowHistory: WorldEvent[] = [];
const noTideLowState: any = {
  age: 30, realm: '炼气期', ethnicity: 'human', lineage: '凡人',
  worldEvent: { activeEvents: [], history: noTideLowHistory },
};
const noTideLowAvailable = getAvailableEvents(noTideLowState, undefined, noTideLowHistory, { limit: 100 });
assert(!noTideLowAvailable.find(t => t.type === 'spirit_tide_high'), '无灵潮枯竭不应出现灵潮复苏');

const withTideLowState: any = {
  age: 30, realm: '炼气期', ethnicity: 'human', lineage: '凡人',
  worldEvent: { activeEvents: [], history: [{ ...recentTideLow, triggeredAge: 25 }] },
};
const withTideLowAvailable = getAvailableEvents(withTideLowState, undefined, withTideLowState.worldEvent.history, { limit: 100 });
assert(withTideLowAvailable.some(t => t.type === 'spirit_tide_high'), '有灵潮枯竭后应可出现灵潮复苏');

// excludedIf：spirit_tide_low 不能与 spirit_tide_high 并存
// 当前 active 已有 spirit_tide_low 时，过滤 spirit_tide_high 的逻辑属于 prereq（依赖 history 里也有）
// spirit_tide_high 的 prereq 是 spirit_tide_low——所以只要历史里有 low 就可触发 high（即使 active 是 low）——这是设计意图（高低交替）

// ============================================================
// 6. realmRank
// ============================================================
console.log('=== realmRank 排序 ===');
assert(realmRank('炼气期') === 1, '炼气期 rank=1');
assert(realmRank('筑基期') === 2, '筑基期 rank=2');
assert(realmRank('金丹期') === 3, '金丹期 rank=3');
assert(realmRank('元婴期') === 4, '元婴期 rank=4');
assert(realmRank('化神期') === 5, '化神期 rank=5');
assert(realmRank('渡劫期') === 9, '渡劫期 rank=9');
assert(realmRank('凡人') === 0, '凡人 rank=0');
assert(realmRank('unknown') === -1, 'unknown rank=-1');

// ============================================================
// 7. parseWorldEventMarkers：单标记 + 完块
// ============================================================
console.log('=== parseWorldEventMarkers ===');

const state70: any = {
  age: 70, realm: '筑基期', ethnicity: 'human', lineage: '凡人',
  worldEvent: { activeEvents: [], history: [] },
};
const wt70 = { eraName: 'e', calendarYear: 70, elapsedDays: 25550 };

// 单标记
const singleMarker = '[WORLD_EVENT:spirit_tide_low] 灵气如潮水退去... [/WORLD_EVENT]';
const singleResult = parseWorldEventMarkers(singleMarker, state70, wt70, []);
assert(!!singleResult, '单 [WORLD_EVENT:type] 块应解析成功');
assert(singleResult?.event.type === 'spirit_tide_low', '单块应解析为 spirit_tide_low');

// 完块 + 多段文字
const fullBlock = '外部叙事。[WORLD_EVENT:beast_invasion] 妖兽南下 [/WORLD_EVENT] 后续叙事。';
const fullResult = parseWorldEventMarkers(fullBlock, state70, wt70, []);
assert(!!fullResult, '完整 [WORLD_EVENT:type]...[/WORLD_EVENT] 块应解析成功');
assert(fullResult?.event.type === 'beast_invasion', '完整块应解析为 beast_invasion');

// 不存在 type 应被忽略
const unknownMarker = '[WORLD_EVENT:nonexistent_type] xxx [/WORLD_EVENT]';
const unknownResult = parseWorldEventMarkers(unknownMarker, state70, wt70, []);
assert(unknownResult === null, '未知 type 应返回 null');

// cooldown 不满足时也应返回 null（age 太早）
const youngStateBlock = '[WORLD_EVENT:catastrophe_imminent] 大劫将至 [/WORLD_EVENT]';
const youngState30: any = { age: 30, realm: '炼气期', ethnicity: 'human', lineage: '凡人' };
const youngResult = parseWorldEventMarkers(youngStateBlock, youngState30, { eraName: 'e', calendarYear: 30, elapsedDays: 10950 }, []);
assert(youngResult === null, 'age 30 不应触发大劫将至（minAge 200）');

// 无 narrative
const noNarrative: any = { age: 70, realm: '筑基期' };
const emptyResult = parseWorldEventMarkers('', noNarrative, wt70, []);
assert(emptyResult === null, '空 narrative 应返回 null');

// ============================================================
// 8. buildAvailableWorldEventsPrompt
// ============================================================
console.log('=== buildAvailableWorldEventsPrompt ===');

const promptYoung = buildAvailableWorldEventsPrompt(youngState30, undefined, [], { maxItems: 8 });
assert(typeof promptYoung === 'string' && promptYoung.length > 50, '文案非空且 > 50 字符', { len: promptYoung.length });
assert(promptYoung.includes('世界级事件') || promptYoung.includes('无可触发'), '文案含"世界级事件"或"无可触发"');

const promptNormal = buildAvailableWorldEventsPrompt(midState, undefined, [], { maxItems: 8 });
assert(promptNormal.includes('spirit_tide_low') || promptNormal.includes('灵潮枯竭'), 'age 50 文案应提到灵潮相关');
assert(promptNormal.includes('cooldown='), '文案含 cooldown= 标注');

console.log('=== prompt 缩量：maxItems 限流 ===');
const prompt5 = buildAvailableWorldEventsPrompt(midState, undefined, [], { maxItems: 3 });
// 模板行格式 "- <type>（" 开头；hints 段以 "提示=xxx；" 或 "影响=xxx" 形式跟在同一行
const templateLineCount = prompt5.split('\n').filter(l => /^- [a-z_]+\s*\(/.test(l)).length;
assert(templateLineCount <= 3, 'maxItems=3 应限制列出的模板数 ≤ 3', { listed: templateLineCount });

// ============================================================
// 9. fallbackRollWorldEvent：旧 random roll 仍能触发
// ============================================================
console.log('=== fallbackRollWorldEvent：旧 random roll 兼容 ===');

function makeSeededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// age < 30 不触发（沿用旧逻辑）
const fbUnder30: number = (() => {
  let c = 0;
  for (let i = 0; i < 100; i++) {
    const ev = fallbackRollWorldEvent({ age: 25, worldEvent: { activeEvents: [], history: [] } }, undefined, Math.random);
    if (ev) c++;
  }
  return c;
})();
assert(fbUnder30 === 0, 'fallbackRollWorldEvent age 25 应永不触发', { count: fbUnder30 });

// age 60 应能触发（约 1.1% 概率）
const fb60: any[] = [];
const rng = makeSeededRng(42);
for (let i = 0; i < 1000; i++) {
  const ev = fallbackRollWorldEvent({ age: 60, worldEvent: { activeEvents: [], history: [] } }, undefined, rng);
  if (ev) fb60.push(ev);
}
assert(fb60.length >= 5 && fb60.length <= 30, 'fallback age 60 触发率 1.1% (1000 → 5-30)', { count: fb60.length });

// 向后兼容：rollWorldEvent 与 fallbackRollWorldEvent 是同一函数
assert(rollWorldEvent === fallbackRollWorldEvent, 'rollWorldEvent = fallbackRollWorldEvent 向后兼容');

// ============================================================
// 10. applyEventTemplate + getWorldEventTemplate
// ============================================================
console.log('=== applyEventTemplate / getWorldEventTemplate ===');

const caveTpl = getWorldEventTemplate('ancient_cave_open');
assert(!!caveTpl, 'getWorldEventTemplate 应能找到 ancient_cave_open');
assert(caveTpl?.title === '古修洞府开启', '古修洞府 title 正确');

const caveEvent = applyEventTemplate(caveTpl!, state70, wt70);
assert(caveEvent.type === 'ancient_cave_open', 'applyEventTemplate type 正确');
assert(caveEvent.triggeredAge === 70, 'applyEventTemplate triggeredAge 正确');
assert(Array.isArray(caveEvent.effects) === false, 'effects 不是数组');

// ============================================================
// 11. isTemplateEligible
// ============================================================
console.log('=== isTemplateEligible ===');

// age 不满足
const tooYoungTpl = WORLD_EVENT_TEMPLATES.find(t => t.type === 'demon_invasion')!;
assert(!isTemplateEligible(tooYoungTpl, { age: 10, realm: '炼气期' }, undefined, []), 'age 10 demon_invasion 不合格');

// age 满足
assert(isTemplateEligible(tooYoungTpl, { age: 50, realm: '炼气期' }, undefined, []), 'age 50 demon_invasion 合格');

// realm 不满足（仙门大比需要筑基）
const tournamentTpl = WORLD_EVENT_TEMPLATES.find(t => t.type === 'sect_tournament')!;
assert(!isTemplateEligible(tournamentTpl, { age: 50, realm: '炼气期' }, undefined, []), 'realm=炼气 不应触发仙门大比');
assert(isTemplateEligible(tournamentTpl, { age: 50, realm: '筑基期' }, undefined, []), 'realm=筑基 可触发仙门大比');

// cooldown 不满足
const tideLowTpl = WORLD_EVENT_TEMPLATES.find(t => t.type === 'spirit_tide_low')!;
assert(!isTemplateEligible(tideLowTpl, { age: 105, realm: '炼气期' }, undefined, [recentTideLow]),
  'age 105 spirit_tide_low cooldown 不满足');
// cooldown 满足
assert(isTemplateEligible(tideLowTpl, { age: 120, realm: '炼气期' }, undefined, [recentTideLow]),
  'age 120 spirit_tide_low cooldown 已过');

// prereq 不满足
const tideHighTpl = WORLD_EVENT_TEMPLATES.find(t => t.type === 'spirit_tide_high')!;
assert(!isTemplateEligible(tideHighTpl, { age: 30, realm: '炼气期' }, undefined, []),
  '无灵潮枯竭历史，spirit_tide_high 不合格');

// ============================================================
// 12. applyWorldEvent / decayWorldEvents：老行为兼容
// ============================================================
console.log('=== applyWorldEvent：多事件叠加 cultivationMultiplier ===');

const baseState: any = {
  age: 100,
  cultivationMultiplier: 1.0,
  lifespan: 200,
  rootMultiplier: 0.5,
  statusList: [],
};

const tideLowEvent: WorldEvent = {
  id: 'we-test-1', type: 'spirit_tide_low',
  triggeredAge: 100, triggeredWorldTime: { eraName: 'e', calendarYear: 100, elapsedDays: 36500 },
  duration: 5, effects: { cultivationMultiplier: 0.3 },
  narrative: 'test', appliedTo: 'all',
};
const afterTideLow = applyWorldEvent(baseState, tideLowEvent);
assert(afterTideLow.cultivationMultiplier === 0.3, 'apply: 灵潮枯竭 mul=0.3');
assert(Array.isArray(afterTideLow.statusList) && afterTideLow.statusList.length === 1, 'statusList 注入 1 条');

const demonEvent: WorldEvent = {
  id: 'we-test-2', type: 'demon_invasion',
  triggeredAge: 100, triggeredWorldTime: { eraName: 'e', calendarYear: 100, elapsedDays: 36500 },
  duration: 3, effects: { cultivationMultiplier: 0.5, lifespanModifier: -10 },
  narrative: 'test', appliedTo: 'all',
};
const afterDemon = applyWorldEvent(afterTideLow, demonEvent);
const expectedMul = 0.3 * 0.5;
assert(Math.abs(afterDemon.cultivationMultiplier - expectedMul) < 0.001,
  '双劫叠加 mul=0.15', { mul: afterDemon.cultivationMultiplier });
assert(afterDemon.lifespan === 190, 'lifespan 190 after demon_invasion');

console.log('=== decayWorldEvents：时间推进 ===');
const state3: any = {
  age: 200, cultivationMultiplier: 0.5, lifespan: 300,
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
assert(decayed1.worldEvent.activeEvents.length === 2, 'after 2y: 2 active');

const decayed2 = decayWorldEvents(state3, 4);
assert(decayed2.worldEvent.activeEvents.length === 1, 'after 4y: 1 active');
assert(!decayed2.worldEvent.activeEvents.some((a: any) => a.event.type === 'demon_invasion'),
  'demon_invasion 已结束');

const decayed3 = decayWorldEvents(state3, 10);
assert(decayed3.worldEvent.activeEvents.length === 0, 'after 10y: 0 active');
assert(decayed3.worldEvent.history.length === 2, 'history 2 条');

console.log('=== 工具 ===');
const state4: any = {
  worldEvent: {
    activeEvents: [
      { event: tideLowEvent, remainingYears: 5 },
      { event: demonEvent, remainingYears: 3 },
    ],
  },
};
assert(Math.abs(activeCultivationMultiplier(state4) - 0.15) < 0.001, 'active mul = 0.15');
assert(isUnderWorldEvent(state4, 'demon_invasion'), 'isUnder demon_invasion = true');
assert(!isUnderWorldEvent(state4, 'beast_invasion'), 'isUnder beast_invasion = false');

// ============================================================
// 13. 修仙感 E v2：lineage 联动 + 上轮事件反查
// ============================================================
console.log('=== 修仙感修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙 ===');

const lineageDemo = WORLD_EVENT_TEMPLATES.find(t => t.type === 'rare_treasure_surfaces')!;
assert(isTemplateEligible(lineageDemo, { age: 25, realm: '炼气期', ethnicity: 'human', lineage: '凡人' }, undefined, []),
  'rare_treasure_surfaces age 25 炼气 凡人/均可触发（applicableEthnicity 默认为空 即 *）');

// 综合 getAvailableEvents 修仙感：age 200 金丹修士在末法时代前夕，应能触发末法
const oldCultivator: any = {
  age: 200, realm: '金丹期', ethnicity: 'human', lineage: '修仙世家',
  worldEvent: { activeEvents: [], history: [] },
};
const oldAvailable = getAvailableEvents(oldCultivator, undefined, [], { limit: 100 });
const oldTypes = oldAvailable.map(t => t.type);
assert(oldTypes.includes('mofa_era_begins'), 'age 200 金丹 应包含末法时代降临');
assert(oldTypes.includes('great_cultivator_ascend'), 'age 200 应包含大修士飞升');
assert(oldTypes.includes('ancient_seal_weakens'), 'age 200 应包含上古封印松动');

// 历史反查：先前触发过灵潮枯竭（距今 20 年，cooldown 10 已过；且与 spirit_tide_high 互斥，
// 所以这里不复用含 spirit_tide_high 的 history），应能再次出现 spirit_tide_low
const complexHistory: WorldEvent[] = [
  { ...recentTideLow, triggeredAge: 180 },
];
const stateAfterComplex: any = {
  age: 200, realm: '金丹期', ethnicity: 'human', lineage: '凡人',
  worldEvent: { activeEvents: [], history: complexHistory },
};
const complexAvailable = getAvailableEvents(stateAfterComplex, undefined, complexHistory, { limit: 100 });
const complexTypes = complexAvailable.map(t => t.type);
// 因为灵潮枯竭在 180 年触发，cooldown=10，200-180=20 ≥ 10 → 再次可触发（且无 spirit_tide_high 互斥）
assert(complexTypes.includes('spirit_tide_low'), 'cooldown 已过：灵潮枯竭再次可触发');

// 修仙感修仙事件修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙修仙：spirit_tide_low 与 spirit_tide_high 互斥
const conflictHistory: WorldEvent[] = [
  {
    id: 'past-high', type: 'spirit_tide_high',
    triggeredAge: 185, triggeredWorldTime: { eraName: 'e', calendarYear: 185, elapsedDays: 67525 },
    duration: 3, effects: { cultivationMultiplier: 2.0 },
    narrative: 'past', appliedTo: 'all',
  },
];
const conflictState: any = {
  age: 200, realm: '金丹期', ethnicity: 'human', lineage: '凡人',
  worldEvent: { activeEvents: [], history: conflictHistory },
};
const conflictAvailable = getAvailableEvents(conflictState, undefined, conflictHistory, { limit: 100 });
const conflictTypes = conflictAvailable.map(t => t.type);
assert(!conflictTypes.includes('spirit_tide_low'), 'spirit_tide_low 与 spirit_tide_high 互斥——history 有 high 时不应再出现 low');

// ============================================================
// 总结
// ============================================================
console.log('\n=== 总结 ===');
console.log(JSON.stringify({
  templateCount: WORLD_EVENT_TEMPLATES.length,
  typeCount: WORLD_EVENT_TYPES.length,
  passes, failures, total: passes + failures,
}));

if (failures > 0) {
  console.error(`[FAIL] ${failures} test(s) failed`);
  process.exit(1);
}
console.log(`[PASS] all ${passes} tests passed`);
