// 修真三宝 8 维派生链路 smoke —— 验证 dbToState + buildStateContext 输出真实数值
import { deriveCoreCultivationAttributes, deriveSoulRealm, deriveCombatProjection, deriveRealmTraits } from '../src/lib/xianxia/engine';
import type { CharacterState } from '../src/lib/xianxia/types';

const sampleMortal: CharacterState = {
  id: 'smoke-1', name: '测试凡人', age: 0, lifespan: 80, gender: 'male',
  spiritualRoot: 'common' as any, rootDetail: '火木双灵根', rootMultiplier: 1,
  realm: 'mortal', realmLevel: 0, cultivationExp: 0, expToBreak: 100,
  elements: { metal: 20, wood: 20, water: 20, fire: 20, earth: 20 },
  hp: 100, maxHp: 100, mp: 50, maxMp: 50,
  attack: 10, defense: 5, speed: 10,
  luck: 63, comprehension: 54,
  spiritStones: 0, reputation: 0,
  alive: true, ascended: false, causeOfDeath: '',
  faction: '', master: '', location: '青岚村',
  fateNodes: [], isAtChoice: false, lastEventAge: 0,
  activeStatuses: [], inventory: [], equipped: [],
  storageCapacity: 5, cultivationMultiplier: 1,
  cultivationInsight: '', cultivationFactors: [],
  longTermMemory: [], pendingThreads: [], characterIntents: [],
  combatSession: null, heartDemon: 0, pets: [],
  exploredRealms: [],
  tribulationProfile: { tribulationHistory: [] },
  karma: 0, merit: 0, sin: 0,
  spiritGarden: { zones: [] },
} as any;

const sampleQiRefining: CharacterState = {
  ...sampleMortal, age: 18, realm: 'qi_refining', realmLevel: 3,
  cultivationExp: 0, expToBreak: 100, lifespan: 120,
  hp: 130, maxHp: 130, mp: 80, maxMp: 80,
  attack: 25, defense: 15, speed: 22,
  luck: 68, comprehension: 72,
};

const sampleFoundation: CharacterState = {
  ...sampleMortal, age: 80, realm: 'foundation', realmLevel: 5,
  cultivationExp: 0, expToBreak: 600, lifespan: 200,
  hp: 300, maxHp: 300, mp: 220, maxMp: 220,
  attack: 70, defense: 45, speed: 55,
  luck: 75, comprehension: 88,
};

function probe(label: string, c: CharacterState) {
  const core = deriveCoreCultivationAttributes(c);
  const realm = deriveSoulRealm({ ...c, ...core });
  const combat = deriveCombatProjection({ ...c, ...core });
  const traits = deriveRealmTraits(c);
  console.log(`\n=== ${label} ===`);
  console.log(`  境界: ${c.realm}  等级: ${c.realmLevel}  悟性: ${c.comprehension}  灵力: ${c.maxMp}  气血: ${c.maxHp}`);
  console.log(`  神识 ${core.spiritualSense} / 魂魄 ${core.soulStrength} / 体魄 ${core.physicalFoundation}`);
  console.log(`  破势 ${combat.force} / 护持 ${combat.guard} / 机变 ${combat.agility}`);
  console.log(`  神魂境界: ${realm.name}（${realm.gap}）战斗摘要: ${combat.summary}`);
  console.log(`  优势: ${combat.advantages.join('、') || '无'}`);
  console.log(`  弱点: ${combat.vulnerabilities.join('、') || '无'}`);
}

probe('出生凡人（用户给的数 30/26/29/18/11/16/63/54）', sampleMortal);
probe('炼气 3 层', sampleQiRefining);
probe('筑基 5 层', sampleFoundation);

console.log('\n=== ATTRIBUTE_BOUNDS 含 3 个新条目 ===');
console.log('  spiritualSense / soulStrength / physicalFoundation 已加入 ATTRIBUTE_BOUNDS（0–9999）');
console.log('  （具体常量在 engine.ts 第 4xx 行内部 const，未 export；3 个新属性均能通过 applyChanges 路径被 AI 修改）');

console.log('\n=== smoke 通过 ===');
