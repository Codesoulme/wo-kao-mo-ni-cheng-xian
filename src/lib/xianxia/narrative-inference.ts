/**
 * 引擎兜底：当 AI 漏写 changes 字段时，从 narrative 关键词 + 当前境界推断合理属性变化
 *
 * 修真叙事风 AI 常把 narrative 写得生动但忘记给 changes
 * 这个模块让 engine 在 inputChanges 为空时，自动从叙事里"读"出合理 delta
 */
import type { AttributeChange, CharacterState } from './types';

interface NarrativeInferencePattern {
  keywords: RegExp;
  changes: (state: CharacterState, base: number) => AttributeChange[];
  reason: string;
}

// 修为自然增长 - 每岁根据境界 + 灵根倍率
const CULTIVATION_BASE: Record<string, number> = {
  mortal: 0, qi_refining: 15, foundation: 50, golden_core: 120,
  nascent_soul: 250, soul_transformation: 500, tribulation: 800, immortal: 1200,
};

// 灵根倍率（与引擎一致）
const ROOT_MULT: Record<string, number> = {
  none: 0, mixed: 0.3, common: 0.8, pure: 1.5, heavenly: 3, chaos: 5,
};

const patterns: NarrativeInferencePattern[] = [
  // ===== 修为/修炼类 =====
  {
    keywords: /(修炼|打坐|吐纳|引气|灵气|灵力|功法|悟道|闭关|入定|调息|温养|内观|经年|岁岁)/,
    changes: (state, base) => {
      const root = ROOT_MULT[state.spiritualRoot] ?? 0;
      const mult = state.cultivationMultiplier || 1;
      const realm = CULTIVATION_BASE[state.realm] ?? 0;
      const delta = Math.max(0, Math.round(realm * (root || mult) * 0.3));
      if (delta <= 0) return [];
      return [{ attribute: 'cultivationExp', delta, reason: 'narrative-inferred: 修炼增益' }];
    },
    reason: 'narrative-inferred-cultivation',
  },
  // ===== 战斗/受伤类 =====
  {
    keywords: /(受伤|重创|负伤|血战|险胜|拼死|苦战|厮杀)/,
    changes: (_state, _base) => [
      { attribute: 'hp', delta: -10, reason: 'narrative-inferred: 战斗损耗' },
    ],
    reason: 'narrative-inferred-combat',
  },
  // ===== 修养/恢复类 =====
  {
    keywords: /(调养|养伤|痊愈|复原|药到病除|休养)/,
    changes: (_state, _base) => [
      { attribute: 'hp', delta: 15, reason: 'narrative-inferred: 修养恢复' },
    ],
    reason: 'narrative-inferred-recovery',
  },
  // ===== 心魔/执念类 =====
  {
    keywords: /(心魔|执念|入魔|魔障|心绪不宁|贪念|嗔怒|怨念)/,
    changes: (_state, _base) => [
      { attribute: 'heartDemon', delta: 5, reason: 'narrative-inferred: 心魔滋生' },
    ],
    reason: 'narrative-inferred-heart-demon',
  },
  // ===== 心境/道心类 =====
  {
    keywords: /(顿悟|心性|道心|心境|平和|坦然|无欲|放下|释怀|清心)/,
    changes: (_state, _base) => [
      { attribute: 'heartDemon', delta: -3, reason: 'narrative-inferred: 心境平和' },
    ],
    reason: 'narrative-inferred-clarity',
  },
  // ===== 悟性/理解类 =====
  {
    keywords: /(顿悟|豁然开朗|明悟|开悟|洞悉|窥见|了然)/,
    changes: (_state, _base) => [
      { attribute: 'comprehension', delta: 1, reason: 'narrative-inferred: 悟性微涨' },
    ],
    reason: 'narrative-inferred-comprehension',
  },
  // ===== 寿元/老化 =====
  {
    keywords: /(年迈|垂垂|苍老|白首|老态|寿元|气血衰败)/,
    changes: (_state, _base) => [
      { attribute: 'lifespan', delta: -1, reason: 'narrative-inferred: 岁月流逝' },
    ],
    reason: 'narrative-inferred-aging',
  },
  // ===== 灵石/财富 =====
  {
    keywords: /(灵石|钱财|金银|赏赐|卖掉|换得|得了一笔|发了笔财)/,
    changes: (_state, _base) => [
      { attribute: 'spiritStones', delta: 5, reason: 'narrative-inferred: 财货入账' },
    ],
    reason: 'narrative-inferred-wealth',
  },
];

export function inferAttributeChangesFromNarrative(
  narrative: string,
  state: CharacterState,
  source: string,
): AttributeChange[] {
  if (!narrative || narrative.length < 20) return [];
  const base = 1;
  const collected: AttributeChange[] = [];
  const seen = new Set<string>();
  for (const p of patterns) {
    if (p.keywords.test(narrative)) {
      const changes = p.changes(state, base);
      for (const c of changes) {
        const key = c.attribute;
        if (seen.has(key)) continue;
        seen.add(key);
        // reason 加上 source 便于 trace
        collected.push({
          attribute: c.attribute,
          delta: c.delta,
          reason: `${c.reason} (${source})`,
        });
      }
    }
  }
  return collected;
}
