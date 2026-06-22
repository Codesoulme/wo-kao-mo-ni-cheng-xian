export const ATTRIBUTE_LABEL: Record<string, string> = {
  age: '年龄',
  lifespan: '寿元',
  cultivationExp: '修为',
  expToBreak: '破境进度',
  hp: '气血',
  maxHp: '气血上限',
  mp: '灵力',
  maxMp: '灵力上限',
  attack: '\u7834\u52bf',
  defense: '\u62a4\u6301',
  speed: '\u673a\u53d8',
  luck: '气运',
  comprehension: '悟性',
  spiritStones: '灵石',
  reputation: '声望',
  heartDemon: '心魔',
  elementMetal: '金灵根',
  elementWood: '木灵根',
  elementWater: '水灵根',
  elementFire: '火灵根',
  elementEarth: '土灵根',
  storageCapacity: '储物容量',

  // 非角色数值属性，但可能出现在物品/事件效果里
  inventory: '物品',
  equipped: '装备',
  talisman_attack: '攻符威能',
  talisman_defense: '本回合减伤',
  talisman_heal: '气血回复',
  talisman_escape: '遁行符力',
  talisman_stun: '镇压符力',
  formationType: '阵盘类型',
};

export const HIDDEN_EFFECT_ATTRIBUTES = new Set([
  'formationType',
]);

export function attributeLabel(attr?: string): string {
  if (!attr) return '变化';
  return ATTRIBUTE_LABEL[attr] || '变化';
}

export function isInternalLikeAttr(attr?: string): boolean {
  if (!attr) return false;
  return /[A-Z_]/.test(attr) || attr.includes('_') || attr.includes('.') || attr.includes(':');
}

export function isVisibleNumericEventEffect(eff: any): boolean {
  if (!eff) return false;
  if (eff.kind) return Boolean(String(eff.name || '').trim());
  const attr = String(eff.attribute || '');
  if (!attr || HIDDEN_EFFECT_ATTRIBUTES.has(attr)) return false;
  const delta = Number(eff.delta || 0);
  if (delta === 0) return false;
  // 背包数量是内部计数，不用 +1/-1 打断沉浸；保留 reason，如“得 回春符”“售 木剑”
  if (attr === 'inventory' && !String(eff.reason || '').trim()) return false;
  return true;
}

export function formatEventEffectLabel(eff: any): string {
  if (!eff) return '';
  if (eff.kind) {
    const label = String(eff.label || '获得');
    const name = String(eff.name || '').trim();
    if (!name) return label;
    if (label === '获得状态' || label === '收服灵宠') return `${label}：${name}`;
    return `${label}${name}`;
  }
  const attr = String(eff.attribute || '');
  const reason = String(eff.reason || '').trim();
  const delta = Number(eff.delta || 0);

  if (attr === 'inventory') {
    return reason || (delta > 0 ? '获得物品' : '失去物品');
  }
  if (attr === 'equipped') {
    return reason || (delta > 0 ? '装备入手' : '装备失去');
  }

  const label = attributeLabel(attr);
  const amount = `${delta > 0 ? '+' : ''}${delta}`;
  return `${label}${amount}`;
}

export function eventEffectTone(eff: { attribute?: string; delta?: number; kind?: string; tone?: 'positive' | 'negative' | 'neutral' }): 'positive' | 'negative' | 'neutral' {
  if (eff.tone) return eff.tone;
  const delta = Number(eff.delta || 0);
  if (delta === 0) return 'neutral';
  if ((eff.attribute || '') === 'heartDemon') return delta > 0 ? 'negative' : 'positive';
  return delta > 0 ? 'positive' : 'negative';
}

export function formatItemEffectLabel(eff: any): string {
  const attr = String(eff?.target_attribute || eff?.attribute || '');
  if (!attr || HIDDEN_EFFECT_ATTRIBUTES.has(attr)) return '';
  const zh = attributeLabel(attr);
  const op = eff?.operation || 'add';
  const value = eff?.value ?? eff?.delta ?? '';
  if (op === 'add') return `${zh}${Number(value) > 0 ? '+' : ''}${value}`;
  if (op === 'multiply') return `${zh}×${value}`;
  if (op === 'override') return `${zh}改为${value}`;
  if (op === 'cap') return `${zh}上限${value}`;
  if (op === 'floor') return `${zh}下限${value}`;
  return `${zh}${value !== '' ? String(value) : ''}`;
}
