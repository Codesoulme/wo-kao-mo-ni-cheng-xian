import { StatusEntry } from './types';

export type ConstitutionCategory = 'element' | 'combat' | 'social' | 'fate' | 'body' | 'dao';

export interface ConstitutionTemplate {
  id: string;
  name: string;
  category: ConstitutionCategory;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  description: string;
  effects: StatusEntry['effects'];
}

export const CONSTITUTIONS: ConstitutionTemplate[] = [
  { id: 'metal_body', name: '庚金灵体', category: 'element', rarity: 'rare', description: '肺金清鸣，天生亲近金行灵气，剑兵入手更易通灵。', effects: [
    { target_attribute: 'elementMetal', operation: 'add', value: 20, description: '金行亲和提升' },
    { target_attribute: 'attack', operation: 'add', value: 4, description: '金气锋锐，攻伐略强' },
    { target_attribute: 'cultivationExp', operation: 'multiply', value: 1.15, description: '金行功法修炼较快' },
  ] },
  { id: 'wood_body', name: '青木灵体', category: 'element', rarity: 'rare', description: '草木生机常绕周身，疗伤、炼丹与木行功法更有灵性。', effects: [
    { target_attribute: 'elementWood', operation: 'add', value: 20, description: '木行亲和提升' },
    { target_attribute: 'maxHp', operation: 'add', value: 20, description: '生机绵长' },
    { target_attribute: 'cultivationExp', operation: 'multiply', value: 1.12, description: '木行吐纳较顺' },
  ] },
  { id: 'water_body', name: '玄水灵体', category: 'element', rarity: 'rare', description: '神魂澄澈如深潭，灵力回复与水行术法更稳。', effects: [
    { target_attribute: 'elementWater', operation: 'add', value: 20, description: '水行亲和提升' },
    { target_attribute: 'maxMp', operation: 'add', value: 25, description: '灵海更深' },
    { target_attribute: 'cultivationExp', operation: 'multiply', value: 1.12, description: '水行吐纳较顺' },
  ] },
  { id: 'fire_body', name: '离火灵体', category: 'element', rarity: 'rare', description: '血气炽烈，火行术法与斗法爆发更强，但心绪也更易激荡。', effects: [
    { target_attribute: 'elementFire', operation: 'add', value: 20, description: '火行亲和提升' },
    { target_attribute: 'attack', operation: 'add', value: 5, description: '火气助攻' },
    { target_attribute: 'heartDemon', operation: 'add', value: 3, description: '火盛易躁' },
  ] },
  { id: 'earth_body', name: '厚土灵体', category: 'element', rarity: 'rare', description: '根骨沉稳，气血与防御更厚，适合稳扎稳打。', effects: [
    { target_attribute: 'elementEarth', operation: 'add', value: 20, description: '土行亲和提升' },
    { target_attribute: 'defense', operation: 'add', value: 5, description: '土气护身' },
    { target_attribute: 'maxHp', operation: 'add', value: 15, description: '根骨厚实' },
  ] },
  { id: 'sword_body', name: '先天剑体', category: 'combat', rarity: 'epic', description: '经脉似剑痕，天生与剑道相合，斗法凌厉，却也易结锋芒因果。', effects: [
    { target_attribute: 'attack', operation: 'multiply', value: 1.25, description: '剑道攻伐增幅' },
    { target_attribute: 'speed', operation: 'add', value: 4, description: '剑步轻捷' },
    { target_attribute: 'comprehension', operation: 'add', value: 8, description: '剑道悟性' },
  ] },
  { id: 'medicine_body', name: '百草道体', category: 'dao', rarity: 'epic', description: '血脉与草木药性相合，炼丹、疗伤、采药机缘更佳。', effects: [
    { target_attribute: 'luck', operation: 'add', value: 8, description: '草木机缘较多' },
    { target_attribute: 'comprehension', operation: 'add', value: 5, description: '丹道悟性' },
    { target_attribute: 'cultivationExp', operation: 'multiply', value: 1.18, description: '药气养身助修行' },
  ] },
  { id: 'charm_bone', name: '天生媚骨', category: 'social', rarity: 'epic', description: '容姿与气机极易牵动人心，交际机缘更盛，也更易引来是非。', effects: [
    { target_attribute: 'reputation', operation: 'add', value: 5, description: '易被人记住' },
    { target_attribute: 'luck', operation: 'add', value: 6, description: '人缘机缘更盛' },
  ] },
  { id: 'immortal_bone', name: '仙骨未开', category: 'fate', rarity: 'legendary', description: '骨中藏仙机，早年未必显露，遇大机缘时可能改写道途。', effects: [
    { target_attribute: 'comprehension', operation: 'add', value: 12, description: '悟性深藏' },
    { target_attribute: 'luck', operation: 'add', value: 10, description: '仙缘暗伏' },
  ] },
  { id: 'chaos_body', name: '混沌道胎', category: 'dao', rarity: 'mythic', description: '万法未分，一身自成小天地，修行潜力极高，因果也极重。', effects: [
    { target_attribute: 'cultivationExp', operation: 'multiply', value: 1.5, description: '万法同修' },
    { target_attribute: 'comprehension', operation: 'add', value: 20, description: '近道之悟' },
    { target_attribute: 'luck', operation: 'add', value: 12, description: '大因果牵引' },
  ] },
];

const WEIGHTS: Record<ConstitutionTemplate['rarity'], number> = {
  common: 20,
  uncommon: 16,
  rare: 10,
  epic: 4,
  legendary: 1.2,
  mythic: 0.25,
};

export function constitutionToStatus(c: ConstitutionTemplate, source = '天生体质'): StatusEntry {
  return {
    id: `status_body_${c.id}_${Math.random().toString(36).slice(2, 8)}`,
    name: c.name,
    description: c.description,
    category: 'special',
    rarity: c.rarity,
    duration: -1,
    source,
    effects: c.effects,
  };
}

export function rollBirthConstitution(): StatusEntry | null {
  // 大多数人没有特殊体质；约 18% 概率天生异质。
  if (Math.random() > 0.18) return null;
  const total = CONSTITUTIONS.reduce((sum, c) => sum + WEIGHTS[c.rarity], 0);
  let r = Math.random() * total;
  for (const c of CONSTITUTIONS) {
    r -= WEIGHTS[c.rarity];
    if (r <= 0) return constitutionToStatus(c);
  }
  return constitutionToStatus(CONSTITUTIONS[0]);
}

export function heritageToStatus(h: any): StatusEntry | null {
  const kind = h?.type || h?.category;
  if (!h || kind !== 'constitution') return null;
  const payload = h.payload || h;
  const found = CONSTITUTIONS.find(c => c.id === h.templateId || c.name === h.name || c.name === payload?.name);
  if (found) return constitutionToStatus(found, '轮回带入');
  return {
    id: `status_body_custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: String(h.name || payload?.name || '异质道体').slice(0, 16),
    description: String(h.description || payload?.description || '轮回中带来的特殊体质。').slice(0, 160),
    category: 'special',
    rarity: ['common','uncommon','rare','epic','legendary','mythic'].includes(h.rarity) ? h.rarity : 'rare',
    duration: -1,
    source: '轮回带入',
    effects: Array.isArray(payload?.effects) ? payload.effects : [{ target_attribute: 'luck', operation: 'add', value: 3, description: '轮回余泽' }],
  };
}
