// 手动 probe：world-chronicle-influence 语义验证（使用真实 DB）
// 前置：DB 里有 WorldChronicle 单例，probe 会：
//   1. 备份现有 schedule/history JSON
//   2. 插入若干 test 事件
//   3. 跑 parse + apply 各 case
//   4. 从 DB 读回验证
//   5. 恢复原始 schedule/history

import {
  parseInfluenceMarkers,
  stripInfluenceMarkers,
  applyInfluencesToChronicle,
} from '../src/lib/xianxia/world-chronicle-influence';
import { getChronicle } from '../src/lib/xianxia/world-chronicle-store';
import { db } from '../src/lib/db';

async function main() {
  // 备份
  await getChronicle(); // 确保 default row 存在
  const bak: any = await (db as any).worldChronicle.findFirst({ where: { id: 'default' } });
  const originalSchedule = bak.scheduleJson;
  const originalHistory = bak.historyJson;
  const originalCurYear = bak.currentYear;

  try {
    // 造 test 事件
    const testSchedule = [
      { id: 'probe-we-advance', type: 'demon_invasion', status: 'scheduled', scheduledYear: 5024, scheduledDrift: 5, plannedDuration: 3, narrativeSeed: '妖魔来袭', affectedCharacterIds: [], linkedThreadTitles: [], telemetry: { generatedAtYear: 5000, generatedForCharacterId: 'c1', generatedByModel: 'rng', rarityRoll: 0.5 } },
      { id: 'probe-we-delay-active', type: 'sect_war', status: 'active', scheduledYear: 5008, scheduledDrift: 2, actualStartYear: 5008, plannedDuration: 5, narrativeSeed: '门派大战', affectedCharacterIds: [], linkedThreadTitles: [], telemetry: { generatedAtYear: 5000, generatedForCharacterId: 'c1', generatedByModel: 'rng', rarityRoll: 0.5 } },
      { id: 'probe-we-weaken-active', type: 'drought', status: 'active', scheduledYear: 5010, scheduledDrift: 2, actualStartYear: 5010, plannedDuration: 3, narrativeSeed: '大旱', affectedCharacterIds: [], linkedThreadTitles: [], telemetry: { generatedAtYear: 5000, generatedForCharacterId: 'c1', generatedByModel: 'rng', rarityRoll: 0.5 } },
      { id: 'probe-we-cancel', type: 'demon_plot', status: 'scheduled', scheduledYear: 5050, scheduledDrift: 4, plannedDuration: 3, narrativeSeed: '阴谋', affectedCharacterIds: [], linkedThreadTitles: [], telemetry: { generatedAtYear: 5000, generatedForCharacterId: 'c1', generatedByModel: 'rng', rarityRoll: 0.5 } },
      { id: 'probe-we-active-not-advanceable', type: 'famine', status: 'active', scheduledYear: 5005, scheduledDrift: 2, actualStartYear: 5005, plannedDuration: 4, narrativeSeed: '饥荒', affectedCharacterIds: [], linkedThreadTitles: [], telemetry: { generatedAtYear: 5000, generatedForCharacterId: 'c1', generatedByModel: 'rng', rarityRoll: 0.5 } },
    ];
    const testHistory = [
      { id: 'probe-we-old', type: 'famine', status: 'concluded', scheduledYear: 4990, scheduledDrift: 2, actualStartYear: 4990, actualEndYear: 4993, actualDuration: 3, plannedDuration: 3, narrativeSeed: '往年饥荒', affectedCharacterIds: [], linkedThreadTitles: [], telemetry: { generatedAtYear: 4980, generatedForCharacterId: 'c1', generatedByModel: 'rng', rarityRoll: 0.5 } },
    ];

    await (db as any).worldChronicle.update({
      where: { id: 'default' },
      data: {
        scheduleJson: JSON.stringify(testSchedule),
        historyJson: JSON.stringify(testHistory),
        currentYear: 5010,
      },
    });

    // -------- case 1: parse --------
    {
      const nar = `我截击妖军。[WORLD_EVENT_INFLUENCE:probe-we-advance type=advance years=3 reason="主角先手截击"]又拖延粮草。[WORLD_EVENT_INFLUENCE:probe-we-delay-active type=delay years=2 reason="毁其粮草"] 修补封印。[WORLD_EVENT_INFLUENCE:probe-we-weaken-active type=weaken reason="以身补印"]破除阴谋。[WORLD_EVENT_INFLUENCE:probe-we-cancel type=cancel reason="斩首行动"]无效：[WORLD_EVENT_INFLUENCE:probe-we-old type=nuke reason="badtype"]`;
      const parsed = parseInfluenceMarkers(nar);
      console.log('[case1 parse] count=', parsed.length, '(expected 4, badtype 已丢弃)');
      if (parsed.length !== 4) throw new Error('case1 expected 4, got ' + parsed.length);
    }

    // -------- case 2: strip --------
    {
      const nar = '前文... [WORLD_EVENT_INFLUENCE:x type=advance reason="a"] 中间 [WORLD_EVENT_INFLUENCE:y type=cancel reason="b"] 尾巴';
      const cleaned = stripInfluenceMarkers(nar);
      console.log('[case2 strip] cleaned=', JSON.stringify(cleaned));
      if (/WORLD_EVENT_INFLUENCE/.test(cleaned)) throw new Error('case2 strip 残留');
    }

    // -------- case 3: advance scheduled --------
    {
      const r = await applyInfluencesToChronicle(
        [{ eventId: 'probe-we-advance', type: 'advance', years: 3, reason: '主角先手截击', matchedText: 'x' }],
        { currentYear: 5010, characterId: 'char-probe' },
      );
      const c = await getChronicle();
      const ev = c.schedule.find(e => e.id === 'probe-we-advance');
      console.log('[case3 advance scheduled] applied=', r.applied.length, 'scheduledYear=', ev?.scheduledYear, '(expected 5021)', 'causedBy=', JSON.stringify(ev?.causedBy));
      if (ev?.scheduledYear !== 5021) throw new Error('case3 scheduledYear');
      if (ev?.causedBy?.id !== 'char-probe') throw new Error('case3 causedBy');
    }

    // -------- case 4: cancel scheduled --------
    {
      const r = await applyInfluencesToChronicle(
        [{ eventId: 'probe-we-cancel', type: 'cancel', reason: '斩首行动', matchedText: 'x' }],
        { currentYear: 5010, characterId: 'char-probe' },
      );
      const c = await getChronicle();
      const ev = c.schedule.find(e => e.id === 'probe-we-cancel');
      console.log('[case4 cancel scheduled] applied=', r.applied.length, 'status=', ev?.status, '(expected canceled)', 'causedBy=', JSON.stringify(ev?.causedBy));
      if (ev?.status !== 'canceled') throw new Error('case4 status');
    }

    // -------- case 5: cancel active → skipped --------
    {
      const r = await applyInfluencesToChronicle(
        [{ eventId: 'probe-we-active-not-advanceable', type: 'cancel', reason: '强行取消', matchedText: 'x' }],
        { currentYear: 5010, characterId: 'char-probe' },
      );
      console.log('[case5 cancel active] applied=', r.applied.length, 'skipped=', r.skipped.length, 'reason=', r.skipped[0]?.reason, '(expected cancel_requires_scheduled)');
      if (r.skipped[0]?.reason !== 'cancel_requires_scheduled') throw new Error('case5');
    }

    // -------- case 6: advance active → skipped --------
    {
      const r = await applyInfluencesToChronicle(
        [{ eventId: 'probe-we-active-not-advanceable', type: 'advance', years: 2, reason: 'x', matchedText: 'x' }],
        { currentYear: 5010, characterId: 'char-probe' },
      );
      console.log('[case6 advance active] applied=', r.applied.length, 'skipped reason=', r.skipped[0]?.reason, '(expected active_cannot_advance)');
      if (r.skipped[0]?.reason !== 'active_cannot_advance') throw new Error('case6');
    }

    // -------- case 7: delay active → actualDuration + years --------
    {
      const r = await applyInfluencesToChronicle(
        [{ eventId: 'probe-we-delay-active', type: 'delay', years: 2, reason: '战事拖延', matchedText: 'x' }],
        { currentYear: 5010, characterId: 'char-probe' },
      );
      const c = await getChronicle();
      const ev = c.schedule.find(e => e.id === 'probe-we-delay-active');
      console.log('[case7 delay active] applied=', r.applied.length, 'plannedDuration=', ev?.plannedDuration, 'actualDuration=', ev?.actualDuration, '(expected 5+2=7)');
      if (ev?.actualDuration !== 7) throw new Error('case7 actualDuration');
    }

    // -------- case 8: weaken active → actualDuration - 1 + causedBy --------
    {
      const r = await applyInfluencesToChronicle(
        [{ eventId: 'probe-we-weaken-active', type: 'weaken', reason: '主角调停', matchedText: 'x' }],
        { currentYear: 5010, characterId: 'char-probe' },
      );
      const c = await getChronicle();
      const ev = c.schedule.find(e => e.id === 'probe-we-weaken-active');
      console.log('[case8 weaken active] applied=', r.applied.length, 'actualDuration=', ev?.actualDuration, '(expected 3-1=2)', 'causedBy=', JSON.stringify(ev?.causedBy));
      if (ev?.actualDuration !== 2) throw new Error('case8 actualDuration');
    }

    // -------- case 9: amplify concluded → causedBy 追记 --------
    {
      const r = await applyInfluencesToChronicle(
        [{ eventId: 'probe-we-old', type: 'amplify', reason: '后人传颂', matchedText: 'x' }],
        { currentYear: 5010, characterId: 'char-probe' },
      );
      const c = await getChronicle();
      const ev = c.history.find(e => e.id === 'probe-we-old');
      console.log('[case9 amplify concluded] applied=', r.applied.length, 'causedBy=', JSON.stringify(ev?.causedBy));
      if (r.applied.length !== 1) throw new Error('case9 applied');
      if (ev?.causedBy?.reason !== '后人传颂') throw new Error('case9 causedBy');
    }

    // -------- case 10: event_not_found --------
    {
      const r = await applyInfluencesToChronicle(
        [{ eventId: 'probe-we-nope', type: 'advance', years: 1, reason: 'x', matchedText: 'x' }],
        { currentYear: 5010, characterId: 'char-probe' },
      );
      console.log('[case10 not_found] skipped reason=', r.skipped[0]?.reason);
      if (r.skipped[0]?.reason !== 'event_not_found') throw new Error('case10');
    }

    // -------- case 11: years clamp >50 --------
    {
      const parsed = parseInfluenceMarkers('[WORLD_EVENT_INFLUENCE:x type=advance years=999 reason="a"]');
      console.log('[case11 years clamp]', parsed[0]?.years, '(expected 50)');
      if (parsed[0]?.years !== 50) throw new Error('case11 clamp');
    }

    console.log('\n[ALL 11 CASES PASSED]');
  } finally {
    // 恢复
    await (db as any).worldChronicle.update({
      where: { id: 'default' },
      data: {
        scheduleJson: originalSchedule,
        historyJson: originalHistory,
        currentYear: originalCurYear,
      },
    });
    console.log('[cleanup] restored original schedule/history/currentYear');
  }
}

main().catch(async e => {
  console.error('probe failed:', e);
  process.exit(1);
});
