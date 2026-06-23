/**
 * 叙事驱动的身体修正
 *
 * age-based body growth 是"baseline"（凡人25岁应 attack=5）
 * 但叙事里可能出现"久病/缠绵病榻"等场景，引擎必须让 body 偏离 baseline
 *
 * 关键词模式：
 * - 久病/重病/垂危/缠绵病榻/气息奄奄/卧床 → 0.30x（baseline 30%）
 * - 病弱/体弱/瘦弱/病根/旧疾/体虚 → 0.50x（baseline 50%）
 * - 病愈/痊愈/康复/久病初愈/初愈/复元 → 1.00x（恢复）
 * - 修真后属性保留：current > baseline*multiplier 时保留 current
 *
 * 这是纯引擎行为：从 narrative 文本读取，AI 漏写 changes 也能应用
 */
export type BodyModifierMode = 'healthy' | 'weak' | 'critically_ill' | 'recovered';

interface ModifierPattern {
  keywords: RegExp;
  mode: BodyModifierMode;
  multiplier: number;
  reason: string;
}

const MODIFIER_PATTERNS: ModifierPattern[] = [
  // 恢复类先匹配（避免"久病初愈"被算成"久病"）
  {
    keywords: /(久病初愈|初愈|病愈|病好了|痊愈|复元|康复|起死回生)/,
    mode: 'recovered',
    multiplier: 1.0,
    reason: 'narrative-recovered',
  },
  // 重病
  {
    keywords: /(缠绵病榻|卧床不起|气息奄奄|病入膏肓|濒死|垂危|重病|绝症|沉疴)/,
    mode: 'critically_ill',
    multiplier: 0.30,
    reason: 'narrative-critically-ill',
  },
  // 病弱
  {
    keywords: /(久病|病弱|体弱|瘦弱|病根|旧疾|体虚|羸弱|孱弱|先天不足|身染沉疾|气血两亏)/,
    mode: 'weak',
    multiplier: 0.50,
    reason: 'narrative-weak',
  },
];

export function detectBodyModifier(narrative: string): { mode: BodyModifierMode; multiplier: number; reason: string } {
  if (!narrative || narrative.length < 10) {
    return { mode: 'healthy', multiplier: 1.0, reason: 'no-narrative' };
  }
  for (const p of MODIFIER_PATTERNS) {
    if (p.keywords.test(narrative)) {
      return { mode: p.mode, multiplier: p.multiplier, reason: p.reason };
    }
  }
  return { mode: 'healthy', multiplier: 1.0, reason: 'narrative-healthy' };
}
