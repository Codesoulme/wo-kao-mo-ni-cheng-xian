/**
 * Smoke test for memory/persistent.ts (Plan-A)
 * \u4e0d\u4f9d\u8d56 engine.ts\uff1b\u76f4\u63a5\u8bfb db.client + \u8c03 API
 */
import { db } from '../src/lib/db';
import {
  applyNpcRelationshipDelta,
  listNpcRelationships,
  addNarrativeMemory,
  listActiveMemories,
  resolveNarrativeMemory,
  decayMemories,
} from '../src/lib/xianxia/memory/persistent';

async function main() {
  // 1. \u627e\u4e00\u4e2a\u6d4b\u8bd5 character\uff08\u7528 latest \u90a3\u4e2a\uff09
  const character = await db.character.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, age: true },
  });
  if (!character) {
    console.error('[FAIL] no character in db');
    process.exit(1);
  }
  console.log('[1] use character:', character.id, character.name, 'age', character.age);

  // 2. applyNpcRelationshipDelta \u4e09\u6b21
  const npcKey = 'shi_zun_test_' + Date.now();
  const r1 = await applyNpcRelationshipDelta(
    character.id,
    npcKey,
    '\u5e08\u5c0a\u00b7\u51db\u865a',
    { affinity: 30, trust: 20, hostility: 0, lastEvent: 'first_meet' },
    character.age
  );
  console.log('[2.1] first meet:', r1.affinity, r1.trust);

  const r2 = await applyNpcRelationshipDelta(
    character.id,
    npcKey,
    '\u5e08\u5c0a\u00b7\u51db\u865a',
    { affinity: -40, trust: -10, hostility: 30, lastEvent: 'combat' },
    character.age
  );
  console.log('[2.2] after combat:', r2.affinity, r2.trust, 'hostility:', r2.hostility);

  const r3 = await applyNpcRelationshipDelta(
    character.id,
    npcKey,
    '\u5e08\u5c0a\u00b7\u51db\u865a',
    { affinity: 10, trust: 5, hostility: -10, lastEvent: 'reconcile' },
    character.age
  );
  console.log('[2.3] after reconcile:', r3.affinity, r3.trust, 'hostility:', r3.hostility);

  // 3. list
  const list = await listNpcRelationships(character.id);
  console.log('[3] list count:', list.length);
  console.log('     top:', list.slice(0, 3).map(r => r.npcName + '(' + r.affinity + ')').join(', '));

  // 4. addNarrativeMemory
  const mem1 = await addNarrativeMemory({
    characterId: character.id,
    category: 'unresolved_fate',
    intensity: 80,
    title: '\u6b20\u5e08\u5c0a\u4e09\u679a\u7075\u77f3',
    body: '\u521d\u5165\u5185\u95e8\u65f6\u5e08\u5c0a\u501f\u6211\u4e09\u679a\u7075\u77f3\u4e70\u4e39\uff0c\u672a\u53ca\u5f52\u8fd8\u3002',
    age: character.age,
  });
  console.log('[4.1] add memory:', mem1.id, mem1.title, 'intensity', mem1.intensity);

  const mem2 = await addNarrativeMemory({
    characterId: character.id,
    category: 'debt',
    intensity: 60,
    title: '\u843d\u971e\u5c71\u6551\u547d\u6069\u60c5',
    body: '\u5341\u4e94\u5c81\u90a3\u5e74\u843d\u971e\u5c71\u88ab\u7075\u517d\u56f4\u653b\uff0c\u5e08\u5c0a\u51fa\u624b\u76f8\u6551\u3002',
    age: character.age,
  });
  console.log('[4.2] add memory:', mem2.id, mem2.title);

  // 5. listActiveMemories
  const mems = await listActiveMemories(character.id, { minIntensity: 50 });
  console.log('[5] active memories (\u226550):', mems.length);
  for (const m of mems) console.log('     -', m.title, '[' + m.intensity + ']');

  // 6. resolveNarrativeMemory
  await resolveNarrativeMemory(mem1.id);
  const after = await listActiveMemories(character.id);
  console.log('[6] after resolve mem1, active:', after.length);

  // 7. decayMemories
  await decayMemories(character.id, 5);
  const decayed = await listActiveMemories(character.id);
  console.log('[7] after 5y decay, active:', decayed.length, 'top intensity:', decayed[0]?.intensity);

  // 8. \u6e05\u7406\u6d4b\u8bd5\u6570\u636e
  await db.npcRelationship.deleteMany({ where: { npcKey } });
  await db.narrativeMemory.deleteMany({ where: { id: { in: [mem1.id, mem2.id] } } });
  console.log('[8] cleanup done');

  console.log('\n=== MEMORY PLAN-A SMOKE: PASS ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('[SMOKE FAIL]', err);
  process.exit(1);
});
