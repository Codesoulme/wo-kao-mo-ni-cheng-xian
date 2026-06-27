// scripts/auto-test-l3-mechanisms.ts
// AI-75: L3 机制自动测试（不依赖 dev server，调用 engine 派生函数）
import {
  deriveTribulationTrigger,
  resolveTribulationBolt,
  resolveHeartDemon,
  deriveAscensionRequirements,
  checkAscensionEligibility,
  deriveAscensionTrigger,
  resolveAscensionOutcome,
  deriveCrossRealmPaths,
  checkRestrictionAccess,
  deriveRestrictionTrigger,
  resolveRestrictionInteraction,
  deriveRealmRestrictionCheck,
} from '../src/lib/xianxia/engine';
import type { Restriction } from '../src/lib/xianxia/types';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function expect(label: string, cond: unknown, detail?: string): void {
  if (cond) { passed++; }
  else { failed++; failures.push(`${label}: ${detail ?? 'failed'}`); }
}

// --- 飞升机制 ---
const ascReq = deriveAscensionRequirements('humanWorld');
expect('ascension-req-human-world', ascReq.toTier === 'spiritWorld' && ascReq.minRealm === 'mahayana');

const charOk = { realm: 'mahayana' as const, cultivationExp: 200000, lifespan: 600, reputation: 8000, daoHeart: 90 };
const charBad = { realm: 'mahayana' as const, cultivationExp: 1000, lifespan: 100, reputation: 100, daoHeart: 30 };
expect('ascension-eligible-ok', checkAscensionEligibility(charOk, ascReq).eligible === true);
expect('ascension-not-eligible-bad', checkAscensionEligibility(charBad, ascReq).eligible === false);

expect('ascension-trigger-mahayana-500', deriveAscensionTrigger(500, 'mahayana').triggered === true);
expect('ascension-trigger-young', deriveAscensionTrigger(50, 'mahayana').triggered === false);

expect('ascension-outcome-passed', resolveAscensionOutcome({
  characterRoll: 0.9, daoHeart: 100, tribulationPassed: true, requirements: ascReq,
}).passed === true);
expect('ascension-outcome-failed-no-tribulation', resolveAscensionOutcome({
  characterRoll: 0.9, daoHeart: 100, tribulationPassed: false, requirements: ascReq,
}).passed === false);

// --- 跨域通道 ---
expect('cross-realm-humanWorld', deriveCrossRealmPaths('humanWorld').length >= 1);
expect('cross-realm-immortalWorld', deriveCrossRealmPaths('immortalWorld').length >= 2);

// --- 天劫机制 ---
expect('tribulation-trigger-deity', deriveTribulationTrigger('golden_core', 'deity_transformation').triggered === true);
expect('tribulation-trigger-no', deriveTribulationTrigger('mortal', 'qi_refining').triggered === false);

expect('bolt-1-passed', resolveTribulationBolt({
  boltNumber: 1, characterRoll: 1.0, heartDemon: 0, soulStrength: 100, bondedArtifactResonance: true,
}).passed === true);
expect('bolt-9-failed-low-roll', resolveTribulationBolt({
  boltNumber: 9, characterRoll: 0, heartDemon: 90, soulStrength: 0, bondedArtifactResonance: false,
}).passed === false);

// --- 心魔机制 ---
expect('heart-demon-fear', resolveHeartDemon({
  innerState: { obsession: 10, hatred: 10, love: 10, fear: 100, regret: 10 }, resolveRoll: 0.9,
}).demonType === 'fear');
expect('heart-demon-passed', resolveHeartDemon({
  innerState: { obsession: 10, hatred: 10, love: 10, fear: 10, regret: 10 }, resolveRoll: 1.0,
}).passed === true);

// --- 禁制机制 ---
const keyRestriction: Restriction = {
  id: 'r1', name: '禁门', type: 'door', accessMethod: 'key', requiredItemId: 'k1', description: '守门禁制', difficulty: 50,
};
expect('restriction-key-missing', checkRestrictionAccess(keyRestriction, { inventory: [], realm: 'qi_refining' }).accessible === false);
expect('restriction-key-found', checkRestrictionAccess(keyRestriction, {
  inventory: [{ id: 'k1', name: '钥匙', description: '', item_type: 'tool', rarity: 'common', effects: [], source: '' } as any],
  realm: 'qi_refining',
}).accessible === true);
expect('restriction-trigger', deriveRestrictionTrigger(keyRestriction, { realm: 'qi_refining' }).triggered === true);
expect('restriction-combat', resolveRestrictionInteraction({ ...keyRestriction, accessMethod: 'combat', combatPower: 50 }, 'combat', 30).outcome === 'combat');

// --- 洞府联动 ---
expect('realm-restriction-can-enter', deriveRealmRestrictionCheck(
  { id: 'realm1', requiredRestrictionsPassed: ['r1'], restrictions: [keyRestriction] },
  ['r1'],
).canEnter === true);
expect('realm-restriction-missing', deriveRealmRestrictionCheck(
  { id: 'realm1', requiredRestrictionsPassed: ['r1', 'r2'], restrictions: [] },
  ['r1'],
).canEnter === false);

console.log(JSON.stringify({ passed, failed, failures, suite: 'auto-test-l3-mechanisms' }));
if (failed > 0) process.exit(1);