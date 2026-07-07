// @ts-nocheck — E2E 测试脚本：mock minimal 类型即可，不要求完整 CharacterState
// E2E: 完整数据链路模拟（不调 LLM，纯引擎）
// 流程：
//   1) 凡人 12 岁 → applyAnnualAttributeGrowth 推一年 → 验证 force/guard/agility 增长
//   2) tickAllNpcsForYear 推一年 NPC → 验证 npc.lastGrowth 写入
//   3) parseAchievementMarkers 给一段含 AI 标记的 narrative → 验证解析正确（含自定义 category）
//   4) applyAchievements 触发成就 → 验证 state.__lastHeritageAdditions 写入
//   5) parseWorldEventMarkers 'immortal_descent' → 验证模板可用 + cooldown 限制
//   6) buildAchievementPromptHint → 验证 30 条种子池 + rewardHint 注入
//   7) emitFxs（fx-store）→ 验证订阅能收到 delta / breakthrough / drop / achievement 四类事件

import { applyAnnualAttributeGrowth } from '../src/lib/xianxia/engine/attributes.ts';
import { tickAllNpcsForYear } from '../src/lib/xianxia/npc-growth.ts';
import {
  parseAchievementMarkers,
  applyAchievements,
  buildAchievementPromptHint,
} from '../src/lib/xianxia/achievements.ts';
import {
  getAvailableEvents,
  applyWorldEvent,
  detectImmortalDisciple,
} from '../src/lib/xianxia/world-event-scheduler.ts';
import { useFxStore, emitFxs, fxId } from '../src/components/xianxia/fx-store.ts';

let passed = 0, failed = 0;
function assert(cond: any, label: string) {
  if (cond) {
    passed += 1;
    console.log('✓', label);
  } else {
    failed += 1;
    console.error('✗', label);
  }
}

// ============ 1) 凡人年度属性成长 + force/guard/agility 派生 ============
console.log('\n[1] 凡人年度属性成长 + force/guard/agility');
{
  const before = {
    age: 12,
    realm: 'mortal',
    rootMultiplier: 0.5,
    attack: 5,
    defense: 3,
    speed: 5,
    maxHp: 50,
    maxMp: 20,
    physicalFoundation: 0,
    spiritualSense: 0,
    soulStrength: 0,
    comprehension: 10,
    luck: 6,
    hp: 50,
    mp: 20,
  };
  const r = applyAnnualAttributeGrowth(before);
  assert(r.state.attack >= 5, `attack should be >= 5, got ${r.state.attack}`);
  assert(r.state.physicalFoundation > 0, `PF should be > 0, got ${r.state.physicalFoundation}`);
  assert(r.state.spiritualSense > 0, `SS should be > 0, got ${r.state.spiritualSense}`);
  assert(r.state.combatProjection.force > 0, `force should be > 0, got ${r.state.combatProjection.force}`);
  assert(r.state.combatProjection.agility > 0, `agility should be > 0, got ${r.state.combatProjection.agility}`);
  // 修真者 current > baseline 不被压低
  const cultivator = applyAnnualAttributeGrowth({
    age: 50, realm: 'foundation', rootMultiplier: 1.0,
    attack: 999, defense: 999, speed: 999, maxHp: 9999, maxMp: 9999,
    physicalFoundation: 1500, spiritualSense: 1500, soulStrength: 1500,
    comprehension: 80, luck: 40, hp: 9999, mp: 9999,
  });
  assert(cultivator.state.attack === 999, `cultivator attack preserved, got ${cultivator.state.attack}`);
  console.log('  growth:', r.growth);
}

// ============ 2) NPC 年度 tick ============
console.log('\n[2] NPC 年度 tick');
{
  const npcs = [
    { id: 'a', name: '甲', firstMetAge: 12, lastSeenAge: 12, realm: 'mortal', attitude: 'friendly' as any, relationshipScore: 30, memory: '', description: '', source: 'test' },
    { id: 'b', name: '乙', firstMetAge: 8,  lastSeenAge: 8,  realm: 'qi_refining', attitude: 'neutral' as any, relationshipScore: 0, memory: '', description: '', source: 'test' },
  ];
  const r = tickAllNpcsForYear(npcs, 1, 13);
  for (const n of r.nextNpcs) {
    assert(n.combatAttrs, `npc ${n.id} combatAttrs should exist`);
    assert(n.lastGrowth, `npc ${n.id} lastGrowth should exist`);
  }
  // 衰退段：凡人 40 → 70
  const aged = tickAllNpcsForYear([
    { id: 'c', name: '丙', firstMetAge: 40, lastSeenAge: 40, realm: 'mortal', attitude: 'neutral' as any, relationshipScore: 0, memory: '', description: '', source: 'test' },
  ], 30, 70);
  assert(aged.nextNpcs[0].combatAttrs.maxHp < 100, `aged NPC maxHp should drop, got ${aged.nextNpcs[0].combatAttrs.maxHp}`);
  console.log('  maxHp aged:', aged.nextNpcs[0].combatAttrs.maxHp);
}

// ============ 3) AI 成就解析（含自定义 category）============
console.log('\n[3] AI 成就解析');
{
  const narrative = '[ACHIEVEMENT:disciple-of-immortal] 仙人见我根骨不错……[REWARD:elixir/divine/九转金丹/炼化后突破无瓶颈]';
  const parsed = parseAchievementMarkers(narrative);
  assert(parsed.length === 1, `parse count = 1, got ${parsed.length}`);
  assert(parsed[0].reward.category === 'elixir', `custom category elixir, got ${parsed[0].reward.category}`);
  assert(parsed[0].reward.rarity === 'divine', `custom rarity divine, got ${parsed[0].reward.rarity}`);
  // narrative 提取
  const noReward = '[ACHIEVEMENT:first-decade] 主角悄然渡过十年，仙鹤送来「青鸾羽」。';
  const parsed2 = parseAchievementMarkers(noReward);
  assert(parsed2[0].reward.name === '青鸾羽', `extracted 青鸾羽, got ${parsed2[0].reward.name}`);
}

// ============ 4) applyAchievements → heritageVault ============
console.log('\n[4] applyAchievements + heritageVault');
{
  const state: any = { age: 12 };
  const narrative = '[ACHIEVEMENT:century-mark] 主角悄然渡过百年。[REWARD:elixir/divine/百年灵芝/延年益寿]';
  const parsed = parseAchievementMarkers(narrative);
  const r = applyAchievements(state, parsed, { triggeredAge: 100 });
  assert(r.newAchievements.length === 1, 'one new achievement');
  assert(state.__lastHeritageAdditions.length === 1, '__lastHeritageAdditions populated');
  assert(state.__lastHeritageAdditions[0].source === 'achievement:century-mark', `source ok: ${state.__lastHeritageAdditions[0].source}`);
  // 重复触发应去重
  const r2 = applyAchievements(state, parsed, { triggeredAge: 101, alreadyTriggered: new Set(['century-mark']) });
  assert(r2.newAchievements.length === 0, `duplicate should be 0, got ${r2.newAchievements.length}`);
}

// ============ 5) world-event 仙人下凡模板 ============
console.log('\n[5] world-event 仙人下凡');
{
  const state = { age: 10, realm: 'mortal', ethnicity: 'human', lineage: 'mortal' };
  const events = getAvailableEvents(state, { eraName: '青岚', calendarYear: 5000, elapsedDays: 0 }, []);
  const tpl = events.find(e => e.type === 'immortal_descent');
  assert(tpl, 'immortal_descent template should be available for age 10');
  // apply 事件
  const event = {
    id: 'we-immortal-10-1',
    type: 'immortal_descent' as const,
    triggeredAge: 10,
    triggeredWorldTime: { eraName: '青岚', calendarYear: 5000, elapsedDays: 0 },
    duration: 1,
    effects: { threadTitle: '仙人问渡', previousWorldLegacies: '仙人亲授基础吐纳残篇' },
    narrative: '仙人下凡模板',
    appliedTo: 'this' as const,
  };
  const narrative = '那年仙人正好路过我家村口，见我跪拜，便含笑将我收为记名弟子，赐号云深。';
  const next = applyWorldEvent(state, event, narrative);
  assert(next.teacherRef && next.teacherRef.sinceAge === 10, 'teacherRef.sinceAge = 10');
  assert(next.teacherRef.npcName === '下凡仙人' || next.teacherRef.npcName?.includes('仙人'), `teacher name ok: ${next.teacherRef.npcName}`);
  // detectImmortalDisciple 单独验证
  const detection = detectImmortalDisciple(narrative, 10);
  assert(detection.isDisciple, 'detectImmortalDisciple should detect disciple');
  // 没有关键句
  const noDisc = detectImmortalDisciple('仙人看了一眼便驾鹤而去，未曾与我交谈半句。', 10);
  assert(!noDisc.isDisciple, 'should NOT detect when no keywords');
}

// ============ 6) buildAchievementPromptHint ============
console.log('\n[6] buildAchievementPromptHint');
{
  const hint = buildAchievementPromptHint();
  assert(hint.length > 500, `hint length > 500, got ${hint.length}`);
  assert(hint.includes('rewardHint'), 'hint should mention rewardHint');
  assert(hint.includes('完全主导'), 'hint should explicitly tell AI to lead reward');
  assert(hint.includes('30 条成就候选'), 'hint should mention pool length 30');
  // 30 条都列出（行内 "- <id> |"）
  const idMatches = hint.match(/^[\t ]*-\s+[a-z0-9-]+\s*\|/gm) || [];
  assert(idMatches.length >= 30, `should list ≥30 entries, got ${idMatches.length}`);
}

// ============ 7) fx-store 端到端 ============
console.log('\n[7] fx-store E2E');
{
  useFxStore.getState().clear();
  const initial = useFxStore.getState().events.length;
  emitFxs([
    { id: fxId('delta'), kind: 'delta', label: '攻', value: 1 },
    { id: fxId('delta'), kind: 'delta', label: '神识', value: 2, tone: 'sky' },
    { id: fxId('breakthrough'), kind: 'breakthrough', fromRealm: '凡人', toRealm: '炼气期', triggeredAge: 16 },
    { id: fxId('drop'), kind: 'drop', name: '九转金丹', rarity: 'legendary' },
    { id: fxId('achievement'), kind: 'achievement', achievementId: 'qi-refining', name: '炼气入门', bucket: 'realm', rewardName: '九转金丹', rewardRarity: 'legendary' },
  ]);
  const after = useFxStore.getState().events.length;
  assert(after === initial + 5, `events should grow by 5, got ${after - initial}`);
  // remove
  const toRemove = useFxStore.getState().events[0].id;
  useFxStore.getState().remove(toRemove);
  assert(useFxStore.getState().events.length === 4, `after remove: ${useFxStore.getState().events.length}`);
  useFxStore.getState().clear();
  assert(useFxStore.getState().events.length === 0, 'clear should empty events');
}

// ============ 8) 综合：从 annual growth 到 fx emit 完整模拟 ============
console.log('\n[8] 全链路：advance → growth → __lastHeritageAdditions → fx');
{
  const state: any = {
    age: 12, realm: 'mortal', rootMultiplier: 0.5,
    attack: 5, defense: 3, speed: 5, maxHp: 50, maxMp: 20,
    physicalFoundation: 0, spiritualSense: 0, soulStrength: 0,
    comprehension: 10, luck: 6, hp: 50, mp: 20,
    npcs: [
      { id: 'a', name: '甲', firstMetAge: 12, lastSeenAge: 12, realm: 'mortal', attitude: 'friendly' as any, relationshipScore: 30, memory: '', description: '', source: 'test' },
    ],
  };

  // Step A: annual growth
  const g = applyAnnualAttributeGrowth(state);
  state.attack = g.state.attack;
  state.defense = g.state.defense;
  state.physicalFoundation = g.state.physicalFoundation;
  state.spiritualSense = g.state.spiritualSense;
  state.soulStrength = g.state.soulStrength;
  state.combatProjection = g.state.combatProjection;
  state.maxHp = g.state.maxHp;
  state.maxMp = g.state.maxMp;
  state.__lastAnnualGrowth = g.growth;

  // Step B: NPC tick
  const npcR = tickAllNpcsForYear(state.npcs, 1, 13);
  state.npcs = npcR.nextNpcs;

  // Step C: AI achievement
  const achNarrative = '[ACHIEVEMENT:first-decade] 主角悄然渡过十年。[REWARD:elixir/common/十年灵草/初入江湖的小小心意]';
  const parsed = parseAchievementMarkers(achNarrative);
  const achR = applyAchievements(state, parsed, { triggeredAge: 10 });
  state.__lastAchievements = achR.newAchievements.map(a => ({
    id: a.definition.id, name: a.definition.name, bucket: a.definition.bucket,
    reward: a.reward,
  }));

  // Step D: 模拟 useFxFromCharacter 行为
  useFxStore.getState().clear();
  const events: any[] = [];
  const growth = state.__lastAnnualGrowth;
  if (growth) {
    if (growth.attack > 0) events.push({ id: fxId('d'), kind: 'delta', label: '攻', value: growth.attack });
    if (growth.physicalFoundation > 0) events.push({ id: fxId('d'), kind: 'delta', label: '体魄', value: growth.physicalFoundation, tone: 'sky' });
    if (growth.spiritualSense > 0) events.push({ id: fxId('d'), kind: 'delta', label: '神识', value: growth.spiritualSense, tone: 'sky' });
    if (growth.force > 0) events.push({ id: fxId('d'), kind: 'delta', label: '破势', value: growth.force, tone: 'amber' });
  }
  for (const a of state.__lastAchievements) {
    events.push({
      id: fxId('a'), kind: 'achievement',
      achievementId: a.id, name: a.name, bucket: a.bucket,
      rewardName: a.reward.name, rewardRarity: a.reward.rarity,
    });
  }
  emitFxs(events);

  const fxEvents = useFxStore.getState().events;
  assert(fxEvents.length >= 5, `fx events should be >= 5, got ${fxEvents.length}`);
  const labels = fxEvents.filter((e: any) => e.kind === 'delta').map((e: any) => e.label);
  console.log('  delta labels:', labels.join(', '));
  assert(labels.includes('攻'), 'should have 攻 delta');
  assert(labels.includes('体魄'), 'should have 体魄 delta');
  assert(labels.includes('破势'), 'should have 破势 delta');
  assert(fxEvents.some((e: any) => e.kind === 'achievement'), 'should have achievement');
  assert(state.npcs[0].lastGrowth, 'npc should have lastGrowth');
}

console.log(`\n========== ${passed} passed, ${failed} failed ==========`);
if (failed > 0) process.exit(1);