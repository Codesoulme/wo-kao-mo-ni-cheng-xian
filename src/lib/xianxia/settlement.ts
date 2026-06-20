import type {
  CharacterState,
  GameEvent,
  HeritageCategory,
  HeritageRarity,
  SettlementOption,
  SettlementResult,
  SimulationHallRecord,
} from '@/lib/xianxia/store';

const RARITY_WEIGHT: Record<HeritageRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 6,
};

const RARITY_LABEL: Record<HeritageRarity, string> = {
  common: '凡品',
  uncommon: '良品',
  rare: '珍稀',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
};

const ITEM_TYPE_TO_CATEGORY: Record<string, HeritageCategory> = {
  scripture: 'scripture',
  artifact: 'artifact',
  weapon: 'treasure',
  armor: 'treasure',
  accessory: 'treasure',
  tool: 'treasure',
};

function stableId(prefix: string, seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `${prefix}-${hash.toString(36)}`;
}

function normalizeRarity(value: unknown, fallback: HeritageRarity): HeritageRarity {
  if (value === 'common' || value === 'uncommon' || value === 'rare' || value === 'epic' || value === 'legendary' || value === 'mythic') return value;
  return fallback;
}

function clampRarityByScore(rarity: HeritageRarity, score: number): HeritageRarity {
  const order: HeritageRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  const maxIndex = score >= 140 ? 5 : score >= 100 ? 4 : score >= 70 ? 3 : score >= 45 ? 2 : score >= 25 ? 1 : 0;
  return order[Math.min(order.indexOf(rarity), maxIndex)];
}

function isCultivationRewardLike(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '');
  return /cultivationExp|cultivationexp|修为|修煉|修炼|道行|经验/.test(text);
}

function itemToHeritage(item: any, score: number, source: string): SettlementOption | null {
  const name = String(item?.name || '').trim();
  if (!name || isCultivationRewardLike(name) || isCultivationRewardLike(item?.effects)) return null;
  const category = ITEM_TYPE_TO_CATEGORY[item?.item_type] || 'treasure';
  const rarity = clampRarityByScore(normalizeRarity(item?.rarity, 'common'), score);
  return {
    id: stableId('heritage', `${category}:${name}:${item?.id || ''}`),
    category,
    name,
    description: item?.description || '此物曾随你走过一世风尘，仍有一缕旧缘未散。',
    rarity,
    source,
    payload: item,
    reason: `${RARITY_LABEL[rarity]}旧物，适合作为下一世的开局因缘。`,
  };
}

function statusToHeritage(status: any, score: number): SettlementOption | null {
  const name = String(status?.name || '').trim();
  if (!name || isCultivationRewardLike(name) || isCultivationRewardLike(status?.effects)) return null;
  const rarity = clampRarityByScore(normalizeRarity(status?.rarity, 'uncommon'), score);
  return {
    id: stableId('heritage', `fate:${name}:${status?.id || ''}`),
    category: /体|血脉|灵根|根骨|道体|圣体/.test(name) ? 'constitution' : 'fate',
    name,
    description: status?.description || '一段刻入命盘的旧日因果。',
    rarity,
    source: status?.source || '一世命数',
    payload: status,
    reason: '命格与体质类因缘可被传承，但不会直接带出修为。',
  };
}

function petToHeritage(pet: any, score: number): SettlementOption | null {
  const name = String(pet?.name || '').trim();
  if (!name) return null;
  const rarity = clampRarityByScore(normalizeRarity(pet?.rarity, 'rare'), score);
  return {
    id: stableId('heritage', `pet:${name}:${pet?.id || ''}`),
    category: 'pet',
    name,
    description: pet?.description || '灵宠记得你的气息，愿在下一世再寻旧主。',
    rarity,
    source: '灵宠旧契',
    payload: pet,
    reason: '旧契未断，可作为下一轮模拟的灵宠缘起。',
  };
}

function eventToHeritage(event: GameEvent, score: number): SettlementOption | null {
  const title = event.title || event.blueprint?.name || '';
  const text = `${title} ${event.narrative || ''}`;
  if (!/(传承|功法|秘术|灵宠|法宝|体质|血脉|命格|奇遇|遗迹|飞升|战胜|斩|斗法)/.test(text)) return null;
  const rarity: HeritageRarity = clampRarityByScore(score >= 120 ? 'legendary' : score >= 80 ? 'epic' : 'rare', score);
  return {
    id: stableId('heritage', `event:${event.id}:${title}`),
    category: /功法|秘术|经/.test(text) ? 'scripture' : /灵宠|妖兽/.test(text) ? 'pet' : /体质|血脉/.test(text) ? 'constitution' : /法宝|灵器|宝/.test(text) ? 'artifact' : 'fate',
    name: title ? `${title}遗缘` : '无名遗缘',
    description: (event.narrative || '旧事化作一枚命运碎片。').slice(0, 80),
    rarity,
    source: `年岁 ${event.age}`,
    payload: event,
    reason: '此事在一世中留下回响，可化为下次模拟的开局因缘。',
  };
}

export function generateSettlementResult(character: CharacterState, events: GameEvent[]): SettlementResult {
  const inventory = [...(character.inventory || []), ...(character.equipped || [])];
  const statuses = character.activeStatuses || [];
  const pets = character.pets || [];
  const combatEvents = events.filter((event) => /战|斗|斩|杀|妖|魔|combat/i.test(`${event.title} ${event.narrative} ${event.eventType}`));
  const eventScore = Math.min(events.length * 2, 50);
  const ageScore = Math.min(Math.floor((character.age || 0) / 12), 35);
  const realmScore = (character.realmLevel || 0) * 12 + (character.ascended ? 80 : 0);
  const combatScore = Math.min(combatEvents.length * 8, 40);
  const collectionScore = Math.min(inventory.length * 3 + statuses.length * 3 + pets.length * 8, 40);
  const score = Math.max(1, eventScore + ageScore + realmScore + combatScore + collectionScore);

  const rank = score >= 160 ? '天外留名' : score >= 115 ? '一代宗师' : score >= 80 ? '名动一方' : score >= 45 ? '道途有痕' : '尘缘初记';
  const ending = character.ascended ? 'ascension' : 'death';
  const title = character.ascended ? '羽化登仙，旧世成碑' : '尘缘已尽，轮回将启';
  const summary = character.ascended
    ? `${character.name}终破凡尘，踏过${character.realmName || character.realm}之门。此世因果不随风散，其中至亮者可入传承池。`
    : `${character.name}止步于${character.age}岁，${character.causeOfDeath || '一身因果归于沉寂'}。一世虽终，仍有旧物旧缘可随轮回而去。`;

  const rawOptions = [
    ...inventory.map((item) => itemToHeritage(item, score, item?.source || '随身旧物')),
    ...statuses.map((status) => statusToHeritage(status, score)),
    ...pets.map((pet) => petToHeritage(pet, score)),
    ...events.slice(-12).map((event) => eventToHeritage(event, score)),
  ].filter(Boolean) as SettlementOption[];

  const unique = Array.from(new Map(rawOptions.map((item) => [item.id, item])).values())
    .sort((a, b) => RARITY_WEIGHT[b.rarity] - RARITY_WEIGHT[a.rarity]);
  const optionLimit = score >= 140 ? 8 : score >= 100 ? 6 : score >= 60 ? 5 : score >= 25 ? 4 : 3;
  const options = unique.slice(0, optionLimit);

  const notableDeeds = [
    character.ascended ? '羽化飞升，叩开天门' : character.causeOfDeath ? `终局：${character.causeOfDeath}` : '走完一段凡尘道途',
    character.realmName ? `最高境界：${character.realmName}` : `最高境界：${character.realm}`,
    events.length ? `留下${events.length}段岁月记载` : '此世记载寥寥，如墨未干',
    combatEvents.length ? `历经${combatEvents.length}场凶险争斗` : '',
  ].filter(Boolean).slice(0, 4);

  const now = new Date().toISOString();
  const id = stableId('settlement', `${character.id}:${character.age}:${character.ascended}:${events.length}`);
  const hallRecord: SimulationHallRecord = {
    id,
    characterName: character.name,
    gender: character.gender,
    age: character.age,
    highestRealm: character.realmName || character.realm,
    realmLevel: character.realmLevel || 0,
    ending,
    evaluationTitle: rank,
    score,
    notableDeeds,
    carriedOut: [],
    createdAt: now,
  };

  return {
    id,
    characterId: character.id,
    ending,
    title,
    summary,
    score,
    rank,
    options,
    hallRecord,
    createdAt: now,
  };
}
