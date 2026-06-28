// Phase-V #6: Custom Technique Creator — 玩家创建自己的功法/法术。

export type TechniqueCategory = 'sword' | 'blade' | 'fist' | 'spell' | 'formation' | 'body' | 'movement';
export type TechniqueElement = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'wind' | 'thunder' | 'none';

export interface CustomTechnique {
  id: string;
  name: string;
  category: TechniqueCategory;
  element: TechniqueElement;
  realmRequirement: string;
  description: string;
  createdAt: number;
}

const CATEGORY_LABEL: Record<TechniqueCategory, string> = {
  sword: '剑法', blade: '刀法', fist: '拳法', spell: '法术',
  formation: '阵法', body: '炼体', movement: '身法',
};

const ELEMENT_LABEL: Record<TechniqueElement, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
  wind: '风', thunder: '雷', none: '无',
};

export function buildTechniqueDescription(input: {
  name: string;
  category: TechniqueCategory;
  element: TechniqueElement;
  realmRequirement: string;
}): string {
  const cat = CATEGORY_LABEL[input.category];
  const elem = ELEMENT_LABEL[input.element];
  return `${cat} · ${elem}性 · ${input.name}。修至${input.realmRequirement}可全解其妙。此法合${elem}之理，取${cat}之势，融${input.name}之意蕴。`;
}

export function validateTechniqueInput(input: {
  name?: string;
  category?: string;
  element?: string;
  realmRequirement?: string;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length < 2) {
    errors.push('功法名至少 2 字');
  }
  if (input.name && input.name.length > 12) {
    errors.push('功法名不超过 12 字');
  }
  if (!input.category || !Object.keys(CATEGORY_LABEL).includes(input.category)) {
    errors.push('功法类型须为 剑/刀/拳/法/阵/体/身 之一');
  }
  if (!input.element || !Object.keys(ELEMENT_LABEL).includes(input.element)) {
    errors.push('五行属性须为 金木水火土风雷/无 之一');
  }
  if (!input.realmRequirement || typeof input.realmRequirement !== 'string') {
    errors.push('需指定境界要求');
  }
  return { ok: errors.length === 0, errors };
}

export function createCustomTechnique(input: {
  name: string;
  category: TechniqueCategory;
  element: TechniqueElement;
  realmRequirement: string;
}): CustomTechnique {
  return {
    id: 'tech-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
    name: input.name,
    category: input.category,
    element: input.element,
    realmRequirement: input.realmRequirement,
    description: buildTechniqueDescription(input),
    createdAt: Date.now(),
  };
}

export const TECHNIQUE_CATEGORY_LABELS = CATEGORY_LABEL;
export const TECHNIQUE_ELEMENT_LABELS = ELEMENT_LABEL;
