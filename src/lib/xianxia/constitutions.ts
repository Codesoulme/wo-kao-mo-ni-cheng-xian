import { StatusEntry, ConstitutionCategory, ConstitutionProfile, Element } from './types';

export interface ConstitutionTemplate {
  id: string;
  name: string;
  category: ConstitutionCategory;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  description: string;
  effects: StatusEntry['effects'];
  elementAffinity?: Element[];
  techniqueKeywords?: string[];
  resonanceTags?: string[];
  riskType?: ConstitutionProfile['riskType'];
  riskHint?: string;
  narrativeHooks?: string[];
  awakening?: ConstitutionProfile['awakening'];
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



const PROFILE_OVERRIDES: Record<string, Partial<ConstitutionProfile>> = {
  metal_body: { elementAffinity: ['metal'], techniqueKeywords: ['剑', '金', '锋', '兵'], resonanceTags: ['sword', 'metal', 'weapon'], riskType: 'attention', riskHint: '锋芒太露，容易引来剑修、兵修或夺体之人的注意。', narrativeHooks: ['金行矿脉会牵动肺金清鸣', '剑道传承更容易生出共鸣'], awakening: [{ stage: 2, name: '庚金鸣窍', minRealm: 'qi_refining', triggerHint: '经历剑兵斗法、金行矿脉或锋锐杀伐后可能觉醒。', description: '肺金窍穴初开，剑兵入手时灵机更盛。', effects: [{ target_attribute: 'attack', operation: 'add', value: 3, description: '庚金鸣窍，锋芒更利' }] }] },
  wood_body: { elementAffinity: ['wood'], techniqueKeywords: ['木', '草', '药', '生机', '疗'], resonanceTags: ['wood', 'alchemy', 'healing'], riskType: 'attention', riskHint: '生机外溢，容易被丹师、妖植或伤重之人盯上。', narrativeHooks: ['灵药园、古木秘境与疗伤事件更容易回响', '濒死或重伤时可能激发生机护身'], awakening: [{ stage: 2, name: '青木回春', minRealm: 'qi_refining', triggerHint: '疗伤、采药、木行秘境或濒死复苏后可能觉醒。', description: '草木生机入脉，伤势恢复与丹药感知更敏锐。', effects: [{ target_attribute: 'maxHp', operation: 'add', value: 15, description: '青木回春，生机更厚' }] }] },
  water_body: { elementAffinity: ['water'], techniqueKeywords: ['水', '冰', '潮', '寒', '雾'], resonanceTags: ['water', 'soul', 'underwater'], riskType: 'none', riskHint: '水气过盛时情绪与神魂易趋幽冷。', narrativeHooks: ['江河湖海、雨夜、寒潭与神魂事件更容易共鸣', '水下环境风险降低但寒邪事件更常见'], awakening: [{ stage: 2, name: '玄水照魂', minRealm: 'qi_refining', triggerHint: '寒潭静修、水下遇险或神魂震荡后可能觉醒。', description: '灵海澄澈，水行术法与神魂感应更稳。', effects: [{ target_attribute: 'maxMp', operation: 'add', value: 15, description: '玄水照魂，灵海更深' }] }] },
  fire_body: { elementAffinity: ['fire'], techniqueKeywords: ['火', '炎', '阳', '焰', '炉'], resonanceTags: ['fire', 'burst', 'alchemy'], riskType: 'heart_demon', riskHint: '火盛易躁，突破、斗法、炼丹失控时更容易牵动心魔。', narrativeHooks: ['丹炉、火脉、阳炎传承与激烈斗法更容易触发体质回响', '压制怒意或降服心火可推动觉醒'], awakening: [{ stage: 2, name: '离火燃脉', minRealm: 'qi_refining', triggerHint: '火脉修行、丹炉失控或以心火破局后可能觉醒。', description: '血脉中火意更烈，爆发更强但心魔牵动更重。', effects: [{ target_attribute: 'attack', operation: 'add', value: 3, description: '离火燃脉，爆发更盛' }, { target_attribute: 'heartDemon', operation: 'add', value: 2, description: '心火更炽' }] }] },
  earth_body: { elementAffinity: ['earth'], techniqueKeywords: ['土', '山', '岩', '岳', '镇'], resonanceTags: ['earth', 'defense', 'formation'], riskType: 'none', riskHint: '厚土沉稳，但遇轻灵迅疾之法时转圜较慢。', narrativeHooks: ['山岳地脉、阵法镇压与守护事件更容易回响', '重伤硬抗后可能夯实根骨'], awakening: [{ stage: 2, name: '厚土地骨', minRealm: 'qi_refining', triggerHint: '地脉淬体、阵法镇压或重伤硬抗后可能觉醒。', description: '骨相如山，防御与气血更稳。', effects: [{ target_attribute: 'defense', operation: 'add', value: 3, description: '厚土地骨，护体更稳' }] }] },
  sword_body: { elementAffinity: ['metal'], techniqueKeywords: ['剑', '剑诀', '剑意', '锋芒'], resonanceTags: ['sword', 'combat', 'metal'], riskType: 'conflict', riskHint: '剑体锋芒太盛，容易招来切磋、挑战、夺剑与剑道因果。', narrativeHooks: ['剑修宗门、剑冢、剑意残痕会强烈牵动此体质', '败于强敌或生死一剑后可能更进一步'], awakening: [{ stage: 2, name: '剑骨初鸣', minRealm: 'qi_refining', triggerHint: '生死剑斗、剑冢共鸣或领悟剑意后可能觉醒。', description: '骨脉中剑鸣不止，剑道术法适配更高。', effects: [{ target_attribute: 'attack', operation: 'add', value: 6, description: '剑骨初鸣，攻伐更锐' }] }] },
  medicine_body: { elementAffinity: ['wood'], techniqueKeywords: ['丹', '药', '草', '木', '疗'], resonanceTags: ['alchemy', 'wood', 'healing'], riskType: 'attention', riskHint: '药性亲和会引来丹师邀约，也可能被人觊觎为活药引。', narrativeHooks: ['采药、炼丹、疗伤、毒瘴事件应优先考虑此体质', '炼丹成功或救人后可能推动觉醒'], awakening: [{ stage: 2, name: '百草入脉', minRealm: 'qi_refining', triggerHint: '炼成高品质丹药、救治重伤者或误入灵药秘境后可能觉醒。', description: '百草药性入脉，丹道与疗伤机缘更深。', effects: [{ target_attribute: 'luck', operation: 'add', value: 4, description: '百草入脉，药缘更盛' }] }] },
  charm_bone: { techniqueKeywords: ['魅', '幻', '心', '音', '舞'], resonanceTags: ['social', 'illusion', 'charm'], riskType: 'attention', riskHint: '气机牵人心，容易带来桃花、误会、觊觎与社交风波。', narrativeHooks: ['交际、宗门人情、魅惑幻术、情债事件应优先考虑此体质', '处理人情因果可推动觉醒'], awakening: [{ stage: 2, name: '媚骨生香', minAge: 14, triggerHint: '重大社交周旋、情债因果或幻术修行后可能觉醒。', description: '举止间更易牵动人心，但也更容易卷入是非。', effects: [{ target_attribute: 'reputation', operation: 'add', value: 4, description: '媚骨生香，名声更显' }] }] },
  immortal_bone: { techniqueKeywords: ['仙', '骨', '悟', '传承', '雷劫'], resonanceTags: ['fate', 'inheritance', 'breakthrough'], riskType: 'attention', riskHint: '仙骨未开时平平无奇，一旦露相，容易牵动大宗门与夺骨邪法。', narrativeHooks: ['大机缘、传承、雷劫、濒死顿悟可推动仙骨开相', '早年应低频暗示，不宜每年机械触发'], awakening: [{ stage: 2, name: '仙骨开相', minRealm: 'foundation', triggerHint: '大传承、雷劫洗骨或濒死顿悟后可能觉醒。', description: '骨中仙机显露，悟性与气运更进一步，但因果也更重。', effects: [{ target_attribute: 'comprehension', operation: 'add', value: 8, description: '仙骨开相，悟性更深' }, { target_attribute: 'luck', operation: 'add', value: 5, description: '仙缘显露' }] }] },
  chaos_body: { elementAffinity: ['metal', 'wood', 'water', 'fire', 'earth'], techniqueKeywords: ['混沌', '太初', '五行', '万法', '阴阳'], resonanceTags: ['chaos', 'dao', 'all-elements'], riskType: 'backlash', riskHint: '万法同源也万法相冲，吞纳不当时反噬极重。', narrativeHooks: ['太初遗迹、五行失衡、阴阳冲突与大道传承会强烈牵动此体质', '每次大幅跃迁都应伴随同等级因果代价'], awakening: [{ stage: 2, name: '太初一烁', minRealm: 'foundation', triggerHint: '五行齐动、大道传承或濒死重塑根基后可能觉醒。', description: '一身小天地初成，万法适配更广，但反噬也更重。', effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1.2, description: '太初一烁，万法同修' }] }] },
};

export function constitutionProfileOf(c: ConstitutionTemplate): ConstitutionProfile {
  const override = PROFILE_OVERRIDES[c.id] || {};
  const awakening = override.awakening || c.awakening || [];
  return {
    id: c.id,
    category: c.category,
    rarity: c.rarity,
    currentStage: 1,
    maxStage: Math.max(1, ...awakening.map(stage => stage.stage || 1)),
    ...override,
    awakening,
  };
}

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
    constitution: constitutionProfileOf(c),
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
