import { computeCultivationFactors, computeEffectiveCultivationRate } from './src/lib/xianxia/engine';

const state: any = {
  age: 18, lifespan: 200, realm: 'qi_refining', realmLevel: 1,
  spiritualRoot: 'pure', rootDetail: '纯灵根',
  cultivationExp: 0, expToBreak: 200,
  hp: 100, maxHp: 100, mp: 50, maxMp: 50,
  attack: 12, defense: 6, speed: 10, luck: 50, comprehension: 60,
  spiritStones: 100, reputation: 0,
  alive: true, ascended: false, causeOfDeath: '',
  faction: '', master: '', location: 'test',
  fateNodes: [], isAtChoice: false,
  activeStatuses: [],
  inventory: [],
  equipped: [
    { id: 'a', name: '复制心法', description: '', item_type: 'scripture', rarity: 'rare', source: 't',
      effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1.3, description: '+30%' }] },
    { id: 'b', name: '复制心法', description: '', item_type: 'scripture', rarity: 'rare', source: 't',
      effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1.3, description: '+30%' }] },
  ],
  storageCapacity: 8,
  elements: { metal: 20, wood: 20, water: 20, fire: 30, earth: 20 },
  pendingThreads: [], characterIntents: [], heartDemon: 0, pets: [],
};
const factors = computeCultivationFactors(state);
console.log('factor count:', factors.length, 'names:', factors.map(f => f.name));
const rate = computeEffectiveCultivationRate(state);
console.log('multiplier:', rate.multiplier);