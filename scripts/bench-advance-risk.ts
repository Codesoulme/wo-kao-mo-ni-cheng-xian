import { assessAdvanceRisk } from '../src/lib/xianxia/advance-risk';
import { dbToState } from '../src/lib/xianxia/engine/attributes';

const inventory = [
  { id: 'item_a1', name: '青锋剑', description: '旧剑，刃口有豁。', item_type: 'weapon', rarity: 'common', effects: [], source: 'test' },
  { id: 'item_a2', name: '回气丹', description: '丹丸三粒。', item_type: 'consumable', rarity: 'uncommon', effects: [{ target_attribute: 'hp', operation: 'add', value: 50, description: '回气' }], source: 'test' },
  { id: 'item_a4', name: '青囊', description: '寻常储物袋。', item_type: 'tool', rarity: 'common', effects: [{ target_attribute: 'storageCapacity', operation: 'add', value: 20, description: '容物' }], source: 'test' },
];
const equipped = [
  { id: 'item_a3', name: '麻布护腕', description: '护腕磨得发亮。', item_type: 'armor', rarity: 'common', effects: [{ target_attribute: 'defense', operation: 'add', value: 6, description: '护体' }], source: 'test' },
];
const statuses = [
  { id: 'st_a1', name: '旧疾', description: '入夜发寒。', category: 'debuff', rarity: 'common', duration: 5, effects: [], source: 'test' },
];
const threads = [
  { id: 'th_a1', title: '未了的仇怨', description: '那人临走时看了他一眼。', category: 'enemy', status: 'open', startAge: 38, urgency: 6 },
  { id: 'th_a2', title: '窑口的欠账', description: '还差三十枚灵石。', category: 'debt', status: 'open', startAge: 40, urgency: 4 },
];
const npcs = [
  { id: 'npc_a1', name: '喻大山', description: '窑口的老匠人。', attitude: 'friendly', role: 'family', firstMetAge: 0, memory: '教他认火色。' },
  { id: 'npc_a2', name: '陈九', description: '坊市的牙人。', attitude: 'neutral', role: 'merchant', firstMetAge: 35, memory: '压过他一次价。' },
];

function mkDb(): any {
  return {
    id: 'char_bench_1', name: '测试道者', gender: 'male', age: 42, lifespan: 120,
    spiritualRoot: 'single', rootDetail: '单灵根', realm: 'foundation', realmLevel: 3,
    cultivationExp: 100, expToBreak: 500,
    elementMetal: 20, elementWood: 10, elementWater: 5, elementFire: 30, elementEarth: 8,
    hp: 270, maxHp: 900, mp: 200, maxMp: 400,
    attack: 60, defense: 50, speed: 40, luck: 50, comprehension: 55,
    spiritStones: 1000, reputation: 30,
    alive: true, ascended: false, causeOfDeath: '',
    faction: '青岚散修', master: '', location: '青岚镇',
    fateNodes: '[]', isAtChoice: false, lastEventAge: 41,
    statusJson: JSON.stringify(statuses), inventoryJson: JSON.stringify(inventory),
    memoryJson: '[]', equippedJson: JSON.stringify(equipped), storageCapacity: 29,
    cultivationMultiplier: 1.2, cultivationInsight: '火色未足则器不成。',
    cultivationFactorsJson: '[]',
    pendingThreadsJson: JSON.stringify(threads), characterIntentsJson: '[]',
    combatStateJson: '', recentEventTypesJson: '[]', recentBlueprintCategoriesJson: '[]',
    petsJson: '[]', exploredRealmsJson: '[]', npcsJson: JSON.stringify(npcs),
    causalGraphJson: JSON.stringify({ nodes: [], edges: [] }), worldFactsJson: '[]',
    heartDemon: 62, karma: 0, merit: 0, sin: 0,
  };
}

const aiOutput: any = {
  narrative: '　　他在窑口前站了很久，手里的柴刀转了两圈，终究还是没有落下。\n　　远处传来山歌的尾音，拖得很长。',
  title: '窑火将熄', eventType: 'normal',
  changes: [
    { attribute: 'hp', delta: -120, reason: '恶战受创' },
    { attribute: 'heartDemon', delta: 22, reason: '杂念上涌' },
    { attribute: 'cultivationExp', delta: 40, reason: '苦修有得' },
  ],
  newItems: [{ name: '断口柴刀', description: '刃口崩了一处。', item_type: 'weapon', rarity: 'common', effects: [] }],
  newStatuses: [{ name: '旧伤发寒', description: '伤处入夜发寒。', category: 'debuff', rarity: 'common', duration: 3, effects: [] }],
  newThreads: [{ title: '未了的旧债', description: '那人临走时看了他一眼。', category: 'enemy' }],
  npcs: [{ name: '陈九', description: '坊市的牙人。', attitude: 'neutral', role: 'merchant' }],
  advanceThreads: [{ id: 'th_a1', progressNote: '对头露了行踪。' }],
  hasChoice: false,
};

const base = dbToState(mkDb());
console.log('state 反序列化 ok，inventory=', base.inventory.length, 'equipped=', base.equipped.length, 'hp=', base.hp, '/', base.maxHp, 'heartDemon=', base.heartDemon);

const N = 300;
for (let i = 0; i < 30; i++) assessAdvanceRisk(dbToState(mkDb()), aiOutput);

const durations: number[] = [];
let sample: any = null;
for (let i = 0; i < N; i++) {
  const s = dbToState(mkDb());
  const t0 = performance.now();
  const r = assessAdvanceRisk(s, aiOutput);
  durations.push(performance.now() - t0);
  if (i === 0) sample = r;
}
console.log('\n样例:', JSON.stringify({ score: sample?.score, level: sample?.level, factors: sample?.factors, shadow: sample?.shadow }, null, 2));
console.log('advisoryPrompt:\n' + (sample?.advisoryPrompt || '(空——未越阈值)'));

durations.sort((a, b) => a - b);
const sum = durations.reduce((a, b) => a + b, 0);
console.log(`\n=== ${N} 次影子试算（真实 dbToState 状态）===`);
console.log(`平均 ${(sum / N).toFixed(3)} ms / 中位 ${durations[Math.floor(N*0.5)].toFixed(3)} ms / p95 ${durations[Math.floor(N*0.95)].toFixed(3)} ms / max ${durations[N-1].toFixed(3)} ms`);

// 致命场景：验证 death 因子 + advisory 生成
const lethal = { ...aiOutput, causedDeath: true, deathReason: '力竭而亡' };
const r2 = assessAdvanceRisk(dbToState(mkDb()), lethal as any);
console.log(`\n致命场景 score=${r2?.score.toFixed(3)} level=${r2?.level} ${r2?.durationMs}ms factors=[${r2?.factors.map((f:any)=>f.code+':'+f.weight).join(', ')}]`);
console.log('advisoryPrompt:\n' + r2?.advisoryPrompt);

// 平安场景
const calm = { narrative: '　　他把柴搬完，坐在门槛上歇了一会儿。', title: '寻常一日', eventType: 'normal', changes: [{ attribute: 'cultivationExp', delta: 20, reason: '日常打坐' }] };
const r3 = assessAdvanceRisk(dbToState(mkDb()), calm as any);
console.log(`\n平安场景 score=${r3?.score.toFixed(3)} level=${r3?.level} factors=[${r3?.factors.map((f:any)=>f.code).join(', ')}] advisory=${r3?.advisoryPrompt ? '有' : '空'}`);

// 影子隔离验证：原 state 不能被改动
const orig = dbToState(mkDb());
const before = JSON.stringify(orig);
assessAdvanceRisk(orig, lethal as any);
console.log('\n原 state 未被改动:', JSON.stringify(orig) === before);
console.log('原 state 无 __shadowRun 残留:', (orig as any).__shadowRun === undefined);
